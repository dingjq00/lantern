// Benchmark 脚本 — 40 题验收 + Ground Truth 准确率验证
// 用法: npx tsx scripts/benchmark.ts
import { processQuery } from '../lib/brain/router'
import { ToolRegistry } from '../lib/tools/registry'
import { CodexProxyProvider } from '../lib/llm/codex-proxy'
import { SQLiteStorage } from '../lib/storage/sqlite'
import { loadTools } from '../lib/tools/yaml-loader'
import path from 'path'
import type { ToolResult } from '../lib/types'

const CONCURRENCY = 5

// 完整 40 题 + G2 Ground Truth
const TEST_CASES: Array<{ id: string; query: string; level: string; expectedTools: string[] }> = [
  // L1
  { id: 'T01', query: '现在系统里一共有多少台设备？', level: 'L1', expectedTools: ['get_dashboard_summary'] },
  { id: 'T02', query: '当前有几个待审核的故障报修？', level: 'L1', expectedTools: ['get_dashboard_summary'] },
  { id: 'T03', query: '设备 EQ-001 的详细信息是什么？', level: 'L1', expectedTools: ['get_equipment_detail'] },
  { id: 'T04', query: '各状态的设备数量分布是怎样的？', level: 'L1', expectedTools: ['get_equipment_status_distribution'] },
  { id: 'T05', query: '最近 30 天的故障趋势怎么样？', level: 'L1', expectedTools: ['get_fault_trend'] },
  { id: 'T06', query: '巡检异常的整体统计指标是什么？', level: 'L1', expectedTools: ['get_anomaly_statistics'] },
  { id: 'T07', query: '当前有哪些库存预警？', level: 'L1', expectedTools: ['get_spare_alerts'] },
  { id: 'T08', query: '我有哪些待办事项？', level: 'L1', expectedTools: ['get_todo_list'] },
  { id: 'T09', query: '维修工单目前各状态有多少个？', level: 'L1', expectedTools: ['query_repair_orders'] },
  { id: 'T10', query: '设备分类中哪类设备最多？', level: 'L1', expectedTools: ['query_equipment'] },
  // L2
  { id: 'T11', query: '上月故障最多的设备是哪台？', level: 'L2', expectedTools: ['query_fault_reports'] },
  { id: 'T12', query: '维修工单 WO-001 用了哪些备件？', level: 'L2', expectedTools: ['get_repair_detail'] },
  { id: 'T13', query: '设备 EQ-002 的保养任务执行情况怎样？', level: 'L2', expectedTools: ['query_maintenance_tasks'] },
  { id: 'T14', query: '近 7 天完成了几个巡检任务？', level: 'L2', expectedTools: ['query_patrol_tasks'] },
  { id: 'T15', query: '当前维修中的设备都是哪些？', level: 'L2', expectedTools: ['query_equipment'] },
  { id: 'T16', query: '备件 SP-001 都用在哪些设备上？', level: 'L2', expectedTools: ['get_equipment_spare_bom'] },
  { id: 'T17', query: '设备 EQ-001 最近一次保养是什么时候？', level: 'L2', expectedTools: ['query_maintenance_tasks'] },
  { id: 'T18', query: '本月新增了多少故障报修？', level: 'L2', expectedTools: ['query_fault_reports'] },
  { id: 'T19', query: '设备 EQ-003 的全生命周期事件有哪些？', level: 'L2', expectedTools: ['get_equipment_lifecycle'] },
  { id: 'T20', query: '近 30 天巡检发现最多异常的设备是哪台？', level: 'L2', expectedTools: ['get_patrol_analytics'] },
  // L3
  { id: 'T21', query: 'A 线上月维修用了哪些备件？', level: 'L3', expectedTools: ['query_equipment', 'query_repair_orders', 'get_repair_detail'] },
  { id: 'T22', query: '设备 EQ-003 的 BOM 里哪些备件库存不足？', level: 'L3', expectedTools: ['get_equipment_spare_bom', 'get_spare_stock'] },
  { id: 'T23', query: '上月维修时参考了哪些知识文档？', level: 'L3', expectedTools: ['query_repair_orders', 'get_repair_detail'] },
  { id: 'T24', query: 'B 线上个月巡检发现了几次异常？', level: 'L3', expectedTools: ['query_equipment', 'query_anomaly_records'] },
  { id: 'T25', query: '最近维修用量最大的备件，关联了哪些设备？', level: 'L3', expectedTools: ['query_repair_orders', 'get_repair_detail', 'get_equipment_spare_bom'] },
  { id: 'T26', query: 'A 线设备的保养计划执行率是多少？', level: 'L3', expectedTools: ['query_equipment', 'query_maintenance_tasks'] },
  { id: 'T27', query: '维修工单 WO-005 的出库单涉及了哪些仓库？', level: 'L3', expectedTools: ['get_repair_detail', 'query_spare_transactions'] },
  { id: 'T28', query: '设备 EQ-001 最近一次故障的维修花了多少工时？', level: 'L3', expectedTools: ['query_fault_reports', 'get_repair_detail'] },
  // L4
  { id: 'T29', query: '故障率最高的设备，保养是否按计划执行？', level: 'L4', expectedTools: ['query_fault_reports', 'query_maintenance_tasks'] },
  { id: 'T30', query: '上月维修成本最高的设备，它的巡检有没有发现过异常？', level: 'L4', expectedTools: ['query_repair_orders', 'get_repair_detail', 'query_anomaly_records'] },
  { id: 'T31', query: '备件库存预警涉及的设备中，有哪些正在维修？', level: 'L4', expectedTools: ['get_spare_alerts', 'get_equipment_spare_bom', 'query_equipment'] },
  { id: 'T32', query: 'A 线设备的故障、保养、巡检三项指标概览', level: 'L4', expectedTools: ['query_equipment', 'query_fault_reports', 'query_maintenance_tasks', 'get_patrol_analytics'] },
  { id: 'T33', query: '近 3 个月有故障但没安排保养的设备有哪些？', level: 'L4', expectedTools: ['query_fault_reports', 'query_maintenance_tasks'] },
  { id: 'T34', query: '外协维修的设备中，有没有重点设备？', level: 'L4', expectedTools: ['query_repair_orders', 'get_equipment_detail'] },
  // L5
  { id: 'T35', query: '哪条产线近 3 个月故障呈上升趋势，且备件库存不足？', level: 'L5', expectedTools: ['get_fault_trend', 'query_equipment', 'get_spare_alerts'] },
  { id: 'T36', query: '上季度各产线的保养完成率排名？', level: 'L5', expectedTools: ['query_equipment', 'query_maintenance_tasks'] },
  { id: 'T37', query: '同比去年同期，今年 Q1 的故障报修数是增还是减？', level: 'L5', expectedTools: ['query_fault_reports'] },
  { id: 'T38', query: '近半年维修频次最高的 3 台设备，各自的平均维修周期是多少？', level: 'L5', expectedTools: ['query_repair_orders', 'get_equipment_detail'] },
  { id: 'T39', query: '备件月消耗量环比分析，哪些备件用量在持续上升？', level: 'L5', expectedTools: ['query_repair_orders', 'get_repair_detail'] },
  { id: 'T40', query: '近 6 个月巡检异常率变化趋势，有没有季节性规律？', level: 'L5', expectedTools: ['get_patrol_analytics', 'query_anomaly_records'] },
]

