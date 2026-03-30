// 输出质量评估 — 用高级 AI 对 benchmark 结果逐题评估回答质量
// 用法: LLM_BASE_URL=xxx LLM_MODEL=xxx npx tsx scripts/quality-eval.ts [run-id]
// 默认评估最新一次 benchmark 运行

import fs from 'fs'
const envPath = '.env.local'
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^(\w+)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}

import OpenAI from 'openai'
import { SQLiteStorage } from '../lib/storage/sqlite'

const LLM_BASE_URL = process.env.LLM_BASE_URL || 'http://38.55.108.188:8317/v1'
const LLM_API_KEY = process.env.LLM_API_KEY || 'sk-mes-ai-explorer-2026'
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-chat'

const client = new OpenAI({ baseURL: LLM_BASE_URL, apiKey: LLM_API_KEY })

interface QualityScore {
  id: string
  query: string
  level: string
  recall: number
  // 质量评分
  completeness: number  // 1-5 回答完整性
  accuracy: number      // 1-5 数据准确性
  usability: number     // 1-5 可用性
  qualityAvg: number    // 三项平均
  issues: string        // 具体问题
  suggestion: string    // 改进建议
}

/** 生成数据摘要 — 让评估 AI 看到完整的统计信息，而不是截断的 JSON */
function summarizeData(data: unknown): string {
  if (!data || typeof data !== 'object') return JSON.stringify(data)

  // 多工具返回：data 是数组
  if (Array.isArray(data)) {
    return data.map((d, i) => `[工具${i}] ${summarizeSingleResult(d)}`).join('\n\n')
  }

  return summarizeSingleResult(data)
}

function summarizeSingleResult(d: unknown): string {
  if (!d || typeof d !== 'object') return String(d)
  const obj = d as Record<string, unknown>
  const parts: string[] = []

  // total / count
  if ('total' in obj) parts.push(`total: ${obj.total}`)
  if ('count' in obj) parts.push(`count: ${obj.count}`)
  if ('context' in obj) parts.push(`context: ${obj.context}`)

  // items 数组 — 统计分布而非截断
  if ('items' in obj && Array.isArray(obj.items)) {
    const items = obj.items as Record<string, unknown>[]
    parts.push(`items: ${items.length} 条`)
    if (items.length > 0) {
      // 提取所有字段名
      parts.push(`  字段: ${Object.keys(items[0]).join(', ')}`)
      // 对常见分类字段做分布统计
      const distFields = ['status', 'orderStatus', 'progressStatus', 'validatedStatus',
        'type', 'category', 'priority', 'severity', 'department', 'productionLine',
        'decisionType', 'resultStatus']
      for (const field of distFields) {
        if (field in items[0]) {
          const dist: Record<string, number> = {}
          for (const item of items) {
            const v = String(item[field] ?? 'null')
            dist[v] = (dist[v] || 0) + 1
          }
          parts.push(`  ${field} 分布: ${JSON.stringify(dist)}`)
        }
      }
      // 数值字段汇总（sum/min/max）
      const numFields = Object.keys(items[0]).filter(k => typeof items[0][k] === 'number')
      for (const field of numFields) {
        const vals = items.map(item => (item[field] as number) ?? 0)
        const sum = vals.reduce((a, b) => a + b, 0)
        const min = Math.min(...vals)
        const max = Math.max(...vals)
        parts.push(`  ${field}: sum=${sum} min=${min} max=${max}`)
      }
      // 小数据集（≤20条）列出全部，大数据集列前5+后2
      if (items.length <= 20) {
        parts.push(`  全部${items.length}条:`)
        for (let i = 0; i < items.length; i++) {
          parts.push(`    ${JSON.stringify(items[i])}`)
        }
      } else {
        parts.push(`  前5条样本:`)
        for (let i = 0; i < 5; i++) {
          parts.push(`    ${JSON.stringify(items[i])}`)
        }
        parts.push(`  ... (省略 ${items.length - 7} 条)`)
        parts.push(`  后2条:`)
        for (let i = items.length - 2; i < items.length; i++) {
          parts.push(`    ${JSON.stringify(items[i])}`)
        }
      }
    }
  }

  // groups 数组
  if ('groups' in obj && Array.isArray(obj.groups)) {
    const groups = obj.groups as Record<string, unknown>[]
    parts.push(`groups: ${groups.length} 组`)
    if (groups.length > 0) {
      for (const g of groups.slice(0, 10)) {
        parts.push(`  ${JSON.stringify(g)}`)
      }
      if (groups.length > 10) parts.push(`  ... (共${groups.length}组)`)
    }
  }

  // 其他顶层字段（非 items/groups/total/count/context）
  const skip = new Set(['items', 'groups', 'total', 'count', 'context'])
  for (const [k, v] of Object.entries(obj)) {
    if (skip.has(k)) continue
    const vs = JSON.stringify(v)
    parts.push(`${k}: ${vs.length > 300 ? vs.slice(0, 300) + '...' : vs}`)
  }

  return parts.join('\n')
}

