# 向量路由模式深度调研

> 2026-03-24 调研成果

## 这个模式叫什么？

| 语境 | 术语 |
|------|------|
| 学术界 | **vector-based schema linking** |
| 产业界 | **semantic layer + RAG-based table selection** |
| AWS/云厂商 | **metadata-driven RAG** |
| Pinterest 工程博客 | **RAG-enhanced table selection** |

## 推荐架构（行业共识）

```
用户自然语言
    ↓
[意图理解 + 消歧] — 不确定就反问用户
    ↓
[语义层] — 业务术语 → schema 映射
    ↓
[向量搜索] — 匹配到相关表/列（缩小范围）
    ↓
[知识图谱补充] — 补上桥接表和 JOIN 路径
    ↓
[SQL 生成] — LLM 在限定范围内生成查询
    ↓
[验证纠错] — 执行、检查、自动修正
    ↓
[结果展示 + 解释]
```

## Schema 元数据怎么嵌入（按重要性排序）

1. **表级摘要** — 每张表的自然语言描述：代表什么、属于哪个业务域、什么场景会查它
2. **列级描述** — 列名、数据类型、业务描述、值域说明
3. **关系描述** — JOIN 路径和外键关系的自然语言描述（**关键！纯向量搜索最弱的环节**）
4. **示例查询** — 历史 SQL + 对应的自然语言描述（Pinterest 发现这比表摘要效果好得多）
5. **枚举值** — 低基数列的实际值（如状态码、设备类型）
6. **示例数据行** — 每张表 3-5 行样本数据，帮助消歧

## 向量数据库选型

**pgvector 够用。** 原因：
- Schema 元数据只有几百条向量（不是百万级）
- EAM 已经用 PostgreSQL
- 数据和向量共存一个库，架构最简
- 这个规模下性能差异可忽略

| | pgvector | Pinecone | Weaviate | Chroma |
|--|----------|----------|----------|--------|
| 适合 | 已有 PG，<5M 向量 | 零运维，企业级 | 混合搜索+知识图谱 | 原型开发 |
| 运维 | 零（就是你的 DB） | 零（SaaS） | 中 | 极低 |

## 失败模式（必须知道）

### #1 漏掉桥接表（最致命）
向量搜索匹配**语义**不匹配**结构**。用户问"维修工单用了哪些备件"，能找到 `EamRepairOrder` 和 `EamSparePart`，但漏掉桥接表 `EamRepairSpareUsage`。

**解法**：向量搜索 + 知识图谱（表关系图）混合使用。

### #2 过度裁剪
激进的 schema linking 砍掉了实际需要的列。研究发现 9.79%-22.56% 的上下文丢失。

**解法**：宽松召回（top-N 取大 N），再让 LLM 精排。

### #3 幻觉 JOIN
找对了表但不知道怎么连，LLM 编造不存在的外键关系。

**解法**：在嵌入中包含显式的 JOIN 路径描述。

### #4 列名歧义
`name`、`id`、`status`、`date` 在多张表出现，不知道该用哪个。

**解法**：嵌入时带上示例数据行。

### #5 技术列名无语义
`cust_seg_cd`、`txn_amt`、`dt_eff` 跟自然语言没有相似性。

**解法**：必须人工添加自然语言描述。

### #6 多跳查询（3+ 表 JOIN）
向量搜索在此彻底失败，因为中间表跟问题无语义关联。

**解法**：图遍历，不能靠向量搜索。

## 反向观点：还需要 schema linking 吗？

"The Death of Schema Linking?" (NeurIPS 2024) 论文提出：对于强模型（Gemini 1.5 Pro），直接传整个 schema 反而更好（71.83% on BIRD）。**但前提是 schema 能放进 context window。** 91 张表可能刚好在边界上 — 值得测试。

## 关键参考资料

### 论文
- LitE-SQL (2025): 首个完整向量驱动的 schema linking，72.1% on BIRD
- LinkAlign (EMNLP 2025): 可扩展 schema linking
- The Death of Schema Linking? (NeurIPS 2024): 强模型可能不需要过滤

### 工程博客
- [Pinterest: How We Built Text-to-SQL](https://medium.com/pinterest-engineering/how-we-built-text-to-sql-at-pinterest-30bad30dabff)
- [Pinterest: Unified Context-Intent Embeddings (2026.03)](https://medium.com/pinterest-engineering/unified-context-intent-embeddings-for-scalable-text-to-sql-793635e60aac)
- [FalkorDB: Text-to-SQL with Knowledge Graphs](https://www.falkordb.com/blog/text-to-sql-knowledge-graphs/)
- [Wren AI: Why the Semantic Layer is Essential](https://www.getwren.ai/post/why-the-semantic-layer-is-essential-for-reliable-text-to-sql-and-how-wren-ai-brings-it-to-life)
- [Google Cloud: Six Failures of Text-to-SQL](https://medium.com/google-cloud/the-six-failures-of-text-to-sql-and-how-to-fix-them-with-agents-ef5fd2b74b68)

### 开源
- [Vanna AI](https://github.com/vanna-ai/vanna) — 13k+ stars, RAG-based
- [Wren AI](https://github.com/Canner/WrenAI) — 5k+ stars, semantic-layer-first
- [QueryWeaver](https://github.com/FalkorDB/QueryWeaver) — 知识图谱方式
- [Awesome-LLM-based-Text2SQL](https://github.com/DEEP-PolyU/Awesome-LLM-based-Text2SQL) — 资源汇总
