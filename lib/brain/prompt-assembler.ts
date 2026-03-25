// Prompt V4 动态组装器
import fs from 'fs'
import path from 'path'
import type { ToolDefinition } from '@/lib/types'

const PROMPTS_DIR = path.join(process.cwd(), 'prompts')

// 懒加载缓存
let baseInstructions: string | null = null
let toolSelectionGuide: string | null = null
let fewShotExamples: Array<{ query: string; reasoning: string; calls: unknown[] }> | null = null

function getBaseInstructions(): string {
  if (!baseInstructions) {
    baseInstructions = fs.readFileSync(path.join(PROMPTS_DIR, 'base-instructions.md'), 'utf-8')
  }
  return baseInstructions
}

function getToolSelectionGuide(): string {
  if (!toolSelectionGuide) {
    toolSelectionGuide = fs.readFileSync(path.join(PROMPTS_DIR, 'tool-selection-guide.md'), 'utf-8')
  }
  return toolSelectionGuide
}

function getFewShotExamples(): typeof fewShotExamples {
  if (!fewShotExamples) {
    fewShotExamples = JSON.parse(
      fs.readFileSync(path.join(PROMPTS_DIR, 'few-shot-examples.json'), 'utf-8')
    )
  }
  return fewShotExamples!
}

/**
 * 组装完整 Prompt V4
 * @returns systemPrompt (给 LLM 的 system message) + userMessage (用户原始查询)
 */
export function assemblePrompt(
  query: string,
  tools: ToolDefinition[],
  memoryContext?: string,
): { systemPrompt: string; userMessage: string } {
  const today = new Date().toISOString().split('T')[0]

  // 1. 基础指令（替换日期占位符）
  const base = getBaseInstructions().replace('{{currentDate}}', today)

  // 2. 动态生成工具描述
  const toolDescriptions = tools.map(t => {
    const params = Object.entries(t.inputSchema.properties)
      .map(([k, v]) => `    - ${k} (${v.type}): ${v.description || ''}`)
      .join('\n')
    return `### ${t.name}\n${t.description}\n  参数:\n${params || '    (无参数)'}`
  }).join('\n\n')

  // 3. 工具选择指南
  const guide = getToolSelectionGuide()

  // 4. Few-shot 示例
  const examples = getFewShotExamples()
  const exampleText = examples.map((ex, i) =>
    `**示例 ${i + 1}**: "${ex.query}"\n思路: ${ex.reasoning}\n\`\`\`json\n${JSON.stringify({ calls: ex.calls }, null, 2)}\n\`\`\``
  ).join('\n\n')

  // 5. 组装
  const sections = [
    base,
    '\n## 可用工具清单\n',
    toolDescriptions,
    '\n',
    guide,
    '\n## 编排示例\n\n',
    exampleText,
  ]

  if (memoryContext) {
    sections.push(`\n\n## 用户上下文\n${memoryContext}`)
  }

  return {
    systemPrompt: sections.join(''),
    userMessage: query,
  }
}
