// 平台级 Benchmark 测试集 — 三层测试：系统路由 + 跨系统推理 + 单系统准确率
// 设计理念: 不测 30 个工具对不对，测 AI 能不能在多系统间自如穿梭
// 数据基线: EAM(青川制药 11887条) + EDHR(638工单/5产品) + MES(克丽缇娜 1757工单/16K物料/86K批次)

export type TestLevel = 'routing' | 'cross-system' | 'single-system'

export interface PlatformTestCase {
  id: string
  query: string
  level: TestLevel
  description: string                  // 测什么能力
  // === 路由层断言 ===
  acceptableSystems?: string[][]       // L1: 可接受的系统组合（如 [['mes'], ['mes','eam']]）
  // === 工具层断言 ===
  acceptablePaths?: string[][]         // L2/L3: 可接受的工具路径
  // === 事实层断言 ===
  mustContain?: string[]
  shouldContain?: string[]
  forbidden?: string[]
  // === followUp 断言 ===
  followUp?: { minCount?: number; shouldRelate?: string[] }
}

// ============================================================
// L1 — 系统路由测试（消歧能力）
// 核心: 同一个词在不同系统有不同含义，AI 选对系统了吗？
// ============================================================

const ROUTING_TESTS: PlatformTestCase[] = [
  // 歧义词: "工单"
  { id: 'P01', query: '有多少工单在执行中？', level: 'routing',
    description: '歧义消歧 — "工单"在三个系统都有，无上下文时应问清楚或选最合理的系统',
    acceptableSystems: [['eam'], ['edhr'], ['mes'], ['eam', 'edhr', 'mes']],
    acceptablePaths: [['eam.dashboard'], ['edhr.dashboard'], ['mes.dashboard'], ['eam.dashboard', 'mes.dashboard']],
    shouldContain: ['工单'] },

  // 明确指向 MES
  { id: 'P02', query: '生产工单完成率是多少？', level: 'routing',
    description: '系统指向 — "生产工单"明确指向 MES',
    acceptableSystems: [['mes']],
    acceptablePaths: [['mes.order.search'], ['mes.dashboard']],
    shouldContain: ['完成'] },

  // 明确指向 EAM
  { id: 'P03', query: '设备故障率最高的是哪台？', level: 'routing',
    description: '系统指向 — "设备故障"明确指向 EAM',
    acceptableSystems: [['eam']],
    acceptablePaths: [['eam.fault.search']],
    shouldContain: ['故障'] },

  // 歧义词: "完成率"
  { id: 'P04', query: '完成率是多少？', level: 'routing',
    description: '高度歧义 — "完成率"可以是保养/工单/产量，应请求澄清或给全景',
    acceptableSystems: [['eam'], ['edhr'], ['mes'], ['eam', 'edhr', 'mes']],
    acceptablePaths: [['eam.dashboard'], ['edhr.dashboard'], ['mes.dashboard']] },

  // 明确指向 MES 仓库
  { id: 'P05', query: '仓库里有多少冻结的批次？', level: 'routing',
    description: '系统指向 — "仓库""批次""冻结"明确指向 MES',
    acceptableSystems: [['mes']],
    acceptablePaths: [['mes.sublot.search']],
    shouldContain: ['冻结', 'BLOCKED'] },

  // 歧义词: "产线"
  { id: 'P06', query: '压片线最近怎么样？', level: 'routing',
    description: '歧义消歧 — "产线"在 EAM(scope.overview) 和 MES(line.overview) 都有',
    acceptableSystems: [['eam'], ['mes'], ['eam', 'mes']],
    acceptablePaths: [['eam.scope.overview'], ['mes.line.overview'], ['eam.scope.overview', 'mes.line.overview']] },

  // 明确指向 EDHR
  { id: 'P07', query: '检测不合格率是多少？', level: 'routing',
    description: '系统指向 — "检测不合格"明确指向 EDHR',
    acceptableSystems: [['edhr']],
    acceptablePaths: [['edhr.item.search'], ['edhr.dashboard']] },

  // 歧义词: "异常"
  { id: 'P08', query: '最近有多少异常？', level: 'routing',
    description: '歧义消歧 — "异常"在 EAM(巡检异常) 和 EDHR(质量异常) 都有',
    acceptableSystems: [['eam'], ['edhr'], ['eam', 'edhr']],
    acceptablePaths: [['eam.anomaly.search'], ['edhr.exception.search'], ['eam.dashboard'], ['edhr.dashboard']] },

  // 明确指向 MES 配方
  { id: 'P09', query: '乳霜的配方是什么？', level: 'routing',
    description: '系统指向 — "配方"明确指向 MES',
    acceptableSystems: [['mes']],
    acceptablePaths: [['mes.recipe.profile'], ['mes.material.search']] },

  // 全景查询
  { id: 'P10', query: '工厂今天整体怎么样？', level: 'routing',
    description: '全景查询 — 应覆盖多个系统的 dashboard',
    acceptableSystems: [['eam', 'mes'], ['eam'], ['mes'], ['eam', 'edhr', 'mes']],
    acceptablePaths: [['eam.dashboard', 'mes.dashboard'], ['eam.dashboard'], ['mes.dashboard']] },

  // 明确指向 MES 物料
  { id: 'P11', query: '原材料有多少种？', level: 'routing',
    description: '系统指向 — "原材料"明确指向 MES 物料主数据',
    acceptableSystems: [['mes']],
    acceptablePaths: [['mes.material.search']],
    shouldContain: ['RAW_MATERIAL'] },

  // 歧义: "趋势"
  { id: 'P12', query: '最近半年趋势怎么样？', level: 'routing',
    description: '高度歧义 — "趋势"三个系统都有，无 domain 词无法判断',
    acceptableSystems: [['eam'], ['edhr'], ['mes'], ['eam', 'mes']],
    acceptablePaths: [['eam.trend'], ['edhr.trend'], ['mes.trend']] },
]

