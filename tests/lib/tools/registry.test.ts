import { describe, it, expect, beforeAll } from 'vitest'
import { ToolRegistry } from '@/lib/tools/registry'
import { loadTools } from '@/lib/tools/yaml-loader'
import path from 'path'
import type { IntentTags } from '@/lib/types'

const TOOLS_DIR = path.join(__dirname, '../../../tools')

describe('ToolRegistry', () => {
  let registry: ToolRegistry

  beforeAll(() => {
    const tools = loadTools(TOOLS_DIR)
    registry = new ToolRegistry(tools)
  })

  it('加载 22 个工具', () => {
    expect(registry.getAllTools()).toHaveLength(22)
  })

  it('按名称获取工具', () => {
    const tool = registry.getTool('query_equipment')
    expect(tool).toBeDefined()
    expect(tool!.domains).toContain('equipment')
  })

  it('domain 匹配 — equipment', () => {
    const intent: IntentTags = { domains: ['equipment'], operation: 'list', filters: [], intentHash: '' }
    const ranked = registry.match(intent)
    // equipment 域的工具应该排在前面
    const topNames = ranked.slice(0, 5).map(r => r.name)
    expect(topNames).toContain('query_equipment')
  })

  it('domain + operation 匹配 — fault-repair detail', () => {
    const intent: IntentTags = { domains: ['fault-repair'], operation: 'detail', filters: [], intentHash: '' }
    const ranked = registry.match(intent)
    expect(ranked[0].name).toBe('get_repair_detail')
  })

  it('filter 覆盖加分', () => {
    const intentWithFilter: IntentTags = {
      domains: ['equipment'], operation: 'list', filters: ['productionLineId', 'status'], intentHash: ''
    }
    const intentNoFilter: IntentTags = {
      domains: ['equipment'], operation: 'list', filters: [], intentHash: ''
    }
    const withFilter = registry.match(intentWithFilter)
    const noFilter = registry.match(intentNoFilter)
    const qeWithFilter = withFilter.find(r => r.name === 'query_equipment')!
    const qeNoFilter = noFilter.find(r => r.name === 'query_equipment')!
    expect(qeWithFilter.matchScore).toBeGreaterThan(qeNoFilter.matchScore)
  })

  it('matchScore 公式正确 — 满分场景', () => {
    // query_equipment: domains=[equipment], operation=list, supportsFilters 7 个
    const intent: IntentTags = {
      domains: ['equipment'], operation: 'list',
      filters: ['keyword', 'status', 'categoryId', 'locationId', 'productionLineId', 'deptId', 'isKey'],
      intentHash: ''
    }
    const ranked = registry.match(intent)
    const qe = ranked.find(r => r.name === 'query_equipment')!
    // domain=40 + operation=30 + filter=20×(7/7)=20 + chain=10(有 feedsInto) = 100
    expect(qe.matchScore).toBe(100)
  })

  it('P0 模式下 match 返回全部工具', () => {
    const intent: IntentTags = { domains: ['equipment'], operation: 'list', filters: [], intentHash: '' }
    const ranked = registry.match(intent)
    // P0 不做阈值过滤，返回全部 22 个
    expect(ranked).toHaveLength(22)
  })

  it('结果按 matchScore 降序排列', () => {
    const intent: IntentTags = { domains: ['fault-repair'], operation: 'list', filters: [], intentHash: '' }
    const ranked = registry.match(intent)
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].matchScore).toBeGreaterThanOrEqual(ranked[i].matchScore)
    }
  })
})
