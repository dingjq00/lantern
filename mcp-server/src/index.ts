// EAM MCP Server 入口
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerEquipmentHandlers } from './handlers/equipment.js'
import { registerFaultRepairHandlers } from './handlers/fault-repair.js'
import { registerMaintenanceHandlers } from './handlers/maintenance.js'
import { registerPatrolHandlers } from './handlers/patrol.js'
import { registerSpareHandlers } from './handlers/spare.js'
import { registerDashboardHandlers } from './handlers/dashboard.js'

const server = new McpServer({
  name: 'eam-mcp-server',
  version: '0.1.0',
})

// 注册 6 个域的 handlers（22 个工具）
registerEquipmentHandlers(server)
registerFaultRepairHandlers(server)
registerMaintenanceHandlers(server)
registerPatrolHandlers(server)
registerSpareHandlers(server)
registerDashboardHandlers(server)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('EAM MCP Server running on stdio (22 tools registered)')
}

main().catch(console.error)
