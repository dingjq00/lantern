// JSY 工具一行命令测试器
//
// 用法：
//   npx tsx scripts/jsy/test-tool.ts <tool-name> '<json-args>'
//   例：
//     npx tsx scripts/jsy/test-tool.ts jsy.ferment.room.profile '{"roomId":"ZL-A12"}'
//     npx tsx scripts/jsy/test-tool.ts jsy.pit.lifecycle '{"unitCode":"1187","includeLineage":true}'
//
// 工作原理：用 tsx 直接跑 mcp-server/src（与 lantern 运行时一致，无需 build）→ MCP initialize → tools/call → 打印 result
// 环境变量同 lantern：JSY_API_BASE_URL / JSY_USERNAME / JSY_PASSWORD（或 JSY_GOD_TOKEN=1）

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..', '..')
const MCP_ENTRY = join(REPO_ROOT, 'mcp-server', 'src', 'index.ts')

const [, , toolName, argsJson] = process.argv

if (!toolName) {
  console.error('用法: npx tsx scripts/jsy/test-tool.ts <tool-name> \'<json-args>\'')
  console.error('例:   npx tsx scripts/jsy/test-tool.ts jsy.ferment.room.profile \'{"roomId":"ZL-A12"}\'')
  process.exit(2)
}

let toolArgs: Record<string, unknown> = {}
if (argsJson) {
  try {
    toolArgs = JSON.parse(argsJson)
  } catch (e) {
    console.error(`参数 JSON 解析失败: ${(e as Error).message}`)
    process.exit(2)
  }
}

const proc = spawn('npx', ['tsx', MCP_ENTRY], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: process.env,
})

let buffer = ''
const pending = new Map<number, (result: unknown) => void>()

proc.stdout.on('data', (chunk: Buffer) => {
  buffer += chunk.toString('utf-8')
  let idx
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx).trim()
    buffer = buffer.slice(idx + 1)
    if (!line) continue
    try {
      const msg = JSON.parse(line) as { id?: number; result?: unknown; error?: unknown }
      if (typeof msg.id === 'number') {
        const cb = pending.get(msg.id)
        if (cb) {
          pending.delete(msg.id)
          if (msg.error) {
            console.error('❌ MCP 错误：', JSON.stringify(msg.error, null, 2))
            cleanup(1)
          } else {
            cb(msg.result)
          }
        }
      }
    } catch {
      // 非 JSON 行（如启动日志），忽略
    }
  }
})

let nextId = 1
function send<T>(method: string, params?: unknown): Promise<T> {
  return new Promise((resolve) => {
    const id = nextId++
    pending.set(id, resolve as (r: unknown) => void)
    const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'
    proc.stdin.write(msg)
  })
}

// 通知：无 id、不等响应。MCP 要求 initialize 后发 notifications/initialized；
// 发成带 id 的请求会被服务端回 -32601 Method not found，导致握手在工具调用前就挂掉。
function notify(method: string, params?: unknown) {
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n')
}

function cleanup(code = 0) {
  proc.kill()
  process.exit(code)
}

;(async () => {
  // 1. initialize
  await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'jsy-test-tool', version: '1.0.0' },
  })
  notify('notifications/initialized', {})

  // 2. tools/call
  const start = Date.now()
  const result = await send<{ content: Array<{ type: string; text: string }> }>('tools/call', {
    name: toolName,
    arguments: toolArgs,
  })
  const elapsed = Date.now() - start

  console.log(`✓ ${toolName} 返回（${elapsed} ms）：`)
  console.log('───────────────')
  if (result?.content) {
    for (const c of result.content) {
      if (c.type === 'text') {
        // 截断超长输出，避免刷屏
        if (c.text.length > 5000) {
          console.log(c.text.slice(0, 5000))
          console.log(`\n... [输出截断，原长度 ${c.text.length} 字符]`)
        } else {
          console.log(c.text)
        }
      }
    }
  } else {
    console.log(JSON.stringify(result, null, 2))
  }
  console.log('───────────────')
  cleanup(0)
})().catch((e) => {
  console.error('运行出错：', e)
  cleanup(1)
})

// 安全网：20 秒未返回强制退出（tsx 冷启动 + 真实网络登录留余量）
setTimeout(() => {
  console.error('⏰ 超时（20s）— 子进程没响应，强制退出')
  cleanup(124)
}, 20_000).unref()
