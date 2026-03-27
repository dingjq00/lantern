// 冷启动脚本 — 批跑测试集 + 触发 verdict bootstrap
// 用法: npx tsx scripts/cold-start.ts
import { processQuery } from '../lib/brain/router'
import { ToolRegistry } from '../lib/tools/registry'
import { CodexProxyProvider } from '../lib/llm/codex-proxy'
import { SQLiteStorage } from '../lib/storage/sqlite'
import { loadTools } from '../lib/tools/yaml-loader'
import { maybeUpdateVerdict } from '../lib/brain/verdict'
import { mockCallTool } from './mock-data'
import path from 'path'

// 40 题测试集 + 部分同义改写（冷启动阈值 3）
const TEST_QUERIES = [
  // L1 — 单操作直查
  '现在系统里一共有多少台设备？',
  '系统有多少设备在运行？',
  '设备总数是多少？',
  '当前有几个待审核的故障报修？',
  '有多少待处理的报修单？',
  '设备 EQ-001 的详细信息是什么？',
  '各状态的设备分别有多少台？',
  '设备状态分布情况',
  '最近一个月故障趋势怎么样？',
  '上月故障趋势',
  '异常处理率是多少？',
  '有哪些备件库存不足？',
  '库存预警清单',
  '我今天有什么待办？',
  '我的待办事项',
  // L2 — 双操作关联
  '上个月有哪些电气故障报修？',
  '维修工单 WO-201 用了哪些备件？',
  '本周有哪些保养任务要做？',
  '本周巡检任务完成情况',
  'CNC-001 需要哪些备件？',
  // L3 — 链式多跳
  'A线上月的维修工单有哪些？',
  'A线的维修工单',
  'CNC-001 的备件库存够不够？',
  '上月维修工单中最常用的备件',
  // L4 — 跨域关联
  'CNC-001 上季度故障和保养的交叉分析',
  '哪些备件库存不足？会影响哪些设备？',
  '库存不足的备件影响哪些设备？',
  '上月故障最多的设备，它的保养记录怎么样？',
  // L5 — 聚合+时间推理
  '上月各设备的故障趋势和备件消耗',
  '近30天巡检异常最多的设备',
]

async function main() {
  console.log('=== Insight68 冷启动 ===')
  console.log(`测试集: ${TEST_QUERIES.length} 题`)

  const toolsDir = path.join(__dirname, '../tools')
  const tools = loadTools(toolsDir)
  const registry = new ToolRegistry(tools)
  const llm = new CodexProxyProvider()
  const storage = new SQLiteStorage('./data/insight68.db')
  storage.initialize()

  // 并发批跑（限制并发数，避免打爆 codex-proxy）
  const CONCURRENCY = 5
  let success = 0
  let failed = 0
  let done = 0
  const intentHashes = new Set<string>()

  async function runOne(query: string, idx: number) {
    try {
      const result = await processQuery(query, { registry, llm, storage, callTool: mockCallTool })
      if (result.trace?.intent?.intentHash) {
        intentHashes.add(result.trace.intent.intentHash)
      }
      success++
      done++
      console.log(`[${done}/${TEST_QUERIES.length}] ✅ ${query.slice(0, 30)}... (${result.trace?.rounds.length ?? '?'} 轮)`)
    } catch (err) {
      failed++
      done++
      console.log(`[${done}/${TEST_QUERIES.length}] ❌ ${query.slice(0, 30)}... ${(err as Error).message.slice(0, 40)}`)
    }
  }

  // 分批并发
  for (let i = 0; i < TEST_QUERIES.length; i += CONCURRENCY) {
    const batch = TEST_QUERIES.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map((q, j) => runOne(q, i + j)))
  }

  console.log(`\n批跑完成: ${success} 成功, ${failed} 失败`)
  console.log(`Distinct intent_hash: ${intentHashes.size}`)

  // 触发 verdict 计算（冷启动阈值 3）
  console.log('\n触发 verdict 计算...')
  let verdictCount = 0
  for (const hash of intentHashes) {
    await maybeUpdateVerdict(storage, 'default', hash, 3)
    const v = storage.getVerdict('default', hash)
    if (v) {
      verdictCount++
      console.log(`  verdict: ${hash.slice(0, 8)} → ${v.toolChain.join('→')} (score ${v.avgScore.toFixed(1)}, ${v.sampleCount} samples)`)
    }
  }
  console.log(`\nVerdict 生成: ${verdictCount}/${intentHashes.size}`)

  storage.close()
  console.log('\n=== 冷启动完成 ===')
}

main().catch(console.error)
