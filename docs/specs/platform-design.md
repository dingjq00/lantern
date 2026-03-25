# Insight68 NL-API Platform — 设计规格书

> 自然语言操作企业系统的通用平台。EAM 是第一个落地场景。

## 1. 系统定位

### 1.1 愿景

**企业系统的 Google 化** — 一个输入框搞定一切。用户不需要学会怎么用系统，只管说你要什么。

### 1.2 定位级别

C 级平台 — 不是 EAM 专用工具，而是"自然语言操作企业系统"的通用平台。EAM 是第一个场景，架构为"接入任何有 API 的企业系统"而设计。

### 1.3 交付形态

先独立 Web 验证完整链路，再扩展多端（Telegram Bot / 企业微信 / REST API）。引擎做好了，接入端只是适配层。

### 1.4 落地节奏

| 阶段 | 目标 | 核心产出 |
|------|------|---------|
| **P0 跑通** | EAM 查询场景端到端 | MCP Server(22 tools) + Web UI + 路由引擎 |
| **P1 强化** | 越用越准 | 记忆系统 + 自学习引擎 + 置信度回退 |
| **P2 平台化** | 从 EAM 专用变成通用 | 工具注册抽象 + Prompt 模板化 + 多系统接入 |
| **P3 规模化** | 50+ 工具 + 多端 | 向量预筛选 + 动态加载 + 多端接入层 |

---

## 2. 四层架构

```
┌─────────────────────────────────────────────────┐
│                  接入层 (Gateway)                 │
│         Web UI │ Telegram │ 企业微信 │ REST API    │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────┐
│                  智能层 (Brain)                    │
│  LLM 路由 │ 记忆系统 │ 自学习引擎 │ 结果呈现引擎    │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────┐
│              工具层 (Tool Registry)                │
│  YAML 声明式注册 │ 能力匹配 │ 质量排序 │ 错误处理   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            │
│  │EAM   │ │MES   │ │QMS   │ │ ...  │            │
│  └──────┘ └──────┘ └──────┘ └──────┘            │
└───────────────────────┬─────────────────────────┘
                        │ MCP 协议
┌───────────────────────┴─────────────────────────┐
│              数据层 (Data Sources)                 │
│  P0: EAM Service 层直连                           │
│  P2: GraphQL Federation（多系统统一数据访问）        │
│  底层: PostgreSQL │ MySQL │ SQL Server │ REST API  │
└─────────────────────────────────────────────────┘
```

### 2.1 层间职责

| 层 | 职责 | 依赖 | 扩展方式 |
|---|------|------|---------|
| **接入层** | 协议适配、用户认证、会话管理、结果格式化 | 智能层接口 | 加适配器 |
| **智能层** | 意图理解、路由决策、记忆、学习、结果呈现 | 工具层接口 + LLM Provider | 换/加模型 |
| **工具层** | 能力声明、匹配、MCP 执行、降级 | MCP 协议 | 加 YAML + Handler |
| **数据层** | 确定性查询、数据存储 | 各系统自有协议 | 加数据源连接 |

### 2.2 核心设计原则

- **每层只依赖下一层的接口，不依赖实现。**
- **平台独立于客户系统。** 平台自带存储，不寄生在客户数据库上。
- **扩展需要的工作量是诚实的。** 加一个新企业系统 = 工具层加 YAML + MCP Server + 智能层补充该域的 few-shot 示例和工具选择指南。接入层不改。

### 2.3 层间接口契约

```
Gateway → Brain:
  BrainService.process(
    userId: string,
    query: string,
    sessionId: string,
    context?: { preferences, history }
  ) → StructuredResult {
    answer: string,            // 自然语言回答
    data: any[],               // 结构化数据
    display: "text"|"table"|"chart",
    columns?: string[],
    followUp?: string[],       // 追问建议
    confidence: "high"|"medium"|"low"
  }

Brain → ToolRegistry:
  ToolRegistry.match(
    intentTags: { domains, operation, filters }
  ) → RankedTool[] {
    name: string,
    matchScore: number,
    quality: number,           // 含 verdict 加分
    inputSchema: object
  }

  ToolRegistry.execute(
    toolName: string,
    arguments: object
  ) → ToolResult {
    data: any,
    status: "success"|"partial"|"error",
    errorLevel?: 1|2|3|4
  }
```

