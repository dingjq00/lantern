// 层 2: 隔离 subagent 评估 — 独立上下文，只看问题+数据
// generator + evaluator 架构，消除自评偏见

import type { LLMProvider } from '@/lib/types'

export interface SubagentEvalResult {
  layer: 'subagent'
  quality: 'good' | 'partial' | 'bad'
  reason: string
  missing: string[]
  lesson: string
}

const EVALUATOR_PROMPT = `你是结果质量评估员。你不知道 AI 是怎么选工具的，也不需要知道。
你只需要判断：给定的数据能回答用户的问题吗？

规则：
- 只看数据和问题，不要猜测或推理
- 如果数据字段和问题主题明显不匹配，判 bad
- 如果数据有部分相关但不够完整，判 partial
- 如果数据足以回答问题，判 good

返回严格 JSON（不要其他文字）:
{"quality":"good或partial或bad","reason":"一句话原因","missing":["缺失的信息"],"lesson":"一句话教训：选了X不对因为Y"}`

/**
 * 用隔离的 LLM 调用评估结果质量
 * 注意：这是独立的评估 prompt，和路由 prompt 完全不同
 */
export async function evaluateWithSubagent(
  llm: LLMProvider,
  query: string,
  dataFieldsSummary: string,
  dataSample: string,
): Promise<SubagentEvalResult> {
  try {
    // 用 think() 但传入完全不同的 prompt（隔离上下文）
    const result = await llm.think([
      { role: 'system', content: EVALUATOR_PROMPT },
      { role: 'user', content: `用户问题: "${query}"\n\n返回数据字段: ${dataFieldsSummary}\n\n数据样本（前200字符）: ${dataSample.slice(0, 200)}` },
    ])

    const parsed = JSON.parse(result.thought)
    return {
      layer: 'subagent',
      quality: parsed.quality ?? 'partial',
      reason: parsed.reason ?? '',
      missing: parsed.missing ?? [],
      lesson: parsed.lesson ?? '',
    }
  } catch {
    // 解析失败不影响主流程
    return {
      layer: 'subagent',
      quality: 'partial',
      reason: '评估解析失败',
      missing: [],
      lesson: '',
    }
  }
}
