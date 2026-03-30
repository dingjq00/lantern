// 数据摘要引擎 — 将工具返回的原始 JSON 转为紧凑的文本摘要
// 目的：让 LLM 在 summarize 阶段直接引用预计算数字，避免手动数数出错
//
// 处理数据形态：
//   - items 列表（搜索/list 类）
//   - groups 聚合数据（groupBy 类）
//   - 嵌套对象（dashboard 类）
//   - profile 数据（设备全景，含嵌套数组）
//   - 错误响应（含 value 字符串键）
//   - 空结果（total: 0）

// ============================================================
// 类型定义
// ============================================================

export interface ToolResultInput {
  tool: string
  data: unknown
}

// 需要统计分布的枚举字段（已知）
const ENUM_FIELDS = new Set([
  'status', 'progressStatus', 'validatedStatus', 'type', 'orderType',
  'category', 'priority', 'urgency', 'severity', 'department',
  'productionLine', 'decisionType', 'resultStatus', 'lowStock', 'isKey',
])

// 内部字段（不展示给 LLM）
const SKIP_FIELDS = new Set([
  'id', 'createTime', 'updateTime', 'creator', 'updater',
  'deleted', 'tenantId', 'createdDate', 'lastModifiedDate',
])

// ID 类字段后缀（数字但不做汇总）
const ID_FIELD_SUFFIXES = ['Id', 'id']

// 日期字段正则（ISO 字符串 or 毫秒时间戳字段名）
// 使用大小写边界避免误匹配（如 materialCost 中的 'at'）
const DATE_FIELD_PATTERN = /[Tt]ime$|[Dd]ate$|[Tt]ime[A-Z]|[Dd]ate[A-Z]|[Aa]t$|[Ss]tartTime|[Ee]ndTime|[Cc]reated[A-Z]|[Uu]pdated[A-Z]|[Pp]roduction[Dd]ate/

// ============================================================
// 主入口
// ============================================================

/**
 * 将多个工具结果转换为文本摘要
 * @param results 工具结果数组，每项含 tool 名称和 data
 * @returns 纯文本摘要，供注入 LLM prompt
 */
export function digestToolResults(results: Array<ToolResultInput>): string {
  const sections: string[] = []
  const multiTool = results.length > 1

  for (const { tool, data } of results) {
    const section = digestSingle(data)
    if (multiTool) {
      sections.push(`[${tool}]\n${section}`)
    } else {
      sections.push(section)
    }
  }

  return sections.join('\n\n')
}

// ============================================================
// 单个工具结果处理
// ============================================================

function digestSingle(data: unknown): string {
  if (data === null || data === undefined) return '无数据'

  // 错误响应：只有 value 字符串键
  if (isErrorResponse(data)) {
    return `错误: ${(data as Record<string, unknown>).value}`
  }

  // 数组直接处理（groups 或 items 列表）
  if (Array.isArray(data)) {
    return digestArray(data)
  }

  if (typeof data !== 'object') return String(data)

  const obj = data as Record<string, unknown>

  // groups 聚合数据：{ total, groupBy, groups: [{group, count}] }
  if (Array.isArray(obj.groups) && typeof obj.total === 'number') {
    return digestGroups(obj)
  }

  // items 列表数据：{ total, count, items: [...] }
  if (Array.isArray(obj.items)) {
    return digestItemsWrapper(obj)
  }

  // dashboard / profile 嵌套对象：递归展平
  return digestNestedObject(obj)
}

// ============================================================
// 错误响应检测
// ============================================================

function isErrorResponse(data: unknown): boolean {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false
  const keys = Object.keys(data as Record<string, unknown>)
  if (keys.length !== 1 && keys.length !== 2) return false
  const obj = data as Record<string, unknown>
  return typeof obj.value === 'string' && keys.every(k => k === 'value' || k === 'error')
}

// ============================================================
// groups 聚合数据
// ============================================================

