// 仪表盘域 handlers（3 个工具）
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
}
