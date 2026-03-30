// 置信度融合 — P1.5: verdict 已停用，实际为二信号（toolMatch + queryClarity）
import type { ConfidenceSignals, ConfidenceLevel, MemoryVerdict } from '@/lib/types'

/**
 * 融合规则（verdictConfidence 固定 medium，实际由 toolMatch + queryClarity 决定）：
 * - toolMatch=high + clarity=high → high
 * - 任意 low → low（反问澄清）
 * - 其余 → medium
 */
export function computeConfidence(signals: ConfidenceSignals): ConfidenceLevel {
  const values = [signals.toolMatch, signals.verdictConfidence, signals.queryClarity]

  if (values.some(v => v === 'low')) return 'low'
  if (values.every(v => v === 'high')) return 'high'
  return 'medium'
}

/**
 * P1.5: verdict 已停用，固定返回 medium（不拖后腿也不加分）
 * 未来自学习复活时改回动态计算
 */
export function computeVerdictConfidence(_verdict: MemoryVerdict | null): ConfidenceLevel {
  return 'medium'
}
