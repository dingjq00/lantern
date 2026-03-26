// 路由主编排器 — P1: ReAct 循环（批量调用 + 按需追查）
import { assemblePrompt } from './prompt-assembler'
import { computeConfidence } from './confidence'
import { detectDisplayFormat, buildStructuredResult } from './result-presenter'
import { computeIntentHash } from './intent'
import { TraceCollector } from './trace'
import type { ToolRegistry } from '@/lib/tools/registry'
import type { StorageInterface } from '@/lib/storage/types'
import type {
  LLMProvider, StructuredResult, ToolResult, ThinkResult,
  IntentTags, ConfidenceSignals, ConfidenceLevel, MemorySession,
} from '@/lib/types'

const MAX_CHASE_ROUNDS = 3

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

    // 超纲——只在 LLM 显式声明 unsupported 时才判定，不因为"首轮没选工具"就放弃
    if (thinkResult.unsupported) {
      trace.startRound(round, thinkResult.thought)
      trace.endRound('超纲或无法处理')
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

    // finish（追查后结束）
    if (thinkResult.finish && round > 0) {
      trace.startRound(round, thinkResult.thought)
      trace.endRound('信息充足，结束')
      break
    }

    // 执行 calls
    if (thinkResult.calls && thinkResult.calls.length > 0) {
      trace.startRound(round, thinkResult.thought)

      for (const call of thinkResult.calls) {
        const startMs = Date.now()
        let toolResult: ToolResult
        try {
          toolResult = await registry.execute(call.tool, call.arguments, callTool)
        } catch (err) {
          toolResult = { data: null, status: 'error', errorLevel: 1 }
        }
        const durationMs = Date.now() - startMs

        trace.addCall({
          tool: call.tool,
          arguments: call.arguments,
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

      // 把本轮结果注入消息上下文
      messages.push({ role: 'assistant', content: JSON.stringify(thinkResult) })
      const obsData = thinkResult.calls.map(c => {
        const r = allResults.find(ar => ar.tool === c.tool)
        return { tool: c.tool, result: r?.data ?? 'error' }
      })
      messages.push({ role: 'user', content: `观察: ${JSON.stringify(obsData)}` })
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
