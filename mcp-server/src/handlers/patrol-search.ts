// eam.patrol.search — 巡检任务搜索
// 注意: 巡检任务通过 plan 关联设备，无直接 equipmentId 过滤
// 使用 /patrol/task/equipment-records 端点作为设备过滤的替代方案
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { eamGet, eamGetAll, type PageResult } from '../eam-api.js'
import { resolveEquipment, resolveScope, enrichGroupNames } from '../resolvers.js'
import { textResult } from '../shared.js'

interface PatrolTask {
  id: number; taskCode: string; planId: number; assigneeId: number | null
  status: number; totalItems: number; completedItems: number; abnormalItems: number
  plannedTime: number | null; completeTime: number | null; [key: string]: unknown
}

export function registerPatrolSearch(server: McpServer) {
  server.tool(
    'eam.patrol.search',
    '按条件搜索巡检任务列表。返回每条任务的异常项数/总检查项数。当用户问"巡检任务""巡检完成情况""有多少异常"时使用。',
    {
      equipment: z.string().optional().describe('设备名称、编号或ID（通过巡检记录端点过滤）'),
      productionLine: z.string().optional().describe('产线名称或ID'),
      department: z.string().optional().describe('部门/车间名称或ID'),
      status: z.number().int().optional().describe('巡检任务状态'),
      dateRange: z.object({ from: z.string(), to: z.string() }).optional(),
      groupBy: z.enum(['equipment', 'status']).optional(),
      format: z.enum(['detailed', 'concise']).optional().default('detailed'),
      limit: z.number().int().optional().default(20),
    },
    async (args) => {
      // 如果指定了设备，优先用 equipment-records 端点
      if (args.equipment) {
        const eq = await resolveEquipment(args.equipment)
        if (eq.match === 'exact' && eq.entity) {
          try {
            const records = await eamGet('/eam/patrol/task/equipment-records', {
              equipmentId: eq.entity.id,
              ...(args.dateRange ? { startTimeBegin: args.dateRange.from, startTimeEnd: args.dateRange.to } : {}),
            })
            return textResult({
              equipment: { code: eq.entity.equipmentCode, name: eq.entity.equipmentName },
              records,
            })
          } catch {
            // equipment-records 不可用，回退到 page
          }
        } else if (eq.match === 'candidates') {
          return textResult({ message: '找到多个匹配设备，请确认', candidates: eq.candidates })
        }
      }

      // 通用搜索: /patrol/task/page
      // 注意: 巡检 API 不支持日期范围参数，有 dateRange 时拉全量后内存过滤
      const params: Record<string, unknown> = { pageNo: 1, pageSize: args.limit }
      if (args.status !== undefined) params.status = args.status

      let list: PatrolTask[]
      let total: number

      if (args.dateRange) {
        // dateRange — 需全量拉取+内存过滤（API 不支持日期参数）
        const all = await eamGetAll<PatrolTask>('/eam/patrol/task/page', args.status !== undefined ? { status: args.status } : {})
        const from = new Date(args.dateRange.from).getTime()
        const to = new Date(args.dateRange.to).getTime()
        list = all.filter(t => {
          const time = t.plannedTime ?? t.completeTime ?? 0
          return time >= from && time <= to
        })
        total = list.length
      } else {
        const page = await eamGet<PageResult<PatrolTask>>('/eam/patrol/task/page', params)
        list = page.list
        total = page.total
      }

      // 产线/部门过滤 — 通用 resolveScope（巡检任务无直接 equipmentId，回退到 analytics）
      if (args.productionLine || args.department) {
        const scope = await resolveScope({ productionLine: args.productionLine, department: args.department })
        if (scope.type === 'error') return textResult(scope.response)

        // 巡检任务无 equipmentId 字段，尝试 analytics 端点
        try {
          const analytics = await eamGet('/eam/patrol/task/analytics/by-equipment', { days: 90 })
          return textResult({
            source: 'analytics',
            filter: args.productionLine ?? args.department,
            analytics,
          })
        } catch {
          // analytics 不可用，返回无过滤结果
        }
      }

      // groupBy
      if (args.groupBy) {
        const groups = new Map<string, number>()
        for (const t of list) {
          const key = args.groupBy === 'status' ? String(t.status) : String(t.planId)
          groups.set(key, (groups.get(key) ?? 0) + 1)
        }
        const rawGroups = [...groups.entries()].sort((a, b) => b[1] - a[1]).map(([group, count]) => ({ group, count }))
        const enrichedGroups = await enrichGroupNames(rawGroups, args.groupBy)
        return textResult({ total: list.length, groupBy: args.groupBy, groups: enrichedGroups })
      }

      const items = list.map(t => args.format === 'concise'
        ? { code: t.taskCode, status: t.status, abnormal: t.abnormalItems, total: t.totalItems }
        : {
            id: t.id, code: t.taskCode, planId: t.planId, status: t.status,
            assigneeId: t.assigneeId, totalItems: t.totalItems,
            completedItems: t.completedItems, abnormalItems: t.abnormalItems,
            plannedTime: t.plannedTime, completeTime: t.completeTime,
          }
      )

      return textResult({ total, count: items.length, items })
    }
  )
}
