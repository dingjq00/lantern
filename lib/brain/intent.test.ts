import { describe, it, expect } from 'vitest'
import { computeIntentHash, extractIntentFromThinkResult } from './intent'

describe('computeIntentHash', () => {
  it('相同输入产生相同 hash', () => {
    const a = computeIntentHash(['fault', 'equipment'], 'search', ['status'])
    const b = computeIntentHash(['equipment', 'fault'], 'search', ['status'])
    expect(a).toBe(b)
    expect(a).toHaveLength(16)
  })

  it('不同 operation 产生不同 hash', () => {
    const a = computeIntentHash(['fault'], 'search', [])
    const b = computeIntentHash(['fault'], 'dashboard', [])
    expect(a).not.toBe(b)
  })
})

describe('extractIntentFromThinkResult', () => {
  it('无 intent 时 clarity 默认 high', () => {
    const { intent, clarity } = extractIntentFromThinkResult({ thought: 'x' })
    expect(intent).toBeUndefined()
    expect(clarity).toBe('high')
  })

  it('有 intent 时附加 intentHash', () => {
    const { intent, clarity } = extractIntentFromThinkResult({
      thought: 'x',
      intent: { domains: ['fault'], operation: 'search', filters: [] },
      clarity: 'medium',
    })
    expect(intent?.intentHash).toHaveLength(16)
    expect(intent?.domains).toEqual(['fault'])
    expect(clarity).toBe('medium')
  })
})
