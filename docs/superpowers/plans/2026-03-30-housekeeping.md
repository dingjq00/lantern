# 打扫屋子 — Lantern 结构性清理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清理三个已证明无效/未接入的模块，为质量优化（4.1→更高）扫清结构障碍。

**Architecture:** 三件事按依赖顺序执行：
1. 抽取 summarize prompt → 独立文件（解除质量优化前置障碍）
2. 砍掉 verdict 注入 + subagent-evaluator（去掉无效功 + 噪音）
3. 接入 validator（零成本外部信号进入观察注入）

**Tech Stack:** TypeScript, Next.js, Vitest

**验证基线:** 清理前后跑 benchmark 75 题，recall 必须保持 100%，质量不降。

---

## 文件变更地图

| 操作 | 文件 | 职责 |
|------|------|------|
| **Create** | `prompts/summarize.md` | Summarize 的 system prompt，独立管理 |
| **Modify** | `lib/llm/codex-proxy.ts` | 从硬编码 prompt → 读文件 |
| **Modify** | `lib/brain/router.ts` | 砍 subagent-evaluator + verdict 更新 + 接入 validator |
| **Modify** | `lib/brain/prompt-assembler.ts` | 移除 verdict 注入 |
| **Modify** | `lib/brain/confidence.ts` | verdictConfidence 改为固定 'medium'（不再依赖 verdict） |
| **Modify** | `lib/types.ts` | 移除 lessonEval 字段 |
| **Modify** | `app/components/TracePanel.tsx` | 移除 lessonEval 显示、verdict 显示简化 |
| **Modify** | `app/components/ChatMessage.tsx` | 移除 lessonEval 传参 |
| **Modify** | `app/benchmark/page.tsx` | 移除 lessonEval 显示 |
| **Modify** | `scripts/benchmark.ts` | 移除 lessonEval 字段 |
| **Keep** | `lib/brain/verdict.ts` | 保留文件但不再被 router 调用（将来自学习可能复用） |
| **Keep** | `lib/brain/subagent-evaluator.ts` | 保留文件但不再被 router 调用 |
| **Keep** | `lib/brain/relevance-checker.ts` | extractDataFields 保留（router 观察注入还在用） |
| **Keep** | `lib/storage/sqlite.ts` | verdict/lesson 表保留（历史数据不删） |
| **Keep** | `app/api/benchmark/lessons/route.ts` | lessons API 保留（历史查询用） |

---

### Task 1: 抽取 summarize prompt 到独立文件

**Files:**
- Create: `prompts/summarize.md`
- Modify: `lib/llm/codex-proxy.ts:115-165`

- [ ] **Step 1: 创建 `prompts/summarize.md`**

把 `codex-proxy.ts` 里 `summarize()` 方法中的 system prompt 硬编码内容原样抽取到独立文件。内容不做任何修改（控制变量）。

```markdown
你是工厂管理系统的数据解读助手。用管理者听得懂的业务语言回答问题。

核心原则：
1. 不编造 — 只基于数据回答，数字直接引用，不模糊化
2. "没有"也是答案，但不能只说"没有"就停 — 说完"没有"后，挖掘数据中的相关上下文（如：虽然没有保养记录，但有故障记录，建议关注）
3. 业务语言 — 说人话，不说技术术语

回答模式：
- total=0 或 items=[] → "目前没有XX记录" + 从其他数据中挖掘相关信息（如库存状态、关联设备、历史记录等），给出有价值的补充
- 有数据但某字段为空 → "共N条记录，但XX信息尚未录入"
- unsupported 标记 → 基于 aiAnalysis 友好说明为什么暂不支持 + 建议替代方案
- 正常数据 → 先给核心数字，再说关键发现，一两句话
- 多域数据 → 按域分段概括，每域一句

多工具数据融合规则（重要！）：
- 数据来自多个工具时，综合所有工具的结果回答，不要只看其中一个
- 某个工具返回 error 但其他工具有数据 → 以有数据的工具为准，忽略错误的
- 某个工具返回 error 且错误信息含重定向提示 → 说明查询路径调整，基于其他数据回答
- 所有工具都是 error → 才说"未找到"

禁用词（绝对不能出现）：数据不足、无法回答、数据不完整、暂无数据
替代说法：目前没有XX记录、XX信息尚未录入、近期没有XX

followUp（3-5 个后续探索方向，像 Perplexity 的 Related 那样"懂用户下一步想知道什么"）：
- 祈使句，可直接执行（不要问句）
- 优先用数据中的具体数字做诱饵，如"查看该设备的2次故障记录"而不是"查看故障记录"
- 至少1条深挖当前主题，至少1条跨域关联（如：设备→备件，故障→保养）
- 最值得点的排第一位

返回 JSON: {"answer": "自然语言回答", "display": "text|table|chart", "columns": ["列名"], "followUp": ["后续方向1", "后续方向2", "后续方向3"]}
```

