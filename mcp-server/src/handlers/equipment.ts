// 设备域 handlers（4 个工具）
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerEquipmentHandlers(server: McpServer) {
  server.tool('query_equipment', '按条件查询设备列表', {
    keyword: z.string().optional(),
    status: z.number().int().optional(),
    categoryId: z.number().int().optional(),
    locationId: z.number().int().optional(),
    productionLineId: z.number().int().optional(),
    deptId: z.number().int().optional(),
    isKey: z.number().int().optional(),
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      total: 128,
      items: [
        { equipmentId: 101, name: 'CNC-001 数控车床', code: 'CNC-001', status: 1, category: '数控设备', location: 'A车间', productionLine: 'A线' },
        { equipmentId: 102, name: 'CNC-002 数控铣床', code: 'CNC-002', status: 1, category: '数控设备', location: 'A车间', productionLine: 'A线' },
        { equipmentId: 103, name: 'PACK-001 包装机', code: 'PACK-001', status: 2, category: '包装设备', location: 'B车间', productionLine: 'B线' },
      ]
    })}]
  }))

  server.tool('get_equipment_detail', '获取单台设备完整详情', {
    equipmentId: z.number().int(),
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      equipmentId: args.equipmentId,
      name: 'CNC-001 数控车床',
      code: 'CNC-001',
      status: 1,
      statusText: '运行中',
      category: '数控设备',
      location: 'A车间-01工位',
      productionLine: 'A线',
      manufacturer: '沈阳机床',
      purchaseDate: '2023-06-15',
      kpi: { faultCount: 3, avgRepairHours: 4.5, maintenanceRate: 92.5, mtbf: 720 }
    })}]
  }))

  server.tool('get_equipment_lifecycle', '获取设备全生命周期时间线', {
    equipmentId: z.number().int(),
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      equipmentId: args.equipmentId,
      events: [
        { date: '2023-06-15', type: '购置', detail: '采购入库' },
        { date: '2023-06-20', type: '验收', detail: '验收合格' },
        { date: '2023-07-01', type: '投产', detail: '状态变更为运行中' },
        { date: '2024-03-15', type: '故障', detail: '主轴异响' },
        { date: '2024-03-16', type: '维修', detail: '更换主轴轴承' },
        { date: '2025-01-10', type: '保养', detail: '年度大保养' },
      ]
    })}]
  }))

  server.tool('get_equipment_status_distribution', '获取设备状态分布统计', {}, async () => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      distribution: [
        { status: '运行中', count: 98 },
        { status: '维修中', count: 8 },
        { status: '停机', count: 5 },
        { status: '封存', count: 3 },
        { status: '闲置', count: 7 },
        { status: '报废', count: 4 },
        { status: '待验收', count: 2 },
        { status: '待整改', count: 1 },
      ],
      total: 128
    })}]
  }))
}
