// 路由主编排器 — P1: ReAct 循环（批量调用 + 按需追查）
import { assemblePrompt } from './prompt-assembler'
import { computeConfidence, computeVerdictConfidence } from './confidence'
import { detectDisplayFormat, buildStructuredResult } from './result-presenter'
import { extractIntentFromThinkResult } from './intent'
import { maybeUpdateVerdict } from './verdict'
import { extractDataFields } from './relevance-checker'
import { evaluateWithSubagent } from './subagent-evaluator'
import { TraceCollector } from './trace'
import type { ToolRegistry } from '@/lib/tools/registry'
import type { StorageInterface } from '@/lib/storage/types'
import type {
  LLMProvider, StructuredResult, ToolResult,
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
  let totalCallsAttempted = 0

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
    // think（网络/超时容错）
    let thinkResult: Awaited<ReturnType<LLMProvider['think']>>
    try {
      thinkResult = await llm.think(messages)
    } catch (err) {
      console.warn(`[Router] LLM think 调用失败 (round=${round}):`, (err as Error).message)
      // LLM 不可用时直接返回超纲响应
      const result = buildStructuredResult('系统暂时繁忙，请稍后再试。', [], 'text', 'low')
      result.trace = trace.build()
      return result
    }

    // 首轮提取 intent（可选——LLM 可能返回也可能不返回）
    if (round === 0) {
      const extracted = extractIntentFromThinkResult(thinkResult)
      clarity = extracted.clarity
      if (extracted.intent) {
        intent = extracted.intent
        trace.setIntent(intent)
        verdict = storage.getVerdict(tenantId, intent.intentHash)
        trace.setVerdict(verdict)
      }
    }

    // 超纲或首轮无 calls——升级到强模型重试一次
    if (thinkResult.unsupported || (!thinkResult.calls?.length && round === 0)) {
      trace.startRound(round, `[mini] ${thinkResult.thought}`)
      trace.endRound('mini 判定超纲/无 calls，尝试升级模型')

      // 级联：用强模型重跑同样的 messages
      const escalated = await llm.think(messages, ESCALATION_MODEL)
      trace.startRound(round, `[escalated→${ESCALATION_MODEL}] ${escalated.thought}`)

      if (escalated.unsupported || !escalated.calls?.length) {
        // 强模型也搞不定——用 AI 推理生成上下文相关的回复，不用写死文本
        trace.endRound('强模型也无法处理，确认超纲')
        const signals: ConfidenceSignals = { toolMatch: 'low', verdictConfidence: 'low', queryClarity: clarity }
        trace.setConfidence(signals, 'low')
        const unsupportedSummary = await llm.summarize(
          { unsupported: true, aiAnalysis: escalated.thought },
          query,
          'single_value',
        )
        const result = buildStructuredResult(
          unsupportedSummary.answer || '这个问题目前系统还不能直接回答，建议换个方式描述或联系相关部门。',
          [], 'text', 'low',
          undefined,
          unsupportedSummary.followUp,
        )
        result.trace = trace.build()
        result.sources = []
        return result
      }

      // 强模型给出了 calls，用它的结果继续
      trace.endRound('强模型成功规划')
      if (round === 0) {
        const extracted = extractIntentFromThinkResult(escalated)
        clarity = extracted.clarity
        if (extracted.intent) {
          intent = extracted.intent
          trace.setIntent(intent)
        }
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
      totalCallsAttempted += thinkResult.calls.length
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
      // 用本轮 roundResults（index-aligned），不用跨轮累积的 allResults
      const obsData = thinkResult.calls.map((c, ci) => ({
        tool: c.tool,
        result: roundResults[ci] ?? 'error',
      }))
      // 观察注入（Reflexion 式事实对比）
      const dataFields = obsData.flatMap(d => {
        if (d.result && typeof d.result === 'object' && !Array.isArray(d.result)) return Object.keys(d.result as Record<string, unknown>)
        if (d.result && typeof d.result === 'object' && Array.isArray((d.result as any)?.items)) return ['items[...]']
        return ['(数据)']
      })
      // 域覆盖检查（通用跨域提示，不预定义组合）
      const calledTools = allResults.map(r => r.tool)
      const coveredDomains = [...new Set(calledTools.flatMap(t => registry.getTool(t)?.domains ?? []))]
      const intentDomains = intent?.domains ?? []
      const uncoveredDomains = intentDomains.filter(d => !coveredDomains.includes(d))
      const domainCoverageHint = uncoveredDomains.length > 0
        ? `\n⚠️ 域覆盖检查: 用户问题涉及 [${intentDomains.join(', ')}]，已覆盖 [${coveredDomains.join(', ')}]，未覆盖 [${uncoveredDomains.join(', ')}]。如有必要，补充未覆盖域的工具。`
        : ''
      const obsMessage = `观察结果: ${JSON.stringify(obsData)}\n\n事实对比:\n- 用户问: "${query}"\n- 已获得字段: ${[...new Set(dataFields)].join(', ')}${domainCoverageHint}\n\n检查：数据是否已回答用户问题？有无未覆盖的域？够了就 finish，不够就补充。`
      messages.push({ role: 'user', content: obsMessage })
    }

    // finish 在同一轮（首轮 calls + finish）
    if (thinkResult.finish) {
      finished = true
    }

    round++
  }

  // 置信度计算（toolMatch 从实际执行结果推导，不再硬编码）
  const toolMatch: ConfidenceLevel = totalCallsAttempted === 0 ? 'low'
    : allResults.length === totalCallsAttempted ? 'high'
    : allResults.length > 0 ? 'medium' : 'low'
  const verdictConfidence = computeVerdictConfidence(verdict)
  const signals: ConfidenceSignals = { toolMatch, verdictConfidence, queryClarity: clarity }
  const finalConfidence = computeConfidence(signals)
  trace.setConfidence(signals, finalConfidence)

  // LLM 总结（容错）
  const mergedData = allResults.map(r => r.data)
  const firstData = mergedData.length === 1 ? mergedData[0] : mergedData
  const formatHint = detectDisplayFormat(firstData)
  let summary: Awaited<ReturnType<LLMProvider['summarize']>>
  try {
    summary = await llm.summarize(firstData, query, formatHint)
  } catch (err) {
    console.warn('[Router] LLM summarize 失败:', (err as Error).message)
    summary = { answer: '查询已完成，请查看下方数据详情。', display: 'text' }
  }

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
    // 触发 verdict 更新（异步，冷启动阈值 3）
    if (intent?.intentHash) {
      maybeUpdateVerdict(storage, tenantId, intent.intentHash, 3).catch(err =>
        console.warn('[Router] Verdict 更新失败:', err)
      )
    }
  } catch (err) { console.warn('[Router] Session/trace 写入失败:', err) }

  // subagent 评估（和 result 一起返回，前端可展示）
  let lessonEval: { quality: string; reason: string; lesson: string } | undefined
  try {
    const dataFields = extractDataFields(mergedData.length === 1 ? mergedData[0] : mergedData)
    const dataSample = JSON.stringify(mergedData).slice(0, 300)
    const subagentResult = await evaluateWithSubagent(llm, query, dataFields.join(', '), dataSample)
    lessonEval = { quality: subagentResult.quality, reason: subagentResult.reason, lesson: subagentResult.lesson }

    // 写 lesson
    if (subagentResult.quality !== 'good' && intent?.intentHash) {
      try {
        storage.insertLesson({
          intentHash: intent.intentHash, tenantId, query,
          selectedTools: allResults.map(r => r.tool),
          quality: subagentResult.quality,
          errorReason: subagentResult.reason,
          betterPath: subagentResult.missing.length > 0 ? subagentResult.missing : undefined,
          lesson: `[subagent] ${subagentResult.lesson}`,
          source: 'self_eval' as const,
          createdAt: new Date(),
        })
      } catch (err) { console.warn('[Router] Lesson 写入失败:', err) }
    }
  } catch (err) { console.warn('[Router] Subagent 评估失败:', err) }

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
  result.lessonEval = lessonEval
  return result
}