- [ ] **Step 2: 修改 `codex-proxy.ts` — 读文件替代硬编码**

在文件顶部加懒加载，`summarize()` 方法改为读文件：

```typescript
// 文件顶部（extractJSON 函数之后）
let summarizePromptText: string | null = null
function getSummarizePrompt(): string {
  if (!summarizePromptText) {
    summarizePromptText = fs.readFileSync(
      path.join(process.cwd(), 'prompts', 'summarize.md'), 'utf-8'
    )
  }
  return summarizePromptText
}
```

需要在文件顶部加 `import fs from 'fs'` 和 `import path from 'path'`。

然后 `summarize()` 方法中，把 `content: \`你是工厂管理系统...\`` 替换为：

```typescript
{ role: 'system', content: `${getSummarizePrompt()}\n数据展示类型参考: ${formatHint}` },
```

- [ ] **Step 3: 验证 — 启动 dev server 确认 chat 能正常回答**

Run: `npm run build 2>&1 | tail -20`
Expected: 编译成功，无报错

- [ ] **Step 4: Commit**

```bash
git add prompts/summarize.md lib/llm/codex-proxy.ts
git commit -m "refactor: 抽取 summarize prompt 到独立文件 — 质量优化前置"
```

---

### Task 2: 砍掉 subagent-evaluator 调用

router.ts 末尾有 ~35 行 subagent 评估逻辑，每次查询额外调一次 LLM，已证明无效（循环论证）。砍掉调用，保留文件。

**Files:**
- Modify: `lib/brain/router.ts:325-348`（subagent 评估块）
- Modify: `lib/brain/router.ts:360`（result.lessonEval 赋值）
- Modify: `lib/brain/router.ts` 顶部 import
- Modify: `lib/types.ts:29,300`（lessonEval 字段）
- Modify: `app/components/TracePanel.tsx`（lessonEval 显示）
- Modify: `app/components/ChatMessage.tsx:82`（lessonEval 传参）
- Modify: `app/benchmark/page.tsx:27,416-419`（lessonEval 显示）
- Modify: `scripts/benchmark.ts:137,290`（lessonEval 字段）

- [ ] **Step 1: 修改 `lib/brain/router.ts` — 删除 subagent 评估块**

删除以下 import：
```typescript
import { evaluateWithSubagent } from './subagent-evaluator'
import { extractDataFields } from './relevance-checker'
```

删除 router.ts 第 325~348 行（subagent 评估 + lesson 写入整个 try-catch 块）：
```typescript
  // subagent 评估（和 result 一起返回，前端可展示）
  let lessonEval: { quality: string; reason: string; lesson: string } | undefined
  try {
    ...整个块...
  } catch (err) { console.warn('[Router] Subagent 评估失败:', err) }
```

删除第 360 行：
```typescript
  result.lessonEval = lessonEval
```

- [ ] **Step 2: 修改 `lib/types.ts` — 移除 lessonEval 字段**

从 `StructuredResult` 接口删除：
```typescript
  lessonEval?: { quality: string; reason: string; lesson: string }  // subagent 评估结果
```

从 `BenchmarkResult` 接口删除：
```typescript
  lessonEval?: { quality: string; reason: string; lesson: string }
```

- [ ] **Step 3: 修改前端 — 移除 lessonEval 显示**

**`app/components/TracePanel.tsx`:**
- 删除 `lessonEval` prop 类型定义和参数
- 删除第 67-72 行 lessonEval 条件渲染块
- 接口简化为 `interface TracePanelProps { trace: ExecutionTrace }`

**`app/components/ChatMessage.tsx`:**
- 第 82 行改为 `<TracePanel trace={message.trace} />`

