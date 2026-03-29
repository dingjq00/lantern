// 系统注册表 — 唯一的系统注册点
// 新系统接入只需在这里加一条，不改 Brain 层、不改 index.ts
// prompt-assembler 从 Skill YAML 的 system 字段读取，再从这里取 label/scope

export interface SystemMeta {
  label: string    // 显示名称
  scope: string    // 业务关键词，AI 用来判断查询属于哪个系统
}

export const SYSTEM_REGISTRY: Record<string, SystemMeta> = {
  eam: {
    label: 'EAM（设备资产管理）',
    scope: '设备、故障报修、维修工单、保养、巡检、备件、产线、车间',
  },
  edhr: {
    label: 'EDHR（医疗器械检测流程管理）',
    scope: '生产工单、批次、检测项、合格率、质量异常、产品配方',
  },
  // 未来新系统在此添加:
  // mes: { label: 'MES（制造执行系统）', scope: '工序、排产、报工、物料...' },
  // wms: { label: 'WMS（仓储管理系统）', scope: '入库、出库、库存、库位...' },
}
