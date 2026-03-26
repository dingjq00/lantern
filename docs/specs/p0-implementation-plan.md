# P0 Implementation Plan — Insight68 NL-API Platform

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** EAM 查询场景端到端跑通 — 用户在 Web 输入框输入自然语言，获得结构化回答。

**Architecture:** Next.js 全栈，四层架构（接入层/智能层/工具层/数据层）。22 个 EAM MCP Tools 通过 YAML 声明式注册，智能层动态组装 Prompt V4 调用 codex-proxy (gpt-5.4-mini) 路由，结果经 LLM 总结后返回 Web 前端。

**Tech Stack:** TypeScript, Next.js 15 (App Router), MCP SDK (@modelcontextprotocol/sdk), OpenAI SDK, SQLite (better-sqlite3), sqlite-vec, Tailwind CSS, shadcn/ui

**Spec:** `docs/specs/platform-design.md`

**EAM 数据来源:** `/Users/dingjq/IdeaProjects/eamNewGe`（Java Service 层，通过 HTTP REST API 调用）

---

## File Structure

```
insight68-platform/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # 全局布局
│   ├── page.tsx                  # 首页（查询界面）
│   ├── api/
│   │   ├── chat/route.ts         # POST /api/chat — 主查询接口
│   │   └── health/route.ts       # GET /api/health — 健康检查
│   └── components/
│       ├── ChatInput.tsx          # 查询输入框
│       ├── ChatMessage.tsx        # 消息气泡（问题+回答）
│       ├── ResultTable.tsx        # 表格渲染
│       └── ConfidenceHint.tsx     # 置信度提示（medium/low）
│
├── lib/
│   ├── brain/                     # 智能层
│   │   ├── router.ts              # 完整路由流程（9 步编排）
│   │   ├── intent.ts              # 意图提取 + intent_hash
│   │   ├── prompt-assembler.ts    # Prompt V4 动态组装
│   │   ├── confidence.ts          # 置信度三信号融合
│   │   └── result-presenter.ts    # 结果呈现（data → StructuredResult）
│   │
│   ├── llm/                       # LLM Provider 抽象
│   │   └── codex-proxy.ts         # codex-proxy adapter（接口定义在 lib/types.ts）
│   │
│   ├── tools/                     # 工具层
│   │   ├── registry.ts            # YAML 加载 + match + execute
│   │   ├── yaml-loader.ts         # YAML 文件扫描和解析
│   │   └── mcp-client.ts          # MCP Client 封装
│   │
│   ├── storage/                   # 存储抽象层
│   │   ├── types.ts               # Storage Interface
│   │   ├── sqlite.ts              # SQLite 实现
│   │   └── migrations/
│   │       └── 001-init.sql       # 建表语句
│   │
│   └── types.ts                   # 全局类型定义
│
├── tools/                         # YAML 工具声明
│   └── eam/
│       ├── query-equipment.yaml
│       ├── get-equipment-detail.yaml
│       ├── get-equipment-lifecycle.yaml
│       ├── get-equipment-status-distribution.yaml
│       ├── query-fault-reports.yaml
│       ├── query-repair-orders.yaml
│       ├── get-repair-detail.yaml
│       ├── get-fault-trend.yaml
│       ├── query-maintenance-tasks.yaml
│       ├── get-maintenance-detail.yaml
│       ├── query-patrol-tasks.yaml
│       ├── get-patrol-analytics.yaml
│       ├── query-anomaly-records.yaml
│       ├── get-anomaly-statistics.yaml
│       ├── query-spare-parts.yaml
│       ├── get-spare-stock.yaml
│       ├── get-equipment-spare-bom.yaml
│       ├── query-spare-transactions.yaml
│       ├── get-spare-alerts.yaml
│       ├── get-dashboard-summary.yaml
│       ├── get-governance-dashboard.yaml
│       └── get-todo-list.yaml
│
├── mcp-server/                    # EAM MCP Server（独立进程）
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts               # MCP Server 入口
│   │   ├── eam-client.ts          # EAM REST API 客户端
│   │   └── handlers/
│   │       ├── equipment.ts       # 设备域 handlers（4 个工具）
│   │       ├── fault-repair.ts    # 故障维修域 handlers（4 个工具）
│   │       ├── maintenance.ts     # 保养域 handlers（2 个工具）
│   │       ├── patrol.ts          # 巡检域 handlers（4 个工具）
│   │       ├── spare.ts           # 备件域 handlers（5 个工具）
│   │       └── dashboard.ts       # 仪表盘域 handlers（3 个工具）
│   └── tests/
│       └── handlers.test.ts
│
├── prompts/                       # Prompt 模板
│   ├── base-instructions.md       # 基础指令（规则 + 时间映射）
│   ├── tool-selection-guide.md    # 工具选择指南
│   └── few-shot-examples.json     # 4 个 few-shot 编排示例
│
├── tests/
│   ├── lib/
│   │   ├── brain/
│   │   │   ├── router.test.ts
│   │   │   ├── intent.test.ts
│   │   │   ├── prompt-assembler.test.ts
│   │   │   └── confidence.test.ts
│   │   ├── tools/
│   │   │   ├── registry.test.ts
│   │   │   └── yaml-loader.test.ts
│   │   ├── llm/
│   │   │   └── codex-proxy.test.ts
│   │   └── storage/
│   │       └── sqlite.test.ts
│   └── e2e/
│       └── chat-flow.test.ts      # 端到端：输入问题 → 获得结构化回答
│
├── scripts/
│   └── start.sh                   # 一键启动（MCP Server + Next.js）
│
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── .env.local                     # 环境变量（API key 等）
└── vitest.config.ts
```