async function evaluateAnswer(query: string, answer: string, data: unknown): Promise<{
  completeness: number; accuracy: number; usability: number; issues: string; suggestion: string
}> {
  const dataSummary = summarizeData(data)

  const response = await client.chat.completions.create({
    model: LLM_MODEL,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: `你是一个 AI 系统输出质量评估专家。评估 AI 对用户问题的回答质量。

评分维度（每项 1-5 分）：
- completeness（回答完整性）：是否完整回答了用户问题的所有部分。5=完美覆盖，1=完全没回答
- accuracy（数据准确性）：回答中的数据是否有依据、有没有编造。说"数据不足无法回答"比编造数据好。5=数据准确有依据，1=明显编造
- usability（可用性）：用户看了这个回答能不能做决策/获得价值。5=直接可用，1=毫无价值

注意：
- 你收到的是**完整数据摘要**（包含总数、分布统计、样本），不是截断数据。用这些统计核对 AI 的数字
- 如果回答说"无法统计""数据不完整"但实际数据确实不完整，accuracy 应该给高分（诚实）
- 如果回答有具体数字但和返回数据对不上，accuracy 应该给低分。注意区分"数字完全错误"(1-2分) 和"数字有小偏差但方向正确"(3-4分)
- 如果回答格式良好、有数据表格、有后续建议，usability 加分
- AI 基于数据做推理分析（如从状态分布算完成率）是正常行为，不算编造

返回 JSON：{"completeness":N,"accuracy":N,"usability":N,"issues":"具体问题","suggestion":"改进建议"}`
      },
      {
        role: 'user',
        content: `用户问题: ${query}\n\nAI 回答:\n${answer}\n\n返回数据摘要（完整统计，非截断）:\n${dataSummary}`
      }
    ],
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0]?.message?.content || '{}'
  try {
    // 提取 JSON（兼容 ```json 包裹）
    let s = content.trim()
    const fenceMatch = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
    if (fenceMatch) s = fenceMatch[1].trim()
    const jsonMatch = s.match(/(\{[\s\S]*\})/)
    if (jsonMatch) s = jsonMatch[1]
    const parsed = JSON.parse(s)
    return {
      completeness: parsed.completeness ?? 3,
      accuracy: parsed.accuracy ?? 3,
      usability: parsed.usability ?? 3,
      issues: parsed.issues ?? '',
      suggestion: parsed.suggestion ?? '',
    }
  } catch {
    return { completeness: 3, accuracy: 3, usability: 3, issues: '评估解析失败', suggestion: '' }
  }
}

async function main() {
  const storage = new SQLiteStorage('./data/insight68.db')
  storage.initialize()

  // 找最新的 benchmark run
  const runId = process.argv[2] || null
  const runs = (storage as any).db.prepare(
    runId
      ? 'SELECT run_id, results FROM benchmark_runs WHERE run_id = ?'
      : 'SELECT run_id, results FROM benchmark_runs ORDER BY timestamp DESC LIMIT 1'
  ).all(...(runId ? [runId] : []))

  if (runs.length === 0) {
    console.log('没有找到 benchmark 运行记录')
    return
  }

  const run = runs[0]
  console.log(`=== 输出质量评估 | 模型: ${LLM_MODEL} | Run: ${run.run_id} ===\n`)

  const results = JSON.parse(run.results)
  const scores: QualityScore[] = []

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (!r.success || !r.answer) {
      console.log(`[${i + 1}/${results.length}] ${r.id} ⏭️ 跳过（执行失败）`)
      continue
    }

    try {
      const score = await evaluateAnswer(r.query, r.answer, r.data)
      const avg = Math.round((score.completeness + score.accuracy + score.usability) / 3 * 10) / 10
      scores.push({
        id: r.id, query: r.query, level: r.level, recall: r.recall,
        completeness: score.completeness, accuracy: score.accuracy, usability: score.usability,
        qualityAvg: avg, issues: score.issues, suggestion: score.suggestion,
      })

      const emoji = avg >= 4 ? '🟢' : avg >= 3 ? '🟡' : '🔴'
      console.log(`[${i + 1}/${results.length}] ${r.id} ${r.level} ${emoji} ${avg} (完整${score.completeness} 准确${score.accuracy} 可用${score.usability}) ${r.query.slice(0, 25)}...`)
    } catch (err) {
      console.log(`[${i + 1}/${results.length}] ${r.id} ❌ 评估失败: ${(err as Error).message.slice(0, 50)}`)
    }
  }

  // 统计
  console.log('\n' + '='.repeat(60))
  const avgComplete = scores.reduce((s, q) => s + q.completeness, 0) / scores.length
  const avgAccuracy = scores.reduce((s, q) => s + q.accuracy, 0) / scores.length
  const avgUsability = scores.reduce((s, q) => s + q.usability, 0) / scores.length
  const avgOverall = scores.reduce((s, q) => s + q.qualityAvg, 0) / scores.length

  console.log(`\n质量评分统计 (${scores.length} 题):`)
  console.log(`  回答完整性: ${avgComplete.toFixed(1)} / 5`)
  console.log(`  数据准确性: ${avgAccuracy.toFixed(1)} / 5`)
  console.log(`  可用性:     ${avgUsability.toFixed(1)} / 5`)
  console.log(`  综合平均:   ${avgOverall.toFixed(1)} / 5`)

  // 问题题目
  const poor = scores.filter(s => s.qualityAvg < 3)
  if (poor.length > 0) {
    console.log(`\n--- 质量差的题 (< 3.0) ---`)
    for (const s of poor) {
      console.log(`${s.id} ${s.level}: 完整${s.completeness} 准确${s.accuracy} 可用${s.usability} = ${s.qualityAvg}`)
      console.log(`  问题: ${s.issues}`)
      console.log(`  建议: ${s.suggestion}`)
    }
  }

  // 输出 HTML 报告
  // 保存 JSON 供 dashboard 读取
  const jsonPath = 'data/quality-eval-latest.json'
  fs.writeFileSync(jsonPath, JSON.stringify({
    runId: run.run_id, model: LLM_MODEL, timestamp: new Date().toISOString(),
    stats: { avgComplete, avgAccuracy, avgUsability, avgOverall },
    scores,
  }, null, 2), 'utf-8')
  console.log(`\nJSON 数据: ${jsonPath}`)

  const htmlPath = 'data/quality-eval-report.html'
  const html = generateQualityReport(scores, run.run_id, { avgComplete, avgAccuracy, avgUsability, avgOverall })
  fs.writeFileSync(htmlPath, html, 'utf-8')
  console.log(`HTML 报告: ${htmlPath}`)
  console.log('=== 质量评估完成 ===')

  storage.close()
}

