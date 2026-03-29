// edhr.dashboard — EDHR 全局概览快照
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { jmixList, jmixCount } from '../../jmix-api.js'
import { textResult } from '../../shared.js'

export function registerEdhrDashboard(server: McpServer) {
  server.tool(
    'edhr.dashboard',
    '获取 EDHR 系统全局概览。返回工单总数及各状态分布、检测不合格数、质量异常统计。适用于"今天生产情况怎么样""工单概况""异常有多少"等全局视角问题。',
    {},
    async () => {
      // 并行拉取各维度统计
      const statuses = ['RUNNING', 'FINISHED', 'REVIEWED', 'ARCHIVED', 'WAITING', 'PENDING', 'TERMINATED']

      const [orders, exceptions, products, failedItems, ...statusResults] = await Promise.all([
        jmixList('Order_', { limit: 1, returnCount: true }),
        jmixList('OrderException', { limit: 1, returnCount: true }),
        jmixList('Product', { limit: 100, fetchPlan: '_local' }),
        jmixCount('OrderItem', { conditions: [{ property: 'status', operator: '=', value: 'FAILED' }] }),
        ...statuses.map(status =>
          jmixCount('Order_', { conditions: [{ property: 'progressStatus', operator: '=', value: status }] })
        ),
      ])

      const statusCounts: Record<string, number> = {}
      statuses.forEach((s, i) => { if (statusResults[i] > 0) statusCounts[s] = statusResults[i] })

      return textResult({
        orders: {
          total: orders.count ?? 0,
          byStatus: statusCounts,
        },
        items: { failed: failedItems },
        exceptions: { total: exceptions.count ?? 0 },
        products: {
          total: products.items.length,
          list: products.items.map(p => ({ code: p.code, name: p.name })),
        },
      })
    }
  )
}