---

## 3. 平台独立存储

### 3.1 架构

平台数据和客户系统数据完全隔离：

```
平台存储（随平台部署，独立于客户）
├── nl_memory_preferences    # 用户偏好
├── nl_memory_verdicts       # 路由判决
├── nl_memory_sessions       # 路由日志
├── nl_memory_feedback       # 用户反馈
├── nl_tool_registry         # 工具注册表
├── nl_users                 # 用户管理
└── 向量索引                   # 语义搜索

客户系统（MCP 协议访问，不直接碰库）
├── EAM (PostgreSQL)
├── MES (MySQL)
├── QMS (SQL Server)
└── ...
```

### 3.2 两档自适应

```
┌─────────────────────────────────────────┐
│     存储抽象层 (Storage Interface)        │
│     统一的 CRUD + Search API             │
└──────────┬──────────────┬───────────────┘
           │              │
  ┌────────┴───┐  ┌──────┴──────┐
  │  SQLite    │  │ PostgreSQL  │
  │+ sqlite-vec│  │ + pgvector  │
  │(开发/轻量)  │  │ (生产)      │
  └────────────┘  └─────────────┘
```

P0 用 SQLite 零依赖跑起来。生产部署切 PostgreSQL + pgvector。接口一致，业务代码不改。

---

## 4. 工具层

### 4.1 YAML 声明式工具注册

每个工具一个 YAML 文件，声明能力、参数、示例、关系：

```yaml
# tools/eam/query_equipment.yaml
name: query_equipment
description: "按条件查询设备列表，支持按产线/分类/状态/位置筛选"
version: 1.0.0
system: eam                        # 所属系统
domains: [equipment]               # 数据域

operation: list                    # list | detail | statistics | trend | alert | mutation
supports_filters:                  # 支持的筛选维度
  - production_line
  - status
  - category
  - location
  - department
  - keyword
returns:                           # 输出字段
  - equipment_id
  - equipment_name
  - status
  - category
  - location

feeds_into:                        # 该工具的结果可以喂给谁
  - get_equipment_detail
  - query_fault_reports
  - query_maintenance_tasks
depends_on: []                     # 该工具不依赖其他工具

quality: 50                        # 质量分（正=通用，负=专用）
cost: low                          # low | medium | high

inputSchema:                       # MCP 标准参数
  type: object
  properties:
    keyword: { type: string }
    status: { type: integer, enum: [0,1,2,3,4,5,6,7] }
    productionLineId: { type: string }
    categoryId: { type: integer }
    locationId: { type: integer }
    deptId: { type: integer }
    isKey: { type: integer, enum: [0,1] }

examples:                          # per-tool 调用示例
  - query: "A线有多少台设备"
    arguments: { productionLineId: "A线" }
  - query: "当前维修中的设备"
    arguments: { status: 2 }

when_to_use: "查询设备列表、按条件筛选设备、获取产线下的设备"
when_not_to_use: "查单台设备详情用 get_equipment_detail"
```

### 4.2 能力匹配服务

工具层对外暴露 `ToolRegistry.match(intentTags) → RankedTool[]` 接口，由智能层调用（见 Section 5.1 完整路由流程）。

改编自 Firecrawl 引擎瀑布流：

**matchScore 计算规则**（满分 100）：

| 维度 | 分值 | 计算方式 |
|------|------|---------|
| domain 匹配 | 40 | 二元：工具 domains 与意图 domains 有交集 = 40，无交集 = 0 |
| operation 匹配 | 30 | 二元：工具 operation 与意图 operation 一致 = 30 |
| filter 覆盖 | 20 | 比例：意图要求的 filters 中，工具 supports_filters 覆盖了多少。如意图要 2 个 filter，工具支持其中 1 个 = 20×(1/2)=10 |
| 链路价值 | 10 | 二元：工具 feeds_into 包含意图后续可能需要的工具 = 10 |

**入围阈值**：matchScore ≥ 50（即满分的 50%）。

