// 路由主编排器 — P1: ReAct 循环（批量调用 + 按需追查）
import { assemblePrompt } from './prompt-assembler'
import { computeConfidence } from './confidence'
import { detectDisplayFormat, buildStructuredResult } from './result-presenter'
import { computeIntentHash } from './intent'
import { TraceCollector } from './trace'
import { maybeUpdateVerdict } from './verdict'
import type { ToolRegistry } from '@/lib/tools/registry'
import type { StorageInterface } from '@/lib/storage/types'
import type {
  LLMProvider, StructuredResult, ToolResult, ThinkResult,
  IntentTags, ConfidenceSignals, ConfidenceLevel, MemorySession,
} from '@/lib/types'

const MAX_CHASE_ROUNDS = 2  // ①规划 → ②审查放开 → ③finish，最多 3 次 think
const ESCALATION_MODEL = process.env.LLM_ESCALATION_MODEL || 'gpt-5.4'

interface RouterDeps {
  registry: ToolRegistry
  llm: LLMProvider
  storage: StorageInterface
  callTool: (name: string, args: Record<string, unknown>) => Promise<ToolResult>
  history?: Array<{ role: string; content: string }>
  tenantId?: string
  userId?: string
}

/**
 * 核心路由入口 — P1 ReAct 循环
 * 统一流程，无需预判复杂度：规划→执行→观察→决定是否追查
 */
