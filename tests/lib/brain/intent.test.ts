import { describe, it, expect } from 'vitest'
import { computeIntentHash } from '@/lib/brain/intent'

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
