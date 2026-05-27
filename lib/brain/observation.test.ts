import { describe, it, expect } from 'vitest'
import {
  cleanDefensiveLanguage,
  calcTruncateThreshold,
  buildObservationData,
  buildObservationMessage,
  detectCandidateSystems,
} from './observation'
import { createMockRegistry, makeTool } from '@/lib/tools/__mocks__/mock-registry'

describe('cleanDefensiveLanguage', () => {
  it('替换防御性措辞', () => {
    expect(cleanDefensiveLanguage('数据被截断且不完整')).toBe('已获取数据且部分')
  })
})

describe('calcTruncateThreshold', () => {
  it('短上下文用大阈值', () => {
    expect(calcTruncateThreshold([{ content: 'hi' }])).toBe(12000)
  })

  it('长上下文用小阈值', () => {
    const long = [{ content: 'x'.repeat(25000) }]
    expect(calcTruncateThreshold(long)).toBe(8000)
  })
})

describe('buildObservationData', () => {
  it('小结果不截断', () => {
    const data = buildObservationData(
      [{ tool: 'eam.dashboard' }],
      [{ total: 5 }],
      10000,
    )
    expect(data[0].result).toEqual({ total: 5 })
  })

  it('超大结果生成概要', () => {
    const big = { total: 100, items: Array.from({ length: 50 }, (_, i) => ({ id: i })) }
    const data = buildObservationData(
      [{ tool: 'eam.fault.search' }],
      [big],
      100,
    )
    const summary = data[0].result as Record<string, unknown>
    expect(summary.itemCount).toBe(50)
    expect((summary.items as unknown[]).length).toBe(3)
  })
})

describe('buildObservationMessage', () => {
  const registry = createMockRegistry([
    makeTool({ name: 'eam.fault.search', domains: ['fault'] }),
    makeTool({ name: 'eam.equipment.search', domains: ['equipment'] }),
  ])

  it('未覆盖域时包含域覆盖提示', () => {
    const msg = buildObservationMessage({
      obsData: [{ tool: 'eam.fault.search', result: { total: 1 } }],
      query: '故障和设备',
      allResults: [{ tool: 'eam.fault.search' }],
      intent: { domains: ['fault', 'equipment'], operation: 'search', filters: [], intentHash: 'abc' },
      registry,
      validationWarnings: [],
    })
    expect(msg).toContain('域覆盖检查')
    expect(msg).toContain('equipment')
    expect(msg).toContain('已查系统: [eam]')
  })

  it('校验警告出现在消息中', () => {
    const msg = buildObservationMessage({
      obsData: [{ tool: 't', result: {} }],
      query: 'q',
      allResults: [{ tool: 't' }],
      registry: createMockRegistry([makeTool({ name: 't' })]),
      validationWarnings: ['空结果'],
    })
    expect(msg).toContain('校验: 空结果')
  })

  it('误用 mes.dashboard 查工单 → 注入 MES 工单提示', () => {
    const msg = buildObservationMessage({
      obsData: [{ tool: 'mes.dashboard', result: { production: { orders: { byStatus: { RUNNING: 5 } } } } }],
      query: '备件预警设备在 MES 里有多少生产工单？',
      allResults: [{ tool: 'eam.spare.search' }, { tool: 'mes.dashboard' }],
      registry: createMockRegistry([
        makeTool({ name: 'eam.spare.search', system: 'eam' }),
        makeTool({ name: 'mes.dashboard', system: 'mes', domains: ['warehouse'] }),
      ]),
      validationWarnings: [],
    })
    expect(msg).toContain('MES 工单提示')
    expect(msg).toContain('mes.order.search')
  })

  it('问题涉及未覆盖系统 → 注入跨系统覆盖建议', () => {
    const msg = buildObservationMessage({
      obsData: [{ tool: 'eam.equipment.search', result: { total: 3 } }],
      query: '维修中的设备影响到了哪些生产工单？',
      allResults: [{ tool: 'eam.equipment.search' }],
      registry: createMockRegistry([
        makeTool({ name: 'eam.equipment.search', domains: ['equipment'], system: 'eam' }),
      ]),
      validationWarnings: [],
    })
    expect(msg).toContain('跨系统覆盖建议')
    expect(msg).toContain('未覆盖')
    expect(msg).toContain('mes')
    expect(msg).toContain('mes.order.search')
  })
})

describe('detectCandidateSystems', () => {
  it('混合关键词命中多个系统', () => {
    const sys = detectCandidateSystems('维修中的设备影响到生产工单了吗')
    expect(sys).toContain('eam')
    expect(sys).toContain('mes')
  })

  it('仅 eam 关键词只命中 eam', () => {
    const sys = detectCandidateSystems('故障报修都有哪些')
    expect(sys).toContain('eam')
    expect(sys).not.toContain('mes')
  })
})
