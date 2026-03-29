// eam.repair.profile — 维修工单全景
// 支持 orderCode / faultReportCode / ID 三种入口（Poka-yoke）
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { eamGet, eamParallel, type PageResult, type RepairOrder } from '../eam-api.js'
import { textResult } from '../shared.js'

export function registerRepairProfile(server: McpServer) {
  server.tool(
    'eam.repair.profile',
    '获取维修工单全景画像。输入工单号、故障报修号或ID，返回完整维修信息（工单+故障报修+设备+备件使用+工时+知识引用+出库单+操作日志）。当用户问"WO-001 什么情况""这个报修单的维修进展"时使用。',
    {
      identifier: z.string().describe('维修工单号（如 RO202603110001）、故障报修号（如 FR202603260105）或数字ID'),
      format: z.enum(['detailed', 'concise']).optional().default('detailed').describe('concise=省略操作日志和出库明细'),
    },
    async (args) => {
      // Step 0: 解析标识符（三种入口）
      let repairOrder: RepairOrder | null = null

      if (/^\d+$/.test(args.identifier)) {
        // 纯数字 → 直接按 ID 查
        try {
          repairOrder = await eamGet<RepairOrder>('/eam/repair-order/get', { id: args.identifier })
        } catch { /* fall through */ }
      }

      if (!repairOrder && args.identifier.toUpperCase().startsWith('FR')) {
        // FR 开头 → 可能是故障报修号，先查报修单再查关联工单
        try {
          const faultPage = await eamGet<PageResult<any>>('/eam/fault-report/page', { keyword: args.identifier, pageNo: 1, pageSize: 1 })
          if (faultPage.list.length > 0) {
            const faultId = faultPage.list[0].id
            repairOrder = await eamGet<RepairOrder>('/eam/repair-order/get-by-fault-report-id', { faultReportId: faultId })
          }
        } catch { /* fall through */ }
      }

      if (!repairOrder) {
        // 按工单号 keyword 搜索
        try {
          const page = await eamGet<PageResult<RepairOrder>>('/eam/repair-order/page', { keyword: args.identifier, pageNo: 1, pageSize: 5 })
          if (page.list.length === 1) {
            repairOrder = page.list[0]
          } else if (page.list.length > 1) {
            return textResult({
              message: '找到多个匹配的维修工单，请确认您要查看哪一个',
              candidates: page.list.slice(0, 5).map(r => ({ id: r.id, code: r.orderCode, status: r.status })),
            })
          }
        } catch { /* fall through */ }
      }

      if (!repairOrder) {
        return textResult({ error: '未找到匹配的维修工单', identifier: args.identifier })
      }

      const orderId = repairOrder.id

      // concise 模式
      if (args.format === 'concise') {
        const [fault, equipment] = await eamParallel<[any, any]>(
          () => repairOrder!.faultReportId ? eamGet('/eam/fault-report/get', { id: repairOrder!.faultReportId }).catch(() => null) : Promise.resolve(null),
          () => eamGet('/eam/equipment/get', { id: repairOrder!.equipmentId }).catch(() => null),
        )
        return textResult({
          repairOrder: formatRepairBasic(repairOrder),
          faultReport: fault ? { code: fault.reportCode, urgency: fault.urgency, desc: fault.faultDesc } : null,
          equipment: equipment ? { code: equipment.equipmentCode, name: equipment.equipmentName } : null,
        })
      }

      // detailed 模式: 并行调用所有子 API
      const [fault, equipment, spares, workload, knowledgeRefs, stockOuts, logs] =
        await eamParallel<[any, any, any[], any[], any[], any[], any[]]>(
          () => repairOrder!.faultReportId ? eamGet('/eam/fault-report/get', { id: repairOrder!.faultReportId }).catch(() => null) : Promise.resolve(null),
          () => eamGet('/eam/equipment/get', { id: repairOrder!.equipmentId }).catch(() => null),
          () => eamGet<any[]>('/eam/repair-order/spare/list', { repairOrderId: orderId }).catch(() => []),
          () => eamGet<any[]>('/eam/repair-order/workload/list', { repairOrderId: orderId }).catch(() => []),
          () => eamGet<any[]>('/eam/repair-order/knowledge-ref/list', { repairOrderId: orderId }).catch(() => []),
          () => eamGet<any[]>('/eam/repair-order/related-stock-out/list', { repairOrderId: orderId }).catch(() => []),
          () => eamGet<any[]>('/eam/repair-order/log-list', { repairOrderId: orderId }).catch(() => []),
        )

      return textResult({
        repairOrder: formatRepairBasic(repairOrder),
        faultReport: fault ? { code: fault.reportCode, urgency: fault.urgency, status: fault.status, desc: fault.faultDesc, faultTime: fault.faultTime } : null,
        equipment: equipment ? { code: equipment.equipmentCode, name: equipment.equipmentName, status: equipment.status, location: equipment.locationId } : null,
        spareUsage: spares ?? [],
        workload: workload ?? [],
        knowledgeRefs: knowledgeRefs ?? [],
        stockOutOrders: stockOuts ?? [],
        operationLogs: logs ?? [],
      })
    }
  )
}

function formatRepairBasic(r: RepairOrder) {
  return {
    id: r.id,
    code: r.orderCode,
    status: r.status,
    statusText: REPAIR_STATUS[r.status] ?? `未知(${r.status})`,
    orderType: r.orderType,
    equipmentId: r.equipmentId,
    faultReportId: r.faultReportId,
    assigneeId: r.assigneeId,
    repairMinutes: r.repairMinutes,
    laborCost: r.laborCost,
    materialCost: r.materialCost,
  }
}

const REPAIR_STATUS: Record<number, string> = {
  0: '待分配', 1: '待接单', 2: '维修中', 3: '挂起', 4: '待验收', 5: '已完成', 6: '已关闭',
}
