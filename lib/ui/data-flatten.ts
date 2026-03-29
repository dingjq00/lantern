// 共享数据展平逻辑 — ResultTable 和 Benchmark 共用
// 智能识别 MCP 返回的多种数据格式，提取表格行 + 元数据

export interface FlattenResult {
  rows: Record<string, unknown>[]
  /** 元数据摘要（total、groupBy 等非数组字段） */
  meta: Record<string, unknown>
}

/**
 * 把 MCP 返回的嵌套数据展平为表格行 + 元数据
 *
 * 支持的模式：
 * 1. { items: [...] }         — 分页搜索结果
 * 2. { groups: [...] }        — groupBy 聚合
 * 3. { records: [...] }       — 设备巡检记录等
 * 4. { trend: [...] }         — 时间序列
 * 5. { anyKey: [...objects] } — 自动发现第一个对象数组
 * 6. 所有 value 都是数组      — 合并所有子数组
 * 7. 已经是平坦行             — 直接使用
 */
export function flattenMcpData(data: Record<string, unknown>[]): FlattenResult {
  const allRows: Record<string, unknown>[] = []
  const allMeta: Record<string, unknown> = {}

  for (const item of data) {
    const { rows, meta } = flattenSingleItem(item)
    allRows.push(...rows)
    Object.assign(allMeta, meta)
  }

  return { rows: allRows, meta: allMeta }
}

function flattenSingleItem(item: Record<string, unknown>): FlattenResult {
  const values = Object.values(item)

  // 模式 1: 所有 value 都是数组 — 合并所有子数组的对象
  if (values.length > 0 && values.every(v => Array.isArray(v))) {
    const rows: Record<string, unknown>[] = []
    for (const arr of values) {
      for (const row of arr as unknown[]) {
        if (isPlainObject(row)) rows.push(row as Record<string, unknown>)
      }
    }
    return { rows, meta: {} }
  }

  // 模式 2: 找"主数组" — 第一个值为对象数组的属性
  // 优先级: items > groups > records > trend > series > 其他
  const priorityKeys = ['items', 'groups', 'records', 'trend', 'series', 'metrics', 'list']
  let mainKey: string | null = null
  let mainArray: Record<string, unknown>[] | null = null

  // 先按优先级找
  for (const key of priorityKeys) {
    if (key in item && isObjectArray(item[key])) {
      mainKey = key
      mainArray = item[key] as Record<string, unknown>[]
      break
    }
  }

  // 没找到就自动发现第一个对象数组
  if (!mainArray) {
    for (const [key, value] of Object.entries(item)) {
      if (isObjectArray(value)) {
        mainKey = key
        mainArray = value as Record<string, unknown>[]
        break
      }
    }
  }

  if (mainArray && mainKey) {
    // 剩余字段作为元数据
    const meta: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(item)) {
      if (key !== mainKey) meta[key] = value
    }
    return { rows: mainArray, meta }
  }

  // 模式 3: 有嵌套对象但无数组 — 深度展平为 key-value 表格
  // 典型场景: dashboard 返回 { equipment: {total:165}, faultReports: {pending:55} }
  const hasNestedObjects = Object.values(item).some(v => isPlainObject(v))
  if (hasNestedObjects) {
    // 类别和指标的中文映射
    const categoryLabels: Record<string, string> = {
      equipment: '设备', faultReports: '故障报修', repairOrders: '维修工单',
      maintenance: '保养', patrol: '巡检', spare: '备件', spareAlerts: '备件预警',
      todoCount: '待办事项',
    }
    const metricLabels: Record<string, string> = {
      total: '总数', running: '运行中', fault: '故障', pending: '待处理',
      completed: '已完成', overdue: '逾期', abnormal: '异常',
    }
    const rows: Record<string, unknown>[] = []
    for (const [key, value] of Object.entries(item)) {
      if (isPlainObject(value)) {
        for (const [subKey, subVal] of Object.entries(value as Record<string, unknown>)) {
          if (!isPlainObject(subVal) && !Array.isArray(subVal)) {
            rows.push({
              '类别': categoryLabels[key] ?? key,
              '指标': metricLabels[subKey] ?? subKey,
              '值': subVal,
            })
          }
        }
      } else if (!Array.isArray(value)) {
        rows.push({
          '类别': '-',
          '指标': categoryLabels[key] ?? key,
          '值': value,
        })
      }
    }
    if (rows.length > 0) return { rows, meta: {} }
  }

  // 模式 4: 纯平坦对象 — 对象本身就是一行数据
  return { rows: [item], meta: {} }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isObjectArray(v: unknown): v is Record<string, unknown>[] {
  return Array.isArray(v) && v.length > 0 && isPlainObject(v[0])
}

/**
 * 格式化单元格值 — 比 JSON.stringify 更人性化
 */
export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'number') {
    // 时间戳（13位毫秒） → 日期时间
    if (value > 1e12 && value < 2e12) {
      return new Date(value).toLocaleString('zh-CN')
    }
    return String(value)
  }
  if (typeof value === 'string') {
    // ISO 日期字符串 → 本地格式
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return new Date(value).toLocaleString('zh-CN')
    }
    return value
  }
  // 数组 → 逗号分隔（最多展示 3 项）
  if (Array.isArray(value)) {
    if (value.length === 0) return '-'
    const preview = value.slice(0, 3).map(v =>
      typeof v === 'object' ? JSON.stringify(v) : String(v)
    )
    return value.length > 3 ? `${preview.join(', ')} +${value.length - 3}` : preview.join(', ')
  }
  // 对象 → 提取关键字段或紧凑 JSON
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    // 常见模式: { code, name } 或 { id, name }
    if ('name' in obj) {
      return 'code' in obj ? `${obj.code} ${obj.name}` : String(obj.name)
    }
    const json = JSON.stringify(obj)
    return json.length > 80 ? json.slice(0, 77) + '...' : json
  }
  return String(value)
}

/**
 * 生成元数据摘要文本
 * 例如: "共 165 条记录，按状态分组" 或 "共 50 条，展示前 20 条"
 */
export function buildMetaSummary(meta: Record<string, unknown>): string | null {
  const parts: string[] = []

  // total 或 totalRecords
  const totalVal = meta.total ?? meta.totalRecords
  if (typeof totalVal === 'number') {
    if ('count' in meta && typeof meta.count === 'number' && meta.count < totalVal) {
      parts.push(`共 ${totalVal} 条，展示前 ${meta.count} 条`)
    } else {
      parts.push(`共 ${totalVal} 条`)
    }
  }

  if ('groupBy' in meta && typeof meta.groupBy === 'string') {
    const groupLabels: Record<string, string> = {
      equipment: '设备', status: '状态', urgency: '紧急度',
      type: '类型', month: '月份', category: '分类',
      day: '日', week: '周',
    }
    parts.push(`按${groupLabels[meta.groupBy] ?? meta.groupBy}分组`)
  }

  if ('source' in meta && typeof meta.source === 'string') {
    parts.push(`来源: ${meta.source}`)
  }

  return parts.length > 0 ? parts.join('，') : null
}
