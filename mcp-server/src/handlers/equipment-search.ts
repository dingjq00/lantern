// eam.equipment.search — 设备列表搜索
// 支持按状态/分类/产线/部门/位置/重点设备过滤 + groupBy 聚合
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { eamSearch, type Equipment } from '../eam-api.js'
import { resolveProductionLine, resolveDepartment, getEquipmentIdsByProductionLine } from '../resolvers.js'
import { textResult } from '../shared.js'

export function registerEquipmentSearch(server: McpServer) {
  server.tool(
    'eam.equipment.search',
    '按条件搜索设备列表。支持按状态、分类、产线、部门、位置、重点设备过滤，可按维度聚合统计。当用户问"维修中的设备""A线有哪些设备""重点设备列表""设备分类统计"时使用。不要用于查看单台设备详情（用 eam.equipment.profile）。',
    {
      status: z.number().int().optional().describe('设备状态: 0=待验收 1=运行中 2=维修中 3=停机 4=封存 5=待整改 6=闲置 7=报废 8=其他'),
      category: z.string().optional().describe('设备分类名称或ID'),
      productionLine: z.string().optional().describe('产线名称或ID'),
      department: z.string().optional().describe('部门/车间名称或ID'),
      isKey: z.boolean().optional().describe('是否重点设备'),
      groupBy: z.enum(['status', 'category', 'department']).optional().describe('按维度聚合统计'),
      format: z.enum(['detailed', 'concise']).optional().default('detailed'),
      limit: z.number().int().optional().default(20).describe('返回条数，默认20'),
    },
    async (args) => {
      const params: Record<string, unknown> = { pageNo: 1, pageSize: args.limit }

      if (args.status !== undefined) params.status = args.status
      if (args.isKey !== undefined) params.isKey = args.isKey ? 1 : 0

      // 分类解析（直接传 categoryId 或按名称搜后得 ID）
      if (args.category) {
        if (/^\d+$/.test(args.category)) {
          params.categoryId = args.category
        } else {
          params.keyword = args.category // 退化为 keyword 搜索
        }
      }

      // 部门解析
      if (args.department) {
        const dept = await resolveDepartment(args.department)
        if (dept.match === 'exact' && dept.entity) {
          params.deptId = dept.entity.id
        } else if (dept.match === 'candidates') {
          return textResult({ message: '找到多个匹配的部门，请确认', candidates: dept.candidates })
        }
      }

      // 产线过滤（API 不原生支持，需两步过滤）
      let productionLineFilter: number[] | null = null
      if (args.productionLine) {
        const line = await resolveProductionLine(args.productionLine)
        if (line.match === 'exact' && line.entity) {
          productionLineFilter = await getEquipmentIdsByProductionLine(line.entity.id)
        } else if (line.match === 'candidates') {
          return textResult({ message: '找到多个匹配的产线，请确认', candidates: line.candidates })
        }
      }

      // 防御: status 已指定具体值时，groupBy=status 是多余的（过滤后再分组=100%同状态）
      const effectiveGroupBy = (args.groupBy === 'status' && args.status !== undefined) ? undefined : args.groupBy

      // 通用搜索（自动处理 groupBy 全量拉取 + 普通分页）
      const result = await eamSearch<Equipment>('/eam/equipment/page', params, {
        groupBy: effectiveGroupBy,
        groupKeyFn: (eq, gb) => gb === 'status' ? STATUS_MAP[eq.status] ?? String(eq.status)
          : gb === 'category' ? String(eq.categoryId ?? '未分类')
          : String(eq.deptId ?? '未分配'),
        limit: args.limit,
        fullScan: !args.groupBy,
      })

      let { list, total } = result

      // 产线二次过滤
      if (productionLineFilter) {
        list = list.filter(e => productionLineFilter!.includes(e.id))
        total = list.length
      }

      // groupBy 返回
      if (result.groups) {
        return textResult({ total, groupBy: args.groupBy, groups: result.groups })
      }

      // 列表返回
      const items = list.map(eq => args.format === 'concise'
        ? { code: eq.equipmentCode, name: eq.equipmentName, status: STATUS_MAP[eq.status] }
        : {
            id: eq.id, code: eq.equipmentCode, name: eq.equipmentName,
            status: eq.status, statusText: STATUS_MAP[eq.status],
            categoryId: eq.categoryId, deptId: eq.deptId, locationId: eq.locationId,
            isKey: eq.isKey === 1, manufacturer: eq.manufacturer, model: eq.model,
          }
      )

      return textResult({ total, count: items.length, items })
    }
  )
}

const STATUS_MAP: Record<number, string> = {
  0: '待验收', 1: '运行中', 2: '维修中', 3: '停机', 4: '封存', 5: '待整改', 6: '闲置', 7: '报废', 8: '其他',
}
