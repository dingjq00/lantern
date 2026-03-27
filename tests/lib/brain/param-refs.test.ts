import { describe, it, expect } from 'vitest'
import { resolveArgRefs, navigatePath } from '@/lib/brain/router'

// 模拟两轮工具调用的结果
const mockResults = [
  // call 0: query_equipment 返回
  { items: [{ equipmentId: 'EQ-001', name: 'A线压缩机' }, { equipmentId: 'EQ-002', name: 'B线泵' }], total: 2 },
  // call 1: query_fault_reports 返回
  { data: { equipment: { name: 'A线压缩机', status: '运行中' }, faultCount: 5 } },
]

describe('navigatePath', () => {
  it('简单路径 — 取顶层字段', () => {
    expect(navigatePath('0.total', mockResults)).toBe(2)
  })

  it('嵌套路径 — 多层对象', () => {
    expect(navigatePath('1.data.equipment.name', mockResults)).toBe('A线压缩机')
  })

  it('数组下标 — items[0].equipmentId', () => {
    expect(navigatePath('0.items[0].equipmentId', mockResults)).toBe('EQ-001')
  })

  it('数组下标 — items[1]', () => {
    expect(navigatePath('0.items[1].name', mockResults)).toBe('B线泵')
  })

  it('引用不存在的 call index → 返回原始引用', () => {
    expect(navigatePath('5.items', mockResults)).toBe('5.items')
  })

  it('路径中间遇到 null → 返回原始引用', () => {
    const results = [{ a: null }]
    expect(navigatePath('0.a.b.c', results)).toBe('0.a.b.c')
  })

  it('路径指向 undefined 字段 → 返回原始引用', () => {
    expect(navigatePath('0.nonExistent.deep', mockResults)).toBe('0.nonExistent.deep')
  })

  it('只有 call index 无子路径 → 返回整个结果', () => {
    expect(navigatePath('0', mockResults)).toEqual(mockResults[0])
  })
})

describe('resolveArgRefs', () => {
  it('解析 {{0.path}} 引用', () => {
    const args = { equipmentId: '{{0.items[0].equipmentId}}' }
    const resolved = resolveArgRefs(args, mockResults)
    expect(resolved.equipmentId).toBe('EQ-001')
  })

  it('非引用字符串原样保留', () => {
    const args = { status: '运行中', limit: 10 }
    const resolved = resolveArgRefs(args, mockResults)
    expect(resolved).toEqual({ status: '运行中', limit: 10 })
  })

  it('嵌套对象递归解析', () => {
    const args = { filter: { id: '{{0.items[1].equipmentId}}', type: 'pump' } }
    const resolved = resolveArgRefs(args, mockResults)
    expect(resolved).toEqual({ filter: { id: 'EQ-002', type: 'pump' } })
  })

  it('多个引用同时解析', () => {
    const args = {
      equipmentId: '{{0.items[0].equipmentId}}',
      faultCount: '{{1.data.faultCount}}',
      plain: 'hello',
    }
    const resolved = resolveArgRefs(args, mockResults)
    expect(resolved.equipmentId).toBe('EQ-001')
    expect(resolved.faultCount).toBe(5)
    expect(resolved.plain).toBe('hello')
  })

  it('引用解析失败 → 返回原始 {{}} 字符串', () => {
    const args = { id: '{{9.missing.path}}' }
    const resolved = resolveArgRefs(args, mockResults)
    expect(resolved.id).toBe('9.missing.path')
  })

  it('数组值原样保留（不递归）', () => {
    const args = { ids: ['EQ-001', 'EQ-002'] }
    const resolved = resolveArgRefs(args, mockResults)
    expect(resolved.ids).toEqual(['EQ-001', 'EQ-002'])
  })
})
