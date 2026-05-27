// MCP 契约校验 — YAML skill 名 vs handler 注册名
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

const HANDLERS_DIR = path.join(process.cwd(), 'mcp-server', 'src', 'handlers')
const SKILLS_DIR = path.join(process.cwd(), 'skills')

/** 从 skills 目录下各子目录的 yaml 读取 name 字段 */
export function loadYamlToolNames(skillsDir = SKILLS_DIR): string[] {
  const names: string[] = []
  if (!fs.existsSync(skillsDir)) return names

  for (const sysDir of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!sysDir.isDirectory()) continue
    const sysPath = path.join(skillsDir, sysDir.name)
    for (const file of fs.readdirSync(sysPath).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))) {
      const raw = yaml.load(fs.readFileSync(path.join(sysPath, file), 'utf-8')) as Record<string, unknown>
      if (typeof raw.name === 'string') names.push(raw.name)
    }
  }
  return names.sort()
}

/** 从 mcp-server handlers 扫描 server.tool('...') 注册名 */
export function loadMcpHandlerNames(handlersDir = HANDLERS_DIR): string[] {
  const names = new Set<string>()
  const toolPattern = /server\.tool\(\s*['"]([^'"]+)['"]/g

  function scanDir(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        scanDir(full)
      } else if (entry.name.endsWith('.ts')) {
        const content = fs.readFileSync(full, 'utf-8')
        let m: RegExpExecArray | null
        while ((m = toolPattern.exec(content)) !== null) {
          names.add(m[1])
        }
      }
    }
  }

  scanDir(handlersDir)
  return [...names].sort()
}

export interface McpContractDiff {
  yamlOnly: string[]
  handlerOnly: string[]
}

export function diffMcpContract(skillsDir = SKILLS_DIR, handlersDir = HANDLERS_DIR): McpContractDiff {
  const yamlNames = new Set(loadYamlToolNames(skillsDir))
  const handlerNames = new Set(loadMcpHandlerNames(handlersDir))
  return {
    yamlOnly: [...yamlNames].filter(n => !handlerNames.has(n)).sort(),
    handlerOnly: [...handlerNames].filter(n => !yamlNames.has(n)).sort(),
  }
}