function digestGroups(obj: Record<string, unknown>): string {
  const total = obj.total as number
  const groups = obj.groups as Array<Record<string, unknown>>
  const groupBy = obj.groupBy as string | undefined

  const lines: string[] = []
  lines.push(`合计: ${total} 条`)
  if (groupBy) lines.push(`分组维度: ${groupBy}`)

  if (groups.length === 0) {
    lines.push('无分组数据')
    return lines.join('\n')
  }

  lines.push('分布:')
  for (const g of groups) {
    const label = String(g.group ?? g.name ?? g.key ?? '未知')
    const count = Number(g.count ?? g.value ?? 0)
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'
    lines.push(`  ${label}: ${count} (${pct}%)`)
  }

  return lines.join('\n')
}

// ============================================================
// items 列表包装对象
// ============================================================

function digestItemsWrapper(obj: Record<string, unknown>): string {
  const total = typeof obj.total === 'number' ? obj.total : null
  const items = obj.items as unknown[]
  const context = typeof obj.context === 'string' ? obj.context : null

  const lines: string[] = []

  // 显示合计
  if (total !== null) {
    lines.push(`合计: ${total} 条`)
  }

  // 空结果
  if (items.length === 0) {
    if (context) lines.push(`上下文: ${context}`)
    return lines.join('\n')
  }

  // 非对象数组
  if (typeof items[0] !== 'object' || items[0] === null) {
    lines.push(digestArray(items))
    return lines.join('\n')
  }

  const objItems = items as Record<string, unknown>[]

  // 字段分析
  const fieldAnalysis = analyzeFields(objItems)
  if (fieldAnalysis) lines.push(fieldAnalysis)

  // 样本展示
  const sample = buildSample(objItems, total ?? objItems.length)
  if (sample) lines.push(sample)

  if (context) lines.push(`上下文: ${context}`)

  return lines.join('\n')
}

// ============================================================
// 纯数组处理（无包装对象）
// ============================================================

function digestArray(items: unknown[]): string {
  if (items.length === 0) return '合计: 0 条'

  if (typeof items[0] !== 'object' || items[0] === null) {
    // 基本类型数组
    return `合计: ${items.length} 条\n值: ${items.slice(0, 10).join(', ')}${items.length > 10 ? ` ... 共${items.length}` : ''}`
  }

  const objItems = items as Record<string, unknown>[]
  const lines: string[] = [`合计: ${items.length} 条`]

  const fieldAnalysis = analyzeFields(objItems)
  if (fieldAnalysis) lines.push(fieldAnalysis)

  const sample = buildSample(objItems, items.length)
  if (sample) lines.push(sample)

  return lines.join('\n')
}

// ============================================================
// 嵌套对象（dashboard / profile）
// ============================================================

function digestNestedObject(obj: Record<string, unknown>): string {
  const lines: string[] = []

  for (const [key, value] of Object.entries(obj)) {
    if (SKIP_FIELDS.has(key)) continue

    if (value === null || value === undefined) continue

    // 嵌套对象 — 展平为 key.subkey
    if (typeof value === 'object' && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>
      // 检查是否是简单的数值对象（dashboard style）
      const isSimpleNumericObj = Object.values(nested).every(v =>
        typeof v === 'number' || v === null || v === undefined
      )

      if (isSimpleNumericObj && Object.keys(nested).length <= 8) {
        // dashboard 风格：展平
        for (const [subKey, subVal] of Object.entries(nested)) {
          if (subVal !== null && subVal !== undefined) {
            lines.push(`${key}.${subKey}: ${subVal}`)
          }
        }
      } else {
        // 递归处理复杂嵌套
        lines.push(`${key}:`)
        const subLines = digestNestedObject(nested)
        subLines.split('\n').forEach(l => lines.push(`  ${l}`))
      }
      continue
    }

    // 数组 — profile 数据中的嵌套列表
    if (Array.isArray(value)) {
      lines.push(`${key}: ${digestProfileArray(key, value)}`)
      continue
    }

    // 基础值
    lines.push(`${key}: ${value}`)
  }

  return lines.join('\n')
}

