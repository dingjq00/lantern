// 路由主编排器 — 9 步流程
// 1.意图提取 2.工具匹配 3.记忆注入 4.Prompt组装 5.LLM路由 6.置信度判断 7.工具执行 8.结果呈现 9.异步日志
import { assemblePrompt } from './prompt-assembler'
import { computeConfidence } from './confidence'
import { detectDisplayFormat, buildStructuredResult } from './result-presenter'
import type { ToolRegistry } from '@/lib/tools/registry'
import type { LLMProvider, StructuredResult, ToolResult } from '@/lib/types'

interface RouterDeps {
  registry: ToolRegistry
  llm: LLMProvider
  callTool: (name: string, args: Record<string, unknown>) => Promise<ToolResult>
  history?: Array<{ role: string; content: string }>
}

/**
 * 核心路由入口 — 9 步编排
 * P0 简化: Step 1 跳过独立意图提取, Step 2 返回全部工具, Step 3 无记忆
 */
export async function processQuery(
  query: string,
  deps: RouterDeps,
): Promise<StructuredResult> {
  const { registry, llm, callTool, history } = deps

  // Step 1: 意图提取 (P0: 跳过，由 LLM 内部理解)
  // Step 2: 工具匹配 (P0: 返回全部工具)
  const allTools = registry.getAllTools()

  // Step 3: 记忆注入 — 将对话历史作为上下文
  const historyContext = history && history.length > 1
    ? history.slice(0, -1).map(m => `${m.role === 'user' ? '用户' : '系统'}: ${m.content}`).join('\n')
    : undefined

  // Step 4: Prompt 动态组装
  const { systemPrompt, userMessage } = assemblePrompt(query, allTools, historyContext)

  // Step 5: LLM 路由
  const routeResult = await llm.route(
    `${systemPrompt}\n\n用户查询: ${userMessage}`,
    allTools,
  )

  // Step 6: 置信度判断
  const confidence = computeConfidence(routeResult.confidenceSignals)

  if (confidence === 'low' || routeResult.calls.length === 0) {
    return buildStructuredResult(
      '请问您想了解哪方面的信息？\n1. 设备运行状况\n2. 维修工单进度\n3. 保养任务执行\n4. 备件库存情况',
      [],
      'text',
      'low',
    )
  }

  // Step 7: 工具执行（按顺序执行所有 calls）
  const toolResults: Array<{ tool: string; result: ToolResult }> = []
  for (const call of routeResult.calls) {
    const result = await registry.execute(call.tool, call.arguments, callTool)
    toolResults.push({ tool: call.tool, result })
  }

  // 合并所有工具结果
  const mergedData = toolResults.map(r => r.result.data)
  const firstData = mergedData[0]
  const formatHint = detectDisplayFormat(mergedData.length === 1 ? firstData : mergedData)

  // Step 8: 结果呈现 — LLM 总结
  const summary = await llm.summarize(
    mergedData.length === 1 ? firstData : mergedData,
    query,
    formatHint,
  )

  // Step 9: 异步日志 (P0: 略，后续加)

  return buildStructuredResult(
    summary.answer,
    mergedData.map(d => (typeof d === 'object' && d !== null ? d : { value: d }) as Record<string, unknown>),
    summary.display || 'text',
    confidence,
    summary.columns,
    summary.followUp,
  )
}
