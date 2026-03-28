// Benchmark 脚本 — 40 题验收 + Ground Truth 准确率验证
// MCP v2: 12 Skill 工具 + 真实 EAM API
// 用法: npx tsx scripts/benchmark.ts ["备注"]

// 加载 .env.local（tsx 脚本不会自动加载 Next.js 环境变量）
import fs from 'fs'
const envPath = '.env.local'
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^(\w+)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}

import { processQuery } from '../lib/brain/router'
import { ToolRegistry } from '../lib/tools/registry'
import { CodexProxyProvider } from '../lib/llm/codex-proxy'
import { SQLiteStorage } from '../lib/storage/sqlite'
import { loadTools } from '../lib/tools/yaml-loader'
import { MCPClient } from '../lib/tools/mcp-client'
import path from 'path'

const CONCURRENCY = 5  // 降低并发，真实 API 别打太猛

// 40 题测试集 — Ground Truth v2: 可接受路径列表（多条合理路径取最高匹配）
// acceptablePaths[0] 是首选路径，其余是同样合理的替代路径
interface TestCase {
  id: string; query: string; level: string
  acceptablePaths: string[][]  // 多条合理路径
}
const TEST_CASES: TestCase[] = [
  // L1 — 简单查询
  { id: 'T01', query: '现在系统里一共有多少台设备？', level: 'L1', acceptablePaths: [['eam.dashboard']] },
  { id: 'T02', query: '当前有几个待审核的故障报修？', level: 'L1', acceptablePaths: [['eam.dashboard'], ['eam.fault.search']] },
  { id: 'T03', query: '设备 EQ-001 的详细信息是什么？', level: 'L1', acceptablePaths: [['eam.equipment.profile']] },
  { id: 'T04', query: '各状态的设备数量分布是怎样的？', level: 'L1', acceptablePaths: [['eam.dashboard'], ['eam.equipment.search']] },
  { id: 'T05', query: '最近 30 天的故障趋势怎么样？', level: 'L1', acceptablePaths: [['eam.trend']] },
  { id: 'T06', query: '巡检异常的整体统计指标是什么？', level: 'L1', acceptablePaths: [['eam.dashboard'], ['eam.anomaly.search'], ['eam.patrol.search']] },
  { id: 'T07', query: '当前有哪些库存预警？', level: 'L1', acceptablePaths: [['eam.spare.search'], ['eam.dashboard']] },
  { id: 'T08', query: '我有哪些待办事项？', level: 'L1', acceptablePaths: [['eam.dashboard']] },
  { id: 'T09', query: '维修工单目前各状态有多少个？', level: 'L1', acceptablePaths: [['eam.dashboard'], ['eam.repair.search']] },
  { id: 'T10', query: '设备分类中哪类设备最多？', level: 'L1', acceptablePaths: [['eam.equipment.search']] },
  // L2 — 单域带条件
  { id: 'T11', query: '上月故障最多的设备是哪台？', level: 'L2', acceptablePaths: [['eam.fault.search']] },
  { id: 'T12', query: '维修工单 WO-001 用了哪些备件？', level: 'L2', acceptablePaths: [['eam.repair.profile']] },
  { id: 'T13', query: '设备 EQ-002 的保养任务执行情况怎样？', level: 'L2', acceptablePaths: [['eam.equipment.profile'], ['eam.maintenance.search']] },
  { id: 'T14', query: '近 7 天完成了几个巡检任务？', level: 'L2', acceptablePaths: [['eam.patrol.search']] },
  { id: 'T15', query: '当前维修中的设备都是哪些？', level: 'L2', acceptablePaths: [['eam.equipment.search']] },
  { id: 'T16', query: '备件 SP-001 都用在哪些设备上？', level: 'L2', acceptablePaths: [['eam.spare.search']] },
  { id: 'T17', query: '设备 EQ-001 最近一次保养是什么时候？', level: 'L2', acceptablePaths: [['eam.equipment.profile'], ['eam.maintenance.search']] },
  { id: 'T18', query: '本月新增了多少故障报修？', level: 'L2', acceptablePaths: [['eam.fault.search']] },
  { id: 'T19', query: '设备 EQ-003 的全生命周期事件有哪些？', level: 'L2', acceptablePaths: [['eam.equipment.profile']] },
  { id: 'T20', query: '近 30 天巡检发现最多异常的设备是哪台？', level: 'L2', acceptablePaths: [['eam.anomaly.search'], ['eam.patrol.search']] },
  // L3 — 跨域/多步
  { id: 'T21', query: 'A 线上月维修用了哪些备件？', level: 'L3', acceptablePaths: [['eam.repair.search']] },
  { id: 'T22', query: '设备 EQ-003 的 BOM 里哪些备件库存不足？', level: 'L3', acceptablePaths: [['eam.spare.search'], ['eam.equipment.profile']] },
  { id: 'T23', query: '上月维修时参考了哪些知识文档？', level: 'L3', acceptablePaths: [['eam.repair.search']] },
  { id: 'T24', query: 'B 线上个月巡检发现了几次异常？', level: 'L3', acceptablePaths: [['eam.anomaly.search'], ['eam.patrol.search']] },
  { id: 'T25', query: '最近维修用量最大的备件，关联了哪些设备？', level: 'L3', acceptablePaths: [['eam.repair.search', 'eam.spare.search']] },
  { id: 'T26', query: 'A 线设备的保养计划执行率是多少？', level: 'L3', acceptablePaths: [['eam.maintenance.search'], ['eam.scope.overview']] },
  { id: 'T27', query: '维修工单 WO-005 的出库单涉及了哪些仓库？', level: 'L3', acceptablePaths: [['eam.repair.profile']] },
  { id: 'T28', query: '设备 EQ-001 最近一次故障的维修花了多少工时？', level: 'L3', acceptablePaths: [['eam.equipment.profile', 'eam.repair.profile'], ['eam.fault.search', 'eam.repair.profile']] },
  // L4 — 跨域分析
  { id: 'T29', query: '故障率最高的设备，保养是否按计划执行？', level: 'L4', acceptablePaths: [['eam.fault.search', 'eam.maintenance.search']] },
  { id: 'T30', query: '上月维修成本最高的设备，它的巡检有没有发现过异常？', level: 'L4', acceptablePaths: [['eam.repair.search', 'eam.anomaly.search'], ['eam.repair.search', 'eam.patrol.search']] },
  { id: 'T31', query: '备件库存预警涉及的设备中，有哪些正在维修？', level: 'L4', acceptablePaths: [['eam.spare.search', 'eam.equipment.search']] },
  { id: 'T32', query: 'A 线设备的故障、保养、巡检三项指标概览', level: 'L4', acceptablePaths: [['eam.scope.overview']] },
  { id: 'T33', query: '近 3 个月有故障但没安排保养的设备有哪些？', level: 'L4', acceptablePaths: [['eam.fault.search', 'eam.maintenance.search']] },
  { id: 'T34', query: '外协维修的设备中，有没有重点设备？', level: 'L4', acceptablePaths: [['eam.repair.search']] },
  // L5 — 趋势/分析
  { id: 'T35', query: '哪条产线近 3 个月故障呈上升趋势，且备件库存不足？', level: 'L5', acceptablePaths: [['eam.trend', 'eam.spare.search']] },
  { id: 'T36', query: '上季度各产线的保养完成率排名？', level: 'L5', acceptablePaths: [['eam.maintenance.search'], ['eam.scope.overview']] },
  { id: 'T37', query: '同比去年同期，今年 Q1 的故障报修数是增还是减？', level: 'L5', acceptablePaths: [['eam.fault.search'], ['eam.trend']] },
  { id: 'T38', query: '近半年维修频次最高的 3 台设备，各自的平均维修周期是多少？', level: 'L5', acceptablePaths: [['eam.repair.search']] },
  { id: 'T39', query: '备件月消耗量环比分析，哪些备件用量在持续上升？', level: 'L5', acceptablePaths: [['eam.trend'], ['eam.repair.search']] },
  { id: 'T40', query: '近 6 个月巡检异常率变化趋势，有没有季节性规律？', level: 'L5', acceptablePaths: [['eam.trend']] },
]

