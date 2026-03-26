import { describe, it, expect } from 'vitest'
import { processQuery } from '@/lib/brain/router'
import { ToolRegistry } from '@/lib/tools/registry'
import { SQLiteStorage } from '@/lib/storage/sqlite'
import { loadTools } from '@/lib/tools/yaml-loader'
import path from 'path'
import type { ToolResult, LLMProvider, ThinkResult, RouteResult, EvaluateResult, SummarizeResult, DisplayFormat, ToolDefinition } from '@/lib/types'

const tools = loadTools(path.join(__dirname, '../../../tools'))
const registry = new ToolRegistry(tools)

// Mock callTool
const mockData: Record<string, unknown> = {
  get_dashboard_summary: { totalEquipment: 128, runningCount: 98, faultCount: 8, pendingOrders: 5 },
  query_equipment: { total: 128, items: [{ equipmentId: 101, name: 'CNC-001', status: 1 }] },
  get_equipment_spare_bom: { items: [{ equipmentName: 'CNC-001', spareName: '轴承', quantity: 2 }] },
  query_fault_reports: { total: 15, items: [{ faultReportId: 301, equipmentName: 'CNC-001' }] },
}

async function mockCallTool(name: string): Promise<ToolResult> {
  return { data: mockData[name] ?? { message: 'mock' }, status: 'success' }
}

// Mock LLM — 控制 think() 返回
function createMockLLM(thinkResponses: ThinkResult[]): LLMProvider {
  let callIndex = 0
  return {
    async think(): Promise<ThinkResult> {
      return thinkResponses[callIndex++] ?? { thought: '结束', finish: true }
    },
    async route(): Promise<RouteResult> { return { calls: [], confidenceSignals: { toolMatch: 'high', verdictConfidence: 'medium', queryClarity: 'high' } } },
    async evaluate(): Promise<EvaluateResult> { return { relevance: 4, completeness: 4, efficiency: 4 } },
    async summarize(data: unknown, question: string): Promise<SummarizeResult> {
      return { answer: `回答: ${question}`, display: 'text', followUp: [] }
    },
  }
}

describe('processQuery ReAct', { timeout: 30_000 }, () => {
  let storage: SQLiteStorage

  // 每个测试用独立内存数据库
  function getStorage(): SQLiteStorage {
    const s = new SQLiteStorage(':memory:')
    s.initialize()
    return s
  }

  it('简单查询 — 一轮 finish', async () => {
    storage = getStorage()
    const llm = createMockLLM([{
      thought: '查系统总览',
      intent: { domains: ['equipment'], operation: 'statistics', filters: [], intentHash: '' },
      clarity: 'high',
      calls: [{ tool: 'get_dashboard_summary', arguments: {} }],
    }, {
      thought: '数据充足',
      finish: true,
    }])

    const result = await processQuery('系统有多少设备？', {
      registry, llm, storage, callTool: mockCallTool,
    })
    expect(result.answer).toBeTruthy()
    expect(result.confidence).toBeDefined()
    expect(result.trace).toBeDefined()
    expect(result.trace!.rounds.length).toBeGreaterThanOrEqual(1)
    storage.close()
  })

  it('复杂查询 — 追查一轮', async () => {
    storage = getStorage()
    const llm = createMockLLM([
      // 首轮
      {
        thought: '先查设备列表',
        intent: { domains: ['equipment', 'spare'], operation: 'detail', filters: [], intentHash: '' },
        clarity: 'high',
        calls: [{ tool: 'query_equipment', arguments: {} }],
      },
      // 观察后追查
      {
        thought: '需要查备件BOM',
        calls: [{ tool: 'get_equipment_spare_bom', arguments: { equipmentId: 101 } }],
      },
      // 完成
      { thought: '信息充足', finish: true },
    ])

    const result = await processQuery('CNC-001的备件清单', {
      registry, llm, storage, callTool: mockCallTool,
    })
    expect(result.answer).toBeTruthy()
    // 首轮 + 追查轮 + finish 轮 = 3 rounds
    expect(result.trace!.rounds.length).toBeGreaterThanOrEqual(2)
    storage.close()
  })

  it('超纲 — 首轮直接返回 unsupported', async () => {
    storage = getStorage()
    const llm = createMockLLM([{
      thought: '该问题超出系统能力范围',
      intent: { domains: [], operation: '', filters: [], intentHash: '' },
      clarity: 'low',
      finish: true,
      unsupported: true,
    }])

    const result = await processQuery('明天会下雨吗？', {
      registry, llm, storage, callTool: mockCallTool,
    })
    expect(result.confidence).toBe('low')
    storage.close()
  })

  it('工具调用失败 — 错误作为 observation 注入', async () => {
    storage = getStorage()
    const failCallTool = async (name: string): Promise<ToolResult> => {
      if (name === 'query_equipment') throw new Error('timeout')
      return { data: mockData[name] ?? {}, status: 'success' }
    }
    const llm = createMockLLM([
      {
        thought: '查设备', intent: { domains: ['equipment'], operation: 'list', filters: [], intentHash: '' },
        clarity: 'high', calls: [{ tool: 'query_equipment', arguments: {} }],
      },
      // 错误后 LLM 选择替代方案
      {
        thought: '设备查询失败，改用总览',
        calls: [{ tool: 'get_dashboard_summary', arguments: {} }],
      },
      { thought: '够了', finish: true },
    ])
    const result = await processQuery('查设备', { registry, llm, storage, callTool: failCallTool })
    expect(result.answer).toBeTruthy()
    // trace 应该记录了失败的调用
    const failedCall = result.trace!.rounds[0].calls.find(c => c.status === 'error')
    expect(failedCall).toBeDefined()
    storage.close()
  })

  it('trace 包含 sources', async () => {
    storage = getStorage()
    const llm = createMockLLM([{
      thought: '查总览',
      intent: { domains: ['equipment'], operation: 'statistics', filters: [], intentHash: '' },
      clarity: 'high',
      calls: [{ tool: 'get_dashboard_summary', arguments: {} }],
    }, {
      thought: '够了',
      finish: true,
    }])

    const result = await processQuery('设备总数', {
      registry, llm, storage, callTool: mockCallTool,
    })
    expect(result.sources).toBeDefined()
    expect(result.sources!.length).toBeGreaterThan(0)
    storage.close()
  })
})
