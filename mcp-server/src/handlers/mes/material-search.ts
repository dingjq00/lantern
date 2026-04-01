// mes.material.search — 物料主数据查询
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { mesClient, type JmixCondition } from '../../jmix-api.js'
import { textResult } from '../../shared.js'

export function registerMesMaterialSearch(server: McpServer) {
  server.tool(
    'mes.material.search',
    '搜索物料主数据。支持按物料编号、名称、类型过滤，可按类型聚合统计。适用于"系统有哪些物料""原材料有多少种""搜索轴承相关物料"等问题。',
    {
      materialCode: z.string().optional().describe('物料编号（模糊匹配）'),
      materialName: z.string().optional().describe('物料名称（模糊匹配）'),
      materialType: z.string().optional().describe('物料类型: RAW_MATERIAL/SEMI_FINISHED_PRODUCT/FINISHED_PRODUCT/PACKAGING_MATERIAL'),
      groupBy: z.enum(['materialType']).optional().describe('按物料类型聚合'),
      limit: z.number().int().optional().default(20),
    },
    async (args) => {
      const conditions: JmixCondition[] = []
      if (args.materialCode) conditions.push({ property: 'materialCode', operator: 'contains', value: args.materialCode })
      if (args.materialName) conditions.push({ property: 'materialName', operator: 'contains', value: args.materialName })
      if (args.materialType) conditions.push({ property: 'materialType', operator: '=', value: args.materialType })

      const filter = { conditions }

      if (args.groupBy) {
        const all = conditions.length > 0
          ? await mesClient.getAll('Material', { filter, fetchPlan: '_local' })
          : await mesClient.getAll('Material', { fetchPlan: '_local' })
        const groups = new Map<string, number>()
        for (const m of all) {
          const key = String(m.materialType ?? '未知')
          groups.set(key, (groups.get(key) ?? 0) + 1)
        }
        const sorted = [...groups.entries()].sort((a, b) => b[1] - a[1]).map(([group, count]) => ({ group, count }))
        return textResult({ total: all.length, groupBy: args.groupBy, groups: sorted })
      }

      const result = conditions.length > 0
        ? await mesClient.search('Material', filter, { limit: args.limit, sort: 'materialCode', returnCount: true })
        : await mesClient.list('Material', { limit: args.limit, sort: 'materialCode', returnCount: true })

      const items = result.items.map(m => ({
        code: m.materialCode,
        name: m.materialName,
        type: m.materialType,
        unit: m.unit,
        storageCondition: m.storageCondition || null,
        effectiveDuration: m.effectiveDuration,
        retestDuration: m.retestDuration,
      }))

      return textResult({ total: result.count ?? items.length, count: items.length, items })
    }
  )
}
