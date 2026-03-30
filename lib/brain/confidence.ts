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
 * P1.5: verdict 已停用，固定返回 medium（不拖后腿也不加分）
 * 未来自学习复活时改回动态计算
 */
export function computeVerdictConfidence(_verdict: MemoryVerdict | null): ConfidenceLevel {
  return 'medium'
}
