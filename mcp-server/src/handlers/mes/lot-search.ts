// mes.lot.search — 批次/批号查询与追溯
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { mesClient, type JmixCondition } from '../../jmix-api.js'
import { textResult } from '../../shared.js'

export function registerMesLotSearch(server: McpServer) {
  server.tool(
    'mes.lot.search',
    '查询批次（Lot）信息，支持按批号、物料编号、供应商、生产日期过滤。返回批次基本信息及子批次(Sublot)数量。适用于"这个批号在哪""物料A的批次有哪些""供应商X供了多少批"等追溯问题。',
    {
      lotCode: z.string().optional().describe('批号（模糊匹配）'),
      materialCode: z.string().optional().describe('物料编号（模糊匹配）'),
      vendorName: z.string().optional().describe('供应商名称（模糊匹配）'),
      dateRange: z.object({ from: z.string(), to: z.string() }).optional().describe('生产日期范围'),
      limit: z.number().int().optional().default(20),
    },
    async (args) => {
      const conditions: JmixCondition[] = []
      if (args.lotCode) conditions.push({ property: 'lotCode', operator: 'contains', value: args.lotCode })
      if (args.materialCode) conditions.push({ property: 'material.materialCode', operator: 'contains', value: args.materialCode })
      if (args.vendorName) conditions.push({ property: 'venderName', operator: 'contains', value: args.vendorName })
      if (args.dateRange) {
        conditions.push({ property: 'producedDate', operator: '>=', value: args.dateRange.from })
        conditions.push({ property: 'producedDate', operator: '<=', value: args.dateRange.to })
      }

      const filter = { conditions }

      const result = conditions.length > 0
        ? await mesClient.search('Lot', filter, { limit: args.limit, sort: '-createdDate', returnCount: true })
        : await mesClient.list('Lot', { limit: args.limit, sort: '-createdDate', returnCount: true })

      const items = result.items.map(lot => ({
        lotCode: lot.lotCode,
        material: lot.material ? {
          code: (lot.material as any).materialCode,
          name: (lot.material as any).materialName,
        } : null,
        vendorName: lot.venderName || null,
        vendorLotCode: lot.venderLotCode || null,
        producedDate: lot.producedDate,
        expireDate: lot.expireDate,
        reInspectionDate: lot.reInspectionDate,
        sublotCount: Array.isArray(lot.sublots) ? lot.sublots.length : lot.sublotTotalNumber ?? 0,
      }))

      return textResult({ total: result.count ?? items.length, count: items.length, items })
    }
  )
}
