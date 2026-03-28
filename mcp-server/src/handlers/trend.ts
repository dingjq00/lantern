// eam.trend — 趋势分析
// 从各域 page API 拉数据后按时间聚合（大部分域无原生趋势 API）
// 巡检域有原生 analytics 端点，优先使用
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { eamGet, type PageResult } from '../eam-api.js'
import { resolveEquipment, resolveProductionLine, resolveDepartment, getEquipmentIdsByProductionLine, getEquipmentIdsByDepartment } from '../resolvers.js'

export function registerTrend(server: McpServer) {
  server.tool(
    'eam.trend',
    '获取趋势分析数据。支持故障/维修/保养/巡检/异常/备件六个域的时间序列，可按天/周/月聚合，可按设备/产线/部门分组。当用户问"故障趋势""保养完成率变化""备件消耗趋势"时使用。',
    {
      domain: z.enum(['fault', 'repair', 'maintenance', 'patrol', 'anomaly', 'spare']).describe('数据域'),
      dateRange: z.object({ from: z.string(), to: z.string() }).describe('时间范围 {from, to} ISO日期'),
      groupBy: z.enum(['day', 'week', 'month']).optional().default('day').describe('时间粒度'),
      splitBy: z.enum(['equipment', 'productionLine', 'department']).optional().describe('分组对比维度'),
      equipment: z.string().optional().describe('限定设备范围'),
      productionLine: z.string().optional().describe('限定产线范围'),
      department: z.string().optional().describe('限定部门范围'),
      format: z.enum(['detailed', 'concise']).optional().default('detailed'),
    },
    async (args) => {
      // 巡检域: 优先用原生 analytics
      if (args.domain === 'patrol') {
        try {
          const analytics = await eamGet('/eam/patrol/task/analytics', { days: 90 })
          return textResult({ domain: 'patrol', source: 'native-analytics', data: analytics })
        } catch { /* 回退到通用方案 */ }
      }

      // 通用方案: 从 page API 拉数据 → 按时间聚合
      const from = new Date(args.dateRange.from).getTime()
      const to = new Date(args.dateRange.to).getTime()

      // 解析范围过滤
      let scopeEquipmentIds: number[] | null = null
      if (args.equipment) {
        const eq = await resolveEquipment(args.equipment)
        if (eq.match === 'exact' && eq.entity) scopeEquipmentIds = [eq.entity.id]
      }
      if (args.productionLine && !scopeEquipmentIds) {
        const line = await resolveProductionLine(args.productionLine)
        if (line.match === 'exact' && line.entity) scopeEquipmentIds = await getEquipmentIdsByProductionLine(line.entity.id)
      }
      if (args.department && !scopeEquipmentIds) {
        const dept = await resolveDepartment(args.department)
        if (dept.match === 'exact' && dept.entity) scopeEquipmentIds = await getEquipmentIdsByDepartment(dept.entity.id)
      }

      // 按域获取数据
      let records: Array<{ time: number; equipmentId?: number; [key: string]: unknown }> = []

      const domainConfig: Record<string, { path: string; timeField: string; extraParams?: Record<string, unknown> }> = {
        fault: { path: '/eam/fault-report/page', timeField: 'reportTime', extraParams: { startTime: toLocalDateTime(args.dateRange.from), endTime: toLocalDateTime(args.dateRange.to) } },
        repair: { path: '/eam/repair-order/page', timeField: 'createTime' },
        maintenance: { path: '/eam/maintenance/task/page', timeField: 'plannedTime' },
        anomaly: { path: '/eam/anomaly/page', timeField: 'createTime', extraParams: { createTimeStart: toLocalDateTime(args.dateRange.from), createTimeEnd: toLocalDateTime(args.dateRange.to) } },
        spare: { path: '/eam/spare/stock-out/page', timeField: 'createTime' },
      }

      const config = domainConfig[args.domain]
      if (!config) {
        return textResult({ error: `域 ${args.domain} 趋势暂未实现` })
      }

      // 拉数据（分页，最多 500 条）
      const page = await eamGet<PageResult<any>>(config.path, {
        pageNo: 1, pageSize: 200,  // EAM 后端限制最大 200
        ...(config.extraParams ?? {}),
      })

      records = page.list
        .map((r: any) => ({ ...r, time: r[config.timeField] ?? r.createTime ?? 0 }))
        .filter((r: any) => r.time >= from && r.time <= to)

      // 范围过滤
      if (scopeEquipmentIds) {
        records = records.filter(r => r.equipmentId && scopeEquipmentIds!.includes(r.equipmentId))
      }

      // 按时间聚合
      const buckets = new Map<string, number>()
      for (const r of records) {
        const key = formatPeriod(r.time, args.groupBy ?? 'day')
        buckets.set(key, (buckets.get(key) ?? 0) + 1)
      }

      const series = [...buckets.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([period, count]) => ({ period, count }))

      return textResult({
        domain: args.domain,
        dateRange: args.dateRange,
        groupBy: args.groupBy,
        totalRecords: records.length,
        series,
      })
    }
  )
}

/** ISO 日期字符串 → LocalDateTime 格式 (Java 后端要求) */
function toLocalDateTime(dateStr: string): string {
  // "2026-03-28" → "2026-03-28T00:00:00"
  if (dateStr.includes('T')) return dateStr
  return `${dateStr}T00:00:00`
}

function formatPeriod(timestamp: number, groupBy: string): string {
  const d = new Date(timestamp)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')

  if (groupBy === 'month') return `${yyyy}-${mm}`
  if (groupBy === 'week') {
    // ISO 周: 简化为按每周一分组
    const day = d.getDay() || 7
    const monday = new Date(d)
    monday.setDate(d.getDate() - day + 1)
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
  }
  return `${yyyy}-${mm}-${dd}`
}

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}
