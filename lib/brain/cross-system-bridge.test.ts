import { describe, it, expect } from 'vitest'
import { resolveBridgeHints, formatBridgeHintsForPrompt } from './cross-system-bridge'

describe('resolveBridgeHints', () => {
  it('单系统无候选 → 无桥接', () => {
    expect(resolveBridgeHints(['eam'])).toHaveLength(0)
  })

  it('eam+mes 返回产线与设备-工单桥接（附 recommendedTools）', () => {
    const hints = resolveBridgeHints(['eam', 'mes'])
    expect(hints.length).toBeGreaterThanOrEqual(2)
    const eqOrder = hints.find(h => h.id === 'equipment-order-impact')
    expect(eqOrder?.kind).toBe('inferred')
    expect(eqOrder?.recommendedTools).toEqual(['eam.equipment.search', 'mes.order.search'])
    const line = hints.find(h => h.id === 'line-eam-mes')
    expect(line?.kind).toBe('exact')
    expect(line?.text).toContain('推荐工具')
  })

  it('edhr+mes 含批次关联提示', () => {
    const hints = resolveBridgeHints(['edhr', 'mes'])
    expect(hints.some(h => h.id === 'edhr-mes-batch')).toBe(true)
  })

  it('单系统 + candidateSystems → 提示应跨到的桥', () => {
    // 已调用 eam，问题关键词又指向 mes —— 应返回 eam↔mes 系列桥
    const hints = resolveBridgeHints(['eam'], ['eam', 'mes'])
    expect(hints.length).toBeGreaterThan(0)
    expect(hints.some(h => h.id === 'equipment-order-impact')).toBe(true)
  })
})

describe('formatBridgeHintsForPrompt', () => {
  it('格式化为 summarize 可注入文本', () => {
    const text = formatBridgeHintsForPrompt(resolveBridgeHints(['eam', 'mes']))
    expect(text).toContain('跨系统关联提示')
    expect(text).toContain('建议核查')
    expect(text).toContain('推荐工具')
  })
})
