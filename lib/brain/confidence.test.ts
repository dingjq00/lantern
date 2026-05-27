import { describe, it, expect } from 'vitest'
import { computeConfidence, computeVerdictConfidence } from './confidence'
import { computeDataRelevance, hasActualData } from './relevance-checker'
import type { ConfidenceSignals } from '@/lib/types'

describe('computeConfidence', () => {
  it('三信号均为 high → high', () => {
    const signals: ConfidenceSignals = {
      toolMatch: 'high', queryClarity: 'high', dataRelevance: 'high',
    }
    expect(computeConfidence(signals)).toBe('high')
  })

  it('verdictConfidence 为 medium 不再阻塞 high', () => {
    const signals: ConfidenceSignals = {
      toolMatch: 'high', queryClarity: 'high', dataRelevance: 'high', verdictConfidence: 'medium',
    }
    expect(computeConfidence(signals)).toBe('high')
  })

  it('任意 low → low', () => {
    expect(computeConfidence({
      toolMatch: 'high', queryClarity: 'low', dataRelevance: 'high',
    })).toBe('low')
  })

  it('混合 medium/high → medium', () => {
    expect(computeConfidence({
      toolMatch: 'high', queryClarity: 'medium', dataRelevance: 'high',
    })).toBe('medium')
  })
})

describe('computeVerdictConfidence', () => {
  it('固定 medium', () => {
    expect(computeVerdictConfidence(null)).toBe('medium')
  })
})

describe('computeDataRelevance', () => {
  it('无调用 → low', () => {
    expect(computeDataRelevance({
      totalCallsAttempted: 0,
      successfulResults: [],
      intentDomains: [],
      coveredDomains: [],
    })).toBe('low')
  })

  it('有数据且域全覆盖 → high', () => {
    expect(computeDataRelevance({
      totalCallsAttempted: 1,
      successfulResults: [{ data: { total: 10, items: [{ id: 1 }] } }],
      intentDomains: ['equipment'],
      coveredDomains: ['equipment'],
    })).toBe('high')
  })

  it('有数据但 intent 域未覆盖 → medium', () => {
    expect(computeDataRelevance({
      totalCallsAttempted: 1,
      successfulResults: [{ data: { total: 5, items: [{}] } }],
      intentDomains: ['fault', 'equipment'],
      coveredDomains: ['equipment'],
    })).toBe('medium')
  })

  it('空结果 context 占位 → low', () => {
    expect(computeDataRelevance({
      totalCallsAttempted: 1,
      successfulResults: [{ data: { total: 0, items: [], context: '无记录' } }],
      intentDomains: [],
      coveredDomains: ['equipment'],
    })).toBe('low')
  })
})

describe('hasActualData', () => {
  it('dashboard 嵌套对象视为有数据', () => {
    expect(hasActualData({ equipment: { total: 10 } })).toBe(true)
  })

  it('仅 context 无 items → false', () => {
    expect(hasActualData({ total: 0, items: [], context: '空' })).toBe(false)
  })
})
