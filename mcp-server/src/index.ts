// EAM MCP Server 入口 — 12 工具三层结构
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerEquipmentProfile } from './handlers/equipment-profile.js'

const server = new McpServer({
  name: 'eam-mcp-server',
  version: '2.0.0',
})

// Tier 1: 实体全景
registerEquipmentProfile(server)

// TODO: Tier 1 剩余
// registerRepairProfile(server)
// registerScopeOverview(server)

// TODO: Tier 2 条件搜索 (7)
// TODO: Tier 3 全局分析 (2)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`EAM MCP Server v2 running on stdio (tools registered)`)
}

main().catch(console.error)
