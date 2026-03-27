import { describe, it, expect } from 'vitest'
import { computeIntentHash, extractIntentFromThinkResult } from '@/lib/brain/intent'
import type { ThinkResult } from '@/lib/types'

describe('computeIntentHash', () => {
  it('相同结构意图产生相同 hash', () => {
    const h1 = computeIntentHash(['equipment'], 'list', ['status'])
    const h2 = computeIntentHash(['equipment'], 'list', ['status'])
    expect(h1).toBe(h2)
  })

  it('不同意图产生不同 hash', () => {
    const h1 = computeIntentHash(['equipment'], 'list', [])
    const h2 = computeIntentHash(['fault-repair'], 'detail', [])
    expect(h1).not.toBe(h2)
  })

  it('filter 顺序不影响 hash', () => {
    const h1 = computeIntentHash(['equipment'], 'list', ['status', 'keyword'])
    const h2 = computeIntentHash(['equipment'], 'list', ['keyword', 'status'])
    expect(h1).toBe(h2)
  })

  it('返回固定长度字符串', () => {
    const h = computeIntentHash(['equipment'], 'list', [])
    expect(h.length).toBeGreaterThan(0)
    expect(h.length).toBeLessThanOrEqual(16)
  })
})

describe('extractIntentFromThinkResult', () => {
  it('从 ThinkResult 提取 intent + clarity', () => {
    const result: ThinkResult = {
      thought: '测试',
      intent: { domains: ['equipment'], operation: 'list', filters: ['status'], intentHash: '' },
      clarity: 'high',
    }
    const { intent, clarity } = extractIntentFromThinkResult(result)
    expect(intent!.domains).toEqual(['equipment'])
    expect(intent!.intentHash.length).toBe(16)
    expect(clarity).toBe('high')
  })

  it('无 intent 时返回 undefined + high clarity（不惩罚未返回 clarity）', () => {
    const result: ThinkResult = { thought: '测试' }
    const { intent, clarity } = extractIntentFromThinkResult(result)
    expect(intent).toBeUndefined()
    expect(clarity).toBe('high')
  })
})
