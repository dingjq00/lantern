import { describe, it, expect } from 'vitest'
import { validateResult } from '@/lib/brain/validator'

describe('validateResult', () => {
  it('检测负数数量', () => {
    const warnings = validateResult({ quantity: -5, name: '轴承' })
    expect(warnings.some(w => w.type === 'numeric_range')).toBe(true)
  })

  it('检测百分率超限', () => {
    const warnings = validateResult({ processRate: 150 })
    expect(warnings.some(w => w.type === 'numeric_range')).toBe(true)
  })

  it('检测零百分率不告警', () => {
    const warnings = validateResult({ processRate: 0 })
    expect(warnings.filter(w => w.type === 'numeric_range')).toHaveLength(0)
  })

  it('检测空结果', () => {
    const warnings = validateResult({ items: [], total: 0 })
    expect(warnings.some(w => w.type === 'empty_result')).toBe(true)
  })

  it('非空结果不告警', () => {
    const warnings = validateResult({ items: [{ id: 1 }], total: 1 })
    expect(warnings.filter(w => w.type === 'empty_result')).toHaveLength(0)
  })

  it('正常数据无警告', () => {
    const warnings = validateResult({ totalEquipment: 128, runningCount: 98 })
    expect(warnings).toHaveLength(0)
  })

  it('嵌套对象也检查', () => {
    const warnings = validateResult({ kpi: { faultRate: -2.5 } })
    expect(warnings.some(w => w.type === 'numeric_range')).toBe(true)
  })
})
