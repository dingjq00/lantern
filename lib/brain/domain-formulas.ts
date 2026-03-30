// 领域公式 — 基于 TPM/MES/FDA 标准 KPI 从通用统计推导率值
// EN 15341: 维护绩效指标（保养完成率、MTTR、故障率等）
// FDA Quality Metrics: 批次合格率、工单完成率、异常率等
import type { ComputedMetric } from '@/lib/systems'

/**
 * 对 items 数组应用领域公式，输出预计算的 KPI 文本
 * 只有字段存在时才计算（不存在的字段静默跳过）
 */
export function applyDomainFormulas(
  items: Record<string, unknown>[],
  total: number,
  metrics: Record<string, ComputedMetric>,
): string {
  if (!items.length || !Object.keys(metrics).length) return ''

  const lines: string[] = []

  for (const [, metric] of Object.entries(metrics)) {
    const line = computeMetric(items, total, metric)
    if (line) lines.push(line)
  }

  return lines.length > 0 ? '领域指标:\n' + lines.join('\n') : ''
}

function computeMetric(
  items: Record<string, unknown>[],
  total: number,
  metric: ComputedMetric,
): string | null {
  switch (metric.formula) {
    case 'rate': {
      if (!metric.numerator || !metric.denominator) return null
      const [field, value] = metric.numerator.split('=')
      // 字段不存在于任何条目时静默跳过
      if (!items.some(item => field in item)) return null

      let numerator: number
      if (value === '*') {
        // 通配符：统计字段非空的条目数
        numerator = items.filter(item => item[field] != null && item[field] !== '').length
      } else {
        numerator = items.filter(item => String(item[field]) === value).length
      }
      const denominator = metric.denominator === 'total' ? total : items.length
      if (denominator === 0) return null
      const pct = (numerator / denominator * 100).toFixed(1)
      return `  ${metric.label}: ${pct}${metric.unit || ''} (${numerator}/${denominator})`
    }

    case 'avg': {
      if (!metric.field) return null
      const vals = items.map(item => item[metric.field!]).filter(v => typeof v === 'number') as number[]
      if (vals.length === 0) return null
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      return `  ${metric.label}: ${formatNum(avg)}${metric.unit || ''}`
    }

    case 'sum': {
      if (!metric.field) return null
      const vals = items.map(item => item[metric.field!]).filter(v => typeof v === 'number') as number[]
      if (vals.length === 0) return null
      const sum = vals.reduce((a, b) => a + b, 0)
      return `  ${metric.label}: ${formatNum(sum)}${metric.unit || ''}`
    }

    case 'count': {
      if (!metric.field) return null
      const count = items.filter(item => item[metric.field!] != null).length
      return `  ${metric.label}: ${count}${metric.unit || ''}`
    }

    default:
      return null
  }
}

/** 整数保持整数，浮点保留一位小数 */
function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(1)
}
