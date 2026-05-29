// MCP Server 入口 — EAM 12 + EDHR 7 + MES 10 + JSY 4 + Cross 1（实际注册数受 ENABLED_SYSTEMS 过滤）
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

// === JSY 南厂酿酒车间 工具 (P0: 4，规划 ~19，详见 docs/jsy-tool-plan.md) ===
import { registerJsyPitLifecycle } from './handlers/jsy/pit-lifecycle.js'
import { registerJsyFermentRoomProfile } from './handlers/jsy/ferment-room-profile.js'
import { registerJsyFermentOrderSearch } from './handlers/jsy/ferment-order-search.js'
import { registerJsyHutInventorySearch } from './handlers/jsy/hut-inventory-search.js'

// === EDHR 工具 (7) ===
import { registerEdhrDashboard } from './handlers/edhr/dashboard.js'
import { registerEdhrOrderProfile } from './handlers/edhr/order-profile.js'
import { registerEdhrOrderSearch } from './handlers/edhr/order-search.js'
import { registerEdhrItemSearch } from './handlers/edhr/item-search.js'
import { registerEdhrExceptionSearch } from './handlers/edhr/exception-search.js'
import { registerEdhrProductSearch } from './handlers/edhr/product-search.js'
import { registerEdhrTrend } from './handlers/edhr/trend.js'

// === MES 工具 (4) ===
import { registerMesDashboard } from './handlers/mes/dashboard.js'
import { registerMesOrderSearch } from './handlers/mes/order-search.js'
import { registerMesOrderProfile } from './handlers/mes/order-profile.js'
import { registerMesInventorySearch } from './handlers/mes/inventory-search.js'
import { registerMesLotSearch } from './handlers/mes/lot-search.js'
import { registerMesMaterialSearch } from './handlers/mes/material-search.js'
import { registerMesRecipeProfile } from './handlers/mes/recipe-profile.js'
import { registerMesSublotSearch } from './handlers/mes/sublot-search.js'
import { registerMesTrend } from './handlers/mes/trend.js'
import { registerMesLineOverview } from './handlers/mes/line-overview.js'

const server = new McpServer({
  name: 'insight68-mcp-server',
  version: '3.0.0',
})

// ============ 系统启用过滤 ============
// 由 ENABLED_SYSTEMS 环境变量控制（与 lantern 主进程同名 env，但独立读取）
//   ENABLED_SYSTEMS=jsy           → 只挂 JSY
//   ENABLED_SYSTEMS=eam,mes,jsy   → 挂三个
//   不设/为空                      → 全部启用（向后兼容）
const ENABLED = (process.env.ENABLED_SYSTEMS ?? '')
  .toLowerCase().split(',').map(s => s.trim()).filter(Boolean)
const isOn = (sys: string) => ENABLED.length === 0 || ENABLED.includes(sys)

if (isOn('eam')) {
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
}

if (isOn('edhr')) {
  registerEdhrDashboard(server)
  registerEdhrOrderProfile(server)
  registerEdhrOrderSearch(server)
  registerEdhrItemSearch(server)
  registerEdhrExceptionSearch(server)
  registerEdhrProductSearch(server)
  registerEdhrTrend(server)
}

if (isOn('mes')) {
  registerMesDashboard(server)
  registerMesOrderSearch(server)
  registerMesOrderProfile(server)
  registerMesInventorySearch(server)
  registerMesLotSearch(server)
  registerMesMaterialSearch(server)
  registerMesRecipeProfile(server)
  registerMesSublotSearch(server)
  registerMesTrend(server)
  registerMesLineOverview(server)
}

if (isOn('jsy')) {
  registerJsyPitLifecycle(server)
  registerJsyFermentRoomProfile(server)
  registerJsyFermentOrderSearch(server)
  registerJsyHutInventorySearch(server)
}

// 跨系统工具 — 总是注册（glossary 是 fallback 工具，不绑定单一系统）
registerGlossaryResolve(server)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  const parts = [
    isOn('eam') && 'EAM 12',
    isOn('edhr') && 'EDHR 7',
    isOn('mes') && 'MES 10',
    isOn('jsy') && 'JSY 4',
    'Cross 1',
  ].filter(Boolean) as string[]
  const total = (isOn('eam') ? 12 : 0) + (isOn('edhr') ? 7 : 0) + (isOn('mes') ? 10 : 0) + (isOn('jsy') ? 4 : 0) + 1
  const mode = ENABLED.length === 0 ? '全启用' : `ENABLED_SYSTEMS=${ENABLED.join(',')}`
  console.error(`Lantern 执灯系统 MCP Server v3 running on stdio (${total} tools: ${parts.join(' + ')} | ${mode})`)
}

main().catch(console.error)
