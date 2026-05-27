// 跨系统桥接解析 — 多系统调用时注入 summarize / observation
import { CROSS_SYSTEM_BRIDGES, type CrossSystemBridge } from '@/lib/systems'

export interface BridgeHint {
  id: string
  kind: 'exact' | 'inferred'
  text: string
  recommendedTools: string[]
}

/**
 * 给定查询涉及的系统集合，选出可应用的 bridge。
 * 当 systemIds 只有一个系统时，命中"该系统在 from 或 to"且另一端系统在 candidateSystems 内的 bridge，
 * 作为"应当跨到另一个系统"的提示（供 observation 与 prompt 用）。
 */
export function resolveBridgeHints(systemIds: string[], candidateSystems?: string[]): BridgeHint[] {
  if (systemIds.length === 0) return []

  const present = new Set(systemIds)
  const candidates = new Set([...(candidateSystems ?? []), ...systemIds])
  const hints: BridgeHint[] = []

  for (const bridge of CROSS_SYSTEM_BRIDGES) {
    const hasFrom = candidates.has(bridge.from.system)
    const hasTo = candidates.has(bridge.to.system)
    const bothPresent = present.has(bridge.from.system) && present.has(bridge.to.system)
    if (!hasFrom || !hasTo) continue
    // 多系统已同时调用 → 给关联解释；只在一个候选系统里 → 给提示让模型补跨
    if (systemIds.length < 2 && !bothPresent && candidateSystems === undefined) continue

    const prefix = bridge.kind === 'exact' ? '可关联' : '分析假设（须标注建议核查）'
    const toolHint = bridge.recommendedTools?.length
      ? ` 推荐工具: ${bridge.recommendedTools.join(' + ')}`
      : ''
    hints.push({
      id: bridge.id,
      kind: bridge.kind,
      text: `${prefix}: ${bridge.from.system}.${bridge.from.entity} ↔ ${bridge.to.system}.${bridge.to.entity} — ${bridge.note}${toolHint}`,
      recommendedTools: bridge.recommendedTools ?? [],
    })
  }

  return hints
}

export function formatBridgeHintsForPrompt(hints: BridgeHint[]): string | undefined {
  if (hints.length === 0) return undefined
  return `跨系统关联提示:\n${hints.map(h => `- ${h.text}`).join('\n')}`
}

/** @internal 测试用 */
export function getBridgeById(id: string): CrossSystemBridge | undefined {
  return CROSS_SYSTEM_BRIDGES.find(b => b.id === id)
}
