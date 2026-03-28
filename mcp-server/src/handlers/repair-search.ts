// eam.repair.search — 维修工单搜索（中等丰富度）
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { eamGet, eamParallel, type PageResult, type RepairOrder } from '../eam-api.js'
import { resolveEquipment, resolveProductionLine, resolveDepartment, getEquipmentIdsByProductionLine, getEquipmentIdsByDepartment } from '../resolvers.js'

export function registerRepairSearch(server: McpServer) {
  server.tool(
    'eam.repair.search',
    '按条件搜索维修工单列表。返回中等丰富度信息（含备件费用汇总、工时汇总、知识引用标题）。当用户问"上月维修工单""A线的维修""外协维修有哪些"时使用。不要用于查看单个工单详情（用 eam.repair.profile）。',
    {
      equipment: z.string().optional().describe('设备名称、编号或ID'),
      productionLine: z.string().optional().describe('产线名称或ID'),
      department: z.string().optional().describe('部门/车间名称或ID'),
      status: z.number().int().optional().describe('0=待分配 1=待接单 2=维修中 3=挂起 4=待验收 5=已完成 6=已关闭'),
      orderType: z.string().optional().describe('INTERNAL(内修) / EXTERNAL(外协) / CORRECTIVE'),
      dateRange: z.object({ from: z.string(), to: z.string() }).optional().describe('时间范围'),
      groupBy: z.enum(['equipment', 'orderType', 'status']).optional(),
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

      const page = await eamGet<PageResult<RepairOrder>>('/eam/repair-order/page', params)
      let list = page.list

      // 内存过滤: 产线/部门、orderType、dateRange（API 不原生支持）
      if (scopeEquipmentIds) list = list.filter(r => scopeEquipmentIds!.includes(r.equipmentId))
      if (args.orderType) list = list.filter(r => r.orderType === args.orderType)
      if (args.dateRange) {
        const from = new Date(args.dateRange.from).getTime()
        const to = new Date(args.dateRange.to).getTime()
        list = list.filter(r => {
          const t = (r as any).createTime
          return t >= from && t <= to
        })
      }

      // groupBy
      if (args.groupBy) {
        const groups = new Map<string, number>()
        for (const r of list) {
          const key = args.groupBy === 'equipment' ? String(r.equipmentId)
            : args.groupBy === 'orderType' ? (r.orderType ?? '未知')
            : REPAIR_STATUS[r.status] ?? String(r.status)
          groups.set(key, (groups.get(key) ?? 0) + 1)
        }
        return textResult({
          total: list.length,
          groupBy: args.groupBy,
          groups: [...groups.entries()].sort((a, b) => b[1] - a[1]).map(([group, count]) => ({ group, count })),
        })
      }

      // concise: 不做丰富化
      if (args.format === 'concise') {
        return textResult({
          total: page.total,
          count: list.length,
          items: list.map(r => ({
            code: r.orderCode, status: REPAIR_STATUS[r.status], type: r.orderType,
            equipmentId: r.equipmentId, repairMinutes: r.repairMinutes,
            laborCost: r.laborCost, materialCost: r.materialCost,
          })),
        })
      }

      // detailed: 丰富化前 10 条（避免调用爆炸）
      const enrichList = list.slice(0, 10)
      const enriched = await Promise.all(enrichList.map(async (r) => {
        const [spares, knowledge] = await eamParallel<[any[], any[]]>(
          () => eamGet<any[]>('/eam/repair-order/spare/list', { repairOrderId: r.id }).catch(() => []),
          () => eamGet<any[]>('/eam/repair-order/knowledge-ref/list', { repairOrderId: r.id }).catch(() => []),
        )

        const spareCost = Array.isArray(spares) ? spares.reduce((sum: number, s: any) => sum + (s.quantity ?? 0) * (s.unitPrice ?? 0), 0) : 0
        const spareCount = Array.isArray(spares) ? spares.length : 0
        const knowledgeTitles = Array.isArray(knowledge) ? knowledge.map((k: any) => k.documentTitle ?? k.title ?? '').filter(Boolean) : []

        return {
          id: r.id, code: r.orderCode, status: r.status, statusText: REPAIR_STATUS[r.status],
          orderType: r.orderType, equipmentId: r.equipmentId,
          repairMinutes: r.repairMinutes, laborCost: r.laborCost, materialCost: r.materialCost,
          spareSummary: { count: spareCount, totalCost: spareCost },
          knowledgeRefs: knowledgeTitles,
        }
      }))

      return textResult({ total: page.total, count: enriched.length, items: enriched })
    }
  )
}

const REPAIR_STATUS: Record<number, string> = {
  0: '待分配', 1: '待接单', 2: '维修中', 3: '挂起', 4: '待验收', 5: '已完成', 6: '已关闭',
}

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}
