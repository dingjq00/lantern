// 数据摘要引擎 v2 测试 — JSON 格式输出
import { describe, it, expect } from 'vitest'
import { digestToolResults, buildDigestForSummarize } from './data-digest'
import { applyDomainFormulas } from './domain-formulas'

describe('digestToolResults (JSON 格式)', () => {

  it('枚举字段分布统计', () => {
    const data = {
      total: 5,
      items: [
        { status: 'FINISHED', statusText: '已完成', cost: 100 },
        { status: 'FINISHED', statusText: '已完成', cost: 200 },
        { status: 'RUNNING', statusText: '运行中', cost: 50 },
        { status: 'RUNNING', statusText: '运行中', cost: 80 },
        { status: 'WAITING', statusText: '等待中', cost: 30 },
      ],
    }
    const digest = digestToolResults([{ tool: 'test', data }])
    const parsed = JSON.parse(digest)
    // 应优先用 statusText 做分布
    expect(parsed.stats.statusText).toBeDefined()
    expect(parsed.stats.statusText['已完成'].count).toBe(2)
    expect(parsed.stats.statusText['运行中'].count).toBe(2)
  })

  it('数值字段汇总 (sum/avg/min/max)', () => {
    const data = {
      total: 3,
      items: [
        { name: 'A', materialCost: 100, repairMinutes: 60 },
        { name: 'B', materialCost: 200, repairMinutes: 120 },
        { name: 'C', materialCost: 50, repairMinutes: 30 },
      ],
    }
    const digest = digestToolResults([{ tool: 'test', data }])
    const parsed = JSON.parse(digest)
    expect(parsed.stats.materialCost.sum).toBe(350)
    expect(parsed.stats.materialCost.avg).toBeCloseTo(116.7, 0)
    expect(parsed.stats.repairMinutes.sum).toBe(210)
  })

  it('小数据集列出全部 samples', () => {
    const data = {
      total: 2,
      items: [
        { code: 'WO-001', status: 'DONE' },
        { code: 'WO-002', status: 'PENDING' },
      ],
    }
    const digest = digestToolResults([{ tool: 'test', data }])
    const parsed = JSON.parse(digest)
    expect(parsed.samples).toHaveLength(2)
    expect(parsed.samples[0].code).toBe('WO-001')
  })

  it('大数据集只列样本（前5+后2）', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      code: `WO-${i}`,
      progressStatus: i < 30 ? 'DONE' : 'PENDING',
    }))
    const data = { total: 50, items }
    const digest = digestToolResults([{ tool: 'test', data }])
    const parsed = JSON.parse(digest)
    // 前5 + _omitted + 后2 = 8
    expect(parsed.samples).toHaveLength(8)
    expect(parsed.samples[0].code).toBe('WO-0')
    expect(parsed.samples[5]._omitted).toContain('省略')
    expect(parsed.samples[7].code).toBe('WO-49')
  })

  it('groups 聚合数据', () => {
    const data = {
      total: 100,
      groups: [
        { group: '压片线', count: 40 },
        { group: '包装线', count: 35 },
        { group: '制粒线', count: 25 },
      ],
      groupBy: 'productionLine',
    }
    const digest = digestToolResults([{ tool: 'test', data }])
    const parsed = JSON.parse(digest)
    expect(parsed.total).toBe(100)
    expect(parsed.distribution['压片线'].count).toBe(40)
    expect(parsed.distribution['压片线'].pct).toBe('40.0%')
  })

  it('嵌套 dashboard 对象', () => {
    const data = {
      equipment: { total: 150, running: 120, fault: 8 },
      faultReports: { pending: 10, total: 200 },
    }
    const digest = digestToolResults([{ tool: 'test', data }])
    const parsed = JSON.parse(digest)
    expect(parsed.equipment.total).toBe(150)
    expect(parsed.equipment.running).toBe(120)
    expect(parsed.faultReports.pending).toBe(10)
  })

  it('profile 嵌套数组', () => {
    const data = {
      equipment: { code: 'EQ-001', name: '压片机#1' },
      kpi: { healthScore: 87, oeePercent: 91.4 },
      recentFaults: [{ desc: '故障1' }, { desc: '故障2' }],
      recentMaintenance: [{ status: 0 }, { status: 2 }, { status: 2 }],
    }
    const digest = digestToolResults([{ tool: 'test', data }])
    const parsed = JSON.parse(digest)
    expect(parsed.kpi.healthScore).toBe(87)
    expect(parsed.recentFaults.count).toBe(2)
    expect(parsed.recentMaintenance.count).toBe(3)
  })

  it('多工具结果', () => {
    const results = [
      { tool: 'eam.fault.search', data: { total: 10, items: [{ status: '已完成' }] } },
      { tool: 'eam.spare.search', data: { total: 5, items: [{ lowStock: true }] } },
    ]
    const digest = digestToolResults(results)
    const parsed = JSON.parse(digest)
    expect(parsed['eam.fault.search']).toBeDefined()
    expect(parsed['eam.spare.search']).toBeDefined()
  })

  it('同工具多次调用用 digestKey 区分', () => {
    const results = [
      { tool: 'eam.dashboard', digestKey: 'eam.dashboard#1', data: { total: 1 } },
      { tool: 'eam.dashboard', digestKey: 'eam.dashboard#2', data: { total: 99 } },
    ]
    const digest = digestToolResults(results)
    const parsed = JSON.parse(digest)
    expect(parsed['eam.dashboard#1'].total).toBe(1)
    expect(parsed['eam.dashboard#2'].total).toBe(99)
  })

  it('空结果 + context', () => {
    const data = { total: 0, items: [], context: '没有符合条件的记录' }
    const digest = digestToolResults([{ tool: 'test', data }])
    const parsed = JSON.parse(digest)
    expect(parsed.total).toBe(0)
    expect(parsed.context).toContain('没有符合条件')
  })

  it('错误结果', () => {
    const data = { value: 'API 调用失败: 400' }
    const digest = digestToolResults([{ tool: 'test', data }])
    const parsed = JSON.parse(digest)
    expect(parsed.error).toContain('API 调用失败')
  })

  it('日期范围提取', () => {
    const data = {
      total: 2,
      items: [
        { code: 'A', productionDate: '2024-07-01' },
        { code: 'B', productionDate: '2024-08-15' },
      ],
    }
    const digest = digestToolResults([{ tool: 'test', data }])
    const parsed = JSON.parse(digest)
    expect(parsed.stats.productionDate_range).toContain('2024-07-01')
    expect(parsed.stats.productionDate_range).toContain('2024-08-15')
  })

  it('输出是合法 JSON', () => {
    const data = {
      total: 149,
      items: Array.from({ length: 149 }, (_, i) => ({
        code: `WO-${i}`,
        progressStatus: i < 105 ? 'FINISHED' : i < 134 ? 'RUNNING' : 'WAITING',
        validatedStatus: i < 105 ? 'PASSED' : 'INIT',
      })),
    }
    const digest = digestToolResults([{ tool: 'test', data }])
    // 不应抛出
    const parsed = JSON.parse(digest)
    expect(parsed.total).toBe(149)
    expect(parsed.stats.progressStatus['FINISHED'].count).toBe(105)
  })
})