**排序优先级**：matchScore 降序 → (quality + verdict 加分) 降序 → cost 升序。

**P0 简化**：22 个工具全量注入 Prompt，不做匹配裁剪。match 接口存在但返回全部工具。P2/P3 启用真正的匹配 + Top-K 筛选（默认 K=10）。

### 4.3 工具扩展流程

新增一个企业系统（如 MES 排产）：

```
工具层:
  1. 创建 tools/mes/ 目录
  2. 编写各工具的 YAML 声明文件
  3. 实现 MCP Server handler（确定性查询逻辑）

智能层（必要的配套更新）:
  4. 补充该域的 few-shot 编排示例（如 MES 排产链路的典型多步模式）
  5. 更新工具选择指南（新域的路由策略）

接入层: 不改。
```

**诚实说明**：加新系统不是零成本——YAML + Handler 是主体工作量，但 few-shot 和选择指南的更新不可省略，否则新域的路由准确率会偏低。这是方案 A 实验的核心发现：Prompt 中的指南和示例贡献了 99% 的准确率提升。

### 4.4 错误处理

```
MCP 工具执行
    ↓
Level 1 可重试:
  网络超时 / 连接断开 / 429 限流
  → 自动重试（最多 2 次，指数退避）

Level 2 可降级:
  工具返回空数据 / 部分数据
  → 用已有数据生成部分回答
  → 提示用户"部分信息获取失败"

Level 3 可替代:
  特定工具不可用
  → 查 YAML 的 feeds_into 找替代路径
  → 用备选工具重试

Level 4 不可恢复:
  认证失败 / 系统离线 / 未知错误
  → 通知用户"该系统暂时不可用"
  → 记录日志
```

---

## 5. 智能层

### 5.1 完整路由流程（唯一权威描述）

这是用户查询到结果返回的完整链路。智能层编排，工具层提供匹配和执行服务。

```
用户查询 (from Gateway)
    ↓
┌─ 智能层 ─────────────────────────────────────────────┐
│                                                       │
│  Step 1: 意图提取（LLM 轻量调用）                       │
│    → {domains, operation, filters, intent_hash}        │
│                                                       │
│  Step 2: 工具匹配（调用 ToolRegistry.match）            │
│    → RankedTool[]（见 Section 4.2 匹配算法）            │
│                                                       │
│  Step 3: 记忆注入                                      │
│    → 查 verdicts 表: intent_hash → 历史最优路径          │
│    → 向量搜索 sessions 表: 相似历史查询（可选）           │
│    → verdict winner 工具获得 +25/+50 quality 加分       │
│                                                       │
│  Step 4: Prompt 动态组装                                │
│    基础指令（规则 + 时间映射 + 工具选择指南）              │
│    + 匹配到的工具描述（从 YAML 动态生成）                 │
│    + per-tool 示例（从 YAML examples 字段）              │
│    + few-shot 编排示例（覆盖当前系统的核心多步模式）       │
│    + 记忆上下文（verdict 推荐的路径，可选）               │
│                                                       │
│  Step 5: LLM 路由决策                                  │
│    Provider.route(assembled_prompt, matched_tools)     │
│    → {"calls": [...], "confidence_signals": {...}}     │
│                                                       │
│  Step 6: 置信度判断（见 Section 5.5）                   │
│    high   → Step 7                                     │
│    medium → Step 7 + 标记待确认                         │
│    low    → 反问用户，不执行                              │
│                                                       │
│  Step 7: 执行（调用 ToolRegistry.execute，逐步）         │
│    → 多步调用时，前一步结果注入后一步参数                  │
│    → 错误按 Level 1-4 处理（见 Section 4.4）            │
│                                                       │
│  Step 8: 结果呈现（见 Section 5.6）                     │
│    Provider.summarize(data, question, format_hint)     │
│    → StructuredResult 返回 Gateway                      │
│                                                       │
│  Step 9: 异步日志                                      │
│    → 写入 sessions 表（路由决策 + 工具结果）              │
│    → 触发自学习冷路径（见 Section 5.4）                  │
│                                                       │
└───────────────────────────────────────────────────────┘
```

