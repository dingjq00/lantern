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

  it('summarize() — 返回自然语言回答', async () => {
    const data = { totalEquipment: 128, runningCount: 98 }
    const result = await provider.summarize(data, '系统里有多少台设备？', 'single_value')
    expect(result.answer).toBeTruthy()
    expect(result.answer).toContain('128')
  })
})
