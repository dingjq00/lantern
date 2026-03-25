// 保养域 handlers（2 个工具）
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerMaintenanceHandlers(server: McpServer) {
  server.tool('query_maintenance_tasks', '查询保养任务列表', {
    equipmentId: z.number().int().optional(),
    status: z.number().int().optional(),
    planId: z.number().int().optional(),
    dateRange: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional(),
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      total: 8,
      items: [
        { taskId: 501, equipmentName: 'CNC-001', planName: '月度保养', status: '已完成', scheduledDate: '2026-03-01', completedDate: '2026-03-01' },
        { taskId: 502, equipmentName: 'CNC-002', planName: '月度保养', status: '待执行', scheduledDate: '2026-03-28', completedDate: null },
        { taskId: 503, equipmentName: 'PACK-001', planName: '季度保养', status: '执行中', scheduledDate: '2026-03-25', completedDate: null },
      ]
    })}]
  }))

  server.tool('get_maintenance_detail', '获取保养任务详情', {
    taskId: z.number().int(),
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      task: {
        taskId: args.taskId,
        equipmentName: 'CNC-001',
        planName: '月度保养',
        status: '已完成',
        scheduledDate: '2026-03-01',
        completedDate: '2026-03-01',
        executor: '王五',
      },
      executionRecords: [
        { item: '润滑油更换', result: '合格', remark: '' },
        { item: '传动带检查', result: '合格', remark: '张力正常' },
        { item: '冷却系统清洗', result: '合格', remark: '' },
      ]
    })}]
  }))
}
