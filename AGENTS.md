<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Lantern 开发约定

## 开始工作前

- 先阅读 `README.md` 和 `docs/handoff.md`，再根据任务读取相关实现与设计文档。
- 当前实现事实以代码、测试和 `lib/systems.ts` / `skills/` 为准；历史实验报告不自动代表当前行为。
- 仓库可能保留其他人的未提交工作。修改前运行 `git status`，不得覆盖或回退无关变更。

## 项目边界

- Lantern 是面向企业系统的自然语言 API 平台，目前接入 EAM、EDHR、MES、JSY。
- Brain 层负责意图理解、工具编排、结果呈现；MCP handler 负责确定性取数；工具能力由 `skills/**/*.yaml` 声明。
- 不将业务查询改造成 Text-to-SQL 路线，除非有新的明确架构决策。

## 开发与验证

- 中文文档和已有中文模块中的注释保持中文风格。
- 新增系统或能力时，同步核对 YAML skill、MCP handler、`lib/systems.ts` 领域信息、prompt/few-shot 与 benchmark 覆盖。
- 常用验证命令：`npm test`、`npm run lint`、`npm run build`。
- 涉及路由、prompt、工具或数据处理层的修改，需要运行相应 benchmark，或明确记录未运行原因。

## 环境与安全

- 本地配置从 `.env.local` 读取；可提交变量模板见 `.env.example`。
- 禁止将 API key、密码、client secret、token 或生产数据写入代码、prompt、文档和测试样例。
- `TOOLS_DIR` 在当前目录结构下应指向 `./skills`。
- **`ENABLED_SYSTEMS`** 控制运行时启用哪些后端（逗号分隔，不填=全开）。改这个变量后**必须重启 lantern 和 mcp-server**（两边都从 env 读，但都是启动时定的）。配置后会同时过滤：路由器系统视图 / LLM 工具可见性 / MCP server tool 注册。验证方法：`npx vitest run lib/systems.test.ts`，或启动后看 mcp-server stderr 输出的 `ENABLED_SYSTEMS=xxx` 标识。

## JSY 南厂酿酒车间接入约定（2026-05-28 接入中）

**JSY 后端源码路径**（不在 lantern 仓内，需跳到此处看 controller / DTO）：
`<你本机的 JSY 后端源码目录>`（典型为 `…/JSYSmartFactoryII/南厂酿酒车间/`；Windows 现场多为 `D:\SmilSoft\JSYSmartFactoryII\南厂酿酒车间`）
- `Backend/Controllers/` — 66 个 .cs，每文件一组 `[Route]` action
- `Backend/DataInterface/` — 请求/响应 DTO 类定义
- `Backend/Middleware/` — JWT/包装/错误过滤
- 业务背景调研笔记已拷入本仓：`docs/jsy-findings.md`（**关键**，含表名/字段语义/业务规则；352 行完整快照，源以你本机源码树的 `findings.md` 为准）

**接入产物位置**：
- 客户端：`mcp-server/src/jsy-api.ts`（JWT + 解包 + 自动重登 + 分页）
- 工具：`mcp-server/src/handlers/jsy/*.ts` + `skills/jsy/*.yaml`（一一对应）
- 注册：`mcp-server/src/index.ts` + `lib/systems.ts`（SYSTEM_REGISTRY.jsy）
- 文档：`docs/jsy-endpoints.md`（589 endpoint 全清单）/ `docs/jsy-onboarding.md`（人读手册）/ `docs/jsy-tool-plan.md`（剩余 15 工具规划）/ `docs/jsy-business-context.md`（业务速查）
- 测试：`npx tsx scripts/jsy/test-tool.ts <tool> '<json-args>'`

**红线**（违反则 review 不过）：
1. **写操作完全不接** — Save / Delete / Create / Add / Update / Edit / Modify / Set / Transition / Remove / Insert / SoftDelete / Confirm / Approve / Submit / Lock / Reset / Clear 前缀的 endpoint 一律跳过。
2. **服务端字段 PascalCase 不要"修正"** — Newtonsoft.Json 大小写敏感，例如 `VerifiCationCode`（拼写就是这样）改成 `VerificationCode` 后端拿不到。
3. **响应 Code = 200 才是 Success**（不是 0！），`jsy-api.ts` 已处理，新增工具用 `jsyPost()` 即可。
4. **上帝口令 `oiiaioiiiai`** 仅供本机/测试联调用 (`JSY_GOD_TOKEN=1`)，严禁提交进 git 或上生产。

**新增 JSY 工具的标准流程**（参照 `mcp-server/src/handlers/jsy/_TEMPLATE.ts.example`）：
1. handler — 复制 `_TEMPLATE.ts.example`，改名 + 改业务参数 + 改 body 映射
2. yaml — 在 `skills/jsy/` 新建同名 `.yaml`，参照 `pit-lifecycle.yaml`
3. index.ts — 顶部 import + 注册区调用 + 末尾 console.error 统计 +1
4. 验证 — `npm run build` 类型过 → `npx tsx scripts/jsy/test-tool.ts ...` 跑通
5. 业务术语补 `lib/systems.ts` 的 `SYSTEM_REGISTRY.jsy.businessGlossary`

**做新工具前必读**：`docs/jsy-tool-plan.md` 已经把 P1-P3 共 15 个工具的 endpoint 映射 / 入参草图 / when_to_use 写好了，按 P1 → P2 → P3 顺序，不要乱挑。
