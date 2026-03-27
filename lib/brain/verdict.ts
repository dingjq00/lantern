// 自学习 verdict 引擎 — P1
// 评分基于外部信号（用户反馈 + lesson 质量），不调用 LLM 自评
// 原则：信号来自外部，不来自 AI 自己
import type { StorageInterface } from '@/lib/storage/types'
import type { MemoryVerdict, ConfidenceLevel } from '@/lib/types'

/**
 * 检查某 intent_hash 的 session 是否达到阈值，达到则计算并写入 verdict
 * 评分来源：用户反馈（最高权重）+ lesson 质量聚合，零 LLM 调用
 * @param threshold 触发阈值（冷启动可传 3，正常 5）
 */
export async function maybeUpdateVerdict(
  storage: StorageInterface,
  tenantId: string,
  intentHash: string,
  threshold = 5,
): Promise<void> {
  const sessions = storage.getSessionsByIntentHash(tenantId, intentHash, 50)
  if (sessions.length < threshold) return

  // 基于外部信号计算评分
  // 用户反馈：up → 1.0×3权重, down → 0.0×3权重, 无反馈 → 0.5×1权重
  let totalScore = 0
  let effectiveSamples = 0

  for (const session of sessions) {
    if (session.feedback === 'up') {
      totalScore += 1.0 * 3
      effectiveSamples += 3
    } else if (session.feedback === 'down') {
      // 负面反馈：0 分但计入权重
      effectiveSamples += 3
    } else {
      // 无反馈：中性
      totalScore += 0.5
      effectiveSamples += 1
    }
  }

  // lesson 质量信号（getLessonsByIntentHash 只返回 quality != 'good'）
  const lessons = storage.getLessonsByIntentHash(tenantId, intentHash)
  for (const lesson of lessons) {
    if (lesson.quality === 'bad') {
      totalScore -= 0.5
    } else if (lesson.quality === 'partial') {
      totalScore -= 0.2
    }
  }

  if (effectiveSamples === 0) return

  const avgScore = Math.max(0, totalScore / effectiveSamples)

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