**与实验阶段 V4 Prompt 的关系**：V4 的结构（规则 + 选择指南 + few-shot + 工具描述）完全保留，只是从静态文本变成动态组装。新增的是 Step 2 匹配和 Step 3 记忆注入——P0 阶段匹配返回全部工具、记忆为空，等价于 V4 原始行为。

### 5.2 LLM 提供者抽象

```
┌──────────────────────────────────┐
│      LLM Provider Interface      │
│                                  │
│  route(prompt, tools) → calls[]  │
│  evaluate(input) → score         │
│  summarize(data, question) → text│
└──────┬───────┬───────┬───────┬──┘
       │       │       │       │
   codex    OpenAI   Claude   Local
   proxy    API      API      Ollama
   (P0)    (付费)   (付费)   (未来)
```

三个方法覆盖全部 LLM 需求：

```
route(
  prompt: string,          // 组装好的完整 Prompt
  tools: ToolSchema[]      // 匹配到的工具 schema
) → { calls: ToolCall[], confidence_signals: object }

evaluate(
  question: string,        // 用户原始查询
  toolChain: string[],     // 路由选择的工具链
  resultSummary: string    // 工具返回的数据摘要
) → { relevance: 1-5, completeness: 1-5, efficiency: 1-5 }

summarize(
  data: any,               // 工具返回的结构化数据
  question: string,        // 用户原始问题
  formatHint: string       // "single_value" | "list" | "timeseries" | "multi_step"
) → { answer: string, display: string, columns?: string[], followUp?: string[] }
```

- **route** — 热路径，用 mini 级模型
- **evaluate** — 冷路径（自学习），用 mini
- **summarize** — 热路径，用 mini

P0 只实现 codex-proxy adapter。切换 LLM = 加一个 adapter 文件。

### 5.3 记忆系统

基于 OpenClaw 记忆模式适配，使用平台独立存储（非文件）：

#### 三层记忆

| 层 | 存什么 | 生命周期 | 检索方式 | 存储表 |
|---|--------|---------|---------|--------|
| **持久层** | 用户偏好（"我通常关心 A 线"）、系统配置 | 长期不变 | user_id 直接读 | nl_memory_preferences |
| **经验层** | 每类查询模式的最优工具 + 参数模板 | 长期，置信度衰减 | intent_hash 精确匹配 | nl_memory_verdicts |
| **会话层** | 路由日志、用户反馈 | 时间衰减（半衰期 30 天） | 向量 + 关键词混合搜索 | nl_memory_sessions |

#### 路由时的记忆注入

```
用户: "A 线上月维修用了哪些备件？"
    ↓
1. 意图提取 → intent_hash
2. 查 verdicts 表: 该 hash 历史最优路径是 equipment → repair_orders → repair_detail
3. 向量搜索 sessions 表: 找到语义相似的历史查询
4. 注入 Prompt: "历史经验：类似查询的最优路径是 [...]"
    ↓
LLM 路由（有经验参考，准确率更高）
```

### 5.4 自学习引擎

改编自 Firecrawl Engpicker 模式：

#### 热路径（实时，< 2s）

```
用户查询 → 查 verdict (250ms 超时) → 匹配+路由 → MCP 执行 → 返回结果
                                                      ↓
                                               写入 session 日志
```

#### 冷路径（异步后台）

```
触发条件:
  • 同类查询累积 5 条日志
  • 定时扫描（每小时）
  • 用户显式反馈（"这个结果不对"）
    ↓
质量评估 (LLM Provider.evaluate):
  输入: 用户原始查询 + 路由选择的工具链 + 工具返回数据摘要
  评分维度（1-5 分）:
    S1 相关性 — 返回的数据跟问题相关吗？ （权重 0.5）
    S2 完整性 — 回答了问题的所有方面吗？ （权重 0.3）
    S3 效率性 — 调用链路是否有冗余？     （权重 0.2）
  综合分 = S1×0.5 + S2×0.3 + S3×0.2
    ↓
Verdict 计算:
  同一 intent_hash 下按路由路径分组
  每组取平均综合分，最高分组 = winner
  置信度 = f(样本量, 分数差距, 时间衰减):
    样本 < 3:  confidence = low    → 不写 verdict
    样本 3-10: confidence = medium → winner +25 quality
    样本 > 10 且领先 > 0.5 分:
               confidence = high   → winner +50 quality
```

