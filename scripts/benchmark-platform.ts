// 平台级 Benchmark — 三层测试：系统路由 + 跨系统推理 + 单系统准确率
// 用法: npx tsx scripts/benchmark-platform.ts [--routing|--cross|--mes|--only P01,M03]
// 不替代原 benchmark.ts，两者互补：原文件测 EAM+EDHR 深度，本文件测平台宽度

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

import { PLATFORM_TEST_CASES, PLATFORM_TEST_STATS, type PlatformTestCase, type TestLevel } from '../data/platform-test-cases.js'

const CONCURRENCY = 3
const GLOBAL_FORBIDDEN = ['数据不足', '无法回答', '数据不完整', '暂无数据']

// ============ 运行模式解析 ============

const args = process.argv.slice(2)
const levelFilter = args.find(a => ['--routing', '--cross', '--mes'].includes(a))
const onlyArg = args.find(a => a.startsWith('--only'))
const onlyIds = onlyArg?.includes('=')
  ? onlyArg.split('=')[1].split(',')
  : args.indexOf('--only') >= 0 ? args[args.indexOf('--only') + 1]?.split(',') : undefined

function filterCases(): PlatformTestCase[] {
  if (onlyIds) return PLATFORM_TEST_CASES.filter(t => onlyIds.includes(t.id))
  if (levelFilter === '--routing') return PLATFORM_TEST_CASES.filter(t => t.level === 'routing')
  if (levelFilter === '--cross') return PLATFORM_TEST_CASES.filter(t => t.level === 'cross-system')
  if (levelFilter === '--mes') return PLATFORM_TEST_CASES.filter(t => t.level === 'single-system')
  return PLATFORM_TEST_CASES
}

const ACTIVE_CASES = filterCases()

// ============ 评估逻辑 ============

interface PlatformResult {
  id: string; query: string; level: TestLevel; description: string
  success: boolean; latencyMs: number; rounds: number
  actualTools: string[]
  // 系统路由评估
  actualSystems: string[]           // 从 actualTools 提取的系统列表
  systemMatch: boolean              // L1: 系统选择是否正确
  // 工具路由评估
  toolRecall: number; toolPrecision: number; bestPath: string[]
  // 事实评估
  answer: string
  factScore: number
  forbiddenHit: string[]
  error?: string
}

/** 从工具名提取系统前缀 */
function extractSystems(tools: string[]): string[] {
  return [...new Set(tools.map(t => t.split('.')[0]))]
}

/** 检查系统路由是否命中 */
function checkSystemRouting(actualSystems: string[], acceptableSystems?: string[][]): boolean {
  if (!acceptableSystems || acceptableSystems.length === 0) return true
  const actualSet = new Set(actualSystems)
  return acceptableSystems.some(expected => {
    const expectedSet = new Set(expected)
    // 实际系统完全匹配或包含期望系统
    for (const sys of expectedSet) {
      if (!actualSet.has(sys)) return false
    }
    return true
  })
}

/** 工具路径匹配（复用原 benchmark 逻辑） */
function calcBestMatch(actual: string[], acceptablePaths: string[][]): { recall: number; precision: number; bestPath: string[] } {
  if (!acceptablePaths || acceptablePaths.length === 0) return { recall: 1, precision: 1, bestPath: [] }

  let bestRecall = 0, bestPrecision = 0, bestPath = acceptablePaths[0]
  for (const expected of acceptablePaths) {
    const expectedSet = new Set(expected)
    const actualSet = new Set(actual)
    let hits = 0
    for (const exp of expectedSet) { if (actualSet.has(exp)) hits++ }
    const recall = expectedSet.size > 0 ? hits / expectedSet.size : 1
    let precisionHits = 0
    for (const act of actualSet) { if (expectedSet.has(act)) precisionHits++ }
    const precision = actualSet.size > 0 ? precisionHits / actualSet.size : 0
    if (recall > bestRecall || (recall === bestRecall && precision > bestPrecision)) {
      bestRecall = recall; bestPrecision = precision; bestPath = expected
    }
  }
  return { recall: bestRecall, precision: bestPrecision, bestPath }
}

/** 事实检查 */
function checkFacts(answer: string, tc: PlatformTestCase): { score: number; forbiddenHit: string[] } {
  const must = tc.mustContain ?? []
  const extra = tc.forbidden ?? []
  const allForbidden = [...GLOBAL_FORBIDDEN, ...extra]
  const mustHit = must.filter(k => answer.includes(k)).length
  const forbiddenHit = allForbidden.filter(k => answer.includes(k))
  const mustScore = must.length > 0 ? mustHit / must.length : 1
  const penalty = Math.min(forbiddenHit.length * 0.3, 1)
  return { score: Math.max(0, mustScore * (1 - penalty)), forbiddenHit }
}