---

## Task Group 1: 项目骨架 + 存储层

### Task 1.1: 初始化 Next.js 项目

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `.env.local`, `vitest.config.ts`

- [ ] **Step 1: 创建 Next.js 项目**

注意：当前目录已有 docs/、experiments/、CLAUDE.md 等文件。先备份再初始化：

```bash
cd /Users/dingjq/projects/insight68-platform
# 把已有文件暂存
mkdir -p /tmp/mes-backup && cp -r docs experiments CLAUDE.md README.md /tmp/mes-backup/
# 初始化 Next.js（会覆盖部分文件）
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
# 恢复已有文件
cp -r /tmp/mes-backup/* .
```

- [ ] **Step 2: 安装核心依赖**

```bash
npm install openai better-sqlite3 js-yaml
npm install @modelcontextprotocol/sdk
npm install -D vitest @types/better-sqlite3 @types/js-yaml
```

- [ ] **Step 3: 配置 vitest**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
})
```

- [ ] **Step 4: 配置环境变量**

Create `.env.local`:
```
LLM_BASE_URL=https://gptapi.tutu02.us.ci/v1
LLM_API_KEY=sk-insight68-platform-2026
LLM_MODEL=gpt-5.4-mini
EAM_API_BASE_URL=http://localhost:48080
TOOLS_DIR=./tools
```

- [ ] **Step 5: 验证项目启动**

```bash
npm run dev
# 访问 http://localhost:3000 看到 Next.js 默认页面
```

- [ ] **Step 6: 配置 .gitignore**

确保 `.gitignore` 包含：
```
.env.local
data/
node_modules/
.next/
mcp-server/node_modules/
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: init Next.js project with core dependencies"
```

---

### Task 1.2: 全局类型定义

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: 定义核心类型**

定义层间接口类型：`StructuredResult`, `IntentTags`, `RankedTool`, `ToolResult`, `ToolCall`, `RouteResult`, `ToolDefinition`, `ToolExample`, `LLMProvider`, `MemorySession`, `MemoryVerdict`, `MemoryPreference`。

完整类型来源：`docs/specs/platform-design.md` Section 2.3 + Section 4.1 + Section 5.2。

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: define core type interfaces for all layers"
```

---

### Task 1.3: 存储层

**Files:**
- Create: `lib/storage/types.ts`, `lib/storage/sqlite.ts`, `lib/storage/migrations/001-init.sql`
- Test: `tests/lib/storage/sqlite.test.ts`

- [ ] **Step 1: 写 Storage Interface**

定义 `StorageInterface`：insertSession, getSessionsByIntentHash, getVerdict, upsertVerdict, getPreference, setPreference, initialize, close。

- [ ] **Step 2: 写建表 SQL**

4 张表：nl_memory_sessions, nl_memory_verdicts, nl_memory_preferences, nl_users。所有表带 tenant_id（P0 默认 'default'）。字段定义见 spec Section 3.1 + Section 9.2。

- [ ] **Step 3: 写测试**

测试 session CRUD、verdict upsert/get、preference set/get、non-existent 返回 null。

- [ ] **Step 4: 运行测试确认失败**

```bash
npx vitest run tests/lib/storage/sqlite.test.ts
```

- [ ] **Step 5: 实现 SQLiteStorage**

基于 `better-sqlite3`，WAL 模式，JSON 序列化 toolChain 数组字段。