**`app/benchmark/page.tsx`:**
- 删除第 27 行 lessonEval 类型
- 删除第 416-419 行 Subagent 条件渲染块
- 删除第 290 行 lessonEval 引用

**`scripts/benchmark.ts`:**
- 删除第 137 行 lessonEval 类型
- 删除第 290 行 lessonEval 赋值

- [ ] **Step 4: 验证编译**

Run: `npm run build 2>&1 | tail -20`
Expected: 编译成功，无 lessonEval 相关引用报错

- [ ] **Step 5: Commit**

```bash
git add lib/brain/router.ts lib/types.ts app/components/TracePanel.tsx app/components/ChatMessage.tsx app/benchmark/page.tsx scripts/benchmark.ts
git commit -m "cleanup: 移除 subagent-evaluator 调用 — 已证明无效的AI自评"
```

---

### Task 3: 砍掉 verdict 注入 + 简化置信度

verdict 注入往 prompt 里加"历史推荐路径"，60% 准确率意味着 40% 是噪音。砍掉注入，置信度计算简化为二信号。

**Files:**
- Modify: `lib/brain/router.ts:53-59,89-90,255-256,317-322`
- Modify: `lib/brain/prompt-assembler.ts:53,144-147`
- Modify: `lib/brain/confidence.ts:19-26`
- Modify: `app/components/TracePanel.tsx:62-64`

- [ ] **Step 1: 修改 `lib/brain/prompt-assembler.ts` — 移除 verdict 注入**

从 `AssembleOptions` 接口删除 `verdict` 字段：
```typescript
export interface AssembleOptions {
  memoryContext?: string
}
```

删除第 144-147 行的 verdict 动态注入块：
```typescript
  if (options.verdict && options.verdict.toolChain.length > 0) {
    sections.push(`\n\n## 历史推荐路径\n${options.verdict.toolChain.join(' → ')}（评分 ${options.verdict.avgScore.toFixed(1)}，${options.verdict.sampleCount} 次样本）`)
  }
```

更新文件头注释：从 `支持 ReAct 格式 + verdict 注入` 改为 `支持 ReAct 格式`。

- [ ] **Step 2: 修改 `lib/brain/router.ts` — 移除 verdict 相关逻辑**

删除 import：
```typescript
import { maybeUpdateVerdict } from './verdict'
import { computeVerdictConfidence } from './confidence'
```
（保留 `computeConfidence` import）

删除第 53-56 行 verdict 变量声明：
```typescript
  // 查 verdict（先用空 hash，首轮 think 后更新）
  ...
  let verdict = null as ReturnType<StorageInterface['getVerdict']>
```

修改第 59 行 assemblePrompt 调用，去掉 verdict 参数：
```typescript
  const { systemPrompt } = assemblePrompt(query, allTools, { memoryContext: historyContext })
```

删除第 89-90 行 verdict 查询和 trace 设置：
```typescript
        verdict = storage.getVerdict(tenantId, intent.intentHash)
        trace.setVerdict(verdict)
```

简化第 255-256 行置信度计算：
```typescript
  const signals: ConfidenceSignals = { toolMatch, verdictConfidence: 'medium', queryClarity: clarity }
```

删除第 317-322 行 verdict 更新块：
```typescript
    // 触发 verdict 更新（异步，冷启动阈值 3）
    if (intent?.intentHash) {
      maybeUpdateVerdict(storage, tenantId, intent.intentHash, 3).catch(err =>
        console.warn('[Router] Verdict 更新失败:', err)
      )
    }
```

- [ ] **Step 3: 修改 `lib/brain/confidence.ts` — 简化为二信号**

`computeVerdictConfidence` 函数改为固定返回 `'medium'`（保持接口不变，最小化改动）：

```typescript
/**
 * P1.5: verdict 已停用，固定返回 medium（不拖后腿也不加分）
 * 未来自学习复活时改回动态计算
 */
