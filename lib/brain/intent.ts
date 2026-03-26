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
 */
export function extractIntentFromThinkResult(result: ThinkResult): {
  intent: IntentTags
  clarity: ConfidenceLevel
} {
  const raw = result.intent ?? { domains: [], operation: '', filters: [] }
  const intentHash = computeIntentHash(raw.domains, raw.operation, raw.filters)
  return {
    intent: { ...raw, intentHash },
    clarity: result.clarity ?? 'medium',
  }
}
