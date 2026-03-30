# 数据处理层 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在工具返回数据和 LLM summarize 之间加一层数据处理，自动计算分布/汇总/率值，让 AI 引用预算好的数字而不是自己从原始 JSON 中数。

**Architecture:** 两层设计：通用引擎（零配置，对任何 items[] 自动统计）+ 领域公式（按系统配置，从统计结果推导率值）。理论基础：EN 15341 维护 KPI 标准 + ISA-95 MES 标准 + FDA Quality Metrics。数据处理层输出 DataDigest，替代原始 JSON 传给 summarize。

**Tech Stack:** TypeScript, Vitest

**验证基线:** 处理前后跑 benchmark 75 题 + quality-eval，recall 不降，质量预期提升（尤其 accuracy 维度）。

---

## 文件变更地图

| 操作 | 文件 | 职责 |
|------|------|------|
| **Create** | `lib/brain/data-digest.ts` | 通用引擎 — 从任意工具结果生成统计摘要 |
| **Create** | `lib/brain/domain-formulas.ts` | 领域公式 — EAM/EDHR 的 KPI 计算规则 |
| **Create** | `lib/brain/data-digest.test.ts` | 测试 |
| **Modify** | `lib/systems.ts` | SystemMeta 加 `computedMetrics` 字段 |
| **Modify** | `lib/brain/router.ts:295-301` | 在 summarize 前调用数据处理层 |
| **Modify** | `lib/llm/codex-proxy.ts:140` | summarize 接收 digest 文本而非原始 JSON |
| **Modify** | `lib/types.ts` | LLMProvider.summarize 签名调整 |
| **Modify** | `prompts/summarize.md` | 告诉 AI "你收到的是预计算摘要，直接引用数字" |

---

### Task 1: 通用引擎 — data-digest.ts

**Files:**
- Create: `lib/brain/data-digest.ts`
- Create: `lib/brain/data-digest.test.ts`

- [ ] **Step 1: 写测试 — 分布统计**

```typescript
// lib/brain/data-digest.test.ts
import { describe, it, expect } from 'vitest'
import { digestToolResults } from './data-digest'

describe('digestToolResults', () => {
  it('统计枚举字段分布', () => {
    const data = {
      total: 5,
      items: [
        { status: 'FINISHED', cost: 100 },
        { status: 'FINISHED', cost: 200 },
        { status: 'RUNNING', cost: 50 },
        { status: 'RUNNING', cost: 80 },
        { status: 'WAITING', cost: 30 },
      ],
    }
    const digest = digestToolResults([{ tool: 'test.search', data }])
    expect(digest).toContain('status 分布: FINISHED 2(40%), RUNNING 2(40%), WAITING 1(20%)')
  })

  it('汇总数值字段', () => {
    const data = {
      total: 3,
      items: [
        { name: 'A', cost: 100, minutes: 60 },
        { name: 'B', cost: 200, minutes: 120 },
        { name: 'C', cost: 50, minutes: 30 },
      ],
    }
    const digest = digestToolResults([{ tool: 'test.search', data }])
    expect(digest).toContain('cost: 合计350')
    expect(digest).toContain('平均116.7')
    expect(digest).toContain('minutes: 合计210')
  })

  it('小数据集列出全部 items', () => {
    const data = {
      total: 2,
      items: [
        { code: 'WO-001', status: 'DONE' },
        { code: 'WO-002', status: 'PENDING' },
      ],
    }
    const digest = digestToolResults([{ tool: 'test.search', data }])
    expect(digest).toContain('WO-001')
    expect(digest).toContain('WO-002')
  })

  it('大数据集只列样本', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      code: `WO-${i}`,
      status: i < 30 ? 'DONE' : 'PENDING',
    }))
    const data = { total: 50, items }
    const digest = digestToolResults([{ tool: 'test.search', data }])
    // 应该有分布统计但不列出全部 50 条
    expect(digest).toContain('DONE 30(60%)')
    expect(digest).not.toContain('WO-25')  // 中间的不应出现
  })

  it('处理 groups 数据', () => {
    const data = {
      total: 100,
      groups: [
        { group: '压片线', count: 40 },
        { group: '包装线', count: 35 },
        { group: '制粒线', count: 25 },
      ],
      groupBy: 'productionLine',
    }
    const digest = digestToolResults([{ tool: 'test.search', data }])
    expect(digest).toContain('压片线 40(40%)')
    expect(digest).toContain('包装线 35(35%)')
  })

  it('处理非 items 的嵌套对象（如 dashboard）', () => {
    const data = {
      equipment: { total: 150, running: 120, fault: 8 },
      faultReports: { pending: 10, total: 200 },
    }
    const digest = digestToolResults([{ tool: 'eam.dashboard', data }])
    expect(digest).toContain('equipment.total: 150')
    expect(digest).toContain('faultReports.pending: 10')
  })

  it('处理 profile 类嵌套数据', () => {
    const data = {
      equipment: { code: 'EQ-001', name: '压片机#1', status: 1 },
      kpi: { healthScore: 87, oeePercent: 91.4, mttrHours: 3.9 },
      recentFaults: [{ desc: '故障1' }, { desc: '故障2' }],
      recentMaintenance: [{ status: 0 }, { status: 2 }, { status: 2 }],
    }
    const digest = digestToolResults([{ tool: 'eam.equipment.profile', data }])
    expect(digest).toContain('healthScore: 87')
    expect(digest).toContain('oeePercent: 91.4')
    expect(digest).toContain('recentFaults: 2 条')
    expect(digest).toContain('recentMaintenance: 3 条')
  })

  it('多工具结果合并', () => {
    const results = [
      { tool: 'eam.fault.search', data: { total: 10, items: [{ status: '已完成' }] } },
      { tool: 'eam.spare.search', data: { total: 5, items: [{ lowStock: true }] } },
    ]
    const digest = digestToolResults(results)
    expect(digest).toContain('[eam.fault.search]')
    expect(digest).toContain('[eam.spare.search]')
  })

  it('处理空结果', () => {
    const data = { total: 0, items: [], context: '没有符合条件的记录' }
    const digest = digestToolResults([{ tool: 'test.search', data }])
    expect(digest).toContain('total: 0')
    expect(digest).toContain('没有符合条件的记录')
  })

  it('处理 error 结果', () => {
    const data = { value: 'API 调用失败: 400' }
    const digest = digestToolResults([{ tool: 'test.search', data }])
    expect(digest).toContain('API 调用失败')
  })
})
```

