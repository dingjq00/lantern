// edhr.exception.search — 质量异常搜索
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { jmixSearch, jmixCount, type JmixCondition } from '../../jmix-api.js'
import { textResult } from '../../shared.js'

export function registerEdhrExceptionSearch(server: McpServer) {
  server.tool(
    'edhr.exception.search',
    '按条件搜索质量异常记录。支持按状态(OPEN/ACKNOWLEDGED/DECIDED/CLOSED)、决策类型(REOPERATE重新操作/REPAIRE返修/RETEST重新测试)过滤，可按决策类型或状态聚合统计。适用于"有几个异常没关闭""返修的异常有哪些""各决策类型比例"等问题。',
    {
      exceptionStatus: z.string().optional().describe('异常状态: OPEN/ACKNOWLEDGED/DECIDED/CLOSED'),
      decisionType: z.string().optional().describe('决策类型: REOPERATE=重新操作, REPAIRE=返修, RETEST=重新测试'),
      orderCode: z.string().optional().describe('关联工单编号'),
      orderStatus: z.string().optional().describe('关联工单的进度状态过滤，如 FINISHED 只查已完成工单的异常'),
      groupBy: z.enum(['exceptionDecisionType', 'exceptionStatus']).optional().describe('按决策类型或状态聚合统计，返回各组数量和比例'),
      limit: z.number().int().optional().default(20),
    },
    async (args) => {
      const conditions: JmixCondition[] = []
      if (args.exceptionStatus) conditions.push({ property: 'exceptionStatus', operator: '=', value: args.exceptionStatus })
      if (args.decisionType) conditions.push({ property: 'exceptionDecisionType', operator: '=', value: args.decisionType })
      if (args.orderCode) conditions.push({ property: 'order.code', operator: '=', value: args.orderCode })
      if (args.orderStatus) conditions.push({ property: 'order.progressStatus', operator: '=', value: args.orderStatus })

      // groupBy — 用 jmixCount 逐类型精确统计，不从分页数据推断
      if (args.groupBy === 'exceptionDecisionType') {
        const types = ['REOPERATE', 'REPAIRE', 'RETEST']
        const counts = await Promise.all(types.map(async (t) => {
          const c = await jmixCount('OrderException', {
            conditions: [...conditions, { property: 'exceptionDecisionType', operator: '=', value: t }]
          })
          return { group: t, count: c }
        }))
        const groups = counts.filter(g => g.count > 0).sort((a, b) => b.count - a.count)
        const total = groups.reduce((s, g) => s + g.count, 0)
        return textResult({ total, groupBy: 'exceptionDecisionType', groups })
      }

      if (args.groupBy === 'exceptionStatus') {
        const statuses = ['OPEN', 'ACKNOWLEDGED', 'DECIDED', 'CLOSED']
        const counts = await Promise.all(statuses.map(async (s) => {
          const c = await jmixCount('OrderException', {
            conditions: [...conditions, { property: 'exceptionStatus', operator: '=', value: s }]
          })
          return { group: s, count: c }
        }))
        const groups = counts.filter(g => g.count > 0).sort((a, b) => b.count - a.count)
        const total = groups.reduce((s, g) => s + g.count, 0)
        return textResult({ total, groupBy: 'exceptionStatus', groups })
      }

      const filter = conditions.length > 0 ? { conditions } : { conditions: [] }
      const result = await jmixSearch('OrderException', filter, {
        limit: args.limit, sort: '-createdDate', fetchPlan: '_local',
      })

      const items = result.items.map(e => ({
        id: e.id, exceptionStatus: e.exceptionStatus,
        exceptionDecisionType: e.exceptionDecisionType,
        decisionComment: e.decisionComment,
        decisionMadeTime: e.decisionMadeTime,
        reworkComment: e.reworkComment,
        closedTime: e.closedTime,
      }))

      return textResult({ total: items.length, count: items.length, items })
    }
  )
}
