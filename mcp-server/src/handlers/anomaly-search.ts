// eam.anomaly.search — 异常记录搜索
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { eamGet, type PageResult } from '../eam-api.js'
import { resolveEquipment, resolveProductionLine, resolveDepartment, getEquipmentIdsByProductionLine, getEquipmentIdsByDepartment } from '../resolvers.js'

interface AnomalyRecord {
  id: number; equipmentId: number; source: string; severity: number
  status: number; faultReportId: number | null; description: string | null
  createTime: number; [key: string]: unknown
}

export function registerAnomalySearch(server: McpServer) {
  server.tool(
    'eam.anomaly.search',
    '按条件搜索异常记录。支持按设备、产线、部门、严重度、来源、时间范围过滤。当用户问"异常记录""巡检发现的异常""严重异常有哪些"时使用。',
    {
      equipment: z.string().optional().describe('设备名称、编号或ID'),
      productionLine: z.string().optional().describe('产线名称或ID'),
      department: z.string().optional().describe('部门/车间名称或ID'),
      severity: z.number().int().optional().describe('1=低 2=中 3=高 4=紧急'),
      source: z.string().optional().describe('PATROL/SPOT_CHECK/INSPECTION/MANUAL'),
      dateRange: z.object({ from: z.string(), to: z.string() }).optional().describe('时间范围'),
      groupBy: z.enum(['equipment', 'severity', 'source']).optional(),
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

      if (args.severity !== undefined) params.severity = args.severity
      if (args.source) params.source = args.source
      if (args.dateRange) {
        params.createTimeStart = args.dateRange.from
        params.createTimeEnd = args.dateRange.to
      }

      // 产线/部门过滤
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

      const page = await eamGet<PageResult<AnomalyRecord>>('/eam/anomaly/page', params)
      let list = page.list

      if (scopeEquipmentIds) {
        list = list.filter(a => scopeEquipmentIds!.includes(a.equipmentId))
      }

      // groupBy
      if (args.groupBy) {
        const groups = new Map<string, number>()
        for (const a of list) {
          const key = args.groupBy === 'equipment' ? String(a.equipmentId)
            : args.groupBy === 'severity' ? SEVERITY_MAP[a.severity] ?? String(a.severity)
            : a.source ?? 'unknown'
          groups.set(key, (groups.get(key) ?? 0) + 1)
        }
        return textResult({
          total: list.length,
          groupBy: args.groupBy,
          groups: [...groups.entries()].sort((a, b) => b[1] - a[1]).map(([group, count]) => ({ group, count })),
        })
      }

      const items = list.map(a => args.format === 'concise'
        ? { id: a.id, severity: SEVERITY_MAP[a.severity], source: a.source, escalated: !!a.faultReportId }
        : {
            id: a.id, equipmentId: a.equipmentId, severity: a.severity,
            severityText: SEVERITY_MAP[a.severity], source: a.source, status: a.status,
            description: a.description, escalated: !!a.faultReportId,
            faultReportId: a.faultReportId, createTime: a.createTime,
          }
      )

      return textResult({ total: page.total, count: items.length, items })
    }
  )
}

const SEVERITY_MAP: Record<number, string> = { 1: '低', 2: '中', 3: '高', 4: '紧急' }

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}
