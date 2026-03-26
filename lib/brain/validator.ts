// 结果自验证 — P1: 纯规则校验，不用 LLM
import type { ValidationResult } from '@/lib/types'

// 疑似百分率的字段名模式
const RATE_PATTERN = /rate|率|percentage|percent/i
// 疑似数量的字段名模式
const QUANTITY_PATTERN = /count|total|quantity|数|amount|num/i

/**
 * 校验工具返回数据，检测数值异常和空结果
 */
export function validateResult(data: unknown): ValidationResult[] {
  const results: ValidationResult[] = []
  if (data === null || data === undefined) return results

  if (typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>

    // 检查空结果
    if ('items' in obj && Array.isArray(obj.items) && obj.items.length === 0) {
      results.push({ type: 'empty_result', message: '查询返回空结果', severity: 'warning' })
    }
    if ('total' in obj && obj.total === 0 && 'items' in obj) {
      // 已在上面处理
    }

    // 递归检查每个字段
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'number') {
        // 百分率范围 [0, 100]
        if (RATE_PATTERN.test(key) && (value < 0 || value > 100)) {
          results.push({
            type: 'numeric_range', field: key,
            message: `${key}=${value}，百分率应在 0-100 范围内`,
            severity: 'warning',
          })
        }
        // 数量 >= 0
        if (QUANTITY_PATTERN.test(key) && value < 0) {
          results.push({
            type: 'numeric_range', field: key,
            message: `${key}=${value}，数量不应为负数`,
            severity: 'warning',
          })
        }
        // 通用负数检测（非百分率字段）
        if (!RATE_PATTERN.test(key) && !QUANTITY_PATTERN.test(key) && value < 0) {
          results.push({
            type: 'numeric_range', field: key,
            message: `${key}=${value}，数值异常（负数）`,
            severity: 'warning',
          })
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // 递归检查嵌套对象
        results.push(...validateResult(value))
      }
    }
  }

  return results
}
