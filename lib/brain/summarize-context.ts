// Summarize 上下文打包 — 一次性 resolve 出 summarize 所需的全部信息
// 偷师 UniClaudeProxy 的 ResolvedRoute 模式：一次解析，全程携带

import { buildDigestForSummarize } from './data-digest'
import { detectDisplayFormat } from './result-presenter'
import { SYSTEM_REGISTRY } from '@/lib/systems'
import type { ToolRegistry } from '@/lib/tools/registry'
import type { DisplayFormat } from '@/lib/types'

export interface SummarizeContext {
  systemId: string | undefined
  dedupedResults: Array<{ tool: string; data: unknown }>
  mergedData: unknown
  formatHint: DisplayFormat
  relatedContext: string | undefined
  dataDigest: string | undefined
}

/**
 * 从 allResults 一次性打包 summarize 所需的全部上下文
 * @param allResults - 所有工具调用结果
 * @param registry - 工具注册表
 * @returns SummarizeContext
 */
export function prepareSummarizeContext(
  allResults: Array<{ tool: string; data: unknown }>,
  registry: ToolRegistry,
): SummarizeContext {
  // 1. 推断系统 ID
  const firstToolDef = allResults.length > 0 ? registry.getTool(allResults[0].tool) : undefined
  const systemId = firstToolDef?.system

  // 2. 构建 relatedHints（feeds_into 深挖方向 + 数据数字诱饵 + domain model）
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
    // 数据数字摘要作为诱饵
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

  // 注入 domain model
  if (systemId) {
    const meta = SYSTEM_REGISTRY[systemId]
    if (meta?.domainModel) {
      relatedHints.unshift(`业务关系链:\n${meta.domainModel}`)
    }
  }

  const relatedContext = relatedHints.length > 0 ? relatedHints.join('\n') : undefined

  // 3. 去重（同工具多次调用只保留最后一次）
  const dedupMap = new Map<string, { tool: string; data: unknown }>()
  for (const r of allResults) dedupMap.set(r.tool, r)
  const dedupedResults = [...dedupMap.values()]

  // 4. 数据处理层摘要
  const toolResultsForDigest = dedupedResults.map(r => ({ tool: r.tool, data: r.data }))
  const dataDigest = toolResultsForDigest.length > 0
    ? buildDigestForSummarize(toolResultsForDigest, systemId)
    : undefined

  // 5. 显示格式检测
  const mergedData = dedupedResults.map(r => r.data)
  const firstData = mergedData.length === 1 ? mergedData[0] : mergedData
  const formatHint = detectDisplayFormat(firstData)

  return { systemId, dedupedResults, mergedData: firstData, formatHint, relatedContext, dataDigest }
}
