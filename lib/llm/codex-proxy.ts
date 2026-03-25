// codex-proxy LLM Provider — 基于 OpenAI SDK
import OpenAI from 'openai'
import type { LLMProvider, RouteResult, EvaluateResult, SummarizeResult, ToolDefinition, ToolCall, DisplayFormat } from '@/lib/types'

const DEFAULT_BASE_URL = process.env.LLM_BASE_URL || 'https://gptapi.tutu02.us.ci/v1'
const DEFAULT_API_KEY = process.env.LLM_API_KEY || 'sk-mes-ai-explorer-2026'
const DEFAULT_MODEL = process.env.LLM_MODEL || 'gpt-5.4-mini'

export class CodexProxyProvider implements LLMProvider {
  private client: OpenAI
  private model: string

  constructor(baseURL?: string, apiKey?: string, model?: string) {
    this.client = new OpenAI({
      baseURL: baseURL || DEFAULT_BASE_URL,
      apiKey: apiKey || DEFAULT_API_KEY,
    })
    this.model = model || DEFAULT_MODEL
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
    const parsed = JSON.parse(content) as { calls?: ToolCall[] }

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
    const parsed = JSON.parse(content)
    return {
      relevance: parsed.relevance ?? 3,
      completeness: parsed.completeness ?? 3,
      efficiency: parsed.efficiency ?? 3,
    }
  }

  async summarize(data: unknown, question: string, formatHint: DisplayFormat): Promise<SummarizeResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: `你是数据解读助手。根据查询结果生成简洁的中文回答。
返回 JSON: {"answer": "自然语言回答", "display": "text|table|chart", "columns": ["列名"], "followUp": ["追问建议"]}
数据展示类型参考: ${formatHint}` },
        { role: 'user', content: `问题: ${question}\n数据: ${JSON.stringify(data)}` },
      ],
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)
    return {
      answer: parsed.answer || '暂无数据',
      display: parsed.display || 'text',
      columns: parsed.columns,
      followUp: parsed.followUp,
    }
  }
}