interface BenchmarkResult {
  id: string; query: string; level: string; success: boolean
  actualTools: string[]; expectedTools: string[]; recall: number; precision: number
  rounds: number; latencyMs: number; confidence: string; hasSources: boolean
  trace?: any; answer: string
  data?: Record<string, unknown>[]; display?: string; columns?: string[]
  followUp?: string[]; sources?: Array<{ tool: string; description: string }>
  lessonEval?: { quality: string; reason: string; lesson: string }
  error?: string
}

/**
 * 对比 actual 和多条 acceptablePaths，取最高 recall 的路径
 * 不再需要 EQUIVALENT_PATHS — 等效关系直接在 acceptablePaths 中定义
 */
function calcBestMatch(actual: string[], acceptablePaths: string[][]): { recall: number; precision: number; bestPath: string[] } {
  let bestRecall = 0, bestPrecision = 0, bestPath = acceptablePaths[0]

  for (const expected of acceptablePaths) {
    const expectedSet = new Set(expected)
    const actualSet = new Set(actual)

    // recall: 期望中被命中的比例
    let hits = 0
    for (const exp of expectedSet) {
      if (actualSet.has(exp)) hits++
    }
    const recall = expectedSet.size > 0 ? hits / expectedSet.size : 1

    // precision: 实际中命中期望的比例
    let precisionHits = 0
    for (const act of actualSet) {
      if (expectedSet.has(act)) precisionHits++
    }
    const precision = actualSet.size > 0 ? precisionHits / actualSet.size : 0

    if (recall > bestRecall || (recall === bestRecall && precision > bestPrecision)) {
      bestRecall = recall
      bestPrecision = precision
      bestPath = expected
    }
  }

  return { recall: bestRecall, precision: bestPrecision, bestPath }
}

