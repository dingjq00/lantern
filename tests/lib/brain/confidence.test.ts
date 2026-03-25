import { describe, it, expect } from 'vitest'
import { computeConfidence } from '@/lib/brain/confidence'

describe('computeConfidence', () => {
  it('3 个 high → high', () => {
    expect(computeConfidence({
      toolMatch: 'high', verdictConfidence: 'high', queryClarity: 'high'
    })).toBe('high')
  })

  it('任意 1 个 low → low', () => {
    expect(computeConfidence({
      toolMatch: 'high', verdictConfidence: 'low', queryClarity: 'high'
    })).toBe('low')

    expect(computeConfidence({
      toolMatch: 'low', verdictConfidence: 'high', queryClarity: 'high'
    })).toBe('low')
  })

  it('mixed → medium', () => {
    expect(computeConfidence({
      toolMatch: 'high', verdictConfidence: 'medium', queryClarity: 'high'
    })).toBe('medium')

    expect(computeConfidence({
      toolMatch: 'medium', verdictConfidence: 'medium', queryClarity: 'medium'
    })).toBe('medium')
  })
})
