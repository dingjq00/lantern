// Benchmark 脚本 — 40 题验收 + Ground Truth 准确率验证
// 用法: npx tsx scripts/benchmark.ts
import { processQuery } from '../lib/brain/router'
import { ToolRegistry } from '../lib/tools/registry'
import { CodexProxyProvider } from '../lib/llm/codex-proxy'
import { SQLiteStorage } from '../lib/storage/sqlite'
import { loadTools } from '../lib/tools/yaml-loader'
import { mockCallTool } from './mock-data'
import path from 'path'

const CONCURRENCY = 10

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
  trace?: any  // 完整 ExecutionTrace
  answer: string
  error?: string
}

// 等效路径：actual 中的工具可以替代 expected 中的哪些工具
// key = 实际选的工具, value = 它可以等效替代的工具集合
const EQUIVALENT_PATHS: Record<string, string[]> = {
  // query_fault_reports({status:0}) 等效于 get_dashboard_summary 查待审核报修数
  query_fault_reports: ['get_dashboard_summary'],
  // get_todo_list 的 pendingFaults 等效于 get_dashboard_summary 查待审核报修
  get_todo_list: ['get_dashboard_summary'],
  // query_repair_orders({status:X}) 等效于 get_dashboard_summary 查工单统计
  query_repair_orders: ['get_dashboard_summary'],
  // query_equipment 可以替代 get_equipment_detail（查列表再找某台）
  query_equipment: ['get_equipment_detail'],
  // get_equipment_detail 是 query_equipment 的细化
  get_equipment_detail: ['query_equipment'],
  // get_patrol_analytics 和 query_anomaly_records 在异常统计上有重叠
  get_patrol_analytics: ['get_anomaly_statistics'],
  // query_anomaly_records 可以做 get_anomaly_statistics 的工作
  query_anomaly_records: ['get_anomaly_statistics'],
  // get_equipment_lifecycle 包含维修/保养历史，可部分替代 query_maintenance_tasks
  get_equipment_lifecycle: ['query_maintenance_tasks'],
  // get_fault_trend 和 query_fault_reports 在故障统计上有重叠
  get_fault_trend: ['query_fault_reports'],
  // query_patrol_tasks 和 get_patrol_analytics 在巡检统计上有重叠
  query_patrol_tasks: ['get_patrol_analytics'],
}

function calcRecallPrecision(actual: string[], expected: string[]): { recall: number; precision: number } {
  if (expected.length === 0) return { recall: 1, precision: actual.length === 0 ? 1 : 0 }
  const actualSet = new Set(actual)
  const expectedSet = new Set(expected)

  // 精确匹配 + 等效路径匹配
  let hits = 0
  for (const exp of expectedSet) {
    if (actualSet.has(exp)) {
      hits++ // 精确命中
    } else {
      // 检查是否有等效工具被选中
      const isEquivalent = [...actualSet].some(act => EQUIVALENT_PATHS[act]?.includes(exp))
      if (isEquivalent) hits++
    }
  }

  // precision: 实际选的工具中，有多少命中期望或等效于期望
  let precisionHits = 0
  for (const act of actualSet) {
    if (expectedSet.has(act)) {
      precisionHits++
    } else {
      const isEquivalent = [...expectedSet].some(exp => EQUIVALENT_PATHS[act]?.includes(exp))
      if (isEquivalent) precisionHits++
    }
  }

  return {
    recall: hits / expectedSet.size,
    precision: actual.length > 0 ? precisionHits / actualSet.size : 0,
  }
}

async function main() {
  console.log('=== Insight68 Benchmark (with Ground Truth) ===')
  console.log(`测试集: ${TEST_CASES.length} 题, 并发: ${CONCURRENCY}\n`)

  const toolsDir = path.join(__dirname, '../tools')
  const registry = new ToolRegistry(loadTools(toolsDir))
  const llm = new CodexProxyProvider()
  // 用持久化 db，这样能读到冷启动的 verdict + 积累新的 session
  const storage = new SQLiteStorage('./data/insight68.db')
  storage.initialize()


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
        trace: result.trace, answer: result.answer,
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
        answer: '', error: (err as Error).message.slice(0, 50),
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

  // ======== HTML 报告 ========
  const reportPath = path.join(__dirname, '../data/benchmark-report.html')
  const fs = await import('fs')
  const reportDir = path.dirname(reportPath)
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true })

  const html = generateReport(results, { avgRecall, avgPrecision, perfectRecall, confDist, withSources })
  fs.writeFileSync(reportPath, html, 'utf-8')
  console.log(`\nHTML 报告已生成: ${reportPath}`)
  console.log('=== Benchmark 完成 ===')
}

