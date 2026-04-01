// mes.order.profile — 单个生产工单详情（含批次进度）
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { mesClient, type JmixCondition } from '../../jmix-api.js'
import { textResult } from '../../shared.js'

export function registerMesOrderProfile(server: McpServer) {
  server.tool(
    'mes.order.profile',
    '获取单个生产工单的完整详情。返回工单基本信息、物料、批次(BatchOrder)列表及每个批次的班次(ShiftOrder)进度。支持按工单号或ID查询。适用于"工单10015726什么情况""这个工单做到哪了""批次进度"等问题。',
    {
      orderNo: z.string().optional().describe('生产工单号（如 10015726）'),
      id: z.string().optional().describe('工单内部 ID（UUID）'),
    },
    async (args) => {
      let order: any

      if (args.id) {
        order = await mesClient.get('ProductionOrder', args.id)
      } else if (args.orderNo) {
        // 按工单号搜索
        const conditions: JmixCondition[] = [
          { property: 'productionOrderNo', operator: '=', value: args.orderNo },
        ]
        const result = await mesClient.search('ProductionOrder', { conditions }, { limit: 1 })
        if (result.items.length === 0) {
          // 尝试模糊匹配
          const fuzzy = await mesClient.search('ProductionOrder', {
            conditions: [{ property: 'productionOrderNo', operator: 'contains', value: args.orderNo }],
          }, { limit: 5 })
          if (fuzzy.items.length === 0) {
            return textResult({ error: `未找到工单号包含"${args.orderNo}"的工单` })
          }
          return textResult({
            message: `未找到工单号"${args.orderNo}"，以下是相似工单`,
            suggestions: fuzzy.items.map(o => ({ orderNo: o.productionOrderNo, status: o.status })),
          })
        }
        order = result.items[0]
      } else {
        return textResult({ error: '请提供 orderNo 或 id' })
      }

      // 构建批次进度摘要
      const batchOrders = (order.productionBatchOrders ?? []).map((b: any) => ({
        batchNo: b.productionBatchOrderNo,
        lotNo: b.lotNo,
        status: b.status,
        planQuantity: b.planQuantity,
        actualQuantity: b.actualQuantity,
        planStart: b.planStart,
        planEnd: b.planEnd,
        actualStart: b.actualStart,
        shiftOrders: (b.productionShiftOrders ?? []).map((s: any) => ({
          shiftOrderNo: s.shiftOrderNo,
          status: s.status,
          lotsNo: s.lotsNo,
          planQuantity: s.planQuantity,
          actualQuantity: s.actualQuantity,
          planStart: s.planStart,
          actualStart: s.actualStart,
          actualEnd: s.actualEnd,
        })),
      }))

      const material = order.material ? {
        code: order.material.materialCode,
        name: order.material.materialName,
        type: order.material.materialType,
        unit: order.material.unit,
      } : null

      // 计算完成率
      const completionRate = order.planQuantity > 0
        ? Math.round((order.actualQuantity / order.planQuantity) * 1000) / 10
        : 0

      return textResult({
        orderNo: order.productionOrderNo,
        status: order.status,
        orderType: order.orderType,
        material,
        planQuantity: order.planQuantity,
        actualQuantity: order.actualQuantity,
        completionRate: `${completionRate}%`,
        planStart: order.planStart,
        planEnd: order.planEnd,
        actualStart: order.actualStart,
        actualEnd: order.actualEnd,
        isMaterialPrepared: order.isMaterialPrepared,
        batchOrders,
      })
    }
  )
}
