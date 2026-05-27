// MCP Server 启动命令 — 优先 node dist，避免 npx 缓存权限问题
import fs from 'fs'
import path from 'path'

export function getMcpServerSpawn(cwd = process.cwd()): { command: string; args: string[] } {
  const distEntry = path.join(cwd, 'mcp-server', 'dist', 'index.js')
  if (fs.existsSync(distEntry)) {
    return { command: 'node', args: [distEntry] }
  }
  const localTsx = path.join(cwd, 'mcp-server', 'node_modules', '.bin', 'tsx')
  const srcEntry = path.join(cwd, 'mcp-server', 'src', 'index.ts')
  if (fs.existsSync(localTsx)) {
    return { command: localTsx, args: [srcEntry] }
  }
  return { command: 'npx', args: ['tsx', srcEntry] }
}
