// eam.repair.search — 维修工单搜索（中等丰富度）
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { eamSearch, eamGet, eamGetAll, eamParallel, type RepairOrder } from '../eam-api.js'
import { resolveEquipment, resolveScope, enrichGroupNames, getEquipmentToLineMap } from '../resolvers.js'
import { textResult } from '../shared.js'

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
      groupBy: z.enum(['equipment', 'orderType', 'status', 'productionLine']).optional().describe('按维度聚合: equipment/orderType/status/productionLine'),
      format: z.enum(['detailed', 'concise']).optional().default('detailed'),
      limit: z.number().int().optional().default(20),
    },
    async (args) => {
      const params: Record<string, unknown> = { pageNo: 1, pageSize: args.limit }

      let resolvedEquipmentLabel: string | undefined
      if (args.equipment) {
        const eq = await resolveEquipment(args.equipment)
        if (eq.match === 'exact' && eq.entity) {
          params.equipmentId = eq.entity.id
          resolvedEquipmentLabel = `${eq.entity.equipmentCode} ${eq.entity.equipmentName}`
        }
        else if (eq.match === 'candidates') return textResult({ message: '找到多个匹配设备，请确认', candidates: eq.candidates })
      }
      if (args.status !== undefined) params.status = args.status

      // 产线/部门过滤 — 通用 resolveScope
      const scope = await resolveScope({ productionLine: args.productionLine, department: args.department })
      if (scope.type === 'error') return textResult(scope.response)
      const scopeEquipmentIds = scope.type === 'ids' ? scope.ids : null

      // 需要内存过滤（产线/部门/orderType/dateRange）时拉全量再过滤
      // API 不支持这些参数，page 1 只有最�� 20 条，会漏掉历史数据
      const needFullScan = !!(scopeEquipmentIds || args.orderType || args.dateRange) && !args.groupBy

      let list: RepairOrder[]
      let total: number

      if (needFullScan) {
        // 全量拉取 + 内存过滤
        const all = await eamGetAll<RepairOrder>('/eam/repair-order/page', args.status !== undefined ? { status: args.status } : {})
        list = all
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
        total = list.length
        list = list.slice(0, args.limit) // 截断到 limit
      } else {
        // groupBy 模式或无内存过滤 — 使用 eamSearch（groupBy 时自动全量拉取）
        const eqToLine = args.groupBy === 'productionLine' ? await getEquipmentToLineMap() : null

        const result = await eamSearch<RepairOrder>('/eam/repair-order/page', params, {
          groupBy: args.groupBy,
          groupKeyFn: (r, gb) => gb === 'equipment' ? String(r.equipmentId)
            : gb === 'productionLine' ? (eqToLine?.get(r.equipmentId) ?? '未分配产线')
            : gb === 'orderType' ? (r.orderType ?? '未知')
            : REPAIR_STATUS[r.status] ?? String(r.status),
          limit: args.limit,
        })

        list = result.list
        total = result.total
        // groupBy + 内存过滤
        if (scopeEquipmentIds) { list = list.filter(r => scopeEquipmentIds!.includes(r.equipmentId)); total = list.length }
        if (args.orderType) { list = list.filter(r => r.orderType === args.orderType); total = list.length }
        if (args.dateRange) {
          const from = new Date(args.dateRange.from).getTime()
          const to = new Date(args.dateRange.to).getTime()
          list = list.filter(r => { const t = (r as any).createTime; return t >= from && t <= to })
          total = list.length
        }

        if (result.groups) {
          // 成本聚合必须在 enrichGroupNames 前执行
          // enrichGroupNames 会把 group key 从数字ID改为"CODE 名称"，之后无法匹配
          if (args.groupBy === 'equipment' || args.groupBy === 'productionLine') {
            const costByGroup = new Map<string, { laborCost: number; materialCost: number; totalCost: number; minutesSum: number }>()
            for (const r of list) {
              const key = args.groupBy === 'equipment' ? String(r.equipmentId)
                : (eqToLine?.get(r.equipmentId) ?? '未分配产线')
              const cur = costByGroup.get(key) ?? { laborCost: 0, materialCost: 0, totalCost: 0, minutesSum: 0 }
              cur.laborCost += r.laborCost ?? 0
              cur.materialCost += r.materialCost ?? 0
              cur.totalCost += (r.laborCost ?? 0) + (r.materialCost ?? 0)
              cur.minutesSum += r.repairMinutes ?? 0
              costByGroup.set(key, cur)
            }
            for (const g of result.groups) {
              const v = costByGroup.get(g.group)
              if (v) {
                Object.assign(g, {
                  laborCost: Math.round(v.laborCost * 100) / 100,
                  materialCost: Math.round(v.materialCost * 100) / 100,
                  totalCost: Math.round(v.totalCost * 100) / 100,
                  avgRepairMinutes: g.count > 0 ? Math.round(v.minutesSum / g.count) : 0,
                })
              }
            }
          }
          const enrichedGroups = args.groupBy === 'productionLine' ? result.groups : await enrichGroupNames(result.groups, args.groupBy!)
          const groupResult: Record<string, unknown> = { total, groupBy: args.groupBy, groups: enrichedGroups }
          if (resolvedEquipmentLabel) groupResult.context = `查询设备: ${resolvedEquipmentLabel}`
          return textResult(groupResult)
        }
      }

      // concise: 不做丰富化
      if (args.format === 'concise') {
        const conciseResult: Record<string, unknown> = {
          total,
          count: list.length,
          items: list.map(r => ({
            code: r.orderCode, status: REPAIR_STATUS[r.status], type: r.orderType,
            equipmentId: r.equipmentId, repairMinutes: r.repairMinutes,
            laborCost: r.laborCost, materialCost: r.materialCost,
          })),
        }
        if (resolvedEquipmentLabel) conciseResult.context = `查询设备: ${resolvedEquipmentLabel}`
        return textResult(conciseResult)
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
        const spareDetails = Array.isArray(spares) ? spares.map((s: any) => ({
          sparePartId: s.sparePartId,
          spareName: s.spareName,  // 备件名称（如果 API 返回了）
          quantity: s.quantity,
          unitPrice: s.unitPrice,
          totalPrice: s.totalPrice ?? (s.quantity ?? 0) * (s.unitPrice ?? 0),
        })) : []
        const knowledgeTitles = Array.isArray(knowledge) ? knowledge.map((k: any) => k.documentTitle ?? k.title ?? '').filter(Boolean) : []

        return {
          id: r.id, code: r.orderCode, status: r.status, statusText: REPAIR_STATUS[r.status],
          orderType: r.orderType, equipmentId: r.equipmentId,
          repairMinutes: r.repairMinutes, laborCost: r.laborCost, materialCost: r.materialCost,
          spareSummary: { count: spareCount, totalCost: spareCost, details: spareDetails },
          knowledgeRefs: knowledgeTitles,
        }
      }))

      // 批量查备件名称（spare API 的 usage 记录可能没有 spareName）
      const allSpareIds = new Set<number>()
      for (const item of enriched) {
        for (const d of item.spareSummary.details) {
          if (d.sparePartId && !d.spareName) allSpareIds.add(d.sparePartId)
        }
      }
      if (allSpareIds.size > 0) {
        try {
          const sparePage = await eamGet<{ list: Array<{ id: number; spareName: string; spareCode: string }> }>(
            '/eam/spare/part/page', { pageNo: 1, pageSize: allSpareIds.size + 10 }
          )
          const nameMap = new Map(sparePage.list.map(s => [s.id, s.spareName]))
          for (const item of enriched) {
            for (const d of item.spareSummary.details) {
              if (d.sparePartId && !d.spareName) {
                d.spareName = nameMap.get(d.sparePartId) ?? `备件#${d.sparePartId}`
              }
            }
          }
        } catch { /* 查不到名称不影响主流程 */ }
      }

      const detailResult: Record<string, unknown> = {
        total,
        count: enriched.length,
        items: enriched,
        ...(enriched.length < total ? { note: `详细模式仅展示前${enriched.length}条（含备件/知识引用），总计${total}条。如需全部工单基础信息请用 format=concise。` } : {}),
      }
      if (resolvedEquipmentLabel) detailResult.context = `查询设备: ${resolvedEquipmentLabel}`
      return textResult(detailResult)
    }
  )
}

const REPAIR_STATUS: Record<number, string> = {
  0: '待分配', 1: '待接单', 2: '维修中', 3: '挂起', 4: '待验收', 5: '已完成', 6: '已关闭',
}
