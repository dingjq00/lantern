# Insight68 NL-API 工程纪律审计报告

> **审计方 / 视角**：PlayCard 项目伙伴（Claude），以 [Superpowers v5.0.6](https://github.com/obra/superpowers) 14-Skill 工程体系为标准
>
> **审计对象**：insight68-platform 全代码库（截至 2026-03-27）
>
> **目的**：找出架构与工程纪律之间的差距，给出可落地的改进建议。请 insight68 伙伴综合分析，和 dingjq 一起决定采纳哪些。

---

## 一、总体评价

| 维度 | 评分 | 说明 |
|------|------|------|
| 架构设计 | **8/10** | 四层架构、ReAct 循环、三层评估、外部信号自学习 — 设计很扎实 |
| 代码质量 | **6/10** | 关注点分离好，但 24 ESLint error、17 处 any type、React purity violation |
| 测试覆盖 | **6/10** | 8 套单元测试质量不错，但核心路径有关键缺口 |
| 工程纪律 | **4/10** | 无 pre-commit hook、无 CI、无自动化验证管线 |
| 运维就绪 | **5/10** | SQLite + migration 好，但无结构化日志 / 无监控 / 无限流 |
| 文档 | **8/10** | Spec 文档优秀，API 文档和部署文档缺失 |

**一句话**：概念很强，纪律跟不上。架构是 8 分的，但工程纪律只有 4 分。

---

## 二、Superpowers 是什么

Superpowers 是 Jesse Vincent 写的 14 个 Skill 组成的 AI 工程纪律体系。核心有三条铁律：

1. **TDD**：`NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`
2. **Systematic Debugging**：`NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST`
3. **Verification**：`NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE`

以及一套完整的开发流水线：brainstorming → writing-plans → subagent-driven-development → finishing-branch。

详细学习指南见：`/Users/dingjq/projects/playcard/reports/superpowers-deep-dive.html`

---

## 三、对照三条铁律

### 3.1 TDD 铁律

**现状**：有 8 套测试、129 个 test case。verdict / confidence / intent / prompt-assembler / router 都有测试。

**问题**：

| 缺口 | 严重性 | 说明 |
|------|--------|------|
| `package.json` 没有 `test` script | 🔴 P0 | `npm test` 跑不了 |
| 无 pre-commit hook | 🔴 P0 | 没有机制阻止未测试代码提交 |
| `{{N.path}}` 参数引用解析 — 零测试 | 🔴 P0 | router 最复杂的逻辑，支撑工具链式调用 |
| Storage 层（SQLite CRUD / migration）— 零测试 | 🟡 P1 | 数据层无保护 |
| MCP server 连接/断开 — 零测试 | 🟡 P1 | 集成层无保护 |
| 跨域联合查询场景 — 零测试 | 🟡 P1 | 设备+维修+备件组合查询 |
| E2E 完整聊天流 — 基本为空 | 🟡 P2 | 端到端路径无保护 |

**Superpowers 判定**：❌ 严重违反。有测试但不是 TDD — 测试是事后补的。最危险的是 `{{N.path}}` 零测试。

**建议**：
```bash
# 1. 立即加 test script
# package.json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}

# 2. 给 {{N.path}} 写测试（最高优先级）
# tests/lib/brain/param-refs.test.ts

# 3. 加 pre-commit hook（husky + lint-staged）
```

---

### 3.2 Systematic Debugging 铁律

**发现的"静默失败"模式**：

| 位置 | 问题 | 风险 |
|------|------|------|
| `codex-proxy.ts:149-166` | Zod 校验失败 → catch 吞掉 → 返回 `finish: true` | LLM 返回格式错误时无任何诊断信息 |
| `router.ts:234` | Storage 写入失败 → catch 空处理 | Debug 时无法知道是否存储异常 |
| `router.ts:261` | Subagent evaluation 失败 → catch 空处理 | 评估层静默失效 |

**Superpowers 判定**：⚠️ 部分违反。多组件系统的每个边界应该有诊断日志（Phase 1 要求）。

**建议**：至少把 catch 块里的空处理改成 `console.warn`：

```typescript
// 不改逻辑，只加可见性
catch (err) {
  console.warn('[Storage] Session write failed:', err);
  // 仍然不影响响应
}
```

---

### 3.3 Verification 铁律

**现状**：

- 24 个 ESLint error 存在 → 说明没有人在"完成"前跑 linter
- 无 CI/CD → 所有"完成"声明都是基于信心而非证据
- `Date.now()` 在 React render 中调用（TracePanel.tsx:12）→ hydration mismatch

**Superpowers 判定**：❌ 违反。没有自动化验证 = "完成"声明无证据支撑。

**建议**：以后每次声称"完成"，必须贴输出：
```
✅ npm run lint → 0 errors, 0 warnings
✅ npm test → 129/129 pass
```

---

## 四、对照流程骨架

### 4.1 Brainstorming → ✅ 做得好

- `docs/specs/platform-design.md`（200+ 行）
- `docs/specs/self-learning-design.md`
- `docs/specs/p1-implementation-plan.md`

设计阶段有纪律。**但缺少 HARD-GATE 标记** — 没有形式化的"设计未获批不能写代码"检查点。

### 4.2 Writing-Plans → ⚠️ 有但不够细

现有计划的粒度偏大。Superpowers 标准要求：

- 每步 2-5 分钟
- 精确文件路径
- 完整代码（不写 TBD / "添加适当错误处理"）
- 每步先写测试

### 4.3 SDD (Subagent-Driven Development) → ❌ 未使用

所有代码看起来是在单一会话中顺序开发的。没有：

- 每个 task 独立 subagent 执行（干净上下文）
- Spec Review（"功能对不对？"）
- Code Quality Review（"代码好不好？"）

**后果**：17 处 `any` type — 这在 Code Quality Review 阶段会被立即抓出来。

### 4.4 Finishing Branch → ❌ 未使用

没有 git worktree 隔离。功能开发直接在主分支上。

---

## 五、6 个关键发现（按优先级）

### 发现 1：`{{N.path}}` 零测试 — 🔴 最危险

**位置**：`router.ts:281-316`（resolveArgRefs, navigatePath）

这是 router 最复杂的逻辑，支撑工具链式调用（Round 0 的结果被 Round 1 引用）。**而且解析失败时静默返回原始字符串** — 不报错、不日志、悄悄给 LLM 一个 `{{0.items[0].id}}` 字面量当参数。

**Iron Law 判定**：这段代码在生产中运行，没有任何测试保护。

**建议**：这是最高优先级。立即补测试：
```typescript
// tests/lib/brain/param-refs.test.ts
describe('resolveArgRefs', () => {
  test('解析 {{0.items[0].id}} 从前一轮结果', () => { ... });
  test('嵌套路径 {{0.data.equipment.name}}', () => { ... });
  test('引用不存在的路径 → 返回原始字符串 + warning', () => { ... });
  test('多个引用在同一参数中 {{0.a}} and {{1.b}}', () => { ... });
  test('无引用的字符串 → 原样返回', () => { ... });
});
```

---

### 发现 2：置信度计算缺陷 — 🔴 影响准确率

**位置**：`router.ts:205-210`

**当前逻辑**：所有 tool 调用成功 → confidence = high

**问题**："查设备故障" → 调了 `query_equipment`（成功）但应该调 `query_fault_reports` → confidence 仍然 high。

**Tool 成功 ≠ 结果相关。** 用户拿到了一个 high confidence 的错误回答。

Layer 2 subagent evaluator 能事后抓住这个问题，但用户已经看到了结果和置信度。

**建议**：考虑在 confidence 计算中加入 "intent-tool alignment" 信号 — 不一定需要 LLM，规则匹配即可（这正是你设计的 Layer 1 该做的事）。

---

### 发现 3：Verdict winner 选择靠频率不靠质量 — ⚠️

**位置**：`verdict.ts:54-61`

```typescript
const winnerKey = [...chainCounts.entries()]
  .sort((a, b) => b[1] - a[1])[0][0]
```

8/10 次用了同一个 tool chain，但 avg_score 才 0.6 — 这个 chain 还是会被选为 winner。

**建议**：加权用户反馈和 lesson 质量。`maybeUpdateVerdict` 里已经有 feedback 权重的雏形（line 22-48），但 winner 选择时没用上。

---

### 发现 4：Self-Learning Layer 1 设计好了没实现 — ⚠️

`self-learning-design.md` 定义了 Layer 1（keyword-field matching），但代码里只有 Layer 0（validator）和 Layer 2（subagent）。

**代价**：每个非 "good" 的结果都要花一次 LLM 调用走 Layer 2。Layer 1 是零 LLM 成本的规则层。

---

### 发现 5：LLM 调用无重试、无断路器 — ⚠️

**位置**：`codex-proxy.ts`

- 无指数退避重试（网络抖动 → 直接失败）
- 无断路器（LLM 服务挂了 → 持续请求）
- 无成本追踪（不知道花了多少 token/钱）

---

### 发现 6：24 ESLint error — ⚠️ 代码卫生

- 17 个 `any` type（主要在 benchmark page）
- 1 个 React purity violation（TracePanel.tsx:12 `Date.now()`）
- 13 个 unused variable warnings

---

## 六、CLAUDE.md 增补建议

以下内容建议加入 insight68 的 CLAUDE.md，基于 Superpowers 设计模式：

```markdown
## 工程纪律

### Iron Laws（不可违反）
- 改 router.ts / prompt-assembler.ts / verdict.ts 之前，必须先有失败测试
- 声称"完成"之前，必须贴 `npm test` + `npm run lint` 的实际输出
- Debug 同一个问题修了 3 次还没好 → 停下来跟 dingjq 讨论架构

### Rationalization Table
| 借口 | 现实 |
|------|------|
| "这个改动太小不用测" | 影响 NL-API 准确率的改动都要测 |
| "intent 太模糊了" | 给最佳猜测 + 置信度，让用户决定 |
| "源系统没有这个数据" | 先调 MCP tool 确认，不要猜 |
| "先提交再补测试" | 后补的测试证明不了任何东西 |
| "ESLint warning 不影响功能" | 17 个 any type 就是 17 个类型安全漏洞 |
| "应该好了" | "应该"不是证据。跑测试。 |

### Red Flags — STOP
- 准备提交但还没跑 test + lint
- 说"应该好了"但没贴验证输出
- 改了核心路径（router / verdict / prompt）但没加测试
- catch 里什么都不做（至少 console.warn）
- 同一个 bug 修了 3 次（质疑架构，不是继续修）
```

---

## 七、建议的优先级排序

| 优先级 | 项目 | 工作量 | 影响 |
|--------|------|--------|------|
| **P0** | 加 `npm test` script + pre-commit hook | 2h | 建立自动化验证基线 |
| **P0** | 给 `{{N.path}}` 补测试 | 3h | 保护核心路径 |
| **P0** | 修 24 ESLint error | 4h | 代码卫生 |
| **P1** | 静默 catch → 加 console.warn | 1h | 可诊断性 |
| **P1** | 实现 Self-Learning Layer 1 | 8h | 减少 LLM 成本 |
| **P1** | 结构化日志 + 错误监控 | 6h | 生产就绪 |
| **P2** | 置信度计算加 intent-tool alignment | 4h | 准确率提升 |
| **P2** | Verdict winner 加权 feedback | 3h | 自学习质量 |
| **P2** | LLM 调用重试 + 断路器 | 4h | 稳定性 |
| **P2** | API 文档 + 部署文档 | 4h | 可交付性 |

---

## 八、给 insight68 伙伴的说明

这份报告来自 PlayCard 项目的 Claude 伙伴，基于对 Superpowers 工程体系的深度学习。Superpowers 的标准偏高（它是为严肃的软件工程设计的），不是所有条目都需要立即采纳。

**建议的讨论重点**：

1. **P0 项（test script / `{{N.path}}` 测试 / ESLint）**— 这些应该没有争议，只是优先级排序问题
2. **Iron Laws 是否写进 CLAUDE.md** — 这会改变你的工作方式，需要 dingjq 确认
3. **Rationalization Table** — 条目是否准确？有没有其他常见借口需要加？
4. **SDD 是否适用** — 对 insight68 当前阶段来说，完整的 SDD 流程可能过重。但 Two-Stage Review（每个功能完成后做 Spec Review + Code Quality Review）值得考虑
5. **置信度计算缺陷** — 这是架构层面的问题，需要讨论修复方案

请综合你对项目的深度理解，跟 dingjq 一起决定采纳哪些建议。

---

*审计日期：2026-03-27*
*审计标准：[Superpowers v5.0.6](https://github.com/obra/superpowers) — 14 Skills 工程纪律体系*
*审计方：PlayCard 项目 Claude 伙伴*
