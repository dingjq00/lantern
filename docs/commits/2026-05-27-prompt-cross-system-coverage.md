# 独立提交说明：Prompt 跨系统覆盖与观察注入

> 用途：与 R1/R2 代码改动拆仓提交时，仅 `git add` 本说明列出的文件。  
> 建议在本提交前后各跑一次 `npx tsx scripts/benchmark-platform.ts --cross` 留存对比。

## 建议 commit message

```
prompt: 强化跨系统覆盖与多系统 few-shot，泛化全景工具表述

用户未指定系统时，引导 ReAct 审查轮补查其他系统的同类概念；
观察消息展示已查系统列表；few-shot 增加系统覆盖检查与跨概念分系统查询示例。
去除 system-prompt 中仅列举 EAM/EDHR 的表述，避免模型忽视 MES。
```

## 纳入本提交的文件

| 文件 | 变更要点 |
| --- | --- |
| `prompts/system-prompt.md` | 去掉「如 EAM、EDHR」等单系统举例，改为泛化「多个业务系统」 |
| `prompts/base-instructions.md` | 全景工具说明从「故障+保养+巡检+BOM」改为通用的 profile 多域聚合 |
| `prompts/react-instructions.md` | `[验证]` 增加跨系统全覆盖；关键规则 profile 表述泛化；**含 R2 跨系统因果约束**（若希望 prompt 提交纯覆盖、因果另提，见下方拆分） |
| `prompts/few-shot-examples.json` | +2 条：`think②` 未指定系统时补查 mes/edhr trend；跨系统「故障设备 + 产线生产」 |
| `lib/brain/observation.ts` | 观察消息增加 `已查系统: [...]`，结尾改为跨系统概念覆盖审查话术 |

## 建议不要纳入本提交（属 R1/R2 工程改动）

- `lib/brain/summarize-context.ts`、`data-digest.ts`、`cross-system-bridge.ts`、`systems.ts`（R2 数据层）
- `lib/brain/confidence.ts`、`relevance-checker.ts`、`router.ts`（R1 置信度与 ToolInvocation）
- `data/platform-test-cases.ts`、`lib/benchmark/`（用例与 manifest）
- `app/components/TracePanel.tsx`、`app/benchmark/page.tsx`（UI 展示 dataRelevance）

## 与 R2 prompt 的边界（可选二次拆分）

`prompts/react-instructions.md` 中「### 跨系统回答约束」属于 R2.2（因果表述），若希望提交历史更清晰：

1. **本提交**：system / base / few-shot + observation + react 的 `[验证]`/关键规则泛化  
2. **后续提交**：react 的「跨系统回答约束」整段 + `CROSS_SYSTEM_BRIDGES` 相关代码

当前仓库中两者已在同一 diff，合并提交亦可，benchmark 记录里注明 `promptVersion` 即可。

## 验证清单

- [ ] `npm test`（含 `observation.test.ts` 的 `已查系统` 断言）
- [ ] `npx tsx scripts/benchmark-platform.ts --cross`（对比改前 recall / forbidden）
- [ ] 记录：`datasetVersion`、`commitSha`、`LLM_MODEL=deepseek-v4-flash`

## 预期行为变化

1. 用户问「工单趋势」且未指定系统 → 审查轮更倾向补查 eam/mes/edhr 中未覆盖的系统。  
2. 观察轮 JSON 后附带「已查系统: [eam]」→ 模型可见当前系统覆盖缺口。  
3. 跨系统问题（故障 + 生产）→ few-shot 示范并行选 eam + mes 工具，而非只查首系统。
