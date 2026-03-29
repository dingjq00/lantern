// eam.equipment.profile — 设备全景
// 输入任意标识符 → 解析设备 → 并行调 9 个 API → 聚合返回
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { eamGet, eamParallel, type PageResult, type Equipment, type FaultReport, type RepairOrder } from '../eam-api.js'
import { resolveEquipment } from '../resolvers.js'
import { textResult } from '../shared.js'

export function registerEquipmentProfile(server: McpServer) {
  server.tool(
    'eam.equipment.profile',
    '获取设备全景画像。输入设备名称、编号或ID，返回该设备的完整信息（基础信息+KPI+故障+维修+保养+巡检+BOM+生命周期）。当用户问"某设备怎么样""设备详情""设备状况"时使用。不要用于批量查询设备列表（用 eam.equipment.search）。',
    {
      identifier: z.string().describe('设备名称、设备编号或ID，如 "EQ-A301-001"、"薄膜包衣机" 或 "10101"'),
      format: z.enum(['detailed', 'concise']).optional().default('detailed').describe('detailed=全景信息, concise=只返回基础+KPI'),
    },
    async (args) => {
      // Step 0: 解析设备标识符
      const resolved = await resolveEquipment(args.identifier)

      if (resolved.match === 'none') {
        return textResult({ error: '未找到匹配的设备', identifier: args.identifier })
      }

      if (resolved.match === 'candidates') {
        return textResult({
          message: `找到多个匹配的设备，请确认您要查看哪一个`,
          candidates: resolved.candidates,
        })
      }

      const equipment = resolved.entity!
      const eqId = equipment.id

      // concise 模式: 只返回基础信息 + KPI
      if (args.format === 'concise') {
        let kpi = null
        try { kpi = await eamGet('/eam/equipment/kpi', { id: eqId }) } catch { /* 部分设备可能没有 KPI */ }

        return textResult({
          equipment: formatEquipmentBasic(equipment),
          kpi,
        })
      }

      // detailed 模式: 并行调用所有子 API
      const [kpi, lifecycle, faults, repairs, maintenance, patrol, bom] = await eamParallel<[
        unknown, unknown[], PageResult<FaultReport>, PageResult<RepairOrder>,
        PageResult<unknown>, unknown, unknown[]
      ]>(
        () => eamGet('/eam/equipment/kpi', { id: eqId }).catch(() => null),
        () => eamGet<unknown[]>('/eam/equipment/lifecycle-timeline', { equipmentId: eqId }).catch(() => []),
        () => eamGet<PageResult<FaultReport>>('/eam/fault-report/page', { equipmentId: eqId, pageNo: 1, pageSize: 5 }),
        () => eamGet<PageResult<RepairOrder>>('/eam/repair-order/page', { equipmentId: eqId, pageNo: 1, pageSize: 5 }),
        () => eamGet<PageResult<unknown>>('/eam/maintenance/task/page', { equipmentId: eqId, pageNo: 1, pageSize: 5 }),
        () => eamGet('/eam/patrol/task/equipment-records', { equipmentId: eqId }).catch(() => null),
        () => eamGet<unknown[]>('/eam/spare/bom/by-equipment', { equipmentId: eqId }).catch(() => []),
      )

      // BOM 关联库存查询（依赖 BOM 结果）
      let bomWithStock = bom ?? []
      if (Array.isArray(bom) && bom.length > 0) {
        const spareIds = bom.map((b: any) => b.spareId ?? b.sparePartId).filter(Boolean)
        if (spareIds.length > 0) {
          try {
            const stockSummary = await eamGet('/eam/spare/part/stock-summary', { ids: spareIds.join(',') })
            bomWithStock = bom.map((b: any) => ({
              ...b,
              stock: (stockSummary as any)?.[b.spareId ?? b.sparePartId] ?? null,
            }))
          } catch {
            // 库存查询失败不影响主流程
          }
        }
      }

      return textResult({
        equipment: formatEquipmentBasic(equipment),
        kpi,
        recentFaults: faults?.list ?? [],
        activeRepairs: repairs?.list?.filter((r: RepairOrder) => r.status < 5) ?? [],
        recentMaintenance: maintenance?.list ?? [],
        patrolRecords: patrol,
        bom: bomWithStock,
        lifecycle: lifecycle ?? [],
      })
    }
  )
}

/** 格式化设备基础信息（人类可读） */
function formatEquipmentBasic(eq: Equipment) {
  return {
    id: eq.id,
    code: eq.equipmentCode,
    name: eq.equipmentName,
    status: eq.status,
    statusText: STATUS_MAP[eq.status] ?? `未知(${eq.status})`,
    categoryId: eq.categoryId,
    deptId: eq.deptId,
    locationId: eq.locationId,
    manufacturer: eq.manufacturer,
    model: eq.model,
    isKey: eq.isKey === 1,
    responsiblePersonIds: eq.responsiblePersonIds,
    createTime: eq.createTime,
  }
}

const STATUS_MAP: Record<number, string> = {
  0: '待验收', 1: '运行中', 2: '维修中', 3: '停机',
  4: '封存', 5: '待整改', 6: '闲置', 7: '报废', 8: '其他',
}
