// edhr.exception.search — 质量异常搜索
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { jmixSearch, textResult, type JmixCondition } from '../../jmix-api.js'

export function registerEdhrExceptionSearch(server: McpServer) {
  server.tool(
    'edhr.exception.search',
    '按条件搜索质量异常记录。支持按状态(OPEN/ACKNOWLEDGED/DECIDED/CLOSED)、决策类型(REOPERATE重新操作/REPAIRE返修/RETEST重新测试)过滤。适用于"有几个异常没关闭""返修的异常有哪些""最近的质量问题"等问题。',
    {
      exceptionStatus: z.string().optional().describe('异常状态: OPEN/ACKNOWLEDGED/DECIDED/CLOSED'),
      decisionType: z.string().optional().describe('决策类型: REOPERATE=重新操作, REPAIRE=返修, RETEST=重新测试'),
      orderCode: z.string().optional().describe('关联工单编号'),
      limit: z.number().int().optional().default(20),
    },
    async (args) => {
      const conditions: JmixCondition[] = []
      if (args.exceptionStatus) conditions.push({ property: 'exceptionStatus', operator: '=', value: args.exceptionStatus })
      if (args.decisionType) conditions.push({ property: 'exceptionDecisionType', operator: '=', value: args.decisionType })
      if (args.orderCode) conditions.push({ property: 'order.code', operator: '=', value: args.orderCode })

      const filter = conditions.length > 0 ? { conditions } : { conditions: [] }

      const result = await jmixSearch('OrderException', filter, {
        limit: args.limit, sort: '-createdDate', fetchPlan: '_local', returnCount: true,
      })

      const items = result.items.map(e => ({
        id: e.id, exceptionStatus: e.exceptionStatus,
        exceptionDecisionType: e.exceptionDecisionType,
        decisionComment: e.decisionComment,
        decisionMadeTime: e.decisionMadeTime,
        reworkComment: e.reworkComment,
        closedTime: e.closedTime,
      }))

      return textResult({ total: result.count ?? items.length, count: items.length, items })
    }
  )
}
