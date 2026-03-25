# 方案 A — 路由策略验证实验 Spec

> 2026-03-25 基于 brainstorming 成果整理

## 1. 实验目标

用零代码的纯 Prompt 实验，对比三种路由策略的准确率，为架构选型提供数据依据。

**核心问题**：LLM 在"理解用户意图 → 选对工具 → 填对参数"这条链路上，哪种工具描述方式能达到最高准确率？

## 2. 核心前提

- LLM **不碰 SQL**，只做意图理解 + 路由选择
- 确定性代码负责取数执行
- 最终落地形态为 MCP Server + LLM（GPT via codex-proxy）

## 3. 三组对比实验

按 G1 → G2 → G3 顺序执行，每组使用**同一测试集**，只替换 Prompt 中的工具描述。

### G1 — Controller 路由（基线）

| 项目 | 内容 |
|------|------|
| Prompt 内容 | EAM 现有 4 组 Controller 的方法签名清单 |
| LLM 输出 | 选哪个 Controller 方法 |
| 验证什么 | 现有能力覆盖率 + 选择准确率 |
| 价值 | 确定哪些方法可直接封装成 MCP tool，哪些场景需要新建 |

数据来源：`EamDashboardController`、`EamGovernanceController`、`EamAnomalyRecordController`、`EamPatrolTaskController`

### G2 — MCP Tool 路由（核心实验）

| 项目 | 内容 |
|------|------|
| Prompt 内容 | 自行设计的 MCP tool 清单（name + description + inputSchema） |
| LLM 输出 | 选 tool + 填参数（JSON） |
| 验证什么 | 理想 API 设计下的路由准确率 |
| 价值 | 直接验证 MCP 落地方案的可行性 |

工具描述格式遵循 MCP `tools/list` 规范，示例：

```json
{
  "name": "query_repair_orders",
  "description": "查询维修工单，支持按设备、时间范围、状态、故障类型等条件筛选",
  "inputSchema": {
    "type": "object",
    "properties": {
      "equipmentId": { "type": "string", "description": "设备ID" },
      "status": { "type": "string", "enum": ["pending", "in_progress", "completed"] },
      "dateRange": {
        "type": "object",
        "properties": {
          "start": { "type": "string", "format": "date" },
          "end": { "type": "string", "format": "date" }
        }
      },
      "faultTypeId": { "type": "string", "description": "故障分类ID" }
    }
  }
}
```

### G3 — DSL 路由（备选方案）

| 项目 | 内容 |
|------|------|
| Prompt 内容 | 自定义 DSL 语法规范 + 示例 |
| LLM 输出 | DSL 表达式 |
| 验证什么 | 中间表示方式的可行性和准确率 |
| 价值 | 评估 DSL 是否比 function calling 更适合复杂场景 |

DSL 示例：

```
QUERY repair_orders
  WHERE equipment.line = "A线"
    AND date >= "2026-01"
  JOIN spare_usage
  AGGREGATE count, sum(spare_cost)
```

## 4. 测试集设计

### 出题方式

- **跨域复杂题**：用户手写（确保贴近真实业务场景）
- **单域简单题**：AI 生成，用户 review 定稿
- 总量目标：30-50 题

### 难度分层

| 级别 | 定义 | 示例 | 预期数量 |
|------|------|------|---------|
| L1 | 单操作直查 | "A 线有多少台设备？" | 10 题 |
| L2 | 双操作关联 | "上月故障最多的设备是哪台？" | 10 题 |
| L3 | 链式多跳 | "A 线上月维修用了哪些备件？"（产线→设备→工单→备件） | 8 题 |
| L4 | 跨域关联 | "故障率最高的设备，保养是否按计划执行？" | 6 题 |
| L5 | 聚合+时间推理 | "哪条产线近 3 个月故障呈上升趋势，且备件库存不足？" | 6 题 |

**桥接表覆盖要求**：L3+ 的题目必须覆盖 4 张关键桥接表（RepairSpareUsage、ProductionLineEquipment、EquipmentSpareBom、RepairOrderKnowledgeRef）。

## 5. 评分框架

四维度，按层级递进评分：

| 维度 | 说明 | 适用级别 | 权重 |
|------|------|---------|------|
| D1 操作召回率 | 该调的方法/tool 都找到了吗 | L1+ | 40% |
| D2 操作精确率 | 多选了无关操作吗 | L1+ | 20% |
| D3 参数正确性 | 参数/连接填对了吗 | L2+ | 25% |
| D4 过滤条件识别 | 时间/状态等条件映射正确吗 | L3+ | 15% |

**单题得分** = D1×0.4 + D2×0.2 + D3×0.25 + D4×0.15（不适用的维度不计入）

**实验组总分** = 各级别加权平均（L1-L5 权重相等，避免简单题拉高均值）

## 6. 实施计划

| 阶段 | 内容 | 产出 |
|------|------|------|
| **P1 准备** | 设计 G2 MCP tool 清单 + 提取 G1 Controller 签名 + 设计 G3 DSL 语法 | 三组 Prompt 模板 |
| **P2 出题** | 按 L1-L5 编写测试集，确保桥接表覆盖 | test-cases.json |
| **P3 实验** | Notebook 中逐组运行，人工评分 | 原始评分数据 |
| **P4 分析** | 对比三组总分 + 各级别分布 + 失败模式分析 | 实验报告 |

**工具**：Jupyter Notebook 起步（分步探索、分步优化），稳定后整理成自动化脚本批量评分。

## 7. 决策规则

实验完成后，按以下规则决定后续方向：

| 结果 | 决策 |
|------|------|
| G2 ≥ 80% 且明显优于 G1/G3 | 确认 MCP Tool 路由，进入 tool 设计+实现 |
| G2 与 G3 接近且都 ≥ 75% | 评估 DSL 的工程复杂度，综合选择 |
| G1 覆盖率 ≥ 70% | 优先复用现有 Controller，增量补充 |
| 三组都 < 70% | 回退检查 tool 设计质量 或 考虑调查型 Agent |
