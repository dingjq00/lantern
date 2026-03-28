// eam.spare.search — 备件搜索
// 支持按名称/设备BOM/分类/库存预警过滤
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { eamGet, eamParallel, type PageResult } from '../eam-api.js'
import { resolveEquipment } from '../resolvers.js'

interface SparePart {
  id: number; spareCode: string; spareName: string; specModel: string | null
  spareTypeId: number | null; unit: string | null; refPrice: number | null
  stockUpper: number | null; stockLower: number | null; [key: string]: unknown
}

export function registerSpareSearch(server: McpServer) {
  server.tool(
    'eam.spare.search',
    '按条件搜索备件列表。支持按名称/编号搜索、按设备BOM关联查询、按分类过滤、筛选库存预警。返回每个备件的库存水位和关联设备数。当用户问"备件库存""哪些备件不足""这台设备需要什么备件"时使用。',
    {
      identifier: z.string().optional().describe('备件名称或编号'),
      equipment: z.string().optional().describe('查 BOM 关联: 这台设备需要哪些备件'),
      category: z.string().optional().describe('备件分类名称或ID'),
      lowStock: z.boolean().optional().describe('仅库存不足/预警'),
      format: z.enum(['detailed', 'concise']).optional().default('detailed'),
      limit: z.number().int().optional().default(20),
    },
    async (args) => {
      // 模式1: 按设备 BOM 查关联备件
      if (args.equipment) {
        const eq = await resolveEquipment(args.equipment)
        if (eq.match === 'exact' && eq.entity) {
          const bom = await eamGet<any[]>('/eam/spare/bom/by-equipment', { equipmentId: eq.entity.id }).catch(() => [])
          if (!Array.isArray(bom) || bom.length === 0) {
            return textResult({
              equipment: { code: eq.entity.equipmentCode, name: eq.entity.equipmentName },
              message: '该设备没有 BOM 备件清单',
              bom: [],
            })
          }

          // 查库存
          const spareIds = bom.map((b: any) => b.spareId ?? b.sparePartId).filter(Boolean)
          let stockMap: Record<number, any> = {}
          if (spareIds.length > 0) {
            try {
              stockMap = await eamGet('/eam/spare/part/stock-summary', { ids: spareIds.join(',') }) as any
            } catch { /* 库存查询失败不影响主流程 */ }
          }

          const items = bom.map((b: any) => {
            const spareId = b.spareId ?? b.sparePartId
            const stock = (stockMap as any)?.[spareId]
            return {
              spareId, spareName: b.spareName, spareCode: b.spareCode,
              quantity: b.quantity, // BOM 中需要的数量
              currentStock: stock ?? null,
              lowStock: stock !== null && b.stockLower !== null ? stock <= b.stockLower : null,
            }
          })

          return textResult({
            equipment: { code: eq.entity.equipmentCode, name: eq.entity.equipmentName },
            bomCount: items.length,
            items,
          })
        } else if (eq.match === 'candidates') {
          return textResult({ message: '找到多个匹配设备，请确认', candidates: eq.candidates })
        }
      }

      // 模式2: 备件列表搜索
      const params: Record<string, unknown> = { pageNo: 1, pageSize: args.limit }
      if (args.identifier) params.spareName = args.identifier
      if (args.category) {
        if (/^\d+$/.test(args.category)) params.spareTypeIds = args.category
      }

      const page = await eamGet<PageResult<SparePart>>('/eam/spare/part/page', params)
      let list = page.list

      // 查库存水位
      const spareIds = list.map(s => s.id)
      let stockMap: Record<number, any> = {}
      if (spareIds.length > 0) {
        try {
          stockMap = await eamGet('/eam/spare/part/stock-summary', { ids: spareIds.join(',') }) as any
        } catch { /* */ }
      }

      // lowStock 过滤
      if (args.lowStock) {
        list = list.filter(s => {
          const stock = (stockMap as any)?.[s.id]
          return stock !== undefined && s.stockLower !== null && stock <= s.stockLower
        })
      }

      // 查关联设备数（批量）
      const bomCounts: Record<number, number> = {}
      await Promise.all(list.slice(0, 10).map(async (s) => {
        try {
          const bom = await eamGet<any[]>('/eam/spare/bom/by-spare', { spareId: s.id })
          bomCounts[s.id] = Array.isArray(bom) ? bom.length : 0
        } catch {
          bomCounts[s.id] = 0
        }
      }))

      const items = list.map(s => {
        const stock = (stockMap as any)?.[s.id] ?? null
        const base: any = {
          id: s.id, code: s.spareCode, name: s.spareName,
          currentStock: stock,
          stockLower: s.stockLower, stockUpper: s.stockUpper,
          lowStock: stock !== null && s.stockLower !== null ? stock <= s.stockLower : null,
          equipmentCount: bomCounts[s.id] ?? null,
        }
        if (args.format === 'detailed') {
          base.specModel = s.specModel
          base.unit = s.unit
          base.refPrice = s.refPrice
        }
        return base
      })

      return textResult({ total: page.total, count: items.length, items })
    }
  )
}

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}
