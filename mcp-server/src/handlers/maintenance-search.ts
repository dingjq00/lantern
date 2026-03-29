// eam.maintenance.search — 保养任务搜索
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { eamSearch } from '../eam-api.js'
import { resolveEquipment, resolveScope, enrichGroupNames, getEquipmentToLineMap } from '../resolvers.js'
import { textResult } from '../shared.js'

interface MaintenanceTask {
  id: number; taskCode: string; planId: number; equipmentId: number
  standardId: number | null; assigneeId: number | null; status: number
  plannedTime: number | null; plannedEndTime: number | null
  startTime: number | null; completeTime: number | null
  skipReason: string | null; [key: string]: unknown
}

export function registerMaintenanceSearch(server: McpServer) {
  server.tool(
    'eam.maintenance.search',
    '按条件搜索保养任务列表。支持按设备、产线、部门、状态、时间范围过滤，可筛选逾期任务。当用户问"保养任务""逾期保养""A线保养完成率"时使用。',
    {
      equipment: z.string().optional().describe('设备名称、编号或ID'),
      productionLine: z.string().optional().describe('产线名称或ID'),
      department: z.string().optional().describe('部门/车间名称或ID'),
      status: z.number().int().optional().describe('0=待执行 1=执行中 2=已完成 3=已逾期 4=已跳过'),
      overdue: z.boolean().optional().describe('仅逾期任务'),
      dateRange: z.object({ from: z.string(), to: z.string() }).optional(),
      groupBy: z.enum(['equipment', 'status', 'productionLine']).optional().describe('按维度聚合: equipment=按设备, status=按状态, productionLine=按产线'),
      format: z.enum(['detailed', 'concise']).optional().default('detailed'),
      limit: z.number().int().optional().default(20),
    },
    async (args) => {
      const params: Record<string, unknown> = { pageNo: 1, pageSize: args.limit }

      if (args.equipment) {
        const eq = await resolveEquipment(args.equipment)
        if (eq.match === 'exact' && eq.entity) params.equipmentId = eq.entity.id
        else if (eq.match === 'candidates') return textResult({ message: '找到多个匹配设备，请确认', candidates: eq.candidates })
      }

      if (args.status !== undefined) params.status = args.status
      if (args.overdue) params.status = 3 // 逾期状态码

      // 产线/部门过滤 — 通用 resolveScope
      const scope = await resolveScope({ productionLine: args.productionLine, department: args.department })
      if (scope.type === 'error') return textResult(scope.response)
      const scopeEquipmentIds = scope.type === 'ids' ? scope.ids : null

      // productionLine groupBy 需要 eq→line 映射
      const eqToLine = args.groupBy === 'productionLine' ? await getEquipmentToLineMap() : null

      const result = await eamSearch<MaintenanceTask>('/eam/maintenance/task/page', params, {
        groupBy: args.groupBy,
        groupKeyFn: (t, gb) => gb === 'equipment' ? String(t.equipmentId)
          : gb === 'productionLine' ? (eqToLine?.get(t.equipmentId) ?? '未分配产线')
          : MAINT_STATUS[t.status] ?? String(t.status),
        limit: args.limit,
      })

      let { list, total } = result
      if (scopeEquipmentIds) {
        list = list.filter(t => scopeEquipmentIds!.includes(t.equipmentId))
        total = list.length
      }

      // dateRange 内存过滤
      if (args.dateRange) {
        const from = new Date(args.dateRange.from).getTime()
        const to = new Date(args.dateRange.to).getTime()
        list = list.filter(t => {
          const pt = t.plannedTime ?? t.startTime ?? 0
          return pt >= from && pt <= to
        })
        total = list.length
      }

      // groupBy: eamSearch 给出 count，但保养需要完成率，从 list 重算
      if (result.groups) {
        const groups = new Map<string, { total: number; completed: number }>()
        for (const t of list) {
          const key = args.groupBy === 'equipment' ? String(t.equipmentId)
            : args.groupBy === 'productionLine' ? (eqToLine?.get(t.equipmentId) ?? '未分配产线')
            : MAINT_STATUS[t.status] ?? String(t.status)
          const g = groups.get(key) ?? { total: 0, completed: 0 }
          g.total++
          if (t.status === 2) g.completed++
          groups.set(key, g)
        }
        const rawGroups = [...groups.entries()].sort((a, b) => b[1].total - a[1].total).map(([group, g]) => ({
          group, total: g.total, completed: g.completed,
          completionRate: g.total > 0 ? `${Math.round(g.completed / g.total * 100)}%` : 'N/A',
        }))
        // enrichGroupNames 只替换 group 字段（设备 ID→名称），productionLine 已是名称无需解析
        const enrichedGroups = args.groupBy === 'productionLine' ? rawGroups : await enrichGroupNames(rawGroups as any, args.groupBy!)
        return textResult({ total, groupBy: args.groupBy, groups: enrichedGroups })
      }

      const items = list.map(t => args.format === 'concise'
        ? { code: t.taskCode, status: MAINT_STATUS[t.status], equipmentId: t.equipmentId, plannedTime: t.plannedTime }
        : {
            id: t.id, code: t.taskCode, status: t.status, statusText: MAINT_STATUS[t.status],
            equipmentId: t.equipmentId, standardId: t.standardId, assigneeId: t.assigneeId,
            plannedTime: t.plannedTime, plannedEndTime: t.plannedEndTime,
            startTime: t.startTime, completeTime: t.completeTime, skipReason: t.skipReason,
          }
      )

      return textResult({ total, count: items.length, items })
    }
  )
}

const MAINT_STATUS: Record<number, string> = {
  0: '待执行', 1: '执行中', 2: '已完成', 3: '已逾期', 4: '已跳过',
}