- [ ] **Step 6: 运行测试确认通过**

```bash
npx vitest run tests/lib/storage/sqlite.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add lib/storage/ tests/lib/storage/
git commit -m "feat: implement SQLite storage layer with sessions, verdicts, preferences"
```

---

## Task Group 2: 工具层

### Task 2.1: YAML Loader

**Files:**
- Create: `lib/tools/yaml-loader.ts`
- Test: `tests/lib/tools/yaml-loader.test.ts`

- [ ] **Step 1: 写测试**

验证：加载 22 个 EAM 工具、字段解析正确（domains/operation/supportsFilters/examples/feedsInto）、必填字段校验。

- [ ] **Step 2: 编写 22 个 YAML 工具声明文件**

基于 `docs/plan-a-p1-prompts.md` 中 G2 的 22 个工具设计，创建 `tools/eam/*.yaml`。每个文件遵循 spec Section 4.1 格式。字段来源：
- name/description/inputSchema → G2 工具清单
- domains/operation/supportsFilters/returns → EAM 数据模型
- feedsInto/dependsOn → 测试集多步链路
- examples → 测试集（`docs/plan-a-p2-test-cases.md`）
- whenToUse/whenNotToUse → Prompt V4 工具选择指南

- [ ] **Step 3: 实现 yaml-loader.ts**

扫描 tools/ 子目录，解析 YAML，snake_case → camelCase 字段映射，返回 ToolDefinition[]。

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run tests/lib/tools/yaml-loader.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tools/ lib/tools/yaml-loader.ts tests/lib/tools/
git commit -m "feat: YAML tool declarations (22 EAM tools) + loader"
```

---

### Task 2.2: Tool Registry（匹配 + 执行）

**Files:**
- Create: `lib/tools/registry.ts`, `lib/tools/mcp-client.ts`
- Test: `tests/lib/tools/registry.test.ts`

- [ ] **Step 1: 写测试**

验证：加载 22 工具、domain 匹配、operation 排序、P0 全量返回模式。

- [ ] **Step 2: 实现 registry.ts**

matchScore 计算（domain 40 + operation 30 + filter 20×比例 + chain 10）。排序：matchScore desc → quality desc。P0 模式下 match() 返回全部工具。execute() 接受 MCPClient 实例（由调用方注入），P0 阶段先留 stub 返回 mock，Task 5.1 接通真实 MCP。

- [ ] **Step 3: 实现 mcp-client.ts**

基于 `@modelcontextprotocol/sdk` 的 Client + StdioClientTransport。callTool() 解析 JSON text content → ToolResult。

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run tests/lib/tools/registry.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/tools/ tests/lib/tools/
git commit -m "feat: tool registry with capability matching + MCP client"
```

---

### Task 2.3: EAM MCP Server

**Files:**
- Create: `mcp-server/` 整个目录

P0 返回 mock 数据验证全链路，后续接入 EAM REST API。

- [ ] **Step 1: 初始化 MCP Server 项目**

```bash
mkdir -p mcp-server/src/handlers
cd mcp-server
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node tsx
```

- [ ] **Step 2: 实现 MCP Server 入口**

`mcp-server/src/index.ts`：创建 McpServer，注册 6 个域的 handlers，StdioServerTransport 启动。

- [ ] **Step 3: 实现 6 个域的 handlers（mock 数据）**

按域分文件，每个工具返回符合 EAM 数据模型的 mock JSON：
- `handlers/equipment.ts` — 4 工具
- `handlers/fault-repair.ts` — 4 工具
- `handlers/maintenance.ts` — 2 工具
- `handlers/patrol.ts` — 4 工具
- `handlers/spare.ts` — 5 工具
- `handlers/dashboard.ts` — 3 工具

工具签名严格对齐 YAML 声明的 inputSchema。

- [ ] **Step 4: 验证 MCP Server 启动**

```bash
cd mcp-server && npx tsx src/index.ts
# stderr: "EAM MCP Server running on stdio"
```

- [ ] **Step 5: Commit**

```bash
git add mcp-server/
git commit -m "feat: EAM MCP Server with 22 mock tool handlers"
```

---

## Task Group 3: 智能层

### Task 3.1: LLM Provider (codex-proxy adapter)

**Files:**
- Create: `lib/llm/codex-proxy.ts`
- Test: `tests/lib/llm/codex-proxy.test.ts`

- [ ] **Step 1: 写测试**

验证 route()（简单查询返回 calls）、summarize()（数据总结包含关键数字）。需网络访问 codex-proxy，timeout 30s。

