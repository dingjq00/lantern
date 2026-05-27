// 探测 DeepSeek V4 模型是否可调通
// 用法: npx tsx scripts/test-deepseek-v4.ts
import fs from 'fs'
import OpenAI from 'openai'

const envPath = '.env.local'
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^(\w+)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}

const baseURL = process.env.LLM_BASE_URL || 'https://api.deepseek.com'
const apiKey = process.env.LLM_API_KEY
const models = ['deepseek-v4-flash', 'deepseek-v4-pro'] as const

if (!apiKey) {
  console.error('缺少 LLM_API_KEY，请在 .env.local 中配置')
  process.exit(1)
}

const client = new OpenAI({ baseURL, apiKey })

async function probe(model: string, thinking: 'disabled' | 'enabled'): Promise<void> {
  const start = Date.now()
  const label = `${model} (thinking=${thinking})`
  try {
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: '回复一个字：好' }],
      max_tokens: 32,
      temperature: 0,
      // @ts-expect-error DeepSeek V4 thinking 开关
      extra_body: { thinking: { type: thinking } },
    })
    const msg = res.choices[0]?.message as Record<string, unknown> | undefined
    const content = String(msg?.content ?? '').trim()
    const reasoning = String(msg?.reasoning_content ?? '').trim()
    const preview = content || reasoning || '(empty)'
    console.log(`✅ ${label} — ${Date.now() - start}ms — ${preview.slice(0, 80)}`)
    if (!content && reasoning) {
      console.log(`   ℹ️  content 为空，输出在 reasoning_content`)
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`❌ ${label} — ${Date.now() - start}ms — ${msg}`)
  }
}

async function main() {
  console.log(`baseURL: ${baseURL}`)
  console.log(`主模型: ${process.env.LLM_MODEL || '(未设置)'}`)
  console.log(`升级模型: ${process.env.LLM_ESCALATION_MODEL || '(未设置)'}\n`)
  await probe('deepseek-v4-flash', 'disabled')
  await probe('deepseek-v4-pro', 'disabled')
  await probe('deepseek-v4-pro', 'enabled')

  // ReAct 同款：JSON mode + thinking disabled
  console.log('\n--- ReAct 探针（json_object + thinking=disabled）---')
  for (const model of models) {
    const start = Date.now()
    try {
      const res = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: '输出 JSON: {"thought":"ok","finish":true}' }],
        max_tokens: 128,
        temperature: 0,
        response_format: { type: 'json_object' },
        // @ts-expect-error DeepSeek V4
        extra_body: { thinking: { type: 'disabled' } },
      })
      const content = res.choices[0]?.message?.content ?? ''
      console.log(`✅ ${model} JSON — ${Date.now() - start}ms — ${content.slice(0, 120)}`)
    } catch (err: unknown) {
      console.log(`❌ ${model} JSON — ${err instanceof Error ? err.message : err}`)
    }
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
