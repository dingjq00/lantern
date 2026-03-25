// YAML 工具声明扫描和解析
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import type { ToolDefinition } from '@/lib/types'

/**
 * 扫描 toolsDir 下所有子目录的 .yaml 文件，解析为 ToolDefinition[]
 */
export function loadTools(toolsDir: string): ToolDefinition[] {
  const tools: ToolDefinition[] = []

  const systems = fs.readdirSync(toolsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())

  for (const sysDir of systems) {
    const sysPath = path.join(toolsDir, sysDir.name)
    const files = fs.readdirSync(sysPath).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))

    for (const file of files) {
      const raw = yaml.load(fs.readFileSync(path.join(sysPath, file), 'utf-8')) as Record<string, unknown>
      tools.push(parseToolYaml(raw))
    }
  }

  return tools
}

/** snake_case YAML → camelCase ToolDefinition */
function parseToolYaml(raw: Record<string, unknown>): ToolDefinition {
  return {
    name: raw.name as string,
    description: raw.description as string,
    version: String(raw.version ?? '1.0'),
    system: raw.system as string,
    domains: raw.domains as string[],
    operation: raw.operation as ToolDefinition['operation'],
    supportsFilters: (raw.supports_filters ?? []) as string[],
    returns: (raw.returns ?? []) as string[],
    feedsInto: (raw.feeds_into ?? []) as string[],
    dependsOn: (raw.depends_on ?? []) as string[],
    quality: (raw.quality ?? 0) as number,
    cost: (raw.cost ?? 'low') as ToolDefinition['cost'],
    inputSchema: normalizeInputSchema(raw.input_schema as Record<string, unknown>),
    examples: ((raw.examples ?? []) as Record<string, unknown>[]).map(e => ({
      query: e.query as string,
      arguments: (e.arguments ?? {}) as Record<string, unknown>,
    })),
    whenToUse: (raw.when_to_use ?? '') as string,
    whenNotToUse: (raw.when_not_to_use ?? '') as string,
  }
}

function normalizeInputSchema(raw: Record<string, unknown>): ToolDefinition['inputSchema'] {
  if (!raw) return { type: 'object', properties: {} }
  return {
    type: 'object',
    properties: (raw.properties ?? {}) as ToolDefinition['inputSchema']['properties'],
    ...(raw.required ? { required: raw.required as string[] } : {}),
  }
}
