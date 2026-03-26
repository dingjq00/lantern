import { describe, it, expect } from 'vitest'
import { CodexProxyProvider } from '@/lib/llm/codex-proxy'
import { loadTools } from '@/lib/tools/yaml-loader'
import path from 'path'

// 需要网络访问 codex-proxy，timeout 较长
describe('CodexProxyProvider', { timeout: 30_000 }, () => {
  const provider = new CodexProxyProvider()
  const tools = loadTools(path.join(__dirname, '../../../tools'))

  it('route() — 简单查询返回合法 calls', async () => {
    const result = await provider.route('系统里有多少台设备？', tools)
    expect(result.calls.length).toBeGreaterThan(0)
    // 应该选择 get_dashboard_summary 或 query_equipment
    const toolNames = result.calls.map(c => c.tool)
    const validTools = ['get_dashboard_summary', 'query_equipment', 'get_equipment_status_distribution']
    expect(toolNames.some(n => validTools.includes(n))).toBe(true)
  })

  it('route() — 每个 call 有 tool 和 arguments', async () => {
    const result = await provider.route('A线上月有哪些维修工单？', tools)
    for (const call of result.calls) {
      expect(call.tool).toBeTruthy()
      expect(call.arguments).toBeDefined()
    }
  })

  it('think() — 首轮返回 intent + clarity + calls', async () => {
    const reactPrompt = `你是 EAM 系统 AI 助手。采用 ReAct 推理模式。
返回严格 JSON，第一轮必须包含 thought/intent/clarity/calls：
{"thought":"推理","intent":{"domains":["xxx"],"operation":"xxx","filters":[]},"clarity":"clear","calls":[{"tool":"xxx","arguments":{}}]}
可用工具：get_dashboard_summary（系统总览统计）、query_equipment（设备列表查询）`
    const result = await provider.think([
      { role: 'system', content: reactPrompt },
      { role: 'user', content: '系统里有多少台设备？' },
    ])
    expect(result.thought).toBeTruthy()
    // 首轮应该有 intent 和 clarity
    expect(result.intent).toBeDefined()
    expect(result.clarity).toBeDefined()
    // 应该有 calls 或 finish
    expect(result.calls || result.finish).toBeTruthy()
  })

  it('think() — 解析失败返回 finish with error', async () => {
    // 用极短的 prompt 可能导致格式异常，但 zod 校验应该兜住
    const result = await provider.think([
      { role: 'system', content: '返回 JSON: {"thought": "test", "finish": true}' },
      { role: 'user', content: 'test' },
    ])
    // 即使 LLM 返回不完美，think() 也不应该抛异常
    expect(result.thought).toBeDefined()
  })

  it('summarize() — 返回自然语言回答', async () => {
    const data = { totalEquipment: 128, runningCount: 98 }
    const result = await provider.summarize(data, '系统里有多少台设备？', 'single_value')
    expect(result.answer).toBeTruthy()
    expect(result.answer).toContain('128')
  })
})
