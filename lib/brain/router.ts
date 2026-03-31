// 路由主编排器 — P1: ReAct 循环（批量调用 + 按需追查）
import { assemblePrompt } from './prompt-assembler'
import { computeConfidence } from './confidence'
import { detectDisplayFormat, buildStructuredResult } from './result-presenter'
import { extractIntentFromThinkResult } from './intent'
import { validateResult } from './validator'
import { buildDigestForSummarize } from './data-digest'
import { SYSTEM_REGISTRY } from '@/lib/systems'
import { TraceCollector } from './trace'
import type { ToolRegistry } from '@/lib/tools/registry'
import type { StorageInterface } from '@/lib/storage/types'
import type {
  LLMProvider, StructuredResult, ToolResult,
  IntentTags, ConfidenceSignals, ConfidenceLevel, MemorySession,
} from '@/lib/types'

const MAX_CHASE_ROUNDS = 2  // ①规划 → ②审查放开 → ③finish，最多 3 次 think
// 延迟读取，避免 ESM import hoisting 导致 env 未加载
const getEscalationModel = () => process.env.LLM_ESCALATION_MODEL || process.env.LLM_MODEL || 'deepseek-chat'

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
        const signals: ConfidenceSignals = { toolMatch: 'low', verdictConfidence: 'medium', queryClarity: clarity }
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
          allResults.push({ tool: call.tool, data: toolResult.data })
          const toolDef = registry.getTool(call.tool)
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

      // 把本轮结果注入消息上下文，引导 AI 判断是否充足
      // Phase 2: 清洗防御性语言，防止犹豫心态传染到下一轮
      const cleanedThink = { ...thinkResult }
      if (cleanedThink.thought) {
        cleanedThink.thought = cleanedThink.thought
          .replace(/数据被截断/g, '已获取数据')
          .replace(/数据不完整/g, '数据概要')
          .replace(/无法确定/g, '需要补充')
          .replace(/不完整/g, '部分')
          .replace(/截断/g, '概要')
      }
      messages.push({ role: 'assistant', content: JSON.stringify(cleanedThink) })
      // 用本轮 roundResults（index-aligned），截断过大的结果防止撑爆 context
      // 动态预算：上下文宽裕时保留更多数据，紧张时精简（Phase 2 污染防控）
      const msgTotalChars = messages.reduce((sum, m) => sum + m.content.length, 0)
      const truncateThreshold = msgTotalChars > 40000 ? 4000
        : msgTotalChars > 20000 ? 8000
        : 12000
      const obsData = thinkResult.calls.map((c, ci) => {
        const raw = roundResults[ci] ?? 'error'
        const json = JSON.stringify(raw)
        if (json.length > truncateThreshold) {
          const obj = raw as Record<string, unknown>
          // 正面概要：保留实际数据样本，不暴露"截断"概念（消除 AI 防御心态）
          const summary: Record<string, unknown> = {}
          if (obj && typeof obj === 'object') {
            if ('total' in obj) summary.total = obj.total
            if ('count' in obj) summary.count = obj.count
            if ('context' in obj) summary.context = obj.context
            // groups 完整保留（统计查询的核心，通常不大）
            if ('groups' in obj && Array.isArray(obj.groups)) {
              summary.groups = obj.groups
            }
            // items 保留前 3 条（让 AI 看到真实数据结构和内容）
            if ('items' in obj && Array.isArray(obj.items)) {
              summary.items = obj.items.slice(0, 3)
              summary.itemCount = obj.items.length
            }
            // stats 完整保留（预计算指标）
            if ('stats' in obj) summary.stats = obj.stats
          }
          return { tool: c.tool, result: summary }
        }
        return { tool: c.tool, result: raw }
      })
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
      // 提取工具返回的 context 提示（空结果时 handler 会解释原因）
      const contextHints = obsData
        .map(d => (d.result as any)?.context)
        .filter(Boolean)
        .map(c => `⚠️ ${c}`)
        .join('\n')
      const contextSection = contextHints ? `\n\n${contextHints}\n如果结果为空且有时间限定，尝试去掉时间条件重新查询。` : ''
      // 校验警告注入（让 AI 在审查轮感知数值异常）
      const validationWarnings = trace.build().validation
        .filter(v => v.severity === 'warning')
        .map(v => `⚠️ 校验: ${v.message}`)
        .join('\n')
      const validationSection = validationWarnings ? `\n\n${validationWarnings}` : ''
      const obsMessage = `观察结果: ${JSON.stringify(obsData)}\n\n事实对比:\n- 用户问: "${query}"\n- 已获得字段: ${[...new Set(dataFields)].join(', ')}${domainCoverageHint}${contextSection}${validationSection}\n\n检查：数据是否已回答用户问题？有无未覆盖的域？够了就 finish，不够就补充。`
      messages.push({ role: 'user', content: obsMessage })

      // 快速完成: 单域 + 全成功 + 无覆盖缺口 + clarity=clear + 有实际数据 → 跳过审查轮
      // 结果为空时不跳过 — 需要审查轮做洋葱式泛化（放宽条件重试）
      const hasActualData = allResults.some(r => {
        if (!r.data || typeof r.data !== 'object') return false
        const d = r.data as Record<string, unknown>
        // 检查常见的数据存在标志
        if ('total' in d && (d.total as number) > 0) return true
        if ('items' in d && Array.isArray(d.items) && d.items.length > 0) return true
        if ('groups' in d && Array.isArray(d.groups) && d.groups.length > 0) return true
        if ('context' in d) return false  // 有 context 说明空结果需要审查
        // 没有 total/items/groups 字段的数据（如 dashboard 嵌套对象）默认有数据
        if (!('total' in d) && !('items' in d) && !('groups' in d)) return true
        return false  // 有这些字段但都为空 → 确实没数据
      })
      if (round === 0 && uncoveredDomains.length === 0 && clarity === 'high'
          && allResults.length === totalCallsAttempted && allResults.length > 0
          && intentDomains.length <= 1 && hasActualData) {
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

  // 置信度计算（toolMatch 从实际执行结果推导，不再硬编码）
  const toolMatch: ConfidenceLevel = totalCallsAttempted === 0 ? 'low'
    : allResults.length === totalCallsAttempted ? 'high'
    : allResults.length > 0 ? 'medium' : 'low'
  const signals: ConfidenceSignals = { toolMatch, verdictConfidence: 'medium', queryClarity: clarity }
  const finalConfidence = computeConfidence(signals)
  trace.setConfidence(signals, finalConfidence)

  // 构建 relatedContext — 从 feeds_into 生成可深挖方向
  const relatedHints: string[] = []
  const calledTools = new Set(allResults.map(r => r.tool))
  for (const r of allResults) {
    const toolDef = registry.getTool(r.tool)
    if (toolDef?.feedsInto?.length) {
      const uncalled = toolDef.feedsInto.filter(t => !calledTools.has(t))
      if (uncalled.length > 0) {
        const toolNames = uncalled.map(t => {
          const def = registry.getTool(t)
          return def ? `${t}(${def.description.slice(0, 30)})` : t
        })
        relatedHints.push(`${r.tool} 可深挖→ ${toolNames.join(', ')}`)
      }
    }
    // 从数据中提取数字摘要作为诱饵
    const d = r.data as Record<string, unknown>
    if (d && typeof d === 'object') {
      const nums: string[] = []
      if ('total' in d && typeof d.total === 'number' && d.total > 0) nums.push(`共${d.total}条`)
      if ('bom' in d && Array.isArray(d.bom)) nums.push(`BOM${d.bom.length}种备件`)
      if ('recentFaults' in d && Array.isArray(d.recentFaults)) nums.push(`近期${d.recentFaults.length}次故障`)
      if ('activeRepairs' in d && Array.isArray(d.activeRepairs)) nums.push(`${d.activeRepairs.length}个进行中维修`)
      if (nums.length) relatedHints.push(`${r.tool}: ${nums.join(', ')}`)
    }
  }
  // 从第一个工具推断系统 ID，读取 domain model
  const firstToolDef = allResults.length > 0 ? registry.getTool(allResults[0].tool) : undefined
  const systemId = firstToolDef?.system

  // 注入 domain model — 让 summarize AI 知道实体间的关系链，做更好的跨域分析和 followUp
  if (systemId) {
    const meta = SYSTEM_REGISTRY[systemId]
    if (meta?.domainModel) {
      relatedHints.unshift(`业务关系链:\n${meta.domainModel}`)
    }
  }

  const relatedContext = relatedHints.length > 0 ? relatedHints.join('\n') : undefined

  // Phase 2: allResults 去重 — 同一工具多次调用只保留最后一次，减少冲突数据对 AI 的认知干扰
  const dedupMap = new Map<string, { tool: string; data: unknown }>()
  for (const r of allResults) dedupMap.set(r.tool, r)
  const dedupedResults = [...dedupMap.values()]

  // 数据处理层 — 将原始 JSON 转为结构化摘要（省 token + 预计算统计值）
  const toolResultsForDigest = dedupedResults.map(r => ({ tool: r.tool, data: r.data }))
  const dataDigest = toolResultsForDigest.length > 0
    ? buildDigestForSummarize(toolResultsForDigest, systemId)
    : undefined

  // LLM 总结（容错）
  const mergedData = dedupedResults.map(r => r.data)
  const firstData = mergedData.length === 1 ? mergedData[0] : mergedData
  const formatHint = detectDisplayFormat(firstData)
  // Phase 3: 禁用词检测 + 单次重试
  const FORBIDDEN_WORDS = ['数据不足', '无法回答', '数据不完整', '暂无数据', '数据不包含', '无法统计', '缺乏数据']
  let summary: Awaited<ReturnType<LLMProvider['summarize']>>
  try {
    summary = await llm.summarize(firstData, query, formatHint, relatedContext, dataDigest)
    // 禁用词逃逸检测 — 命中就重试一次
    if (summary.answer && FORBIDDEN_WORDS.some(w => summary.answer.includes(w))) {
      console.warn(`[Router] 禁用词逃逸，重试 summarize`)
      summary = await llm.summarize(firstData, query, formatHint, relatedContext, dataDigest)
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
