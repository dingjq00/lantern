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

/** 业务术语定义 — AI 遇到不确定的业务概念时按需查询 */
export interface GlossaryTerm {
  aliases?: string[]       // 同义词/近义词（预匹配时也检查）
  definition: string       // 业务含义
  computation: string      // 在本系统中怎么算
  relatedTools?: string[]  // 推荐使用的工具
}

export interface SystemMeta {
  label: string         // 显示名称
  scope: string         // 业务关键词，AI 用来判断查询属于哪个系统
  domainModel?: string  // 业务关系链 — AI 用来理解实体间的关联，生成更好的跨域建议
  computedMetrics?: Record<string, ComputedMetric>  // 领域 KPI 公式（TPM/MES/FDA 标准）
  businessGlossary?: Record<string, GlossaryTerm>   // 业务术语表 — glossary.resolve 按需查询
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
    businessGlossary: {
      '故障率': { aliases: ['故障频率', '报修率'], definition: '设备发生故障的频率', computation: '故障次数 ÷ 设备总数（或运行时间）', relatedTools: ['eam.fault.search'] },
      'MTBF': { aliases: ['故障间隔', '平均无故障时间'], definition: '平均故障间隔（Mean Time Between Failures）', computation: '同一设备相邻两次故障的时间差平均值', relatedTools: ['eam.fault.search'] },
      'MTTR': { aliases: ['修复时间', '平均修复时长'], definition: '平均修复时间（Mean Time To Repair）', computation: '维修工单 repairMinutes 的平均值', relatedTools: ['eam.repair.search'] },
      'OEE': { aliases: ['设备效率', '综合效率', '设备综合效率'], definition: '设备综合效率（Overall Equipment Effectiveness）', computation: '可用率 × 性能率 × 良率', relatedTools: ['eam.equipment.profile'] },
      '保养完成率': { aliases: ['保养执行率', 'PM完成率'], definition: '按计划完成的保养任务占比', computation: '按已完成状态过滤，完成数 ÷ 总数', relatedTools: ['eam.maintenance.search'] },
      '备件周转率': { aliases: ['备件消耗率', '库存周转'], definition: '备件消耗速度与库存的比值', computation: '一段时间内出库量 ÷ 平均库存量', relatedTools: ['eam.spare.search'] },
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
    businessGlossary: {
      '积压': { aliases: ['堆积', '待处理量', 'backlog'], definition: '截至某时点未关闭的工单累积数（不是创建量）', computation: '必须按状态过滤（等待中/暂停），不能拿全量自己算', relatedTools: ['edhr.order.search'] },
      '产能': { aliases: ['产出', '产量', '吞吐量'], definition: '单位时间内完成的工单数', computation: '按已完成状态过滤，按时间维度统计', relatedTools: ['edhr.order.search', 'edhr.trend'] },
      '良率': { aliases: ['合格率', '通过率'], definition: '检测合格率', computation: '合格数 ÷ 总检测数', relatedTools: ['edhr.item.search'] },
      '异常率': { aliases: ['不良率', '缺陷率'], definition: '产生质量异常的工单占比', computation: '有异常记录的工单数 ÷ 工单总数', relatedTools: ['edhr.exception.search', 'edhr.order.search'] },
    },
  },
}