// ============ 主流程 ============

async function main() {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`=== Lantern 平台级 Benchmark v1 ===`)
  console.log(`测试集: ${ACTIVE_CASES.length}/${PLATFORM_TEST_STATS.total} 题`)
  console.log(`  路由消歧: ${PLATFORM_TEST_STATS.routing} | 跨系统: ${PLATFORM_TEST_STATS.crossSystem} | MES单系统: ${PLATFORM_TEST_STATS.singleSystem}`)
  console.log(`${'='.repeat(70)}\n`)

  const skillsDir = path.join(__dirname, '../skills')
  const registry = new ToolRegistry(loadTools(skillsDir))
  console.log(`加载了 ${registry.getAllTools().length} 个 Skill（含 MES ${registry.getAllTools().filter(t => t.name.startsWith('mes.')).length} 个）`)

  const storage = new SQLiteStorage('./data/insight68.db')
  storage.initialize()

  const mcpClient = new MCPClient('npx', ['tsx', path.join(__dirname, '../mcp-server/src/index.ts')])
  await mcpClient.connect()
  console.log('MCP Server 已连接\n')

  const callTool = async (name: string, args: Record<string, unknown>) => mcpClient.callTool(name, args)
  const llm = new CodexProxyProvider()
  const results: PlatformResult[] = []
  let done = 0

  async function runOne(tc: PlatformTestCase) {
    const start = Date.now()
    try {
      const result = await processQuery(tc.query, { registry, llm, storage, callTool })
      const latencyMs = Date.now() - start
      const actualTools = [...new Set(
        result.trace?.rounds.flatMap((r: any) => r.calls.map((c: any) => c.tool)) ?? []
      )]
      const actualSystems = extractSystems(actualTools)
      const systemMatch = checkSystemRouting(actualSystems, tc.acceptableSystems)
      const { recall, precision, bestPath } = calcBestMatch(actualTools, tc.acceptablePaths ?? [])
      const { score: factScore, forbiddenHit } = checkFacts(result.answer || '', tc)

      done++
      const r: PlatformResult = {
        id: tc.id, query: tc.query, level: tc.level, description: tc.description,
        success: true, latencyMs, rounds: result.trace?.rounds.length ?? 0,
        actualTools, actualSystems, systemMatch,
        toolRecall: recall, toolPrecision: precision, bestPath,
        answer: result.answer || '', factScore, forbiddenHit,
      }
      results.push(r)

      // 输出行
      const icon = tc.level === 'routing'
        ? (systemMatch ? '✅' : '❌')
        : (recall === 1 ? '✅' : `⚠️${(recall * 100).toFixed(0)}%`)
      console.log(`[${done}/${ACTIVE_CASES.length}] ${tc.id} ${icon} ${latencyMs}ms sys=[${actualSystems}] tools=[${actualTools.join(',')}] | ${tc.query.slice(0, 30)}`)
    } catch (err) {
      done++
      results.push({
        id: tc.id, query: tc.query, level: tc.level, description: tc.description,
        success: false, latencyMs: Date.now() - start, rounds: 0,
        actualTools: [], actualSystems: [], systemMatch: false,
        toolRecall: 0, toolPrecision: 0, bestPath: tc.acceptablePaths?.[0] ?? [],
        answer: '', factScore: 0, forbiddenHit: [],
        error: (err as Error).message.slice(0, 100),
      })
      console.log(`[${done}/${ACTIVE_CASES.length}] ${tc.id} ❌ ${(err as Error).message.slice(0, 50)}`)
    }
  }

  // 并发批跑
  for (let i = 0; i < ACTIVE_CASES.length; i += CONCURRENCY) {
    const batch = ACTIVE_CASES.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(runOne))
  }

  // ============ 统计报告 ============

  console.log(`\n${'='.repeat(70)}`)
  console.log(`=== 平台级统计报告 ===\n`)

  const successful = results.filter(r => r.success)

  // --- L1 系统路由准确率 ---
  const routingResults = results.filter(r => r.level === 'routing')
  const routingCorrect = routingResults.filter(r => r.systemMatch).length
  console.log(`【L1 系统路由】 ${routingCorrect}/${routingResults.length} (${routingResults.length ? ((routingCorrect / routingResults.length) * 100).toFixed(1) : 0}%)`)
  const routingFails = routingResults.filter(r => !r.systemMatch)
  if (routingFails.length > 0) {
    for (const r of routingFails) {
      console.log(`  ❌ ${r.id}: actual=[${r.actualSystems}] query="${r.query.slice(0, 40)}"`)
    }
  }

  // --- L2 跨系统推理 ---
  const crossResults = results.filter(r => r.level === 'cross-system')
  const crossRecall = crossResults.length ? crossResults.reduce((s, r) => s + r.toolRecall, 0) / crossResults.length : 0
  const crossPerfect = crossResults.filter(r => r.toolRecall === 1).length
  const crossMultiSys = crossResults.filter(r => r.actualSystems.length >= 2).length
  console.log(`\n【L2 跨系统推理】 recall=${(crossRecall * 100).toFixed(1)}% perfect=${crossPerfect}/${crossResults.length} 多系统调用=${crossMultiSys}/${crossResults.length}`)
  const crossFails = crossResults.filter(r => r.toolRecall < 1)
  if (crossFails.length > 0) {
    for (const r of crossFails) {
      console.log(`  ⚠️ ${r.id}: recall=${(r.toolRecall * 100).toFixed(0)}% actual=[${r.actualTools}] expected=[${r.bestPath}]`)
    }
  }

  // --- L3 MES 单系统准确率 ---
  const mesResults = results.filter(r => r.level === 'single-system')
  const mesRecall = mesResults.length ? mesResults.reduce((s, r) => s + r.toolRecall, 0) / mesResults.length : 0
  const mesPerfect = mesResults.filter(r => r.toolRecall === 1).length
  const mesFactScore = mesResults.filter(r => r.factScore > 0).length
    ? mesResults.reduce((s, r) => s + r.factScore, 0) / mesResults.length : 0
  console.log(`\n【L3 MES 单系统】 recall=${(mesRecall * 100).toFixed(1)}% perfect=${mesPerfect}/${mesResults.length} factScore=${(mesFactScore * 100).toFixed(1)}%`)
  const mesFails = mesResults.filter(r => r.toolRecall < 1)
  if (mesFails.length > 0) {
    for (const r of mesFails) {
      console.log(`  ⚠️ ${r.id}: recall=${(r.toolRecall * 100).toFixed(0)}% actual=[${r.actualTools}] expected=[${r.bestPath}]`)
    }
  }

  // --- 综合指标 ---
  const avgRecall = successful.length ? successful.reduce((s, r) => s + r.toolRecall, 0) / successful.length : 0
  const avgLatency = successful.length ? Math.round(successful.reduce((s, r) => s + r.latencyMs, 0) / successful.length) : 0
  const forbiddenCount = successful.filter(r => r.forbiddenHit.length > 0).length

  console.log(`\n【综合】`)
  console.log(`  总计: ${results.length} 题, ${successful.length} 成功, ${results.length - successful.length} 失败`)
  console.log(`  工具 Recall: ${(avgRecall * 100).toFixed(1)}%`)
  console.log(`  平均耗时: ${avgLatency}ms`)
  console.log(`  禁用词违规: ${forbiddenCount} 题`)

  console.log(`\n${'='.repeat(70)}`)

  // ============ 保存到数据库（Web UI 可查看） ============
  const runId = `platform-v1-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
  try {
    storage.saveBenchmarkRun({
      runId,
      timestamp: new Date().toISOString(),
      config: {
        model: 'deepseek-chat',
        maxChaseRounds: 2,
        promptVersion: 'platform-v1',
        notes: `平台级三层 Benchmark — L1路由${routingCorrect}/${routingResults.length} L2跨系统${crossPerfect}/${crossResults.length} L3单系统${mesPerfect}/${mesResults.length}`,
      },
      summary: {
        total: results.length, success: successful.length,
        recall: avgRecall, precision: 0,
        perfectCount: successful.filter(r => r.toolRecall === 1).length,
        factScore: mesFactScore,
        byLevel: {
          'L1-routing': { recall: routingCorrect / (routingResults.length || 1), perfect: routingCorrect, count: routingResults.length },
          'L2-cross': { recall: crossRecall, perfect: crossPerfect, count: crossResults.length },
          'L3-single': { recall: mesRecall, perfect: mesPerfect, count: mesResults.length },
        },
      },
      results: results.map(r => ({
        id: r.id, query: r.query, level: r.level, success: r.success,
        actualTools: r.actualTools, expectedTools: r.bestPath,
        recall: r.toolRecall, precision: r.toolPrecision,
        rounds: r.rounds, latencyMs: r.latencyMs,
        answer: r.answer,
        confidence: 'high', hasSources: false,
      })),
    } as any)
    console.log(`\n运行记录已保存: ${runId}`)
  } catch (e) { console.log(`保存失败: ${(e as Error).message}`) }

  await mcpClient.close()
  storage.close()
}

main().catch(console.error)
