# Lantern NL-API Platform

面向制造业企业系统的自然语言交互平台。用户通过一个输入框查询和分析业务数据，LLM 负责理解意图与编排工具，MCP handler 负责调用确定性业务 API，不采用 Text-to-SQL 路线。

## 当前实现

- Web 界面与 Chat API：Next.js 16 / React 19。
- Brain 层：路由、ReAct 循环、数据摘要、置信度和结果呈现。
- 工具层：从 `skills/**/*.yaml` 加载声明式能力，通过 MCP server 执行。
- 系统覆盖：EAM（设备资产）、EDHR（检测流程）、MES（制造执行）、JSY（南厂酿酒车间，白酒酿造 MES）及通用术语查询。
- 验证设施：EAM/EDHR benchmark、平台级路由与跨系统 benchmark、质量评估页面。

截至 `2026-05-29`，代码中注册了 34 个 YAML skills：EAM 12 个、EDHR 7 个、MES 10 个、JSY 4 个、common 1 个。JSY 为最新接入（P0 4 工具，正在真实环境实施），接手手册见 [docs/jsy-onboarding.md](docs/jsy-onboarding.md)；短期开发状态和待处理风险见 [docs/handoff.md](docs/handoff.md)。

## 目录

| 路径 | 职责 |
| --- | --- |
| `app/` | Web UI、benchmark 页面与 `/api/chat` 入口 |
| `lib/brain/` | 意图路由、观察/摘要、数据处理、置信度等核心逻辑 |
| `lib/tools/` | YAML 加载、工具注册与 MCP client |
| `lib/storage/` | SQLite 平台状态与 benchmark 存储 |
| `mcp-server/` | EAM / EDHR / MES / JSY 业务 API handler |
| `skills/` | 声明式工具目录，按系统分组 |
| `prompts/` | 系统提示、规则、few-shot 与总结指令 |
| `scripts/` | benchmark、质量评估与本地提问脚本 |
| `docs/` | 规格、实验记录与交接说明 |

## 本地启动

需要 Node.js 环境，并为需要查询的数据源准备可访问的 API 与凭据。

```bash
npm install
cd mcp-server && npm install
cd ..
cp .env.example .env.local
npm run dev
```

在 `.env.local` 中填入自己的凭据。当前工具声明存放于 `skills/`，因此需要保留：

```bash
TOOLS_DIR=./skills
```

访问 `http://localhost:3000` 使用主界面；`/benchmark` 展示已保存的评估结果。Chat API 会按需通过 stdio 启动 `mcp-server`，无需独立启动服务进程。

## 常用命令

```bash
npm test
npm run lint
npm run build
npx tsx scripts/benchmark.ts
npx tsx scripts/benchmark-platform.ts
npx tsx scripts/quality-eval.ts
```

Benchmark 和质量评估会调用模型与外部系统，运行前请核对 `.env.local`、数据源可用性和调用成本。

## 文档入口

- [docs/handoff.md](docs/handoff.md)：当前代码状态、接手注意事项和近期风险。
- [docs/jsy-onboarding.md](docs/jsy-onboarding.md)：JSY 南厂酿酒车间接手手册（环境配置、5 分钟跑通、红线、新增工具流程、给 AI 助手的开场白）。配套 `docs/jsy-endpoints.md`（589 endpoint 全清单）/ `docs/jsy-tool-plan.md`（P1-P3 规划）/ `docs/jsy-business-context.md`（业务速查）/ `docs/jsy-findings.md`（完整业务调研快照）。
- [docs/roadmap-2026-05-27.md](docs/roadmap-2026-05-27.md)：基于当前代码与验证结果制定的后续推进路线图。
- [docs/specs/platform-design.md](docs/specs/platform-design.md)：平台架构设计基础。
- [docs/plan-a-experiment-report.md](docs/plan-a-experiment-report.md)：早期 EAM 工具路由实验记录。
- [docs/superpowers/plans/2026-03-30-data-processing-layer.md](docs/superpowers/plans/2026-03-30-data-processing-layer.md)：数据处理层设计过程。

## Agent 协作

在本仓库进行自动化开发前，先读取 `AGENTS.md`。其中包含 Next.js 版本约束、架构边界、安全要求和验证规则；当前进展则以 `docs/handoff.md` 与实际 Git 状态为准。
