// MCP Server 共享工具函数 — 所有系统的 handler 共用

/** 构建 MCP 文本响应 */
export function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}