#### intent_hash 生成

```
用户查询: "A 线上月维修用了哪些备件？"
    ↓ LLM 提取结构化意图
{domains: ["equipment","fault_repair"], operation: "list",
 filters: ["production_line","date_range"], target: "spare_usage"}
    ↓ 字段排序 + hash
intent_hash = sha256("domains=equipment,fault_repair|op=list|...")
```

相似查询（"B 线本月维修消耗的备件"）得到**同一个 hash**——结构化意图一致，参数值不同。

#### 安全护栏

- Verdict **只加分不减分** — 最坏情况回到默认排序
- 单次加分**上限 +50** — 不会压倒性碾压其他工具
- **自动过期** — 30 天无新样本的 verdict 置信度降级
- **人工覆盖** — 管理员可手动标记 verdict 为 invalid
- **冷启动安全** — 无 verdict 时完全靠基础质量分 + 匹配

### 5.5 置信度回退

#### 三信号融合

```
信号 1: 工具匹配分 (Tool Match Score)
  top-1 工具 matchScore:
    > 80% 加权优先级  → high
    50-80%           → medium
    < 50%            → low

信号 2: Verdict 置信度 (Historical Confidence)
  该 intent_hash 有 verdict 吗:
    high confidence verdict   → high
    medium 或无 verdict       → medium
    有 verdict 但历史评分低    → low

信号 3: 查询清晰度 (Query Clarity)
  LLM 提取意图时的确定性:
    单一明确意图              → high
    可能有歧义但可推断         → medium
    多重理解 / 缺关键信息      → low
```

#### 决策矩阵

| 综合置信度 | 条件 | 行为 |
|-----------|------|------|
| **high** | 3 个信号均 high | 直接执行 |
| **medium** | 任意 2 个 medium+ | 执行 + 提示"这是我的理解，对吗？" |
| **low** | 任意 1 个 low | 不执行，反问澄清（给选项） |

#### 反问对话设计

```
Low confidence:
  用户: "那个设备的情况怎么样？"
  系统: "请问您想了解哪方面？
    1. 设备当前运行状态和 KPI
    2. 最近的故障维修记录
    3. 保养执行情况
    4. 全生命周期事件"
  用户: "2"
  系统: → 走 fault_repair 域, confidence 升 high
        → 写入偏好记忆: 该用户问"设备情况"时偏好故障维修

Medium confidence 反馈:
  系统: "这是 A 线上月的故障统计。这是您想要的吗？"
  用户: "不是，我想看保养完成率"
  系统: → 切换 maintenance 域重新执行
        → 记录反馈: fault_repair 路径 -1, maintenance 路径 +1
        → 累积样本后更新 verdict
```

### 5.6 结果呈现引擎

```
MCP 工具返回原始数据
    ↓
数据类型识别:
  单值      → 直接回答
  列表      → 表格
  时序      → 趋势描述（P1: 图表）
  多步结果  → 综合分析
    ↓
LLM Provider.summarize(data, question, format_hint)
    ↓
输出结构化中间格式:
  {
    "answer": "A线上月共使用12种备件，总成本¥45,200...",
    "data": [{备件明细}],
    "display": "table",
    "columns": ["备件名称", "使用数量", "单价", "小计"],
    "follow_up": ["要看各备件成本占比吗？", "要对比上上月的消耗吗？"]
  }
    ↓
接入层按端格式化:
  Web      → 交互表格 + 文字 + 追问按钮
  Telegram → 纯文字摘要 + 简化表格
  API      → JSON
```

**关键**：呈现引擎输出结构化中间格式，不是最终 HTML。渲染由接入层做，同一结果在不同端有不同呈现。

### 5.7 调查型 Agent（架构预留）

当前路由是一次规划模式。预留 Agent 循环扩展点：

```
LLM 路由输出 calls[]
    ↓
calls 包含 {"tool": "__continue__"} ?
    │                    │
    No                   Yes（P1 启用）
    ↓                    ↓
  按序执行返回       执行当前步骤 → 结果注入上下文 → LLM 再次决策
                    循环直到无 __continue__ 或达到最大轮次(5)
```