async function main() {
  console.log('=== Insight68 Benchmark v2 (MCP 12 Tools + Real EAM API) ===')
  console.log(`测试集: ${TEST_CASES.length} 题, 并发: ${CONCURRENCY}\n`)

  // 加载 Skill YAML（从 skills/ 目录）
  const skillsDir = path.join(__dirname, '../skills')
  const registry = new ToolRegistry(loadTools(skillsDir))
  console.log(`加载了 ${registry.getAllTools().length} 个 Skill\n`)

  const llm = new CodexProxyProvider()
  const storage = new SQLiteStorage('./data/insight68.db')
  storage.initialize()

  // 连接真实 MCP Server
  const mcpClient = new MCPClient('npx', ['tsx', path.join(__dirname, '../mcp-server/src/index.ts')])
  await mcpClient.connect()
  console.log('MCP Server 已连接\n')

  const callTool = async (name: string, args: Record<string, unknown>) => {
    return mcpClient.callTool(name, args)
  }

  const results: BenchmarkResult[] = []
  let done = 0

  async function runOne(tc: typeof TEST_CASES[0]) {
    const start = Date.now()
    try {
      const result = await processQuery(tc.query, { registry, llm, storage, callTool })
      const latencyMs = Date.now() - start
      const actualTools = [...new Set(
        result.trace?.rounds.flatMap((r: any) => r.calls.map((c: any) => c.tool)) ?? []
      )]
      const { recall, precision, bestPath } = calcBestMatch(actualTools, tc.acceptablePaths)
      done++
      const r: BenchmarkResult = {
        id: tc.id, query: tc.query, level: tc.level, success: true,
        actualTools, expectedTools: bestPath, recall, precision,
        rounds: result.trace?.rounds.length ?? 0, latencyMs,
        confidence: result.confidence, hasSources: (result.sources?.length ?? 0) > 0,
        trace: result.trace, answer: result.answer,
        data: result.data, display: result.display, columns: result.columns,
        followUp: result.followUp, sources: result.sources,
        lessonEval: result.lessonEval,
      }
      results.push(r)
      const recallStr = recall === 1 ? '✅' : `⚠️${(recall * 100).toFixed(0)}%`
      console.log(`[${done}/${TEST_CASES.length}] ${tc.id} ${tc.level} ${recallStr} ${latencyMs}ms ${tc.query.slice(0, 25)}...`)
    } catch (err) {
      done++
      results.push({
        id: tc.id, query: tc.query, level: tc.level, success: false,
        actualTools: [], expectedTools: tc.acceptablePaths[0], recall: 0, precision: 0,
        rounds: 0, latencyMs: Date.now() - start, confidence: 'low', hasSources: false,
        answer: '', error: (err as Error).message.slice(0, 100),
      })
      console.log(`[${done}/${TEST_CASES.length}] ${tc.id} ${tc.level} ❌ ${(err as Error).message.slice(0, 50)}`)
    }
  }

  // 并发批跑
  for (let i = 0; i < TEST_CASES.length; i += CONCURRENCY) {
    const batch = TEST_CASES.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(tc => runOne(tc)))
  }

  // 关闭 MCP
  await mcpClient.close()

  // ======== 统计 ========
  console.log('\n' + '='.repeat(70))
  console.log('=== 准确率统计（MCP v2 Ground Truth 对比）===\n')

  const successful = results.filter(r => r.success)
  const avgRecall = successful.length ? successful.reduce((s, r) => s + r.recall, 0) / successful.length : 0
  const avgPrecision = successful.length ? successful.reduce((s, r) => s + r.precision, 0) / successful.length : 0
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
    console.log(`${level}: recall=${(lvlRecall * 100).toFixed(1)}% perfect=${lvlPerfect}/${items.length} avg=${avgLatency}ms`)
  }

  // 未完美召回
  const imperfect = successful.filter(r => r.recall < 1)
  if (imperfect.length > 0) {
    console.log('\n--- 未完美召回的题目 ---')
    for (const r of imperfect) {
      console.log(`${r.id} ${r.level}: recall=${(r.recall * 100).toFixed(0)}% actual=[${r.actualTools.join(', ')}] expected=[${r.expectedTools.join(', ')}]`)
    }
  }

  // 保存到 DB
  const runId = `run-v2-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
  try {
    storage.saveBenchmarkRun({
      runId,
      timestamp: new Date().toISOString(),
      config: {
        model: process.env.LLM_MODEL || 'gpt-5.4-mini',
        maxChaseRounds: 2,
        escalationModel: process.env.LLM_ESCALATION_MODEL || 'gpt-5.4',
        promptVersion: 'v3-skill-based',
        notes: process.argv[2] || 'MCP v2 首跑 — 12 Skill + 真实 EAM API',
      },
      summary: {
        total: results.length, success: successful.length,
        recall: avgRecall, precision: avgPrecision, perfectCount: perfectRecall,
        byLevel: Object.fromEntries([...byLevel.entries()].map(([level, items]) => {
          const succ = items.filter(r => r.success)
          return [level, {
            recall: succ.length ? succ.reduce((s, r) => s + r.recall, 0) / succ.length : 0,
            perfect: succ.filter(r => r.recall === 1).length,
            count: items.length,
          }]
        })),
      },
      results: results.map(r => ({ ...r })),
    } as any)
    console.log(`\n运行记录已保存: ${runId}`)
  } catch (e) { console.log(`保存失败: ${(e as Error).message}`) }

  storage.close()
  console.log('=== Benchmark v2 完成 ===')
}

main().catch(console.error)
