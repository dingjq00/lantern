import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveArgRefs, navigatePath, processQuery } from './router'
import { MockLLM } from './__mocks__/mock-llm'
import { createMockRegistry, makeTool } from '@/lib/tools/__mocks__/mock-registry'
import type { StorageInterface } from '@/lib/storage/types'

describe('resolveArgRefs', () => {
  const results = [
    { items: [{ equipmentId: 'EQ-001', name: '压片机' }] },
    { total: 5 },
  ]

  it('解析 {{0.items[0].equipmentId}}', () => {
    const args = { id: '{{0.items[0].equipmentId}}' }
    expect(resolveArgRefs(args, results)).toEqual({ id: 'EQ-001' })
  })

  it('非引用字符串原样保留', () => {
    expect(resolveArgRefs({ q: 'hello' }, results)).toEqual({ q: 'hello' })
  })

  it('嵌套对象递归解析', () => {
    const args = { filter: { eqId: '{{0.items[0].equipmentId}}' } }
    expect(resolveArgRefs(args, results)).toEqual({ filter: { eqId: 'EQ-001' } })
  })

  it('索引越界时 navigatePath 返回未解析的 path 片段', () => {
    const args = { x: '{{5.foo}}' }
    expect(resolveArgRefs(args, results).x).toBe('5.foo')
  })
})

describe('navigatePath', () => {
  const results = [{ items: [{ equipmentId: 'EQ-001' }] }, null]

  it('简单路径', () => {
    expect(navigatePath('1.total', [{ x: 1 }, { total: 99 }])).toBe(99)
  })

  it('数组下标', () => {
    expect(navigatePath('0.items[0].equipmentId', results)).toBe('EQ-001')
  })

  it('中间值为 null 时返回未解析的 path 片段', () => {
    expect(navigatePath('1.foo', results)).toBe('1.foo')
  })
})

describe('processQuery (ReAct 编排)', () => {
  const noopStorage: StorageInterface = {
    initialize: () => {},
    insertSession: () => {},
    getSessionsByIntentHash: () => [],
    updateSessionFeedback: () => {},
    getVerdict: () => null,
    upsertVerdict: () => {},
    getPreference: () => null,
    setPreference: () => {},
    insertTrace: () => {},
    getTrace: () => null,
    insertLesson: () => {},
    getLessonsByIntentHash: () => [],
    saveBenchmarkRun: () => {},
    getBenchmarkRuns: () => [],
    getBenchmarkRun: () => null,
    close: () => {},
  }

  const tool = makeTool({ name: 'eam.dashboard', domains: ['equipment'], operation: 'dashboard' })
  const registry = createMockRegistry([tool])

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('首轮 calls 成功 → 完成并写入结果', async () => {
    const llm = new MockLLM({
      thinkSequence: [{
        thought: '查仪表盘',
        calls: [{ tool: 'eam.dashboard', arguments: {} }],
        finish: true,
      }],
      summarize: { answer: '共 100 台设备', display: 'text' },
    })
    const result = await processQuery('系统概况', {
      registry,
      llm,
      storage: noopStorage,
      callTool: async () => ({ data: { equipment: { total: 100 } }, status: 'success' }),
    })
    expect(result.answer).toContain('100')
    expect(result.confidence).not.toBe('low')
    expect(result.sources?.[0]?.tool).toBe('eam.dashboard')
  })

  it('首轮无 calls 且升级后仍无 calls → 超纲 low', async () => {
    const llm = new MockLLM({
      thinkSequence: [
        { thought: '不会', unsupported: true },
        { thought: '仍不会', unsupported: true },
      ],
      summarize: { answer: '暂不支持', display: 'text' },
    })
    const result = await processQuery('火星产量', {
      registry,
      llm,
      storage: noopStorage,
      callTool: async () => ({ data: null, status: 'error' }),
    })
    expect(result.confidence).toBe('low')
  })

  it('相同 calls 重复 → 退化循环强制结束', async () => {
    const sameCall = { tool: 'eam.dashboard', arguments: {} }
    const llm = new MockLLM({
      thinkSequence: [
        { thought: 'r1', calls: [sameCall] },
        { thought: 'r2', calls: [sameCall] },
      ],
      summarize: { answer: 'ok', display: 'text' },
    })
    const result = await processQuery('概况', {
      registry,
      llm,
      storage: noopStorage,
      callTool: async () => ({ data: { total: 1 }, status: 'success' }),
    })
    expect(result.answer).toBe('ok')
  })

  it('LLM think 抛错 → 返回繁忙提示', async () => {
    const llm: MockLLM = new MockLLM()
    llm.think = async () => { throw new Error('network') }
    const result = await processQuery('test', {
      registry,
      llm,
      storage: noopStorage,
      callTool: async () => ({ data: {}, status: 'success' }),
    })
    expect(result.answer).toContain('繁忙')
    expect(result.confidence).toBe('low')
  })
})
