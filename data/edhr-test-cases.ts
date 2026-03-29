// EDHR Benchmark 测试集 — 35 题 5 层级 5 角色视角
// 数据基线: 638工单 / 5种产品 / 113953检测项 / 305异常
// 时间范围: 2024-04-28 → 2024-08-12
// 设计原则: 角色驱动 + 层级递进 + 工具全覆盖 + 真实数据验证

export interface EdhrTestCase {
  id: string
  query: string
  level: string
  role: string  // operator/qa/qc/production_manager/executive
  acceptablePaths: string[][]
  // v3 事实断言（等参考答案产出后填入）
  mustContain?: string[]
  shouldContain?: string[]
  forbidden?: string[]
  followUp?: { minCount?: number; shouldRelate?: string[] }
}

export const EDHR_TEST_CASES: EdhrTestCase[] = [

  // ============================================================
  // L1 — 简单查询（单工具，直接回答）
  // ============================================================

  // 生产管理者视角
  { id: 'E01', query: '目前有多少个工单在执行中？', level: 'L1', role: 'production_manager',
    acceptablePaths: [['edhr.dashboard'], ['edhr.order.search']],
    followUp: { minCount: 3, shouldRelate: ['工单', '执行'] } },

  { id: 'E02', query: '各状态的工单数量分布是怎样的？', level: 'L1', role: 'production_manager',
    acceptablePaths: [['edhr.order.search'], ['edhr.dashboard']],
    followUp: { minCount: 3, shouldRelate: ['工单', '状态'] } },

  // QA 视角
  { id: 'E03', query: '当前有多少个质量异常记录？', level: 'L1', role: 'qa',
    acceptablePaths: [['edhr.dashboard'], ['edhr.exception.search']],
    followUp: { minCount: 3, shouldRelate: ['异常', '质量'] } },

  { id: 'E04', query: '有多少检测项是不合格的？', level: 'L1', role: 'qc',
    acceptablePaths: [['edhr.dashboard'], ['edhr.item.search']],
    followUp: { minCount: 3, shouldRelate: ['检测', '不合格'] } },

  // 企业管理者视角
  { id: 'E05', query: '生产情况怎么样？给我一个全局概览', level: 'L1', role: 'executive',
    acceptablePaths: [['edhr.dashboard']],
    followUp: { minCount: 3, shouldRelate: ['工单', '产品'] } },

  // 操作员视角
  { id: 'E06', query: '系统里有哪些产品？', level: 'L1', role: 'operator',
    acceptablePaths: [['edhr.product.search'], ['edhr.dashboard']],
    followUp: { minCount: 3, shouldRelate: ['产品'] } },

  { id: 'E07', query: '工单 7103005-681895 的状态是什么？', level: 'L1', role: 'operator',
    acceptablePaths: [['edhr.order.profile']],
    followUp: { minCount: 3, shouldRelate: ['工单'] } },

  // ============================================================
  // L2 — 单域带条件（单工具，筛选/聚合）
  // ============================================================

  // 操作员视角 — 关心自己的工单
  { id: 'E08', query: '工单 7103005-681895 做到哪个工序了？合格率怎么样？', level: 'L2', role: 'operator',
    acceptablePaths: [['edhr.order.profile']],
    followUp: { minCount: 3, shouldRelate: ['工序', '检测'] } },

  { id: 'E09', query: '工单 7103005-681437 的检测完成了吗？有没有不合格项？', level: 'L2', role: 'operator',
    acceptablePaths: [['edhr.order.profile']],
    followUp: { minCount: 3, shouldRelate: ['检测', '合格'] } },

  // QA 视角 — 关心异常处理
  { id: 'E10', query: '重新操作（REOPERATE）处理的异常有多少个？', level: 'L2', role: 'qa',
    acceptablePaths: [['edhr.exception.search']],
    followUp: { minCount: 3, shouldRelate: ['异常', '处理'] } },

  { id: 'E11', query: '返修（REPAIRE）处理的异常有哪些？', level: 'L2', role: 'qa',
    acceptablePaths: [['edhr.exception.search']],
    followUp: { minCount: 3, shouldRelate: ['异常', '返修'] } },

  // QC 视角 — 关心检测数据
  { id: 'E12', query: '各检测状态的数量分布是怎样的？', level: 'L2', role: 'qc',
    acceptablePaths: [['edhr.item.search']],
    followUp: { minCount: 3, shouldRelate: ['检测', '状态'] } },

  { id: 'E13', query: '工单 7103005-681895 的检测项里有哪些不合格的？', level: 'L2', role: 'qc',
    acceptablePaths: [['edhr.item.search'], ['edhr.order.profile']],
    followUp: { minCount: 3, shouldRelate: ['不合格', '检测'] } },

  // 生产管理者视角 — 关心进度
  { id: 'E14', query: '七月份完成了多少个工单？', level: 'L2', role: 'production_manager',
    acceptablePaths: [['edhr.order.search']],
    followUp: { minCount: 3, shouldRelate: ['工单', '完成'] } },

  { id: 'E15', query: '产品 7103005 有多少个工单？', level: 'L2', role: 'production_manager',
    acceptablePaths: [['edhr.order.search']],
    followUp: { minCount: 3, shouldRelate: ['产品', '工单'] } },

  { id: 'E16', query: '目前等待中的工单有哪些？', level: 'L2', role: 'production_manager',
    acceptablePaths: [['edhr.order.search']],
    followUp: { minCount: 3, shouldRelate: ['等待', '工单'] } },

  { id: 'E17', query: '产品 7103005 的配方有几道工序？', level: 'L2', role: 'production_manager',
    acceptablePaths: [['edhr.product.search']],
    followUp: { minCount: 3, shouldRelate: ['配方', '工序'] } },

  // ============================================================
  // L3 — 跨实体/多步（层级遍历或需两个工具）
  // ============================================================

  // QC 视角 — 追溯问题
  { id: 'E18', query: '工单 7103005-681437 有多少道工序？每道工序的进度分别是什么？', level: 'L3', role: 'qc',
    acceptablePaths: [['edhr.order.profile']],
    followUp: { minCount: 3, shouldRelate: ['工序', '进度'] } },

  // QA 视角 — 异常关联
  { id: 'E19', query: '工单 7103005-681895 有没有质量异常？是怎么处理的？', level: 'L3', role: 'qa',
    acceptablePaths: [['edhr.order.profile'], ['edhr.exception.search']],
    followUp: { minCount: 3, shouldRelate: ['异常', '处理'] } },

  // 生产管理者 — 产品维度
  { id: 'E20', query: '最近一个月的工单完成趋势怎么样？', level: 'L3', role: 'production_manager',
    acceptablePaths: [['edhr.trend']],
    followUp: { minCount: 3, shouldRelate: ['趋势', '工单'] } },

  { id: 'E21', query: '7103072 这个产品最近的工单有哪些？完成了几个？', level: 'L3', role: 'production_manager',
    acceptablePaths: [['edhr.order.search']],
    followUp: { minCount: 3, shouldRelate: ['产品', '工单', '完成'] } },

  // 操作员 — 查配方了解步骤
  { id: 'E22', query: '710300T 这个产品的配方工序是什么？有多少个检测项？', level: 'L3', role: 'operator',
    acceptablePaths: [['edhr.product.search']],
    followUp: { minCount: 3, shouldRelate: ['配方', '检测项'] } },

  // QA — 异常趋势
  { id: 'E23', query: '最近三个月的异常数量趋势是怎样的？', level: 'L3', role: 'qa',
    acceptablePaths: [['edhr.trend', 'eam.trend'], ['edhr.trend'], ['eam.trend']],
    followUp: { minCount: 3, shouldRelate: ['异常', '趋势'] } },

  // ============================================================
  // L4 — 跨域分析（需 2+ 工具或深度分析思考）
  // ============================================================

  // QA 视角 — 质量分析
  { id: 'E24', query: '正在执行的工单中，有多少存在质量异常？', level: 'L4', role: 'qa',
    acceptablePaths: [['edhr.order.search', 'edhr.exception.search'], ['edhr.dashboard']] },

  { id: 'E25', query: '异常决策中，重新操作、返修、重新测试的比例分别是多少？', level: 'L4', role: 'qa',
    acceptablePaths: [['edhr.exception.search']],
    forbidden: ['数据不足'] },

  { id: 'E26', query: '已完成的工单里，哪些工单有过异常记录？', level: 'L4', role: 'qa',
    acceptablePaths: [['edhr.order.search', 'edhr.exception.search']] },

  // 企业管理者 — 综合分析
  { id: 'E27', query: '各产品的工单完成率对比怎么样？', level: 'L4', role: 'executive',
    acceptablePaths: [['edhr.order.search'], ['edhr.dashboard', 'edhr.order.search']] },

  { id: 'E28', query: '生产效率怎么样？工单从开始到完成平均需要多长时间？', level: 'L4', role: 'executive',
    acceptablePaths: [['edhr.order.search']] },

  // QC 视角 — 检测深度分析
  { id: 'E29', query: '不合格检测项主要集中在哪些工单？', level: 'L4', role: 'qc',
    acceptablePaths: [['edhr.item.search']] },

  // ============================================================
  // L5 — 趋势/战略（时间序列 + 跨域对比 + 决策支持）
  // ============================================================

  // 企业管理者 — 战略视角
  { id: 'E30', query: '过去四个月的工单完成量按月趋势，产能是在提升还是下降？', level: 'L5', role: 'executive',
    acceptablePaths: [['edhr.trend']],
    followUp: { minCount: 3, shouldRelate: ['趋势', '产能'] } },

  { id: 'E31', query: '质量异常数量和工单完成数量的趋势有没有关联？', level: 'L5', role: 'executive',
    acceptablePaths: [['edhr.trend']] },

  // QA — 质量战略
  { id: 'E32', query: '最近几个月异常的决策方式有变化吗？返修比例是在增加还是减少？', level: 'L5', role: 'qa',
    acceptablePaths: [['edhr.exception.search'], ['edhr.trend']] },

  { id: 'E33', query: '不同产品的检测不合格率对比，哪个产品质量问题最多？', level: 'L5', role: 'qa',
    acceptablePaths: [['edhr.item.search', 'edhr.product.search'], ['edhr.item.search', 'edhr.order.search']] },

  // 生产管理者 — 运营优化
  { id: 'E34', query: '哪个月的工单积压（等待中+暂停）最多？是什么原因？', level: 'L5', role: 'production_manager',
    acceptablePaths: [['edhr.trend'], ['edhr.order.search']] },

  { id: 'E35', query: '从四月到八月，每月新建工单数和完成工单数对比，产出效率的变化趋势', level: 'L5', role: 'executive',
    acceptablePaths: [['edhr.trend'], ['edhr.order.search']] },
]
