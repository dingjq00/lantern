import { describe, it, expect } from 'vitest'
import { processQuery } from '@/lib/brain/router'
import { ToolRegistry } from '@/lib/tools/registry'
import { CodexProxyProvider } from '@/lib/llm/codex-proxy'
import { loadTools } from '@/lib/tools/yaml-loader'
import path from 'path'
import type { ToolResult } from '@/lib/types'

const tools = loadTools(path.join(__dirname, '../../../tools'))
const registry = new ToolRegistry(tools)
const llm = new CodexProxyProvider()

// Mock callTool — 返回和 MCP Server mock 一致的数据
async function mockCallTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const mockData: Record<string, unknown> = {
    get_dashboard_summary: { totalEquipment: 128, runningCount: 98, faultCount: 8, pendingOrders: 5 },
    query_equipment: { total: 128, items: [{ equipmentId: 101, name: 'CNC-001', status: 1 }] },
    get_equipment_status_distribution: { distribution: [{ status: '运行中', count: 98 }], total: 128 },
    query_repair_orders: { total: 12, items: [{ repairOrderId: 201, equipmentName: 'CNC-001', status: '已关闭' }] },
    get_repair_detail: { repairOrder: { repairOrderId: 201 }, sparesUsed: [{ spareName: '轴承', quantity: 2 }] },
  }
  return { data: mockData[name] ?? { message: 'mock data' }, status: 'success' }
}

describe('processQuery (集成测试)', { timeout: 60_000 }, () => {
  it('简单查询 — 返回含 answer 和 confidence 的 StructuredResult', async () => {
    const result = await processQuery('系统里有多少台设备？', { registry, llm, callTool: mockCallTool })
    expect(result.answer).toBeTruthy()
    expect(result.confidence).toBeDefined()
    expect(['high', 'medium', 'low']).toContain(result.confidence)
    expect(result.display).toBeDefined()
  })

  it('回答内容与查询相关', async () => {
    const result = await processQuery('系统里有多少台设备？', { registry, llm, callTool: mockCallTool })
    // answer 应该提到设备数量相关的内容
    expect(result.answer.length).toBeGreaterThan(5)
  })
})
