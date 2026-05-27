// mes.dashboard — MES 生产+仓库全景概览
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { mesClient } from '../../jmix-api.js'
import { textResult } from '../../shared.js'

export function registerMesDashboard(server: McpServer) {
  server.tool(
    'mes.dashboard',
    'MES 全厂仓库+主数据+产线名录概览。返回库存单类型分布、物料/批次/子批次总量、产线列表；工单状态计数仅为全厂参考、无过滤维度。问工单数量/执行中/积压/跨系统对应工单必须用 mes.order.search。',
    {},
    async () => {
      // 并行拉取各维度
      const orderStatuses = ['INIT', 'CONFIRMED', 'RUNNING', 'FINISHED', 'CLOSED', 'CANCELED', 'ABORTED']
      const inventoryTypes = [
        'WAREHOUSE_OPERATION', 'BATCH_INSPECTION', 'PRODUCTION_TO_WAREHOUSE_ORDER',
        'PRODUCTION_ORDER_EXECUTION', 'PURCHASE_ORDER', 'WAREHOUSE_TO_PRODUCTION_ORDER',
        'SPORADIC_ORDER',
      ]

      const [
        productionLines,
        materials,
        lots,
        sublots,
        inventoryOrders,
        ...statusAndTypeResults
      ] = await Promise.all([
        mesClient.list('ProductionLine', { limit: 50, fetchPlan: '_local' }),
        mesClient.list('Material', { limit: 1, returnCount: true }),
        mesClient.list('Lot', { limit: 1, returnCount: true }),
        mesClient.list('Sublot', { limit: 1, returnCount: true }),
        mesClient.list('InventoryOrder', { limit: 1, returnCount: true }),
        // 工单状态计数
        ...orderStatuses.map(s =>
          mesClient.count('ProductionOrder', { conditions: [{ property: 'status', operator: '=', value: s }] })
        ),
        // 库存单类型计数
        ...inventoryTypes.map(t =>
          mesClient.count('InventoryOrder', { conditions: [{ property: 'orderType', operator: '=', value: t }] })
        ),
      ])

      const orderStatusCounts: Record<string, number> = {}
      orderStatuses.forEach((s, i) => {
        const cnt = statusAndTypeResults[i] as number
        if (cnt > 0) orderStatusCounts[s] = cnt
      })

      const inventoryTypeCounts: Record<string, number> = {}
      inventoryTypes.forEach((t, i) => {
        const cnt = statusAndTypeResults[orderStatuses.length + i] as number
        if (cnt > 0) inventoryTypeCounts[t] = cnt
      })

      const orderTotal = Object.values(orderStatusCounts).reduce((a, b) => a + b, 0)

      return textResult({
        production: {
          orders: { total: orderTotal, byStatus: orderStatusCounts },
          lines: productionLines.items.map(l => ({
            code: l.lineCode, name: l.lineName,
          })),
        },
        warehouse: {
          inventoryOrders: {
            total: inventoryOrders.count ?? 0,
            byType: inventoryTypeCounts,
          },
        },
        masterData: {
          materials: materials.count ?? 0,
          lots: lots.count ?? 0,
          sublots: sublots.count ?? 0,
        },
      })
    }
  )
}
