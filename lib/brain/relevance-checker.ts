// 数据相关性与域覆盖 — 供置信度与 router 共用
import type { ConfidenceLevel } from '@/lib/types'

/** 工具返回是否含可用业务数据（非空壳 / 非仅 context 占位） */
export function hasActualData(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if ('total' in d && typeof d.total === 'number' && d.total > 0) return true
  if ('items' in d && Array.isArray(d.items) && d.items.length > 0) return true
  if ('groups' in d && Array.isArray(d.groups) && d.groups.length > 0) return true
  if ('context' in d) return false
  if (!('total' in d) && !('items' in d) && !('groups' in d)) return true
  return false
}

/** 任意一次成功调用是否带有实际数据 */
export function anyResultHasData(results: Array<{ data: unknown }>): boolean {
  return results.some(r => hasActualData(r.data))
}

/**
 * 数据相关性信号
 * - low: 无调用、全无数据、或 intent 域完全未覆盖
 * - high: 有数据且（无 intent 域约束或域已全部覆盖）
 * - medium: 部分成功或部分域未覆盖但有数据
 */
export function computeDataRelevance(params: {
  totalCallsAttempted: number
  successfulResults: Array<{ data: unknown }>
  intentDomains: string[]
  coveredDomains: string[]
}): ConfidenceLevel {
  const { totalCallsAttempted, successfulResults, intentDomains, coveredDomains } = params

  if (totalCallsAttempted === 0) return 'low'
  if (!anyResultHasData(successfulResults)) return 'low'

  const uncovered = intentDomains.filter(d => !coveredDomains.includes(d))
  if (intentDomains.length > 0 && uncovered.length === intentDomains.length) return 'low'
  if (uncovered.length > 0) return 'medium'
  if (successfulResults.length < totalCallsAttempted) return 'medium'
  return 'high'
}
