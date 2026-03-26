// 共享 Mock 数据 — 对齐 MCP Server handlers 的完整返回
// benchmark.ts 和 cold-start.ts 共用
import type { ToolResult } from '../lib/types'

export const MOCK_DATA: Record<string, unknown> = {
  // === 设备域 ===
  query_equipment: {
    total: 128,
    items: [
      { equipmentId: 101, name: 'CNC-001 数控车床', code: 'CNC-001', status: 1, category: '数控设备', location: 'A车间', productionLine: 'A线' },
      { equipmentId: 102, name: 'CNC-002 数控铣床', code: 'CNC-002', status: 1, category: '数控设备', location: 'A车间', productionLine: 'A线' },
      { equipmentId: 103, name: 'PACK-001 包装机', code: 'PACK-001', status: 2, category: '包装设备', location: 'B车间', productionLine: 'B线' },
    ],
  },
  get_equipment_detail: {
    equipmentId: 101, name: 'CNC-001 数控车床', code: 'CNC-001',
    status: 1, statusText: '运行中', category: '数控设备',
    location: 'A车间-01工位', productionLine: 'A线', manufacturer: '沈阳机床', purchaseDate: '2023-06-15',
    kpi: { faultCount: 3, avgRepairHours: 4.5, maintenanceRate: 92.5, mtbf: 720 },
  },
  get_equipment_lifecycle: {
    equipmentId: 101,
    events: [
      { date: '2023-06-15', type: '购置', detail: '采购入库' },
      { date: '2023-06-20', type: '验收', detail: '验收合格' },
      { date: '2023-07-01', type: '投产', detail: '状态变更为运行中' },
      { date: '2024-03-15', type: '故障', detail: '主轴异响' },
      { date: '2024-03-16', type: '维修', detail: '更换主轴轴承' },
      { date: '2025-01-10', type: '保养', detail: '年度大保养' },
    ],
  },
  get_equipment_status_distribution: {
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
    total: 128,
  },

  // === 故障维修域 ===
  query_fault_reports: {
    total: 15,
    items: [
      { faultReportId: 301, equipmentName: 'CNC-001', faultType: '机械故障', status: '已通过', reportTime: '2026-03-10 09:30', description: '主轴异响' },
      { faultReportId: 302, equipmentName: 'PACK-001', faultType: '电气故障', status: '待审核', reportTime: '2026-03-15 14:20', description: '变频器报警' },
      { faultReportId: 303, equipmentName: 'CNC-002', faultType: '机械故障', status: '已通过', reportTime: '2026-03-20 08:15', description: '导轨润滑不良' },
    ],
  },
  query_repair_orders: {
    total: 12,
    items: [
      { repairOrderId: 201, equipmentName: 'CNC-001', status: '已关闭', createTime: '2026-03-10 10:00', finishTime: '2026-03-11 15:30' },
      { repairOrderId: 202, equipmentName: 'PACK-001', status: '维修中', createTime: '2026-03-15 15:00', finishTime: null },
      { repairOrderId: 203, equipmentName: 'CNC-002', status: '待接单', createTime: '2026-03-20 09:00', finishTime: null },
    ],
  },
  get_repair_detail: {
    repairOrder: {
      repairOrderId: 201, equipmentName: 'CNC-001', faultDescription: '主轴异响',
      status: '已关闭', createTime: '2026-03-10 10:00', finishTime: '2026-03-11 15:30', repairHours: 5.5,
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
    ],
  },
  get_fault_trend: {
    days: 30, totalFaults: 23, avgPerDay: 0.77,
    trend: [
      { date: '2026-03-01', count: 1 }, { date: '2026-03-05', count: 2 },
      { date: '2026-03-10', count: 3 }, { date: '2026-03-15', count: 1 },
      { date: '2026-03-20', count: 2 }, { date: '2026-03-25', count: 1 },
    ],
  },

  // === 保养域 ===
  query_maintenance_tasks: {
    total: 8,
    items: [
      { taskId: 501, equipmentName: 'CNC-001', planName: '月度保养', status: '已完成', scheduledDate: '2026-03-01', completedDate: '2026-03-01' },
      { taskId: 502, equipmentName: 'CNC-002', planName: '月度保养', status: '待执行', scheduledDate: '2026-03-28', completedDate: null },
      { taskId: 503, equipmentName: 'PACK-001', planName: '季度保养', status: '执行中', scheduledDate: '2026-03-25', completedDate: null },
    ],
  },
  get_maintenance_detail: {
    task: { taskId: 501, equipmentName: 'CNC-001', planName: '月度保养', status: '已完成', scheduledDate: '2026-03-01', completedDate: '2026-03-01', executor: '王五' },
    executionRecords: [
      { item: '润滑油更换', result: '合格', remark: '' },
      { item: '传动带检查', result: '合格', remark: '张力正常' },
      { item: '冷却系统清洗', result: '合格', remark: '' },
    ],
  },

  // === 巡检域 ===
  query_patrol_tasks: {
    total: 20,
    items: [
      { taskId: 701, equipmentName: 'CNC-001', planName: '日常巡检', status: '已完成', scheduledDate: '2026-03-25', completedDate: '2026-03-25' },
      { taskId: 702, equipmentName: 'CNC-002', planName: '日常巡检', status: '已完成', scheduledDate: '2026-03-25', completedDate: '2026-03-25' },
      { taskId: 703, equipmentName: 'PACK-001', planName: '日常巡检', status: '待执行', scheduledDate: '2026-03-26', completedDate: null },
    ],
  },
  get_patrol_analytics: {
    dimension: 'overview', days: 30,
    completionRate: 94.5, anomalyRate: 3.2, totalTasks: 180, completedTasks: 170, anomalyCount: 6,
  },
  query_anomaly_records: {
    total: 6,
    items: [
      { anomalyId: 801, equipmentName: 'CNC-001', source: '巡检', severity: 2, status: '待处理', description: '液压油温偏高', createdAt: '2026-03-22' },
      { anomalyId: 802, equipmentName: 'PACK-001', source: '保养', severity: 3, status: '处理中', description: '传感器漂移', createdAt: '2026-03-20' },
      { anomalyId: 803, equipmentName: 'CNC-002', source: '巡检', severity: 1, status: '已处理', description: '异响轻微', createdAt: '2026-03-18' },
    ],
  },
  get_anomaly_statistics: {
    totalCount: 45, pendingCount: 8, processRate: 82.2,
    severityDistribution: [
      { level: 1, label: '轻微', count: 20 }, { level: 2, label: '一般', count: 15 },
      { level: 3, label: '严重', count: 8 }, { level: 4, label: '紧急', count: 2 },
    ],
  },

  // === 备件域 ===
  query_spare_parts: {
    total: 350,
    items: [
      { spareId: 401, name: '主轴轴承 SKF-6205', code: 'SP-001', type: '轴承', specification: '6205-2RS', unit: '个' },
      { spareId: 402, name: '润滑脂 Shell EP2', code: 'SP-002', type: '润滑材料', specification: '15kg/桶', unit: '桶' },
      { spareId: 403, name: '传动带 3V-500', code: 'SP-003', type: '传动件', specification: '3V-500', unit: '条' },
    ],
  },
  get_spare_stock: {
    items: [
      { spareId: 401, spareName: '主轴轴承 SKF-6205', warehouseId: 1, warehouseName: '主仓库', quantity: 15, safetyStock: 10 },
      { spareId: 401, spareName: '主轴轴承 SKF-6205', warehouseId: 2, warehouseName: '车间仓', quantity: 3, safetyStock: 5 },
    ],
  },
  get_equipment_spare_bom: {
    items: [
      { equipmentId: 101, equipmentName: 'CNC-001', spareId: 401, spareName: '主轴轴承 SKF-6205', quantity: 2 },
      { equipmentId: 101, equipmentName: 'CNC-001', spareId: 402, spareName: '润滑脂 Shell EP2', quantity: 1 },
      { equipmentId: 101, equipmentName: 'CNC-001', spareId: 403, spareName: '传动带 3V-500', quantity: 3 },
    ],
  },
  query_spare_transactions: {
    total: 25,
    items: [
      { transactionId: 901, type: 'stock_out', spareName: '主轴轴承 SKF-6205', quantity: 2, warehouseName: '主仓库', createdAt: '2026-03-10', relatedOrder: 'WO-201' },
      { transactionId: 902, type: 'stock_in', spareName: '润滑脂 Shell EP2', quantity: 10, warehouseName: '主仓库', createdAt: '2026-03-12', relatedOrder: 'PO-105' },
    ],
  },
  get_spare_alerts: {
    alertCount: 3,
    items: [
      { spareId: 403, spareName: '传动带 3V-500', currentStock: 2, safetyStock: 10, shortage: 8 },
      { spareId: 404, spareName: '密封圈 OR-32', currentStock: 5, safetyStock: 20, shortage: 15 },
      { spareId: 405, spareName: '滤芯 HF-100', currentStock: 1, safetyStock: 5, shortage: 4 },
    ],
  },

  // === 仪表盘域 ===
  get_dashboard_summary: {
    totalEquipment: 128, runningCount: 98, faultCount: 8, scrappedCount: 4,
    pendingFaults: 3, pendingOrders: 5, pendingMaintenance: 12,
  },
  get_governance_dashboard: {
    healthScore: 87.5, dataQualityScore: 92.1,
    auditMetrics: { compliantRate: 95.3, missingFieldRate: 2.1, overdueMaintenanceRate: 4.6 },
  },
  get_todo_list: {
    pendingFaults: [{ id: 302, type: '故障报修', title: 'PACK-001 变频器报警', priority: '高' }],
    pendingOrders: [
      { id: 203, type: '维修工单', title: 'CNC-002 导轨润滑', priority: '中' },
      { id: 204, type: '维修工单', title: 'PACK-002 传感器校准', priority: '低' },
    ],
    pendingMaintenance: [{ id: 502, type: '保养任务', title: 'CNC-002 月度保养', priority: '中', dueDate: '2026-03-28' }],
  },
}

export async function mockCallTool(name: string): Promise<ToolResult> {
  return { data: MOCK_DATA[name] ?? { message: `未知工具: ${name}` }, status: 'success' }
}
