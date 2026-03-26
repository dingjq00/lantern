import { NextRequest, NextResponse } from 'next/server'
import { processQuery } from '@/lib/brain/router'
import { ToolRegistry } from '@/lib/tools/registry'
import { CodexProxyProvider } from '@/lib/llm/codex-proxy'
import { SQLiteStorage } from '@/lib/storage/sqlite'
import { MCPClient } from '@/lib/tools/mcp-client'
import { loadTools } from '@/lib/tools/yaml-loader'
import path from 'path'
import type { ToolResult } from '@/lib/types'

// 单例初始化
let registry: ToolRegistry | null = null
let llm: CodexProxyProvider | null = null
let mcpClient: MCPClient | null = null
let storage: SQLiteStorage | null = null

function getRegistry(): ToolRegistry {
  if (!registry) {
    const toolsDir = path.join(process.cwd(), process.env.TOOLS_DIR || './tools')
    registry = new ToolRegistry(loadTools(toolsDir))
  }
  return registry
}

function getLLM(): CodexProxyProvider {
  if (!llm) llm = new CodexProxyProvider()
  return llm
}

function getStorage(): SQLiteStorage {
  if (!storage) {
    storage = new SQLiteStorage()
    storage.initialize()
  }
  return storage
}

function getMCPClient(): MCPClient {
  if (!mcpClient) {
    mcpClient = new MCPClient('npx', ['tsx', path.join(process.cwd(), 'mcp-server/src/index.ts')])
  }
  return mcpClient
}

async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  return getMCPClient().callTool(name, args)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, history } = body as {
      query?: string
      history?: Array<{ role: string; content: string }>
    }

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: '请输入查询内容' }, { status: 400 })
    }

    const result = await processQuery(query.trim(), {
      registry: getRegistry(),
      llm: getLLM(),
      storage: getStorage(),
      callTool,
      history,
    })

    // 生产模式不返回 trace（减少响应体积）
    if (process.env.NODE_ENV === 'production') {
      delete result.trace
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: '处理查询时出错，请稍后重试' },
      { status: 500 },
    )
  }
}