/**
 * 解析参数中的 {{N.path}} 引用
 * 例如 {{0.items[0].equipmentId}} → 从第 0 个 call 的结果中取 items[0].equipmentId
 */
/** @internal — 导出仅用于测试 */
export function resolveArgRefs(args: Record<string, unknown>, results: unknown[]): Record<string, unknown> {
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

/** @internal — 导出仅用于测试 */
export function navigatePath(ref: string, results: unknown[]): unknown {
  try {
    const parts = ref.split('.')
    const callIndex = parseInt(parts[0])
    if (isNaN(callIndex) || callIndex >= results.length || !results[callIndex]) {
      console.warn(`[Router] {{${ref}}} 引用解析失败: 索引 ${callIndex} 无结果（results 长度=${results.length}）`)
      return ref
    }
    let value: unknown = results[callIndex]
    for (const part of parts.slice(1)) {
      if (value === null || value === undefined) {
        console.warn(`[Router] {{${ref}}} 引用解析失败: 路径中断于 "${part}"（值为 ${value}）`)
        return ref
      }
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/)
      if (arrayMatch) {
        value = (value as Record<string, unknown>)[arrayMatch[1]]
        if (Array.isArray(value)) {
          const idx = parseInt(arrayMatch[2])
          if (idx >= value.length) {
            console.warn(`[Router] {{${ref}}} 引用解析失败: ${arrayMatch[1]}[${idx}] 越界（数组长度=${value.length}）`)
            return ref
          }
          value = value[idx]
        }
      } else {
        value = (value as Record<string, unknown>)[part]
      }
    }
    if (value === undefined || value === null) {
      console.warn(`[Router] {{${ref}}} 引用解析失败: 最终值为 ${value}`)
    }
    return value ?? ref
  } catch (err) {
    console.warn(`[Router] {{${ref}}} 引用解析异常:`, err)
    return ref
  }
}