// Mock data
const mockData: Record<string, unknown> = {
  get_dashboard_summary: { totalEquipment: 128, runningCount: 98, faultCount: 8, pendingOrders: 5, pendingMaintenance: 12, pendingFaults: 3 },
  query_equipment: { total: 128, items: [{ equipmentId: 101, name: 'CNC-001', status: 1, productionLine: 'A线' }] },
  get_equipment_detail: { equipmentId: 101, name: 'CNC-001', kpi: { faultCount: 3, maintenanceRate: 92.5 } },
  get_equipment_status_distribution: { distribution: [{ status: '运行中', count: 98 }], total: 128 },
  get_equipment_lifecycle: { events: [{ date: '2023-06-15', type: '购置' }] },
  query_fault_reports: { total: 15, items: [{ faultReportId: 301, equipmentName: 'CNC-001', faultType: '机械故障' }] },
  query_repair_orders: { total: 12, items: [{ repairOrderId: 201, equipmentName: 'CNC-001', status: '已关闭' }] },
  get_repair_detail: { repairOrder: { repairOrderId: 201 }, sparesUsed: [{ spareName: '主轴轴承', quantity: 2 }], knowledgeRefs: [{ title: '维修规范' }] },
  get_fault_trend: { days: 30, totalFaults: 23, avgPerDay: 0.77, trend: [] },
  query_maintenance_tasks: { total: 8, items: [{ taskId: 501, equipmentName: 'CNC-001', status: '已完成' }] },
  get_maintenance_detail: { task: { taskId: 501 }, executionRecords: [] },
  query_patrol_tasks: { total: 20, items: [{ taskId: 701, status: '已完成' }] },
  get_patrol_analytics: { completionRate: 94.5, anomalyRate: 3.2, totalTasks: 180 },
  query_anomaly_records: { total: 6, items: [{ anomalyId: 801, equipmentName: 'CNC-001' }] },
  get_anomaly_statistics: { totalCount: 45, pendingCount: 8, processRate: 82.2 },
  query_spare_parts: { total: 350, items: [{ spareId: 401, name: '主轴轴承' }] },
  get_spare_stock: { items: [{ spareId: 401, spareName: '主轴轴承', quantity: 15, safetyStock: 10 }] },
  get_equipment_spare_bom: { items: [{ equipmentName: 'CNC-001', spareName: '主轴轴承', quantity: 2 }] },
  query_spare_transactions: { total: 25, items: [{ type: 'stock_out', spareName: '主轴轴承' }] },
  get_spare_alerts: { alertCount: 3, items: [{ spareName: '传动带', currentStock: 2, safetyStock: 10 }] },
  get_governance_dashboard: { healthScore: 87.5, dataQualityScore: 92.1 },
  get_todo_list: { pendingFaults: [{ title: '变频器报警' }], pendingOrders: [{ title: '导轨润滑' }], pendingMaintenance: [] },
}

