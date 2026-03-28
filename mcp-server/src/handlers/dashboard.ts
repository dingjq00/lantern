// eam.dashboard — 全局仪表盘
// 并行调 8+ 个统计 API → 聚合为一个全景快照
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { eamGet, eamParallel } from '../eam-api.js'

export function registerDashboard(server: McpServer) {
  server.tool(
    'eam.dashboard',
    '获取全局仪表盘指标快照。返回设备、故障、维修、保养、巡检、备件、待办的汇总数据。当用户问"系统概况""总共多少设备""有多少待办"时使用。不要用于查看某个车间/产线的数据（用 eam.scope.overview）。',
    {
      format: z.enum(['detailed', 'concise']).optional().default('detailed').describe('concise=只返回核心数字'),
    },
    async (args) => {
      const [summary, statusDist, faultStats, repairStats, maintenanceStats, patrolStats, spareAlerts, todoList] =
        await eamParallel<[any, any, any, any, any, any, any, any]>(
          () => eamGet('/eam/dashboard/summary'),
          () => eamGet('/eam/dashboard/equipment-status-distribution'),
          () => eamGet('/eam/fault-report/status-stats'),
          () => eamGet('/eam/repair-order/status-stats'),
          () => eamGet('/eam/maintenance/task/status-stats'),
          () => eamGet('/eam/patrol/task/statistics'),
          () => eamGet('/eam/spare/alert/list').catch(() => []),
          () => eamGet('/eam/dashboard/todo-list').catch(() => []),
        )

      if (args.format === 'concise') {
        return textResult({
          equipment: { total: summary?.totalEquipment, running: summary?.runningCount, fault: summary?.faultCount },
          faultReports: { pending: summary?.pendingReports, total: summary?.totalReports },
          repairOrders: { pending: summary?.pendingOrders, completed: summary?.completedOrders },
          maintenance: { pending: summary?.pendingMaintenanceTasks },
          spareAlerts: Array.isArray(spareAlerts) ? spareAlerts.length : 0,
          todoCount: Array.isArray(todoList) ? todoList.length : 0,
        })
      }

      return textResult({
        equipment: {
          total: summary?.totalEquipment,
          running: summary?.runningCount,
          fault: summary?.faultCount,
          scrap: summary?.scrapCount,
          statusDistribution: statusDist,
        },
        faultReports: {
          pending: summary?.pendingReports,
          total: summary?.totalReports,
          byStatus: faultStats,
        },
        repairOrders: {
          pending: summary?.pendingOrders,
          completed: summary?.completedOrders,
          byStatus: repairStats,
        },
        maintenance: {
          pending: summary?.pendingMaintenanceTasks,
          byStatus: maintenanceStats,
        },
        patrol: patrolStats,
        spareAlerts: {
          count: Array.isArray(spareAlerts) ? spareAlerts.length : 0,
          items: Array.isArray(spareAlerts) ? spareAlerts.slice(0, 10) : [],
        },
        todoList: Array.isArray(todoList) ? todoList : [],
      })
    }
  )
}

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}
