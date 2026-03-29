// edhr.order.search — 工单搜索
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { jmixSearch, jmixGetAll, jmixList, jmixDate, type JmixCondition } from '../../jmix-api.js'
import { textResult } from '../../shared.js'

export function registerEdhrOrderSearch(server: McpServer) {
  server.tool(
    'edhr.order.search',
    '按条件搜索工单列表。支持按状态、产品编号、批号、日期范围过滤，可按状态聚合统计。适用于"有多少工单在执行""这个产品有几个批次""上周完成了多少工单"等问题。',
    {
      progressStatus: z.string().optional().describe('进度状态: INIT/RUNNING/PENDING/FINISHED/REVIEWED/ARCHIVED/TERMINATED/REPAIRING/WAITING/ABANDONED'),
      productCode: z.string().optional().describe('产品编号（模糊匹配）'),
      lotCode: z.string().optional().describe('批号（模糊匹配）'),
      dateRange: z.object({ from: z.string(), to: z.string() }).optional().describe('创建日期范围'),
      groupBy: z.enum(['progressStatus', 'validatedStatus', 'createdMonth']).optional().describe('按维度聚合。progressStatus=按状态，validatedStatus=按验证状态，createdMonth=按创建月份'),
      limit: z.number().int().optional().default(20),
    },
    async (args) => {
      const conditions: JmixCondition[] = []
      if (args.progressStatus) conditions.push({ property: 'progressStatus', operator: '=', value: args.progressStatus })
      if (args.productCode) conditions.push({ property: 'code', operator: 'contains', value: args.productCode })
      if (args.lotCode) conditions.push({ property: 'lotCode', operator: 'contains', value: args.lotCode })
      if (args.dateRange) {
        conditions.push({ property: 'createdDate', operator: '>=', value: jmixDate(args.dateRange.from) })
        conditions.push({ property: 'createdDate', operator: '<=', value: jmixDate(args.dateRange.to, true) })
      }

      const filter = conditions.length > 0 ? { conditions } : { conditions: [] }

      // groupBy — 全量拉取后聚合
      if (args.groupBy) {
        const all = await jmixGetAll('Order_', { filter, fetchPlan: '_local' })
        const groups = new Map<string, number>()
        for (const o of all) {
          let key: string
          if (args.groupBy === 'createdMonth') {
            // 按创建月份分组: "2024-06", "2024-07" 等
            const dateStr = String(o.createdDate ?? o.productionDate ?? '')
            key = dateStr.slice(0, 7) || '未知'
          } else {
            key = String(o[args.groupBy] ?? '未知')
          }
          groups.set(key, (groups.get(key) ?? 0) + 1)
        }
        const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([group, count]) => ({ group, count }))
        return textResult({ total: all.length, groupBy: args.groupBy, groups: sorted })
      }

      const result = await jmixSearch('Order_', filter, {
        limit: args.limit, sort: '-createdDate', fetchPlan: '_local', returnCount: true,
      })

      const items = result.items.map(o => ({
        code: o.code, progressStatus: o.progressStatus, validatedStatus: o.validatedStatus,
        lotCode: o.lotCode, productionDate: o.productionDate,
        actualStartTime: o.actualStartTime, actualEndTime: o.actualEndTime,
      }))

      const total = result.count ?? items.length
      // 空结果+有日期限定时，提示可能是时间范围问题
      if (total === 0 && args.dateRange) {
        const allOrders = await jmixList('Order_', { limit: 1, returnCount: true })
        return textResult({
          total: 0, count: 0, items: [],
          context: `在指定时间范围(${args.dateRange.from}~${args.dateRange.to})内没有找到符合条件的工单。系统中共有 ${allOrders.count} 个工单，数据时间范围可能不在查询范围内。`,
        })
      }

      return textResult({ total, count: items.length, items })
    }
  )
}
