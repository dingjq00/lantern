/**
 * P1 验收测试 — 通过 processQuery 验证 ReAct + Trace + Confidence + Sources
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { processQuery } from '@/lib/brain/router'
import { ToolRegistry } from '@/lib/tools/registry'
import { CodexProxyProvider } from '@/lib/llm/codex-proxy'
import { SQLiteStorage } from '@/lib/storage/sqlite'
import { loadTools } from '@/lib/tools/yaml-loader'
import path from 'path'
import type { ToolResult } from '@/lib/types'

const tools = loadTools(path.join(__dirname, '../../tools'))
const registry = new ToolRegistry(tools)
const llm = new CodexProxyProvider()

const mockData: Record<string, unknown> = {
  get_dashboard_summary: { totalEquipment: 128, runningCount: 98, faultCount: 8, pendingOrders: 5, pendingMaintenance: 12 },
  query_equipment: { total: 128, items: [{ equipmentId: 101, name: 'CNC-001', status: 1, productionLine: 'A线' }] },
  get_equipment_status_distribution: { distribution: [{ status: '运行中', count: 98 }], total: 128 },
  query_repair_orders: { total: 12, items: [{ repairOrderId: 201, equipmentName: 'CNC-001', status: '已关闭' }] },
  get_repair_detail: { repairOrder: { repairOrderId: 201 }, sparesUsed: [{ spareName: '主轴轴承', quantity: 2 }] },
  get_fault_trend: { days: 30, totalFaults: 23, avgPerDay: 0.77, trend: [] },
  get_spare_alerts: { alertCount: 3, items: [{ spareName: '传动带', currentStock: 2, safetyStock: 10 }] },
  get_todo_list: { pendingFaults: [{ title: '变频器报警' }], pendingOrders: [{ title: '导轨润滑' }], pendingMaintenance: [] },
  query_maintenance_tasks: { total: 8, items: [{ taskId: 501, equipmentName: 'CNC-001', status: '已完成' }] },
  get_equipment_spare_bom: { items: [{ equipmentName: 'CNC-001', spareName: '主轴轴承', quantity: 2 }] },
  query_fault_reports: { total: 15, items: [{ faultReportId: 301, equipmentName: 'CNC-001', faultType: '机械故障' }] },
  get_anomaly_statistics: { totalCount: 45, pendingCount: 8, processRate: 82.2 },
  get_patrol_analytics: { completionRate: 94.5, anomalyRate: 3.2 },
}

async function mockCallTool(name: string): Promise<ToolResult> {
  return { data: mockData[name] ?? { message: `mock: ${name}` }, status: 'success' }
}

let storage: SQLiteStorage

describe('P1 验收测试', { timeout: 60_000 }, () => {
  beforeAll(() => {
    storage = new SQLiteStorage(':memory:')
    storage.initialize()
  })
  afterAll(() => storage.close())

  const deps = () => ({ registry, llm, storage, callTool: mockCallTool })

  // 基础功能
  it('返回含 answer + confidence + trace 的 StructuredResult', async () => {
    const result = await processQuery('系统里有多少台设备？', deps())
    expect(result.answer).toBeTruthy()
    expect(result.confidence).toBeDefined()
    expect(['high', 'medium', 'low']).toContain(result.confidence)
    expect(result.trace).toBeDefined()
    expect(result.trace!.traceId).toBeTruthy()
  })

  // Trace 完整性
  it('trace 包含 rounds + intent + confidence', async () => {
    const result = await processQuery('上月故障趋势', deps())
    const trace = result.trace!
    expect(trace.rounds.length).toBeGreaterThanOrEqual(1)
    expect(trace.rounds[0].thought).toBeTruthy()
    expect(trace.rounds[0].calls.length).toBeGreaterThan(0)
    expect(trace.confidence).toBeDefined()
    expect(trace.finalConfidence).toBeDefined()
  })

  // Sources (Grounding)
  it('每个回答包含 sources', async () => {
    const result = await processQuery('库存预警有哪些？', deps())
    expect(result.sources).toBeDefined()
    expect(result.sources!.length).toBeGreaterThan(0)
    expect(result.sources![0].tool).toBeTruthy()
    expect(result.sources![0].description).toBeTruthy()
  })

  // ReAct 多轮
  it('复杂查询触发追查', async () => {
    const result = await processQuery('A线上月故障最多的设备的备件库存够不够？', deps())
    expect(result.answer).toBeTruthy()
    expect(result.trace!.rounds.length).toBeGreaterThanOrEqual(1)
  })

  // Session 写入
  it('查询后 session 写入存储', async () => {
    const result = await processQuery('我的待办事项', deps())
    const traceId = result.trace!.traceId
    // session 用 traceId 作为 sessionId
    const savedTrace = storage.getTrace(traceId)
    expect(savedTrace).not.toBeNull()
  })
})