export async function processQuery(
  query: string,
  deps: RouterDeps,
): Promise<StructuredResult> {
  const { registry, llm, storage, callTool, history } = deps
  const tenantId = deps.tenantId ?? 'default'
  const userId = deps.userId ?? 'anonymous'

  const trace = new TraceCollector(query)
  const allTools = registry.getAllTools()
  const allResults: Array<{ tool: string; data: unknown }> = []
  const sources: Array<{ tool: string; description: string }> = []

  // 对话历史上下文
  const historyContext = history && history.length > 1
    ? history.slice(0, -1).map(m => `${m.role === 'user' ? '用户' : '系统'}: ${m.content}`).join('\n')
    : undefined

  // 查 verdict（先用空 hash，首轮 think 后更新）
  let intent: IntentTags | undefined
  let clarity: ConfidenceLevel = 'medium'
  let verdict = null as ReturnType<StorageInterface['getVerdict']>

  // 组装 Prompt
  const { systemPrompt } = assemblePrompt(query, allTools, { memoryContext: historyContext, verdict })
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: query },
  ]

  // ReAct 循环
  let round = 0
  let finished = false

  while (!finished && round <= MAX_CHASE_ROUNDS) {
    // think
    const thinkResult = await llm.think(messages)

    // 首轮提取 intent（可选——LLM 可能返回也可能不返回）
    if (round === 0) {
      if (thinkResult.intent) {
        intent = {
          ...thinkResult.intent,
          intentHash: computeIntentHash(thinkResult.intent.domains, thinkResult.intent.operation, thinkResult.intent.filters),
        }
        trace.setIntent(intent)
        verdict = storage.getVerdict(tenantId, intent.intentHash)
        trace.setVerdict(verdict)
      }
      clarity = thinkResult.clarity ?? 'high'  // 默认 high，不惩罚没返回 clarity 的情况
    }

    // 超纲或首轮无 calls——升级到强模型重试一次
    if (thinkResult.unsupported || (!thinkResult.calls?.length && round === 0)) {
      trace.startRound(round, `[mini] ${thinkResult.thought}`)
      trace.endRound('mini 判定超纲/无 calls，尝试升级模型')

      // 级联：用强模型重跑同样的 messages
      const escalated = await llm.think(messages, ESCALATION_MODEL)
      trace.startRound(round, `[escalated→${ESCALATION_MODEL}] ${escalated.thought}`)

      if (escalated.unsupported || !escalated.calls?.length) {
        // 强模型也搞不定，真的超纲
        trace.endRound('强模型也无法处理，确认超纲')
        const signals: ConfidenceSignals = { toolMatch: 'low', verdictConfidence: 'low', queryClarity: clarity }
        trace.setConfidence(signals, 'low')
        const result = buildStructuredResult(
          '请问您想了解哪方面的信息？\n1. 设备运行状况\n2. 维修工单进度\n3. 保养任务执行\n4. 备件库存情况',
          [], 'text', 'low',
        )
        result.trace = trace.build()
        result.sources = []
        return result
      }

      // 强模型给出了 calls，用它的结果继续
      trace.endRound('强模型成功规划')
      if (escalated.intent && round === 0) {
        intent = { ...escalated.intent, intentHash: computeIntentHash(escalated.intent.domains, escalated.intent.operation, escalated.intent.filters) }
        clarity = escalated.clarity ?? 'high'
        trace.setIntent(intent)
      }
      // 替换 thinkResult 继续执行 calls
      Object.assign(thinkResult, escalated)
    }

    // finish（追查后结束）
    if (thinkResult.finish && round > 0) {
      trace.startRound(round, thinkResult.thought)
      trace.endRound('信息充足，结束')
      break
    }

    // 执行 calls（支持 {{N.path}} 参数引用，按序执行并传递结果）
    if (thinkResult.calls && thinkResult.calls.length > 0) {
      trace.startRound(round, thinkResult.thought)
      const roundResults: unknown[] = []  // 本轮各 call 的结果，用于引用解析

      for (let ci = 0; ci < thinkResult.calls.length; ci++) {
        const call = thinkResult.calls[ci]
        // 解析参数中的 {{N.path}} 引用
        const resolvedArgs = resolveArgRefs(call.arguments, roundResults)

        const startMs = Date.now()
        let toolResult: ToolResult
        try {
          toolResult = await registry.execute(call.tool, resolvedArgs, callTool)
        } catch (err) {
          toolResult = { data: null, status: 'error', errorLevel: 1 }
        }
        const durationMs = Date.now() - startMs
        roundResults.push(toolResult.data)

        trace.addCall({
          tool: call.tool,
          arguments: resolvedArgs,
          result: toolResult.data,
          status: toolResult.status === 'error' ? 'error' : 'success',
          durationMs,
        })

        if (toolResult.status !== 'error') {
          allResults.push({ tool: call.tool, data: toolResult.data })
          const toolDef = registry.getTool(call.tool)
          if (toolDef) {
            sources.push({ tool: call.tool, description: toolDef.description })
          }
        }
      }

      // 观察总结
      const observation = allResults.length > 0
        ? `已获得 ${allResults.length} 个工具的结果`
        : '工具调用失败'
      trace.endRound(observation)

      // 把本轮结果注入消息上下文，引导 AI 判断是否充足
      messages.push({ role: 'assistant', content: JSON.stringify(thinkResult) })
      const obsData = thinkResult.calls.map(c => {
        const r = allResults.find(ar => ar.tool === c.tool)
        return { tool: c.tool, result: r?.data ?? 'error' }
      })
      // 观察注入（Reflexion 式事实对比）
      const dataFields = obsData.flatMap(d => {
        if (d.result && typeof d.result === 'object' && !Array.isArray(d.result)) return Object.keys(d.result as Record<string, unknown>)
        if (d.result && typeof d.result === 'object' && Array.isArray((d.result as any)?.items)) return ['items[...]']
        return ['(数据)']
      })
      const obsMessage = `观察结果: ${JSON.stringify(obsData)}\n\n事实对比:\n- 用户问: "${query}"\n- 已获得字段: ${[...new Set(dataFields)].join(', ')}\n\n按 5 步模板继续推理。如果已覆盖用户问题则 finish。`
      messages.push({ role: 'user', content: obsMessage })
    }

    // finish 在同一轮（首轮 calls + finish）
    if (thinkResult.finish) {
      finished = true
    }

    round++
  }

  // 置信度计算
  const verdictConfidence: ConfidenceLevel = !verdict ? 'low'
    : verdict.sampleCount >= 10 ? 'high'
    : verdict.sampleCount >= 3 ? 'medium' : 'low'
  const signals: ConfidenceSignals = { toolMatch: 'high', verdictConfidence, queryClarity: clarity }
  const finalConfidence = computeConfidence(signals)
  trace.setConfidence(signals, finalConfidence)

  // LLM 总结
  const mergedData = allResults.map(r => r.data)
  const firstData = mergedData.length === 1 ? mergedData[0] : mergedData
  const formatHint = detectDisplayFormat(firstData)
  const summary = await llm.summarize(firstData, query, formatHint)

  // 去重 sources
  const uniqueSources = sources.filter((s, i) => sources.findIndex(x => x.tool === s.tool) === i)

  // 写 session（异步，不阻塞响应）
  try {
    const session: MemorySession = {
      sessionId: trace.build().traceId,
      userId, tenantId, query,
      intentHash: intent?.intentHash ?? '',
      toolChain: allResults.map(r => r.tool),
      resultSummary: summary.answer.slice(0, 200),
      routingDecision: { rounds: round, confidence: finalConfidence },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }
    storage.insertSession(session)
    storage.insertTrace(tenantId, trace.build(), session.sessionId)
    // lesson 由外部信号触发（用户反馈/结果质量检测），不做 AI 自评
  } catch { /* 存储失败不影响响应 */ }

  const result = buildStructuredResult(
    summary.answer,
    mergedData.map(d => (typeof d === 'object' && d !== null ? d : { value: d }) as Record<string, unknown>),
    summary.display || 'text',
    finalConfidence,
    summary.columns,
    summary.followUp,
  )
  result.sources = uniqueSources
  result.trace = trace.build()
  return result
}

