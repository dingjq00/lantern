# 行业实践与生态调研

> 2026-03-25 三路并发调研成果

## 1. 核心验证：我们的方向是对的

调研后最重要的结论——**行业正在收敛到我们选择的同一模式**：

| 我们的决策 | 行业验证 |
|-----------|---------|
| LLM 路由 + 确定性执行，不碰 SQL | dbt 报告语义层路由 **83%** vs 裸 SQL 生成 **40%**。Cube.dev、Snowflake Cortex 全走约束 API 路由 |
| 22 个 MCP Tool 扁平架构 | OpenAI 官方建议"不超过 20 个"，业界阈值 30-50 个以下用扁平 |
| Prompt 是主要杠杆（99% 贡献） | ToolACE (ICLR 2025) 证明 8B 模型 + 高质量数据 = GPT-4 级别。LangChain 研究：3 个 few-shot 示例从 16%→52% |
| gpt-5.4-mini 足够 | Paragon 基准测试：工具数 <20 时模型差异不大 |

## 2. 最值得参考的项目

### TIER 1：直接可借鉴

#### SAP OData → MCP（114 stars）
- **仓库**：github.com/lemaiwo/btp-sap-odata-to-mcp-server
- **亮点**：3 级渐进式发现——把 200+ 工具压缩成 3 个元工具
  - Level 1 `discover-sap-data`：轻量搜索
  - Level 2 `get-entity-metadata`：按需加载 schema
  - Level 3 `execute-sap-operation`：执行操作
- **启发**：当工具数增长时，"发现→加载→执行"模式比分层更优雅

#### Semantic Router（3.4k stars）
- **仓库**：github.com/aurelio-labs/semantic-router
- **亮点**：用向量相似度做路由，**100ms** 决策，不需要 LLM 推理。研究显示 100+ 工具时仍保持 43% 准确率（LLM 方式降到 13-15%）
- **启发**：向量预筛选 + LLM 精确选择的混合方案，是未来扩展到 50+ 工具时的方向

#### Google MCP Toolbox for Databases（13.5k stars）
- **仓库**：github.com/googleapis/genai-toolbox
- **亮点**：YAML 定义工具，MCP 原生架构，内置连接池/认证/OpenTelemetry
- **启发**：`tools.yaml` 声明式工具注册，可直接参考

#### Block (Square) Goose
- **亮点**：把 30+ API / 200+ 端点抽象成 3 个 MCP 工具（发现→规划→执行）
- **结果**：从"大量错误吃满上下文"到"稳定可用的工作流"
- **启发**：验证了我们"LLM 路由"方向的工业级可行性

#### Cube.dev（19.7k stars）
- **仓库**：github.com/cube-js/cube
- **亮点**：语义层 + AI API。LLM 生成约束化的 REST/GraphQL API 调用，语义层内部编译为 SQL
- **启发**：与我们"MCP tool = 约束化 API"完全一致

### TIER 2：架构模式参考

#### GitHub MCP Server — 动态工具集
- 100+ 工具用 `--dynamic-toolsets` 模式：启动只加载 4 个基础工具，按需懒加载
- **启发**：工具多了之后"从 4 个基础工具开始"的模式

#### IBM ContextForge（3.5k stars）
- REST/gRPC → MCP 自动转换，无需手写 schema
- **启发**：如果 EAM 已有 REST API，可以自动生成 MCP tool

#### MCP Gateway Registry（520 stars）
- 用 FAISS + sentence-transformers 做语义工具匹配，<100ms
- **启发**：与 Semantic Router 类似，向量路由做预筛选

#### Microsoft Dynamics 365 ERP MCP
- 从 13 个固定工具演进到**动态工具清单**（基于用户权限和安全上下文）
- **启发**：工具集应该随用户角色动态变化

### TIER 3：评测基准与方法论

#### Berkeley BFCL V4
- 业界标准的函数调用评测。temperature 0.0 vs 0.7 可差 **10pp**
- **我们已经用 temperature=0** ✅

#### Gorilla（12.8k stars）
- 检索增强训练（RAT）：结合文档检索和 LLM，大幅降低 API 调用幻觉
- **启发**：未来可考虑 RAG 辅助工具选择

