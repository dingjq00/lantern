// Insight68 NL-API Platform — 全局类型定义
// 来源：docs/specs/platform-design.md Section 2.3 / 4.1 / 5.2

// ============================================================
// 接入层 — BrainService 入口和出口
// ============================================================

/** BrainService.process() 的入参 */
export interface BrainRequest {
  userId: string
  query: string
  sessionId: string
  context?: {
    preferences: Record<string, unknown>
    history: MemorySession[]
  }
}

/** 最终返回给前端的结构化结果 */
export interface StructuredResult {
  answer: string
  data: Record<string, unknown>[]
  display: 'text' | 'table' | 'chart'
  columns?: string[]
  followUp?: string[]
  confidence: ConfidenceLevel
}

export type ConfidenceLevel = 'high' | 'medium' | 'low'

// ============================================================
// 智能层 — 意图、路由、置信度
// ============================================================

/** 意图提取结果 */
export interface IntentTags {
  domains: string[]
  operation: string
  filters: string[]
  target?: string
  intentHash: string
}

/** LLM 路由返回的单次工具调用 */
export interface ToolCall {
  tool: string
  arguments: Record<string, unknown>
}

/** LLM route() 的完整返回 */
export interface RouteResult {
  calls: ToolCall[]
  confidenceSignals: ConfidenceSignals
}

/** 置信度三信号 */
export interface ConfidenceSignals {
  toolMatch: ConfidenceLevel
  verdictConfidence: ConfidenceLevel
  queryClarity: ConfidenceLevel
}

// ============================================================
// 工具层 — YAML 声明 + 匹配 + 执行
// ============================================================

export type ToolOperation = 'list' | 'detail' | 'statistics' | 'trend' | 'alert' | 'mutation'
export type ToolCost = 'low' | 'medium' | 'high'

/** YAML 工具声明解析后的内存表示 */
export interface ToolDefinition {
  name: string
  description: string
  version: string
  system: string
  domains: string[]
  operation: ToolOperation
  supportsFilters: string[]
  returns: string[]
  feedsInto: string[]
  dependsOn: string[]
  quality: number
  cost: ToolCost
  inputSchema: ToolInputSchema
  examples: ToolExample[]
  whenToUse: string
  whenNotToUse: string
}

export interface ToolInputSchema {
  type: 'object'
  properties: Record<string, {
    type: string
    enum?: unknown[]
    description?: string
    format?: string
    default?: unknown
  }>
  required?: string[]
}

export interface ToolExample {
  query: string
  arguments: Record<string, unknown>
}

/** 匹配后的排序结果 */
export interface RankedTool {
  name: string
  matchScore: number
  quality: number
  inputSchema: ToolInputSchema
}

/** 工具执行结果 */
export interface ToolResult {
  data: unknown
  status: 'success' | 'partial' | 'error'
  errorLevel?: 1 | 2 | 3 | 4
}

// ============================================================
// LLM Provider 抽象
// ============================================================

/** LLM Provider 统一接口 — P0 只实现 codex-proxy */
export interface LLMProvider {
  route(prompt: string, tools: ToolDefinition[]): Promise<RouteResult>
  evaluate(question: string, toolChain: string[], resultSummary: string): Promise<EvaluateResult>
  summarize(data: unknown, question: string, formatHint: DisplayFormat): Promise<SummarizeResult>
}

export type DisplayFormat = 'single_value' | 'list' | 'timeseries' | 'multi_step'

export interface EvaluateResult {
  relevance: 1 | 2 | 3 | 4 | 5
  completeness: 1 | 2 | 3 | 4 | 5
  efficiency: 1 | 2 | 3 | 4 | 5
}

export interface SummarizeResult {
  answer: string
  display: StructuredResult['display']
  columns?: string[]
  followUp?: string[]
}

// ============================================================
// 存储层 — 三层记忆
// ============================================================

/** 会话层 — nl_memory_sessions */
export interface MemorySession {
  sessionId: string
  userId: string
  tenantId: string
  query: string
  intentHash: string
  toolChain: string[]
  resultSummary: string
  routingDecision: Record<string, unknown>
  feedback?: string
  createdAt: Date
  expiresAt: Date
}

/** 经验层 — nl_memory_verdicts */
export interface MemoryVerdict {
  intentHash: string
  tenantId: string
  toolChain: string[]
  avgScore: number
  sampleCount: number
  confidence: ConfidenceLevel
  bonusPoints: number
  lastUpdated: Date
  expiresAt: Date
}

/** 持久层 — nl_memory_preferences */
export interface MemoryPreference {
  userId: string
  tenantId: string
  preferences: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

// ============================================================
// 用户 — nl_users
// ============================================================

export interface NLUser {
  userId: string
  authType: 'api_key' | 'jwt' | 'sso'
  allowedSystems: string[]
  allowedTools: string[]
  role: 'viewer' | 'operator' | 'admin'
  tenantId: string
}
