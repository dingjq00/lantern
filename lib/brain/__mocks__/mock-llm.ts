// 测试用 LLMProvider — 脚本化 think / summarize 响应
import type { LLMProvider, ThinkResult, SummarizeResult, ToolDefinition, RouteResult, EvaluateResult, DisplayFormat } from '@/lib/types'

export interface MockLLMOptions {
  /** 按调用顺序返回的 think 结果；不足时重复最后一项 */
  thinkSequence?: ThinkResult[]
  summarize?: SummarizeResult
  route?: RouteResult
  evaluate?: EvaluateResult
}

export class MockLLM implements LLMProvider {
  private thinkIndex = 0

  constructor(private options: MockLLMOptions = {}) {}

  async think(): Promise<ThinkResult> {
    const seq = this.options.thinkSequence ?? [{ thought: 'mock', finish: true }]
    const result = seq[Math.min(this.thinkIndex, seq.length - 1)]
    this.thinkIndex++
    return structuredClone(result)
  }

  async summarize(
    _data: unknown,
    _question: string,
    _formatHint: DisplayFormat,
  ): Promise<SummarizeResult> {
    return this.options.summarize ?? { answer: 'mock summary', display: 'text' }
  }

  async route(): Promise<RouteResult> {
    return this.options.route ?? {
      calls: [],
      confidenceSignals: { toolMatch: 'medium', queryClarity: 'high', dataRelevance: 'medium' },
    }
  }

  async evaluate(): Promise<EvaluateResult> {
    return this.options.evaluate ?? { relevance: 5, completeness: 5, efficiency: 5 }
  }

  reset(): void {
    this.thinkIndex = 0
  }
}
