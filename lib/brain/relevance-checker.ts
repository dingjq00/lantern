// 数据字段提取工具（供 subagent-evaluator 和 router 使用）
// 注：checkRelevance 规则检测已在实验中证明无效（0 条 lesson），已删除

/**
 * 从嵌套数据中提取所有字段名（递归）
 */
export function extractDataFields(data: unknown, depth = 0): string[] {
  if (depth > 3) return []
  const fields: string[] = []

  if (Array.isArray(data)) {
    for (const item of data.slice(0, 3)) {
      fields.push(...extractDataFields(item, depth + 1))
    }
  } else if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      fields.push(key)
      if (typeof value === 'object' && value !== null) {
        fields.push(...extractDataFields(value, depth + 1))
      }
    }
  }

  return [...new Set(fields)]
}
