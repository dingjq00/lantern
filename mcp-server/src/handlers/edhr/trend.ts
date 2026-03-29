// edhr.trend — 趋势分析（工单完成/检测合格率/异常率 时间序列）
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { jmixGetAll, jmixDate, type JmixEntity } from '../../jmix-api.js'
import { textResult } from '../../shared.js'

export function registerEdhrTrend(server: McpServer) {
  server.tool(
    'edhr.trend',
    '获取 EDHR 趋势分析时间序列。支持工单完成趋势、检测不合格趋势、异常趋势。按天/周/月聚合。适用于"上月工单完成趋势""检测不合格率变化""异常数量趋势"等问题。',
    {
      domain: z.enum(['order', 'item', 'exception']).describe('数据域: order=工单, item=检测项, exception=异常'),
      dateRange: z.object({ from: z.string(), to: z.string() }).describe('时间范围'),
      groupBy: z.enum(['day', 'week', 'month']).optional().default('day'),
    },
    async (args) => {
      // 根据域选择实体和时间字段
      let entityName: string
      let dateField: string

      switch (args.domain) {
        case 'order':
          entityName = 'Order_'
          dateField = 'createdDate'
          break
        case 'item':
          entityName = 'OrderItem'
          dateField = 'operateTime'
          break
        case 'exception':
          entityName = 'OrderException'
          dateField = 'createdDate'
          break
      }

      // 拉取时间范围内的数据
      const all = await jmixGetAll(entityName, {
        filter: {
          conditions: [
            { property: dateField, operator: '>=', value: jmixDate(args.dateRange.from) },
            { property: dateField, operator: '<=', value: jmixDate(args.dateRange.to, true) },
          ]
        },
        fetchPlan: '_local',
      })

      // 按时间聚合
      const groups = new Map<string, number>()
      for (const item of all) {
        const dateStr = String(item[dateField] ?? '')
        if (!dateStr) continue
        const period = extractPeriod(dateStr, args.groupBy)
        groups.set(period, (groups.get(period) ?? 0) + 1)
      }

      const series = [...groups.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([period, count]) => ({ period, count }))

      return textResult({
        domain: args.domain,
        dateRange: args.dateRange,
        groupBy: args.groupBy,
        totalRecords: all.length,
        series,
      })
    }
  )
}

function extractPeriod(dateStr: string, groupBy: string): string {
  // 日期格式可能是 ISO 或 yyyy-MM-dd
  const d = dateStr.slice(0, 10) // yyyy-MM-dd
  if (groupBy === 'month') return d.slice(0, 7) // yyyy-MM
  if (groupBy === 'week') {
    const date = new Date(d)
    const dayOfWeek = date.getDay() || 7
    date.setDate(date.getDate() - dayOfWeek + 1) // 周一
    return date.toISOString().slice(0, 10)
  }
  return d // day
}
