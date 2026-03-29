// eam.fault.search — 故障报修搜索
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { eamSearch, type FaultReport } from '../eam-api.js'
import { resolveEquipment, resolveProductionLine, resolveDepartment, getEquipmentIdsByProductionLine, getEquipmentIdsByDepartment } from '../resolvers.js'

export function registerFaultSearch(server: McpServer) {
  server.tool(
    'eam.fault.search',
    '按条件搜索故障报修列表。支持按设备、产线、部门、状态、紧急度、时间范围过滤，可按维度聚合。当用户问"上月故障""A线有多少故障""紧急故障有哪些"时使用。',
    {
      equipment: z.string().optional().describe('设备名称、编号或ID'),
      productionLine: z.string().optional().describe('产线名称或ID'),
      department: z.string().optional().describe('部门/车间名称或ID'),
      status: z.number().int().optional().describe('0=待审核 1=待接单 2=维修中 3=挂起 4=待验收 5=已完成 6=已关闭 7=已拒绝 8=已撤回'),
      urgency: z.number().int().optional().describe('0=一般 1=紧急 2=特急'),
      dateRange: z.object({ from: z.string(), to: z.string() }).optional().describe('时间范围 {from, to} ISO日期'),
      groupBy: z.enum(['equipment', 'status', 'urgency']).optional().describe('按维度聚合统计'),
      format: z.enum(['detailed', 'concise']).optional().default('detailed'),
      limit: z.number().int().optional().default(20),
    },
    async (args) => {
      const params: Record<string, unknown> = { pageNo: 1, pageSize: args.limit }

      // 设备解析
      if (args.equipment) {
        const eq = await resolveEquipment(args.equipment)
        if (eq.match === 'exact' && eq.entity) params.equipmentId = eq.entity.id
        else if (eq.match === 'candidates') return textResult({ message: '找到多个匹配设备，请确认', candidates: eq.candidates })
      }

      if (args.status !== undefined) params.status = args.status
      if (args.urgency !== undefined) params.urgency = args.urgency
      if (args.dateRange) {
        params.startTime = args.dateRange.from
        params.endTime = args.dateRange.to
      }

      // 产线/部门过滤 — 先查设备ID列表
      let scopeEquipmentIds: number[] | null = null
      if (args.productionLine) {
        const line = await resolveProductionLine(args.productionLine)
        if (line.match === 'exact' && line.entity) scopeEquipmentIds = await getEquipmentIdsByProductionLine(line.entity.id)
        else if (line.match === 'candidates') return textResult({ message: '找到多个匹配产线，请确认', candidates: line.candidates })
      }
      if (args.department && !scopeEquipmentIds) {
        const dept = await resolveDepartment(args.department)
        if (dept.match === 'exact' && dept.entity) scopeEquipmentIds = await getEquipmentIdsByDepartment(dept.entity.id)
        else if (dept.match === 'candidates') return textResult({ message: '找到多个匹配部门，请确认', candidates: dept.candidates })
      }

      // 如果有产线/部门过滤但无设备参数，按设备ID列表逐个查
      // 优化: 如果设备少于 20 台，分别查；否则拉全量后内存过滤
      const result = await eamSearch<FaultReport>('/eam/fault-report/page', params, {
        groupBy: args.groupBy,
        groupKeyFn: (f, gb) => gb === 'equipment' ? String(f.equipmentId)
          : gb === 'status' ? FAULT_STATUS[f.status] ?? String(f.status)
          : URGENCY_MAP[f.urgency] ?? String(f.urgency),
        limit: args.limit,
      })

      let { list, total } = result
      if (scopeEquipmentIds) {
        list = list.filter(f => scopeEquipmentIds!.includes(f.equipmentId))
        total = list.length
      }

      if (result.groups) {
        return textResult({ total, groupBy: args.groupBy, groups: result.groups })
      }

      const items = list.map(f => args.format === 'concise'
        ? { code: (f as any).reportCode, status: FAULT_STATUS[f.status], urgency: URGENCY_MAP[f.urgency] }
        : {
            id: f.id, code: (f as any).reportCode, equipmentId: f.equipmentId,
            status: f.status, statusText: FAULT_STATUS[f.status],
            urgency: f.urgency, urgencyText: URGENCY_MAP[f.urgency],
            faultDesc: f.faultDesc, faultTime: f.faultTime, reportTime: f.reportTime,
          }
      )

      return textResult({ total, count: items.length, items })
    }
  )
}

const FAULT_STATUS: Record<number, string> = {
  0: '待审核', 1: '待接单', 2: '维修中', 3: '挂起', 4: '待验收', 5: '已完成', 6: '已关闭', 7: '已拒绝', 8: '已撤回',
}
const URGENCY_MAP: Record<number, string> = { 0: '一般', 1: '紧急', 2: '特急' }

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}
