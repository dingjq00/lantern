# 自学习系统设计方案

> **核心理念：** 学习信号来自外部，不来自 AI 自己。正确的积累反而没那么重要，从错误中学习才有价值。

---

## 1. 问题回顾

### 已验证无效的方案

| 方案 | 失败原因 |
|------|---------|
| verdict（记 winner 工具链） | 60% 准确率下积累 40% 错误经验，垃圾进垃圾出 |
| AI 自评 lesson | 循环论证——同一个脑子、同一个上下文评自己，检测不出自己的盲区 |

### 根因

自学习难的不是学习算法，是**标注难**——怎么知道什么是对的、什么是错的、错在哪里。

---

## 2. 四层检测架构

从低成本到高成本，从简单到深度，逐层递进：

```
用户查询 → AI 规划+执行 → 工具返回数据
                              ↓
                    ┌─── 层 0: 数据质量检测 ───┐
                    │  纯规则，零 LLM 成本      │
                    │  数值异常/空结果/日期错误  │
                    └──────────┬───────────────┘
                               ↓
                    ┌─── 层 1: 关联性检测 ──────┐
                    │  规则+关键词，零 LLM 成本  │
                    │  返回数据字段 vs 问题意图   │
                    │  "工具返回值即信号"         │
                    └──────────┬───────────────┘
                               ↓ (层 0/1 发现异常时才触发)
                    ┌─── 层 2: 隔离 subagent ───┐
                    │  独立上下文，1 次 LLM 调用  │
                    │  generator + evaluator 架构 │
                    │  只看问题+数据，不看推理过程 │
                    └──────────┬───────────────┘
                               ↓ (任何时候都可触发)
                    ┌─── 层 3: 用户反馈 ────────┐
                    │  零成本，最可靠             │
                    │  Thumbs down → 覆写 lesson │
                    └──────────────────────────┘
```

### 层间关系

- 层 0 和层 1 **每次请求都跑**（零成本，纯规则）
- 层 2 **按需触发**（层 0/1 发现异常时）
- 层 3 **用户主动触发**（随时可用）
- 每层都可以独立产出 lesson，后层的 lesson 优先级高于前层

---

## 3. 各层详细设计

### 层 0: 数据质量检测

**状态：** 已实现（`lib/brain/validator.ts`）

**检测内容：**

| 检查项 | 规则 | 输出 |
|--------|------|------|
| 数值范围 | 百分率 ∈ [0,100]，数量 ≥ 0 | warning |
| 空结果 | items=[] 或 total=0 | warning |
| 日期异常 | 日期在未来 | warning |

**产出：** `ValidationResult[]`，已写入 trace。

**局限：** 只检查数据本身是否合理，不检查数据是否回答了问题。

---

### 层 1: 关联性检测（工具返回值即信号）

**状态：** 待实现

**核心思路：** 比较返回数据的"主题"和用户问题的"主题"是否匹配。

**检测方式（纯规则，不用 LLM）：**

#### 1.1 意图-域匹配

从 think() 首轮提取的 intent.domains 和实际调用的工具的 domains 对比：

```
用户意图 domains = [maintenance]
实际工具 domains = [equipment]
→ 不匹配！标记：域偏移
```

#### 1.2 关键词-字段匹配

从用户查询中提取关键词，检查返回数据是否包含相关字段：

```
关键词映射表（可配置）：
  "保养" → [maintenanceRate, scheduledDate, completedDate, planName, taskId]
  "故障" → [faultType, faultReportId, reportTime, description]
  "备件" → [spareId, spareName, quantity, safetyStock]
  "工时" → [repairHours, laborRecords, worker, hours]
  "库存" → [currentStock, safetyStock, shortage, warehouseId]

用户问 "保养执行率"
返回数据字段: [equipmentId, name, code, status, category]
匹配度: 0/5 → 不匹配！标记：字段缺失
```

#### 1.3 空结果区分

空结果有两种：

```
A. 真没有数据（合理）— 查上月故障，确实没有故障 → 不标记
B. 选错工具（异常）— 查保养记录但调了设备查询工具 → 标记

区分方式：
  如果 意图-域匹配 且 空结果 → A（真没有）
  如果 意图-域不匹配 且 空结果 → B（选错了）
```

**输出：**

```typescript
interface RelevanceCheckResult {
  relevant: boolean                    // 总体是否相关
  domainMatch: boolean                 // 意图域 vs 工具域 是否匹配
  fieldCoverage: number                // 关键词字段覆盖率 0-1
  missingDomains: string[]             // 缺失的域
  missingFields: string[]              // 缺失的关键字段
  recommendation: 'pass' | 'review' | 'fail'
}
```

**触发 lesson 的条件：**
- `recommendation = 'fail'` → 自动写 lesson
- `recommendation = 'review'` → 触发层 2 subagent 深度检查

---

### 层 2: 隔离 subagent 评估

**状态：** 待实现（P1.5）

**触发条件：** 层 1 返回 `recommendation = 'review'`

