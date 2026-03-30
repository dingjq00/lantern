// 数据摘要引擎 v2 — 将工具返回的原始 JSON 转为精简 JSON 摘要
// 目的：让 LLM 在 summarize 阶段直接引用预计算数字，避免手动数数出错
// v2 改动：输出 JSON 格式（LLM 更熟悉）+ 修复领域公式分母/污染 bug

import { SYSTEM_REGISTRY } from '@/lib/systems'
import { applyDomainFormulas } from './domain-formulas'

// ============================================================
// 类型定义
// ============================================================

export interface ToolResultInput {
  tool: string
  data: unknown
}

// 需要统计分布的枚举字段（已知）
const ENUM_FIELDS = new Set([
  'status', 'statusText', 'progressStatus', 'validatedStatus', 'type', 'orderType',
  'category', 'priority', 'urgency', 'severity', 'department',
  'productionLine', 'decisionType', 'resultStatus', 'lowStock', 'isKey',
])

// 可读标签字段：优先用 statusText 而非 status 数字代码
const READABLE_FIELD_MAP: Record<string, string> = {
  status: 'statusText',
}

// 内部字段（不展示给 LLM）
const SKIP_FIELDS = new Set([
  'id', 'createTime', 'updateTime', 'creator', 'updater',
  'deleted', 'tenantId', 'createdDate', 'lastModifiedDate',
])

// ID 类字段后缀（数字但不做汇总）
const ID_FIELD_SUFFIXES = ['Id', 'id']

// 日期字段正则
const DATE_FIELD_PATTERN = /[Tt]ime$|[Dd]ate$|[Tt]ime[A-Z]|[Dd]ate[A-Z]|[Aa]t$|[Ss]tartTime|[Ee]ndTime|[Cc]reated[A-Z]|[Uu]pdated[A-Z]|[Pp]roduction[Dd]ate/

const SMALL_DATASET_THRESHOLD = 20

// ============================================================
// 主入口
// ============================================================

/**
 * 将多个工具结果转换为 JSON 格式摘要
 */
export function digestToolResults(results: Array<ToolResultInput>): string {
  if (results.length === 0) return '{}'

  if (results.length === 1) {
    const digest = digestSingle(results[0].data)
    return JSON.stringify(digest, null, 2)
  }

  // 多工具：以 tool 名为 key
  const combined: Record<string, unknown> = {}
  for (const { tool, data } of results) {
    combined[tool] = digestSingle(data)
  }
  return JSON.stringify(combined, null, 2)
}

/**
 * 为 summarize 构建完整数据摘要（通用统计 + 领域 KPI）
 */
export function buildDigestForSummarize(
  results: Array<{ tool: string; data: unknown }>,
  systemId?: string,
): string {
  if (results.length === 0) return '{}'

  // 构建通用摘要
  const digestObj: Record<string, unknown> = {}

  for (const { tool, data } of results) {
    digestObj[tool] = digestSingle(data)
  }

  // 领域公式
  const metrics = systemId ? SYSTEM_REGISTRY[systemId]?.computedMetrics : undefined
  if (metrics) {
    const kpiResults: Record<string, unknown> = {}
    for (const r of results) {
      if (!r.data || typeof r.data !== 'object') continue
      const obj = r.data as Record<string, unknown>
      if ('items' in obj && Array.isArray(obj.items) && obj.items.length > 0) {
        const kpi = applyDomainFormulas(
          obj.items as Record<string, unknown>[],
          obj.items.length,  // bug fix: 用 items.length 不用 total（total 可能是全量数，items 是当前页）
          metrics,
        )
        if (Object.keys(kpi).length > 0) {
          kpiResults[r.tool] = kpi
        }
      }
    }
    if (Object.keys(kpiResults).length > 0) {
      digestObj['_领域指标'] = kpiResults
    }
  }

  // 单工具时简化结构
  if (results.length === 1) {
    const key = results[0].tool
    const result: Record<string, unknown> = digestObj[key] as Record<string, unknown>
    if (digestObj['_领域指标']) {
      result['_领域指标'] = (digestObj['_领域指标'] as Record<string, unknown>)[key]
    }
    return JSON.stringify(result, null, 2)
  }

  return JSON.stringify(digestObj, null, 2)
}

// ============================================================
// 单个工具结果 → 结构化摘要对象
// ============================================================

