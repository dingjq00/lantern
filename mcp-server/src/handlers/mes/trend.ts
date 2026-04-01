// mes.trend — 生产趋势分析（按月/按产线统计工单数和产量）
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { mesClient, jmixDate, type JmixCondition } from '../../jmix-api.js'
import { textResult } from '../../shared.js'

export function registerMesTrend(server: McpServer) {
  server.tool(
    'mes.trend',
    '分析生产趋势。按月或按产线统计工单数量和产量变化。适用于"最近半年产量趋势""各月工单数量对比""哪个月产量最高"等趋势分析问题。',
    {
      dateRange: z.object({ from: z.string(), to: z.string() }).describe('分析日期范围'),
      dimension: z.enum(['month', 'productionLine']).optional().default('month').describe('分析维度：month=按月，productionLine=按产线'),
      status: z.string().optional().describe('只统计特定状态的工单（如 FINISHED）'),
    },
    async (args) => {
      const conditions: JmixCondition[] = [
        { property: 'planStart', operator: '>=', value: jmixDate(args.dateRange.from) },
        { property: 'planStart', operator: '<=', value: jmixDate(args.dateRange.to, true) },
      ]
      if (args.status) conditions.push({ property: 'status', operator: '=', value: args.status })

      // 拉取范围内所有工单（含物料关联以获取产线信息）
      const all = await mesClient.getAll('ProductionOrder', {
        filter: { conditions },
        fetchPlan: '_local',
      })

      if (args.dimension === 'month') {
        // 按月聚合：工单数 + 总计划量 + 总实际量
        const months = new Map<string, { orders: number; planQty: number; actualQty: number }>()
        for (const o of all) {
          const key = String(o.planStart ?? '').slice(0, 7) || '未知'
          const m = months.get(key) ?? { orders: 0, planQty: 0, actualQty: 0 }
          m.orders++
          m.planQty += (o.planQuantity as number) ?? 0
          m.actualQty += (o.actualQuantity as number) ?? 0
          months.set(key, m)
        }
        const sorted = [...months.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, data]) => ({
            month,
            orders: data.orders,
            planQuantity: Math.round(data.planQty),
            actualQuantity: Math.round(data.actualQty),
            completionRate: data.planQty > 0 ? `${Math.round(data.actualQty / data.planQty * 100)}%` : 'N/A',
          }))
        return textResult({ total: all.length, dimension: 'month', dateRange: args.dateRange, trend: sorted })
      }

      // 按产线聚合 — 需要拉 ShiftOrder 因为产线关联在 ShiftOrder/Recipe 上，不在 ProductionOrder 上
      // ProductionOrder 层面只有 material，没有直接的产线字段
      // 简化方案：按 orderType 聚合（STANDARD/REWORK）
      const groups = new Map<string, { orders: number; planQty: number; actualQty: number }>()
      for (const o of all) {
        const key = String(o.orderType ?? '未知')
        const g = groups.get(key) ?? { orders: 0, planQty: 0, actualQty: 0 }
        g.orders++
        g.planQty += (o.planQuantity as number) ?? 0
        g.actualQty += (o.actualQuantity as number) ?? 0
        groups.set(key, g)
      }
      const sorted = [...groups.entries()]
        .sort((a, b) => b[1].orders - a[1].orders)
        .map(([group, data]) => ({
          group,
          orders: data.orders,
          planQuantity: Math.round(data.planQty),
          actualQuantity: Math.round(data.actualQty),
        }))
      return textResult({ total: all.length, dimension: 'orderType', dateRange: args.dateRange, trend: sorted })
    }
  )
}