/**
 * 异步自评：AI 判断自己选的工具对不对，不对就生成 lesson
 */
async function generateLesson(
  llm: LLMProvider,
  storage: StorageInterface,
  tenantId: string,
  query: string,
  intentHash: string,
  selectedTools: string[],
  answer: string,
  availableToolNames: string[],
): Promise<void> {
  const evalPrompt = `评估工具路由结果。必须使用下方工具列表中的具体工具名。

可用工具: ${availableToolNames.join(', ')}

用户问题: "${query}"
选择的工具: ${selectedTools.join(', ') || '(无)'}
回答摘要: "${answer.slice(0, 150)}"

返回严格 JSON（不要其他文字）:
{"quality":"good或partial或bad","errorReason":"选错的原因","betterPath":["应该用的具体工具名"],"lesson":"选了X不对因为Y，应该用Z"}`

  const result = await llm.think([
    { role: 'system', content: evalPrompt },
    { role: 'user', content: '评估' },
  ])

  try {
    const evalText = result.thought
    const evalData = JSON.parse(evalText)
    if (!evalData.quality) return

    const lesson: import('@/lib/types').Lesson = {
      intentHash,
      tenantId,
      query,
      selectedTools,
      quality: evalData.quality,
      errorReason: evalData.errorReason,
      betterPath: evalData.betterPath,
      lesson: evalData.lesson ?? '',
      source: 'self_eval',
      createdAt: new Date(),
    }
    // 只存有价值的教训（partial 或 bad）
    if (lesson.quality !== 'good') {
      storage.insertLesson(lesson)
    }
  } catch {
    // 解析失败不影响主流程
  }
}

/**
 * 解析参数中的 {{N.path}} 引用
 * 例如 {{0.items[0].equipmentId}} → 从第 0 个 call 的结果中取 items[0].equipmentId
 */
function resolveArgRefs(args: Record<string, unknown>, results: unknown[]): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
      const ref = value.slice(2, -2).trim()
      resolved[key] = navigatePath(ref, results)
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      resolved[key] = resolveArgRefs(value as Record<string, unknown>, results)
    } else {
      resolved[key] = value
    }
  }
  return resolved
}

function navigatePath(ref: string, results: unknown[]): unknown {
  try {
    const parts = ref.split('.')
    const callIndex = parseInt(parts[0])
    if (isNaN(callIndex) || callIndex >= results.length || !results[callIndex]) return ref
    let value: unknown = results[callIndex]
    for (const part of parts.slice(1)) {
      if (value === null || value === undefined) return ref
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/)
      if (arrayMatch) {
        value = (value as Record<string, unknown>)[arrayMatch[1]]
        if (Array.isArray(value)) value = value[parseInt(arrayMatch[2])]
      } else {
        value = (value as Record<string, unknown>)[part]
      }
    }
    return value ?? ref
  } catch {
    return ref  // 解析失败返回原始引用字符串
  }
}
