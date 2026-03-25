import { describe, it, expect } from 'vitest'
import { assemblePrompt } from '@/lib/brain/prompt-assembler'
import { loadTools } from '@/lib/tools/yaml-loader'
import path from 'path'

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

  it('组装结果包含 few-shot 示例', () => {
    const { systemPrompt } = assemblePrompt('测试', tools)
    expect(systemPrompt).toContain('A线上月的维修工单')
  })

  it('组装结果包含当前日期', () => {
    const { systemPrompt } = assemblePrompt('测试', tools)
    // 应该包含 YYYY-MM-DD 格式的日期
    expect(systemPrompt).toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('userMessage 就是原始查询', () => {
    const { userMessage } = assemblePrompt('系统有多少设备？', tools)
    expect(userMessage).toBe('系统有多少设备？')
  })

  it('包含记忆上下文（如果提供）', () => {
    const { systemPrompt } = assemblePrompt('测试', tools, '用户偏好：默认显示20条')
    expect(systemPrompt).toContain('用户偏好：默认显示20条')
  })
})
