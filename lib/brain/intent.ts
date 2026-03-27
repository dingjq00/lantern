// 意图提取 + intent_hash 计算
import { createHash } from 'crypto'
import type { ThinkResult, IntentTags, ConfidenceLevel } from '@/lib/types'

/**
 * 对结构化意图字段排序后计算 SHA256 截取前 16 位
 * 用于经验层 verdict 的 key
 */
export function computeIntentHash(
  domains: string[],
  operation: string,
  filters: string[],
): string {
  const normalized = {
    d: [...domains].sort(),
    o: operation,
    f: [...filters].sort(),
  }
  return createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex')
    .slice(0, 16)
}

/**
 * P1: 从 ThinkResult 第一轮输出提取结构化意图 + clarity
 * clarity 默认 'high' — 不惩罚没返回 clarity 的情况
 * （LLM 层 mapClarity 已将 clear→high, ambiguous→medium, unsupported→low）
 */
export function extractIntentFromThinkResult(result: ThinkResult): {
  intent: IntentTags | undefined
  clarity: ConfidenceLevel
} {
  if (!result.intent) {
    return { intent: undefined, clarity: result.clarity ?? 'high' }
  }
  const intentHash = computeIntentHash(result.intent.domains, result.intent.operation, result.intent.filters)
  return {
    intent: { ...result.intent, intentHash },
    clarity: result.clarity ?? 'high',
  }
}