- [ ] **Step 2: 运行测试确认全部失败**

Run: `npx vitest run lib/brain/data-digest.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现通用引擎**

```typescript
// lib/brain/data-digest.ts
// 数据处理层 — 通用引擎
// 将工具返回的原始 JSON 转换为结构化文本摘要
// 理论基础: EN 15341 维护 KPI + ISA-95 MES + FDA Quality Metrics

const SMALL_DATASET_THRESHOLD = 20  // ≤20 条列出全部，>20 条只列样本
const SAMPLE_HEAD = 5               // 大数据集列前 5 条
const SAMPLE_TAIL = 2               // 大数据集列后 2 条

// 常见的分类字段名（自动检测分布统计）
const ENUM_FIELDS = new Set([
  'status', 'statusText', 'orderStatus', 'progressStatus', 'validatedStatus',
  'type', 'orderType', 'category', 'priority', 'urgency', 'severity',
  'department', 'productionLine', 'decisionType', 'resultStatus',
  'lowStock', 'isKey',
])

// 忽略的内部字段（不暴露给 AI）
const SKIP_FIELDS = new Set([
  'id', 'createTime', 'updateTime', 'creator', 'updater', 'deleted', 'tenantId',
])

/**
 * 将多个工具的原始返回数据转换为文本摘要
 * 替代 JSON.stringify(data) 传给 summarize，让 AI 引用预算好的数字
 */
export function digestToolResults(
  results: Array<{ tool: string; data: unknown }>,
): string {
  if (results.length === 0) return '(无工具返回数据)'
  if (results.length === 1) return digestSingle(results[0].tool, results[0].data)
  return results.map(r => `[${r.tool}]\n${digestSingle(r.tool, r.data)}`).join('\n\n')
}

