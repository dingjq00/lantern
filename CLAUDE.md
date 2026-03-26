# CLAUDE.md — Insight68 NL-API Platform

## 项目概述

企业系统 AI 自然语言交互平台。用户面对一个输入框，用自然语言查询、分析、操作企业数据。
EAM 是第一个落地场景，架构为"任何有 API 的企业系统"而设计。

**当前状态**：P0+P1 完成（30 Task / 129 tests / 87.5% recall），进入 P1.5 自学习阶段。

## 技术方向

LLM 路由 + MCP 确定性执行 + ReAct 循环 + 自学习。不走 Text-to-SQL。

**核心架构**：
- 6 层 Context 架构（System Prompt → Rules → Task Instructions → Examples → Dynamic Context → User Input）
- 3 步 think（规划 → 审查放开 → finish）+ 5 步结构化模板（ToolGT + Step-Back + Reflexion）
- 参数引用 {{N.path}} + 级联策略（mini → gpt-5.4）
- 22 个 YAML 声明式 MCP 工具 + Benchmark Dashboard

## 关联项目

- EAM 主项目：/Users/dingjq/IdeaProjects/eamNewGe（数据模型来源）

## 开发规范

- 中文注释和文档
- **深度优先** — 这是 AI 推理平台，不是 CRUD。该复杂的必须复杂，深入分析比快速出结果重要
- **每个改动要有深度分析** — 改之前分析为什么改，改之后验证效果，控制变量对比
- 每个实验记录结论，避免重复探索

## 架构原则（P1 调优确立，8 条）

1. MCP 是动作（获取数据），AI 是能力（分析数据）—— 不混淆
2. guide/prompt 是方法论（通用），YAML 是具象化（项目相关）—— 保持通用性
3. 从错误中学习 > 记录正确答案（但信号必须来自外部，AI 自评无效）
4. 优化优先级：① Prompt > ③ AI 分析 > ② MCP 工具
5. 工具应同时接受业务编号和内部 ID（poka-yoke）
6. summarize 绝对不能编造数据
7. 复杂度是输出不是输入 —— 不预判，统一流程自然收敛
8. 静态上下文在前（可缓存），动态上下文在后
