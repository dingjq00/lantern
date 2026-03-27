// 层 1: 关联性检测 — 规则+关键词，零 LLM 成本
// 检测返回数据的"主题"和用户问题的"主题"是否匹配

import type { IntentTags } from '@/lib/types'

export interface RelevanceResult {
  layer: 'relevance'
  relevant: boolean
  domainMatch: boolean
  fieldCoverage: number          // 0-1
  missingDomains: string[]
  missingFields: string[]
  recommendation: 'pass' | 'review' | 'fail'
  reason: string
}

// 关键词 → 数据字段映射（可配置）
const KEYWORD_FIELD_MAP: Record<string, string[]> = {
  '保养': ['maintenanceRate', 'scheduledDate', 'completedDate', 'planName', 'taskId', 'executor'],
  '故障': ['faultType', 'faultReportId', 'reportTime', 'faultDescription', 'description'],
  '维修': ['repairOrderId', 'repairHours', 'finishTime', 'sparesUsed', 'laborRecords'],
  '备件': ['spareId', 'spareName', 'quantity', 'safetyStock', 'shortage'],
  '库存': ['currentStock', 'safetyStock', 'shortage', 'warehouseId', 'warehouseName'],
  '工时': ['repairHours', 'laborRecords', 'hours', 'worker'],
  '巡检': ['patrolId', 'completionRate', 'anomalyRate', 'anomalyCount'],
  '异常': ['anomalyId', 'severity', 'anomalyRate', 'anomalyCount', 'pendingCount'],
  '趋势': ['trend', 'avgPerDay', 'totalFaults', 'trendData'],
  '知识': ['knowledgeRefs', 'docId', 'title'],
  '待办': ['pendingFaults', 'pendingOrders', 'pendingMaintenance'],
  '统计': ['total', 'totalEquipment', 'runningCount', 'distribution'],
  '执行率': ['completionRate', 'maintenanceRate', 'processRate'],
}

/**
 * 检查工具返回数据是否和用户问题匹配
 */
export function checkRelevance(
  query: string,
  intent: IntentTags | undefined,
  toolsDomains: string[],        // 实际调用的工具的 domains
  returnedDataFields: string[],  // 返回数据的所有字段名
): RelevanceResult {
  // 1. 域匹配检测
  const intentDomains = intent?.domains ?? []
  const missingDomains = intentDomains.filter(d => !toolsDomains.includes(d))
  const domainMatch = missingDomains.length === 0

  // 2. 关键词-字段匹配
  const queryKeywords = Object.keys(KEYWORD_FIELD_MAP).filter(kw => query.includes(kw))
  let matchedFields = 0
  let totalExpectedFields = 0
  const missingFields: string[] = []

  for (const keyword of queryKeywords) {
    const expectedFields = KEYWORD_FIELD_MAP[keyword]
    totalExpectedFields += expectedFields.length
    const found = expectedFields.filter(f => returnedDataFields.some(df => df.includes(f) || f.includes(df)))
    matchedFields += found.length
    if (found.length === 0) {
      missingFields.push(`"${keyword}" 相关字段缺失`)
    }
  }

  const fieldCoverage = totalExpectedFields > 0 ? matchedFields / totalExpectedFields : 1

  // 3. 综合判断
  let recommendation: RelevanceResult['recommendation'] = 'pass'
  let reason = '数据和问题匹配'

  if (!domainMatch && fieldCoverage < 0.3) {
    recommendation = 'fail'
    reason = `域偏移(缺${missingDomains.join(',')}) + 字段覆盖率仅${(fieldCoverage * 100).toFixed(0)}%`
  } else if (!domainMatch) {
    recommendation = 'review'
    reason = `域偏移: 缺少 ${missingDomains.join(', ')} 域的数据`
  } else if (fieldCoverage < 0.3 && queryKeywords.length > 0) {
    recommendation = 'review'
    reason = `字段覆盖率低: ${(fieldCoverage * 100).toFixed(0)}%`
  }

  return {
    layer: 'relevance',
    relevant: recommendation === 'pass',
    domainMatch,
    fieldCoverage,
    missingDomains,
    missingFields,
    recommendation,
    reason,
  }
}

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
