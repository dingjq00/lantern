// 领域公式 v2 — 输出 JSON 对象，分母用 items.length
// EN 15341: 维护绩效指标 | FDA Quality Metrics: 制药质量指标
import type { ComputedMetric } from '@/lib/systems'

/**
 * 对 items 数组应用领域公式，返回 KPI 对象
 * 只有字段存在时才计算（不存在的字段静默跳过）
 * v2: 返回 Record 而非文本，分母用 items.length（当前页实际数据量）
 */
export function applyDomainFormulas(
  items: Record<string, unknown>[],
  itemCount: number,
  metrics: Record<string, ComputedMetric>,
): Record<string, unknown> {
  if (!items.length || !Object.keys(metrics).length) return {}

  const result: Record<string, unknown> = {}

  for (const [key, metric] of Object.entries(metrics)) {
    const value = computeMetric(items, itemCount, metric)
    if (value !== null) result[key] = value
  }

  return result
}

function computeMetric(
  items: Record<string, unknown>[],
  itemCount: number,
  metric: ComputedMetric,
): unknown {
  switch (metric.formula) {
    case 'rate': {
      if (!metric.numerator || !metric.denominator) return null
      const [field, value] = metric.numerator.split('=')
      // 字段不存在于任何条目时静默跳过（防止无关公式污染）
      if (!items.some(item => field in item)) return null

      let numerator: number
      if (value === '*') {
        numerator = items.filter(item => item[field] != null && item[field] !== '').length
      } else {
        numerator = items.filter(item => String(item[field]) === value).length
      }
      // bug fix: 分母用 itemCount（当前页实际条目数），不用 total（可能是全量总数）
      const denominator = itemCount
      if (denominator === 0) return null
      const pct = roundNum(numerator / denominator * 100)
      return { value: `${pct}%`, numerator, denominator, label: metric.label }
    }

    case 'avg': {
      if (!metric.field) return null
      const vals = items.map(item => item[metric.field!]).filter(v => typeof v === 'number') as number[]
      if (vals.length === 0) return null
      const avg = roundNum(vals.reduce((a, b) => a + b, 0) / vals.length)
      return { value: avg, unit: metric.unit || '', label: metric.label }
    }

    case 'sum': {
      if (!metric.field) return null
      const vals = items.map(item => item[metric.field!]).filter(v => typeof v === 'number') as number[]
      if (vals.length === 0) return null
      const sum = roundNum(vals.reduce((a, b) => a + b, 0))
      return { value: sum, unit: metric.unit || '', label: metric.label }
    }

    case 'count': {
      if (!metric.field) return null
      const count = items.filter(item => item[metric.field!] != null).length
      return { value: count, unit: metric.unit || '', label: metric.label }
    }

    default:
      return null
  }
}

function roundNum(n: number): number {
  if (Number.isInteger(n)) return n
  return Math.round(n * 10) / 10
}
