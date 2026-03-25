// 巡检域 handlers（4 个工具）
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerPatrolHandlers(server: McpServer) {
  server.tool('query_patrol_tasks', '查询巡检任务列表', {
    equipmentId: z.number().int().optional(),
    status: z.number().int().optional(),
    planId: z.number().int().optional(),
    dateRange: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional(),
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      total: 20,
      items: [
        { taskId: 701, equipmentName: 'CNC-001', planName: '日常巡检', status: '已完成', scheduledDate: '2026-03-25', completedDate: '2026-03-25' },
        { taskId: 702, equipmentName: 'CNC-002', planName: '日常巡检', status: '已完成', scheduledDate: '2026-03-25', completedDate: '2026-03-25' },
        { taskId: 703, equipmentName: 'PACK-001', planName: '日常巡检', status: '待执行', scheduledDate: '2026-03-26', completedDate: null },
      ]
    })}]
  }))

  server.tool('get_patrol_analytics', '获取巡检综合分析', {
    days: z.number().int().default(30),
    dimension: z.enum(['overview', 'by_plan', 'by_equipment', 'by_standard']).default('overview'),
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      dimension: args.dimension,
      days: args.days,
      completionRate: 94.5,
      anomalyRate: 3.2,
      totalTasks: 180,
      completedTasks: 170,
      anomalyCount: 6,
    })}]
  }))

  server.tool('query_anomaly_records', '查询异常记录', {
    keyword: z.string().optional(),
    source: z.string().optional(),
    severity: z.number().int().optional(),
    status: z.number().int().optional(),
    grouped: z.boolean().default(false),
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      total: 6,
      items: [
        { anomalyId: 801, equipmentName: 'CNC-001', source: '巡检', severity: 2, status: '待处理', description: '液压油温偏高', createdAt: '2026-03-22' },
        { anomalyId: 802, equipmentName: 'PACK-001', source: '保养', severity: 3, status: '处理中', description: '传感器漂移', createdAt: '2026-03-20' },
        { anomalyId: 803, equipmentName: 'CNC-002', source: '巡检', severity: 1, status: '已处理', description: '异响轻微', createdAt: '2026-03-18' },
      ]
    })}]
  }))

  server.tool('get_anomaly_statistics', '获取异常统计KPI', {}, async () => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      totalCount: 45,
      pendingCount: 8,
      processRate: 82.2,
      severityDistribution: [
        { level: 1, label: '轻微', count: 20 },
        { level: 2, label: '一般', count: 15 },
        { level: 3, label: '严重', count: 8 },
        { level: 4, label: '紧急', count: 2 },
      ]
    })}]
  }))
}
