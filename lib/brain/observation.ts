// 观察注入纯函数 — 从 router.ts 拆出，保持 router 只负责编排流程
// 三个职责：清洗防御语言、截断+正面概要、组装观察消息

import { SYSTEM_REGISTRY } from '@/lib/systems'
import { resolveBridgeHints } from './cross-system-bridge'
import type { ToolRegistry } from '@/lib/tools/registry'
import type { IntentTags } from '@/lib/types'

/** 从 query 中按 scope 关键词推断"问题涉及哪些系统"（用于跨系统覆盖检查） */
export function detectCandidateSystems(query: string): string[] {
  return Object.entries(SYSTEM_REGISTRY)
    .filter(([, meta]) => meta.scope.split(/[、，,]/).some(kw => {
      const trimmed = kw.trim()
      return trimmed.length > 0 && query.includes(trimmed)
    }))
    .map(([sysId]) => sysId)
}

/**
 * 清洗 thinkResult.thought 中的防御性语言
 * 防止犹豫心态通过 assistant 消息传染到下一轮（Phase 2 污染防控）
 * @param thought - AI 的原始思考文本
 * @returns 清洗后的思考文本
 */
export function cleanDefensiveLanguage(thought: string): string {
  return thought
    .replace(/数据被截断/g, '已获取数据')
    .replace(/数据不完整/g, '数据概要')
    .replace(/无法确定/g, '需要补充')
    .replace(/不完整/g, '部分')
    .replace(/截断/g, '概要')
}

/**
 * 计算动态截断预算 — 上下文宽裕时保留更多数据
 * @param messages - 当前消息列表
 * @returns 截断阈值（字符数）
 */
export function calcTruncateThreshold(messages: Array<{ content: string }>): number {
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0)
  return totalChars > 40000 ? 4000
    : totalChars > 20000 ? 8000
    : 12000
}

/**
 * 将工具结果转为观察数据 — 超预算时生成正面概要，不暴露"截断"概念
 * @param calls - 本轮工具调用列表
 * @param roundResults - 本轮各 call 的结果（index-aligned）
 * @param threshold - 截断阈值
 * @returns 观察数据数组
 */
export function buildObservationData(
  calls: Array<{ tool: string }>,
  roundResults: unknown[],
  threshold: number,
): Array<{ tool: string; result: unknown }> {
  return calls.map((c, ci) => {
    const raw = roundResults[ci] ?? 'error'
    const json = JSON.stringify(raw)
    if (json.length > threshold) {
      const obj = raw as Record<string, unknown>
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
}

/**
 * 组装观察消息 — 事实对比 + 域覆盖检查 + context 提示 + 校验警告
 * @param params - 组装所需的所有参数
 * @returns 完整的观察消息文本
 */
export function buildObservationMessage(params: {
  obsData: Array<{ tool: string; result: unknown }>
  query: string
  allResults: Array<{ tool: string }>
  intent?: IntentTags
  registry: ToolRegistry
  validationWarnings: string[]
}): string {
  const { obsData, query, allResults, intent, registry, validationWarnings } = params

  // 字段提取
  const dataFields = obsData.flatMap(d => {
    if (d.result && typeof d.result === 'object' && !Array.isArray(d.result)) return Object.keys(d.result as Record<string, unknown>)
    if (d.result && typeof d.result === 'object' && Array.isArray((d.result as any)?.items)) return ['items[...]']
    return ['(数据)']
  })

  // 域覆盖检查
  const calledTools = allResults.map(r => r.tool)
  const coveredDomains = [...new Set(calledTools.flatMap(t => registry.getTool(t)?.domains ?? []))]
  const intentDomains = intent?.domains ?? []
  const uncoveredDomains = intentDomains.filter(d => !coveredDomains.includes(d))
  const domainCoverageHint = uncoveredDomains.length > 0
    ? `\n⚠️ 域覆盖检查: 用户问题涉及 [${intentDomains.join(', ')}]，已覆盖 [${coveredDomains.join(', ')}]，未覆盖 [${uncoveredDomains.join(', ')}]。如有必要，补充未覆盖域的工具。`
    : ''

  // context 提示（空结果时 handler 会解释原因）
  const contextHints = obsData
    .map(d => (d.result as any)?.context)
    .filter(Boolean)
    .map(c => `⚠️ ${c}`)
    .join('\n')
  const contextSection = contextHints ? `\n\n${contextHints}\n如果结果为空且有时间限定，尝试去掉时间条件重新查询。` : ''

  // 校验警告
  const validationSection = validationWarnings.length > 0
    ? `\n\n${validationWarnings.map(w => `⚠️ 校验: ${w}`).join('\n')}`
    : ''

  // 已调用工具所属系统
  const calledSystems = [...new Set(calledTools.map(t => t.split('.')[0]))]

  // MES 工单误用 dashboard / line.overview：全厂计数不能答筛选类工单问题
  const mesOrderQuery = /工单|积压|执行中|在制|pending|RUNNING/i.test(query)
  const misusedMesOverview = mesOrderQuery && (
    calledTools.includes('mes.dashboard')
    || (calledTools.includes('mes.line.overview') && !calledTools.includes('mes.order.search'))
  )
  const mesToolHint = misusedMesOverview
    ? '\n\n⚠️ MES 工单提示: mes.dashboard / mes.line.overview 返回全厂或产线画像，不能按状态/产线/设备筛选工单。若问题涉及工单数量、积压或跨系统对应关系，必须补查 mes.order.search（如 status=RUNNING），不要用 dashboard 数字代替。'
    : ''

  // 跨系统覆盖建议：根据 query 关键词推断潜在涉及系统，未覆盖的给出 bridge 推荐工具
  const candidateSystems = detectCandidateSystems(query)
  const uncoveredSystems = candidateSystems.filter(s => !calledSystems.includes(s))
  let bridgeHintSection = ''
  if (uncoveredSystems.length > 0 && calledSystems.length > 0) {
    const hints = resolveBridgeHints(calledSystems, candidateSystems)
    const tooltips: string[] = []
    for (const h of hints) {
      const targetsUncovered = h.recommendedTools.some(t => uncoveredSystems.includes(t.split('.')[0]))
      if (targetsUncovered) tooltips.push(`🔗 ${h.text}`)
    }
    if (tooltips.length > 0) {
      bridgeHintSection = `\n\n跨系统覆盖建议:\n${tooltips.join('\n')}\n问题关键词指向系统 [${candidateSystems.join(', ')}]，已覆盖 [${calledSystems.join(', ')}]，未覆盖 [${uncoveredSystems.join(', ')}]，若有必要按推荐工具补查。`
    }
  }

  return `观察结果: ${JSON.stringify(obsData)}\n\n事实对比:\n- 用户问: "${query}"\n- 已获得字段: ${[...new Set(dataFields)].join(', ')}\n- 已查系统: [${calledSystems.join(', ')}]${domainCoverageHint}${contextSection}${validationSection}${mesToolHint}${bridgeHintSection}\n\n重新审查用户原始问题中的每个概念，是否都已有数据覆盖？如果某个概念在当前结果中没有对应数据，检查其他系统是否有相关工具可以补充。够了就 finish，不够就补充。`
}
