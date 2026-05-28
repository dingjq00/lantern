# JSY 南厂酿酒车间 — 同事接手手册

> 2026-05-28 创建。负责人：dingjq（师傅）。本机连不上服务器，本份是"看到服务器就能跑"的交付。

---

## 你拿到了什么

四份交付物，按重要性排：

| 文件 | 用途 |
|---|---|
| **`docs/jsy-endpoints.md`** | JSY 后端 589 个 HTTP endpoint 的全清单（按 controller 分组，带 XML 注释） |
| **`mcp-server/src/handlers/jsy/`** + **`skills/jsy/`** | 已实现的 P0 4 个工具，覆盖窖池履历/曲房/发酵工单/曲库 |
| **`docs/jsy-tool-plan.md`** | P1-P3 15 个工具的预设规划，照着继续做 |
| **`scripts/jsy/extract-endpoints.py`** | endpoint 清单的生成脚本，源码更新后可重跑 |

---

## 五分钟跑通

**前置条件**：lantern 主仓已经在跑，EAM/EDHR/MES 三系统已经接好。

### 1. 配置环境变量

在 lantern 仓根目录的 `.env.local`（不存在就建）加：

```bash
# 只挂 JSY，其他三系统不参与（避免 LLM 看到连不上的工具浪费 ReAct 轮次）
ENABLED_SYSTEMS=jsy

# JSY 后端 base URL — IIS 部署
JSY_API_BASE_URL=http://<JSY_HOST>:<PORT>
JSY_USERNAME=<工号>
JSY_PASSWORD=<密码>

# 联调旁路（可选）— 走"上帝口令"跳过登录，本机/测试环境用，生产严禁
# JSY_GOD_TOKEN=1
```

> 师傅本机三系统并跑时设 `ENABLED_SYSTEMS=eam,mes,jsy`；不填 = 全开（向后兼容）。
> 改这个变量必须重启 lantern 和 mcp-server。

> **上帝口令说明**：JSY 后端代码内硬编码 `MaxLevelToken = "oiiaioiiiai"`，任何带这个 token 的请求都通过 Authorization。手册里写出来是为了你联调便利，**任何情况下不要把 `JSY_GOD_TOKEN=1` 提交进 git 或上生产**。

### 2. 编译 mcp-server

```bash
cd mcp-server
npm install
npm run build
```

应当看到 `dist/handlers/jsy/` 下生成 4 个 `.js`。

### 3. 跑一个调用验证

最简单的 smoke test 是 `jsy.ferment.room.profile`（单参数、单 endpoint、easy to verify）：

```bash
# 在 lantern 前端，问一句："ZL-A12 号曲房什么状态？"
# 或者用 curl 直接走 MCP stdio：
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jsy.ferment.room.profile","arguments":{"roomId":"<现场实际曲房编号>"}}}' \
  | node mcp-server/dist/index.js
```

期望：返回一个 JSON 含房间信息。如果走通这一个，token 链路 + 解包 + 路由都对了。

---

## 接入红线（**写操作不接**）

JSY 后端 589 个 endpoint 里有约 160 个是写操作（Save/Delete/Create/Add/Update/Edit/Modify/Set/Transition/Remove/Insert）。

**lantern 是 NL 查询平台，永远不接写操作。** 原因：

1. NL 查询误调写操作的代价远高于查询（删车间、改班组、insert 错数据）
2. 业务校验逻辑在前端页面里，MCP 直调后端不会执行前端校验
3. lantern 没有"写操作审批/二次确认"机制

写操作识别 — handler 名以这些前缀开头的一律跳过：
`Save / Add / Create / Insert / Update / Edit / Modify / Set / Delete / Remove / Transition / SoftDelete / StatusDelete / StatusSave / Merge / Split / Enter / Confirm / DoFinish / Prepare / Copy / Import / Cancel / Reject / Approve / Submit / Send / Lock / Unlock / Reset / Clear`

---

## 新增一个工具的三步走

参考 `mcp-server/src/handlers/jsy/ferment-room-profile.ts`（最简单的样板）。

### Step 1：写 handler

`mcp-server/src/handlers/jsy/<tool-name>.ts`：

```typescript
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { jsyPost } from '../../jsy-api.js'
import { textResult } from '../../shared.js'

export function registerJsyXxx(server: McpServer) {
  server.tool(
    'jsy.xxx',
    '工具说明（LLM 看的）— 写清楚什么时候用本工具',
    {
      // zod schema —— 字段命名用业务语义（camelCase），不要直接搬服务端 PascalCase
      param1: z.string().describe('字段含义和用法'),
    },
    async (args) => {
      // 入参 → 服务端字段映射
      const body = {
        ServerFieldName: args.param1,
      }
      const data = await jsyPost('/some/endpoint', body)
      return textResult(data)
    },
  )
}
```

### Step 2：写 skill yaml

`skills/jsy/<tool-name>.yaml` — 照 `pit-lifecycle.yaml` 改。三段最关键：
- `description` — 一句话总结，跟 handler 里那句一致
- `when_to_use` — 列具体问题样式，越具体越能帮 LLM 路由
- `when_not_to_use` — 跟其他 jsy.* 工具的边界，写清楚

### Step 3：注册到 index.ts

`mcp-server/src/index.ts` 三处加：

```typescript
// 顶部 import
import { registerJsyXxx } from './handlers/jsy/xxx.js'

// register 区
registerJsyXxx(server)

// 末尾日志统计 +1
console.error(`... + JSY 5)`)
```

### 验证

```bash
cd mcp-server && npm run build
# 然后用 lantern 前端跑一个能触发此工具的问题
```

---

