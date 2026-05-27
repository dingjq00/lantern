import { describe, it, expect } from 'vitest'
import { ToolRegistry } from './registry'
import { makeTool } from './__mocks__/mock-registry'
import type { IntentTags } from '@/lib/types'

describe('ToolRegistry', () => {
  const tools = [
    makeTool({ name: 'eam.fault.search', domains: ['fault'], operation: 'search', supportsFilters: ['status', 'date'] }),
    makeTool({ name: 'eam.dashboard', domains: ['equipment'], operation: 'dashboard', feedsInto: ['eam.fault.search'] }),
  ]
  const registry = new ToolRegistry(tools)

  it('getAllTools / getTool', () => {
    expect(registry.getAllTools()).toHaveLength(2)
    expect(registry.getTool('eam.fault.search')?.domains).toContain('fault')
  })

  it('match 按 domain/operation 打分排序', () => {
    const intent: IntentTags = {
      domains: ['fault'],
      operation: 'search',
      filters: ['status'],
      intentHash: 'x',
    }
    const ranked = registry.match(intent)
    expect(ranked[0].name).toBe('eam.fault.search')
    expect(ranked[0].matchScore).toBeGreaterThan(ranked[1].matchScore)
  })

  it('execute 未知工具返回 error level 4', async () => {
    const result = await registry.execute('unknown', {}, async () => ({ data: {}, status: 'success' }))
    expect(result.status).toBe('error')
    expect(result.errorLevel).toBe(4)
  })

  it('execute 已知工具委托 callTool', async () => {
    const result = await registry.execute(
      'eam.dashboard',
      { format: 'concise' },
      async (name, args) => ({ data: { name, args }, status: 'success' }),
    )
    expect(result.status).toBe('success')
    expect((result.data as { name: string }).name).toBe('eam.dashboard')
  })
})
