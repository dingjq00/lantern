import { describe, it, expect } from 'vitest'
import {
  prepareSummarizeContext,
  computeArgSignature,
  dedupeInvocations,
  assignDigestKeys,
} from './summarize-context'
import { createCrossSystemRegistry, createMockRegistry, makeTool } from '@/lib/tools/__mocks__/mock-registry'

describe('computeArgSignature', () => {
  it('键顺序无关', () => {
    expect(computeArgSignature({ b: 1, a: 2 })).toBe(computeArgSignature({ a: 2, b: 1 }))
  })
})

describe('dedupeInvocations', () => {
  it('同 tool+args 只保留最后一次', () => {
    const inv = (total: number) => ({
      tool: 'eam.dashboard',
      arguments: { format: 'concise' },
      data: { total },
      system: 'eam',
      argSignature: computeArgSignature({ format: 'concise' }),
    })
    const deduped = dedupeInvocations([inv(1), inv(99)])
    expect(deduped).toHaveLength(1)
    expect((deduped[0].data as { total: number }).total).toBe(99)
  })

  it('同 tool 不同 args 全部保留', () => {
    const a = {
      tool: 'eam.equipment.profile',
      arguments: { id: 'EQ-1' },
      data: { code: 'EQ-1' },
      system: 'eam',
      argSignature: computeArgSignature({ id: 'EQ-1' }),
    }
    const b = {
      tool: 'eam.equipment.profile',
      arguments: { id: 'EQ-2' },
      data: { code: 'EQ-2' },
      system: 'eam',
      argSignature: computeArgSignature({ id: 'EQ-2' }),
    }
    expect(dedupeInvocations([a, b])).toHaveLength(2)
  })
})

describe('assignDigestKeys', () => {
  it('单次调用用 tool 名', () => {
    const keys = assignDigestKeys([{
      tool: 'eam.dashboard', arguments: {}, data: {}, system: 'eam', argSignature: '{}',
    }])
    expect(keys[0].digestKey).toBe('eam.dashboard')
  })

  it('多次同工具用 #N 后缀', () => {
    const inv = (n: number) => ({
      tool: 'eam.dashboard',
      arguments: { n },
      data: { n },
      system: 'eam',
      argSignature: String(n),
    })
    const keys = assignDigestKeys([inv(1), inv(2)])
    expect(keys.map(k => k.digestKey)).toEqual(['eam.dashboard#1', 'eam.dashboard#2'])
  })
})

describe('prepareSummarizeContext', () => {
  const eamOnly = createMockRegistry([
    makeTool({
      name: 'eam.dashboard',
      system: 'eam',
      domains: ['equipment'],
      operation: 'dashboard',
      feedsInto: ['eam.fault.search'],
    }),
    makeTool({ name: 'eam.fault.search', system: 'eam', domains: ['fault'] }),
  ])

  it('单工具推断 systemId', () => {
    const ctx = prepareSummarizeContext(
      [{ tool: 'eam.dashboard', data: { equipment: { total: 10 } } }],
      eamOnly,
    )
    expect(ctx.systemId).toBe('eam')
    expect(ctx.systemIds).toEqual(['eam'])
    expect(ctx.relatedContext).toContain('业务关系链')
  })

  it('多系统时包含各系统 domain model', () => {
    const registry = createCrossSystemRegistry()
    const ctx = prepareSummarizeContext([
      { tool: 'eam.dashboard', data: { total: 1 } },
      { tool: 'mes.dashboard', data: { orders: 2 } },
    ], registry)
    expect(ctx.systemIds).toContain('eam')
    expect(ctx.systemIds).toContain('mes')
    expect(ctx.systems).toHaveLength(2)
    expect(ctx.relatedContext).toContain('EAM')
    expect(ctx.relatedContext).toContain('MES')
    const digest = JSON.parse(ctx.dataDigest!)
    expect(digest.eam).toBeDefined()
    expect(digest.mes).toBeDefined()
    expect(ctx.bridges.length).toBeGreaterThan(0)
    expect(ctx.relatedContext).toContain('跨系统关联提示')
  })

  it('同工具不同参数保留多次调用', () => {
    const ctx = prepareSummarizeContext([
      { tool: 'eam.dashboard', data: { total: 1 }, arguments: { a: 1 } },
      { tool: 'eam.dashboard', data: { total: 99 }, arguments: { a: 2 } },
    ], eamOnly)
    expect(ctx.dedupedResults).toHaveLength(2)
    expect(ctx.allInvocations).toHaveLength(2)
    const digest = JSON.parse(ctx.dataDigest!)
    expect(digest['eam.dashboard#1']).toBeDefined()
    expect(digest['eam.dashboard#2']).toBeDefined()
  })

  it('同工具同参数去重为一次', () => {
    const ctx = prepareSummarizeContext([
      { tool: 'eam.dashboard', data: { total: 1 }, arguments: {} },
      { tool: 'eam.dashboard', data: { total: 99 }, arguments: {} },
    ], eamOnly)
    expect(ctx.dedupedResults).toHaveLength(1)
    expect((ctx.dedupedResults[0].data as { total: number }).total).toBe(99)
  })

  it('feedsInto 未调用工具出现在 relatedContext', () => {
    const ctx = prepareSummarizeContext(
      [{ tool: 'eam.dashboard', data: { total: 5, bom: [1, 2] } }],
      eamOnly,
    )
    expect(ctx.relatedContext).toContain('可深挖')
    expect(ctx.relatedContext).toContain('eam.fault.search')
  })

  it('空结果仍生成 context', () => {
    const ctx = prepareSummarizeContext([], eamOnly)
    expect(ctx.systemId).toBeUndefined()
    expect(ctx.dedupedResults).toHaveLength(0)
    expect(ctx.dataDigest).toBeUndefined()
  })
})
