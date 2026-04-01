// mes.order.search — 生产工单搜索
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { mesClient, jmixDate, type JmixCondition } from '../../jmix-api.js'
import { textResult } from '../../shared.js'

export function registerMesOrderSearch(server: McpServer) {
  server.tool(
    'mes.order.search',
    '按条件搜索生产工单列表。支持按状态、工单号、物料、产线、日期范围过滤，可按状态/产线/月份聚合统计。适用于"有多少工单在执行""上月完成了多少工单""各产线的工单分布"等问题。',
    {
      status: z.string().optional().describe('工单状态: INIT/CONFIRMED/RUNNING/FINISHED/CLOSED/CANCELED/ABORTED'),
      orderNo: z.string().optional().describe('工单号（模糊匹配）'),
      materialCode: z.string().optional().describe('物料编号（模糊匹配）'),
      orderType: z.string().optional().describe('工单类型: STANDARD/REWORK'),
      dateRange: z.object({ from: z.string(), to: z.string() }).optional().describe('计划开始日期范围'),
      groupBy: z.enum(['status', 'orderType', 'planMonth']).optional().describe('按维度聚合。status=按状态，orderType=按类型，planMonth=按计划月份'),
      limit: z.number().int().optional().default(20),
    },
    async (args) => {
      const conditions: JmixCondition[] = []
      if (args.status) conditions.push({ property: 'status', operator: '=', value: args.status })
      if (args.orderNo) conditions.push({ property: 'productionOrderNo', operator: 'contains', value: args.orderNo })
      if (args.materialCode) conditions.push({ property: 'material.materialCode', operator: 'contains', value: args.materialCode })
      if (args.orderType) conditions.push({ property: 'orderType', operator: '=', value: args.orderType })
      if (args.dateRange) {
        conditions.push({ property: 'planStart', operator: '>=', value: jmixDate(args.dateRange.from) })
        conditions.push({ property: 'planStart', operator: '<=', value: jmixDate(args.dateRange.to, true) })
      }

      const filter = { conditions }

      // groupBy — 全量拉取后聚合
      if (args.groupBy) {
        const all = conditions.length > 0
          ? await mesClient.getAll('ProductionOrder', { filter, fetchPlan: '_local' })
          : await mesClient.getAll('ProductionOrder', { fetchPlan: '_local' })
        const groups = new Map<string, number>()
        for (const o of all) {
          let key: string
          if (args.groupBy === 'planMonth') {
            const dateStr = String(o.planStart ?? '')
            key = dateStr.slice(0, 7) || '未知'
          } else {
            key = String(o[args.groupBy] ?? '未知')
          }
          groups.set(key, (groups.get(key) ?? 0) + 1)
        }
        const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([group, count]) => ({ group, count }))
        return textResult({ total: all.length, groupBy: args.groupBy, groups: sorted })
      }

      // 列表查询
      const result = conditions.length > 0
        ? await mesClient.search('ProductionOrder', filter, { limit: args.limit, sort: '-planStart', returnCount: true })
        : await mesClient.list('ProductionOrder', { limit: args.limit, sort: '-planStart', returnCount: true })

      const items = result.items.map(o => ({
        orderNo: o.productionOrderNo,
        status: o.status,
        orderType: o.orderType,
        material: o.material ? { code: (o.material as any).materialCode, name: (o.material as any).materialName } : null,
        planQuantity: o.planQuantity,
        actualQuantity: o.actualQuantity,
        planStart: o.planStart,
        planEnd: o.planEnd,
        actualStart: o.actualStart,
        actualEnd: o.actualEnd,
      }))

      const total = result.count ?? items.length
      if (total === 0 && args.dateRange) {
        const allOrders = await mesClient.list('ProductionOrder', { limit: 1, returnCount: true })
        return textResult({
          total: 0, count: 0, items: [],
          context: `在指定时间范围(${args.dateRange.from}~${args.dateRange.to})内没有找到工单。系统共有 ${allOrders.count} 个工单。`,
        })
      }

      return textResult({ total, count: items.length, items })
    }
  )
}
