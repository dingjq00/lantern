import { describe, it, expect } from 'vitest'
import { detectDisplayFormat, buildStructuredResult } from '@/lib/brain/result-presenter'

describe('detectDisplayFormat', () => {
  it('单值数据 → single_value', () => {
    expect(detectDisplayFormat({ total: 128 })).toBe('single_value')
  })

  it('列表数据 → list', () => {
    expect(detectDisplayFormat({ items: [{ id: 1 }, { id: 2 }] })).toBe('list')
  })

  it('含 trend/date 的数据 → timeseries', () => {
    expect(detectDisplayFormat({ trend: [{ date: '2026-01', count: 5 }] })).toBe('timeseries')
  })

  it('多步结果数组 → multi_step', () => {
    expect(detectDisplayFormat([{ data: 'a' }, { data: 'b' }])).toBe('multi_step')
  })
})

describe('buildStructuredResult', () => {
  it('输出包含必要字段', () => {
    const result = buildStructuredResult(
      '系统共有 128 台设备',
      [{ total: 128 }],
      'text',
      'high',
    )
    expect(result.answer).toBe('系统共有 128 台设备')
    expect(result.confidence).toBe('high')
    expect(result.display).toBe('text')
    expect(result.data).toEqual([{ total: 128 }])
  })
})
