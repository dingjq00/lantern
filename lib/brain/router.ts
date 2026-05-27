// 路由主编排器 — P1: ReAct 循环（批量调用 + 按需追查）
// 重构：观察注入逻辑拆到 observation.ts 纯函数，router 只负责编排流程
import { assemblePrompt } from './prompt-assembler'
import { computeConfidence } from './confidence'
import { buildStructuredResult } from './result-presenter'
import { prepareSummarizeContext } from './summarize-context'
import { extractIntentFromThinkResult } from './intent'
import { validateResult } from './validator'
import { cleanDefensiveLanguage, calcTruncateThreshold, buildObservationData, buildObservationMessage } from './observation'
import { hasActualData, computeDataRelevance } from './relevance-checker'
import { SYSTEM_REGISTRY } from '@/lib/systems'
import { TraceCollector } from './trace'
import type { ToolRegistry } from '@/lib/tools/registry'
import type { StorageInterface } from '@/lib/storage/types'
import { computeArgSignature } from './summarize-context'
import type {
  LLMProvider, StructuredResult, ToolResult,
  IntentTags, ConfidenceSignals, ConfidenceLevel, MemorySession, ToolInvocation,
} from '@/lib/types'

const MAX_CHASE_ROUNDS = 2  // ①规划 → ②审查放开 → ③finish，最多 3 次 think
// 延迟读取，避免 ESM import hoisting 导致 env 未加载
const getEscalationModel = () => process.env.LLM_ESCALATION_MODEL || 'deepseek-v4-pro'

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
  const allResults: ToolInvocation[] = []
  const sources: Array<{ tool: string; description: string }> = []
  let totalCallsAttempted = 0

  // 对话历史上下文
  const historyContext = history && history.length > 1
    ? history.slice(0, -1).map(m => `${m.role === 'user' ? '用户' : '系统'}: ${m.content}`).join('\n')
    : undefined

  let intent: IntentTags | undefined
  let clarity: ConfidenceLevel = 'medium'

  // 组装 Prompt
  const { systemPrompt } = assemblePrompt(query, allTools, { memoryContext: historyContext })

  // 术语预匹配 — 扫描 query 命中术语表时自动注入定义（确定性，不靠 AI 判断）
  // 先用 scope 关键词预判 query 属于哪个系统，只注入相关系统的术语（防跨系统碰撞）
  const glossaryHints: string[] = []
  const querySystems = Object.entries(SYSTEM_REGISTRY)
    .filter(([, meta]) => meta.scope.split(/[、，,]/).some(kw => query.includes(kw.trim())))
    .map(([sysId]) => sysId)
  for (const [sysId, meta] of Object.entries(SYSTEM_REGISTRY)) {
    if (!meta.businessGlossary) continue
    // 如果能判断系统归属，只注入该系统的术语；判断不了则全部注入
    if (querySystems.length > 0 && !querySystems.includes(sysId)) continue
    for (const [term, def] of Object.entries(meta.businessGlossary)) {
      const allNames = [term, ...(def.aliases ?? [])]
      if (allNames.some(name => query.includes(name))) {
        glossaryHints.push(`${term}(${sysId.toUpperCase()}) = ${def.definition}。计算方式: ${def.computation}`)
      }
    }
  }
  const enrichedQuery = glossaryHints.length > 0
    ? `${query}\n\n[术语提示] ${glossaryHints.join('；')}`
    : query
  if (glossaryHints.length > 0) console.warn(`[Router] 术语命中: ${glossaryHints.length}条 → ${glossaryHints.map(h => h.split('=')[0].trim()).join(', ')}`)

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: enrichedQuery },
  ]

  // ReAct 循环
  let round = 0
  let finished = false
  let prevCallsSignature: string | undefined  // Phase 2: 退化循环检测

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
      }
    }

    // 超纲或首轮无 calls——升级到强模型重试一次
    if (thinkResult.unsupported || (!thinkResult.calls?.length && round === 0)) {
      trace.startRound(round, `[mini] ${thinkResult.thought}`)
      trace.endRound('mini 判定超纲/无 calls，尝试升级模型')

      // 级联：用强模型重跑同样的 messages
      const escalationModel = getEscalationModel()
      const escalated = await llm.think(messages, escalationModel)
      trace.startRound(round, `[escalated→${escalationModel}] ${escalated.thought}`)

      if (escalated.unsupported || !escalated.calls?.length) {
        // 强模型也搞不定——用 AI 推理生成上下文相关的回复，不用写死文本
        trace.endRound('强模型也无法处理，确认超纲')
        const signals: ConfidenceSignals = {
          toolMatch: 'low', queryClarity: clarity, dataRelevance: 'low', verdictConfidence: 'medium',
        }
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
      // Phase 2: 退化循环检测 — 同样的调用重复执行说明 AI 陷入死循环
      const callsSig = JSON.stringify(thinkResult.calls.map(c => [c.tool, c.arguments]))
      if (prevCallsSignature && callsSig === prevCallsSignature) {
        trace.startRound(round, thinkResult.thought)
        trace.endRound('退化循环: 与上轮相同调用，强制结束')
        break
      }
      prevCallsSignature = callsSig
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
          const toolDef = registry.getTool(call.tool)
          allResults.push({
            tool: call.tool,
            arguments: resolvedArgs,
            data: toolResult.data,
            system: toolDef?.system ?? call.tool.split('.')[0],
            argSignature: computeArgSignature(resolvedArgs),
          })
          if (toolDef) {
            sources.push({ tool: call.tool, description: toolDef.description })
          }
        }
      }

      // 校验本轮新增的工具返回数据（数值异常、空结果检测）
      for (let ci = 0; ci < roundResults.length; ci++) {
        const validations = validateResult(roundResults[ci])
        for (const v of validations) {
          trace.addValidation(v)
        }
      }

      // 观察总结
      const observation = allResults.length > 0
        ? `已获得 ${allResults.length} 个工具的结果`
        : '工具调用失败'
      trace.endRound(observation)

      // 把本轮结果注入消息上下文（纯函数在 observation.ts）
      const cleanedThink = { ...thinkResult }
      if (cleanedThink.thought) cleanedThink.thought = cleanDefensiveLanguage(cleanedThink.thought)
      messages.push({ role: 'assistant', content: JSON.stringify(cleanedThink) })

      const truncateThreshold = calcTruncateThreshold(messages)
      const obsData = buildObservationData(thinkResult.calls, roundResults, truncateThreshold)
      const obsMessage = buildObservationMessage({
        obsData, query, allResults, intent, registry,
        validationWarnings: trace.build().validation.filter(v => v.severity === 'warning').map(v => v.message),
      })
      messages.push({ role: 'user', content: obsMessage })

      // 快速完成判断：域覆盖检查
      const calledTools = allResults.map(r => r.tool)
      const coveredDomains = [...new Set(calledTools.flatMap(t => registry.getTool(t)?.domains ?? []))]
      const intentDomains = intent?.domains ?? []
      const uncoveredDomains = intentDomains.filter(d => !coveredDomains.includes(d))

      const hasData = allResults.some(r => hasActualData(r.data))
      if (round === 0 && uncoveredDomains.length === 0 && clarity === 'high'
          && allResults.length === totalCallsAttempted && allResults.length > 0
          && intentDomains.length <= 1 && hasData) {
        trace.startRound(round + 1, '[快速完成] 单域查询，数据充足，跳过审查轮')
        trace.endRound('快速完成')
        finished = true
      }
    }

    // finish 在同一轮（首轮 calls + finish）
    if (thinkResult.finish) {
      finished = true
    }

    round++
  }

  // 置信度计算
  const toolMatch: ConfidenceLevel = totalCallsAttempted === 0 ? 'low'
    : allResults.length === totalCallsAttempted ? 'high'
    : allResults.length > 0 ? 'medium' : 'low'
  const calledTools = allResults.map(r => r.tool)
  const coveredDomains = [...new Set(calledTools.flatMap(t => registry.getTool(t)?.domains ?? []))]
  const dataRelevance = computeDataRelevance({
    totalCallsAttempted,
    successfulResults: allResults,
    intentDomains: intent?.domains ?? [],
    coveredDomains,
  })
  const signals: ConfidenceSignals = {
    toolMatch, queryClarity: clarity, dataRelevance, verdictConfidence: 'medium',
  }
  const finalConfidence = computeConfidence(signals)
  trace.setConfidence(signals, finalConfidence)

  // 一次性打包 summarize 所需的全部上下文（偷师 UniClaudeProxy 的 ResolvedRoute）
  const ctx = prepareSummarizeContext(allResults, registry)
  // Phase 3: 禁用词检测 + 单次重试
  const FORBIDDEN_WORDS = ['数据不足', '无法回答', '数据不完整', '暂无数据', '数据不包含', '无法统计', '缺乏数据']
  let summary: Awaited<ReturnType<LLMProvider['summarize']>>
  try {
    summary = await llm.summarize(ctx.mergedData, query, ctx.formatHint, ctx.relatedContext, ctx.dataDigest)
    // 禁用词逃逸检测 — 命中就重试一次
    if (summary.answer && FORBIDDEN_WORDS.some(w => summary.answer.includes(w))) {
      console.warn(`[Router] 禁用词逃逸，重试 summarize`)
      summary = await llm.summarize(ctx.mergedData, query, ctx.formatHint, ctx.relatedContext, ctx.dataDigest)
    }
  } catch (err) {
    console.warn('[Router] LLM summarize 失败:', (err as Error).message)
    summary = { answer: '查询已完成，请查看下方数据详情。', display: 'text' }
  }

  // 去重 sources
  const uniqueSources = sources.filter((s, i) => sources.findIndex(x => x.tool === s.tool) === i)

  // 写 session（异步，不阻塞响应）
  try {
    const builtTrace = trace.build()
    const session: MemorySession = {
      sessionId: builtTrace.traceId,
      userId, tenantId, query,
      intentHash: intent?.intentHash ?? '',
      toolChain: allResults.map(r => r.tool),
      resultSummary: summary.answer.slice(0, 200),
      routingDecision: { rounds: round, confidence: finalConfidence },
      // audit 增强（为自学习铺路）
      answer: summary.answer,
      rounds: round,
      latencyMs: builtTrace.endTime ? builtTrace.endTime - builtTrace.startTime : undefined,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }
    storage.insertSession(session)
    storage.insertTrace(tenantId, builtTrace, session.sessionId)
  } catch (err) { console.warn('[Router] Session/trace 写入失败:', err) }

  const result = buildStructuredResult(
    summary.answer,
    ctx.dedupedResults.map(r => (typeof r.data === 'object' && r.data !== null ? r.data : { value: r.data }) as Record<string, unknown>),
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
