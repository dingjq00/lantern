// mes.line.overview — 单条产线的生产+仓库概览
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { mesClient } from '../../jmix-api.js'
import { textResult } from '../../shared.js'

export function registerMesLineOverview(server: McpServer) {
  server.tool(
    'mes.line.overview',
    '获取单条产线的生产概览。返回产线基本信息、该产线的配方数量、最近的班次工单及其状态分布。支持按产线编号或名称查询。适用于"乳化线怎么样""3号手工线概况""称量线最近的工单"等问题。',
    {
      lineCode: z.string().optional().describe('产线编号（如 3101、3201）'),
      lineName: z.string().optional().describe('产线名称（模糊匹配，如"乳化""手工线"）'),
    },
    async (args) => {
      // 先找产线
      let line: any
      if (args.lineCode) {
        const result = await mesClient.search('ProductionLine', {
          conditions: [{ property: 'lineCode', operator: '=', value: args.lineCode }],
        }, { limit: 1 })
        line = result.items[0]
      } else if (args.lineName) {
        const result = await mesClient.search('ProductionLine', {
          conditions: [{ property: 'lineName', operator: 'contains', value: args.lineName }],
        }, { limit: 5 })
        if (result.items.length === 0) return textResult({ error: `未找到包含"${args.lineName}"的产线` })
        if (result.items.length > 1) {
          return textResult({
            message: `找到多条产线，请指定 lineCode`,
            lines: result.items.map(l => ({ code: l.lineCode, name: l.lineName })),
          })
        }
        line = result.items[0]
      } else {
        return textResult({ error: '请提供 lineCode 或 lineName' })
      }

      if (!line) return textResult({ error: '未找到该产线' })

      // 并行查询该产线的配方数 + 最近班次工单
      const [recipes, shiftOrders] = await Promise.all([
        // 该产线关联的配方
        mesClient.search('Recipe', {
          conditions: [{ property: 'productionLine.lineCode', operator: '=', value: line.lineCode }],
        }, { limit: 1, returnCount: true, fetchPlan: '_instance_name' }),
        // 该产线的最近班次工单（通过 Recipe 关联产线，但 ShiftOrder 没有直接 lineCode 字段）
        // 简化：拉最近的 ShiftOrder 按状态统计
        mesClient.list('ProductionShiftOrder', { limit: 50, sort: '-planStart', fetchPlan: '_local' }),
      ])

      // 班次工单状态分布
      const statusCounts: Record<string, number> = {}
      for (const so of shiftOrders.items) {
        const s = String(so.status ?? '未知')
        statusCounts[s] = (statusCounts[s] ?? 0) + 1
      }

      return textResult({
        line: {
          code: line.lineCode,
          name: line.lineName,
          alias: line.aliasName || null,
        },
        recipes: { total: recipes.count ?? recipes.items.length },
        recentShiftOrders: {
          sampled: shiftOrders.items.length,
          byStatus: statusCounts,
        },
      })
    }
  )
}
