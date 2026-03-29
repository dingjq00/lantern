// edhr.order.profile — 单工单全景（含层级遍历）
// 从工单→工序→阶段→检测项，逐层聚合展示
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { jmixSearch, textResult, type JmixEntity } from '../../jmix-api.js'

/** 通过工单号（code）查找工单 */
async function resolveOrder(identifier: string) {
  // 精确匹配 code
  const exact = await jmixSearch('Order_', {
    conditions: [{ property: 'code', operator: '=', value: identifier }]
  }, { limit: 5, fetchPlan: '_local' })

  if (exact.items.length === 1) return { match: 'exact' as const, order: exact.items[0] }
  if (exact.items.length > 1) return { match: 'candidates' as const, candidates: exact.items.map(o => ({ id: o.id, code: o.code })) }

  // 模糊匹配
  const fuzzy = await jmixSearch('Order_', {
    conditions: [{ property: 'code', operator: 'contains', value: identifier }]
  }, { limit: 5, fetchPlan: '_local' })

  if (fuzzy.items.length === 1) return { match: 'exact' as const, order: fuzzy.items[0] }
  if (fuzzy.items.length > 1) return { match: 'candidates' as const, candidates: fuzzy.items.map(o => ({ id: o.id, code: o.code })) }

  return { match: 'none' as const }
}

export function registerEdhrOrderProfile(server: McpServer) {
  server.tool(
    'edhr.order.profile',
    '查看单个工单的完整档案。返回工单基本信息 + 各工序进度 + 检测项合格/不合格统计 + 异常列表。通过工单号定位。适用于"工单XXX做到哪了""这个批次的检测结果""工单XXX有什么异常"等问题。',
    {
      identifier: z.string().describe('工单号（code），如 7103005-681895'),
    },
    async ({ identifier }) => {
      // 解析工单
      const resolved = await resolveOrder(identifier)
      if (resolved.match === 'none') {
        return textResult({ message: `没有找到编号包含"${identifier}"的工单`, suggestion: '请确认工单编号' })
      }
      if (resolved.match === 'candidates') {
        return textResult({ message: '找到多个匹配的工单，请确认', candidates: resolved.candidates })
      }

      const order = resolved.order
      const orderId = order.id as string

      // 并行拉取层级数据
      const [procedures, itemsByStatus, exceptions] = await Promise.all([
        // 工序列表（含 recipeProcedure 关联）
        jmixSearch('OrderProcedure', {
          conditions: [{ property: 'order.id', operator: '=', value: orderId }]
        }, { fetchPlan: '_local', sort: '+sequence' }),

        // 检测项按状态分组统计 — 分别查各状态的 count
        Promise.all(['PASSED', 'FAILED', 'INIT', 'PENDING', 'REPAIRING', 'PASSEDAFTERREPAIED', 'WRONGRECORDED', 'ABANDONED'].map(async (status) => {
          const r = await jmixSearch('OrderItem', {
            conditions: [
              { property: 'order.id', operator: '=', value: orderId },
              { property: 'status', operator: '=', value: status },
            ]
          }, { limit: 1, returnCount: true })
          return { status, count: r.count ?? r.items.length }
        })),

        // 异常列表
        jmixSearch('OrderException', {
          conditions: [{ property: 'order.id', operator: '=', value: orderId }]
        }, { fetchPlan: '_local' }),
      ])

      // 工序摘要
      const procedureSummary = procedures.items.map(p => ({
        progressStatus: p.progressStatus,
        validatedStatus: p.validatedStatus,
        actualStartTime: p.actualStartTime,
        actualEndTime: p.actualEndTime,
      }))

      // 检测项统计
      const itemStats = Object.fromEntries(
        itemsByStatus.filter(s => s.count > 0).map(s => [s.status, s.count])
      )
      const totalItems = itemsByStatus.reduce((sum, s) => sum + s.count, 0)
      const passedItems = itemsByStatus.find(s => s.status === 'PASSED')?.count ?? 0
      const failedItems = itemsByStatus.find(s => s.status === 'FAILED')?.count ?? 0
      const passRate = totalItems > 0 ? ((passedItems / totalItems) * 100).toFixed(1) + '%' : '-'

      // 异常摘要
      const exceptionSummary = exceptions.items.map(e => ({
        status: e.exceptionStatus,
        decisionType: e.exceptionDecisionType,
        decisionComment: e.decisionComment,
      }))

      return textResult({
        order: {
          code: order.code,
          progressStatus: order.progressStatus,
          validatedStatus: order.validatedStatus,
          productionDate: order.productionDate,
          lotCode: order.lotCode,
          orderSN: order.orderSN,
          actualStartTime: order.actualStartTime,
          actualEndTime: order.actualEndTime,
          createdDate: order.createdDate,
          createdBy: order.createdBy,
        },
        procedures: {
          total: procedureSummary.length,
          items: procedureSummary,
        },
        items: {
          total: totalItems,
          byStatus: itemStats,
          passRate,
          passed: passedItems,
          failed: failedItems,
        },
        exceptions: {
          total: exceptionSummary.length,
          items: exceptionSummary,
        },
      })
    }
  )
}
