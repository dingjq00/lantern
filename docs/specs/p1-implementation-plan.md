# P1 Implementation Plan — Insight68 NL-API Platform

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 P0（22 MCP Tools, 单次路由, 94.2%）基础上实现 ReAct Agent + 自学习 + 置信度回退 + 结果验证 + Grounding，技术验证扩展能力。

**Architecture:** P0 四层架构不变，纵向深化智能层。核心改动：router.ts 从线性 9 步改为 ReAct 循环（批量调用+按需追查），新增 trace/verdict/validator 模块。

**Tech Stack:** TypeScript, Next.js 15, OpenAI SDK, better-sqlite3, vitest, zod (新增)

**Spec:** `docs/superpowers/specs/2026-03-26-p1-design.md`

---

## File Structure

```
lib/types.ts                          # 改：+ExecutionTrace, ThinkResult, ValidationResult, TraceCall
lib/storage/types.ts                  # 改：+insertTrace, getTrace, updateSessionFeedback
lib/storage/sqlite.ts                 # 改：实现新方法 + 加载 002 migration
lib/storage/migrations/002-trace.sql  # 新增：nl_traces 表

lib/brain/trace.ts                    # 新增：TraceCollector 类（收集+持久化）
lib/brain/router.ts                   # 大改：ReAct 循环替换线性流程
lib/brain/intent.ts                   # 改：真正意图提取（从 ThinkResult 解析）
lib/brain/prompt-assembler.ts         # 改：支持 ReAct 指令 + verdict 注入
lib/brain/confidence.ts               # 改：三信号真实计算
lib/brain/result-presenter.ts         # 小改：+sources 字段
lib/brain/validator.ts                # 新增：结果自验证（纯规则）
lib/brain/verdict.ts                  # 新增：自学习评分 + winner 计算

lib/llm/codex-proxy.ts               # 改：+think() 方法

prompts/react-instructions.md         # 新增：ReAct 循环 Prompt
prompts/base-instructions.md          # 改：整合 ReAct 格式
prompts/few-shot-examples.json        # 改：+多轮追查示例

scripts/cold-start.ts                 # 新增：测试集批跑冷启动
scripts/benchmark.ts                  # 新增：40 题验收 + 延迟统计

app/api/chat/route.ts                 # 改：注入 storage, 返回 trace
app/api/feedback/route.ts             # 新增：Thumbs Up/Down
app/components/TracePanel.tsx          # 新增：执行详情面板
app/components/ChatMessage.tsx         # 改：+TracePanel +Thumbs +Sources
app/page.tsx                          # 改：传递 trace/feedback 数据
```

---

## Task Group 1: 类型 + Trace 基础设施

### Task 1.1: 新增类型定义

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: 在 lib/types.ts 末尾添加 P1 新类型**

```typescript
// ============================================================
// P1: 执行追踪
// ============================================================

export interface TraceCall {
  tool: string
  arguments: Record<string, unknown>
  result: unknown
  status: 'success' | 'error'
  durationMs: number
}

export interface TraceRound {
  round: number
  thought: string
  calls: TraceCall[]
  observation: string
}

export interface ExecutionTrace {
  traceId: string
  query: string
  startTime: number
  endTime?: number
  rounds: TraceRound[]
  intent?: IntentTags
  verdict?: MemoryVerdict | null
  confidence: ConfidenceSignals
  finalConfidence: ConfidenceLevel
  validation: ValidationResult[]
  sources: Array<{ tool: string; description: string }>
}

// P1: ReAct Agent
export interface ThinkResult {
  thought: string
  intent?: IntentTags
  clarity?: ConfidenceLevel
  calls?: ToolCall[]
  finish?: boolean
  unsupported?: boolean
}

// P1: 结果自验证
export interface ValidationResult {
  type: 'numeric_range' | 'empty_result' | 'unit_mismatch'
  field?: string
  message: string
  severity: 'warning' | 'error'
}
```

同时给 `StructuredResult` 加 `sources` 和 `trace` 字段：

