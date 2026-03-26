// 自学习 verdict 引擎 — P1
// 评分触发 + winner 计算 + verdict 写入
import type { StorageInterface } from '@/lib/storage/types'
import type { LLMProvider, MemoryVerdict, ConfidenceLevel } from '@/lib/types'

/**
 * 检查某 intent_hash 的 session 是否达到阈值，达到则计算并写入 verdict
 * @param threshold 触发阈值（冷启动可传 3，正常 5）
 */
export async function maybeUpdateVerdict(
  storage: StorageInterface,
  llm: LLMProvider,
  tenantId: string,
  intentHash: string,
  threshold = 5,
): Promise<void> {
  const sessions = storage.getSessionsByIntentHash(tenantId, intentHash, 50)
  if (sessions.length < threshold) return

  // 计算每条 session 的评分（有 feedback 的权重 ×3）
  let totalScore = 0
  let effectiveSamples = 0

  for (const session of sessions) {
    const eval_ = await llm.evaluate(session.query, session.toolChain, session.resultSummary)
    const composite = eval_.relevance * 0.5 + eval_.completeness * 0.3 + eval_.efficiency * 0.2
    const weight = session.feedback === 'up' ? 3 : session.feedback === 'down' ? 0 : 1
    totalScore += composite * weight
    effectiveSamples += weight
  }

  if (effectiveSamples === 0) return

  const avgScore = totalScore / effectiveSamples

  // 找 winner 工具链（出现次数最多的）
  const chainCounts = new Map<string, number>()
  for (const session of sessions) {
    const key = session.toolChain.join('→')
    chainCounts.set(key, (chainCounts.get(key) ?? 0) + 1)
  }
  const winnerKey = [...chainCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  const winnerChain = winnerKey.split('→')

  // confidence + bonus
  let confidence: ConfidenceLevel = 'low'
  let bonusPoints = 0
  if (effectiveSamples >= 10) {
    confidence = 'high'
    bonusPoints = 50
  } else if (effectiveSamples >= 3) {
    confidence = 'medium'
    bonusPoints = 25
  }

  const verdict: MemoryVerdict = {
    intentHash,
    tenantId,
    toolChain: winnerChain,
    avgScore,
    sampleCount: effectiveSamples,
    confidence,
    bonusPoints,
    lastUpdated: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  }

  storage.upsertVerdict(verdict)
}
