// eam.anomaly.search — 异常记录搜索
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { eamSearch } from '../eam-api.js'
import { resolveEquipment, resolveScope, enrichGroupNames } from '../resolvers.js'
import { textResult } from '../shared.js'

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
        // API 要求完整 datetime 格式，纯日期会 400
        const ensureTime = (s: string, end = false) =>
          s.includes('T') || s.includes(' ') ? s : s + (end ? ' 23:59:59' : ' 00:00:00')
        params.createTimeStart = ensureTime(args.dateRange.from)
        params.createTimeEnd = ensureTime(args.dateRange.to, true)
      }

      // 产线/部门过滤 — 通用 resolveScope
      const scope = await resolveScope({ productionLine: args.productionLine, department: args.department })
      if (scope.type === 'error') return textResult(scope.response)
      const scopeEquipmentIds = scope.type === 'ids' ? scope.ids : null

      const result = await eamSearch<AnomalyRecord>('/eam/anomaly/page', params, {
        groupBy: args.groupBy,
        groupKeyFn: (a, gb) => gb === 'equipment' ? String(a.equipmentId)
          : gb === 'severity' ? SEVERITY_MAP[a.severity] ?? String(a.severity)
          : a.source ?? 'unknown',
        limit: args.limit,
        fullScan: !args.groupBy,
      })

      let { list, total } = result
      if (scopeEquipmentIds) {
        list = list.filter(a => scopeEquipmentIds!.includes(a.equipmentId))
        total = list.length
      }

      if (result.groups) {
        const enrichedGroups = await enrichGroupNames(result.groups, args.groupBy!)
        return textResult({ total, groupBy: args.groupBy, groups: enrichedGroups })
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

      return textResult({ total, count: items.length, items })
    }
  )
}

const SEVERITY_MAP: Record<number, string> = { 1: '低', 2: '中', 3: '高', 4: '紧急' }
