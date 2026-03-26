// Benchmark 脚本 — 40 题验收 + 延迟统计
// 用法: npx tsx scripts/benchmark.ts
import { processQuery } from '../lib/brain/router'
import { ToolRegistry } from '../lib/tools/registry'
import { CodexProxyProvider } from '../lib/llm/codex-proxy'
import { SQLiteStorage } from '../lib/storage/sqlite'
import { loadTools } from '../lib/tools/yaml-loader'
import path from 'path'
import type { ToolResult, StructuredResult } from '../lib/types'

const CONCURRENCY = 5

const BENCHMARK_QUERIES = [
  // L1
  { query: '系统里有多少台设备？', level: 'L1' },
  { query: '当前有几个待审核的故障报修？', level: 'L1' },
  { query: '各状态的设备分别有多少台？', level: 'L1' },
  { query: '最近一个月故障趋势怎么样？', level: 'L1' },
  { query: '异常处理率是多少？', level: 'L1' },
  { query: '有哪些备件库存不足？', level: 'L1' },
  { query: '我今天有什么待办？', level: 'L1' },
  // L2
  { query: '上个月有哪些电气故障报修？', level: 'L2' },
  { query: '维修工单 WO-201 用了哪些备件？', level: 'L2' },
  { query: '本周有哪些保养任务要做？', level: 'L2' },
  { query: 'CNC-001 需要哪些备件？', level: 'L2' },
  { query: '近30天巡检完成率多少？', level: 'L2' },
  // L3
  { query: 'A线上月的维修工单有哪些？', level: 'L3' },
  { query: 'CNC-001 的备件库存够不够？', level: 'L3' },
  { query: '上月维修工单中最常用的备件', level: 'L3' },
  // L4
  { query: 'CNC-001 上季度故障和保养的交叉分析', level: 'L4' },
  { query: '哪些备件库存不足？会影响哪些设备？', level: 'L4' },
  { query: '上月故障最多的设备，它的保养记录怎么样？', level: 'L4' },
  // L5
  { query: '上月各设备的故障趋势和备件消耗', level: 'L5' },
  { query: '近30天巡检异常最多的设备', level: 'L5' },
]

// Mock data（和冷启动一致）
const mockData: Record<string, unknown> = {
  get_dashboard_summary: { totalEquipment: 128, runningCount: 98, faultCount: 8, pendingOrders: 5, pendingMaintenance: 12, pendingFaults: 3 },
  query_equipment: { total: 128, items: [{ equipmentId: 101, name: 'CNC-001', status: 1, productionLine: 'A线' }] },
  get_equipment_detail: { equipmentId: 101, name: 'CNC-001', kpi: { faultCount: 3, maintenanceRate: 92.5 } },
  get_equipment_status_distribution: { distribution: [{ status: '运行中', count: 98 }], total: 128 },
  query_fault_reports: { total: 15, items: [{ faultReportId: 301, equipmentName: 'CNC-001', faultType: '机械故障' }] },
  query_repair_orders: { total: 12, items: [{ repairOrderId: 201, equipmentName: 'CNC-001', status: '已关闭' }] },
  get_repair_detail: { repairOrder: { repairOrderId: 201 }, sparesUsed: [{ spareName: '主轴轴承', quantity: 2 }] },
  get_fault_trend: { days: 30, totalFaults: 23, avgPerDay: 0.77, trend: [] },
  query_maintenance_tasks: { total: 8, items: [{ taskId: 501, equipmentName: 'CNC-001', status: '已完成' }] },
  get_maintenance_detail: { task: { taskId: 501 }, executionRecords: [] },
  query_patrol_tasks: { total: 20, items: [] },
  get_patrol_analytics: { completionRate: 94.5, anomalyRate: 3.2, totalTasks: 180 },
  query_anomaly_records: { total: 6, items: [{ anomalyId: 801, equipmentName: 'CNC-001' }] },
  get_anomaly_statistics: { totalCount: 45, pendingCount: 8, processRate: 82.2 },
  query_spare_parts: { total: 350, items: [{ spareId: 401, name: '主轴轴承' }] },
  get_spare_stock: { items: [{ spareId: 401, spareName: '主轴轴承', quantity: 15, safetyStock: 10 }] },
  get_equipment_spare_bom: { items: [{ equipmentName: 'CNC-001', spareName: '主轴轴承', quantity: 2 }] },
  query_spare_transactions: { total: 25, items: [] },
  get_spare_alerts: { alertCount: 3, items: [{ spareName: '传动带', currentStock: 2, safetyStock: 10 }] },
  get_governance_dashboard: { healthScore: 87.5, dataQualityScore: 92.1 },
  get_todo_list: { pendingFaults: [{ title: '变频器报警' }], pendingOrders: [{ title: '导轨润滑' }], pendingMaintenance: [] },
  get_equipment_lifecycle: { events: [] },
}