// ============================================================
// L2 — 跨系统推理测试（组合能力）
// 核心: 一个业务问题需要来自多个系统的数据才能回答
// ============================================================

const CROSS_SYSTEM_TESTS: PlatformTestCase[] = [
  { id: 'P13', query: '这个工厂的设备管理和生产执行整体情况', level: 'cross-system',
    description: '双系统全景 — 需要 EAM + MES 两个 dashboard',
    acceptablePaths: [['eam.dashboard', 'mes.dashboard']],
    shouldContain: ['设备', '工单'] },

  { id: 'P14', query: '维修中的设备，有没有影响到正在执行的生产工单？', level: 'cross-system',
    description: '因果推理 — EAM 设备状态 → MES 生产影响',
    acceptablePaths: [
      ['eam.equipment.search', 'mes.order.search'],
      ['eam.dashboard', 'mes.order.search'],
    ],
    shouldContain: ['维修', '生产'] },

  { id: 'P15', query: '保养完成率低的产线，生产产量受影响了吗？', level: 'cross-system',
    description: 'EAM 保养 → MES 产量关联分析',
    acceptablePaths: [
      ['eam.maintenance.search', 'mes.trend'],
      ['eam.scope.overview', 'mes.trend'],
    ],
    shouldContain: ['保养', '产量'] },

  { id: 'P16', query: '备件库存预警涉及的设备，它们在 MES 里有多少生产工单？', level: 'cross-system',
    description: '供应链影响 — EAM 备件 → 设备 → MES 工单',
    acceptablePaths: [
      ['eam.spare.search', 'mes.order.search'],
      ['eam.spare.search', 'eam.equipment.search', 'mes.order.search'],
    ],
    shouldContain: ['备件', '工单'] },

  { id: 'P17', query: '帮我做一个完整的运营日报：设备、生产、仓库都要有', level: 'cross-system',
    description: '全系统运营报告 — EAM + MES（甚至 EDHR）',
    acceptablePaths: [
      ['eam.dashboard', 'mes.dashboard'],
      ['eam.dashboard', 'mes.dashboard', 'edhr.dashboard'],
    ],
    shouldContain: ['设备', '生产'] },

  { id: 'P18', query: '故障频率最高的设备所在产线，生产趋势是上升还是下降？', level: 'cross-system',
    description: '深层关联 — EAM 故障 → 产线 → MES 趋势',
    acceptablePaths: [
      ['eam.fault.search', 'mes.trend'],
      ['eam.fault.search', 'mes.line.overview'],
    ],
    shouldContain: ['故障', '趋势'] },
]

// ============================================================
// L3 — MES 单系统准确率（工具选择 + 参数 + 数据）
// 核心: 和 EAM/EDHR 的 benchmark 同层级，但只测 MES
// ============================================================

