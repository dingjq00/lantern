// eam.scope.overview — 范围概览（层级自适应）
// 输入任意层级标识符 → 三棵树匹配 → 查设备列表 → 各域汇总
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { eamGetAll, eamParallel, type Equipment, type FaultReport, type RepairOrder } from '../eam-api.js'
import { resolveProductionLine, resolveDepartment, getEquipmentIdsByProductionLine } from '../resolvers.js'

export function registerScopeOverview(server: McpServer) {
  server.tool(
    'eam.scope.overview',
    '获取某个范围的概览画像（车间/产线/部门/区域）。输入范围名称，自动在产线、部门、位置中匹配。返回该范围下的设备列表和各域汇总指标。当用户问"一车间怎么样""A线概览""研发部门设备情况"时使用。不要用于全局概览（用 eam.dashboard）。',
    {
      identifier: z.string().describe('范围名称: 车间名/产线名/部门名/区域名'),
      format: z.enum(['detailed', 'concise']).optional().default('detailed').describe('concise=只返回汇总指标，不含设备清单'),
    },
    async (args) => {
      // Step 1: 三棵树匹配（优先级: ProductionLine > Department > Location）
      let scopeType: 'productionLine' | 'department' | 'location' = 'department'
      let scopeName = args.identifier
      let scopeId: number | null = null
      let equipmentIds: number[] = []

      // 先查产线
      const line = await resolveProductionLine(args.identifier)
      if (line.match === 'exact' && line.entity) {
        scopeType = 'productionLine'
        scopeName = line.entity.lineName
        scopeId = line.entity.id
        equipmentIds = await getEquipmentIdsByProductionLine(line.entity.id)
      }

      // 产线没匹配到，查部门
      if (!scopeId) {
        const dept = await resolveDepartment(args.identifier)
        if (dept.match === 'exact' && dept.entity) {
          scopeType = 'department'
          scopeName = dept.entity.name
          scopeId = dept.entity.id
        } else if (dept.match === 'candidates') {
          return textResult({ message: '找到多个匹配，请确认', candidates: dept.candidates })
        }
      }

      // 都没匹配到
      if (!scopeId) {
        return textResult({ error: '未找到匹配的范围', identifier: args.identifier, hint: '请输入产线名、部门名或车间名' })
      }

      // Step 2: 获取设备列表
      let equipmentList: Equipment[] = []
      if (scopeType === 'productionLine' && equipmentIds.length > 0) {
        // 产线: 已有设备ID列表，拉全量后过滤
        const all = await eamGetAll<Equipment>('/eam/equipment/page')
        equipmentList = all.filter(e => equipmentIds.includes(e.id))
      } else if (scopeType === 'department') {
        equipmentList = await eamGetAll<Equipment>('/eam/equipment/page', { deptId: scopeId })
      }

      // Step 3: 各域汇总（基于设备列表并行查）
      const eqIds = equipmentList.map(e => e.id)

      // 设备按状态分布
      const statusDist: Record<string, number> = {}
      for (const eq of equipmentList) {
        const s = STATUS_MAP[eq.status] ?? String(eq.status)
        statusDist[s] = (statusDist[s] ?? 0) + 1
      }

      // 并行查各域数据
      const [faultAll, repairAll, maintAll, anomalyAll] = await eamParallel<[
        FaultReport[] | null, RepairOrder[] | null, any[] | null, any[] | null
      ]>(
        () => eqIds.length > 0
          ? eamGetAll<FaultReport>('/eam/fault-report/page')
            .then(all => all.filter(f => eqIds.includes(f.equipmentId)))
          : Promise.resolve(null),
        () => eqIds.length > 0
          ? eamGetAll<RepairOrder>('/eam/repair-order/page')
            .then(all => all.filter(r => eqIds.includes(r.equipmentId)))
          : Promise.resolve(null),
        () => eqIds.length > 0
          ? eamGetAll<any>('/eam/maintenance/task/page')
            .then(all => all.filter((t: any) => eqIds.includes(t.equipmentId)))
          : Promise.resolve(null),
        () => eqIds.length > 0
          ? eamGetAll<any>('/eam/anomaly/page')
            .then(all => all.filter((a: any) => eqIds.includes(a.equipmentId)))
          : Promise.resolve(null),
      )

      // 计算汇总指标
      const faultList = faultAll ?? []
      const repairList = repairAll ?? []
      const maintList = maintAll ?? []
      const anomalyList = anomalyAll ?? []

      const maintCompleted = maintList.filter((t: any) => t.status === 2).length
      const maintTotal = maintList.length

      const result: any = {
        scope: { type: scopeType, name: scopeName, id: scopeId },
        equipment: {
          total: equipmentList.length,
          statusDistribution: statusDist,
          keyEquipmentCount: equipmentList.filter(e => e.isKey === 1).length,
        },
        fault: {
          total: faultList.length,
          pending: faultList.filter(f => f.status === 0).length,
        },
        repair: {
          total: repairList.length,
          inProgress: repairList.filter((r: RepairOrder) => r.status >= 1 && r.status <= 3).length,
        },
        maintenance: {
          total: maintTotal,
          completed: maintCompleted,
          completionRate: maintTotal > 0 ? `${Math.round(maintCompleted / maintTotal * 100)}%` : 'N/A',
          overdue: maintList.filter((t: any) => t.status === 3).length,
        },
        anomaly: {
          total: anomalyList.length,
        },
      }

      // detailed: 附设备清单
      if (args.format === 'detailed') {
        result.equipmentList = equipmentList.slice(0, 50).map(eq => ({
          code: eq.equipmentCode, name: eq.equipmentName,
          status: eq.status, statusText: STATUS_MAP[eq.status],
          isKey: eq.isKey === 1,
        }))
      }

      return textResult(result)
    }
  )
}

const STATUS_MAP: Record<number, string> = {
  0: '待验收', 1: '运行中', 2: '维修中', 3: '停机', 4: '封存', 5: '待整改', 6: '闲置', 7: '报废',
}

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}
