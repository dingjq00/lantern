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

/** 推荐引擎规则 — 数据命中 pattern 时自动注入管理者建议（偷师 jenkins-mcp-enterprise） */
export interface RecommendationRule {
  metric: string             // 触发指标名（对应 computedMetrics 的 key）
  condition: 'below' | 'above'  // 低于/高于阈值触发
  threshold: number          // 阈值（百分比用数字如 80 表示 80%）
  message: string            // 注入的推荐文本
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
  recommendations?: RecommendationRule[]             // 推荐引擎 — pattern→action 配置化建议
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
    recommendations: [
      { metric: 'PM完成率', condition: 'below', threshold: 80, message: '⚠️ 保养完成率低于80%，立即检查逾期保养任务，制定补做计划' },
      { metric: '紧急工单率', condition: 'above', threshold: 30, message: '🔴 紧急工单占比超30%，检查是否有系统性设备问题，评估预防性维护策略' },
    ],
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
    recommendations: [
      { metric: '工单完成率', condition: 'below', threshold: 70, message: '⚠️ 工单完成率低于70%，排查积压原因：质量异常处理延迟 or 检测瓶颈' },
      { metric: '异常率', condition: 'above', threshold: 50, message: '🔴 异常率超50%，过程控制存在系统性问题，建议立即审查工序流程和操作规范' },
    ],
    businessGlossary: {
      '积压': { aliases: ['堆积', '待处理量', 'backlog'], definition: '截至某时点未关闭的工单累积数（不是创建量）', computation: '必须按状态过滤（等待中/暂停），不能拿全量自己算', relatedTools: ['edhr.order.search'] },
      '产能': { aliases: ['产出', '产量', '吞吐量'], definition: '单位时间内完成的工单数', computation: '按已完成状态过滤，按时间维度统计', relatedTools: ['edhr.order.search', 'edhr.trend'] },
      '良率': { aliases: ['合格率', '通过率'], definition: '检测合格率', computation: '合格数 ÷ 总检测数', relatedTools: ['edhr.item.search'] },
      '异常率': { aliases: ['不良率', '缺陷率'], definition: '产生质量异常的工单占比', computation: '有异常记录的工单数 ÷ 工单总数', relatedTools: ['edhr.exception.search', 'edhr.order.search'] },
    },
  },
  mes: {
    label: 'MES（制造执行系统）',
    scope: '生产工单、批次工单、班次工单、配方、工序、物料、批次、子批次、库存单、产线、称量、乳化',
    domainModel: `核心关系链:
配方(Recipe) ──定义→ 工艺路线(UnitProcedure→Operation→Phase) + 配方组分(Component)
生产工单(ProductionOrder) ──拆分→ 批次工单(BatchOrder) ──拆分→ 班次工单(ShiftOrder)
班次工单 ──关联→ 配方 + 产线(ProductionLine)
物料(Material) ──对应→ 批次(Lot) ──拆分→ 子批次(Sublot) ──存放→ 库位(WarehouseLocation)
库存单(InventoryOrder) ──包含→ 库存明细行(InventoryOrderLine) ──关联→ 物料+批次
产线分类: 称量(3101) | 乳化(3102-3112) | 灌装/包装(3201-3288) | 检验(3301-3302)
⚠️ 子批质量状态: INVALID=未放行(默认)、UNRESTRICTED=已放行、BLOCKED=冻结、INSPECTION=检验中
⚠️ 配方状态枚举: INIT/EFFECITVE(注意拼写)/ARCHIVED
⚠️ 数据时间范围: 2023-11 至 2025-04`,
    // MES KPI 公式 — 基于 ISA-95 / 日化制造关键绩效指标
    computedMetrics: {
      '工单完成率': { label: '工单完成率', formula: 'rate', numerator: 'status=FINISHED', denominator: 'total', unit: '%' },
      '产量完成率': { label: '产量完成率(计划达成)', formula: 'avg', field: '_completionRate', unit: '%' },
      '批次放行率': { label: '批次放行率', formula: 'rate', numerator: 'sublotQualityStatus=UNRESTRICTED', denominator: 'total', unit: '%' },
      '冻结批次率': { label: '冻结批次率', formula: 'rate', numerator: 'sublotQualityStatus=BLOCKED', denominator: 'total', unit: '%' },
      '库存单完成率': { label: '库存单完成率', formula: 'rate', numerator: 'orderStatus=FINISHED', denominator: 'total', unit: '%' },
    },
    recommendations: [
      { metric: '工单完成率', condition: 'below', threshold: 80, message: '⚠️ 工单完成率低于80%，检查产线瓶颈和物料齐套情况' },
      { metric: '冻结批次率', condition: 'above', threshold: 5, message: '🔴 冻结批次超5%，立即排查质量异常原因，防止扩散' },
    ],
    businessGlossary: {
      '产量完成率': { aliases: ['计划达成率', '完成率', '达成率'], definition: '实际产量 ÷ 计划产量，反映生产计划执行情况', computation: 'actualQuantity ÷ planQuantity × 100%', relatedTools: ['mes.order.search', 'mes.trend'] },
      '批次放行率': { aliases: ['放行率', '合格率', '批次合格率'], definition: '质量检验通过后放行的子批次占比（日化行业批次默认INVALID=未放行，QC通过后UNRESTRICTED=已放行）', computation: 'UNRESTRICTED子批数 ÷ 总子批数（注意INVALID≠不合格，而是未验证）', relatedTools: ['mes.sublot.search'] },
      '配方': { aliases: ['工艺', '处方', '配方版本'], definition: '产品的生产工艺定义，含工艺路线(UnitProcedure→Phase)和原料组分(Component)', computation: '按物料编号查配方，同物料可有多个版本（EFFECITVE=生效中/ARCHIVED=归档）', relatedTools: ['mes.recipe.profile'] },
      '批次': { aliases: ['Lot', '批号', '生产批'], definition: '同一次入库或生产的同一物料集合，有唯一批号、供应商信息、有效期', computation: '按批号、物料、供应商搜索', relatedTools: ['mes.lot.search'] },
      '子批次': { aliases: ['Sublot', '子批', '托盘', '小包'], definition: '批次拆分后的最小管理单元，有独立质量状态和库位', computation: '按子批号、批号、质量状态、托盘号搜索', relatedTools: ['mes.sublot.search'] },
      '班次工单': { aliases: ['ShiftOrder', '班次', '排产单'], definition: '批次工单按班次拆分的执行单元，关联具体产线和配方', computation: '通过生产工单→批次工单→班次工单的层级查询', relatedTools: ['mes.order.profile'] },
      '库存单': { aliases: ['出入库单', '仓库单据', '领料单'], definition: '所有物料出入库的凭证，含仓库操作、采购入库、生产入库、零星领料等类型', computation: '按类型、状态、供应商筛选', relatedTools: ['mes.inventory.search'] },
      '产线': { aliases: ['生产线', '工位', '线体'], definition: '生产线体，分称量(3101)、乳化(3102-3112)、灌装包装(3201-3288)、检验(3301-3302)四大类', computation: '按编号或名称查产线概览', relatedTools: ['mes.line.overview'] },
    },
  },
}