function digestSingle(data: unknown): unknown {
  if (data === null || data === undefined) return { error: '无数据' }

  // 错误响应
  if (isErrorResponse(data)) {
    return { error: (data as Record<string, unknown>).value }
  }

  if (typeof data !== 'object') return data

  // 数组
  if (Array.isArray(data)) {
    return digestItemsList(data as Record<string, unknown>[])
  }

  const obj = data as Record<string, unknown>

  // groups 聚合数据
  if (Array.isArray(obj.groups) && typeof obj.total === 'number') {
    return digestGroupsToObj(obj)
  }

  // items 列表数据
  if (Array.isArray(obj.items)) {
    return digestItemsWrapperToObj(obj)
  }

  // dashboard / profile 嵌套对象
  return digestNestedToObj(obj)
}

// ============================================================
// groups 数据 → JSON
// ============================================================

function digestGroupsToObj(obj: Record<string, unknown>): Record<string, unknown> {
  const total = obj.total as number
  const groups = obj.groups as Array<Record<string, unknown>>
  const groupBy = obj.groupBy as string | undefined

  // 保留每个 group 的所有字段（不只取 count），适配不同 handler 的输出格式
  const distribution: Record<string, unknown> = {}
  for (const g of groups) {
    const label = String(g.group ?? g.name ?? g.key ?? '未知')
    const count = Number(g.count ?? g.total ?? g.value ?? 0)
    const entry: Record<string, unknown> = { count }
    if (total > 0) entry.pct = `${((count / total) * 100).toFixed(1)}%`
    // 保留 handler 返回的额外字段（如 completed、completionRate）
    for (const [k, v] of Object.entries(g)) {
      if (k === 'group' || k === 'name' || k === 'key' || k === 'count' || k === 'value') continue
      entry[k] = v
    }
    distribution[label] = entry
  }

  return {
    total,
    ...(groupBy ? { groupBy } : {}),
    distribution,
  }
}

// ============================================================
// items 包装对象 → JSON
// ============================================================

function digestItemsWrapperToObj(obj: Record<string, unknown>): Record<string, unknown> {
  const total = typeof obj.total === 'number' ? obj.total : null
  const items = obj.items as unknown[]
  const context = typeof obj.context === 'string' ? obj.context : null

  const result: Record<string, unknown> = {}
  if (total !== null) result.total = total
  result.itemCount = items.length

  if (items.length === 0) {
    if (context) result.context = context
    return result
  }

  if (typeof items[0] !== 'object' || items[0] === null) {
    result.values = items.slice(0, 20)
    return result
  }

  const objItems = items as Record<string, unknown>[]

  // 分布统计
  const stats = buildStatsObj(objItems)
  if (Object.keys(stats).length > 0) result.stats = stats

  // 样本
  result.samples = buildSamplesArray(objItems)

  if (context) result.context = context
  return result
}

// ============================================================
// items 列表（无包装） → JSON
// ============================================================

function digestItemsList(items: Record<string, unknown>[]): Record<string, unknown> {
  if (items.length === 0) return { total: 0 }

  const result: Record<string, unknown> = { total: items.length }

  if (typeof items[0] !== 'object') {
    result.values = items.slice(0, 20)
    return result
  }

  const stats = buildStatsObj(items)
  if (Object.keys(stats).length > 0) result.stats = stats
  result.samples = buildSamplesArray(items)
  return result
}

// ============================================================
// 嵌套对象（dashboard/profile） → JSON
// ============================================================

function digestNestedToObj(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (SKIP_FIELDS.has(key)) continue
    if (value === null || value === undefined) continue

    if (Array.isArray(value)) {
      // 嵌套数组（recentFaults, recentMaintenance 等）
      if (value.length === 0) {
        result[key] = { count: 0 }
      } else if (typeof value[0] === 'object' && value[0] !== null) {
        const arrItems = value as Record<string, unknown>[]
        const arrResult: Record<string, unknown> = { count: arrItems.length }
        const stats = buildStatsObj(arrItems)
        if (Object.keys(stats).length > 0) arrResult.stats = stats
        arrResult.samples = buildSamplesArray(arrItems)
        result[key] = arrResult
      } else {
        result[key] = value.slice(0, 10)
      }
    } else if (typeof value === 'object') {
      // 嵌套对象 — 保留原样（dashboard 的 equipment、kpi 等已经是紧凑的）
      const nested = value as Record<string, unknown>
      const clean: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(nested)) {
        if (!SKIP_FIELDS.has(k) && v !== null && v !== undefined) {
          clean[k] = v
        }
      }
      result[key] = clean
    } else {
      result[key] = value
    }
  }

  return result
}

// ============================================================
// 统计分析 → JSON 对象
// ============================================================

