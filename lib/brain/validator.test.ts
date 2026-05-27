import { describe, it, expect } from 'vitest'
import { validateResult } from './validator'

describe('validateResult', () => {
  it('空 items 数组 → empty_result warning', () => {
    const r = validateResult({ total: 0, items: [] })
    expect(r.some(v => v.type === 'empty_result')).toBe(true)
  })

  it('百分率越界', () => {
    const r = validateResult({ completionRate: 150 })
    expect(r.some(v => v.type === 'numeric_range' && v.field === 'completionRate')).toBe(true)
  })

  it('负数量', () => {
    const r = validateResult({ totalCount: -1 })
    expect(r.some(v => v.message.includes('不应为负数'))).toBe(true)
  })

  it('嵌套对象递归检查', () => {
    const r = validateResult({ kpi: { faultRate: 120 } })
    expect(r.some(v => v.field === 'faultRate')).toBe(true)
  })

  it('null/undefined 无校验', () => {
    expect(validateResult(null)).toHaveLength(0)
    expect(validateResult(undefined)).toHaveLength(0)
  })
})