P0 不实现循环。P1 启用时只在路由引擎加循环判断，工具层和接入层不改。

---

## 6. 扩展路线图

基于行业调研和实验数据，明确各阶段的技术演进：

### 6.1 工具数量扩展

| 工具数 | 触发条件 | 技术方案 | 参考项目 |
|--------|---------|---------|---------|
| **< 30** | P0-P1 | 全量注入 Prompt（已验证 94.2%） | 当前方案 |
| **30-50** | 新系统接入 | 向量预筛选 → Top-10 注入 | Semantic Router (3.4k★) |
| **50-80** | 多系统并行 | 动态工具加载，启动基础集按需展开 | GitHub MCP Server |
| **100+** | 平台规模化 | 渐进式发现（发现→元数据→执行 3 级） | SAP OData MCP (114★) |

### 6.2 P0 架构预埋

即使 P0 全量注入，以下设计为未来扩展预埋接口：

| 预埋点 | P0 状态 | 未来启用方式 |
|--------|--------|------------|
| YAML 能力标签 | 写了但不用于匹配 | P2 启用匹配算法 |
| intent_hash | 生成并存储 | P1 启用 verdict 查询 |
| 向量索引 | 对工具描述建索引 | P2 启用 Top-K 筛选 |
| 存储抽象层 | SQLite 实现 | 生产切 PostgreSQL |
| Agent 循环 | 代码路径存在，不触发 | P1 启用 __continue__ |

### 6.3 数据层演进

| 阶段 | 数据访问方式 | 适用场景 |
|------|------------|---------|
| **P0** | EAM 现有 Service 层直连 | 单系统 |
| **P2** | GraphQL Federation | 多系统统一网关 |

---

## 7. 实验数据基础

本设计基于 2026-03-25 的 8 个方案对比实验：

| 方案 | D1 召回 | D2 精确 | 全对 | 结论 |
|------|---------|---------|------|------|
| 扁平 V1 | 39.6% | 36.7% | 10/40 | 基线 |
| 扁平 V2 (修复) | 72.5% | 80.4% | 23/40 | Prompt 是主要杠杆 |
| 扁平 V2 (gpt-5.4) | 73.1% | 75.3% | 24/40 | 模型升级无显著收益 |
| 扁平 V3 (few-shot) | 77.3% | 80.6% | 27/40 | few-shot 定向有效 |
| **扁平 V4 (完整版)** | **94.2%** | **95.0%** | **36/40** | **选定方案** |
| 分层 V1 | 81.2% | 85.7% | 22/40 | 任务翻译丢信息 |
| 分层 V2 (优化) | 90.5% | 91.9% | 29/40 | 改善但仍不如扁平 |
| 混合 | 87.1% | 86.8% | 27/40 | 分类器引入额外错误 |

**关键结论**：
- Prompt 贡献 99% 的提升，模型贡献 1%
- 22 个工具规模下扁平最优
- gpt-5.4-mini 足够，无需更贵模型

**行业验证**：
- dbt: 语义层路由 83% vs 裸 SQL 40%
- Anthropic: per-tool 示例 72% → 90%
- OpenAI: 建议工具数 < 20
- Paragon: 我们的 94.2% 超越其基准测试中所有模型

---

## 8. 设计决策记录

| # | 决策 | 理由 | 数据依据 |
|---|------|------|---------|
| 1 | LLM 不碰 SQL | SQL 生成失败率太高 | Spider 2.0: 23%, dbt: SQL 路径仅 40% |
| 2 | MCP 作为工具协议 | 标准化、LLM 解耦、多端复用 | 行业趋势，Google/Microsoft/SAP 均采用 |
| 3 | 扁平路由（当前） | 94.2% > 分层 90.5%，调用少一半 | 8 方案对比实验 |
| 4 | gpt-5.4-mini | 模型升级仅 +0.6pp | R2 vs R3 对比 |
| 5 | 否决分层/混合 | 调度层翻译损耗 > 域专精收益 | 分层 V1/V2 + 混合实验 |
| 6 | 声明式 YAML 注册 | 加工具不改代码 | Firecrawl + Google Toolbox 模式 |
| 7 | Verdict 只加分不减分 | 安全降级，最坏回到默认 | Firecrawl Engpicker 设计 |
| 8 | 平台独立存储 | 不依赖客户数据库 | C 级平台需求 |
| 9 | SQLite/PG 两档 | 零依赖开发，生产可切换 | 降低起步门槛 |
| 10 | 结果呈现用中间格式 | 一次生成，多端适配 | 先 Web 后多端的交付策略 |