- [ ] **Step 2: 实现 codex-proxy adapter**

基于 `openai` SDK。三个方法：
- route(): 调 chat.completions，temperature=0，解析 JSON 输出
- evaluate(): 调 chat.completions，让 LLM 打分（1-5 三维度）
- summarize(): 调 chat.completions，temperature=0.3，生成自然语言回答

- [ ] **Step 3: 运行测试**

```bash
npx vitest run tests/lib/llm/codex-proxy.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add lib/llm/ tests/lib/llm/
git commit -m "feat: LLM provider abstraction + codex-proxy adapter"
```

---

### Task 3.2: Prompt V4 模板 + 组装器

**Files:**
- Create: `prompts/base-instructions.md`, `prompts/tool-selection-guide.md`, `prompts/few-shot-examples.json`
- Create: `lib/brain/intent.ts`, `lib/brain/prompt-assembler.ts`
- Test: `tests/lib/brain/prompt-assembler.test.ts`

- [ ] **Step 1: 迁移 Prompt V4 到模板文件**

从实验 R5 的 Prompt V4 拆成三个文件。内容来源：experiments/ 中验证通过的完整 Prompt。

- [ ] **Step 2: 写测试（TDD: red first）**

`tests/lib/brain/prompt-assembler.test.ts`：验证组装结果包含工具名、包含选择指南、包含 memory context。
`tests/lib/brain/intent.test.ts`：验证 computeIntentHash 对相同结构意图产生相同 hash，不同意图产生不同 hash。

- [ ] **Step 3: 运行测试确认失败**

```bash
npx vitest run tests/lib/brain/prompt-assembler.test.ts tests/lib/brain/intent.test.ts
```

- [ ] **Step 4: 实现意图提取**

`lib/brain/intent.ts`：computeIntentHash() — 对结构化意图字段排序 + SHA256 截取。P0 简化：intent hash 留空。

- [ ] **Step 5: 实现 Prompt 组装器**

`lib/brain/prompt-assembler.ts`：assemblePrompt(query, tools, memoryContext?) → {systemPrompt, userMessage}。懒加载模板文件，动态生成工具描述和示例。

- [ ] **Step 6: 运行测试确认通过**

```bash
npx vitest run tests/lib/brain/prompt-assembler.test.ts tests/lib/brain/intent.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add lib/brain/intent.ts lib/brain/prompt-assembler.ts prompts/ tests/lib/brain/
git commit -m "feat: Prompt V4 templates + dynamic assembler"
```

---

### Task 3.3: 置信度 + 结果呈现

**Files:**
- Create: `lib/brain/confidence.ts`, `lib/brain/result-presenter.ts`
- Test: `tests/lib/brain/confidence.test.ts`

- [ ] **Step 1: 写测试（TDD: red first）**

`tests/lib/brain/confidence.test.ts`：验证三种场景——全 high→high、mixed→medium、有 low→low。
`tests/lib/brain/result-presenter.test.ts`：验证数据类型检测（single_value/list/timeseries/multi_step）和 StructuredResult 输出结构。

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/lib/brain/confidence.test.ts tests/lib/brain/result-presenter.test.ts
```

- [ ] **Step 3: 实现置信度三信号融合**

三信号（matchScore/verdict/clarity）→ high/medium/low。规则：任意 1 个 low → low；3 个 high → high；其余 → medium。

- [ ] **Step 4: 实现结果呈现引擎**

合并多步工具结果 → 识别数据类型 → LLM summarize → 输出 StructuredResult。

- [ ] **Step 5: 运行测试确认通过**

```bash
npx vitest run tests/lib/brain/confidence.test.ts tests/lib/brain/result-presenter.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add lib/brain/confidence.ts lib/brain/result-presenter.ts tests/lib/brain/
git commit -m "feat: confidence scoring + result presentation engine"
```

---

### Task 3.4: 路由主编排器（9 步流程）

**Files:**
- Create: `lib/brain/router.ts`
- Test: `tests/lib/brain/router.test.ts`

- [ ] **Step 1: 写集成测试（TDD: red first）**

processQuery("系统里有多少台设备？") → 返回含 answer 和 confidence 的 StructuredResult。需 codex-proxy 网络访问。

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/lib/brain/router.test.ts
```

- [ ] **Step 3: 实现 processQuery()**

9 步编排：意图提取 → 工具匹配 → 记忆注入(P0跳过) → Prompt 组装 → LLM 路由 → 置信度判断 → 工具执行 → 结果呈现 → 异步日志。

