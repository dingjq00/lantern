// EAM MCP Server 入口 — 12 工具三层结构
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
// Tier 1: 实体全景
import { registerEquipmentProfile } from './handlers/equipment-profile.js'
import { registerRepairProfile } from './handlers/repair-profile.js'
import { registerScopeOverview } from './handlers/scope-overview.js'
// Tier 2: 条件搜索
import { registerEquipmentSearch } from './handlers/equipment-search.js'
import { registerFaultSearch } from './handlers/fault-search.js'
import { registerRepairSearch } from './handlers/repair-search.js'
import { registerMaintenanceSearch } from './handlers/maintenance-search.js'
import { registerPatrolSearch } from './handlers/patrol-search.js'
import { registerAnomalySearch } from './handlers/anomaly-search.js'
import { registerSpareSearch } from './handlers/spare-search.js'
// Tier 3: 全局分析
import { registerDashboard } from './handlers/dashboard.js'
import { registerTrend } from './handlers/trend.js'

const server = new McpServer({
  name: 'eam-mcp-server',
  version: '2.0.0',
})

// Tier 1: 实体全景 (3)
registerEquipmentProfile(server)
registerRepairProfile(server)
registerScopeOverview(server)

// Tier 2: 条件搜索 (7)
registerEquipmentSearch(server)
registerFaultSearch(server)
registerRepairSearch(server)
registerMaintenanceSearch(server)
registerPatrolSearch(server)
registerAnomalySearch(server)
registerSpareSearch(server)

// Tier 3: 全局分析 (2)
registerDashboard(server)
registerTrend(server)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('EAM MCP Server v2 running on stdio (12 tools registered)')
}

main().catch(console.error)
