import { describe, it, expect } from 'vitest'
import { loadYamlToolNames, loadMcpHandlerNames, diffMcpContract } from './mcp-contract'

describe('MCP 契约', () => {
  it('YAML 与 handler 各应有 30 个工具', () => {
    const yaml = loadYamlToolNames()
    const handlers = loadMcpHandlerNames()
    expect(yaml.length).toBe(30)
    expect(handlers.length).toBe(30)
  })

  it('YAML name 与 MCP handler 注册名完全一致', () => {
    const { yamlOnly, handlerOnly } = diffMcpContract()
    expect(yamlOnly, `仅 YAML: ${yamlOnly.join(', ')}`).toEqual([])
    expect(handlerOnly, `仅 handler: ${handlerOnly.join(', ')}`).toEqual([])
  })
})
