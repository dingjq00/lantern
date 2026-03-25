// 备件域 handlers（5 个工具）
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerSpareHandlers(server: McpServer) {
  server.tool('query_spare_parts', '查询备件列表', {
    keyword: z.string().optional(),
    typeId: z.number().int().optional(),
    status: z.number().int().optional(),
  }, async () => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      total: 350,
      items: [
        { spareId: 401, name: '主轴轴承 SKF-6205', code: 'SP-001', type: '轴承', specification: '6205-2RS', unit: '个' },
        { spareId: 402, name: '润滑脂 Shell EP2', code: 'SP-002', type: '润滑材料', specification: '15kg/桶', unit: '桶' },
        { spareId: 403, name: '传动带 3V-500', code: 'SP-003', type: '传动件', specification: '3V-500', unit: '条' },
      ]
    })}]
  }))

  server.tool('get_spare_stock', '查询备件库存', {
    spareId: z.number().int().optional(),
    warehouseId: z.number().int().optional(),
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      items: [
        { spareId: args.spareId ?? 401, spareName: '主轴轴承 SKF-6205', warehouseId: 1, warehouseName: '主仓库', quantity: 15, safetyStock: 10 },
        { spareId: args.spareId ?? 401, spareName: '主轴轴承 SKF-6205', warehouseId: 2, warehouseName: '车间仓', quantity: 3, safetyStock: 5 },
      ]
    })}]
  }))

  server.tool('get_equipment_spare_bom', '查询设备-备件BOM关联', {
    equipmentId: z.number().int().optional(),
    spareId: z.number().int().optional(),
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      items: [
        { equipmentId: args.equipmentId ?? 101, equipmentName: 'CNC-001', spareId: 401, spareName: '主轴轴承 SKF-6205', quantity: 2 },
        { equipmentId: args.equipmentId ?? 101, equipmentName: 'CNC-001', spareId: 402, spareName: '润滑脂 Shell EP2', quantity: 1 },
        { equipmentId: args.equipmentId ?? 101, equipmentName: 'CNC-001', spareId: 403, spareName: '传动带 3V-500', quantity: 3 },
      ]
    })}]
  }))

  server.tool('query_spare_transactions', '查询备件流转记录', {
    type: z.enum(['stock_in', 'stock_out', 'transfer', 'return', 'scrap', 'purchase']).optional(),
    spareId: z.number().int().optional(),
    dateRange: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional(),
  }, async () => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      total: 25,
      items: [
        { transactionId: 901, type: 'stock_out', spareName: '主轴轴承 SKF-6205', quantity: 2, warehouseName: '主仓库', createdAt: '2026-03-10', relatedOrder: 'WO-201' },
        { transactionId: 902, type: 'stock_in', spareName: '润滑脂 Shell EP2', quantity: 10, warehouseName: '主仓库', createdAt: '2026-03-12', relatedOrder: 'PO-105' },
      ]
    })}]
  }))

  server.tool('get_spare_alerts', '查询库存预警', {}, async () => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      alertCount: 3,
      items: [
        { spareId: 403, spareName: '传动带 3V-500', currentStock: 2, safetyStock: 10, shortage: 8 },
        { spareId: 404, spareName: '密封圈 OR-32', currentStock: 5, safetyStock: 20, shortage: 15 },
        { spareId: 405, spareName: '滤芯 HF-100', currentStock: 1, safetyStock: 5, shortage: 4 },
      ]
    })}]
  }))
}
