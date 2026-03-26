// 置信度三信号融合 — spec Section 5.5
import type { ConfidenceSignals, ConfidenceLevel, MemoryVerdict } from '@/lib/types'

/**
 * 三信号融合规则：
 * - 3 个 high → high（直接执行）
 * - 任意 1 个 low → low（反问澄清）
 * - 其余 → medium（执行 + 提示"以上是根据您的描述匹配的结果"）
 */
export function computeConfidence(signals: ConfidenceSignals): ConfidenceLevel {
  const values = [signals.toolMatch, signals.verdictConfidence, signals.queryClarity]

  if (values.some(v => v === 'low')) return 'low'
  if (values.every(v => v === 'high')) return 'high'
  return 'medium'
}

/**
 * P1: 从 verdict 计算 verdictConfidence 信号
 * sample≥10 → high, 3-9 → medium, <3 或无 → low
 */
export function computeVerdictConfidence(verdict: MemoryVerdict | null): ConfidenceLevel {
  if (!verdict || verdict.sampleCount < 3) return 'low'
  if (verdict.sampleCount >= 10) return 'high'
  return 'medium'
}
