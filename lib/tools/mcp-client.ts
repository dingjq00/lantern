// MCP Client 封装 — 通过 stdio 调用 MCP Server
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { ToolResult } from '@/lib/types'

export class MCPClient {
  private client: Client
  private transport: StdioClientTransport
  private connected = false

  constructor(serverCommand: string, serverArgs: string[] = []) {
    this.transport = new StdioClientTransport({
      command: serverCommand,
      args: serverArgs,
    })
    this.client = new Client({ name: 'insight68-platform', version: '1.0.0' })
  }

  async connect(): Promise<void> {
    if (this.connected) return
    await this.client.connect(this.transport)
    this.connected = true
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    if (!this.connected) await this.connect()

    const result = await this.client.callTool({ name, arguments: args })

    // MCP SDK 返回 content 数组，取第一个 text content
    const textContent = (result.content as Array<{ type: string; text?: string }>)
      ?.find(c => c.type === 'text')

    if (!textContent?.text) {
      return { data: null, status: 'error', errorLevel: 2 }
    }

    try {
      const data = JSON.parse(textContent.text)
      return { data, status: 'success' }
    } catch {
      return { data: textContent.text, status: 'partial' }
    }
  }

  async close(): Promise<void> {
    if (this.connected) {
      await this.client.close()
      this.connected = false
    }
  }
}