function generateQualityReport(
  scores: QualityScore[],
  runId: string,
  stats: { avgComplete: number; avgAccuracy: number; avgUsability: number; avgOverall: number }
): string {
  const rows = scores.map(s => {
    const color = s.qualityAvg >= 4 ? '#15803d' : s.qualityAvg >= 3 ? '#b45309' : '#b91c1c'
    return `<tr>
      <td>${s.id}</td><td>${s.level}</td>
      <td style="max-width:250px">${s.query}</td>
      <td style="text-align:center">${(s.recall * 100).toFixed(0)}%</td>
      <td style="text-align:center">${s.completeness}</td>
      <td style="text-align:center">${s.accuracy}</td>
      <td style="text-align:center">${s.usability}</td>
      <td style="text-align:center;color:${color};font-weight:700">${s.qualityAvg}</td>
      <td style="font-size:12px;max-width:200px">${s.issues}</td>
      <td style="font-size:12px;max-width:200px">${s.suggestion}</td>
    </tr>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><title>输出质量评估</title>
<style>
  body{font-family:system-ui;max-width:1400px;margin:0 auto;padding:24px;color:#111}
  h1{color:#1e3a5f;font-size:22px}
  .cards{display:flex;gap:16px;margin:16px 0}
  .card{background:#f8f9fa;border-radius:8px;padding:16px 20px;min-width:120px;text-align:center}
  .card .num{font-size:28px;font-weight:700}
  .card .label{font-size:12px;color:#666;margin-top:4px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{background:#1e3a5f;color:#fff;padding:8px 10px;text-align:left}
  td{padding:8px 10px;border-bottom:1px solid #eee;vertical-align:top}
  tr:hover{background:#f0f4ff}
</style></head><body>
<h1>输出质量评估报告</h1>
<p style="color:#666">Run: ${runId} | 模型: ${LLM_MODEL} | ${scores.length} 题</p>
<div class="cards">
  <div class="card"><div class="num" style="color:#2563eb">${stats.avgOverall.toFixed(1)}</div><div class="label">综合平均</div></div>
  <div class="card"><div class="num">${stats.avgComplete.toFixed(1)}</div><div class="label">完整性</div></div>
  <div class="card"><div class="num">${stats.avgAccuracy.toFixed(1)}</div><div class="label">准确性</div></div>
  <div class="card"><div class="num">${stats.avgUsability.toFixed(1)}</div><div class="label">可用性</div></div>
  <div class="card"><div class="num" style="color:#15803d">${scores.filter(s=>s.qualityAvg>=4).length}</div><div class="label">优秀(≥4)</div></div>
  <div class="card"><div class="num" style="color:#b91c1c">${scores.filter(s=>s.qualityAvg<3).length}</div><div class="label">差(<3)</div></div>
</div>
<table>
<thead><tr><th>ID</th><th>级</th><th>查询</th><th>Recall</th><th>完整</th><th>准确</th><th>可用</th><th>均分</th><th>问题</th><th>建议</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body></html>`
}

main().catch(console.error)
