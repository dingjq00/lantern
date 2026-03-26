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

  // 通用聚合工具 — 对 mock 数据执行真实聚合逻辑（不是查表返回预设）
  server.tool('aggregate_data', '对任意数据源做聚合统计', {
    source: z.string(),
    groupBy: z.string(),
    operation: z.string().default('count'),
    valueField: z.string().optional(),
    sortBy: z.string().default('value_desc'),
    limit: z.number().int().optional(),
    dateRange: z.object({ start: z.string().optional(), end: z.string().optional() }).optional(),
  }, async (args) => {
    // Mock 数据源（接入真实 API 后替换为 REST 调用）
    const dataSources: Record<string, Array<Record<string, unknown>>> = {
      equipment: [
        { equipmentId: 101, name: 'CNC-001', category: '数控设备', status: '运行中', productionLine: 'A线' },
        { equipmentId: 102, name: 'CNC-002', category: '数控设备', status: '运行中', productionLine: 'A线' },
        { equipmentId: 103, name: 'PACK-001', category: '包装设备', status: '维修中', productionLine: 'B线' },
        { equipmentId: 104, name: 'PACK-002', category: '包装设备', status: '运行中', productionLine: 'B线' },
        { equipmentId: 105, name: 'INJ-001', category: '注塑设备', status: '运行中', productionLine: 'C线' },
        { equipmentId: 106, name: 'WELD-001', category: '焊接设备', status: '停机', productionLine: 'A线' },
        { equipmentId: 107, name: 'TEST-001', category: '检测设备', status: '运行中', productionLine: 'C线' },
      ],
      fault_reports: [
        { faultReportId: 301, equipmentName: 'CNC-001', faultType: '机械故障', productionLine: 'A线' },
        { faultReportId: 302, equipmentName: 'PACK-001', faultType: '电气故障', productionLine: 'B线' },
        { faultReportId: 303, equipmentName: 'CNC-002', faultType: '机械故障', productionLine: 'A线' },
        { faultReportId: 304, equipmentName: 'CNC-001', faultType: '液压故障', productionLine: 'A线' },
        { faultReportId: 305, equipmentName: 'PACK-001', faultType: '电气故障', productionLine: 'B线' },
      ],
      repair_orders: [
        { repairOrderId: 201, equipmentName: 'CNC-001', repairHours: 5.5, type: '内部' },
        { repairOrderId: 202, equipmentName: 'PACK-001', repairHours: 3.0, type: '外协' },
        { repairOrderId: 203, equipmentName: 'CNC-002', repairHours: 2.5, type: '内部' },
      ],
      maintenance_tasks: [
        { taskId: 501, equipmentName: 'CNC-001', status: '已完成', planName: '月度保养' },
        { taskId: 502, equipmentName: 'CNC-002', status: '待执行', planName: '月度保养' },
        { taskId: 503, equipmentName: 'PACK-001', status: '执行中', planName: '季度保养' },
      ],
      anomaly_records: [
        { anomalyId: 801, equipmentName: 'CNC-001', source: '巡检', severity: 2 },
        { anomalyId: 802, equipmentName: 'PACK-001', source: '保养', severity: 3 },
        { anomalyId: 803, equipmentName: 'CNC-002', source: '巡检', severity: 1 },
      ],
    }

    const data = dataSources[args.source]
    if (!data) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ error: `未知数据源: ${args.source}`, availableSources: Object.keys(dataSources) }) }] }
    }

    // 真实聚合逻辑
    const groupMap = new Map<string, number>()
    for (const item of data) {
      const key = String(item[args.groupBy] ?? '未知')
      const current = groupMap.get(key) ?? 0
      if (args.operation === 'count') {
        groupMap.set(key, current + 1)
      } else if (args.valueField && typeof item[args.valueField] === 'number') {
        const val = item[args.valueField] as number
        if (args.operation === 'sum') groupMap.set(key, current + val)
        else if (args.operation === 'max') groupMap.set(key, Math.max(current || -Infinity, val))
        else if (args.operation === 'min') groupMap.set(key, Math.min(current || Infinity, val))
      }
    }

    let groups = [...groupMap.entries()].map(([key, value]) => ({ key, value }))
    if (args.sortBy === 'value_desc') groups.sort((a, b) => b.value - a.value)
    else if (args.sortBy === 'value_asc') groups.sort((a, b) => a.value - b.value)
    if (args.limit) groups = groups.slice(0, args.limit)

    return { content: [{ type: 'text' as const, text: JSON.stringify({ groups, total: data.length }) }] }
  })
}