function buildStatsObj(items: Record<string, unknown>[]): Record<string, unknown> {
  if (items.length === 0) return {}

  const allKeys = new Set<string>()
  for (const item of items) {
    for (const k of Object.keys(item)) allKeys.add(k)
  }

  const stats: Record<string, unknown> = {}

  for (const key of allKeys) {
    if (SKIP_FIELDS.has(key)) continue

    const values = items.map(item => item[key]).filter(v => v !== null && v !== undefined)
    if (values.length === 0) continue

    // 优先用可读字段（statusText > status）
    const readableKey = READABLE_FIELD_MAP[key]
    if (readableKey) {
      const readableValues = items.map(item => item[readableKey]).filter(v => v != null)
      if (readableValues.length > 0 && typeof readableValues[0] === 'string') {
        // 用可读字段做分布
        stats[readableKey] = buildDistObj(readableValues, items.length)
        continue
      }
    }

    // 已知枚举字段 or 自动检测
    if (ENUM_FIELDS.has(key) || isEnumLike(key, values)) {
      stats[key] = buildDistObj(values, items.length)
      continue
    }

    // 数值字段
    if (isNumericField(key, values)) {
      const nums = values.filter(v => typeof v === 'number' && !isNaN(v)) as number[]
      if (nums.length > 0) {
        const sum = nums.reduce((a, b) => a + b, 0)
        stats[key] = {
          sum: roundNum(sum),
          avg: roundNum(sum / nums.length),
          min: roundNum(Math.min(...nums)),
          max: roundNum(Math.max(...nums)),
        }
      }
      continue
    }

    // 日期字段
    if (DATE_FIELD_PATTERN.test(key)) {
      const range = buildDateRange(values)
      if (range) stats[key + '_range'] = range
    }
  }

  return stats
}

/** 分布统计 → { "已完成": {"count": 5, "pct": "83.3%"}, ... } */
function buildDistObj(values: unknown[], total: number): Record<string, unknown> {
  const counts = new Map<string, number>()
  for (const v of values) {
    const label = String(v)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const dist: Record<string, unknown> = {}
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  for (const [label, count] of sorted) {
    dist[label] = { count, pct: `${((count / total) * 100).toFixed(1)}%` }
  }
  return dist
}

// ============================================================
// 样本数据
// ============================================================

function buildSamplesArray(items: Record<string, unknown>[]): unknown[] {
  const stripped = items.map(stripInternalFields)

  if (items.length <= SMALL_DATASET_THRESHOLD) {
    return stripped
  }

  // 前5 + 后2
  return [
    ...stripped.slice(0, 5),
    { _omitted: `省略 ${items.length - 7} 条，共 ${items.length} 条` },
    ...stripped.slice(-2),
  ]
}

/** 去除内部字段 */
function stripInternalFields(item: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(item)) {
    if (!SKIP_FIELDS.has(k)) result[k] = v
  }
  return result
}

// ============================================================
// 辅助函数
// ============================================================

function buildDateRange(values: unknown[]): string | null {
  const dates: Date[] = []
  for (const v of values) {
    if (typeof v === 'number' && v > 1e12) {
      const d = new Date(v)
      if (!isNaN(d.getTime())) dates.push(d)
    } else if (typeof v === 'string') {
      const d = new Date(v)
      if (!isNaN(d.getTime())) dates.push(d)
    }
  }
  if (dates.length === 0) return null
  const times = dates.map(d => d.getTime())
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const earliest = new Date(Math.min(...times))
  const latest = new Date(Math.max(...times))
  if (fmt(earliest) === fmt(latest)) return fmt(earliest)
  return `${fmt(earliest)} ~ ${fmt(latest)}`
}

function roundNum(n: number): number {
  if (Number.isInteger(n)) return n
  return Math.round(n * 10) / 10
}

function isErrorResponse(data: unknown): boolean {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false
  const keys = Object.keys(data as Record<string, unknown>)
  if (keys.length !== 1 && keys.length !== 2) return false
  const obj = data as Record<string, unknown>
  return typeof obj.value === 'string' && keys.every(k => k === 'value' || k === 'error')
}

function isEnumLike(key: string, values: unknown[]): boolean {
  if (values.length === 0) return false
  if (typeof values[0] !== 'string') return false
  if (ID_FIELD_SUFFIXES.some(suffix => key.endsWith(suffix))) return false
  const unique = new Set(values.map(v => String(v)))
  return unique.size <= 10 && unique.size < values.length * 0.5
}

function isNumericField(key: string, values: unknown[]): boolean {
  if (values.length === 0) return false
  if (typeof values[0] !== 'number') return false
  if (ID_FIELD_SUFFIXES.some(suffix => key.endsWith(suffix))) return false
  if (/[Ii]d$/.test(key)) return false
  if (DATE_FIELD_PATTERN.test(key)) return false
  const numVals = values as number[]
  if (numVals.every(v => v > 1e12)) return false
  return true
}
