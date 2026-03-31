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

import { EDHR_TEST_CASES } from '../data/edhr-test-cases.js'

const CONCURRENCY = 5  // 降低并发，真实 API 别打太猛

// 所有题目通用的禁用词 — Summarize 层不允许出现的技术废话
const GLOBAL_FORBIDDEN = ['数据不足', '无法回答', '数据不完整', '暂无数据']

// 40 题测试集 — Ground Truth v3: 工具层 + 事实层 + followUp 层
// acceptablePaths[0] 是首选路径，其余是同样合理的替代路径
interface TestCase {
  id: string; query: string; level: string
  acceptablePaths: string[][]  // 多条合理路径
  // ---- v3 事实层断言（等参考答案产出后填入） ----
  mustContain?: string[]       // 答案必须包含的关键词/数字
  shouldContain?: string[]     // 最好包含（不扣分）
  forbidden?: string[]         // 除 GLOBAL_FORBIDDEN 外的额外禁用词
  // ---- v3 followUp 断言 ----
  followUp?: {
    minCount?: number          // 最少数量，默认 3
    shouldRelate?: string[]    // 后续建议应包含的域关键词
  }
}
const TEST_CASES: TestCase[] = [
  // L1 — 简单查询（基于青川制药 11887 条真实数据，mustContain 用稳定的编号/数字）
  { id: 'T01', query: '现在系统里一共有多少台设备？', level: 'L1', acceptablePaths: [['eam.dashboard']],
    mustContain: ['150'], shouldContain: ['运行中', '120'], followUp: { minCount: 3, shouldRelate: ['设备', '故障'] } },
  { id: 'T02', query: '当前有几个待审核的故障报修？', level: 'L1', acceptablePaths: [['eam.dashboard'], ['eam.fault.search']],
    mustContain: ['10'], followUp: { minCount: 3, shouldRelate: ['故障', '报修'] } },
  { id: 'T03', query: '设备 EQ-A301-001 的详细信息是什么？', level: 'L1', acceptablePaths: [['eam.equipment.profile']],
    mustContain: ['薄膜包衣机'], shouldContain: ['运行'], forbidden: ['查询失败', '未找到'] },
  { id: 'T04', query: '各状态的设备数量分布是怎样的？', level: 'L1', acceptablePaths: [['eam.dashboard'], ['eam.equipment.search']],
    mustContain: ['120'], shouldContain: ['运行中', '维修中'], followUp: { minCount: 3, shouldRelate: ['设备', '状态'] } },
  { id: 'T05', query: '最近 30 天的故障趋势怎么样？', level: 'L1', acceptablePaths: [['eam.trend']],
    shouldContain: ['故障', '趋势'], followUp: { minCount: 3, shouldRelate: ['故障', '趋势'] } },
  { id: 'T06', query: '巡检异常的整体统计指标是什么？', level: 'L1', acceptablePaths: [['eam.dashboard'], ['eam.anomaly.search'], ['eam.patrol.search']],
    shouldContain: ['异常', '巡检'] },
  { id: 'T07', query: '当前有哪些库存预警？', level: 'L1', acceptablePaths: [['eam.spare.search'], ['eam.dashboard']],
    mustContain: ['UV氘灯'], shouldContain: ['预警'] },
  { id: 'T08', query: '我有哪些待办事项？', level: 'L1', acceptablePaths: [['eam.dashboard']],
    shouldContain: ['待办', '待审核'] },
  { id: 'T09', query: '维修工单目前各状态有多少个？', level: 'L1', acceptablePaths: [['eam.dashboard'], ['eam.repair.search']],
    mustContain: ['160'], shouldContain: ['已完成', '80'] },
  { id: 'T10', query: '设备分类中哪类设备最多？', level: 'L1', acceptablePaths: [['eam.equipment.search']],
    shouldContain: ['150'] },
  // L2 — 单域带条件
  { id: 'T11', query: '上月故障最多的设备是哪台？', level: 'L2', acceptablePaths: [['eam.fault.search']] },
  { id: 'T12', query: '维修工单 RO-20260312-0157 用了哪些备件？', level: 'L2', acceptablePaths: [['eam.repair.profile']],
    mustContain: ['2'], shouldContain: ['1080'], forbidden: ['未找到'] },
  { id: 'T13', query: '设备 EQ-A202-002 的保养任务执行情况怎样？', level: 'L2', acceptablePaths: [['eam.equipment.profile'], ['eam.maintenance.search']],
    mustContain: ['旋转压片机'], shouldContain: ['EQ-A202-002'] },
  { id: 'T14', query: '近 7 天完成了几个巡检任务？', level: 'L2', acceptablePaths: [['eam.patrol.search']] },
  { id: 'T15', query: '当前维修中的设备都是哪些？', level: 'L2', acceptablePaths: [['eam.equipment.search']],
    mustContain: ['8'] },
  { id: 'T16', query: '备件 SP-GY-005 都用在哪些设备上？', level: 'L2', acceptablePaths: [['eam.spare.search']],
    mustContain: ['UV氘灯'] },
  { id: 'T17', query: '设备 EQ-A301-001 最近一次保养是什么时候？', level: 'L2', acceptablePaths: [['eam.equipment.profile'], ['eam.maintenance.search']],
    mustContain: ['EQ-A301-001'] },
  { id: 'T18', query: '本月新增了多少故障报修？', level: 'L2', acceptablePaths: [['eam.fault.search']],
    mustContain: ['34'] },
  { id: 'T19', query: '设备 EQ-A301-003 的全生命周期事件有哪些？', level: 'L2', acceptablePaths: [['eam.equipment.profile']],
    mustContain: ['EQ-A301-003'] },
  { id: 'T20', query: '近 30 天巡检发现最多异常的设备是哪台？', level: 'L2', acceptablePaths: [['eam.anomaly.search'], ['eam.patrol.search']],
    shouldContain: ['异常'] },
  // L3 — 跨域/多步
  { id: 'T21', query: '压片线上月维修用了哪些备件？', level: 'L3', acceptablePaths: [['eam.repair.search']],
    shouldContain: ['压片线', '备件'] },
  { id: 'T22', query: '设备 EQ-A301-003 的 BOM 里哪些备件库存不足？', level: 'L3', acceptablePaths: [['eam.spare.search'], ['eam.equipment.profile']],
    mustContain: ['EQ-A301-003'], shouldContain: ['BOM', '4'] },
  { id: 'T23', query: '上月维修时参考了哪些知识文档？', level: 'L3', acceptablePaths: [['eam.repair.search']] },
  { id: 'T24', query: '包衣线上个月巡检发现了几次异常？', level: 'L3', acceptablePaths: [['eam.anomaly.search'], ['eam.patrol.search']],
    shouldContain: ['包衣线'] },
  { id: 'T25', query: '最近维修用量最大的备件，关联了哪些设备？', level: 'L3', acceptablePaths: [['eam.repair.search', 'eam.spare.search']] },
  { id: 'T26', query: '压片线设备的保养计划执行率是多少？', level: 'L3', acceptablePaths: [['eam.maintenance.search'], ['eam.scope.overview']],
    mustContain: ['88%'], shouldContain: ['压片线'] },
  { id: 'T27', query: '维修工单 RO-20260313-0158 的出库单涉及了哪些仓库？', level: 'L3', acceptablePaths: [['eam.repair.profile']],
    forbidden: ['未找到'] },
  { id: 'T28', query: '设备 EQ-A301-001 最近一次故障的维修花了多少工时？', level: 'L3', acceptablePaths: [['eam.equipment.profile', 'eam.repair.profile'], ['eam.fault.search', 'eam.repair.profile'], ['eam.equipment.profile', 'eam.repair.search']],
    mustContain: ['EQ-A301-001'] },
  // L4 — 跨域分析
  { id: 'T29', query: '故障率最高的设备，保养是否按计划执行？', level: 'L4', acceptablePaths: [['eam.fault.search', 'eam.maintenance.search']],
    shouldContain: ['故障', '保养'] },
  { id: 'T30', query: '上月维修成本最高的设备，它的巡检有没有发现过异常？', level: 'L4', acceptablePaths: [['eam.repair.search', 'eam.anomaly.search'], ['eam.repair.search', 'eam.patrol.search'], ['eam.repair.search', 'eam.equipment.profile']],
    shouldContain: ['维修成本', '异常'] },
  { id: 'T31', query: '备件库存预警涉及的设备中，有哪些正在维修？', level: 'L4', acceptablePaths: [['eam.spare.search', 'eam.equipment.search'], ['eam.spare.search', 'eam.repair.search']],
    shouldContain: ['预警', '维修'] },
  { id: 'T32', query: '压片线设备的故障、保养、巡检三项指标概览', level: 'L4', acceptablePaths: [['eam.scope.overview']],
    mustContain: ['压片线'], shouldContain: ['故障', '保养', '16'] },
  { id: 'T33', query: '近 3 个月有故障但没安排保养的设备有哪些？', level: 'L4', acceptablePaths: [['eam.fault.search', 'eam.maintenance.search']],
    shouldContain: ['故障', '保养'] },
  { id: 'T34', query: '外协维修的设备中，有没有重点设备？', level: 'L4', acceptablePaths: [['eam.repair.search']] },
  // L5 — 趋势/分析
  { id: 'T35', query: '哪条产线近 3 个月故障呈上升趋势，且备件库存不足？', level: 'L5', acceptablePaths: [['eam.trend', 'eam.spare.search']] },
  { id: 'T36', query: '上季度各产线的保养完成率排名？', level: 'L5', acceptablePaths: [['eam.maintenance.search'], ['eam.scope.overview']] },
  { id: 'T37', query: '同比去年同期，今年 Q1 的故障报修数是增还是减？', level: 'L5', acceptablePaths: [['eam.fault.search'], ['eam.trend']] },
  { id: 'T38', query: '近半年维修频次最高的 3 台设备，各自的平均维修周期是多少？', level: 'L5', acceptablePaths: [['eam.repair.search']] },
  { id: 'T39', query: '备件月消耗量环比分析，哪些备件用量在持续上升？', level: 'L5', acceptablePaths: [['eam.trend'], ['eam.repair.search']] },
  { id: 'T40', query: '近 6 个月巡检异常率变化趋势，有没有季节性规律？', level: 'L5', acceptablePaths: [['eam.trend']] },
  // EDHR 35 题（自动合并）
  ...EDHR_TEST_CASES,
]

