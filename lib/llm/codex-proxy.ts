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

/** 从 LLM 返回中提取纯 JSON — 兼容所有模型格式（纯JSON / ```json包裹 / 前后有文字） */
function extractJSON(content: string): string {
  let s = content.trim()
  // 去掉 ```json ... ``` 或 ``` ... ``` 包裹
  const fenceMatch = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch) s = fenceMatch[1].trim()
  // 提取第一个 { ... } 或 [ ... ]
  const jsonMatch = s.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (jsonMatch) return jsonMatch[1]
  return s
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
        verdictConfidence: 'medium',
        queryClarity: 'high',
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
      ? /deepseek-reasoner|gpt-5-mini|gpt-5\.0-mini|\/o[13]/i.test(sumModel)
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
    const isReasoning = modelOverride ? /gpt-5-mini|gpt-5\.0-mini|\/o[13]/i.test(modelOverride) : this.isReasoningModel
    const response = await this.client.chat.completions.create({
      model: useModel,
      ...(!isReasoning && { temperature: 0 }),
      max_completion_tokens: 4096,
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      ...(!isReasoning && { response_format: { type: 'json_object' as const } }),
    })

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
