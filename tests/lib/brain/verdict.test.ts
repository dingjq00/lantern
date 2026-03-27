import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { maybeUpdateVerdict } from '@/lib/brain/verdict'
import { SQLiteStorage } from '@/lib/storage/sqlite'
import type { MemorySession } from '@/lib/types'

function makeSession(overrides: Partial<MemorySession> = {}): MemorySession {
  return {
    sessionId: `sess-${Math.random().toString(36).slice(2, 8)}`,
    userId: 'user-1', tenantId: 'default', query: '测试',
    intentHash: 'hash-test', toolChain: ['query_equipment'],
    resultSummary: '结果', routingDecision: {},
    createdAt: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ...overrides,
  }
}

describe('maybeUpdateVerdict', () => {
  let storage: SQLiteStorage

  beforeEach(() => {
    storage = new SQLiteStorage(':memory:')
    storage.initialize()
  })
  afterEach(() => storage.close())

  it('样本不足时不触发 verdict', async () => {
    // 只插入 2 条，阈值 3
    storage.insertSession(makeSession())
    storage.insertSession(makeSession())
    await maybeUpdateVerdict(storage, 'default', 'hash-test', 3)
    expect(storage.getVerdict('default', 'hash-test')).toBeNull()
  })

  it('达到阈值时生成 verdict（无反馈 → 中性评分）', async () => {
    for (let i = 0; i < 3; i++) {
      storage.insertSession(makeSession())
    }
    await maybeUpdateVerdict(storage, 'default', 'hash-test', 3)
    const v = storage.getVerdict('default', 'hash-test')
    expect(v).not.toBeNull()
    // 3 条无反馈 session: 每条 0.5×1 权重，effectiveSamples=3
    expect(v!.sampleCount).toBe(3)
    expect(v!.avgScore).toBeCloseTo(0.5)
    expect(v!.toolChain).toEqual(['query_equipment'])
  })

  it('feedback up 权重更高', async () => {
    for (let i = 0; i < 3; i++) {
      storage.insertSession(makeSession())
    }
    // 给第一条 thumbs up
    const sessions = storage.getSessionsByIntentHash('default', 'hash-test')
    storage.updateSessionFeedback('default', sessions[0].sessionId, 'up')

    await maybeUpdateVerdict(storage, 'default', 'hash-test', 3)
    const v = storage.getVerdict('default', 'hash-test')
    expect(v).not.toBeNull()
    // 1 条 up (×3) + 2 条无反馈 (×1 each) = effectiveSamples = 5
    expect(v!.sampleCount).toBe(5)
  })

  it('feedback down 拉低评分', async () => {
    for (let i = 0; i < 3; i++) {
      storage.insertSession(makeSession())
    }
    const sessions = storage.getSessionsByIntentHash('default', 'hash-test')
    storage.updateSessionFeedback('default', sessions[0].sessionId, 'down')

    await maybeUpdateVerdict(storage, 'default', 'hash-test', 3)
    const v = storage.getVerdict('default', 'hash-test')
    expect(v).not.toBeNull()
    // 1 条 down (0×3=0, weight=3) + 2 条无反馈 (0.5×1 each)
    // totalScore = 0 + 1.0 = 1.0, effectiveSamples = 3+2 = 5
    expect(v!.avgScore).toBeCloseTo(1.0 / 5)
  })

  it('bonusPoints 按 sampleCount 计算', async () => {
    for (let i = 0; i < 5; i++) {
      storage.insertSession(makeSession())
    }
    await maybeUpdateVerdict(storage, 'default', 'hash-test', 3)
    const v = storage.getVerdict('default', 'hash-test')
    // 5 条无反馈 → effectiveSamples=5 → medium confidence → +25 bonus
    expect(v!.bonusPoints).toBe(25)
    expect(v!.confidence).toBe('medium')
  })

  it('lesson quality 影响评分', async () => {
    for (let i = 0; i < 3; i++) {
      storage.insertSession(makeSession())
    }
    // 插入一条 bad lesson
    storage.insertLesson({
      intentHash: 'hash-test', tenantId: 'default', query: '测试',
      selectedTools: ['query_equipment'], quality: 'bad',
      errorReason: '选错工具', lesson: '应该用别的工具',
      source: 'user_feedback', createdAt: new Date(),
    })

    await maybeUpdateVerdict(storage, 'default', 'hash-test', 3)
    const v = storage.getVerdict('default', 'hash-test')
    expect(v).not.toBeNull()
    // 3 条无反馈 (totalScore=1.5) - bad lesson (0.5) = 1.0, samples=3
    expect(v!.avgScore).toBeCloseTo(1.0 / 3)
  })
})
