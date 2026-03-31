// 系统注册表 — 唯一的系统注册点
// 新系统接入只需在这里加一条，不改 Brain 层、不改 index.ts
// prompt-assembler 从 Skill YAML 的 system 字段读取，再从这里取 label/scope

/** 领域公式定义 — 基于 EN 15341(TPM) / FDA Quality Metrics 等行业标准 */
export interface ComputedMetric {
  label: string                              // 显示名称
  formula: 'rate' | 'avg' | 'sum' | 'count' | 'interval'  // 计算类型（interval=时间间隔分析）
  numerator?: string                         // rate: 分子 "field=value" 或 "field=*"(非空)
  denominator?: string                       // rate: 分母 "total" 或字段名
  field?: string                             // avg/sum/count: 目标字段
  unit?: string                              // 单位（%、元、分钟、天）
  // interval 专用 — 计算同一实体的同类事件之间的时间间隔
  groupByField?: string                      // 按什么实体分组（equipmentId）
  timeField?: string                         // 时间字段（createTime、reportTime）
}

export interface SystemMeta {
  label: string         // 显示名称
  scope: string         // 业务关键词，AI 用来判断查询属于哪个系统
  domainModel?: string  // 业务关系链 — AI 用来理解实体间的关联，生成更好的跨域建议
  computedMetrics?: Record<string, ComputedMetric>  // 领域 KPI 公式（TPM/MES/FDA 标准）
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
    // EAM KPI 公式 — 基于 EN 15341 维护绩效指标标准
    computedMetrics: {
      'PM完成率': { label: '保养完成率', formula: 'rate', numerator: 'status=2', denominator: 'total', unit: '%' },
      '维修完成率': { label: '维修完成率', formula: 'rate', numerator: 'status=5', denominator: 'total', unit: '%' },
      '平均维修成本': { label: '平均维修成本', formula: 'avg', field: 'materialCost', unit: '元' },
      '平均维修时长': { label: '平均维修时长(MTTR)', formula: 'avg', field: 'repairMinutes', unit: '分钟' },
      '紧急工单率': { label: '紧急工单率', formula: 'rate', numerator: 'urgency=1', denominator: 'total', unit: '%' },
      '维修间隔': { label: '平均维修间隔(MTBR)', formula: 'interval', groupByField: 'equipmentId', timeField: 'createTime', unit: '天' },
    },
  },
  edhr: {
    label: 'EDHR（医疗器械检测流程管理）',
    scope: '生产工单、批次、检测项、合格率、质量异常、产品配方',
    domainModel: `核心关系链:
产品配方 ──定义→ 工序流程（Procedure→UnitProcedure→Operation→Phase）
工单 ──关联→ 产品+批号 ──包含→ 检测项（PASSED/FAILED/INIT）
工单 ──产生→ 质量异常 ──决策→ 重新操作/返修/重新测试
关键指标: 工单完成率、检测合格率、异常率、各决策类型比例、产品间质量对比
⚠️ 数据时间范围: 2024-04 至 2024-08（不是当前年份）`,
    // EDHR KPI 公式 — 基于 FDA Quality Metrics (21 CFR Part 600/211) 质量指标标准
    computedMetrics: {
      '工单完成率': { label: '工单完成率', formula: 'rate', numerator: 'progressStatus=FINISHED', denominator: 'total', unit: '%' },
      '批次合格率': { label: '批次合格率', formula: 'rate', numerator: 'validatedStatus=PASSED', denominator: 'total', unit: '%' },
      '异常率': { label: '异常率', formula: 'rate', numerator: 'decisionType=*', denominator: 'total', unit: '%' },
      '工单生产周期': { label: '平均工单周期', formula: 'interval', groupByField: 'productId', timeField: 'createTime', unit: '天' },
    },
  },
}