interface BenchmarkResult {
  query: string
  level: string
  success: boolean
  answer: string
  rounds: number
  latencyMs: number
  confidence: string
  hasSources: boolean
  hasTrace: boolean
  error?: string
}

async function main() {
  console.log('=== Insight68 Benchmark ===')
  console.log(`测试集: ${BENCHMARK_QUERIES.length} 题, 并发: ${CONCURRENCY}`)

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

  async function runOne(item: { query: string; level: string }) {
    const start = Date.now()
    try {
      const result = await processQuery(item.query, { registry, llm, storage, callTool: mockCallTool })
      const latencyMs = Date.now() - start
      done++
      const r: BenchmarkResult = {
        query: item.query, level: item.level, success: true,
        answer: result.answer.slice(0, 50),
        rounds: result.trace?.rounds.length ?? 0,
        latencyMs, confidence: result.confidence,
        hasSources: (result.sources?.length ?? 0) > 0,
        hasTrace: !!result.trace,
      }
      results.push(r)
      console.log(`[${done}/${BENCHMARK_QUERIES.length}] ✅ ${item.level} ${item.query.slice(0, 25)}... ${latencyMs}ms ${r.rounds}轮`)
    } catch (err) {
      const latencyMs = Date.now() - start
      done++
      results.push({
        query: item.query, level: item.level, success: false,
        answer: '', rounds: 0, latencyMs, confidence: 'low',
        hasSources: false, hasTrace: false, error: (err as Error).message.slice(0, 50),
      })
      console.log(`[${done}/${BENCHMARK_QUERIES.length}] ❌ ${item.level} ${item.query.slice(0, 25)}... ${latencyMs}ms`)
    }
  }

  // 并发批跑
  for (let i = 0; i < BENCHMARK_QUERIES.length; i += CONCURRENCY) {
    const batch = BENCHMARK_QUERIES.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(q => runOne(q)))
  }

  // 统计
  console.log('\n' + '='.repeat(60))
  console.log('=== 统计结果 ===\n')

  const successful = results.filter(r => r.success)
  const byLevel = new Map<string, BenchmarkResult[]>()
  for (const r of results) {
    if (!byLevel.has(r.level)) byLevel.set(r.level, [])
    byLevel.get(r.level)!.push(r)
  }

  console.log(`总计: ${results.length} 题, ${successful.length} 成功, ${results.length - successful.length} 失败`)
  console.log(`成功率: ${(successful.length / results.length * 100).toFixed(1)}%`)
  console.log()

  // 按等级统计
  for (const [level, items] of [...byLevel.entries()].sort()) {
    const succ = items.filter(r => r.success)
    const avgLatency = succ.length ? Math.round(succ.reduce((s, r) => s + r.latencyMs, 0) / succ.length) : 0
    const avgRounds = succ.length ? (succ.reduce((s, r) => s + r.rounds, 0) / succ.length).toFixed(1) : '0'
    console.log(`${level}: ${succ.length}/${items.length} 成功, 平均 ${avgLatency}ms, 平均 ${avgRounds} 轮`)
  }

  // 置信度分布
  console.log()
  const confDist = { high: 0, medium: 0, low: 0 }
  for (const r of successful) confDist[r.confidence as keyof typeof confDist]++
  console.log(`置信度分布: high=${confDist.high} medium=${confDist.medium} low=${confDist.low}`)

  // Sources 覆盖率
  const withSources = successful.filter(r => r.hasSources).length
  console.log(`Sources 覆盖率: ${withSources}/${successful.length} (${(withSources / successful.length * 100).toFixed(1)}%)`)

  // Trace 覆盖率
  const withTrace = successful.filter(r => r.hasTrace).length
  console.log(`Trace 覆盖率: ${withTrace}/${successful.length} (${(withTrace / successful.length * 100).toFixed(1)}%)`)

  // 延迟目标检查
  console.log()
  const latencies = successful.map(r => r.latencyMs).sort((a, b) => a - b)
  const p50 = latencies[Math.floor(latencies.length * 0.5)]
  const p95 = latencies[Math.floor(latencies.length * 0.95)]
  console.log(`延迟 P50: ${p50}ms, P95: ${p95}ms`)

  storage.close()
  console.log('\n=== Benchmark 完成 ===')
}

main().catch(console.error)
