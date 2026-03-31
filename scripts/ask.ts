// 快速提问工具 — 模拟真实用户提问，看系统完整响应
// 用法: npx tsx scripts/ask.ts "你的问题"

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

async function main() {
  const query = process.argv.slice(2).join(' ')
  if (!query) {
    console.log('用法: npx tsx scripts/ask.ts "你的问题"')
    process.exit(1)
  }

  const skillsDir = path.join(__dirname, '../skills')
  const registry = new ToolRegistry(loadTools(skillsDir))
  const storage = new SQLiteStorage('./data/insight68.db')
  storage.initialize()

  const llm = new CodexProxyProvider(
    process.env.LLM_BASE_URL || 'https://gptapi.tutu02.us.ci/v1',
    process.env.LLM_API_KEY || 'sk-mes-ai-explorer-2026',
    process.env.LLM_MODEL || 'deepseek-chat',
  )

  const mcpClient = new MCPClient('npx', ['tsx', path.join(__dirname, '../mcp-server/src/index.ts')])
  await mcpClient.connect()

  const callTool = async (name: string, args: Record<string, unknown>) => {
    return mcpClient.callTool(name, args)
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`问: ${query}`)
  console.log(`${'─'.repeat(60)}\n`)

  const start = Date.now()
  const result = await processQuery(query, { registry, llm, storage, callTool })
  const ms = Date.now() - start

  const tools = result.trace?.rounds.flatMap((r: any) => r.calls.map((c: any) => c.tool)) ?? []
  console.log(`工具: ${[...new Set(tools)].join(' → ') || '无'}`)
  console.log(`轮次: ${result.trace?.rounds.length ?? 0}  耗时: ${(ms / 1000).toFixed(1)}s`)
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`\n${result.answer}\n`)

  if (result.followUp?.length) {
    console.log('后续探索:')
    result.followUp.forEach((f: string, i: number) => console.log(`  ${i + 1}. ${f}`))
  }

  console.log(`\n${'─'.repeat(60)}`)
  await mcpClient.close()
  storage.close()
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
