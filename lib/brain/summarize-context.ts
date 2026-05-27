// Summarize 上下文打包 — 多系统分片 + 按 (tool, args) 保留证据
import { buildDigestForSummarize, buildMultiSystemDigest } from './data-digest'
import { detectDisplayFormat } from './result-presenter'
import { SYSTEM_REGISTRY } from '@/lib/systems'
import { resolveBridgeHints, formatBridgeHintsForPrompt, type BridgeHint } from './cross-system-bridge'
import type { ToolRegistry } from '@/lib/tools/registry'
import type { DisplayFormat, ToolInvocation, SystemSlice } from '@/lib/types'

export interface SummarizeContext {
  /** 主系统：单系统即该系统；多系统为按调用顺序首个 */
  systemId: string | undefined
  systemIds: string[]
  systems: SystemSlice[]
  allInvocations: ToolInvocation[]
  /** 按 tool+argSignature 去重后的结果（供 UI 表格） */
  dedupedResults: Array<{ tool: string; data: unknown; arguments: Record<string, unknown> }>
  mergedData: unknown
  formatHint: DisplayFormat
  relatedContext: string | undefined
  dataDigest: string | undefined
  bridges: BridgeHint[]
}

/** 稳定序列化参数，用于区分同工具不同调用 */
export function computeArgSignature(args: Record<string, unknown>): string {
  return JSON.stringify(sortKeysDeep(args))
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  const obj = value as Record<string, unknown>
  return Object.keys(obj).sort().reduce<Record<string, unknown>>((acc, key) => {
    acc[key] = sortKeysDeep(obj[key])
    return acc
  }, {})
}

/** 同 tool+args 只保留最后一次（重试场景） */
export function dedupeInvocations(invocations: ToolInvocation[]): ToolInvocation[] {
  const map = new Map<string, ToolInvocation>()
  for (const inv of invocations) {
    map.set(`${inv.tool}|${inv.argSignature}`, inv)
  }
  return [...map.values()]
}

/** 为 digest 分配唯一键：同工具多次调用用 tool#N */
export function assignDigestKeys(invocations: ToolInvocation[]): Array<{ tool: string; data: unknown; digestKey: string }> {
  const perTool = new Map<string, number>()
  return invocations.map(inv => {
    const n = (perTool.get(inv.tool) ?? 0) + 1
    perTool.set(inv.tool, n)
    const total = invocations.filter(i => i.tool === inv.tool).length
    const digestKey = total === 1 ? inv.tool : `${inv.tool}#${n}`
    return { tool: inv.tool, data: inv.data, digestKey }
  })
}

function toInvocation(
  r: { tool: string; data: unknown; arguments?: Record<string, unknown> },
  registry: ToolRegistry,
): ToolInvocation {
  const args = r.arguments ?? {}
  const toolDef = registry.getTool(r.tool)
  return {
    tool: r.tool,
    arguments: args,
    data: r.data,
    system: toolDef?.system ?? r.tool.split('.')[0],
    argSignature: computeArgSignature(args),
  }
}

function buildSystemSlices(deduped: ToolInvocation[]): SystemSlice[] {
  const bySystem = new Map<string, ToolInvocation[]>()
  for (const inv of deduped) {
    const list = bySystem.get(inv.system) ?? []
    list.push(inv)
    bySystem.set(inv.system, list)
  }
  return [...bySystem.entries()].map(([systemId, invocations]) => ({
    systemId,
    invocations,
    digest: buildDigestForSummarize(assignDigestKeys(invocations), systemId),
  }))
}

function buildRelatedContext(
  deduped: ToolInvocation[],
  registry: ToolRegistry,
  systemIds: string[],
): { relatedContext: string | undefined; bridges: BridgeHint[] } {
  const relatedHints: string[] = []
  const calledTools = new Set(deduped.map(r => r.tool))

  for (const sysId of systemIds) {
    const meta = SYSTEM_REGISTRY[sysId]
    if (meta?.domainModel) {
      const label = meta.label ?? sysId.toUpperCase()
      relatedHints.push(`[${label}] 业务关系链:\n${meta.domainModel}`)
    }
  }

  for (const r of deduped) {
    const toolDef = registry.getTool(r.tool)
    if (toolDef?.feedsInto?.length) {
      const uncalled = toolDef.feedsInto.filter(t => !calledTools.has(t))
      if (uncalled.length > 0) {
        const toolNames = uncalled.map(t => {
          const def = registry.getTool(t)
          return def ? `${t}(${def.description.slice(0, 30)})` : t
        })
        relatedHints.push(`${r.tool} 可深挖→ ${toolNames.join(', ')}`)
      }
    }
    const d = r.data as Record<string, unknown>
    if (d && typeof d === 'object') {
      const nums: string[] = []
      if ('total' in d && typeof d.total === 'number' && d.total > 0) nums.push(`共${d.total}条`)
      if ('bom' in d && Array.isArray(d.bom)) nums.push(`BOM${d.bom.length}种备件`)
      if ('recentFaults' in d && Array.isArray(d.recentFaults)) nums.push(`近期${d.recentFaults.length}次故障`)
      if ('activeRepairs' in d && Array.isArray(d.activeRepairs)) nums.push(`${d.activeRepairs.length}个进行中维修`)
      if (nums.length) relatedHints.push(`${r.tool}: ${nums.join(', ')}`)
    }
  }

  const bridges = resolveBridgeHints(systemIds)
  const bridgeBlock = formatBridgeHintsForPrompt(bridges)
  if (bridgeBlock) relatedHints.push(bridgeBlock)

  return {
    relatedContext: relatedHints.length > 0 ? relatedHints.join('\n\n') : undefined,
    bridges,
  }
}

/**
 * 从工具调用结果打包 summarize 上下文
 * 支持 ToolInvocation[] 或带可选 arguments 的简化输入（测试兼容）
 */
export function prepareSummarizeContext(
  allResults: Array<{ tool: string; data: unknown; arguments?: Record<string, unknown> }> | ToolInvocation[],
  registry: ToolRegistry,
): SummarizeContext {
  const raw = allResults as Array<{ tool: string; data: unknown; arguments?: Record<string, unknown> }>
  const invocations: ToolInvocation[] = raw.length > 0 && 'argSignature' in raw[0]
    ? (raw as ToolInvocation[])
    : raw.map(r => toInvocation(r, registry))

  const deduped = dedupeInvocations(invocations)
  const systemIds = [...new Set(deduped.map(i => i.system))]
  const systemId = systemIds.length === 1 ? systemIds[0] : systemIds[0]
  const systems = buildSystemSlices(deduped)
  const { relatedContext, bridges } = buildRelatedContext(deduped, registry, systemIds)

  const dataDigest = deduped.length > 0
    ? buildMultiSystemDigest(systems)
    : undefined

  const mergedData = deduped.map(r => r.data)
  const firstData = mergedData.length === 1 ? mergedData[0] : mergedData
  const formatHint = detectDisplayFormat(firstData)

  return {
    systemId: systemIds.length === 1 ? systemIds[0] : (systemIds[0] ?? undefined),
    systemIds,
    systems,
    allInvocations: invocations,
    dedupedResults: deduped.map(i => ({ tool: i.tool, data: i.data, arguments: i.arguments })),
    mergedData: firstData,
    formatHint,
    relatedContext,
    dataDigest,
    bridges,
  }
}