#### ToolBench / ToolLLM（5.6k stars）
- DFSDT（深度优先搜索决策树）用于 16,464 个真实 API 的工具选择
- **启发**：复杂多步场景的"调查型 Agent"参考

## 3. 可直接采用的技巧

### 3.1 我们还没做但应该做的

| 技巧 | 来源 | 预期效果 | 难度 |
|------|------|---------|------|
| **置信度回退** — 低置信度时问用户澄清，不猜 | Anthropic / 多个来源 | 剩余 5.8% 错误率可降一半 | 低 |
| **per-tool 用法示例** — 每个工具附 1 个调用示例 | Anthropic 内部测试 72%→90% | 可能再提 2-3pp | 低 |
| **工具描述前置关键信息** — 第一句话放最区分性的内容 | Merge / MCP 最佳实践 | 避免 LLM 不读完整描述 | 低 |
| **推理步骤** — 选工具前先输出一行推理理由 | ReAct 模式 | 提升可追溯性，减少误选 | 中 |
| **strict mode** — 强制 schema 合规 | OpenAI 官方 | 消除参数格式错误 | 低 |

### 3.2 未来扩展时需要的

| 技巧 | 适用时机 | 来源 |
|------|---------|------|
| 向量预筛选（embed query → cosine similarity → top-K tools） | 工具 > 30 | Semantic Router / vLLM |
| 动态工具加载（启动少量，按需加载） | 工具 > 50 | GitHub MCP / SAP OData |
| 渐进式发现（发现→元数据→执行 3 级） | 实体 > 50 | SAP OData BTP |
| regex/关键词预过滤 + LLM 兜底 | 高并发场景 | Elastic Path Optimizer |

## 4. 关键数据点

| 指标 | 数值 | 来源 |
|------|------|------|
| 语义层路由 vs 裸 SQL | 83% vs 40% | dbt |
| 3 个 few-shot 示例的提升 | 16% → 52% (Claude Sonnet) | LangChain |
| per-tool 示例的提升 | 72% → 90% | Anthropic |
| temperature 0 vs 0.7 差异 | 最多 10pp | Berkeley BFCL |
| 向量路由 100+ 工具准确率 | 43% (vs LLM 13-15%) | Semantic Router |
| 工具描述质量 → 检索命中率 | 40% → 90%（线性正相关） | Pinterest |
| 我们的成绩 | 94.2% / 95.0% | 方案 A R5 |

## 5. 对我们架构的影响

### 当前阶段（22 个工具）不需要改

我们的 94.2% 已经**超越了大多数行业基准**（Paragon 测试中 o3 最好也只有 77.9%）。当前扁平 V4 方案完全正确。

### 低成本可立即做的优化

1. **置信度回退机制** — 最高 ROI，把"猜错"变成"问用户"
2. **per-tool 调用示例** — Anthropic 验证的 72%→90%，我们还没用
3. **工具描述优化** — 前置关键信息，加 when-to-use / when-not-to-use

### 工具数增长时的路线图

```
当前: 22 工具，扁平 V4（94.2%）
  │
  ├─ 30 工具: 加向量预筛选（Semantic Router）
  │           保持 LLM 只看 top-10 工具
  │
  ├─ 50 工具: 动态加载（GitHub MCP 模式）
  │           启动 5 个基础工具，按需加载
  │
  └─ 100+ 工具: 渐进式发现（SAP OData 3 级模式）
                发现 → 元数据 → 执行
```

## 6. 值得深入研究的仓库

| 优先级 | 仓库 | Stars | 看什么 |
|--------|------|-------|--------|
| P0 | google/genai-toolbox | 13.5k | tools.yaml 格式、MCP 原生架构 |
| P0 | aurelio-labs/semantic-router | 3.4k | 向量路由实现、Route 定义方式 |
| P1 | dbt-labs/dbt-mcp | 517 | 语义层 MCP 工具设计 |
| P1 | lemaiwo/btp-sap-odata-to-mcp-server | 114 | 3 级渐进发现模式 |
| P2 | ShishirPatil/gorilla | 12.8k | BFCL 评测方法论 |
| P2 | lastmile-ai/mcp-agent | 8.1k | Agent 编排框架 |
