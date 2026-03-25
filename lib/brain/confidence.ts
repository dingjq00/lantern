// 置信度三信号融合 — spec Section 5.5
import type { ConfidenceSignals, ConfidenceLevel } from '@/lib/types'

/**
 * 三信号融合规则：
 * - 3 个 high → high（直接执行）
 * - 任意 1 个 low → low（反问澄清）
 * - 其余 → medium（执行 + 提示"这是我的理解"）
 */
export function computeConfidence(signals: ConfidenceSignals): ConfidenceLevel {
  const values = [signals.toolMatch, signals.verdictConfidence, signals.queryClarity]

  if (values.some(v => v === 'low')) return 'low'
  if (values.every(v => v === 'high')) return 'high'
  return 'medium'
}
