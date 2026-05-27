// codex-proxy LLM Provider — 基于 OpenAI SDK
import fs from 'fs'
import path from 'path'
import OpenAI from 'openai'
import { z } from 'zod'
import type { LLMProvider, RouteResult, EvaluateResult, SummarizeResult, ThinkResult, ToolDefinition, ToolCall, DisplayFormat, ConfidenceLevel } from '@/lib/types'

/** 懒加载 summarize prompt — 首次调用时从文件读取，后续复用缓存 */
let summarizePromptText: string | null = null
function getSummarizePrompt(): string {
  if (!summarizePromptText) {
    summarizePromptText = fs.readFileSync(
      path.join(process.cwd(), 'prompts', 'summarize.md'), 'utf-8'
    )
  }
  return summarizePromptText
}

/** 从 LLM 返回中提取纯 JSON — 三层容错：提取 → 控制字符修复 → 截断括号补全 */
function extractJSON(content: string): string {
  let s = content.trim()

  // Layer 1: 去掉 ```json ... ``` 或 ``` ... ``` 包裹
  const fenceMatch = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch) s = fenceMatch[1].trim()

  // 提取 JSON 主体 — 先尝试完整匹配（有闭合括号），再退化到截断匹配
  const jsonMatchComplete = s.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (jsonMatchComplete) {
    s = jsonMatchComplete[1]
  } else {
    const jsonMatchTruncated = s.match(/(\{[\s\S]+|\[[\s\S]+)/)
    if (jsonMatchTruncated) s = jsonMatchTruncated[1]
  }

  // Layer 2: 裸控制字符修复 — JSON string 内不允许真实换行/制表符
  // 只修复 string 值内部的裸控制字符，不影响 JSON 结构字符
  s = s.replace(/"(?:[^"\\]|\\.)*"/g, (match) =>
    match.replace(/[\x00-\x1f]/g, (ch) => {
      const map: Record<number, string> = { 0x08: '\\b', 0x09: '\\t', 0x0a: '\\n', 0x0c: '\\f', 0x0d: '\\r' }
      return map[ch.charCodeAt(0)] || `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`
    })
  )

  // Layer 3: 截断括号补全 — token 限制导致 JSON 被截断时补上缺失的 } ]
  try {
    JSON.parse(s)
    return s  // 已经是合法 JSON，直接返回
  } catch {
    // 扫描结构状态：用栈追踪嵌套顺序 + 检测未闭合字符串
    const scan = (str: string) => {
      const stack: string[] = []
      let inStr = false, esc = false
      for (const ch of str) {
        if (esc) { esc = false; continue }
        if (ch === '\\' && inStr) { esc = true; continue }
        if (ch === '"') { inStr = !inStr; continue }
        if (inStr) continue
        if (ch === '{') stack.push('}')
        else if (ch === '[') stack.push(']')
        else if ((ch === '}' || ch === ']') && stack.length) stack.pop()
      }
      return { stack, inString: inStr }
    }
    // 修复截断残留 — 只在确实未闭合时才动字符串
    const { inString } = scan(s)
    if (inString) s = s.replace(/"[^"]*$/, '""')  // 闭合截断的字符串
    s = s.replace(/,\s*$/, '')             // 尾部悬空逗号
    s = s.replace(/:\s*$/, ': null')       // 悬空冒号补 null
    // 重新扫描并按嵌套顺序补全括号
    const { stack } = scan(s)
    s += stack.reverse().join('')
    return s
  }
}

// ReAct 输出的 zod schema
const ThinkResultSchema = z.object({
  thought: z.string().optional(),
  intent: z.object({
    domains: z.array(z.string()),
    operation: z.string(),
    filters: z.array(z.string()),
  }).optional(),
  clarity: z.enum(['clear', 'ambiguous', 'unsupported']).optional(),
  calls: z.array(z.object({
    tool: z.string(),
    arguments: z.record(z.string(), z.unknown()),
  })).optional(),
  finish: z.boolean().optional(),
  unsupported: z.boolean().optional(),
})

// 延迟读取环境变量 — ESM import hoisting 导致模块顶层常量在 .env.local 加载前就固化
// 改为函数调用，在构造函数/方法中才真正读取
const env = (key: string, fallback = '') => process.env[key] || fallback

function isDeepSeekV4Model(model: string): boolean {
  return /deepseek-v4/i.test(model)
}

/** V4 默认 thinking 会把正文放进 reasoning_content；ReAct 需关闭 thinking 并走 JSON mode */
function deepSeekChatExtras(model: string): Record<string, unknown> {
  if (!isDeepSeekV4Model(model)) return {}
  return { extra_body: { thinking: { type: 'disabled' } } }
}

function isOpenAIReasoningModel(model: string): boolean {
  if (isDeepSeekV4Model(model)) return false
  return /deepseek-reasoner|gpt-5-mini|gpt-5\.0-mini|\/o[13]/i.test(model)
}

export class CodexProxyProvider implements LLMProvider {
  private client: OpenAI
  private summarizeClient: OpenAI | null  // summarize 独立客户端（可选）
  private model: string
  /** 推理模型（GPT-5-mini/o1/o3）不支持 temperature 和 response_format */
  private isReasoningModel: boolean