function generateReport(
  results: BenchmarkResult[],
  stats: { avgRecall: number; avgPrecision: number; perfectRecall: number; confDist: Record<string, number>; withSources: number },
): string {
  const successful = results.filter(r => r.success)
  const levels = ['L1', 'L2', 'L3', 'L4', 'L5']

  function renderTrace(trace: any): string {
    if (!trace) return '<em>无 trace</em>'
    return trace.rounds.map((r: any) => `
      <div class="round">
        <div class="round-header">轮次 ${r.round} — ${r.round === 0 ? '首轮规划' : '追查轮 ' + r.round}</div>
        <div class="trace-item"><span class="icon">💭</span> <b>思考:</b> ${escHtml(r.thought)}</div>
        ${r.calls.map((c: any) => `
          <div class="trace-item">
            <span class="icon">🔧</span> <b>${escHtml(c.tool)}</b>
            <span class="args">(${escHtml(JSON.stringify(c.arguments))})</span>
            <span class="${c.status === 'success' ? 'ok' : 'fail'}">→ ${c.durationMs}ms ${c.status === 'success' ? '✅' : '❌'}</span>
            <details><summary>返回数据</summary><pre>${escHtml(JSON.stringify(c.result, null, 2))}</pre></details>
          </div>
        `).join('')}
        <div class="trace-item"><span class="icon">👁</span> <b>观察:</b> ${escHtml(r.observation)}</div>
      </div>
    `).join('')
  }

  function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  const rows = results.map(r => {
    const recallClass = r.recall === 1 ? 'pass' : r.recall >= 0.5 ? 'partial' : 'fail'
    const missing = r.expectedTools.filter(t => !r.actualTools.includes(t))
    const extra = r.actualTools.filter(t => !r.expectedTools.includes(t))
    return `
    <tr class="result-row ${recallClass}" data-level="${r.level}" data-status="${recallClass}">
      <td>${r.id}</td>
      <td>${r.level}</td>
      <td class="query">${escHtml(r.query)}</td>
      <td class="recall-cell">${(r.recall * 100).toFixed(0)}%</td>
      <td>${r.rounds}</td>
      <td>${r.latencyMs}ms</td>
      <td>
        <details>
          <summary>展开详情</summary>
          <div class="detail-box">
            <div><b>回答:</b> ${escHtml(r.answer.slice(0, 200))}</div>
            <div class="tools-compare">
              <div><b>期望工具:</b> ${r.expectedTools.map(t => `<span class="tool expected">${t}</span>`).join(' ')}</div>
              <div><b>实际工具:</b> ${r.actualTools.map(t => `<span class="tool ${r.expectedTools.includes(t) ? 'hit' : 'extra'}">${t}</span>`).join(' ') || '<em>无</em>'}</div>
              ${missing.length ? `<div class="miss"><b>漏选:</b> ${missing.map(t => `<span class="tool miss-tool">${t}</span>`).join(' ')}</div>` : ''}
              ${extra.length ? `<div class="extra-info"><b>多选:</b> ${extra.map(t => `<span class="tool extra-tool">${t}</span>`).join(' ')}</div>` : ''}
            </div>
            <div class="trace-section">
              <b>执行追踪:</b>
              ${renderTrace(r.trace)}
            </div>
            ${r.trace?.intent ? `<div><b>意图:</b> ${r.trace.intent.domains.join('/')} / ${r.trace.intent.operation} / [${r.trace.intent.filters.join(', ')}]</div>` : ''}
            <div><b>置信度:</b> ${r.confidence}</div>
          </div>
        </details>
      </td>
    </tr>`
  }).join('\n')

  const levelStats = levels.map(level => {
    const items = results.filter(r => r.level === level)
    const succ = items.filter(r => r.success)
    const lvlRecall = succ.length ? succ.reduce((s, r) => s + r.recall, 0) / succ.length : 0
    const perfect = succ.filter(r => r.recall === 1).length
    return `<tr><td>${level}</td><td>${(lvlRecall * 100).toFixed(1)}%</td><td>${perfect}/${items.length}</td><td>${items.length}</td></tr>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>Benchmark Report — Insight68</title>
<style>
  :root { --blue: #1F3864; --green: #22C55E; --amber: #F59E0B; --red: #EF4444; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 24px; color: #1a1a1a; font-size: 14px; }
  h1 { color: var(--blue); font-size: 24px; margin-bottom: 8px; }
  h2 { color: var(--blue); font-size: 18px; margin: 24px 0 12px; }
  .summary { display: flex; gap: 16px; flex-wrap: wrap; margin: 16px 0; }
  .stat-card { background: #f8f9fa; border-radius: 8px; padding: 16px 20px; min-width: 140px; }
  .stat-card .value { font-size: 28px; font-weight: 700; color: var(--blue); }
  .stat-card .label { font-size: 12px; color: #666; margin-top: 4px; }
  .filters { margin: 16px 0; display: flex; gap: 8px; flex-wrap: wrap; }
  .filters button { padding: 4px 12px; border: 1px solid #ddd; border-radius: 16px; background: #fff; cursor: pointer; font-size: 12px; }
  .filters button.active { background: var(--blue); color: #fff; border-color: var(--blue); }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: var(--blue); color: #fff; }
  th { padding: 8px 12px; text-align: left; font-size: 13px; }
  td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; vertical-align: top; }
  tbody tr:hover { background: #f0f4ff; }
  .pass .recall-cell { color: var(--green); font-weight: 600; }
  .partial .recall-cell { color: var(--amber); font-weight: 600; }
  .fail .recall-cell { color: var(--red); font-weight: 600; }
  .query { max-width: 280px; }
  details summary { cursor: pointer; color: var(--blue); font-size: 12px; }
  .detail-box { margin-top: 8px; padding: 12px; background: #f8f9fa; border-radius: 8px; font-size: 12px; line-height: 1.8; }
  .tool { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin: 2px; font-family: monospace; }
  .tool.expected { background: #e8eff8; color: var(--blue); }
  .tool.hit { background: #dcfce7; color: #166534; }
  .tool.extra { background: #fef3c7; color: #92400e; }
  .tool.miss-tool { background: #fee2e2; color: #991b1b; }
  .tool.extra-tool { background: #fef3c7; color: #92400e; }
  .round { border: 1px solid #e5e7eb; border-radius: 6px; margin: 8px 0; overflow: hidden; }
  .round-header { background: #f3f4f6; padding: 6px 10px; font-weight: 600; font-size: 12px; }
  .trace-item { padding: 4px 10px; font-size: 12px; }
  .trace-item .icon { margin-right: 4px; }
  .trace-item .args { color: #888; margin-left: 4px; font-size: 11px; }
  .trace-item .ok { color: var(--green); }
  .trace-item .fail { color: var(--red); }
  .trace-item pre { background: #1e1e1e; color: #d4d4d4; padding: 8px; border-radius: 4px; overflow-x: auto; font-size: 11px; max-height: 200px; }
  .miss { color: var(--red); }
  .level-table { margin: 12px 0; }
  .level-table td, .level-table th { padding: 6px 16px; }
</style>
</head>
<body>

<h1>Benchmark Report — Insight68 Platform</h1>
<p style="color:#666">生成时间: ${new Date().toLocaleString('zh-CN')} | ${results.length} 题 | Ground Truth 对比</p>

<div class="summary">
  <div class="stat-card"><div class="value">${(stats.avgRecall * 100).toFixed(1)}%</div><div class="label">平均 Recall</div></div>
  <div class="stat-card"><div class="value">${(stats.avgPrecision * 100).toFixed(1)}%</div><div class="label">平均 Precision</div></div>
  <div class="stat-card"><div class="value">${stats.perfectRecall}/${successful.length}</div><div class="label">完美召回</div></div>
  <div class="stat-card"><div class="value">${stats.withSources}/${successful.length}</div><div class="label">Sources 覆盖</div></div>
</div>

<h2>按等级统计</h2>
<table class="level-table">
  <thead><tr><th>等级</th><th>Recall</th><th>完美召回</th><th>题数</th></tr></thead>
  <tbody>${levelStats}</tbody>
</table>

<h2>详细结果</h2>

<div class="filters">
  <button class="active" onclick="filterAll()">全部</button>
  <button onclick="filterStatus('fail')">❌ 失败 (recall&lt;50%)</button>
  <button onclick="filterStatus('partial')">⚠️ 部分 (50-99%)</button>
  <button onclick="filterStatus('pass')">✅ 通过 (100%)</button>
  <button onclick="filterLevel('L1')">L1</button>
  <button onclick="filterLevel('L2')">L2</button>
  <button onclick="filterLevel('L3')">L3</button>
  <button onclick="filterLevel('L4')">L4</button>
  <button onclick="filterLevel('L5')">L5</button>
</div>

<table>
  <thead><tr><th>ID</th><th>等级</th><th>查询</th><th>Recall</th><th>轮次</th><th>延迟</th><th>详情</th></tr></thead>
  <tbody>${rows}</tbody>
</table>

<script>
function filterAll() {
  document.querySelectorAll('.result-row').forEach(r => r.style.display = '')
  setActive(0)
}
function filterStatus(s) {
  document.querySelectorAll('.result-row').forEach(r => {
    r.style.display = r.dataset.status === s ? '' : 'none'
  })
  setActive(s === 'fail' ? 1 : s === 'partial' ? 2 : 3)
}
function filterLevel(l) {
  document.querySelectorAll('.result-row').forEach(r => {
    r.style.display = r.dataset.level === l ? '' : 'none'
  })
  setActive({'L1':4,'L2':5,'L3':6,'L4':7,'L5':8}[l])
}
function setActive(idx) {
  document.querySelectorAll('.filters button').forEach((b,i) => b.classList.toggle('active', i === idx))
}
</script>

</body>
</html>`
}

main().catch(console.error)
