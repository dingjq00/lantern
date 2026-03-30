# CLAUDE.md — Lantern NL-API Platform（原 Insight68）

## 项目概述

企业系统 AI 自然语言交互平台。用户面对一个输入框，用自然语言查询、分析、操作企业数据。
EAM 是第一个落地场景，架构为"任何有 API 的企业系统"而设计。

**当前状态**：P1.5 完成 — 19 工具 / 100% recall / 质量 4.7/5 / 数据处理层落地

## 技术方向

LLM 路由 + MCP 确定性执行 + ReAct 循环 + 数据处理层。不走 Text-to-SQL。

**核心架构**：
- 6 层 Context 架构（System Prompt → Rules → Task Instructions → Examples → Dynamic Context → User Input）
- 3 步 think（规划 → 审查放开 → finish）+ 5 步结构化模板（ToolGT + Step-Back + Reflexion）
- 参数引用 {{N.path}} + 级联策略（默认用主模型，可配环境变量覆盖）
- 19 个 YAML 声明式 MCP 工具（EAM 12 + EDHR 7）+ Benchmark Dashboard
- 数据处理层：stats 前置 + 原始数据保留 + 领域公式（TPM/FDA KPI）

## 关联项目

- EAM 主项目：/Users/dingjq/IdeaProjects/eamNewGe（数据模型来源）

## 开发规范

- 中文注释和文档
- **深度优先** — 这是 AI 推理平台，不是 CRUD。该复杂的必须复杂，深入分析比快速出结果重要
- **每个改动要有深度分析** — 改之前分析为什么改，改之后验证效果，控制变量对比
- 每个实验记录结论，避免重复探索

## 架构原则（P1 确立 8 条 + P1.5 新增 3 条）

1. MCP 是动作（获取数据），AI 是能力（分析数据）—— 不混淆
2. guide/prompt 是方法论（通用），YAML 是具象化（项目相关）—— 保持通用性
3. 从错误中学习 > 记录正确答案（但信号必须来自外部，AI 自评无效）
4. 优化优先级：① Prompt > ③ AI 分析 > ② MCP 工具
5. 工具应同时接受业务编号和内部 ID（poka-yoke）
6. summarize 不编造 ≠ 不分析 —— 替代分析（推导/角度转换/重要性补充）不是编造
7. 复杂度是输出不是输入 —— 不预判，统一流程自然收敛
8. 静态上下文在前（可缓存），动态上下文在后
9. **预计算是辅助不是替代** —— stats 前置引导 AI 引用正确数字，但原始数据必须保留
10. **prompt 噪音在帮倒忙** —— 无效信号（如 verdict）占 attention 权重干扰独立判断
11. **handler 返回数据决定 AI 能力上限** —— AI 再聪明也分析不了 handler 没返回的字段
