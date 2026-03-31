// MCP Server 入口 — EAM 12 工具 + EDHR 7 工具
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

// === EAM 工具 (12) ===
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

// === 跨系统工具 ===
import { registerGlossaryResolve } from './handlers/glossary-resolve.js'

// === EDHR 工具 (7) ===
import { registerEdhrDashboard } from './handlers/edhr/dashboard.js'
import { registerEdhrOrderProfile } from './handlers/edhr/order-profile.js'
import { registerEdhrOrderSearch } from './handlers/edhr/order-search.js'
import { registerEdhrItemSearch } from './handlers/edhr/item-search.js'
import { registerEdhrExceptionSearch } from './handlers/edhr/exception-search.js'
import { registerEdhrProductSearch } from './handlers/edhr/product-search.js'
import { registerEdhrTrend } from './handlers/edhr/trend.js'

const server = new McpServer({
  name: 'insight68-mcp-server',
  version: '3.0.0',
})

// EAM: Tier 1 实体全景 (3)
registerEquipmentProfile(server)
registerRepairProfile(server)
registerScopeOverview(server)

// EAM: Tier 2 条件搜索 (7)
registerEquipmentSearch(server)
registerFaultSearch(server)
registerRepairSearch(server)
registerMaintenanceSearch(server)
registerPatrolSearch(server)
registerAnomalySearch(server)
registerSpareSearch(server)

// EAM: Tier 3 全局分析 (2)
registerDashboard(server)
registerTrend(server)

// EDHR: 全部 (7)
registerEdhrDashboard(server)
registerEdhrOrderProfile(server)
registerEdhrOrderSearch(server)
registerEdhrItemSearch(server)
registerEdhrExceptionSearch(server)
registerEdhrProductSearch(server)
registerEdhrTrend(server)

// 跨系统: 业务术语解析 (1)
registerGlossaryResolve(server)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`Insight68 MCP Server v3 running on stdio (${12 + 7 + 1} tools: EAM 12 + EDHR 7 + Cross 1)`)
}

main().catch(console.error)
