// codex-proxy LLM Provider — 基于 OpenAI SDK
import OpenAI from 'openai'
import { z } from 'zod'
import type { LLMProvider, RouteResult, EvaluateResult, SummarizeResult, ThinkResult, ToolDefinition, ToolCall, DisplayFormat, ConfidenceLevel } from '@/lib/types'

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

const DEFAULT_BASE_URL = process.env.LLM_BASE_URL || 'https://gptapi.tutu02.us.ci/v1'
const DEFAULT_API_KEY = process.env.LLM_API_KEY || 'sk-mes-ai-explorer-2026'
const DEFAULT_MODEL = process.env.LLM_MODEL || 'gpt-5.4-mini'

export class CodexProxyProvider implements LLMProvider {
  private client: OpenAI
  private model: string
  /** 推理模型（GPT-5-mini/o1/o3）不支持 temperature 和 response_format */
  private isReasoningModel: boolean

  constructor(baseURL?: string, apiKey?: string, model?: string) {
    this.client = new OpenAI({
      baseURL: baseURL || DEFAULT_BASE_URL,
      apiKey: apiKey || DEFAULT_API_KEY,
    })
    this.model = model || DEFAULT_MODEL
    this.isReasoningModel = /gpt-5-mini|gpt-5\.0-mini|\/o[13]/i.test(this.model)
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

  async summarize(data: unknown, question: string, formatHint: DisplayFormat, relatedContext?: string): Promise<SummarizeResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      ...(!this.isReasoningModel && { temperature: 0.3 }),
      max_completion_tokens: 4096,
      messages: [
        { role: 'system', content: `你是工厂管理系统的数据解读助手。用管理者听得懂的业务语言回答问题。

核心原则：
1. 不编造 — 只基于数据回答，数字直接引用，不模糊化
2. "没有"也是答案，但不能只说"没有"就停 — 说完"没有"后，挖掘数据中的相关上下文（如：虽然没有保养记录，但有故障记录，建议关注）
3. 业务语言 — 说人话，不说技术术语

回答模式：
- total=0 或 items=[] → "目前没有XX记录" + 从其他数据中挖掘相关信息（如库存状态、关联设备、历史记录等），给出有价值的补充
- 有数据但某字段为空 → "共N条记录，但XX信息尚未录入"
- unsupported 标记 → 基于 aiAnalysis 友好说明为什么暂不支持 + 建议替代方案
- 正常数据 → 先给核心数字，再说关键发现，一两句话
- 多域数据 → 按域分段概括，每域一句

多工具数据融合规则（重要！）：
- 数据来自多个工具时，综合所有工具的结果回答，不要只看其中一个
- 某个工具返回 error 但其他工具有数据 → 以有数据的工具为准，忽略错误的
- 某个工具返回 error 且错误信息含重定向提示 → 说明查询路径调整，基于其他数据回答
- 所有工具都是 error → 才说"未找到"

禁用词（绝对不能出现）：数据不足、无法回答、数据不完整、暂无数据
替代说法：目前没有XX记录、XX信息尚未录入、近期没有XX

followUp（3-5 个后续探索方向，像 Perplexity 的 Related 那样"懂用户下一步想知道什么"）：
- 祈使句，可直接执行（不要问句）
- 优先用数据中的具体数字做诱饵，如"查看该设备的2次故障记录"而不是"查看故障记录"
- 至少1条深挖当前主题，至少1条跨域关联（如：设备→备件，故障→保养）
- 最值得点的排第一位

返回 JSON: {"answer": "自然语言回答", "display": "text|table|chart", "columns": ["列名"], "followUp": ["后续方向1", "后续方向2", "后续方向3"]}
数据展示类型参考: ${formatHint}` },
        { role: 'user', content: `问题: ${question}\n数据: ${JSON.stringify(data)}${relatedContext ? `\n\n可深挖方向: ${relatedContext}` : ''}` },
      ],
      ...(!this.isReasoningModel && { response_format: { type: 'json_object' as const } }),
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