// 运行模式: --eam / --edhr / 默认全部
const runMode = process.argv.find(a => a.startsWith('--'))?.slice(2) || 'all'
const ACTIVE_CASES = runMode === 'eam' ? TEST_CASES.filter(t => t.id.startsWith('T'))
  : runMode === 'edhr' ? TEST_CASES.filter(t => t.id.startsWith('E'))
  : TEST_CASES

interface BenchmarkResult {
  id: string; query: string; level: string; success: boolean
  actualTools: string[]; expectedTools: string[]; recall: number; precision: number
  rounds: number; latencyMs: number; confidence: string; hasSources: boolean
  trace?: any; answer: string
  data?: Record<string, unknown>[]; display?: string; columns?: string[]
  followUp?: string[]; sources?: Array<{ tool: string; description: string }>
  error?: string
  // v3 三层评估
  factCheck?: {
    mustHit: number; mustTotal: number       // mustContain 命中
    shouldHit: number; shouldTotal: number   // shouldContain 命中
    forbiddenHit: string[]                   // 违规词列表
    score: number                            // 0-1 事实得分
  }
  followUpCheck?: {
    count: number                            // followUp 实际数量
    minRequired: number                      // 最低要求
    hasQuestionMark: boolean                 // 包含问号（不好）
    relatedHit: number; relatedTotal: number // 域关键词命中
    score: number                            // 0-1 followUp 得分
  }
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

/** 事实层断言检查 — answer 中是否包含关键数字/关键词 */
function checkFacts(answer: string, tc: TestCase): BenchmarkResult['factCheck'] {
  const must = tc.mustContain ?? []
  const should = tc.shouldContain ?? []
  const extra = tc.forbidden ?? []
  const allForbidden = [...GLOBAL_FORBIDDEN, ...extra]

  const mustHit = must.filter(k => answer.includes(k)).length
  const shouldHit = should.filter(k => answer.includes(k)).length
  const forbiddenHit = allForbidden.filter(k => answer.includes(k))

  // 得分: mustContain 命中率 * 禁用词惩罚
  const mustScore = must.length > 0 ? mustHit / must.length : 1
  const penalty = Math.min(forbiddenHit.length * 0.3, 1)  // 每个违规 -30%，上限扣完
  const score = Math.max(0, mustScore * (1 - penalty))

  return { mustHit, mustTotal: must.length, shouldHit, shouldTotal: should.length, forbiddenHit, score }
}

/** followUp 断言检查 — 数量、格式、域相关性 */
function checkFollowUp(followUp: string[] | undefined, tc: TestCase): BenchmarkResult['followUpCheck'] {
  const items = followUp ?? []
  const minRequired = tc.followUp?.minCount ?? 3
  const shouldRelate = tc.followUp?.shouldRelate ?? []

  const count = items.length
  const hasQuestionMark = items.some(f => f.includes('?') || f.includes('？'))

  // 域关键词：followUp 中至少一条包含该关键词即算命中
  const relatedHit = shouldRelate.filter(keyword =>
    items.some(f => f.includes(keyword))
  ).length

  // 得分: 数量达标(40%) + 无问号(20%) + 域相关(40%)
  const countScore = count >= minRequired ? 1 : count / minRequired
  const formatScore = hasQuestionMark ? 0 : 1
  const relatedScore = shouldRelate.length > 0 ? relatedHit / shouldRelate.length : 1
  const score = countScore * 0.4 + formatScore * 0.2 + relatedScore * 0.4

  return { count, minRequired, hasQuestionMark, relatedHit, relatedTotal: shouldRelate.length, score }
}

// 多模型配置 — 每次 benchmark 自动跑所有模型
interface ModelConfig {
  name: string; baseURL: string; apiKey: string; model: string
}

const BENCHMARK_MODELS: ModelConfig[] = [
  {
    name: 'DeepSeek',
    baseURL: process.env.LLM_BASE_URL || 'https://gptapi.tutu02.us.ci/v1',
    apiKey: process.env.LLM_API_KEY || 'sk-mes-ai-explorer-2026',
    model: 'deepseek-chat',
  },
  // GPT-4.1 暂时关闭 — GitHub Models API rate limit 太严，每次跑 30 分钟还跑不完
  // {
  //   name: 'GPT-4.1',
  //   baseURL: 'https://models.github.ai/inference',
  //   apiKey: process.env.GITHUB_MODELS_TOKEN || 'github_pat_...',
  //   model: 'openai/gpt-4.1',
  // },
]

async function runBenchmarkForModel(
  modelConfig: ModelConfig,
  registry: ToolRegistry,
  storage: SQLiteStorage,
  callTool: (name: string, args: Record<string, unknown>) => Promise<any>,
  notes: string,
) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`=== 模型: ${modelConfig.name} (${modelConfig.model}) ===`)
  console.log(`${'='.repeat(70)}\n`)

  const llm = new CodexProxyProvider(modelConfig.baseURL, modelConfig.apiKey, modelConfig.model)
  const results: BenchmarkResult[] = []
  let done = 0

  async function runOne(tc: typeof ACTIVE_CASES[0]) {
    const start = Date.now()
    try {
      const result = await processQuery(tc.query, { registry, llm, storage, callTool })
      const latencyMs = Date.now() - start
      const actualTools = [...new Set(
        result.trace?.rounds.flatMap((r: any) => r.calls.map((c: any) => c.tool)) ?? []
      )]
      const { recall, precision, bestPath } = calcBestMatch(actualTools, tc.acceptablePaths)
      // v3: 事实层 + followUp 断言检查
      const factCheck = checkFacts(result.answer || '', tc)
      const followUpCheck = checkFollowUp(result.followUp, tc)

      done++
      const r: BenchmarkResult = {
        id: tc.id, query: tc.query, level: tc.level, success: true,
        actualTools, expectedTools: bestPath, recall, precision,
        rounds: result.trace?.rounds.length ?? 0, latencyMs,
        confidence: result.confidence, hasSources: (result.sources?.length ?? 0) > 0,
        trace: result.trace, answer: result.answer,
        data: result.data, display: result.display, columns: result.columns,
        followUp: result.followUp, sources: result.sources,
        factCheck, followUpCheck,
      }
      results.push(r)
      const recallStr = recall === 1 ? '✅' : `⚠️${(recall * 100).toFixed(0)}%`
      const factStr = factCheck?.mustTotal ? ` F:${factCheck.mustHit}/${factCheck.mustTotal}` : ''
      const forbidStr = factCheck?.forbiddenHit?.length ? ` ⛔${factCheck.forbiddenHit.length}` : ''
      console.log(`[${done}/${ACTIVE_CASES.length}] ${tc.id} ${tc.level} ${recallStr}${factStr}${forbidStr} ${latencyMs}ms ${tc.query.slice(0, 25)}...`)
    } catch (err) {
      done++
      results.push({
        id: tc.id, query: tc.query, level: tc.level, success: false,
        actualTools: [], expectedTools: tc.acceptablePaths[0], recall: 0, precision: 0,
        rounds: 0, latencyMs: Date.now() - start, confidence: 'low', hasSources: false,
        answer: '', error: (err as Error).message.slice(0, 100),
      })
      console.log(`[${done}/${ACTIVE_CASES.length}] ${tc.id} ${tc.level} ❌ ${(err as Error).message.slice(0, 50)}`)
    }
  }

  // 并发批跑
  for (let i = 0; i < ACTIVE_CASES.length; i += CONCURRENCY) {
    const batch = ACTIVE_CASES.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(tc => runOne(tc)))
  }

  // ======== 统计 ========
  console.log('\n' + '='.repeat(70))
  console.log(`=== ${modelConfig.name} 准确率统计 ===\n`)

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

  // v3: 事实层 + followUp 统计
  const withFacts = successful.filter(r => r.factCheck && r.factCheck.mustTotal > 0)
  const avgFactScore = withFacts.length ? withFacts.reduce((s, r) => s + r.factCheck!.score, 0) / withFacts.length : 0
  const forbiddenViolations = successful.filter(r => r.factCheck && r.factCheck.forbiddenHit.length > 0)
  const withFollowUp = successful.filter(r => r.followUpCheck)
  const avgFollowUpScore = withFollowUp.length ? withFollowUp.reduce((s, r) => s + r.followUpCheck!.score, 0) / withFollowUp.length : 0

  console.log('\n--- 三层评估 (v3) ---')
  console.log(`① 工具层 Recall: ${(avgRecall * 100).toFixed(1)}% (${perfectRecall}/${successful.length} 完美)`)
  console.log(`② 事实层 FactScore: ${(avgFactScore * 100).toFixed(1)}% (${withFacts.length} 题有断言)`)
  console.log(`  禁用词违规: ${forbiddenViolations.length} 题`)
  if (forbiddenViolations.length > 0) {
    for (const r of forbiddenViolations) {
      console.log(`    ${r.id}: [${r.factCheck!.forbiddenHit.join(', ')}]`)
    }
  }
  console.log(`③ FollowUp: ${(avgFollowUpScore * 100).toFixed(1)}% (数量+格式+域相关性)`)

  // 未完美召回
  const imperfect = successful.filter(r => r.recall < 1)
  if (imperfect.length > 0) {
    console.log('\n--- 未完美召回的题目 ---')
    for (const r of imperfect) {
      console.log(`${r.id} ${r.level}: recall=${(r.recall * 100).toFixed(0)}% actual=[${r.actualTools.join(', ')}] expected=[${r.expectedTools.join(', ')}]`)
    }
  }

  // 事实层未通过的题目
  const factFails = withFacts.filter(r => r.factCheck!.score < 1)
  if (factFails.length > 0) {
    console.log('\n--- 事实断言未通过 ---')
    for (const r of factFails) {
      const fc = r.factCheck!
      console.log(`${r.id}: score=${(fc.score * 100).toFixed(0)}% must=${fc.mustHit}/${fc.mustTotal} forbidden=[${fc.forbiddenHit.join(',')}]`)
    }
  }

  // 保存到 DB
  const runId = `run-v3-${modelConfig.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
  try {
    storage.saveBenchmarkRun({
      runId,
      timestamp: new Date().toISOString(),
      config: {
        model: modelConfig.model,
        maxChaseRounds: 2,
        escalationModel: process.env.LLM_ESCALATION_MODEL || modelConfig.model,
        promptVersion: 'v3-multi-model',
        notes: notes || `${modelConfig.name} benchmark`,
      },
      summary: {
        total: results.length, success: successful.length,
        recall: avgRecall, precision: avgPrecision, perfectCount: perfectRecall,
        // v3 三层指标
        factScore: avgFactScore,
        factAsserted: withFacts.length,
        forbiddenViolations: forbiddenViolations.length,
        followUpScore: avgFollowUpScore,
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

  console.log(`=== ${modelConfig.name} 完成 ===\n`)
}

async function main() {
  const notes = process.argv[2] || 'multi-model benchmark'
  console.log(`=== Insight68 Benchmark v3 — 多模型 × 多系统 ===`)
  console.log(`运行模式: ${runMode} | 测试集: ${ACTIVE_CASES.length} 题, 模型: ${BENCHMARK_MODELS.map(m => m.name).join(' + ')}\n`)

  // 共享资源初始化
  const skillsDir = path.join(__dirname, '../skills')
  const registry = new ToolRegistry(loadTools(skillsDir))
  console.log(`加载了 ${registry.getAllTools().length} 个 Skill`)

  const storage = new SQLiteStorage('./data/insight68.db')
  storage.initialize()

  const mcpClient = new MCPClient('npx', ['tsx', path.join(__dirname, '../mcp-server/src/index.ts')])
  await mcpClient.connect()
  console.log('MCP Server 已连接')

  const callTool = async (name: string, args: Record<string, unknown>) => {
    return mcpClient.callTool(name, args)
  }

  // 逐模型跑（共享 MCP 和 storage，只换 LLM）
  for (const modelConfig of BENCHMARK_MODELS) {
    await runBenchmarkForModel(modelConfig, registry, storage, callTool, notes)
  }

  await mcpClient.close()
  storage.close()
  console.log('\n=== 全部模型完成 ===')
}

main().catch(console.error)
