// 故障维修域 handlers（4 个工具）
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerFaultRepairHandlers(server: McpServer) {
  server.tool('query_fault_reports', '查询故障报修记录', {
    equipmentId: z.number().int().optional(),
    status: z.number().int().optional(),
    faultTypeId: z.number().int().optional(),
    dateRange: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional(),
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      total: 15,
      items: [
        { faultReportId: 301, equipmentName: 'CNC-001', faultType: '机械故障', status: '已通过', reportTime: '2026-03-10 09:30', description: '主轴异响' },
        { faultReportId: 302, equipmentName: 'PACK-001', faultType: '电气故障', status: '待审核', reportTime: '2026-03-15 14:20', description: '变频器报警' },
        { faultReportId: 303, equipmentName: 'CNC-002', faultType: '机械故障', status: '已通过', reportTime: '2026-03-20 08:15', description: '导轨润滑不良' },
      ]
    })}]
  }))

  server.tool('query_repair_orders', '查询维修工单列表', {
    equipmentId: z.number().int().optional(),
    status: z.number().int().optional(),
    dateRange: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional(),
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      total: 12,
      items: [
        { repairOrderId: 201, equipmentName: 'CNC-001', status: '已关闭', createTime: '2026-03-10 10:00', finishTime: '2026-03-11 15:30' },
        { repairOrderId: 202, equipmentName: 'PACK-001', status: '维修中', createTime: '2026-03-15 15:00', finishTime: null },
        { repairOrderId: 203, equipmentName: 'CNC-002', status: '待接单', createTime: '2026-03-20 09:00', finishTime: null },
      ]
    })}]
  }))

  server.tool('get_repair_detail', '获取维修工单完整详情', {
    repairOrderId: z.number().int().optional(),
    faultReportId: z.number().int().optional(),
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      repairOrder: {
        repairOrderId: args.repairOrderId ?? 201,
        equipmentName: 'CNC-001',
        faultDescription: '主轴异响',
        status: '已关闭',
        createTime: '2026-03-10 10:00',
        finishTime: '2026-03-11 15:30',
        repairHours: 5.5,
      },
      sparesUsed: [
        { spareId: 401, spareName: '主轴轴承 SKF-6205', quantity: 2, unit: '个' },
        { spareId: 402, spareName: '润滑脂 Shell EP2', quantity: 1, unit: '桶' },
      ],
      laborRecords: [
        { worker: '张三', hours: 3.5, type: '维修' },
        { worker: '李四', hours: 2.0, type: '辅助' },
      ],
      knowledgeRefs: [
        { title: '数控车床主轴维修规范', docId: 601 },
      ]
    })}]
  }))

  server.tool('get_fault_trend', '获取故障趋势分析', {
    days: z.number().int().default(30),
    equipmentId: z.number().int().optional(),
    productionLineId: z.number().int().optional(),
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      days: args.days,
      totalFaults: 23,
      avgPerDay: 0.77,
      trend: [
        { date: '2026-03-01', count: 1 },
        { date: '2026-03-05', count: 2 },
        { date: '2026-03-10', count: 3 },
        { date: '2026-03-15', count: 1 },
        { date: '2026-03-20', count: 2 },
        { date: '2026-03-25', count: 1 },
      ]
    })}]
  }))
}
