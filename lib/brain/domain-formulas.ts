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

    case 'interval': {
      // 通用时间间隔分析 — 计算同一实体的同类事件之间的平均间隔
      // 用途: MTBR(维修间隔)、MTBF(故障间隔)、工单周期 等
      if (!metric.groupByField || !metric.timeField) return null
      if (!items.some(item => metric.timeField! in item)) return null

      // 按实体分组，收集时间戳
      const groups = new Map<string, number[]>()
      for (const item of items) {
        const key = String(item[metric.groupByField!] ?? '')
        const time = item[metric.timeField!]
        if (typeof time !== 'number' || !key) continue
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(time)
      }

      // 每组排序→计算相邻事件的时间差
      const allIntervals: number[] = []
      const perEntity: Array<{ id: string; count: number; avgDays: number }> = []

      for (const [key, times] of groups) {
        if (times.length < 2) continue  // 只出现1次，无法算间隔
        times.sort((a, b) => a - b)
        const diffs: number[] = []
        for (let i = 1; i < times.length; i++) {
          diffs.push((times[i] - times[i - 1]) / (1000 * 60 * 60 * 24))  // 毫秒→天
        }
        const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length
        allIntervals.push(...diffs)
        perEntity.push({ id: key, count: times.length, avgDays: roundNum(avg) })
      }

      if (allIntervals.length === 0) return null
      const globalAvg = roundNum(allIntervals.reduce((a, b) => a + b, 0) / allIntervals.length)

      // 按频次降序排列，AI 直接引用 top5 回答"频次最高的设备"
      perEntity.sort((a, b) => b.count - a.count)

      return {
        value: globalAvg, unit: metric.unit || '天',
        label: metric.label,
        entityCount: perEntity.length,
        top5: perEntity.slice(0, 5),
      }
    }

    default:
      return null
  }
}

/**
 * 为 groupBy 结果注入时间间隔数据 — handler 在 enrichGroupNames 前调用
 * 继承模式：handler 传数据，这里读 config 算间隔，新系统只加配置不写代码
 */
export function computeIntervalsForGroups(
  list: Record<string, unknown>[],
  groups: Array<{ group: string; count: number; [k: string]: unknown }>,
  groupByField: string,
  metrics: Record<string, ComputedMetric>,
): void {
  // 从 config 中找匹配的 interval 指标
  const intervalMetrics = Object.entries(metrics).filter(
    ([, m]) => m.formula === 'interval' && m.groupByField === groupByField,
  )
  if (intervalMetrics.length === 0) return

  for (const [, metric] of intervalMetrics) {
    // 按实体分组收集时间戳
    const timesByGroup = new Map<string, number[]>()
    for (const item of list) {
      const key = String(item[groupByField] ?? '')
      const time = item[metric.timeField!]
      if (typeof time !== 'number' || !key) continue
      if (!timesByGroup.has(key)) timesByGroup.set(key, [])
      timesByGroup.get(key)!.push(time)
    }

    // 注入每个 group 的间隔数据
    for (const g of groups) {
      const times = timesByGroup.get(g.group)
      if (!times || times.length < 2) continue
      times.sort((a, b) => a - b)
      const diffs: number[] = []
      for (let i = 1; i < times.length; i++) {
        diffs.push((times[i] - times[i - 1]) / (1000 * 60 * 60 * 24))
      }
      g.avgIntervalDays = roundNum(diffs.reduce((a, b) => a + b, 0) / diffs.length)
    }
  }
}

function roundNum(n: number): number {
  if (Number.isInteger(n)) return n
  return Math.round(n * 10) / 10
}
