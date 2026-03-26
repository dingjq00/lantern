import { describe, it, expect } from 'vitest'
import { computeConfidence, computeVerdictConfidence } from '@/lib/brain/confidence'

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

describe('computeVerdictConfidence', () => {
  it('null verdict → low', () => {
    expect(computeVerdictConfidence(null)).toBe('low')
  })

  it('sample < 3 → low', () => {
    expect(computeVerdictConfidence({
      intentHash: 'x', tenantId: 'd', toolChain: [], avgScore: 3,
      sampleCount: 2, confidence: 'low', bonusPoints: 0,
      lastUpdated: new Date(), expiresAt: new Date(),
    })).toBe('low')
  })

  it('sample 3-9 → medium', () => {
    expect(computeVerdictConfidence({
      intentHash: 'x', tenantId: 'd', toolChain: [], avgScore: 4,
      sampleCount: 5, confidence: 'medium', bonusPoints: 25,
      lastUpdated: new Date(), expiresAt: new Date(),
    })).toBe('medium')
  })

  it('sample >= 10 → high', () => {
    expect(computeVerdictConfidence({
      intentHash: 'x', tenantId: 'd', toolChain: [], avgScore: 4.5,
      sampleCount: 15, confidence: 'high', bonusPoints: 50,
      lastUpdated: new Date(), expiresAt: new Date(),
    })).toBe('high')
  })
})
