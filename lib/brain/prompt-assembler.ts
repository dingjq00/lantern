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

  const today = new Date().toISOString().split('T')[0]

  // 1. 基础指令 + ReAct 指令
  const base = getBaseInstructions().replace('{{currentDate}}', today)
  const react = getReactInstructions()

  // 2. 工具索引（精简，帮 AI 快速定位域和工具）
  const domainGroups = new Map<string, typeof tools>()
  for (const t of tools) {
    for (const d of t.domains) {
      if (!domainGroups.has(d)) domainGroups.set(d, [])
      domainGroups.get(d)!.push(t)
    }
  }
  const toolIndex = [...domainGroups.entries()].map(([domain, domainTools]) => {
    const unique = [...new Map(domainTools.map(t => [t.name, t])).values()]
    const lines = unique.map(t => `  - ${t.name} (${t.operation}): ${t.description.split('。')[0]}`)
    return `**${domain}**\n${lines.join('\n')}`
  }).join('\n')

  // 3. 工具详细描述（参数 + 适用场景 + 衔接关系）
  const toolDescriptions = tools.map(t => {
    const params = Object.entries(t.inputSchema.properties)
      .map(([k, v]) => `    - ${k} (${v.type}): ${v.description || ''}`)
      .join('\n')
    const lines = [`### ${t.name}`, `  ${t.whenToUse}`]
    lines.push(`  参数:\n${params || '    (无参数)'}`)
    if (t.feedsInto.length > 0) lines.push(`  → 可衔接: ${t.feedsInto.join(', ')}`)
    if (t.whenNotToUse) lines.push(`  ✗ ${t.whenNotToUse}`)
    return lines.join('\n')
  }).join('\n\n')

  // 3. 工具选择指南
  const guide = getToolSelectionGuide()

  // 4. Few-shot 示例（ReAct 格式）
  const examples = getFewShotExamples()
  const exampleText = examples.map((ex: any, i: number) => {
    const lines = [`**示例 ${i + 1}**: "${ex.query}"`]
    if (ex.note) lines.push(`说明: ${ex.note}`)
    lines.push(`首轮输出:\n\`\`\`json\n${JSON.stringify(ex.round0, null, 2)}\n\`\`\``)
    if (ex.observation0) lines.push(`观察: ${ex.observation0}`)
    if (ex.round1) lines.push(`追查轮输出:\n\`\`\`json\n${JSON.stringify(ex.round1, null, 2)}\n\`\`\``)
    return lines.join('\n')
  }).join('\n\n')

  // 5. 系统上下文（从工具声明推断）
  const systems = [...new Set(tools.map(t => t.system))]
  const domains = [...new Set(tools.flatMap(t => t.domains))]
  const systemContext = `\n## 当前系统\n系统: ${systems.join(', ').toUpperCase()} | 数据域: ${domains.join(', ')} | 工具数: ${tools.length}\n`

  // 6. 组装（索引在前帮助快速定位，详细描述在后供精确匹配）
  const sections = [
    base,
    systemContext,
    react,
    '\n## 工具索引（按域分类，先看这里定位）\n\n',
    toolIndex,
    '\n\n## 工具详细说明\n\n',
    toolDescriptions,
    '\n\n',
    guide,
    '\n\n## 编排示例\n\n',
    exampleText,
  ]

  // verdict 推荐路径注入
  if (options.verdict && options.verdict.toolChain.length > 0) {
    sections.push(`\n\n## 历史推荐路径\n以下工具链在过去类似查询中表现较好（仅供参考，可自行调整）：\n${options.verdict.toolChain.join(' → ')}（评分 ${options.verdict.avgScore.toFixed(1)}，${options.verdict.sampleCount} 次样本）`)
  }

  if (options.memoryContext) {
    sections.push(`\n\n## 用户上下文\n${options.memoryContext}`)
  }

  return {
    systemPrompt: sections.join(''),
    userMessage: query,
  }
}
