// 数据摘要引擎测试 — 覆盖所有场景
// 测试数据使用真实的 EAM/EDHR 字段名

import { describe, it, expect } from 'vitest'
import { digestToolResults } from './data-digest'
import { applyDomainFormulas } from './domain-formulas'

describe('digestToolResults', () => {
  // ============================================================
  // Test 1: 枚举字段分布统计（含百分比）
  // ============================================================
  it('枚举字段分布统计 — status/urgency/orderType', () => {
    const result = digestToolResults([{
      tool: 'eam.fault.search',
      data: {
        total: 10,
        count: 10,
        items: [
          { code: 'FR-001', status: '已完成', urgency: '一般', faultTime: '2024-01-10' },
          { code: 'FR-002', status: '维修中', urgency: '紧急', faultTime: '2024-01-11' },
          { code: 'FR-003', status: '已完成', urgency: '一般', faultTime: '2024-01-12' },
          { code: 'FR-004', status: '已完成', urgency: '特急', faultTime: '2024-01-13' },
          { code: 'FR-005', status: '待接单', urgency: '一般', faultTime: '2024-01-14' },
          { code: 'FR-006', status: '维修中', urgency: '紧急', faultTime: '2024-01-15' },
          { code: 'FR-007', status: '已完成', urgency: '一般', faultTime: '2024-01-16' },
          { code: 'FR-008', status: '待接单', urgency: '一般', faultTime: '2024-01-17' },
          { code: 'FR-009', status: '已完成', urgency: '紧急', faultTime: '2024-01-18' },
          { code: 'FR-010', status: '挂起', urgency: '特急', faultTime: '2024-01-19' },
        ],
      },
    }])

    // 合计行
    expect(result).toContain('合计: 10 条')
    // status 分布
    expect(result).toContain('status分布:')
    expect(result).toMatch(/已完成:5\(50\.0%\)/)
    // urgency 分布
    expect(result).toContain('urgency分布:')
    expect(result).toMatch(/一般:\d+\(\d+\.\d+%\)/)
  })

  // ============================================================
  // Test 2: 数值字段汇总（sum/avg/min/max）
  // ============================================================
  it('数值字段汇总 — materialCost/repairMinutes', () => {
    const result = digestToolResults([{
      tool: 'eam.repair.search',
      data: {
        total: 5,
        count: 5,
        items: [
          { code: 'RO-001', status: '已完成', orderType: 'INTERNAL', repairMinutes: 120, materialCost: 500, laborCost: 200 },
          { code: 'RO-002', status: '维修中', orderType: 'EXTERNAL', repairMinutes: 240, materialCost: 1200, laborCost: 400 },
          { code: 'RO-003', status: '已完成', orderType: 'INTERNAL', repairMinutes: 60, materialCost: 300, laborCost: 150 },
          { code: 'RO-004', status: '待验收', orderType: 'EXTERNAL', repairMinutes: 180, materialCost: 800, laborCost: 300 },
          { code: 'RO-005', status: '已完成', orderType: 'INTERNAL', repairMinutes: 90, materialCost: 600, laborCost: 250 },
        ],
      },
    }])

    expect(result).toContain('合计: 5 条')
    // repairMinutes 汇总
    expect(result).toContain('repairMinutes')
    expect(result).toMatch(/合计:690/)
    // materialCost 汇总
    expect(result).toContain('materialCost')
    expect(result).toMatch(/合计:3400/)
    // orderType 分布（已知枚举字段）
    expect(result).toContain('orderType分布:')
    expect(result).toMatch(/INTERNAL:3\(60\.0%\)/)
  })

  // ============================================================
  // Test 3: 小数据集（≤20条）列出所有条目
  // ============================================================
  it('小数据集（≤20条）展示所有条目', () => {
    const result = digestToolResults([{
      tool: 'eam.equipment.search',
      data: {
        total: 5,
        count: 5,
        items: [
          { code: 'EQ-A301-001', name: '薄膜包衣机', status: '运行中', isKey: true, updateTime: '2024-01-01' },
          { code: 'EQ-A301-002', name: '混合机', status: '停机', isKey: false, updateTime: '2024-01-02' },
          { code: 'EQ-A302-001', name: '压片机', status: '运行中', isKey: true, updateTime: '2024-01-03' },
          { code: 'EQ-A302-002', name: '灌装机', status: '维修中', isKey: false, updateTime: '2024-01-04' },
          { code: 'EQ-A303-001', name: '封口机', status: '运行中', isKey: true, updateTime: '2024-01-05' },
        ],
      },
    }])

    expect(result).toContain('全部样本:')
    // 所有5条都应在输出中
    expect(result).toContain('EQ-A301-001')
    expect(result).toContain('EQ-A303-001')
    // 内部字段应被过滤
    expect(result).not.toContain('updateTime')
  })

  // ============================================================
  // Test 4: 大数据集（>20条）只显示样本
  // ============================================================
  it('大数据集（>20条）显示前5+后2，省略中间', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      code: `FR-${String(i + 1).padStart(3, '0')}`,
      status: i % 3 === 0 ? '已完成' : i % 3 === 1 ? '维修中' : '待接单',
      urgency: '一般',
      faultDesc: `故障描述${i + 1}`,
      createTime: `2024-01-${String(i + 1).padStart(2, '0')}`,
    }))

    const result = digestToolResults([{
      tool: 'eam.fault.search',
      data: { total: 149, count: 30, items },
    }])

    expect(result).toContain('合计: 149 条')
    expect(result).toContain('前5条样本:')
    expect(result).toContain('省略')
    // 前5条应显示
    expect(result).toContain('FR-001')
    expect(result).toContain('FR-005')
    // 内部字段应被过滤
    expect(result).not.toContain('createTime')
  })

  // ============================================================
  // Test 5: groups 聚合数据（带百分比）
  // ============================================================
  it('groups 聚合数据 — groupBy=status，含百分比', () => {
    const result = digestToolResults([{
      tool: 'eam.fault.search',
      data: {
        total: 50,
        groupBy: 'status',
        groups: [
          { group: '已完成', count: 25 },
          { group: '维修中', count: 10 },
          { group: '待接单', count: 8 },
          { group: '待审核', count: 5 },
          { group: '已关闭', count: 2 },
        ],
      },
    }])

    expect(result).toContain('合计: 50 条')
    expect(result).toContain('分组维度: status')
    expect(result).toContain('分布:')
    expect(result).toContain('已完成: 25 (50.0%)')
    expect(result).toContain('维修中: 10 (20.0%)')
    expect(result).toContain('待接单: 8 (16.0%)')
  })

  // ============================================================
  // Test 6: 嵌套对象（dashboard style）展平为 key.subkey
  // ============================================================
  it('dashboard 嵌套对象展平为 key.subkey', () => {
    const result = digestToolResults([{
      tool: 'eam.dashboard',
      data: {
        equipment: { total: 150, running: 120, fault: 8, scrap: 5 },
        faultReports: { pending: 12, total: 200 },
        repairOrders: { pending: 5, completed: 180 },
        maintenance: { pending: 3 },
      },
    }])

    expect(result).toContain('equipment.total: 150')
    expect(result).toContain('equipment.running: 120')
    expect(result).toContain('faultReports.pending: 12')
    expect(result).toContain('repairOrders.completed: 180')
  })

  // ============================================================
  // Test 7: profile 数据（含嵌套数组）
  // ============================================================
  it('profile 数据 — 嵌套数组显示数量+简要分析', () => {
    const result = digestToolResults([{
      tool: 'eam.equipment.profile',
      data: {
        equipment: { id: 10101, code: 'EQ-A301-001', name: '薄膜包衣机', status: '运行中', isKey: true },
        kpi: { mtbf: 720, mttr: 2.5, availability: 0.98 },
        recentFaults: [
          { id: 1, code: 'FR-001', status: '已完成', urgency: '一般', faultTime: 1704067200000 },
          { id: 2, code: 'FR-002', status: '已完成', urgency: '紧急', faultTime: 1704153600000 },
          { id: 3, code: 'FR-003', status: '维修中', urgency: '一般', faultTime: 1704240000000 },
        ],
        activeRepairs: [
          { id: 10, code: 'RO-010', status: '维修中', orderType: 'INTERNAL', repairMinutes: 120 },
        ],
        bom: [],
      },
    }])

    expect(result).toContain('recentFaults: 3 条')
    expect(result).toContain('activeRepairs: 1 条')
    expect(result).toContain('bom: 0 条')
    // kpi 数值字段展平
    expect(result).toContain('mtbf')
  })

  // ============================================================
  // Test 8: 多工具结果（加工具名前缀）
  // ============================================================
  it('多工具结果加 [tool.name] 前缀', () => {
    const result = digestToolResults([
      {
        tool: 'eam.fault.search',
        data: {
          total: 3,
          count: 3,
          items: [
            { code: 'FR-001', status: '已完成', urgency: '一般' },
            { code: 'FR-002', status: '维修中', urgency: '紧急' },
            { code: 'FR-003', status: '已完成', urgency: '一般' },
          ],
        },
      },
      {
        tool: 'edhr.order.search',
        data: {
          total: 2,
          count: 2,
          items: [
            { code: 'ORD-001', progressStatus: 'RUNNING', validatedStatus: 'APPROVED' },
            { code: 'ORD-002', progressStatus: 'FINISHED', validatedStatus: 'PENDING' },
          ],
        },
      },
    ])

    expect(result).toContain('[eam.fault.search]')
    expect(result).toContain('[edhr.order.search]')
    // 两个工具的数据都应在输出中
    expect(result).toMatch(/合计: 3 条/)
    expect(result).toMatch(/合计: 2 条/)
  })

  // ============================================================
  // Test 9: 空结果（带上下文）
  // ============================================================
  it('空结果显示 total: 0 和 context 上下文', () => {
    const result = digestToolResults([{
      tool: 'edhr.order.search',
      data: {
        total: 0,
        count: 0,
        items: [],
        context: '在指定时间范围(2024-01-01~2024-01-31)内没有找到符合条件的工单。系统中共有 638 个工单。',
      },
    }])

    expect(result).toContain('合计: 0 条')
    expect(result).toContain('上下文:')
    expect(result).toContain('638 个工单')
  })

  // ============================================================
  // Test 10: 错误响应
  // ============================================================
  it('错误响应（value 字符串）显示为 错误: xxx', () => {
    const result = digestToolResults([{
      tool: 'eam.repair.profile',
      data: { value: '未找到匹配的维修工单' },
    }])

    expect(result).toBe('错误: 未找到匹配的维修工单')
  })

  // ============================================================
  // Test 11: 全相同数值显示 "全部为 X"
  // ============================================================
  it('全相同数值显示 "全部为 X"', () => {
    const result = digestToolResults([{
      tool: 'eam.maintenance.search',
      data: {
        total: 5,
        count: 5,
        items: [
          { code: 'MT-001', status: '已完成', priority: '普通', laborCost: 0, repairMinutes: 60 },
          { code: 'MT-002', status: '已完成', priority: '普通', laborCost: 0, repairMinutes: 90 },
          { code: 'MT-003', status: '执行中', priority: '普通', laborCost: 0, repairMinutes: 45 },
          { code: 'MT-004', status: '已完成', priority: '普通', laborCost: 0, repairMinutes: 120 },
          { code: 'MT-005', status: '执行中', priority: '普通', laborCost: 0, repairMinutes: 30 },
        ],
      },
    }])

    // laborCost 全部是 0
    expect(result).toContain('laborCost: 全部为 0')
    // repairMinutes 不同 → 正常汇总
    expect(result).toContain('repairMinutes')
    expect(result).toMatch(/合计:345/)
  })

  // ============================================================
  // Test 12: 日期跨度提取
  // ============================================================
  it('日期跨度 — ISO字符串和毫秒时间戳均支持', () => {
    // ISO 字符串
    const result1 = digestToolResults([{
      tool: 'edhr.order.search',
      data: {
        total: 4,
        count: 4,
        items: [
          { code: 'ORD-001', progressStatus: 'FINISHED', validatedStatus: 'APPROVED',
            productionDate: '2024-03-01T08:00:00Z' },
          { code: 'ORD-002', progressStatus: 'RUNNING', validatedStatus: 'PENDING',
            productionDate: '2024-03-15T10:00:00Z' },
          { code: 'ORD-003', progressStatus: 'FINISHED', validatedStatus: 'APPROVED',
            productionDate: '2024-03-28T14:00:00Z' },
          { code: 'ORD-004', progressStatus: 'INIT', validatedStatus: 'PENDING',
            productionDate: '2024-04-05T09:00:00Z' },
        ],
      },
    }])

    expect(result1).toContain('productionDate')
    expect(result1).toMatch(/2024-03-01~2024-04-05/)

    // 毫秒时间戳
    const result2 = digestToolResults([{
      tool: 'eam.fault.search',
      data: {
        total: 3,
        count: 3,
        items: [
          { code: 'FR-001', status: '已完成', urgency: '一般', faultTime: 1704067200000 },   // 2024-01-01
          { code: 'FR-002', status: '维修中', urgency: '紧急', faultTime: 1706745600000 },   // 2024-02-01
          { code: 'FR-003', status: '已完成', urgency: '一般', faultTime: 1709251200000 },   // 2024-03-01
        ],
      },
    }])

    expect(result2).toContain('faultTime')
    expect(result2).toMatch(/2024-01-01~2024-03-01/)
  })

  // ============================================================
  // Test 13: 自动检测枚举字段（非预设列表的字段）
  // ============================================================
  it('自动检测枚举字段 — 低唯一值比例的字符串字段', () => {
    const result = digestToolResults([{
      tool: 'edhr.exception.search',
      data: {
        total: 10,
        count: 10,
        items: Array.from({ length: 10 }, (_, i) => ({
          code: `EXC-${i + 1}`,
          decisionType: i % 3 === 0 ? 'REOPERATE' : i % 3 === 1 ? 'REPAIRE' : 'RETEST',
          resultStatus: i < 7 ? 'RESOLVED' : 'PENDING',
        })),
      },
    }])

    // decisionType 是已知枚举字段
    expect(result).toContain('decisionType分布:')
    expect(result).toContain('resultStatus分布:')
    expect(result).toMatch(/RESOLVED:\d+\(\d+\.\d+%\)/)
  })

  // ============================================================
  // Test 14: ID 字段不做汇总（equipmentId, spareId 等）
  // ============================================================
  it('ID 字段（equipmentId 等）不做数值汇总', () => {
    const result = digestToolResults([{
      tool: 'eam.spare.search',
      data: {
        total: 3,
        count: 3,
        items: [
          { code: 'SP-001', name: '轴承', equipmentId: 10101, lowStock: true, urgency: '紧急' },
          { code: 'SP-002', name: '皮带', equipmentId: 10102, lowStock: false, urgency: '一般' },
          { code: 'SP-003', name: '密封圈', equipmentId: 10103, lowStock: true, urgency: '一般' },
        ],
      },
    }])

    // equipmentId 不应出现在数值汇总中
    expect(result).not.toMatch(/equipmentId\[合计/)
    // lowStock 是枚举字段
    expect(result).toContain('lowStock分布:')
  })

  // ============================================================
  // Test 15: 空数组输入
  // ============================================================
  it('空工具结果列表返回无数据', () => {
    const result = digestToolResults([{
      tool: 'eam.fault.search',
      data: null,
    }])

    expect(result).toContain('无数据')
  })

  // ============================================================
  // Test 16: 单工具结果不加前缀
  // ============================================================
  it('单工具结果不加 [tool.name] 前缀', () => {
    const result = digestToolResults([{
      tool: 'eam.repair.search',
      data: {
        total: 2,
        count: 2,
        items: [
          { code: 'RO-001', status: '已完成', orderType: 'INTERNAL' },
          { code: 'RO-002', status: '维修中', orderType: 'EXTERNAL' },
        ],
      },
    }])

    expect(result).not.toContain('[eam.repair.search]')
    expect(result).toContain('合计: 2 条')
  })
})

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
    expect(result).toContain('(3/5)')
  })

  it('计算 avg 类型指标（平均维修成本）', () => {
    const items = [
      { materialCost: 1000 }, { materialCost: 2000 }, { materialCost: 3000 },
    ]
    const metrics = {
      '平均维修成本': { label: '平均维修成本', formula: 'avg' as const, field: 'materialCost', unit: '元' },
    }
    const result = applyDomainFormulas(items, 3, metrics)
    expect(result).toContain('平均维修成本: 2000元')
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
    expect(result).toBe('')
  })

  it('通配符 * 匹配非空值', () => {
    const items = [
      { decisionType: 'REOPERATE' },
      { decisionType: 'REPAIRE' },
      { decisionType: null },
    ]
    const metrics = {
      '异常率': { label: '异常率', formula: 'rate' as const, numerator: 'decisionType=*', denominator: 'total', unit: '%' },
    }
    const result = applyDomainFormulas(items, 10, metrics)
    expect(result).toContain('异常率: 20.0%')
    expect(result).toContain('(2/10)')
  })

  it('sum 类型指标', () => {
    const items = [
      { materialCost: 100 }, { materialCost: 200 }, { materialCost: 300 },
    ]
    const metrics = {
      '维修总成本': { label: '维修总成本', formula: 'sum' as const, field: 'materialCost', unit: '元' },
    }
    const result = applyDomainFormulas(items, 3, metrics)
    expect(result).toContain('维修总成本: 600元')
  })
})
