# 行业产品与方案调研

> 2026-03-24 调研成果

## 商业产品

### Snowflake Cortex Analyst（领先方案）
- **架构**：YAML 定义语义模型（业务概念、指标、命名过滤器、JOIN 路径），agentic 多步系统从语义层生成 SQL
- **准确率**：声称 90%+，比单次 GPT-4o 生成准确近 2 倍
- **关键**：语义模型是核心差异化 — 约束 LLM 搜索空间并提供业务上下文

### Tableau AI（Ask Data → Pulse + Agent）
- Ask Data 已退役（2024.02），因为需要大量配置且结果不可靠
- 转向 Pulse（基于预定义指标的 NLP 问答）
- **信号**：从"问任何事"转向"问预定义指标"，说明约束查询范围能提高可靠性

### Microsoft Fabric Copilot
- 只用 schema 信息（不看实际数据）生成 T-SQL
- Schema-only 方式对很多查询够用，但有天花板

### Databricks AI/BI Genie
- 对话式 NL 接口，展示推理过程
- 遇到模糊问题会**主动反问**（重要的 UX 模式）

### 其他
- **Salesforce Einstein**: 在约束的已知数据模型上效果好（SOQL over Accounts/Contacts）
- **Amazon Q**: 多种模式（Business, QuickSight, Bedrock），正确识别不同查询类型需要不同方法
- **Google Gemini in BigQuery**: AI 函数直接嵌入 SQL（AI.IF, AI.CLASSIFY）

## 开源项目

| 项目 | 特点 | Stars | 适合场景 |
|------|------|-------|---------|
| **Vanna AI** | RAG over DDL+文档+示例查询，最简单 | 13k+ | 快速验证 |
| **Wren AI** | 语义层优先，三组件架构（UI+AI Service+Engine） | 5k+ | 最完整方案 |
| **QueryWeaver** | 知识图谱（FalkorDB）做 schema 路由 | 新 | 复杂多跳查询 |
| **LangChain SQL Agent** | 灵活但需大量工程 | - | 自建系统 |

## MES 领域实践

| 产品/论文 | 时间 | 结果 |
|----------|------|------|
| **Parsec TrakSYS 14 IQ Assistant** | 2026.02 | 第一个 MES 内置 AI copilot，NL 查询+动态可视化（Azure AI Foundry） |
| **Critical Manufacturing AI Copilots** | 2025 | 用 MCP 做对话式分析 |
| **"Chat with MES" 论文** | 2025 | 服装 MES 上 80% 成功率（vs 裸 GPT-4 的 60%） |
| **AWS Industrial Data Store Chatbot** | 2025 | 开源参考架构：SQLite MES + Bedrock |

**结论**：方向已验证，但还没有成熟开源方案，先发优势窗口还在。

## Text-to-SQL 准确率真相

| 查询复杂度 | 准确率 |
|-----------|--------|
| Easy | ~77% |
| Medium | ~55-65% |
| Hard | ~35-45% |
| Extra Hard | ~20% |

四大常见错误：错误 JOIN（最频繁）、聚合错误、漏条件、语法错误。

**学术 benchmark 严重高估了生产可用性。** Spider 86% → Spider 2.0 23%。
