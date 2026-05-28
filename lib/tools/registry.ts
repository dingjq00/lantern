// 工具注册表 — 加载、匹配、执行
import type { ToolDefinition, IntentTags, RankedTool, ToolResult } from '@/lib/types'
import { isSystemActive } from '@/lib/systems'

export class ToolRegistry {
  private tools: Map<string, ToolDefinition>

  constructor(tools: ToolDefinition[]) {
    // 按 ENABLED_SYSTEMS 过滤 — 禁用系统的工具不暴露给 LLM
    // 没设 system 字段的工具（如跨系统 glossary）一律保留
    const filtered = tools.filter(t => !t.system || isSystemActive(t.system))
    this.tools = new Map(filtered.map(t => [t.name, t]))
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  /**
   * 匹配意图 → 排序后的工具列表
   * matchScore = domain(40) + operation(30) + filter(20×比例) + chain(10)
   * P0: 不做阈值过滤，返回全部工具（LLM 负责选择）
   */
  match(intent: IntentTags): RankedTool[] {
    const ranked: RankedTool[] = []

    for (const tool of this.tools.values()) {
      const score = calcMatchScore(tool, intent)
      ranked.push({
        name: tool.name,
        matchScore: score,
        quality: tool.quality,
        inputSchema: tool.inputSchema,
      })
    }

    // matchScore desc
    ranked.sort((a, b) => b.matchScore - a.matchScore)
    return ranked
  }

  /**
   * 执行工具调用
   * P0: callTool 由外部注入（MCPClient 或 mock）
   */
  async execute(
    toolName: string,
    args: Record<string, unknown>,
    callTool: (name: string, args: Record<string, unknown>) => Promise<ToolResult>,
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName)
    if (!tool) {
      return { data: null, status: 'error', errorLevel: 4 }
    }
    return callTool(toolName, args)
  }
}

/** matchScore 计算 — spec Section 4.2 */
function calcMatchScore(tool: ToolDefinition, intent: IntentTags): number {
  let score = 0

  // domain 匹配 (40)
  const domainOverlap = intent.domains.some(d => tool.domains.includes(d))
  if (domainOverlap) score += 40

  // operation 匹配 (30)
  if (tool.operation === intent.operation) score += 30

  // filter 覆盖 (20 × 比例)
  if (intent.filters.length > 0) {
    const covered = intent.filters.filter(f => tool.supportsFilters.includes(f)).length
    score += Math.round(20 * (covered / intent.filters.length))
  }

  // chain 价值 (10) — 有 feedsInto 或 dependsOn 说明是链路节点
  if (tool.feedsInto.length > 0 || tool.dependsOn.length > 0) {
    score += 10
  }

  return score
}