describe('applyDomainFormulas (JSON 输出)', () => {

  it('计算 rate 类型 — 分母用 items.length', () => {
    const items = [
      { status: 5 }, { status: 5 }, { status: 5 },
      { status: 3 }, { status: 1 },
    ]
    const metrics = {
      '维修完成率': { label: '维修完成率', formula: 'rate' as const, numerator: 'status=5', denominator: 'total', unit: '%' },
    }
    const result = applyDomainFormulas(items, 5, metrics)
    expect(result['维修完成率']).toBeDefined()
    const kpi = result['维修完成率'] as Record<string, unknown>
    expect(kpi.value).toBe('60%')
    expect(kpi.numerator).toBe(3)
    expect(kpi.denominator).toBe(5)
  })

  it('计算 avg 类型', () => {
    const items = [
      { materialCost: 1000 }, { materialCost: 2000 }, { materialCost: 3000 },
    ]
    const metrics = {
      '平均维修成本': { label: '平均维修成本', formula: 'avg' as const, field: 'materialCost', unit: '元' },
    }
    const result = applyDomainFormulas(items, 3, metrics)
    expect((result['平均维修成本'] as Record<string, unknown>).value).toBe(2000)
  })

  it('无关公式静默跳过（保养数据不算维修完成率）', () => {
    // 保养数据只有 status=0/2，没有 status=5
    const items = [
      { status: 2 }, { status: 2 }, { status: 0 },
    ]
    const metrics = {
      'PM完成率': { label: '保养完成率', formula: 'rate' as const, numerator: 'status=2', denominator: 'total', unit: '%' },
      '维修完成率': { label: '维修完成率', formula: 'rate' as const, numerator: 'status=5', denominator: 'total', unit: '%' },
    }
    const result = applyDomainFormulas(items, 3, metrics)
    // PM完成率应该有（status 字段存在）
    expect(result['PM完成率']).toBeDefined()
    expect((result['PM完成率'] as Record<string, unknown>).value).toBe('66.7%')
    // 维修完成率也会有（status 字段存在，只是值为 0%）—— 这是预期行为
    // 因为字段存在，只是没有 status=5 的记录
    expect(result['维修完成率']).toBeDefined()
    expect((result['维修完成率'] as Record<string, unknown>).value).toBe('0%')
  })

  it('字段不存在时完全跳过', () => {
    const items = [{ name: 'test' }]
    const metrics = {
      '完成率': { label: '完成率', formula: 'rate' as const, numerator: 'status=DONE', denominator: 'total', unit: '%' },
    }
    const result = applyDomainFormulas(items, 1, metrics)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('通配符匹配非空值', () => {
    const items = [
      { decisionType: 'REOPERATE' },
      { decisionType: 'REPAIRE' },
      { decisionType: null },
    ]
    const metrics = {
      '异常率': { label: '异常率', formula: 'rate' as const, numerator: 'decisionType=*', denominator: 'total', unit: '%' },
    }
    const result = applyDomainFormulas(items, 3, metrics)
    expect((result['异常率'] as Record<string, unknown>).value).toBe('66.7%')
    expect((result['异常率'] as Record<string, unknown>).numerator).toBe(2)
  })

  it('sum 类型', () => {
    const items = [
      { materialCost: 100 }, { materialCost: 200 }, { materialCost: 300 },
    ]
    const metrics = {
      '维修总成本': { label: '维修总成本', formula: 'sum' as const, field: 'materialCost', unit: '元' },
    }
    const result = applyDomainFormulas(items, 3, metrics)
    expect((result['维修总成本'] as Record<string, unknown>).value).toBe(600)
  })
})

describe('buildDigestForSummarize', () => {

  it('包含领域指标', () => {
    const results = [{
      tool: 'eam.maintenance.search',
      data: {
        total: 15,
        items: [
          { status: 2, statusText: '已完成' },
          { status: 2, statusText: '已完成' },
          { status: 0, statusText: '待执行' },
        ],
      },
    }]
    const digest = buildDigestForSummarize(results, 'eam')
    const parsed = JSON.parse(digest)
    // 领域指标应该存在
    expect(parsed._领域指标).toBeDefined()
    // PM完成率分母应该是 3（items.length）不是 15（total）
    const pm = parsed._领域指标['PM完成率'] as Record<string, unknown>
    expect(pm.denominator).toBe(3)
    expect(pm.value).toBe('66.7%')
  })
})