---

## 9. 安全与多租户

### 9.1 认证

| 阶段 | 方式 | 说明 |
|------|------|------|
| **P0** | API Key | 平台生成 API Key，每个用户/集成一个。最简启动 |
| **P1** | JWT Token | 支持用户名密码登录，签发 JWT |
| **P2** | SSO/OAuth2 | 对接企业 AD/LDAP/OIDC，单点登录 |

### 9.2 授权

每个用户关联可访问的系统和工具：

```
nl_users
  ├── user_id
  ├── auth_type: "api_key" | "jwt" | "sso"
  ├── allowed_systems: ["eam"]          # 可访问的系统
  ├── allowed_tools: ["*"] 或 [具体列表]  # 可用的工具（默认该系统全部）
  └── role: "viewer" | "operator" | "admin"
```

工具匹配时自动过滤：用户只能看到 `allowed_systems` 和 `allowed_tools` 范围内的工具。

### 9.3 多租户隔离

平台存储的所有表都带 `tenant_id`：

- verdicts、sessions、preferences、feedback 按 tenant_id 隔离
- 租户 A 的学习经验不会影响租户 B
- P0 单租户，tenant_id 固定为 "default"。P2 启用多租户

### 9.4 数据安全

- 平台**不存储客户业务数据**，只存路由日志和元数据
- sessions 表的 result_summary 字段存数据摘要（非原始数据），可配置为不存储
- 所有 LLM 调用走 codex-proxy/API，不向第三方传输客户数据
- MCP 工具的认证凭据由工具层管理，不经过智能层

---

## 10. 部署与运维

### 10.1 部署架构

```
P0 最简部署（单机）:
┌─────────────────────────────┐
│  单进程                      │
│  ├── Web Server (接入层)      │
│  ├── Brain Service (智能层)   │
│  ├── Tool Registry (工具层)   │
│  ├── MCP Client              │
│  └── SQLite (平台存储)        │
└──────────┬──────────────────┘
           │ MCP (stdio/HTTP)
┌──────────┴──────────────────┐
│  EAM MCP Server (独立进程)    │
│  └── → EAM Service 层        │
└─────────────────────────────┘
```

P0 全部在一台机器上。MCP Server 作为独立进程通过 stdio 或 HTTP 与平台通信。

### 10.2 MCP Server 管理

| 方面 | 设计 |
|------|------|
| 启动方式 | 平台启动时自动拉起配置的 MCP Server 进程 |
| 健康检查 | 定时调用 MCP `ping`，连续 3 次失败标记不可用 |
| 不可用处理 | 对应工具标记为 unavailable，匹配时跳过，用户提示"该系统暂时不可用" |
| 日志 | MCP Server 日志独立输出，平台日志记录调用耗时和错误 |

### 10.3 自学习冷路径调度

| 方面 | P0 | 生产 |
|------|-----|------|
| 调度方式 | 进程内定时器（每小时） | 消息队列 / Cron Job |
| 触发条件 | 同类查询累积 5 条 或 定时扫描 | 同左 + 用户反馈事件 |
| 并发控制 | 单线程串行 | Worker 池 |

### 10.4 监控指标

| 指标 | 说明 |
|------|------|
| route_latency_p95 | 路由决策耗时（目标 < 2s） |
| tool_execution_latency | MCP 工具执行耗时 |
| routing_accuracy | 用户反馈计算的实际准确率 |
| verdict_coverage | 有 verdict 的查询占比 |
| confidence_distribution | high/medium/low 的比例 |
| llm_token_usage | LLM 调用的 token 消耗 |