interface BenchmarkResult {
  id: string
  query: string
  level: string
  success: boolean
  actualTools: string[]
  expectedTools: string[]
  recall: number       // 期望工具中被命中的比例
  precision: number    // 实际调用中命中期望的比例
  rounds: number
  latencyMs: number
  confidence: string
  hasSources: boolean
  error?: string
}

function calcRecallPrecision(actual: string[], expected: string[]): { recall: number; precision: number } {
  if (expected.length === 0) return { recall: 1, precision: actual.length === 0 ? 1 : 0 }
  const actualSet = new Set(actual)
  const expectedSet = new Set(expected)
  const hits = [...expectedSet].filter(t => actualSet.has(t)).length
  return {
    recall: hits / expectedSet.size,
    precision: actual.length > 0 ? hits / actualSet.size : 0,
  }
}

async function main() {
  console.log('=== Insight68 Benchmark (with Ground Truth) ===')
  console.log(`测试集: ${TEST_CASES.length} 题, 并发: ${CONCURRENCY}\n`)

  const toolsDir = path.join(__dirname, '../tools')
  const registry = new ToolRegistry(loadTools(toolsDir))
  const llm = new CodexProxyProvider()
  const storage = new SQLiteStorage(':memory:')
  storage.initialize()

  async function mockCallTool(name: string): Promise<ToolResult> {
    return { data: mockData[name] ?? { message: 'mock' }, status: 'success' }
  }

  const results: BenchmarkResult[] = []
  let done = 0

  async function runOne(tc: typeof TEST_CASES[0]) {
    const start = Date.now()
    try {
      const result = await processQuery(tc.query, { registry, llm, storage, callTool: mockCallTool })
      const latencyMs = Date.now() - start
      const actualTools = [...new Set(
        result.trace?.rounds.flatMap(r => r.calls.map(c => c.tool)) ?? []
      )]
      const { recall, precision } = calcRecallPrecision(actualTools, tc.expectedTools)
      done++
      const r: BenchmarkResult = {
        id: tc.id, query: tc.query, level: tc.level, success: true,
        actualTools, expectedTools: tc.expectedTools, recall, precision,
        rounds: result.trace?.rounds.length ?? 0, latencyMs,
        confidence: result.confidence, hasSources: (result.sources?.length ?? 0) > 0,
      }
      results.push(r)
      const recallStr = recall === 1 ? '✅' : `⚠️${(recall * 100).toFixed(0)}%`
      console.log(`[${done}/${TEST_CASES.length}] ${tc.id} ${tc.level} ${recallStr} ${latencyMs}ms ${tc.query.slice(0, 25)}...`)
    } catch (err) {
      done++
      results.push({
        id: tc.id, query: tc.query, level: tc.level, success: false,
        actualTools: [], expectedTools: tc.expectedTools, recall: 0, precision: 0,
        rounds: 0, latencyMs: Date.now() - start, confidence: 'low', hasSources: false,
        error: (err as Error).message.slice(0, 50),
      })
      console.log(`[${done}/${TEST_CASES.length}] ${tc.id} ${tc.level} ❌ ${tc.query.slice(0, 25)}...`)
    }
  }

  // 并发批跑
  for (let i = 0; i < TEST_CASES.length; i += CONCURRENCY) {
    const batch = TEST_CASES.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(tc => runOne(tc)))
  }

  // ======== 统计 ========
  console.log('\n' + '='.repeat(70))
  console.log('=== 准确率统计（Ground Truth 对比）===\n')

  const successful = results.filter(r => r.success)
  const avgRecall = successful.reduce((s, r) => s + r.recall, 0) / successful.length
  const avgPrecision = successful.reduce((s, r) => s + r.precision, 0) / successful.length
  const perfectRecall = successful.filter(r => r.recall === 1).length

  console.log(`总计: ${results.length} 题, ${successful.length} 成功, ${results.length - successful.length} 失败`)
  console.log(`Recall (期望工具命中率): ${(avgRecall * 100).toFixed(1)}%`)
  console.log(`Precision (实际调用精确率): ${(avgPrecision * 100).toFixed(1)}%`)
  console.log(`完美召回 (recall=100%): ${perfectRecall}/${successful.length} (${(perfectRecall / successful.length * 100).toFixed(1)}%)`)

  // 按等级
  console.log('\n--- 按等级 ---')
  const byLevel = new Map<string, BenchmarkResult[]>()
  for (const r of results) {
    if (!byLevel.has(r.level)) byLevel.set(r.level, [])
    byLevel.get(r.level)!.push(r)
  }
  for (const [level, items] of [...byLevel.entries()].sort()) {
    const succ = items.filter(r => r.success)
    const lvlRecall = succ.length ? succ.reduce((s, r) => s + r.recall, 0) / succ.length : 0
    const lvlPerfect = succ.filter(r => r.recall === 1).length
    const avgLatency = succ.length ? Math.round(succ.reduce((s, r) => s + r.latencyMs, 0) / succ.length) : 0
    const avgRounds = succ.length ? (succ.reduce((s, r) => s + r.rounds, 0) / succ.length).toFixed(1) : '0'
    console.log(`${level}: recall=${(lvlRecall * 100).toFixed(1)}% perfect=${lvlPerfect}/${items.length} avg=${avgLatency}ms rounds=${avgRounds}`)
  }

  // 失败详情（recall < 100%）
  const imperfect = successful.filter(r => r.recall < 1)
  if (imperfect.length > 0) {
    console.log('\n--- 未完美召回的题目 ---')
    for (const r of imperfect) {
      const missing = r.expectedTools.filter(t => !r.actualTools.includes(t))
      const extra = r.actualTools.filter(t => !r.expectedTools.includes(t))
      console.log(`${r.id} ${r.level}: recall=${(r.recall * 100).toFixed(0)}%`)
      console.log(`  期望: ${r.expectedTools.join(', ')}`)
      console.log(`  实际: ${r.actualTools.join(', ')}`)
      if (missing.length) console.log(`  漏选: ${missing.join(', ')}`)
      if (extra.length) console.log(`  多选: ${extra.join(', ')}`)
    }
  }

  // 置信度 + Sources
  console.log('\n--- 其他指标 ---')
  const confDist = { high: 0, medium: 0, low: 0 }
  for (const r of successful) confDist[r.confidence as keyof typeof confDist]++
  console.log(`置信度: high=${confDist.high} medium=${confDist.medium} low=${confDist.low}`)
  const withSources = successful.filter(r => r.hasSources).length
  console.log(`Sources: ${withSources}/${successful.length} (${(withSources / successful.length * 100).toFixed(1)}%)`)

  const latencies = successful.map(r => r.latencyMs).sort((a, b) => a - b)
  console.log(`延迟 P50: ${latencies[Math.floor(latencies.length * 0.5)]}ms P95: ${latencies[Math.floor(latencies.length * 0.95)]}ms`)

  storage.close()
  console.log('\n=== Benchmark 完成 ===')
}

main().catch(console.error)