```typescript
export interface StructuredResult {
  // ... 现有字段不动
  sources?: Array<{ tool: string; description: string }>
  trace?: ExecutionTrace
}
```

给 `LLMProvider` 接口加 `think` 方法：

```typescript
export interface LLMProvider {
  // ... 现有 route/evaluate/summarize 不动
  think(messages: Array<{ role: string; content: string }>): Promise<ThinkResult>
}
```

- [ ] **Step 2: TypeScript 编译检查**

```bash
npx tsc --noEmit lib/types.ts
```

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(p1): add ExecutionTrace, ThinkResult, ValidationResult types"
```

---

### Task 1.2: Trace 存储层

**Files:**
- Create: `lib/storage/migrations/002-trace.sql`
- Modify: `lib/storage/types.ts`, `lib/storage/sqlite.ts`
- Test: `tests/lib/storage/sqlite.test.ts`

- [ ] **Step 1: 创建 002-trace.sql migration**

```sql
CREATE TABLE IF NOT EXISTS nl_traces (
  trace_id    TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL DEFAULT 'default',
  session_id  TEXT,
  query       TEXT NOT NULL,
  trace_json  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_traces_tenant_time
  ON nl_traces (tenant_id, created_at DESC);
```

- [ ] **Step 2: StorageInterface 加 trace + feedback 方法**

在 `lib/storage/types.ts` 加：

```typescript
import type { ExecutionTrace } from '@/lib/types'

// 在 StorageInterface 内加：
insertTrace(tenantId: string, trace: ExecutionTrace, sessionId?: string): void
getTrace(traceId: string): ExecutionTrace | null
updateSessionFeedback(tenantId: string, sessionId: string, feedback: 'up' | 'down'): void
```

- [ ] **Step 3: 写测试**

在 `tests/lib/storage/sqlite.test.ts` 加 trace 和 feedback 测试用例。

- [ ] **Step 4: 实现 SQLiteStorage 新方法**

`lib/storage/sqlite.ts`：
- `initialize()` 加载 002-trace.sql
- `insertTrace()` — JSON.stringify trace 写入
- `getTrace()` — 读取并 JSON.parse
- `updateSessionFeedback()` — UPDATE sessions SET feedback = ? WHERE tenant_id = ? AND session_id = ?

- [ ] **Step 5: 运行测试**

```bash
npx vitest run tests/lib/storage/sqlite.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add lib/storage/ tests/lib/storage/
git commit -m "feat(p1): trace table + feedback update in storage layer"
```

---

### Task 1.3: TraceCollector

**Files:**
- Create: `lib/brain/trace.ts`
- Test: `tests/lib/brain/trace.test.ts`

- [ ] **Step 1: 写测试**

```typescript
import { TraceCollector } from '@/lib/brain/trace'

describe('TraceCollector', () => {
  it('创建 trace 并记录 round', () => {
    const tc = new TraceCollector('测试查询')
    tc.startRound(0, '分析问题')
    tc.addCall({ tool: 'get_dashboard_summary', arguments: {}, result: { total: 128 }, status: 'success', durationMs: 300 })
    tc.endRound('获得结果')
    const trace = tc.build()
    expect(trace.rounds).toHaveLength(1)
    expect(trace.rounds[0].calls).toHaveLength(1)
  })

  it('多轮追查记录', () => {
    const tc = new TraceCollector('复杂查询')
    tc.startRound(0, '首轮规划')
    tc.addCall({ tool: 'query_equipment', arguments: {}, result: {}, status: 'success', durationMs: 200 })
    tc.endRound('需要追查')
    tc.startRound(1, '追查备件')
    tc.addCall({ tool: 'get_spare_stock', arguments: {}, result: {}, status: 'success', durationMs: 150 })
    tc.endRound('信息充足')
    expect(tc.build().rounds).toHaveLength(2)
  })
})
```

- [ ] **Step 2: 实现 TraceCollector**

```typescript
export class TraceCollector {
  private trace: ExecutionTrace
  private currentRound: TraceRound | null = null

  constructor(query: string) { /* 初始化 trace */ }
  startRound(round: number, thought: string): void
  addCall(call: TraceCall): void
  endRound(observation: string): void
  setIntent(intent: IntentTags): void
  setVerdict(verdict: MemoryVerdict | null): void
  setConfidence(signals: ConfidenceSignals, final: ConfidenceLevel): void
  addValidation(result: ValidationResult): void
  addSource(tool: string, description: string): void
  build(): ExecutionTrace
}
```

- [ ] **Step 3: 运行测试**

```bash
npx vitest run tests/lib/brain/trace.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add lib/brain/trace.ts tests/lib/brain/trace.test.ts
git commit -m "feat(p1): TraceCollector — execution trace data collector"
```

---

### Task 1.4: TracePanel 前端组件

**Files:**
- Create: `app/components/TracePanel.tsx`
- Modify: `app/components/ChatMessage.tsx`

- [ ] **Step 1: 实现 TracePanel**

可折叠面板，展示：每轮的 thought/calls/observation，意图/verdict/置信度/验证结果。

- [ ] **Step 2: ChatMessage 中集成**

在 Message interface 加 `trace?: ExecutionTrace`，在消息下方渲染 TracePanel。

- [ ] **Step 3: Commit**

```bash
git add app/components/
git commit -m "feat(p1): TracePanel — collapsible execution detail panel"
```

---

## Task Group 2: ReAct Agent

### Task 2.1: ReAct Prompt 模板

**Files:**
- Create: `prompts/react-instructions.md`
- Modify: `prompts/base-instructions.md`, `prompts/few-shot-examples.json`

- [ ] **Step 1: 创建 react-instructions.md**

ReAct 格式指令：JSON 输出格式（thought/intent/clarity/calls/finish/unsupported），观察注入规则，追查条件，最大轮次。

- [ ] **Step 2: 更新 base-instructions.md**

整合 ReAct 指令引用，保留工具选择指南和时间映射。

- [ ] **Step 3: 更新 few-shot-examples.json**

添加多轮追查示例（首轮规划→观察→追查）。

- [ ] **Step 4: Commit**

```bash
git add prompts/
git commit -m "feat(p1): ReAct prompt templates — instructions + few-shot"
```

---

### Task 2.2: think() 方法

**Files:**
- Modify: `lib/llm/codex-proxy.ts`
- Test: `tests/lib/llm/codex-proxy.test.ts`

- [ ] **Step 1: 安装 zod**

```bash
npm install zod
```

- [ ] **Step 2: 写测试**

验证 think() 返回合法 ThinkResult（含 thought + calls 或 finish）。

- [ ] **Step 3: 实现 think()**

基于 OpenAI chat.completions，response_format: json_object，zod 校验输出。

- [ ] **Step 4: 运行测试**

```bash
npx vitest run tests/lib/llm/codex-proxy.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/llm/ tests/lib/llm/ package.json package-lock.json
git commit -m "feat(p1): think() method — ReAct single-round reasoning with zod validation"
```

---

### Task 2.3: prompt-assembler 支持 ReAct

**Files:**
- Modify: `lib/brain/prompt-assembler.ts`
- Test: `tests/lib/brain/prompt-assembler.test.ts`

- [ ] **Step 1: 写测试**

验证组装结果包含 ReAct 格式指令、verdict 推荐路径注入。

- [ ] **Step 2: 实现**

`assemblePrompt()` 加载 `react-instructions.md`，可选注入 verdict winner 作为推荐路径。

- [ ] **Step 3: 运行测试**

```bash
npx vitest run tests/lib/brain/prompt-assembler.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add lib/brain/prompt-assembler.ts prompts/ tests/lib/brain/
git commit -m "feat(p1): prompt assembler supports ReAct format + verdict injection"
```

---

### Task 2.4: ReAct 循环核心

**Files:**
- Modify: `lib/brain/router.ts`
- Test: `tests/lib/brain/router.test.ts`

- [ ] **Step 1: 扩展 RouterDeps**

```typescript
interface RouterDeps {
  registry: ToolRegistry
  llm: LLMProvider
  storage: StorageInterface    // 新增
  callTool: (name: string, args: Record<string, unknown>) => Promise<ToolResult>
  history?: Array<{ role: string; content: string }>
  tenantId?: string            // 新增，默认 'default'
  userId?: string              // 新增，默认 'anonymous'
}
```

- [ ] **Step 2: 写测试 — 简单查询一轮完成**

mock think() 首轮返回 calls + finish，验证一轮即结束。

- [ ] **Step 3: 写测试 — 复杂查询触发追查**

mock think() 首轮返回 calls 不 finish，第二轮追查后 finish。

- [ ] **Step 4: 写测试 — 超纲直接返回**

mock think() 首轮返回 unsupported: true。

- [ ] **Step 5: 实现 ReAct 循环**

```
1. 组装 Prompt
2. 首轮 think() → 提取 intent/clarity + calls
3. 批量执行 calls（记录到 TraceCollector）
4. 观察结果 → think() 决定追查或 finish
5. 追查循环（最多 3 轮）
6. LLM 总结
```

此步只实现循环骨架，session/verdict/validation/grounding 在后续 task 接入。

- [ ] **Step 6: 运行测试**

```bash
npx vitest run tests/lib/brain/router.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add lib/brain/router.ts tests/lib/brain/router.test.ts
git commit -m "feat(p1): ReAct loop core — think-execute-observe cycle"
```

---

### Task 2.5: ReAct 错误处理 + P0 降级

**Files:**
- Modify: `lib/brain/router.ts`
- Test: `tests/lib/brain/router.test.ts`

- [ ] **Step 1: 写测试 — 工具超时，LLM 选择替代方案**

mock callTool 返回 error，验证错误作为 observation 注入下一轮 think。

- [ ] **Step 2: 写测试 — MCP Server 不可用，降级 P0**

mock callTool 全部失败（Level 4），验证降级为线性总结。

- [ ] **Step 3: 实现 4 级错误处理**

在 ReAct 循环内：
- Level 1-3：错误信息作为 observation 注入 `"工具调用失败: {error}"` → LLM 下轮决策
- Level 4：退出循环，用已有结果走 P0 线性总结

- [ ] **Step 4: 运行测试**

```bash
npx vitest run tests/lib/brain/router.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/brain/router.ts tests/lib/brain/router.test.ts
git commit -m "feat(p1): ReAct error handling — 4 levels + P0 degradation fallback"
```

---

### Task 2.6: API Route 集成 + Storage 注入

**Files:**
- Modify: `app/api/chat/route.ts`

- [ ] **Step 1: 单例初始化 SQLiteStorage**

```typescript
let storage: SQLiteStorage | null = null
function getStorage(): SQLiteStorage {
  if (!storage) {
    storage = new SQLiteStorage()
    storage.initialize()
  }
  return storage
}
```

- [ ] **Step 2: 注入 RouterDeps 含 storage**

传 `storage: getStorage()` 给 processQuery。开发模式下返回 `result.trace`。

- [ ] **Step 3: 运行全部测试确认无回归**

```bash
npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat(p1): API route — inject storage, return trace in dev mode"
```

---

## Task Group 3: 置信度 + 意图提取

### Task 3.1: 真实意图提取

**Files:**
- Modify: `lib/brain/intent.ts`
- Test: `tests/lib/brain/intent.test.ts`

- [ ] **Step 1: 写测试**

验证 `extractIntentFromThinkResult()` 从 ThinkResult 提取 IntentTags + clarity。

- [ ] **Step 2: 实现**

新增 `extractIntentFromThinkResult(result: ThinkResult): { intent: IntentTags; clarity: ConfidenceLevel }`。从 think() 第一轮输出解析，保留 `computeIntentHash()` 不变。

- [ ] **Step 3: 运行测试**

```bash
npx vitest run tests/lib/brain/intent.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add lib/brain/intent.ts tests/lib/brain/intent.test.ts
git commit -m "feat(p1): real intent extraction from ThinkResult"
```

---

### Task 3.2: 真实置信度计算

**Files:**
- Modify: `lib/brain/confidence.ts`
- Test: `tests/lib/brain/confidence.test.ts`

- [ ] **Step 1: 写测试**

验证 `computeRealConfidence()` 从 verdict + clarity + LLM 自报计算三信号。

- [ ] **Step 2: 实现**

```typescript
export function computeVerdictConfidence(verdict: MemoryVerdict | null): ConfidenceLevel {
  if (!verdict || verdict.sampleCount < 3) return 'low'
  if (verdict.sampleCount >= 10) return 'high'
  return 'medium'
}
```

保留原 `computeConfidence()` 融合逻辑不变。

- [ ] **Step 3: 运行测试**

```bash
npx vitest run tests/lib/brain/confidence.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add lib/brain/confidence.ts tests/lib/brain/confidence.test.ts
git commit -m "feat(p1): real confidence signals — verdict + clarity + LLM self-report"
```

---

## Task Group 4: 结果自验证

### Task 4.1: validator.ts

**Files:**
- Create: `lib/brain/validator.ts`
- Test: `tests/lib/brain/validator.test.ts`

- [ ] **Step 1: 写测试**

```typescript
describe('validateResult', () => {
  it('检测负数数量', () => { /* quantity: -5 → warning */ })
  it('检测百分率超限', () => { /* rate: 150 → warning */ })
  it('检测未来日期', () => { /* date > today → warning */ })
  it('检测空结果', () => { /* items: [], total: 0 → warning */ })
  it('正常数据无警告', () => { /* totalEquipment: 128 → [] */ })
})
```

- [ ] **Step 2: 实现**

纯函数 `validateResult(data: unknown): ValidationResult[]`。递归检查数值字段、items 数组、日期字段。

- [ ] **Step 3: 运行测试**

```bash
npx vitest run tests/lib/brain/validator.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add lib/brain/validator.ts tests/lib/brain/validator.test.ts
git commit -m "feat(p1): result validator — numeric range, empty result, date checks"
```

---

## Task Group 5: 自学习 verdict

### Task 5.1: verdict.ts 评分引擎

**Files:**
- Create: `lib/brain/verdict.ts`
- Test: `tests/lib/brain/verdict.test.ts`

- [ ] **Step 1: 写测试**

验证：达到阈值触发计算、winner 选择正确、bonus 计算正确、feedback 权重 ×3。

- [ ] **Step 2: 实现**

```typescript
export async function maybeUpdateVerdict(
  storage: StorageInterface,
  llm: LLMProvider,
  tenantId: string,
  intentHash: string,
  threshold?: number,  // 默认 5，冷启动可传 3
): Promise<void>
```

逻辑：查 session 数→达阈值→LLM evaluate 每条→加权平均→找 winner→upsert verdict。

- [ ] **Step 3: 运行测试**

```bash
npx vitest run tests/lib/brain/verdict.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add lib/brain/verdict.ts tests/lib/brain/verdict.test.ts
git commit -m "feat(p1): verdict engine — evaluation trigger + winner calculation"
```

---

### Task 5.2: 冷启动脚本

**Files:**
- Create: `scripts/cold-start.ts`

- [ ] **Step 1: 实现批跑脚本**

读取 `docs/plan-a-p2-test-cases.md` 的 40 题 + 同义改写，逐题调用 processQuery，写入 session。

- [ ] **Step 2: 实现 verdict 触发**

批跑完成后，对所有 distinct intent_hash 调用 `maybeUpdateVerdict(threshold=3)`。

- [ ] **Step 3: 验证**

```bash
npx tsx scripts/cold-start.ts
# 检查 SQLite 中 sessions 和 verdicts 数据
```

- [ ] **Step 4: Commit**

```bash
git add scripts/cold-start.ts
git commit -m "feat(p1): cold-start script — test set batch run + verdict bootstrap"
```

---

### Task 5.3: Feedback API + UI

**Files:**
- Create: `app/api/feedback/route.ts`
- Modify: `app/components/ChatMessage.tsx`, `app/page.tsx`

- [ ] **Step 1: 实现 POST /api/feedback**

接收 `{ sessionId, feedback: 'up' | 'down' }`，调用 storage.updateSessionFeedback()。

- [ ] **Step 2: ChatMessage 加 Thumbs Up/Down 按钮**

在助手消息底部加两个小按钮，点击调用 /api/feedback。

- [ ] **Step 3: page.tsx 传递 sessionId**

API 返回 trace.traceId 作为 sessionId 标识，前端存储并传给 ChatMessage。

- [ ] **Step 4: Commit**

```bash
git add app/
git commit -m "feat(p1): Thumbs Up/Down feedback — API + UI buttons"
```

---

## Task Group 6: Grounding 标注

### Task 6.1: Sources 收集 + 展示

**Files:**
- Modify: `lib/brain/result-presenter.ts`
- Modify: `app/components/ChatMessage.tsx`

- [ ] **Step 1: result-presenter 加 sources 参数**

`buildStructuredResult()` 加 `sources` 参数。

- [ ] **Step 2: ChatMessage 展示数据来源**

在消息底部加灰色小字："数据来源：EAM 系统总览、故障报修记录"。

- [ ] **Step 3: Commit**

```bash
git add lib/brain/result-presenter.ts app/components/
git commit -m "feat(p1): Grounding — data source attribution in responses"
```

---

## Task Group 7: 端到端集成 + 验收

### Task 7.1: 全链路集成测试

**Files:**
- Modify: `tests/e2e/chat-flow.test.ts`

- [ ] **Step 1: 更新 e2e 测试**

验证 ReAct 循环、trace 返回、confidence 真实计算、sources 存在、validator 工作。

- [ ] **Step 2: 运行全部测试**

```bash
npx vitest run
```

- [ ] **Step 3: Commit**

```bash
git add tests/
git commit -m "feat(p1): e2e tests updated for ReAct + trace + confidence + grounding"
```

---

### Task 7.2: 40 题批跑验收

**Files:**
- Create: `scripts/benchmark.ts`

- [ ] **Step 1: 实现 benchmark 脚本**

跑 40 题测试集，收集每题的 trace，统计：准确率、平均轮次、平均延迟、置信度分布、错误率。

- [ ] **Step 2: 运行验收**

```bash
npx tsx scripts/benchmark.ts
```

验证成功标准：
- ReAct L4/L5 准确率 ≥92%
- 错误回答率 ≤3%
- 100% 查询有完整 trace
- 100% 回答有 sources

- [ ] **Step 3: Commit**

```bash
git add scripts/benchmark.ts
git commit -m "feat(p1): benchmark script — 40-question acceptance test"
```

---

### Task 7.3: 冷启动 + verdict 验证

- [ ] **Step 1: 运行冷启动**

```bash
npx tsx scripts/cold-start.ts
```

- [ ] **Step 2: 重跑 benchmark**

```bash
npx tsx scripts/benchmark.ts
```

- [ ] **Step 3: 对比准确率提升是否 ≥2pp**

- [ ] **Step 4: Final Commit**

```bash
git commit -m "feat(p1): P1 complete — ReAct Agent + verdict + confidence + validation + grounding + trace"
```

---

## Task Summary

| Group | Tasks | 核心产出 |
|-------|-------|---------|
| **1. 类型+Trace** | 1.1-1.4 | 新类型 + nl_traces 表 + TraceCollector + TracePanel |
| **2. ReAct Agent** | 2.1-2.6 | Prompt 模板 + think() + prompt-assembler + ReAct 循环 + 错误处理 + API 集成 |
| **3. 置信度+意图** | 3.1-3.2 | 真实意图提取 + 三信号真实计算 |
| **4. 结果自验证** | 4.1 | 数值/空结果/日期校验 |
| **5. 自学习 verdict** | 5.1-5.3 | verdict 引擎 + 冷启动 + Thumbs Up/Down |
| **6. Grounding** | 6.1 | Sources 收集 + 前端展示 |
| **7. 集成验收** | 7.1-7.3 | e2e 测试 + benchmark（含延迟阈值验证）+ 冷启动验证 |

Total: **17 个 Task，约 65 个 Step**。
