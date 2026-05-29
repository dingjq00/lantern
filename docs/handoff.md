# Lantern 开发交接说明

> 更新时间：2026-05-27（2026-05-29 修订：补 JSY 接入事实 + 刷新系统/skills 计数）  
> 用途：为新的开发会话或协作模型提供可验证的当前上下文。状态描述以本次读取的代码和 Git 工作区为依据。

## 项目定位

Lantern 是自然语言操作企业系统的通用平台。当前链路为：

```text
Next.js Web / API
  -> Brain（意图路由、ReAct、数据摘要、结果呈现）
  -> YAML Tool Registry + MCP Client
  -> MCP Server handlers
  -> EAM / EDHR / MES 业务 API
```

基本架构判断沿用现有实现：LLM 做理解、编排和分析，handler 做确定性查询；当前方案不是 Text-to-SQL。

## 已核对的代码状态

- 技术栈：Next.js `16.2.1`、React `19.2.4`、TypeScript、OpenAI SDK、MCP SDK、SQLite、Vitest。
- 系统注册点为 `lib/systems.ts`，当前包含 `eam`、`edhr`、`mes`、`jsy` 四个业务系统（`jsy` 南厂酿酒车间为 2026-05-28 接入，P0 4 工具，正在真实环境实施；运行时启用由 `ENABLED_SYSTEMS` 控制）。
- `skills/` 当前共有 34 个 YAML skills：EAM 12、EDHR 7、MES 10、JSY 4、common glossary 1。
- `app/api/chat/route.ts` 组合 Brain、SQLite、Tool Registry 与 MCP client；MCP server 由 API 路由按需以 stdio 启动。
- 评估入口包含 `scripts/benchmark.ts`（EAM/EDHR 深度用例）与 `scripts/benchmark-platform.ts`（系统路由、跨系统推理、MES 用例）。
- R1 回归测试：`npm test` 现为 12 个测试文件、85 条用例，覆盖 router、confidence、validator、intent、observation、summarize-context、cross-system-bridge、registry、MCP 契约、storage、benchmark manifest。
- 置信度融合已改为 `toolMatch + queryClarity + dataRelevance`（`verdictConfidence` 仅 trace 兼容，不参与 high 判定）。
- R2 跨系统：`prepareSummarizeContext` 按系统分片、按 (tool+args) 保留证据；`CROSS_SYSTEM_BRIDGES` 注入 summarize；平台用例集扩至 38 题（`platform-v2`）。**尚未跑真实 benchmark 验收（R2.5）。**
- 最近已提交的主线工作包含 MES 接入、领域公式/few-shot 与平台级 benchmark。

## 接手时的工作区状态

检查时所在分支为 `feat/p0-platform`（已推送到 origin，JSY P0 接入已提交，同事 clone/pull 此分支即可拿到 JSY 全部代码与文档）。下表未提交改动为本文档**初始化时**的快照，与当前工作区可能已不同步；继续工作时以 `git status` 实际输出为准：

| 文件 | 从 diff 推断的方向 |
| --- | --- |
| `lib/brain/observation.ts` | observation 增加已查询系统信息，并强化跨系统覆盖检查 |
| `prompts/base-instructions.md` | 将全景工具说明泛化为多系统适用表述 |
| `prompts/react-instructions.md` | 同步泛化全景工具规则 |
| `prompts/system-prompt.md` | 去除仅举 EAM/EDHR 的系统示例 |
| `prompts/few-shot-examples.json` | 增加未指定系统及跨系统查询示例 |

另有未跟踪目录 `.codex/`；在确认其是否需要纳入仓库前，不应随意提交或删除。

## 环境与运行

基础本地流程：

```bash
npm install
cd mcp-server && npm install
cd ..
cp .env.example .env.local
npm run dev
```

关键注意点：

- 工具文件实际位于 `skills/`，当前运行应配置 `TOOLS_DIR=./skills`。
- EAM、EDHR、MES 都依赖外部 API；没有相应数据源与凭据时，UI 可启动，但真实查询和 benchmark 不会完整工作。
- `npm test`、`npm run lint`、`npm run build` 用于基础验证；路由、prompt、handler 或数据摘要的变化还应运行相应 benchmark。

## 重要资料

| 文档 | 使用方式 |
| --- | --- |
| `docs/local-test-systems-startup.md` | EAM、EDHR、MES 三套真实测试后端的启动、校验与常见问题手册 |
| `docs/jsy-onboarding.md` | JSY 南厂酿酒车间接手手册（环境配置、5 分钟跑通、红线、新增工具流程、给 AI 助手开场白）；配套 `jsy-endpoints.md` / `jsy-tool-plan.md` / `jsy-business-context.md` / `jsy-findings.md` |
| `docs/roadmap-2026-05-27.md` | 后续推进主路线、阶段门槛与近期任务排序 |
| `docs/specs/platform-design.md` | 平台分层与工具注册的设计基础，部分阶段描述为早期规划 |
| `docs/plan-a-experiment-report.md` | EAM 22 tools 阶段的实验记录，用于理解决策来源，不代表当前三系统覆盖结果 |
| `docs/superpowers/plans/2026-03-30-data-processing-layer.md` | 数据摘要和领域公式设计依据 |
| `CLAUDE.md` | 旧会话留下的原则摘要；当前工具数量和进度应以本文件及代码为准 |

## 已知风险与近期建议

1. **凭据治理**：当前部分源码带有 API key、用户名、密码或 client secret 的回退默认值。部署、共享仓库或继续扩展前，应改为环境变量必填/安全失败，并轮换已经暴露的凭据。
2. **工具目录默认值**：Chat route 的默认工具目录是 `./tools`，而仓库实际目录是 `./skills`。当前可由环境变量规避；后续宜统一代码默认值，减少空目录或启动失败风险。
3. **正在进行的 prompt 变更**：接手时存在跨系统覆盖相关未提交改动。合并前至少运行相关测试和平台级 benchmark，并记录模型、数据源与结果。
4. **历史文档漂移**：早期文档中的 P0/P1、22 tools 或 EAM 专属描述是阶段性结论。任何新决策应补充可复现验证记录，并更新本交接页。

## 新会话开始清单

1. 阅读 `AGENTS.md`、本文件与任务涉及的实现文件。
2. 运行 `git status --short --branch`，识别已有未提交变更。
3. 涉及 Next.js API 或约定时，先阅读 `node_modules/next/dist/docs/` 的对应指南。
4. 变更完成后执行与风险匹配的测试/benchmark，并更新状态文档中已失效的事实。
