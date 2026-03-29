// Prompt 动态组装器 — P1: 支持 ReAct 格式 + verdict 注入
import fs from 'fs'
import path from 'path'
import type { ToolDefinition, MemoryVerdict } from '@/lib/types'

const PROMPTS_DIR = path.join(process.cwd(), 'prompts')

// 懒加载缓存（六层架构）
let systemPromptText: string | null = null
let rulesText: string | null = null
let baseInstructions: string | null = null
let reactInstructions: string | null = null
let toolSelectionGuide: string | null = null
let fewShotExamples: unknown[] | null = null

function loadFile(name: string): string {
  return fs.readFileSync(path.join(PROMPTS_DIR, name), 'utf-8')
}

function getSystemPromptText(): string {
  if (!systemPromptText) systemPromptText = loadFile(`system-prompt.md`)
  return systemPromptText
}

function getRules(): string {
  if (!rulesText) rulesText = loadFile(`rules.md`)
  return rulesText
}

function getBaseInstructions(): string {
  if (!baseInstructions) baseInstructions = loadFile(`base-instructions.md`)
  return baseInstructions
}

function getReactInstructions(): string {
  if (!reactInstructions) reactInstructions = loadFile(`react-instructions.md`)
  return reactInstructions
}

function getToolSelectionGuide(): string {
  if (!toolSelectionGuide) toolSelectionGuide = loadFile(`tool-selection-guide.md`)
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

  // ============ 六层架构：静态在前（可缓存），动态在后 ============

  // Layer 1: System Prompt — 你是谁（永不变）
  const sysPrompt = getSystemPromptText()
  // Layer 2: Rules — 底线约束（永不变，attention 权重高）
  const rules = getRules()
  // Layer 3: Task Instructions — 这类任务怎么做（按场景可换）
  const base = getBaseInstructions()
  const react = getReactInstructions()
  const guide = getToolSelectionGuide()
  // Layer 4: Examples — 示例（偶尔变）
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

  // 工具描述（按系统分组）— 帮助 AI 区分同名工具属于哪个系统
  const SYSTEM_LABELS: Record<string, string> = {
    eam: 'EAM（设备资产管理）',
    edhr: 'EDHR（医疗器械检测流程管理）',
  }

  function formatTool(t: ToolDefinition): string {
    const params = Object.entries(t.inputSchema.properties)
      .map(([k, v]) => `  - ${k} (${v.type}): ${v.description || ''}`)
      .join('\n')
    const whenUse = t.whenToUse ? `  适用: ${Array.isArray(t.whenToUse) ? t.whenToUse.join('; ') : String(t.whenToUse).trim()}` : ''
    const whenNot = t.whenNotToUse ? `  不适用: ${Array.isArray(t.whenNotToUse) ? t.whenNotToUse.join('; ') : String(t.whenNotToUse).trim()}` : ''
    return `- **${t.name}** [${t.operation}]: ${t.description}\n${params || '  (无参数)'}${whenUse ? '\n' + whenUse : ''}${whenNot ? '\n' + whenNot : ''}`
  }

  // 按 system 分组
  const toolsBySystem = new Map<string, ToolDefinition[]>()
  for (const t of tools) {
    const sys = t.system || 'default'
    if (!toolsBySystem.has(sys)) toolsBySystem.set(sys, [])
    toolsBySystem.get(sys)!.push(t)
  }

  const toolDescriptions = [...toolsBySystem.entries()].map(([sys, sysTools]) => {
    const label = SYSTEM_LABELS[sys] || sys.toUpperCase()
    const toolsText = sysTools.map(formatTool).join('\n\n')
    return `### ${label}\n\n${toolsText}`
  }).join('\n\n')

  // ============ 组装：六层顺序 ============
  const sections = [
    // Layer 1: System Prompt（你是谁）
    sysPrompt,
    // Layer 2: Rules（底线，最靠前，attention 权重最高）
    rules,
    // Layer 3: Task Instructions（怎么做）
    base, '\n', react, '\n\n', guide,
    // Layer 4: Examples（偶尔变）
    '\n\n## 编排示例\n\n', exampleText,
    // ——— 缓存边界 ———
    '\n\n---\n',
    // Layer 5: Dynamic Context（每次变）
    `\n## 当前环境\n系统: ${systems.join(', ').toUpperCase()} | 数据域: ${domains.join(', ')} | 工具数: ${tools.length} | 日期: ${today}\n`,
    '\n## 可用工具\n\n', toolDescriptions,
  ]
  // Layer 6: User Input → 在 userMessage 里，不在 system prompt 里

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