export function computeVerdictConfidence(_verdict: MemoryVerdict | null): ConfidenceLevel {
  return 'medium'
}
```

- [ ] **Step 4: 修改 `app/components/TracePanel.tsx` — 简化 verdict 显示**

第 62 行把 verdict 详情改为简单标记：
```typescript
<div>Verdict: 已停用（P1.5 清理）</div>
```

- [ ] **Step 5: 验证编译**

Run: `npm run build 2>&1 | tail -20`
Expected: 编译成功

- [ ] **Step 6: Commit**

```bash
git add lib/brain/router.ts lib/brain/prompt-assembler.ts lib/brain/confidence.ts app/components/TracePanel.tsx
git commit -m "cleanup: 移除 verdict 注入 — 60%准确率=40%噪音，简化置信度为二信号"
```

---

### Task 4: 接入 validator 到 router

validator.ts 已有数值异常/空结果检测能力，但从未被 router 调用。接入后，校验结果进入 trace（前端已有展示逻辑），并注入观察消息让 AI 在审查轮感知数值异常。

**Files:**
- Modify: `lib/brain/router.ts`（import + 调用 validateResult + 注入观察）

- [ ] **Step 1: 修改 `lib/brain/router.ts` — 添加 validator import 和调用**

添加 import：
```typescript
import { validateResult } from './validator'
```

在每轮工具执行完成后（第 181 行 `}` 闭合 for 循环之后、观察总结之前），插入校验逻辑：

```typescript
      // 校验每个工具返回的数据
      for (const r of allResults) {
        const validations = validateResult(r.data)
        for (const v of validations) {
          trace.addValidation(v)
        }
      }
```

在观察注入消息（第 217 行 `obsMessage` 构建）中，追加校验警告：

```typescript
      // 校验警告注入（让 AI 在审查轮感知数值异常）
      const validationWarnings = trace.build().validation
        .filter(v => v.severity === 'warning')
        .map(v => `⚠️ 校验: ${v.message}`)
        .join('\n')
      const validationSection = validationWarnings ? `\n\n${validationWarnings}` : ''
```

然后在 `obsMessage` 字符串拼接中加入 `${validationSection}`（在 `${contextSection}` 之后）。

完整的 obsMessage 行变为：
```typescript
      const obsMessage = `观察结果: ${JSON.stringify(obsData)}\n\n事实对比:\n- 用户问: "${query}"\n- 已获得字段: ${[...new Set(dataFields)].join(', ')}${domainCoverageHint}${contextSection}${validationSection}\n\n检查：数据是否已回答用户问题？有无未覆盖的域？够了就 finish，不够就补充。`
```

- [ ] **Step 2: 验证编译**

Run: `npm run build 2>&1 | tail -20`
Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
git add lib/brain/router.ts
git commit -m "feat: 接入 validator 到 router — 数值异常进入观察注入"
```

---

### Task 5: 全量回归验证

清理完成后跑 benchmark 75 题，确认 recall 不降、质量不退。

- [ ] **Step 1: 跑 benchmark**

Run: `npx tsx scripts/benchmark.ts "P1.5 housekeeping — 去verdict/subagent/接validator"`
Expected: 75/75 recall, 0 失败

- [ ] **Step 2: 检查输出**

确认：
- EAM 40/40 ✅
- EDHR 35/35 ✅
- 无新的 GLOBAL_FORBIDDEN 违规
- 延迟应该略有下降（少了一次 subagent LLM 调用）

- [ ] **Step 3: Commit benchmark 结果（如果 benchmark 脚本有输出文件）**

```bash
git add -A
git commit -m "verify: P1.5 housekeeping 回归通过 — 75/75 recall 保持"
```

---

## 清理后架构变化摘要

```
Before:                              After:
router → think → execute             router → think → execute
       → observe(域覆盖+context)            → validate(数值校验)  ← NEW
       → verdict 查询/注入                  → observe(域覆盖+context+校验警告)
       → summarize                          → summarize
       → subagent 评估(额外LLM)
       → verdict 更新(异步)
       → lesson 写入

prompt-assembler:                    prompt-assembler:
  [6层] + verdict注入                  [6层]（无verdict噪音）

confidence:                          confidence:
  三信号(toolMatch+verdict+clarity)    二信号(toolMatch+clarity) + verdict固定medium

summarize prompt:                    summarize prompt:
  硬编码在 codex-proxy.ts              prompts/summarize.md（独立可迭代）
```

**净效果:**
- 每次查询少 1 次 LLM 调用（subagent），延迟 -30%~50%
- prompt 里少了 verdict 噪音（可能的 40% 误导信息）
- summarize prompt 可独立迭代（质量优化的前置条件）
- validator 数值校验进入观察注入（零成本信号）
