// 置信度融合 — toolMatch + queryClarity + dataRelevance
import type { ConfidenceSignals, ConfidenceLevel, MemoryVerdict } from '@/lib/types'

/**
 * 融合规则：
 * - 任意 low → low
 * - 三者均为 high → high
 * - 其余 → medium
 * verdictConfidence 已不参与融合（P1.5 停用 verdict）
 */
export function computeConfidence(signals: ConfidenceSignals): ConfidenceLevel {
  const values = [signals.toolMatch, signals.queryClarity, signals.dataRelevance]

  if (values.some(v => v === 'low')) return 'low'
  if (values.every(v => v === 'high')) return 'high'
  return 'medium'
}

/**
 * P1.5: verdict 已停用，固定返回 medium（trace 兼容）
 */
export function computeVerdictConfidence(_verdict: MemoryVerdict | null): ConfidenceLevel {
  return 'medium'
}