const MES_ACCURACY_TESTS: PlatformTestCase[] = [
  // dashboard
  { id: 'M01', query: 'MES 生产和仓库现在什么情况？', level: 'single-system',
    description: 'MES dashboard 全景',
    acceptablePaths: [['mes.dashboard']],
    mustContain: ['1757'], shouldContain: ['FINISHED', '产线'] },

  // order.search — 状态过滤
  { id: 'M02', query: '有多少生产工单在执行中？', level: 'single-system',
    description: 'order.search 按状态过滤',
    acceptablePaths: [['mes.order.search'], ['mes.dashboard']],
    mustContain: ['55'] },

  // order.search — groupBy
  { id: 'M03', query: '各状态的生产工单数量分布', level: 'single-system',
    description: 'order.search groupBy=status',
    acceptablePaths: [['mes.order.search'], ['mes.dashboard']],
    mustContain: ['1613'], shouldContain: ['FINISHED', 'RUNNING'] },

  // order.profile
  { id: 'M04', query: '工单10015726的详细进度', level: 'single-system',
    description: 'order.profile 单工单深挖',
    acceptablePaths: [['mes.order.profile']],
    mustContain: ['10015726', '1148'], shouldContain: ['FINISHED', 'A012'] },

  // inventory.search — groupBy
  { id: 'M05', query: '各类型库存单的数量分布', level: 'single-system',
    description: 'inventory.search groupBy=orderType',
    acceptablePaths: [['mes.inventory.search']],
    shouldContain: ['WAREHOUSE_OPERATION', 'PURCHASE_ORDER'] },

  // lot.search
  { id: 'M06', query: '物料110662有哪些批次？', level: 'single-system',
    description: 'lot.search 按物料查批次',
    acceptablePaths: [['mes.lot.search']],
    shouldContain: ['110662'] },

  // sublot.search — 质量状态聚合
  { id: 'M07', query: '各质量状态的子批次数量分布', level: 'single-system',
    description: 'sublot.search groupBy=sublotQualityStatus',
    acceptablePaths: [['mes.sublot.search']],
    shouldContain: ['INVALID', 'UNRESTRICTED'] },

  // material.search — 类型聚合
  { id: 'M08', query: '各类型物料有多少种？', level: 'single-system',
    description: 'material.search groupBy=materialType',
    acceptablePaths: [['mes.material.search']],
    shouldContain: ['PACKAGE_MATERIAL', 'RAW_MATERIAL', 'FINISHED_PRODUCT'] },

  // recipe.profile
  { id: 'M09', query: '物料114428的配方工艺路线是什么？', level: 'single-system',
    description: 'recipe.profile 按物料查配方',
    acceptablePaths: [['mes.recipe.profile']],
    shouldContain: ['114428'] },

  // trend
  { id: 'M10', query: '2024年下半年各月工单数量和产量对比', level: 'single-system',
    description: 'trend 按月统计',
    acceptablePaths: [['mes.trend']],
    shouldContain: ['2024'] },

  // line.overview
  { id: 'M11', query: '乳化线的生产概况', level: 'single-system',
    description: 'line.overview 产线概览',
    acceptablePaths: [['mes.line.overview']],
    shouldContain: ['乳化'] },

  // material.search — 名称搜索
  { id: 'M12', query: '搜索包含"乳霜"的物料', level: 'single-system',
    description: 'material.search 按名称模糊搜索',
    acceptablePaths: [['mes.material.search']],
    shouldContain: ['乳霜'] },
]

// ============================================================
// 导出: 合并三层
// ============================================================

export const PLATFORM_TEST_CASES: PlatformTestCase[] = [
  ...ROUTING_TESTS,
  ...CROSS_SYSTEM_TESTS,
  ...MES_ACCURACY_TESTS,
]

// 按 level 分组的快捷方法
export function getTestsByLevel(level: TestLevel): PlatformTestCase[] {
  return PLATFORM_TEST_CASES.filter(t => t.level === level)
}

// 统计
export const PLATFORM_TEST_STATS = {
  total: PLATFORM_TEST_CASES.length,
  routing: ROUTING_TESTS.length,
  crossSystem: CROSS_SYSTEM_TESTS.length,
  singleSystem: MES_ACCURACY_TESTS.length,
}
