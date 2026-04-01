// mes.sublot.search — 子批次追踪（库位、质量状态）
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { mesClient, type JmixCondition } from '../../jmix-api.js'
import { textResult } from '../../shared.js'

export function registerMesSublotSearch(server: McpServer) {
  server.tool(
    'mes.sublot.search',
    '查询子批次(Sublot)信息，支持按子批号、批号、质量状态、库位过滤，可按质量状态聚合。适用于"这个子批在哪个库位""有多少不合格的子批""某批号下有几个子批"等追溯问题。',
    {
      sublotCode: z.string().optional().describe('子批号（模糊匹配）'),
      lotCode: z.string().optional().describe('所属批号（模糊匹配）'),
      qualityStatus: z.string().optional().describe('质量状态: VALID/INVALID/BLOCKED/EXPIRED'),
      palletCode: z.string().optional().describe('托盘号（模糊匹配）'),
      groupBy: z.enum(['sublotQualityStatus']).optional().describe('按质量状态聚合'),
      limit: z.number().int().optional().default(20),
    },
    async (args) => {
      const conditions: JmixCondition[] = []
      if (args.sublotCode) conditions.push({ property: 'sublotCode', operator: 'contains', value: args.sublotCode })
      if (args.lotCode) conditions.push({ property: 'lot.lotCode', operator: 'contains', value: args.lotCode })
      if (args.qualityStatus) conditions.push({ property: 'sublotQualityStatus', operator: '=', value: args.qualityStatus })
      if (args.palletCode) conditions.push({ property: 'palletCode', operator: 'contains', value: args.palletCode })

      const filter = { conditions }

      if (args.groupBy) {
        const all = conditions.length > 0
          ? await mesClient.getAll('Sublot', { filter, fetchPlan: '_local' })
          : await mesClient.getAll('Sublot', { fetchPlan: '_local' })
        const groups = new Map<string, number>()
        for (const s of all) {
          const key = String(s.sublotQualityStatus ?? '未知')
          groups.set(key, (groups.get(key) ?? 0) + 1)
        }
        const sorted = [...groups.entries()].sort((a, b) => b[1] - a[1]).map(([group, count]) => ({ group, count }))
        return textResult({ total: all.length, groupBy: args.groupBy, groups: sorted })
      }

      const result = conditions.length > 0
        ? await mesClient.search('Sublot', filter, { limit: args.limit, sort: '-createdDate', returnCount: true })
        : await mesClient.list('Sublot', { limit: args.limit, sort: '-createdDate', returnCount: true })

      const items = result.items.map(s => ({
        sublotCode: s.sublotCode,
        qualityStatus: s.sublotQualityStatus,
        lot: s.lot ? { lotCode: (s.lot as any).lotCode } : null,
        palletCode: s.palletCode || null,
        warehouseLocation: s.warehouseLocation ? (s.warehouseLocation as any)._instanceName : null,
        initialQuantity: s.initialQuantity,
        currentQuantity: s.currentQuantiy,  // 注意: 实体字段拼写是 currentQuantiy（原代码如此）
        createdDate: s.createdDate,
      }))

      return textResult({ total: result.count ?? items.length, count: items.length, items })
    }
  )
}
