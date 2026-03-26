import { describe, it, expect } from 'vitest'
import { loadTools } from '@/lib/tools/yaml-loader'
import path from 'path'

const TOOLS_DIR = path.join(__dirname, '../../../tools')

describe('YAML Loader', () => {
  const tools = loadTools(TOOLS_DIR)

  it('加载 22 个 EAM 工具', () => {
    expect(tools).toHaveLength(22)
  })

  it('每个工具都有必填字段', () => {
    for (const tool of tools) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.system).toBe('eam')
      expect(tool.domains.length).toBeGreaterThan(0)
      expect(tool.operation).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
      expect(tool.examples.length).toBeGreaterThan(0)
      expect(tool.whenToUse).toBeTruthy()
      expect(tool.whenNotToUse).toBeTruthy()
    }
  })

  it('snake_case 字段正确映射到 camelCase', () => {
    const queryEquipment = tools.find(t => t.name === 'query_equipment')!
    expect(queryEquipment).toBeDefined()
    expect(queryEquipment.supportsFilters).toContain('keyword')
    expect(queryEquipment.feedsInto).toContain('get_equipment_detail')
    expect(queryEquipment.dependsOn).toEqual([])
    expect(queryEquipment.whenToUse).toBeTruthy()
    expect(queryEquipment.whenNotToUse).toBeTruthy()
  })

  it('解析嵌套 inputSchema', () => {
    const faultReports = tools.find(t => t.name === 'query_fault_reports')!
    expect(faultReports.inputSchema.properties.dateRange).toBeDefined()
    expect(faultReports.inputSchema.properties.dateRange.type).toBe('object')
  })

  it('解析 examples 数组', () => {
    const dashboard = tools.find(t => t.name === 'get_dashboard_summary')!
    expect(dashboard.examples.length).toBeGreaterThanOrEqual(1)
    expect(dashboard.examples[0].query).toBeTruthy()
    expect(dashboard.examples[0].arguments).toBeDefined()
  })

  it('工具名不重复', () => {
    const names = tools.map(t => t.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('operation 值都在合法范围内', () => {
    const validOps = ['list', 'detail', 'statistics', 'trend', 'alert', 'mutation']
    for (const tool of tools) {
      expect(validOps).toContain(tool.operation)
    }
  })
})