/**
 * profile 数据中的嵌套数组（如 recentFaults, activeRepairs）
 * 显示数量 + 字段分布/汇总
 */
function digestProfileArray(_key: string, items: unknown[]): string {
  if (items.length === 0) return '0 条'

  if (typeof items[0] !== 'object' || items[0] === null) {
    return `${items.length} 条`
  }

  const objItems = items as Record<string, unknown>[]
  const parts: string[] = [`${items.length} 条`]

  // 简化分析（不递归，只做一层）
  const fieldAnalysis = analyzeFields(objItems, { compact: true })
  if (fieldAnalysis) parts.push(fieldAnalysis)

  return parts.join(' | ')
}

// ============================================================
// 字段分析：分布 + 数值汇总 + 日期跨度
// ============================================================

interface AnalyzeOptions {
  compact?: boolean  // 紧凑模式：不加前缀标题行
}

function analyzeFields(items: Record<string, unknown>[], options: AnalyzeOptions = {}): string {
  if (items.length === 0) return ''

  const allKeys = new Set<string>()
  for (const item of items) {
    for (const k of Object.keys(item)) allKeys.add(k)
  }

  const lines: string[] = []

  // 按字段类型分类处理
  const enumLines: string[] = []
  const numLines: string[] = []
  const dateLines: string[] = []

  for (const key of allKeys) {
    if (SKIP_FIELDS.has(key)) continue

    const values = items.map(item => item[key]).filter(v => v !== null && v !== undefined)
    if (values.length === 0) continue

    // 1. 已知枚举字段 or 自动检测枚举特征
    if (ENUM_FIELDS.has(key) || isEnumLike(key, values)) {
      const dist = buildDistribution(values, items.length)
      if (dist) enumLines.push(`${key}分布: ${dist}`)
      continue
    }

    // 2. 数值字段（排除 ID 类）
    if (isNumericField(key, values)) {
      const agg = buildAggregation(key, values as number[])
      if (agg) numLines.push(agg)
      continue
    }

    // 3. 日期字段
    if (DATE_FIELD_PATTERN.test(key)) {
      const range = buildDateRange(values)
      if (range) dateLines.push(`${key}: ${range}`)
      continue
    }
  }

  if (!options.compact) {
    if (enumLines.length > 0) lines.push(...enumLines)
    if (numLines.length > 0) lines.push(...numLines)
    if (dateLines.length > 0) lines.push(...dateLines)
  } else {
    // 紧凑模式：只取最重要的枚举和数值
    const combined = [...enumLines.slice(0, 2), ...numLines.slice(0, 2)]
    if (combined.length > 0) lines.push(...combined)
  }

  return lines.join('\n')
}

// ============================================================
// 分布统计
// ============================================================

function buildDistribution(values: unknown[], total: number): string {
  const counts = new Map<string, number>()
  for (const v of values) {
    const key = String(v)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  // 按数量降序排列
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])

  const parts = sorted.map(([label, count]) => {
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'
    return `${label}:${count}(${pct}%)`
  })

  return parts.join(' ')
}

// ============================================================
// 数值汇总
// ============================================================

function buildAggregation(key: string, values: number[]): string {
  const nums = values.filter(v => typeof v === 'number' && !isNaN(v))
  if (nums.length === 0) return ''

  const sum = nums.reduce((a, b) => a + b, 0)
  const avg = sum / nums.length
  const min = Math.min(...nums)
  const max = Math.max(...nums)

  // 全部相同 → 简化显示
  if (min === max) {
    return `${key}: 全部为 ${formatNum(min)}`
  }

  const parts = [
    `合计:${formatNum(sum)}`,
    `平均:${formatNum(avg)}`,
    `最小:${formatNum(min)}`,
    `最大:${formatNum(max)}`,
  ]
  return `${key}[${parts.join(' ')}]`
}

