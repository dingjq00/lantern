// edhr.item.search — 检测项搜索
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { jmixSearch, jmixGetAll, textResult, type JmixCondition } from '../../jmix-api.js'

export function registerEdhrItemSearch(server: McpServer) {
  server.tool(
    'edhr.item.search',
    '按条件搜索检测项记录。支持按状态(合格/不合格)、工单号、时间过滤，可按状态聚合统计。适用于"有多少不合格项""这个工单的检测结果""最近的不合格项有哪些"等问题。',
    {
      status: z.string().optional().describe('检测项状态: INIT/PENDING/PASSED/FAILED/PASSEDAFTERREPAIED/REPAIRING/WRONGRECORDED/ABANDONED'),
      orderCode: z.string().optional().describe('工单编号（精确匹配）'),
      dateRange: z.object({ from: z.string(), to: z.string() }).optional().describe('操作时间范围'),
      groupBy: z.enum(['status']).optional().describe('按状态聚合'),
      limit: z.number().int().optional().default(20),
    },
    async (args) => {
      const conditions: JmixCondition[] = []
      if (args.status) conditions.push({ property: 'status', operator: '=', value: args.status })
      if (args.orderCode) conditions.push({ property: 'order.code', operator: '=', value: args.orderCode })
      if (args.dateRange) {
        conditions.push({ property: 'operateTime', operator: '>=', value: args.dateRange.from })
        conditions.push({ property: 'operateTime', operator: '<=', value: args.dateRange.to + 'T23:59:59' })
      }

      const filter = conditions.length > 0 ? { conditions } : { conditions: [] }

      // groupBy
      if (args.groupBy) {
        const all = await jmixGetAll('OrderItem', { filter, fetchPlan: '_local' })
        const groups = new Map<string, number>()
        for (const item of all) {
          const key = String(item[args.groupBy] ?? '未知')
          groups.set(key, (groups.get(key) ?? 0) + 1)
        }
        const sorted = [...groups.entries()].sort((a, b) => b[1] - a[1]).map(([group, count]) => ({ group, count }))
        return textResult({ total: all.length, groupBy: args.groupBy, groups: sorted })
      }

      const result = await jmixSearch('OrderItem', filter, {
        limit: args.limit, sort: '-operateTime', fetchPlan: '_local', returnCount: true,
      })

      const items = result.items.map(i => ({
        id: i.id, status: i.status,
        itemValue: i.itemValue, operateTime: i.operateTime,
        changeNote: i.changeNote,
      }))

      return textResult({ total: result.count ?? items.length, count: items.length, items })
    }
  )
}
