import { describe, it, expect } from 'vitest'
import { assemblePrompt } from '@/lib/brain/prompt-assembler'
import { loadTools } from '@/lib/tools/yaml-loader'
import path from 'path'
import type { MemoryVerdict } from '@/lib/types'

const tools = loadTools(path.join(__dirname, '../../../tools'))

describe('assemblePrompt', () => {
  it('组装结果包含工具名', () => {
    const { systemPrompt } = assemblePrompt('系统有多少设备？', tools)
    expect(systemPrompt).toContain('query_equipment')
    expect(systemPrompt).toContain('get_dashboard_summary')
  })

  it('组装结果包含工具选择指南', () => {
    const { systemPrompt } = assemblePrompt('测试', tools)
    expect(systemPrompt).toContain('工具选择指南')
    expect(systemPrompt).toContain('简单直查')
  })

  it('组装结果包含 ReAct 指令', () => {
    const { systemPrompt } = assemblePrompt('测试', tools)
    expect(systemPrompt).toContain('ReAct')
    expect(systemPrompt).toContain('thought')
    expect(systemPrompt).toContain('clarity')
  })

  it('组装结果包含 few-shot 示例（ReAct 格式）', () => {
    const { systemPrompt } = assemblePrompt('测试', tools)
    expect(systemPrompt).toContain('A线上月的维修工单')
    expect(systemPrompt).toContain('首轮输出')
  })

  it('组装结果包含当前日期', () => {
    const { systemPrompt } = assemblePrompt('测试', tools)
    expect(systemPrompt).toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('userMessage 就是原始查询', () => {
    const { userMessage } = assemblePrompt('系统有多少设备？', tools)
    expect(userMessage).toBe('系统有多少设备？')
  })

  it('包含记忆上下文（string 兼容 P0）', () => {
    const { systemPrompt } = assemblePrompt('测试', tools, '用户偏好：默认显示20条')
    expect(systemPrompt).toContain('用户偏好：默认显示20条')
  })

  it('包含记忆上下文（options 对象）', () => {
    const { systemPrompt } = assemblePrompt('测试', tools, { memoryContext: '历史对话' })
    expect(systemPrompt).toContain('历史对话')
  })

  it('verdict 推荐路径注入', () => {
    const verdict: MemoryVerdict = {
      intentHash: 'abc', tenantId: 'default',
      toolChain: ['query_equipment', 'get_equipment_detail'],
      avgScore: 4.5, sampleCount: 8, confidence: 'medium', bonusPoints: 25,
      lastUpdated: new Date(), expiresAt: new Date(),
    }
    const { systemPrompt } = assemblePrompt('测试', tools, { verdict })
    expect(systemPrompt).toContain('历史推荐路径')
    expect(systemPrompt).toContain('query_equipment → get_equipment_detail')
    expect(systemPrompt).toContain('4.5')
  })

  it('无 verdict 时不注入推荐路径', () => {
    const { systemPrompt } = assemblePrompt('测试', tools, { verdict: null })
    expect(systemPrompt).not.toContain('历史推荐路径')
  })
})