function digestSingle(tool: string, data: unknown): string {
  if (!data || typeof data !== 'object') return String(data ?? '(空)')

  const obj = data as Record<string, unknown>
  const parts: string[] = []

  // 错误结果
  if ('value' in obj && typeof obj.value === 'string' && Object.keys(obj).length === 1) {
    return `错误: ${obj.value}`
  }

  // total / count / context
  if ('total' in obj) parts.push(`total: ${obj.total}`)
  if ('count' in obj && obj.count !== obj.total) parts.push(`count: ${obj.count}`)
  if ('context' in obj) parts.push(`提示: ${obj.context}`)

  // items 数组 — 核心处理
  if ('items' in obj && Array.isArray(obj.items)) {
    digestItems(obj.items as Record<string, unknown>[], parts)
  }

  // groups 数组（groupBy 聚合结果）
  if ('groups' in obj && Array.isArray(obj.groups)) {
    digestGroups(obj.groups as Record<string, unknown>[], obj.total as number, obj.groupBy as string, parts)
  }

  // 其他顶层字段 — 递归处理嵌套对象
  const handled = new Set(['items', 'groups', 'total', 'count', 'context', 'groupBy'])
  for (const [key, value] of Object.entries(obj)) {
    if (handled.has(key)) continue

    if (Array.isArray(value)) {
      // 嵌套数组（如 recentFaults, recentMaintenance, spareUsage）
      parts.push(`${key}: ${value.length} 条`)
      if (value.length > 0 && typeof value[0] === 'object') {
        digestItems(value as Record<string, unknown>[], parts, `  `)
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // 嵌套对象（如 equipment, kpi, faultReports）
      digestNestedObject(key, value as Record<string, unknown>, parts)
    } else if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
      // 基础值
      parts.push(`${key}: ${value}`)
    }
  }

  return parts.join('\n')
}

