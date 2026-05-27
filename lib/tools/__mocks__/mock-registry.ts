// 测试用 ToolRegistry 工厂 — 最小 ToolDefinition 集合
import { ToolRegistry } from '../registry'
import type { ToolDefinition } from '@/lib/types'

export function makeTool(overrides: Partial<ToolDefinition> & Pick<ToolDefinition, 'name'>): ToolDefinition {
  return {
    description: overrides.description ?? `mock ${overrides.name}`,
    version: '1.0',
    system: overrides.system ?? overrides.name.split('.')[0],
    domains: overrides.domains ?? ['default'],
    operation: overrides.operation ?? 'search',
    supportsFilters: overrides.supportsFilters ?? [],
    returns: overrides.returns ?? [],
    feedsInto: overrides.feedsInto ?? [],
    dependsOn: overrides.dependsOn ?? [],
    quality: overrides.quality ?? 1,
    cost: overrides.cost ?? 'low',
    inputSchema: overrides.inputSchema ?? { type: 'object', properties: {} },
    examples: overrides.examples ?? [],
    whenToUse: overrides.whenToUse ?? '',
    whenNotToUse: overrides.whenNotToUse ?? '',
    ...overrides,
  }
}

export function createMockRegistry(tools: ToolDefinition[]): ToolRegistry {
  return new ToolRegistry(tools)
}

/** 常用双系统 registry（EAM + MES） */
export function createCrossSystemRegistry(): ToolRegistry {
  return createMockRegistry([
    makeTool({ name: 'eam.dashboard', system: 'eam', domains: ['equipment', 'fault'], operation: 'dashboard' }),
    makeTool({ name: 'mes.dashboard', system: 'mes', domains: ['production', 'order'], operation: 'dashboard', feedsInto: ['mes.order.search'] }),
    makeTool({ name: 'mes.order.search', system: 'mes', domains: ['order'], operation: 'search' }),
  ])
}
