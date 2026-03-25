// 结果呈现引擎 — spec Section 5.6
import type { StructuredResult, ConfidenceLevel, DisplayFormat } from '@/lib/types'

/** 检测数据类型，决定展示格式 */
export function detectDisplayFormat(data: unknown): DisplayFormat {
  if (Array.isArray(data)) return 'multi_step'

  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    // 含 trend 或日期序列 → timeseries
    if ('trend' in obj || Object.values(obj).some(v =>
      Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] !== null && 'date' in v[0]
    )) return 'timeseries'
    // 含 items 列表 → list
    if ('items' in obj && Array.isArray(obj.items)) return 'list'
  }

  return 'single_value'
}

/** 构建最终返回前端的结构化结果 */
export function buildStructuredResult(
  answer: string,
  data: Record<string, unknown>[],
  display: StructuredResult['display'],
  confidence: ConfidenceLevel,
  columns?: string[],
  followUp?: string[],
): StructuredResult {
  return { answer, data, display, confidence, columns, followUp }
}
