import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { maybeUpdateVerdict } from '@/lib/brain/verdict'
import { SQLiteStorage } from '@/lib/storage/sqlite'
import type { MemorySession, LLMProvider, RouteResult, EvaluateResult, SummarizeResult, ThinkResult, DisplayFormat } from '@/lib/types'

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

// Mock LLM for evaluate()
const mockLLM: LLMProvider = {
  async route(): Promise<RouteResult> { return { calls: [], confidenceSignals: { toolMatch: 'high', verdictConfidence: 'medium', queryClarity: 'high' } } },
  async evaluate(): Promise<EvaluateResult> { return { relevance: 4, completeness: 4, efficiency: 4 } },
  async summarize(): Promise<SummarizeResult> { return { answer: '', display: 'text' } },
  async think(): Promise<ThinkResult> { return { thought: '', finish: true } },
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
    await maybeUpdateVerdict(storage, mockLLM, 'default', 'hash-test', 3)
    expect(storage.getVerdict('default', 'hash-test')).toBeNull()
  })

  it('达到阈值时生成 verdict', async () => {
    for (let i = 0; i < 3; i++) {
      storage.insertSession(makeSession())
    }
    await maybeUpdateVerdict(storage, mockLLM, 'default', 'hash-test', 3)
    const v = storage.getVerdict('default', 'hash-test')
    expect(v).not.toBeNull()
    expect(v!.sampleCount).toBe(3)
    expect(v!.avgScore).toBeGreaterThan(0)
    expect(v!.toolChain).toEqual(['query_equipment'])
  })

  it('feedback up 权重更高', async () => {
    for (let i = 0; i < 3; i++) {
      storage.insertSession(makeSession())
    }
    // 给第一条 thumbs up
    const sessions = storage.getSessionsByIntentHash('default', 'hash-test')
    storage.updateSessionFeedback('default', sessions[0].sessionId, 'up')

    await maybeUpdateVerdict(storage, mockLLM, 'default', 'hash-test', 3)
    const v = storage.getVerdict('default', 'hash-test')
    expect(v).not.toBeNull()
    // 有 feedback 的 session 权重 ×3，等效 5 条
    expect(v!.sampleCount).toBe(5)
  })

  it('bonusPoints 按 sampleCount 计算', async () => {
    for (let i = 0; i < 5; i++) {
      storage.insertSession(makeSession())
    }
    await maybeUpdateVerdict(storage, mockLLM, 'default', 'hash-test', 3)
    const v = storage.getVerdict('default', 'hash-test')
    // 5 条样本 → medium confidence → +25 bonus
    expect(v!.bonusPoints).toBe(25)
    expect(v!.confidence).toBe('medium')
  })
})
