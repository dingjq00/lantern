import { describe, it, expect, afterEach } from 'vitest'
import { SQLiteStorage } from './sqlite'
import type { MemorySession, BenchmarkRun } from '@/lib/types'

describe('SQLiteStorage', () => {
  let storage: SQLiteStorage

  afterEach(() => {
    storage?.close()
  })

  it('initialize 在内存库可重复执行', () => {
    storage = new SQLiteStorage(':memory:')
    storage.initialize()
    storage.initialize()
    expect(true).toBe(true)
  })

  it('session 写入与按 intentHash 查询', () => {
    storage = new SQLiteStorage(':memory:')
    storage.initialize()
    const session: MemorySession = {
      sessionId: 's1',
      userId: 'u1',
      tenantId: 't1',
      query: '测试',
      intentHash: 'hash-abc',
      toolChain: ['eam.dashboard'],
      resultSummary: '摘要',
      routingDecision: { rounds: 1, confidence: 'high' },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    }
    storage.insertSession(session)
    const rows = storage.getSessionsByIntentHash('t1', 'hash-abc')
    expect(rows).toHaveLength(1)
    expect(rows[0].toolChain).toEqual(['eam.dashboard'])
  })

  it('feedback 更新', () => {
    storage = new SQLiteStorage(':memory:')
    storage.initialize()
    storage.insertSession({
      sessionId: 's2',
      userId: 'u1',
      tenantId: 't1',
      query: 'q',
      intentHash: 'h',
      toolChain: [],
      resultSummary: '',
      routingDecision: { rounds: 0, confidence: 'low' },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    })
    storage.updateSessionFeedback('t1', 's2', 'down')
    const row = storage.getSessionsByIntentHash('t1', 'h')[0]
    expect(row.feedback).toBe('down')
  })

  it('benchmark run 往返', () => {
    storage = new SQLiteStorage(':memory:')
    storage.initialize()
    const run: BenchmarkRun = {
      runId: 'run-1',
      timestamp: new Date().toISOString(),
      config: {
        model: 'test-model',
        maxChaseRounds: 2,
        escalationModel: 'test',
        promptVersion: 'v1',
        datasetVersion: 'platform-v1',
        commitSha: 'abc123',
      },
      summary: { total: 1, success: 1, recall: 1, precision: 1, perfectCount: 1 },
      results: [],
    }
    storage.saveBenchmarkRun(run)
    const loaded = storage.getBenchmarkRun('run-1')
    expect(loaded?.config.datasetVersion).toBe('platform-v1')
    expect(loaded?.config.commitSha).toBe('abc123')
    const list = storage.getBenchmarkRuns()
    expect(list.some(r => r.runId === 'run-1')).toBe(true)
  })
})