P0 简化：Step 1 跳过独立 intent 提取，Step 2 返回全部工具，Step 3 无记忆。

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run tests/lib/brain/router.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add lib/brain/router.ts tests/lib/brain/
git commit -m "feat: 9-step routing orchestrator"
```

---

## Task Group 4: 接入层 (Web UI)

### Task 4.1: API Route

**Files:**
- Create: `app/api/chat/route.ts`, `app/api/health/route.ts`

- [ ] **Step 1: 实现 POST /api/chat**

接收 `{query, userId?}`，单例初始化 registry/storage/provider，调用 processQuery()，返回 StructuredResult JSON。

- [ ] **Step 2: 实现 GET /api/health**

返回 `{status: "ok", timestamp, version}`。

- [ ] **Step 3: Commit**

```bash
git add app/api/
git commit -m "feat: /api/chat and /api/health endpoints"
```

---

### Task 4.2: Web UI 组件

**Files:**
- Modify: `app/layout.tsx`, `app/page.tsx`
- Create: `app/components/ChatInput.tsx`, `app/components/ChatMessage.tsx`, `app/components/ResultTable.tsx`, `app/components/ConfidenceHint.tsx`

- [ ] **Step 1: 实现布局和首页**

清爽蓝色系单页聊天界面：顶部标题栏（"Insight68 — 智能查询助手"），中间消息流，底部输入框。

- [ ] **Step 2: 实现 ChatInput**

输入框 + 发送按钮，Enter 发送，发送中 loading。

- [ ] **Step 3: 实现 ChatMessage**

消息气泡，区分用户/系统。系统回答含 answer 文本 + ResultTable(if table) + followUp 按钮 + ConfidenceHint。

- [ ] **Step 4: 实现 ResultTable**

根据 columns + data 渲染响应式表格。蓝色表头，斑马纹。

- [ ] **Step 5: 实现 ConfidenceHint**

high=隐藏，medium=蓝色"这是我的理解"，low=黄色选择题。

- [ ] **Step 6: 验证 UI**

```bash
npm run dev
# http://localhost:3000 输入测试问题
```

- [ ] **Step 7: Commit**

```bash
git add app/
git commit -m "feat: Web UI — chat interface with table and confidence hints"
```

---

## Task Group 5: 端到端集成 + 验收

### Task 5.1: 接通 MCP Server

**Files:**
- Modify: `lib/tools/registry.ts`
- Create: `scripts/start.sh`

- [ ] **Step 1: Registry 接入 MCP Client**

修改 ToolRegistry 构造函数：接收 MCPClient 实例，execute() 代理到 client.callTool()。

- [ ] **Step 2: 创建启动脚本**

`scripts/start.sh`：后台启动 MCP Server → 启动 Next.js → 退出时清理子进程。

- [ ] **Step 3: 端到端手动测试**

启动服务，测试 3 个代表性场景：
1. 简单查询："系统里有多少台设备？"
2. 单步查询："维修工单 WO-001 用了哪些备件？"
3. 多步查询："A 线上月维修用了哪些备件？"

- [ ] **Step 4: Commit**

```bash
git add scripts/ lib/tools/registry.ts
git commit -m "feat: end-to-end integration with MCP Server"
```

---

### Task 5.2: 验收测试

**Files:**
- Create: `tests/e2e/chat-flow.test.ts`

- [ ] **Step 1: 编写冒烟测试**

通过 /api/chat 接口测试核心场景（需服务运行中）：
- L1 简单查询 ×3
- L2 双步查询 ×2
- L3 多步链路 ×1

验证 response 包含 answer、confidence、display 字段。

- [ ] **Step 2: 运行验收**

```bash
npx vitest run tests/e2e/chat-flow.test.ts
```

- [ ] **Step 3: Final Commit**

```bash
git add tests/e2e/
git commit -m "feat: P0 complete — end-to-end EAM NL query platform"
```

---

## Task Summary

| Group | Tasks | 核心产出 |
|-------|-------|---------|
| **1. 骨架+存储** | 1.1-1.3 | Next.js 项目 + 类型定义 + SQLite 存储层 |
| **2. 工具层** | 2.1-2.3 | 22 个 YAML 声明 + Tool Registry + EAM MCP Server |
| **3. 智能层** | 3.1-3.4 | LLM Provider + Prompt V4 组装 + 置信度 + 9 步路由 |
| **4. 接入层** | 4.1-4.2 | /api/chat + Web UI |
| **5. 集成验收** | 5.1-5.2 | MCP 接通 + 验收测试 |

Total: **13 个 Task，约 50 个 Step**。
