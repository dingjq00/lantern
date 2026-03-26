// 仪表盘域 + 通用聚合 handlers
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerDashboardHandlers(server: McpServer) {
  server.tool('get_dashboard_summary', '获取系统总览统计', {}, async () => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      totalEquipment: 128,
      runningCount: 98,
      faultCount: 8,
      scrappedCount: 4,
      pendingFaults: 3,
      pendingOrders: 5,
      pendingMaintenance: 12,
    })}]
  }))

  server.tool('get_governance_dashboard', '获取治理看板', {
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    keyword: z.string().optional(),
    drilldown: z.boolean().default(false),
  }, async () => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      healthScore: 87.5,
      dataQualityScore: 92.1,
      auditMetrics: { compliantRate: 95.3, missingFieldRate: 2.1, overdueMaintenanceRate: 4.6 },
    })}]
  }))

  server.tool('get_todo_list', '获取待办事项', {}, async () => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      pendingFaults: [
        { id: 302, type: '故障报修', title: 'PACK-001 变频器报警', priority: '高' },
      ],
      pendingOrders: [
        { id: 203, type: '维修工单', title: 'CNC-002 导轨润滑', priority: '中' },
        { id: 204, type: '维修工单', title: 'PACK-002 传感器校准', priority: '低' },
      ],
      pendingMaintenance: [
        { id: 502, type: '保养任务', title: 'CNC-002 月度保养', priority: '中', dueDate: '2026-03-28' },
      ]
    })}]
  }))

  // 通用聚合工具
  server.tool('aggregate_data', '对任意数据源做聚合统计', {
    source: z.string(),
    groupBy: z.string(),
    operation: z.string().default('count'),
    valueField: z.string().optional(),
    sortBy: z.string().default('value_desc'),
    limit: z.number().int().optional(),
    dateRange: z.object({ start: z.string().optional(), end: z.string().optional() }).optional(),
  }, async (args) => {
    // Mock: 根据 source + groupBy 返回预设聚合结果
    const mockAggregations: Record<string, unknown> = {
      'equipment:category': { groups: [{ key: '数控设备', value: 45 }, { key: '包装设备', value: 28 }, { key: '注塑设备', value: 22 }, { key: '焊接设备', value: 18 }, { key: '检测设备', value: 15 }], total: 128 },
      'equipment:status': { groups: [{ key: '运行中', value: 98 }, { key: '维修中', value: 8 }, { key: '停机', value: 5 }, { key: '闲置', value: 7 }, { key: '报废', value: 4 }, { key: '封存', value: 3 }, { key: '待验收', value: 2 }, { key: '待整改', value: 1 }], total: 128 },
      'equipment:productionLine': { groups: [{ key: 'A线', value: 42 }, { key: 'B线', value: 35 }, { key: 'C线', value: 28 }, { key: '仓库区', value: 23 }], total: 128 },
      'fault_reports:equipmentId': { groups: [{ key: 'CNC-001', value: 5 }, { key: 'PACK-001', value: 3 }, { key: 'CNC-002', value: 2 }, { key: 'PACK-002', value: 2 }], total: 15 },
      'fault_reports:faultType': { groups: [{ key: '机械故障', value: 8 }, { key: '电气故障', value: 5 }, { key: '液压故障', value: 2 }], total: 15 },
      'fault_reports:productionLine': { groups: [{ key: 'A线', value: 7 }, { key: 'B线', value: 5 }, { key: 'C线', value: 3 }], total: 15 },
      'repair_orders:equipmentId': { groups: [{ key: 'CNC-001', value: 4 }, { key: 'PACK-001', value: 3 }, { key: 'CNC-002', value: 3 }, { key: 'PACK-002', value: 2 }], total: 12 },
      'maintenance_tasks:status': { groups: [{ key: '已完成', value: 5 }, { key: '待执行', value: 2 }, { key: '执行中', value: 1 }], total: 8 },
      'anomaly_records:equipmentId': { groups: [{ key: 'CNC-001', value: 3 }, { key: 'PACK-001', value: 2 }, { key: 'CNC-002', value: 1 }], total: 6 },
      'anomaly_records:source': { groups: [{ key: '巡检', value: 4 }, { key: '保养', value: 2 }], total: 6 },
    }
    const key = `${args.source}:${args.groupBy}`
    const result = mockAggregations[key] ?? { groups: [{ key: '未知', value: 0 }], total: 0, note: `暂无 ${args.source} 按 ${args.groupBy} 的聚合数据` }
    // 应用 limit
    if (args.limit && (result as any).groups) {
      (result as any).groups = (result as any).groups.slice(0, args.limit)
    }
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
  })
}
