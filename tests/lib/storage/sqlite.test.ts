import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SQLiteStorage } from '@/lib/storage/sqlite'
import type { MemorySession, MemoryVerdict, MemoryPreference } from '@/lib/types'

function makeSession(overrides: Partial<MemorySession> = {}): MemorySession {
  return {
    sessionId: 'sess-001',
    userId: 'user-1',
    tenantId: 'default',
    query: '系统里有多少台设备？',
    intentHash: 'hash-abc',
    toolChain: ['query_equipment'],
    resultSummary: '共 128 台',
    routingDecision: { model: 'gpt-5.4-mini' },
    createdAt: new Date('2026-03-26T10:00:00Z'),
    expiresAt: new Date('2026-04-25T10:00:00Z'),
    ...overrides,
  }
}

function makeVerdict(overrides: Partial<MemoryVerdict> = {}): MemoryVerdict {
  return {
    intentHash: 'hash-abc',
    tenantId: 'default',
    toolChain: ['query_equipment'],
    avgScore: 4.2,
    sampleCount: 5,
    confidence: 'medium',
    bonusPoints: 25,
    lastUpdated: new Date('2026-03-26T10:00:00Z'),
    expiresAt: new Date('2026-04-25T10:00:00Z'),
    ...overrides,
  }
}

describe('SQLiteStorage', () => {
  let storage: SQLiteStorage

  beforeEach(() => {
    // 用内存数据库，每个测试隔离
    storage = new SQLiteStorage(':memory:')
    storage.initialize()
  })

  afterEach(() => {
    storage.close()
  })

  // --- Session ---

  it('插入并按 intentHash 查询 session', () => {
    storage.insertSession(makeSession())
    storage.insertSession(makeSession({ sessionId: 'sess-002', intentHash: 'hash-xyz' }))

    const results = storage.getSessionsByIntentHash('default', 'hash-abc')
    expect(results).toHaveLength(1)
    expect(results[0].sessionId).toBe('sess-001')
    expect(results[0].toolChain).toEqual(['query_equipment'])
    expect(results[0].routingDecision).toEqual({ model: 'gpt-5.4-mini' })
  })

  it('session 查询 limit 生效', () => {
    for (let i = 0; i < 5; i++) {
      storage.insertSession(makeSession({ sessionId: `sess-${i}` }))
    }
    const results = storage.getSessionsByIntentHash('default', 'hash-abc', 3)
    expect(results).toHaveLength(3)
  })

  it('不同 tenant 的 session 互不可见', () => {
    storage.insertSession(makeSession({ tenantId: 'tenant-a' }))
    const results = storage.getSessionsByIntentHash('tenant-b', 'hash-abc')
    expect(results).toHaveLength(0)
  })

  // --- Verdict ---

  it('upsert 并查询 verdict', () => {
    storage.upsertVerdict(makeVerdict())
    const v = storage.getVerdict('default', 'hash-abc')
    expect(v).not.toBeNull()
    expect(v!.avgScore).toBe(4.2)
    expect(v!.toolChain).toEqual(['query_equipment'])
  })

  it('upsert 更新已有 verdict', () => {
    storage.upsertVerdict(makeVerdict())
    storage.upsertVerdict(makeVerdict({ avgScore: 4.8, sampleCount: 10, confidence: 'high', bonusPoints: 50 }))
    const v = storage.getVerdict('default', 'hash-abc')
    expect(v!.avgScore).toBe(4.8)
    expect(v!.sampleCount).toBe(10)
    expect(v!.bonusPoints).toBe(50)
  })

  it('不存在的 verdict 返回 null', () => {
    const v = storage.getVerdict('default', 'nonexistent')
    expect(v).toBeNull()
  })

  // --- Preference ---

  it('set 并 get preference', () => {
    const pref: MemoryPreference = {
      userId: 'user-1',
      tenantId: 'default',
      preferences: { defaultPageSize: 20, language: 'zh' },
      createdAt: new Date('2026-03-26T10:00:00Z'),
      updatedAt: new Date('2026-03-26T10:00:00Z'),
    }
    storage.setPreference(pref)
    const result = storage.getPreference('default', 'user-1')
    expect(result).not.toBeNull()
    expect(result!.preferences).toEqual({ defaultPageSize: 20, language: 'zh' })
  })

  it('setPreference 覆盖更新', () => {
    const pref: MemoryPreference = {
      userId: 'user-1',
      tenantId: 'default',
      preferences: { language: 'zh' },
      createdAt: new Date('2026-03-26T10:00:00Z'),
      updatedAt: new Date('2026-03-26T10:00:00Z'),
    }
    storage.setPreference(pref)
    storage.setPreference({ ...pref, preferences: { language: 'en' }, updatedAt: new Date('2026-03-27T10:00:00Z') })
    const result = storage.getPreference('default', 'user-1')
    expect(result!.preferences).toEqual({ language: 'en' })
  })

  it('不存在的 preference 返回 null', () => {
    const result = storage.getPreference('default', 'nobody')
    expect(result).toBeNull()
  })
})
