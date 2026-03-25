/**
 * P0 验收测试 — 通过 processQuery 端到端验证
 * 用 mock callTool（同 router.test.ts），验证从输入到 StructuredResult 的完整流程
 */
import { describe, it, expect } from 'vitest'
import { processQuery } from '@/lib/brain/router'
import { ToolRegistry } from '@/lib/tools/registry'
import { CodexProxyProvider } from '@/lib/llm/codex-proxy'
import { loadTools } from '@/lib/tools/yaml-loader'
import path from 'path'
import type { ToolResult } from '@/lib/types'

const tools = loadTools(path.join(__dirname, '../../tools'))
const registry = new ToolRegistry(tools)
const llm = new CodexProxyProvider()

// Mock callTool — 覆盖主要工具的 mock 数据
const mockData: Record<string, unknown> = {
  get_dashboard_summary: { totalEquipment: 128, runningCount: 98, faultCount: 8, pendingOrders: 5, pendingMaintenance: 12 },
  query_equipment: { total: 128, items: [{ equipmentId: 101, name: 'CNC-001', status: 1, productionLine: 'A线' }] },
  get_equipment_status_distribution: { distribution: [{ status: '运行中', count: 98 }, { status: '维修中', count: 8 }], total: 128 },
  query_repair_orders: { total: 12, items: [{ repairOrderId: 201, equipmentName: 'CNC-001', status: '已关闭' }] },
  get_repair_detail: { repairOrder: { repairOrderId: 201 }, sparesUsed: [{ spareName: '主轴轴承', quantity: 2 }] },
  get_fault_trend: { days: 30, totalFaults: 23, avgPerDay: 0.77, trend: [] },
  get_spare_alerts: { alertCount: 3, items: [{ spareName: '传动带', currentStock: 2, safetyStock: 10 }] },
  get_todo_list: { pendingFaults: [{ title: '变频器报警' }], pendingOrders: [{ title: '导轨润滑' }], pendingMaintenance: [] },
  query_maintenance_tasks: { total: 8, items: [{ taskId: 501, equipmentName: 'CNC-001', status: '已完成' }] },
  get_equipment_spare_bom: { items: [{ equipmentName: 'CNC-001', spareName: '主轴轴承', quantity: 2 }] },
  query_fault_reports: { total: 15, items: [{ faultReportId: 301, equipmentName: 'CNC-001', faultType: '机械故障' }] },
}

async function mockCallTool(name: string): Promise<ToolResult> {
  return { data: mockData[name] ?? { message: `mock: ${name}` }, status: 'success' }
}

const deps = { registry, llm, callTool: mockCallTool }

describe('P0 验收测试', { timeout: 60_000 }, () => {
  // L1 简单查询 ×3
  it('L1: 系统设备总数', async () => {
    const result = await processQuery('系统里有多少台设备？', deps)
    expect(result.answer).toBeTruthy()
    expect(result.confidence).toBeDefined()
    expect(result.display).toBeDefined()
  })

  it('L1: 故障趋势', async () => {
    const result = await processQuery('最近一个月的故障趋势', deps)
    expect(result.answer).toBeTruthy()
  })

  it('L1: 库存预警', async () => {
    const result = await processQuery('有哪些备件库存不足？', deps)
    expect(result.answer).toBeTruthy()
  })

  // L2 双步查询 ×2
  it('L2: 设备的维修记录', async () => {
    const result = await processQuery('CNC-001 最近有哪些维修工单？', deps)
    expect(result.answer).toBeTruthy()
  })

  it('L2: 待办事项', async () => {
    const result = await processQuery('我今天有什么待办？', deps)
    expect(result.answer).toBeTruthy()
  })

  // L3 多步链路 ×1
  it('L3: 产线维修工单（多步）', async () => {
    const result = await processQuery('A线上月的维修工单有哪些？', deps)
    expect(result.answer).toBeTruthy()
    expect(['high', 'medium', 'low']).toContain(result.confidence)
  })
})