## 字段映射 — 服务端 PascalCase 不要"修正"

JSY 服务端的 Request/Response 字段名一律 **PascalCase**（`UnitCode`、`SelectedOrderID`）。

handler 入参用业务 camelCase（`unitCode`、`orderId`），但 **body 里必须保留服务端原拼写**。Newtonsoft.Json 默认大小写敏感，写错就拿不到数据。

例如服务端字段 `VerifiCationCode`（验证码，拼写就是这样，C 大写） — 不要"修正"成 `VerificationCode`。

---

## 联调常见坑

### Code 不是 0，是 200

JSY 响应包装 `{ Code, Msg, Data }`：

- `Code = 200` → Success（**注意：不是 0**，跟 EAM 的 code:0=success 不同）
- `Code = -1` → Failure
- `Code = 0` → Unknown

`jsy-api.ts` 里已经处理，不用动。

### 401 / 402 区别

- `401 Unauthorized` → token 缺失/无效（错的 token、过期被服务端踢）
- `402 PaymentRequired` → token 超时（JWT 内部 exp 过了，服务端用 402 表达）

`jsy-api.ts` 在拿到 401/402 时自动重登一次。如果重登后还是失败，会抛 `JsyApiError`，看 stderr。

### 分页字段

`GetDataByPageVo<T>` 的实际字段名待联调确认。`jsy-api.ts:jsyGetAllPages` 兼容了 `rows | list | data` 和 `total | totalCount` 几种可能拼写，第一次联调时打开网络面板看返回的实际字段，统一在 `JsyPageResult` 类型里固定。

### 字段裁剪

P0 4 个 handler 都是 **透传不裁剪** Response。如果联调发现某个工具返回过大（>50KB），需要在 handler 里加裁剪。原则：

- 去掉给前端做下拉框的字段（Workshops/UnitOptions/CrossOptions 等）
- 去掉曲线点位（点数多但 NL 分析用不到原始点，给统计摘要够）
- 保留时间轴 + 数量 + 状态 + 业务标识

---

## DEBUG 模式说明

JSY 后端 `Backend/Middleware/AuthorizationFiliterAttribute.cs` 里写了：

```csharp
#if DEBUG
if (!context.Request.Headers.Contains("X-Real-IP") && context.RequestContext.IsLocal)
    return;  // 本机 IIS Debug + 没走反代 → 免 token
#endif
```

这意味着：**JSY 后端在本机 Debug 模式 + 直连 IIS** 时，所有请求免 token。这对你本机起 IIS 调试有意义，但 lantern 通过远程 IP 调用时**走不到这条**，token 还是要带。

---

## 排错优先级

按这个顺序排：

1. 编译过没 → `npm run build` 看错
2. 配置对没 → 检查 `JSY_API_BASE_URL` 能不能 curl 到（先 ping `/PublicKey`，公开接口不需要 token）
3. 登录对没 → 用 curl 跑一次 `POST /Login`，看返回 `{Code:200, Data:{Token:...}}`
4. 路由对没 → MCP 工具的 `maps_to` 名字、index.ts 注册名一致
5. 服务端报错 → 看 `JsyApiError` 的 `serverMsg`，对照 `findings.md` 里业务规则

---

## 下一步

读 **`docs/jsy-tool-plan.md`** — 那里有 P1-P3 共 15 个工具的"该做什么、对接哪个 endpoint、入参字段映射"的预设。按 P1 → P2 → P3 顺序做就行。

每完成一批，重跑 `python3 scripts/jsy/extract-endpoints.py`（如果 JSY 源码更新了），重生成 `docs/jsy-endpoints.md`。

---

## 给你的 AI 助手（Claude / Cursor / Copilot）的开场白

直接把下面这段复制给你的 AI，它会比"无脑读 CLAUDE.md"快很多。

```
我接手了 lantern NL-API 平台的 JSY 南厂酿酒车间系统接入。任务：按 docs/jsy-tool-plan.md
的 P1-P3 顺序，新增 jsy.* MCP 工具。开始前必须做：

1. 读 AGENTS.md 的 "JSY 南厂酿酒车间接入约定" 一节 — 红线、源码路径、新增工具流程
2. 读 docs/jsy-business-context.md — 制曲链 vs 窖池链区分、关键标识符、6 大业务陷阱
3. 读一个现有工具样板：mcp-server/src/handlers/jsy/ferment-room-profile.ts（最简单）
   或 mcp-server/src/handlers/jsy/pit-lifecycle.ts（含 Load* 开关聚合）
4. 看 docs/jsy-tool-plan.md 里你要做的那个工具的"对接 endpoint / 入参 / when_to_use"预设
5. 写新工具时复制 mcp-server/src/handlers/jsy/_TEMPLATE.ts.example 改

红线（不要踩）：
- 写操作完全不接（Save/Delete/Create/Add/Update/Edit/Modify/Set/Transition/Remove 前缀）
- 服务端字段 PascalCase 别"修正"为 camelCase（Newtonsoft.Json 大小写敏感）
- 响应包装 Code=200 才是 Success，不是 0
- 上帝口令 oiiaioiiiai 不写进 git

JSY 源码（DTO/Controller 在这里看）：
/Users/dingjq/IdeaProjects/JSYSmartFactoryII/南厂酿酒车间/Backend/

测试新工具一行命令：
npx tsx scripts/jsy/test-tool.ts <tool-name> '<json-args>'

完整 endpoint 清单（589 条）：docs/jsy-endpoints.md（按 controller 分组，搜索可用）

只挂 JSY 不要其他系统干扰：在 .env.local 设 ENABLED_SYSTEMS=jsy（lantern + mcp-server 都要重启）
```