**架构：** Anthropic generator + evaluator 模式，用 `context: fork` 隔离

```
主 Agent (generator):
  完成查询 → 拿到结果 → 触发 evaluator

fork subagent (evaluator):
  输入：用户原始问题 + 工具返回数据（不含推理过程）
  任务：判断数据是否回答了问题
  输出：通过/不通过 + 原因 + 缺失信息
```

**evaluator 的 prompt（专用，和路由 prompt 完全不同）：**

```
你是结果质量评估员。你不知道 AI 是怎么选工具的，也不需要知道。
你只需要判断：给定的数据能回答用户的问题吗？

用户问题: "{query}"
返回数据: {data}

请回答：
1. 数据中是否包含回答问题所需的核心信息？（是/否）
2. 如果否，缺少什么？（具体说明）
3. 数据中是否有与问题无关的信息？（是/否）
4. 综合评估：good / partial / bad

返回 JSON:
{"quality": "good|partial|bad", "reason": "...", "missing": ["..."], "lesson": "一句话总结"}
```

**为什么有效（vs 之前的 AI 自评）：**

| 之前的 AI 自评 | 隔离 subagent |
|-------------|-------------|
| 看到了自己的推理过程 → 偏见 | 只看问题和数据 → 客观 |
| 路由 prompt + 评估任务混合 | 专用评估 prompt |
| 同一上下文 | 干净的隔离上下文 |
| 评估难度 = 路由难度 | 评估难度 < 路由难度（匹配 vs 选择） |

**成本：** 1 次 LLM 调用 / 触发。预计 10-20% 的请求会触发（层 1 过滤后）。

---

### 层 3: 用户反馈

**状态：** UI + API 已就绪，未和 lesson 打通

**机制：**

```
用户点 👎 → POST /api/feedback { sessionId, feedback: 'down' }
         → 查 session 的 intentHash + toolChain
         → 写 lesson: quality='bad', source='user_feedback'
         → 优先级最高，覆写层 1/2 的 lesson
```

**扩展（P2）：**
- 点 👎 后弹出简单选项："工具选错了 / 数据不完整 / 回答不准确 / 其他"
- 用户选择直接变成 lesson.errorReason

---

## 4. Lesson 数据模型

```typescript
interface Lesson {
  intentHash: string
  tenantId: string
  query: string
  selectedTools: string[]
  quality: 'good' | 'partial' | 'bad'
  errorReason?: string
  betterPath?: string[]
  lesson: string
  source: 'validator' | 'relevance' | 'subagent' | 'user_feedback'
  createdAt: Date
}
```

**写入规则：**
- 同 intentHash + tenantId 只保留最新一条（upsert）
- source 优先级：`user_feedback > subagent > relevance > validator`
- 高优先级覆写低优先级

**读取/注入：**
- 下次同 intentHash 查询时，在观察注入中加入 lesson
- 注入格式：`"历史教训：上次类似查询选了 X 结果不好，因为 Y"`

---

## 5. 实施计划

### Phase 1（现在）: 层 1 关联性检测

- 新建 `lib/brain/relevance-checker.ts`
- 实现意图-域匹配 + 关键词-字段匹配
- 在 router 中 summarize 前调用
- 结果写入 trace + 自动生成 lesson（quality = fail 时）
- 纯规则，零 LLM 成本

### Phase 2（P1.5）: 层 2 subagent evaluator

- 设计 evaluator prompt
- 实现 fork subagent 调用（或 独立 LLM 调用 with 独立 prompt）
- 层 1 review 时触发
- 结果生成 lesson

### Phase 3（P1.5）: 层 3 反馈打通

- thumbs down → 查 session → 写 lesson
- lesson 注入到下次同类查询

### Phase 4（P2）: 反馈增强

- 👎 后弹选项（选错工具/不完整/不准确）
- Ground Truth 自动注入（测试阶段）

---

## 6. 预期效果

| 层 | 能抓到的问题 | 示例 |
|----|-----------|------|
| 层 0 | 数据本身异常 | 百分率 > 100，数量为负 |
| 层 1 | 选错方向 | 问保养返回设备信息 |
| 层 2 | 选对方向但不完整 | 问维修成本只返回工单列表没有备件工时 |
| 层 3 | 任何 AI 检测不到的错误 | 回答逻辑正确但不是用户想要的 |

**串联效果：**
- 层 0+1 零成本覆盖 60-70% 的错误检测
- 加层 2 提升到 85-90%
- 加层 3 提升到 95%+
- 每层积累的 lesson 让下次同类查询更准

---

## 7. 架构原则回顾

1. **学习信号来自外部** — 层 0/1 来自数据客观事实，层 2 来自隔离评估，层 3 来自用户
2. **从错误中学习** — 只存 quality != good 的 lesson
3. **成本递进** — 零成本规则先行，LLM 按需触发
4. **隔离消除偏见** — subagent 不知道路由过程，只看结果
5. **用户反馈是最高权威** — 覆写一切自动判断