/** 处理 items 数组 — 分布统计 + 数值汇总 + 样本 */
function digestItems(items: Record<string, unknown>[], parts: string[], prefix = ''): void {
  if (items.length === 0) return

  const firstItem = items[0]
  const fields = Object.keys(firstItem).filter(k => !SKIP_FIELDS.has(k))

  // 1. 枚举字段 → 分布统计（含百分比）
  for (const field of fields) {
    if (ENUM_FIELDS.has(field) || isEnumLike(items, field)) {
      const dist: Record<string, number> = {}
      for (const item of items) {
        const v = String(item[field] ?? 'null')
        dist[v] = (dist[v] || 0) + 1
      }
      const total = items.length
      const distStr = Object.entries(dist)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}(${Math.round(v / total * 100)}%)`)
        .join(', ')
      parts.push(`${prefix}${field} 分布: ${distStr}`)
    }
  }

  // 2. 数值字段 → sum/avg/min/max
  for (const field of fields) {
    if (ENUM_FIELDS.has(field)) continue
    if (typeof firstItem[field] !== 'number') continue
    // 跳过看起来像 ID 的数值字段
    if (field.endsWith('Id') || field === 'id') continue

    const vals = items.map(item => item[field] as number).filter(v => typeof v === 'number')
    if (vals.length === 0) continue

    const sum = vals.reduce((a, b) => a + b, 0)
    const avg = sum / vals.length
    const min = Math.min(...vals)
    const max = Math.max(...vals)

    // 所有值相同时简化输出
    if (min === max) {
      parts.push(`${prefix}${field}: 全部为 ${min}`)
    } else {
      parts.push(`${prefix}${field}: 合计${formatNum(sum)} 平均${formatNum(avg)} 最小${formatNum(min)} 最大${formatNum(max)}`)
    }
  }

  // 3. 时间字段 → 范围
  for (const field of fields) {
    if (!isDateField(field, firstItem[field])) continue
    const dates = items
      .map(item => parseDate(item[field]))
      .filter(Boolean)
      .sort() as string[]
    if (dates.length >= 2) {
      parts.push(`${prefix}${field} 范围: ${dates[0]} ~ ${dates[dates.length - 1]}`)
    }
  }

  // 4. 样本数据
  if (items.length <= SMALL_DATASET_THRESHOLD) {
    parts.push(`${prefix}全部 ${items.length} 条:`)
    for (const item of items) {
      parts.push(`${prefix}  ${formatItem(item)}`)
    }
  } else {
    parts.push(`${prefix}前 ${SAMPLE_HEAD} 条样本:`)
    for (let i = 0; i < SAMPLE_HEAD; i++) {
      parts.push(`${prefix}  ${formatItem(items[i])}`)
    }
    parts.push(`${prefix}  ... (省略 ${items.length - SAMPLE_HEAD - SAMPLE_TAIL} 条)`)
    parts.push(`${prefix}后 ${SAMPLE_TAIL} 条:`)
    for (let i = items.length - SAMPLE_TAIL; i < items.length; i++) {
      parts.push(`${prefix}  ${formatItem(items[i])}`)
    }
  }
}

/** 处理 groups 聚合结果 */
function digestGroups(groups: Record<string, unknown>[], total: number | undefined, groupBy: string | undefined, parts: string[]): void {
  if (groups.length === 0) return
  const label = groupBy ? `按 ${groupBy} 分组` : '分组'
  parts.push(`${label} (${groups.length} 组):`)
  for (const g of groups) {
    const name = g.group ?? g.name ?? g.key ?? '未知'
    const count = (g.count ?? g.value ?? 0) as number
    const pct = total && total > 0 ? ` (${Math.round(count / total * 100)}%)` : ''
    parts.push(`  ${name} ${count}${pct}`)
  }
}

/** 处理嵌套对象（如 dashboard 的 equipment、faultReports） */
function digestNestedObject(key: string, obj: Record<string, unknown>, parts: string[]): void {
  const entries = Object.entries(obj).filter(([k]) => !SKIP_FIELDS.has(k))
  if (entries.length <= 6) {
    // 短对象：一行一个字段
    for (const [k, v] of entries) {
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        // 再嵌套一层（如 statusDistribution）
        parts.push(`${key}.${k}: ${JSON.stringify(v)}`)
      } else if (Array.isArray(v)) {
        parts.push(`${key}.${k}: ${v.length} 项`)
      } else {
        parts.push(`${key}.${k}: ${v}`)
      }
    }
  } else {
    // 长对象：紧凑 JSON
    const compact = JSON.stringify(obj).slice(0, 300)
    parts.push(`${key}: ${compact}${JSON.stringify(obj).length > 300 ? '...' : ''}`)
  }
}

// === 工具函数 ===

/** 判断字段是否像枚举（字符串且不同值 ≤ 10 个） */
function isEnumLike(items: Record<string, unknown>[], field: string): boolean {
  if (typeof items[0]?.[field] !== 'string') return false
  const unique = new Set(items.map(item => item[field]))
  return unique.size <= 10 && unique.size < items.length * 0.5
}

/** 判断是否为日期字段 */
function isDateField(name: string, value: unknown): boolean {
  const dateNames = /date|time|Time|At$/i
  if (dateNames.test(name)) return true
  if (typeof value === 'string' && /^\d{4}-\d{2}/.test(value)) return true
  return false
}

/** 解析日期为 YYYY-MM-DD 格式 */
function parseDate(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'number') {
    // 毫秒时间戳
    return new Date(value).toISOString().split('T')[0]
  }
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/)
    return m ? m[1] : null
  }
  return null
}

/** 格式化数字（保留合理精度） */
function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(1)
}

/** 格式化单条 item（去掉内部字段，紧凑显示） */
function formatItem(item: Record<string, unknown>): string {
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(item)) {
    if (SKIP_FIELDS.has(k)) continue
    // 截断过长字符串
    if (typeof v === 'string' && v.length > 100) {
      clean[k] = v.slice(0, 100) + '...'
    } else {
      clean[k] = v
    }
  }
  return JSON.stringify(clean)
}
```

- [ ] **Step 4: 运行测试**

Run: `npx vitest run lib/brain/data-digest.test.ts`
Expected: 全部通过（可能需要微调 assertion 格式匹配）

- [ ] **Step 5: Commit**

```bash
git add lib/brain/data-digest.ts lib/brain/data-digest.test.ts
git commit -m "feat: 数据处理层通用引擎 — 分布统计+数值汇总+时间跨度+智能样本"
```

---

### Task 2: 领域公式 — domain-formulas.ts

**Files:**
- Create: `lib/brain/domain-formulas.ts`
- Modify: `lib/systems.ts`（加 computedMetrics）
- Modify: `lib/brain/data-digest.test.ts`（加领域公式测试）

- [ ] **Step 1: 在 systems.ts 加 computedMetrics 类型**

```typescript
// lib/systems.ts — SystemMeta 接口加字段
export interface ComputedMetric {
  label: string                          // 显示名称
  formula: 'rate' | 'avg' | 'sum' | 'count'  // 计算类型
  numerator?: string                     // rate: 分子字段路径
  denominator?: string                   // rate: 分母字段路径
  field?: string                         // avg/sum: 目标字段
  unit?: string                          // 单位（元、%、小时）
}

export interface SystemMeta {
  label: string
  scope: string
  domainModel?: string
  computedMetrics?: Record<string, ComputedMetric>  // 新增
}
```

然后在 `SYSTEM_REGISTRY` 的 eam 和 edhr 中配置领域公式：

```typescript
eam: {
  // ... 已有字段不变 ...
  computedMetrics: {
    // TPM 标准 KPI (EN 15341)
    'PM完成率': { label: '保养完成率', formula: 'rate', numerator: 'status=2', denominator: 'total', unit: '%' },
    '维修完成率': { label: '维修完成率', formula: 'rate', numerator: 'status=5', denominator: 'total', unit: '%' },
    '平均维修成本': { label: '平均维修成本', formula: 'avg', field: 'materialCost', unit: '元' },
    '平均维修时长': { label: '平均维修时长', formula: 'avg', field: 'repairMinutes', unit: '分钟' },
    '紧急工单率': { label: '紧急工单率', formula: 'rate', numerator: 'urgency=1', denominator: 'total', unit: '%' },
  },
},
edhr: {
  // ... 已有字段不变 ...
  computedMetrics: {
    // 制药质量 KPI (FDA Quality Metrics)
    '工单完成率': { label: '工单完成率', formula: 'rate', numerator: 'progressStatus=FINISHED', denominator: 'total', unit: '%' },
    '批次合格率': { label: '批次合格率', formula: 'rate', numerator: 'validatedStatus=PASSED', denominator: 'total', unit: '%' },
    '异常率': { label: '异常率', formula: 'rate', numerator: 'decisionType=*', denominator: 'total', unit: '%' },
  },
},
```

- [ ] **Step 2: 写测试 — 领域公式计算**

追加到 `data-digest.test.ts`：

```typescript
import { applyDomainFormulas } from './domain-formulas'

describe('applyDomainFormulas', () => {
  it('计算 rate 类型指标（维修完成率）', () => {
    const items = [
      { status: 5 }, { status: 5 }, { status: 5 },
      { status: 3 }, { status: 1 },
    ]
    const metrics = {
      '维修完成率': { label: '维修完成率', formula: 'rate' as const, numerator: 'status=5', denominator: 'total', unit: '%' },
    }
    const result = applyDomainFormulas(items, 5, metrics)
    expect(result).toContain('维修完成率: 60.0%')
  })

  it('计算 avg 类型指标（平均维修成本）', () => {
    const items = [
      { materialCost: 1000 }, { materialCost: 2000 }, { materialCost: 3000 },
    ]
    const metrics = {
      '平均维修成本': { label: '平均维修成本', formula: 'avg' as const, field: 'materialCost', unit: '元' },
    }
    const result = applyDomainFormulas(items, 3, metrics)
    expect(result).toContain('平均维修成本: 2000')
  })

  it('EDHR 工单完成率 + 批次合格率', () => {
    const items = [
      { progressStatus: 'FINISHED', validatedStatus: 'PASSED' },
      { progressStatus: 'FINISHED', validatedStatus: 'PASSED' },
      { progressStatus: 'RUNNING', validatedStatus: 'INIT' },
    ]
    const metrics = {
      '工单完成率': { label: '工单完成率', formula: 'rate' as const, numerator: 'progressStatus=FINISHED', denominator: 'total', unit: '%' },
      '批次合格率': { label: '批次合格率', formula: 'rate' as const, numerator: 'validatedStatus=PASSED', denominator: 'total', unit: '%' },
    }
    const result = applyDomainFormulas(items, 3, metrics)
    expect(result).toContain('工单完成率: 66.7%')
    expect(result).toContain('批次合格率: 66.7%')
  })

  it('无匹配字段时不输出', () => {
    const items = [{ name: 'test' }]
    const metrics = {
      '完成率': { label: '完成率', formula: 'rate' as const, numerator: 'status=DONE', denominator: 'total', unit: '%' },
    }
    const result = applyDomainFormulas(items, 1, metrics)
    expect(result).toBe('')  // 字段不存在，不输出
  })
})
```

- [ ] **Step 3: 实现领域公式**

```typescript
// lib/brain/domain-formulas.ts
// 领域公式 — 基于 TPM/MES/FDA 标准 KPI 从通用统计推导率值
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
      // 检查字段是否存在
      if (!items.some(item => field in item)) return null

      let numerator: number
      if (value === '*') {
        // 通配: 任何非空值
        numerator = items.filter(item => item[field] != null && item[field] !== '').length
      } else {
        // 精确匹配（支持 string 和 number）
        numerator = items.filter(item => String(item[field]) === value).length
      }
      const denominator = metric.denominator === 'total' ? total : items.length
      if (denominator === 0) return null
      const pct = (numerator / denominator * 100).toFixed(1)
      return `  ${metric.label}: ${pct}${metric.unit || ''} (${numerator}/${denominator})`
    }

    case 'avg': {
      if (!metric.field) return null
      const vals = items
        .map(item => item[metric.field!])
        .filter(v => typeof v === 'number') as number[]
      if (vals.length === 0) return null
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      return `  ${metric.label}: ${formatNum(avg)}${metric.unit || ''}`
    }

    case 'sum': {
      if (!metric.field) return null
      const vals = items
        .map(item => item[metric.field!])
        .filter(v => typeof v === 'number') as number[]
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

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(1)
}
```

- [ ] **Step 4: 运行测试**

Run: `npx vitest run lib/brain/data-digest.test.ts`
Expected: 全部通过

- [ ] **Step 5: Commit**

```bash
git add lib/brain/domain-formulas.ts lib/systems.ts lib/brain/data-digest.test.ts
git commit -m "feat: 领域公式 — EAM(TPM标准) + EDHR(FDA Quality Metrics) KPI 自动计算"
```

---

### Task 3: 集成到 router + summarize

**Files:**
- Modify: `lib/brain/data-digest.ts`（加 `buildDigestForSummarize` 入口函数）
- Modify: `lib/brain/router.ts:295-301`
- Modify: `lib/llm/codex-proxy.ts:129-143`
- Modify: `lib/types.ts:132`
- Modify: `prompts/summarize.md`

- [ ] **Step 1: 在 data-digest.ts 加入口函数（整合通用引擎 + 领域公式）**

在 `data-digest.ts` 文件末尾追加：

```typescript
import { SYSTEM_REGISTRY } from '@/lib/systems'
import { applyDomainFormulas } from './domain-formulas'

/**
 * 为 summarize 构建完整数据摘要（通用统计 + 领域 KPI）
 * 替代 JSON.stringify(data) 传给 LLM
 */
export function buildDigestForSummarize(
  results: Array<{ tool: string; data: unknown }>,
  systemId?: string,
): string {
  // 1. 通用引擎输出
  const genericDigest = digestToolResults(results)

  // 2. 领域公式（如果有配置）
  const metrics = systemId ? SYSTEM_REGISTRY[systemId]?.computedMetrics : undefined
  if (!metrics) return genericDigest

  // 对每个工具的 items 数据应用领域公式
  const formulaLines: string[] = []
  for (const r of results) {
    if (!r.data || typeof r.data !== 'object') continue
    const obj = r.data as Record<string, unknown>
    if ('items' in obj && Array.isArray(obj.items) && obj.items.length > 0) {
      const result = applyDomainFormulas(
        obj.items as Record<string, unknown>[],
        (obj.total as number) || obj.items.length,
        metrics,
      )
      if (result) formulaLines.push(result)
    }
  }

  if (formulaLines.length === 0) return genericDigest
  return genericDigest + '\n\n' + formulaLines.join('\n')
}
```

- [ ] **Step 2: 修改 LLMProvider.summarize 签名**

`lib/types.ts` 第 132 行，给 summarize 加一个可选的 `dataDigest` 参数：

```typescript
  summarize(data: unknown, question: string, formatHint: DisplayFormat, relatedContext?: string, dataDigest?: string): Promise<SummarizeResult>
```

- [ ] **Step 3: 修改 codex-proxy.ts — summarize 优先用 digest**

`lib/llm/codex-proxy.ts` 的 `summarize()` 方法签名和 user message 构建：

```typescript
  async summarize(data: unknown, question: string, formatHint: DisplayFormat, relatedContext?: string, dataDigest?: string): Promise<SummarizeResult> {
    // ...（model/reasoning 判断不变）
    const dataContent = dataDigest
      ? `数据摘要（已预计算，直接引用数字即可）:\n${dataDigest}`
      : `数据: ${JSON.stringify(data)}`
    const response = await this.client.chat.completions.create({
      model: useModel,
      ...(!isReasoning && { temperature: 0.3 }),
      max_completion_tokens: isReasoning ? 8192 : 4096,
      messages: [
        { role: 'system', content: `${getSummarizePrompt()}\n数据展示类型参考: ${formatHint}` },
        { role: 'user', content: `问题: ${question}\n${dataContent}${relatedContext ? `\n\n可深挖方向: ${relatedContext}` : ''}` },
      ],
      ...(!isReasoning && { response_format: { type: 'json_object' as const } }),
    })
    // ... 后续不变
```

- [ ] **Step 4: 修改 router.ts — 在 summarize 前生成 digest**

`lib/brain/router.ts`，在 `// LLM 总结（容错）` 注释附近（约 295 行），修改 summarize 调用：

在文件顶部加 import：
```typescript
import { buildDigestForSummarize } from './data-digest'
```

替换 summarize 调用块：

```typescript
  // 数据处理层 — 将原始 JSON 转为结构化摘要（省 token + 预计算统计值）
  const toolResultsForDigest = allResults.map(r => ({ tool: r.tool, data: r.data }))
  // 从第一个工具的 system 推断系统 ID
  const firstToolDef = allResults.length > 0 ? registry.getTool(allResults[0].tool) : undefined
  const systemId = firstToolDef?.system
  const dataDigest = buildDigestForSummarize(toolResultsForDigest, systemId)

  // LLM 总结（容错）
  const mergedData = allResults.map(r => r.data)
  const firstData = mergedData.length === 1 ? mergedData[0] : mergedData
  const formatHint = detectDisplayFormat(firstData)
  let summary: Awaited<ReturnType<LLMProvider['summarize']>>
  try {
    summary = await llm.summarize(firstData, query, formatHint, relatedContext, dataDigest)
  } catch (err) {
    console.warn('[Router] LLM summarize 失败:', (err as Error).message)
    summary = { answer: '查询已完成，请查看下方数据详情。', display: 'text' }
  }
```

- [ ] **Step 5: 更新 summarize prompt**

`prompts/summarize.md`，在核心原则第 1 条后面加：

```
注意：你收到的数据已经过预计算处理，包含分布统计和领域指标。直接引用这些数字，不要自己重新统计。
```

- [ ] **Step 6: 验证编译**

Run: `npm run build 2>&1 | tail -15`
Expected: `Compiled successfully`

- [ ] **Step 7: Commit**

```bash
git add lib/brain/data-digest.ts lib/brain/router.ts lib/llm/codex-proxy.ts lib/types.ts prompts/summarize.md
git commit -m "feat: 数据处理层集成 — digest 替代原始 JSON 传给 summarize，省 token + 预计算"
```

---

### Task 4: 回归验证

- [ ] **Step 1: 跑 benchmark**

Run: `npx tsx scripts/benchmark.ts "数据处理层 v1 — digest 替代 JSON"`
Expected: 75/75 recall, 0 失败

- [ ] **Step 2: 跑 quality-eval**

Run: `npx tsx scripts/quality-eval.ts`
Expected: 综合分 ≥ 4.6，accuracy 维度应有提升

- [ ] **Step 3: 对比关键题**

重点检查之前低分的题：T08、E15、E21、E34 的准确性是否提升。

- [ ] **Step 4: Commit + Push**

```bash
git push origin feat/p0-platform
```

---

## 架构变化摘要

```
Before:
  tool results → JSON.stringify(data) ──────────→ summarize LLM
                 (15000 tokens, AI 自己数)

After:
  tool results → data-digest 通用引擎 ──→ 分布/汇总/样本
                 domain-formulas      ──→ 完成率/合格率/KPI
                 ──→ 文本摘要 (~700 tokens) ──→ summarize LLM
                     (AI 直接引用预算好的数字)
```

**净效果:**
- summarize token 从 ~15000 降到 ~700（节省 95%）
- AI 不用自己数 JSON items，直接引用 `FINISHED 105(70.5%)`
- 领域 KPI 自动计算（TPM 标准：完成率/故障率/平均成本；FDA 标准：合格率/异常率）
- 接新系统只需在 systems.ts 加 computedMetrics，通用引擎不用动
