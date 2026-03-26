// Prompt 动态组装器 — P1: 支持 ReAct 格式 + verdict 注入
import fs from 'fs'
import path from 'path'
import type { ToolDefinition, MemoryVerdict } from '@/lib/types'

const PROMPTS_DIR = path.join(process.cwd(), 'prompts')

// 懒加载缓存
let baseInstructions: string | null = null
let reactInstructions: string | null = null
let toolSelectionGuide: string | null = null
let fewShotExamples: unknown[] | null = null

function loadFile(name: string): string {
  return fs.readFileSync(path.join(PROMPTS_DIR, name), 'utf-8')
}

function getBaseInstructions(): string {
  if (!baseInstructions) baseInstructions = loadFile('base-instructions.md')
  return baseInstructions
}

function getReactInstructions(): string {
  if (!reactInstructions) reactInstructions = loadFile('react-instructions.md')
  return reactInstructions
}

function getToolSelectionGuide(): string {
  if (!toolSelectionGuide) toolSelectionGuide = loadFile('tool-selection-guide.md')
  return toolSelectionGuide
}

function getFewShotExamples(): unknown[] {
  if (!fewShotExamples) fewShotExamples = JSON.parse(loadFile('few-shot-examples.json'))
  return fewShotExamples!
}

export interface AssembleOptions {
  memoryContext?: string
  verdict?: MemoryVerdict | null
}

/**
 * 组装完整 Prompt（P1: ReAct 格式）
 */
export function assemblePrompt(
  query: string,
  tools: ToolDefinition[],
  memoryContextOrOptions?: string | AssembleOptions,
): { systemPrompt: string; userMessage: string } {
  // 兼容 P0 签名（第三参数是 string）和 P1 签名（第三参数是 options）
  const options: AssembleOptions = typeof memoryContextOrOptions === 'string'
    ? { memoryContext: memoryContextOrOptions }
    : memoryContextOrOptions ?? {}

  // ============ 静态层（不变，可缓存）============
  // 放在 system message 开头，attention 权重最高，缓存命中率最大化

  // 角色 + 核心规则
  const base = getBaseInstructions()  // 不再嵌入 {{currentDate}}，日期移到动态层
  // 行为模式
  const react = getReactInstructions()
  // 选择方法论
  const guide = getToolSelectionGuide()
  // Few-shot 示例
  const examples = getFewShotExamples()
  const exampleText = examples.map((ex: any, i: number) => {
    const lines = [`**示例 ${i + 1}**: "${ex.query}"`]
    if (ex.note) lines.push(`说明: ${ex.note}`)
    lines.push(`首轮输出:\n\`\`\`json\n${JSON.stringify(ex.round0, null, 2)}\n\`\`\``)
    if (ex.observation0) lines.push(`观察: ${ex.observation0}`)
    if (ex.round1) lines.push(`追查轮输出:\n\`\`\`json\n${JSON.stringify(ex.round1, null, 2)}\n\`\`\``)
    return lines.join('\n')
  }).join('\n\n')

  // ============ 动态层（每次变，不缓存）============
  // 放在 system message 后半段

  const today = new Date().toISOString().split('T')[0]
  const systems = [...new Set(tools.map(t => t.system))]
  const domains = [...new Set(tools.flatMap(t => t.domains))]

  // 工具描述（项目工具变化时才变）
  const toolDescriptions = tools.map(t => {
    const params = Object.entries(t.inputSchema.properties)
      .map(([k, v]) => `  - ${k} (${v.type}): ${v.description || ''}`)
      .join('\n')
    return `- **${t.name}**: ${t.description}\n${params || '  (无参数)'}`
  }).join('\n')

  // ============ 组装：静态在前，动态在后 ============
  const sections = [
    // --- 静态（可缓存）---
    base,
    '\n',
    react,
    '\n\n',
    guide,
    '\n\n## 编排示例\n\n',
    exampleText,
    // --- 缓存边界 ---
    '\n\n---\n',
    // --- 动态（每次变）---
    `\n## 当前环境\n系统: ${systems.join(', ').toUpperCase()} | 数据域: ${domains.join(', ')} | 工具数: ${tools.length} | 日期: ${today}\n`,
    '\n## 可用工具\n\n',
    toolDescriptions,
  ]

  // 动态注入（verdict、用户上下文）
  if (options.verdict && options.verdict.toolChain.length > 0) {
    sections.push(`\n\n## 历史推荐路径\n${options.verdict.toolChain.join(' → ')}（评分 ${options.verdict.avgScore.toFixed(1)}，${options.verdict.sampleCount} 次样本）`)
  }

  if (options.memoryContext) {
    sections.push(`\n\n## 用户上下文\n${options.memoryContext}`)
  }

  return {
    systemPrompt: sections.join(''),
    userMessage: query,
  }
}