function formatNum(n: number): string {
  // 整数直接显示
  if (Number.isInteger(n)) return String(n)
  // 小数保留1位
  return n.toFixed(1)
}

// ============================================================
// 日期跨度
// ============================================================

function buildDateRange(values: unknown[]): string {
  const dates: Date[] = []

  for (const v of values) {
    if (typeof v === 'number') {
      // 毫秒时间戳（13位）
      if (v > 1e12) {
        const d = new Date(v)
        if (!isNaN(d.getTime())) dates.push(d)
      }
    } else if (typeof v === 'string') {
      const d = new Date(v)
      if (!isNaN(d.getTime())) dates.push(d)
    }
  }

  if (dates.length === 0) return ''

  const times = dates.map(d => d.getTime())
  const earliest = new Date(Math.min(...times))
  const latest = new Date(Math.max(...times))

  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  if (fmt(earliest) === fmt(latest)) return fmt(earliest)
  return `${fmt(earliest)}~${fmt(latest)}`
}

// ============================================================
// 样本展示
// ============================================================

function buildSample(items: Record<string, unknown>[], total: number): string {
  const count = items.length

  if (count === 0) return ''

  const stripped = items.map(stripInternalFields)

  if (total <= 20) {
    // 全部展示
    const lines = ['全部样本:']
    stripped.forEach((item, i) => {
      lines.push(`  ${i + 1}. ${formatItem(item)}`)
    })
    return lines.join('\n')
  }

  // 前5 + 省略 + 后2
  const head = stripped.slice(0, 5)
  const tail = stripped.slice(-2)
  const omitted = count - 7
  const totalShown = count

  const lines = [`前${Math.min(5, count)}条样本:`]
  head.forEach((item, i) => {
    lines.push(`  ${i + 1}. ${formatItem(item)}`)
  })

  if (omitted > 0) {
    lines.push(`  ... 省略 ${omitted} 条 (共 ${totalShown} 条) ...`)
    tail.forEach((item, i) => {
      lines.push(`  ${totalShown - 1 + i}. ${formatItem(item)}`)
    })
  }

  return lines.join('\n')
}

/** 格式化单条记录为紧凑字符串 */
function formatItem(item: Record<string, unknown>): string {
  const pairs = Object.entries(item)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => {
      if (typeof v === 'object') return `${k}:{...}`
      return `${k}:${v}`
    })
  return pairs.join(' | ')
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
// 类型检测辅助函数
// ============================================================

/**
 * 自动检测是否为枚举型字段
 * 条件：字符串类型 + 唯一值 ≤ 10 + 唯一值占比 < 50%
 */
function isEnumLike(key: string, values: unknown[]): boolean {
  if (values.length === 0) return false
  if (typeof values[0] !== 'string') return false

  // 已知 ID 字段后缀不做枚举
  if (ID_FIELD_SUFFIXES.some(suffix => key.endsWith(suffix))) return false

  const unique = new Set(values.map(v => String(v)))
  return unique.size <= 10 && unique.size < values.length * 0.5
}

/**
 * 是否为数值汇总字段（排除 ID、日期时间戳）
 */
function isNumericField(key: string, values: unknown[]): boolean {
  if (values.length === 0) return false
  if (typeof values[0] !== 'number') return false

  // ID 类字段不汇总
  if (ID_FIELD_SUFFIXES.some(suffix => key.endsWith(suffix))) return false

  // 字段名含 id/Id 也跳过
  if (/[Ii]d$/.test(key)) return false

  // 时间戳字段（13位数字）不汇总
  if (DATE_FIELD_PATTERN.test(key)) return false
  const numVals = values as number[]
  if (numVals.every(v => v > 1e12)) return false  // 全是毫秒时间戳

  return true
}
