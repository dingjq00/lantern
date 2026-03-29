// 系统注册表 — 唯一的系统注册点
// 新系统接入只需在这里加一条，不改 Brain 层、不改 index.ts
// prompt-assembler 从 Skill YAML 的 system 字段读取，再从这里取 label/scope

export interface SystemMeta {
  label: string         // 显示名称
  scope: string         // 业务关键词，AI 用来判断查询属于哪个系统
  domainModel?: string  // 业务关系链 — AI 用来理解实体间的关联，生成更好的跨域建议
}

export const SYSTEM_REGISTRY: Record<string, SystemMeta> = {
  eam: {
    label: 'EAM（设备资产管理）',
    scope: '设备、故障报修、维修工单、保养、巡检、备件、产线、车间',
    domainModel: `核心关系链:
设备 ──发生→ 故障报修 ──触发→ 维修工单 ──消耗→ 备件 ──影响→ 库存水位
设备 ──计划→ 保养任务（完成率=保养健康度）
设备 ──安排→ 巡检任务 ──发现→ 异常记录 ──升级→ 故障报修
设备 ──包含→ BOM备件清单 ──关联→ 备件库存预警
产线 ──管辖→ 多台设备（按产线聚合=产线级分析）
关键指标: 故障率、维修成本、保养完成率、巡检异常率、备件周转率、OEE`,
  },
  edhr: {
    label: 'EDHR（医疗器械检测流程管理）',
    scope: '生产工单、批次、检测项、合格率、质量异常、产品配方',
    domainModel: `核心关系链:
产品配方 ──定义→ 工序流程（Procedure→UnitProcedure→Operation→Phase）
工单 ──关联→ 产品+批号 ──包含→ 检测项（PASSED/FAILED/INIT）
工单 ──产生→ 质量异常 ──决策→ 重新操作/返修/重新测试
关键指标: 工单完成率、检测合格率、异常率、各决策类型比例、产品间质量对比`,
  },
}
