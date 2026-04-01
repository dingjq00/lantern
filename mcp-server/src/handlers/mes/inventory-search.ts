// mes.inventory.search — 库存单/仓库操作搜索
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { mesClient, jmixDate, type JmixCondition } from '../../jmix-api.js'
import { textResult } from '../../shared.js'

export function registerMesInventorySearch(server: McpServer) {
  server.tool(
    'mes.inventory.search',
    '按条件搜索库存单（入库/出库/领料/仓库操作等）。支持按单据类型、状态、供应商、日期范围过滤，可按类型/状态聚合。适用于"有多少出库单""采购入库情况""各类型库存单分布"等问题。',
    {
      orderType: z.string().optional().describe('单据类型: WAREHOUSE_OPERATION/BATCH_INSPECTION/PRODUCTION_TO_WAREHOUSE_ORDER/PRODUCTION_ORDER_EXECUTION/PURCHASE_ORDER/WAREHOUSE_TO_PRODUCTION_ORDER/SPORADIC_ORDER/SALE_ORDER'),
      orderStatus: z.string().optional().describe('单据状态: INIT/RUNNING/FINISHED/CLOSED'),
      orderCode: z.string().optional().describe('单据编号（模糊匹配）'),
      vendorName: z.string().optional().describe('供应商名称（模糊匹配）'),
      dateRange: z.object({ from: z.string(), to: z.string() }).optional().describe('创建日期范围'),
      groupBy: z.enum(['orderType', 'orderStatus']).optional().describe('按维度聚合'),
      limit: z.number().int().optional().default(20),
    },
    async (args) => {
      const conditions: JmixCondition[] = []
      if (args.orderType) conditions.push({ property: 'orderType', operator: '=', value: args.orderType })
      if (args.orderStatus) conditions.push({ property: 'orderStatus', operator: '=', value: args.orderStatus })
      if (args.orderCode) conditions.push({ property: 'orderCode', operator: 'contains', value: args.orderCode })
      if (args.vendorName) conditions.push({ property: 'venderName', operator: 'contains', value: args.vendorName })
      if (args.dateRange) {
        conditions.push({ property: 'createdDate', operator: '>=', value: jmixDate(args.dateRange.from) })
        conditions.push({ property: 'createdDate', operator: '<=', value: jmixDate(args.dateRange.to, true) })
      }

      const filter = { conditions }

      // groupBy
      if (args.groupBy) {
        const all = conditions.length > 0
          ? await mesClient.getAll('InventoryOrder', { filter, fetchPlan: '_local' })
          : await mesClient.getAll('InventoryOrder', { fetchPlan: '_local' })
        const groups = new Map<string, number>()
        for (const o of all) {
          const key = String(o[args.groupBy] ?? '未知')
          groups.set(key, (groups.get(key) ?? 0) + 1)
        }
        const sorted = [...groups.entries()].sort((a, b) => b[1] - a[1]).map(([group, count]) => ({ group, count }))
        return textResult({ total: all.length, groupBy: args.groupBy, groups: sorted })
      }

      // 列表查询
      const result = conditions.length > 0
        ? await mesClient.search('InventoryOrder', filter, { limit: args.limit, sort: '-createdDate', returnCount: true })
        : await mesClient.list('InventoryOrder', { limit: args.limit, sort: '-createdDate', returnCount: true })

      const items = result.items.map(o => ({
        orderCode: o.orderCode,
        orderType: o.orderType,
        orderStatus: o.orderStatus,
        vendorName: o.venderName || null,
        targetWarehouse: o.targetWarehouseCode || null,
        executor: o.executorName || null,
        createdDate: o.createdDate,
        lineCount: Array.isArray(o.inventoryOrderLine) ? o.inventoryOrderLine.length : undefined,
      }))

      return textResult({ total: result.count ?? items.length, count: items.length, items })
    }
  )
}