  constructor(baseURL?: string, apiKey?: string, model?: string) {
    const defaultBaseURL = env('LLM_BASE_URL', 'https://gptapi.tutu02.us.ci/v1')
    const defaultApiKey = env('LLM_API_KEY', 'sk-mes-ai-explorer-2026')
    this.client = new OpenAI({
      baseURL: baseURL || defaultBaseURL,
      apiKey: apiKey || defaultApiKey,
    })
    this.model = model || env('LLM_MODEL', 'gpt-5.4-mini')
    this.isReasoningModel = /gpt-5-mini|gpt-5\.0-mini|\/o[13]/i.test(this.model)
    // summarize 独立客户端（有独立 base URL 时创建）
    const sumBaseURL = env('LLM_SUMMARIZE_BASE_URL')
    const sumApiKey = env('LLM_SUMMARIZE_API_KEY')
    this.summarizeClient = sumBaseURL
      ? new OpenAI({
          baseURL: sumBaseURL,
          apiKey: sumApiKey || (apiKey || defaultApiKey),
        })
      : null
  }

  async route(prompt: string, tools: ToolDefinition[]): Promise<RouteResult> {
    // 构建工具描述（供 LLM 选择）
    const toolDescriptions = tools.map(t =>
      `- ${t.name}: ${t.description}\n  参数: ${JSON.stringify(Object.keys(t.inputSchema.properties))}`
    ).join('\n')

    const systemPrompt = `你是一个 EAM 系统的智能路由器。根据用户的自然语言查询，选择合适的工具并填写参数。

可用工具：
${toolDescriptions}

规则：
1. 返回 JSON 格式：{"calls": [{"tool": "工具名", "arguments": {参数}}]}
2. 允许多步编排，按依赖顺序排列
3. 简单直查用一个工具即可
4. 跨域问题可以组合多个工具
5. 只返回 JSON，不要其他文字`

    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(extractJSON(content)) as { calls?: ToolCall[] }

    return {
      calls: parsed.calls || [],
      confidenceSignals: {
        toolMatch: 'high',
        queryClarity: 'high',
        dataRelevance: 'high',
        verdictConfidence: 'medium',
      },
    }
  }

  async evaluate(question: string, toolChain: string[], resultSummary: string): Promise<EvaluateResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: 'system', content: `评估工具路由结果的质量。返回 JSON: {"relevance": 1-5, "completeness": 1-5, "efficiency": 1-5}` },
        { role: 'user', content: `问题: ${question}\n工具链: ${toolChain.join(' → ')}\n结果摘要: ${resultSummary}` },
      ],
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(extractJSON(content))
    return {
      relevance: parsed.relevance ?? 3,
      completeness: parsed.completeness ?? 3,
      efficiency: parsed.efficiency ?? 3,
    }
  }

  async summarize(data: unknown, question: string, formatHint: DisplayFormat, relatedContext?: string, dataDigest?: string): Promise<SummarizeResult> {
    const sumModel = env('LLM_SUMMARIZE_MODEL')
    const useModel = sumModel || this.model
    const useClient = this.summarizeClient || this.client
    const isReasoning = sumModel
      ? isOpenAIReasoningModel(sumModel)
      : this.isReasoningModel
    // stats 在前（引导引用预计算数字）+ 原始数据跟后（保留完整细节供 AI 分析）
    const dataContent = dataDigest
      ? `预计算统计（有统计的直接引用，未覆盖的请自行分析原始数据）:\n${dataDigest}\n\n原始数据:\n${JSON.stringify(data)}`
      : `数据: ${JSON.stringify(data)}`
    const response = await useClient.chat.completions.create({
      model: useModel,
      ...(!isReasoning && { temperature: 0.3 }),
      max_completion_tokens: isReasoning ? 8192 : 4096,
      messages: [
        { role: 'system', content: `${getSummarizePrompt()}\n数据展示类型参考: ${formatHint}` },
        { role: 'user', content: `问题: ${question}\n${dataContent}${relatedContext ? `\n\n可深挖方向: ${relatedContext}` : ''}` },
      ],
      ...(!isReasoning && { response_format: { type: 'json_object' as const } }),
    })

    const content = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(extractJSON(content))
    return {
      answer: parsed.answer || '查询已完成，请查看下方数据。',
      display: parsed.display || 'text',
      columns: parsed.columns,
      followUp: parsed.followUp,
    }
  }

  async think(messages: Array<{ role: string; content: string }>, modelOverride?: string): Promise<ThinkResult> {
    const useModel = modelOverride || this.model
    const isReasoning = isOpenAIReasoningModel(useModel)
    const response = await this.client.chat.completions.create({
      model: useModel,
      ...(!isReasoning && { temperature: 0 }),
      max_completion_tokens: 4096,
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      ...(!isReasoning && { response_format: { type: 'json_object' as const } }),
      ...deepSeekChatExtras(useModel),
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming)

    const content = response.choices[0]?.message?.content || '{}'
    try {
      const raw = JSON.parse(extractJSON(content))
      const parsed = ThinkResultSchema.parse(raw)
      return {
        thought: parsed.thought || content,  // 无 thought 时保留原始 JSON（供 evaluator 等非 ReAct 调用方解析）
        intent: parsed.intent ? {
          ...parsed.intent,
          intentHash: '',  // 由调用方计算
        } : undefined,
        clarity: mapClarity(parsed.clarity),
        calls: parsed.calls as ToolCall[] | undefined,
        finish: parsed.finish,
        unsupported: parsed.unsupported,
      }
    } catch (err) {
      console.warn('[LLM] think() 解析失败，降级为 finish:', err)
      return { thought: content || '解析失败', finish: true }
    }
  }
}

// clear→high, ambiguous→medium, unsupported→low
function mapClarity(clarity?: string): ConfidenceLevel | undefined {
  if (!clarity) return undefined
  const map: Record<string, ConfidenceLevel> = { clear: 'high', ambiguous: 'medium', unsupported: 'low' }
  return map[clarity] ?? 'medium'
}
