# JSY 工具规划 — P1-P3 共 15 个待做工具

> 2026-05-28。P0 4 个已实现，本文档列剩余 15 个工具的预设规划。
> 每个工具按 `对接 endpoint / 入参字段映射 / when_to_use 提示 / 注意点` 四段写。
> 接手时按 P1 → P2 → P3 顺序做，先做完一个跑通再做下一个（不要批量动）。

---

## 全表

| 优先级 | 工具名 | 对接 endpoint 数 | 主要来源 controller |
|---|---|---:|---|
| P0 | jsy.pit.lifecycle ✅ | 1 (聚合) | NcnxPitLifecycle |
| P0 | jsy.ferment.room.profile ✅ | 1 | FermentRoom |
| P0 | jsy.ferment.order.search ✅ | 1 | FermentRoom |
| P0 | jsy.hut.inventory.search ✅ | 2 | HutInventory |
| **P1** | jsy.lims.search | ~5 | General.GetLimsOrder* + Check |
| **P1** | jsy.dayplan.search | ~6 | PlanOrder/ZQDay + YFLDay |
| **P1** | jsy.materials.search | ~8 | Materials |
| **P1** | jsy.order.search | ~10 | Order |
| **P1** | jsy.ai.overview | 4 | AIAnalysis |
| **P2** | jsy.equipment.search | ~10 | Equipment + General.GetEqu* |
| **P2** | jsy.warning.search | ~10 | Warning + FermentRoom.Warning |
| **P2** | jsy.workflow.search | ~8 | General.Tickets/Workflow |
| **P2** | jsy.formula.profile | ~10 | Formula + General.Process |
| **P2** | jsy.makewine.production | ~15 | MakeWine/SouthBrew |
| **P3** | jsy.lookup | ~20 | General.Get* 字典类 |
| **P3** | jsy.org.search | ~24 | General.WorkTeam/Schedul/Position |
| **P3** | jsy.report.* | ~30 | Ncnx*Report + 月年计划 + WeeklyReport |
| **P3** | jsy.opc.realtime | ~13 | OPC + SiloScada |

---

## P1.1 jsy.lims.search — 化验/LIMS 查询

**对接 endpoint**（General + Check 域）：
- `POST /General/GetLimsOrder` — LIMS 工单列表（GeneralRequest → GetDataByPageVo<GeneralLimsVO>）
- `POST /General/GetLimsOrderByID` — 按工单 ID 查（→ GetDataByPageVo<CheckOrder>）
- `POST /General/getLimsLevelReportData` — 定级报表
- `POST /General/getDQLimsReportData` — 大曲 LIMS 报表
- `POST /CheckOrder/...` — 物化指标主检索（PhysicochemicalIndicatorsController.cs，8 个 endpoint 自挑）

**入参**：
```typescript
{
  mode: 'search' | 'profile' | 'levelReport',
  orderId?: string,      // profile 模式必填
  dateRange?: { from, to },
  qzType?: string,       // 曲种过滤
  passed?: boolean,      // 是否合格
}
```

**when_to_use 样例**：
- 用户问 "上周哪些批次化验不合格" → mode=search + passed=false + dateRange
- 用户问 "工单 X 的化验结果" → mode=profile + orderId
- 用户问 "大曲定级分布" → mode=levelReport

**注意点**：
- LIMS 工单跟生产工单是关联但独立的体系，命名带 "LIMS" 是质检系统的工单
- `getDQLimsReportData` 专门给大曲（DQ）用，跟普通 LIMS 报表不一样

---

## P1.2 jsy.dayplan.search — 日计划查询

**对接 endpoint**（PlanOrder/ZQDay + YFLDay）：
- `POST /ZQDayPlanOrder/...` — 26 个 endpoint，需要从源码挑核心几个：
  - `getDataByDate` / `getDataByOrderId` / `MaterialBatchDetails` / `getqfList`（findings 提到 LifecycleTrace 用的就是这组）
- `POST /YFLDayPlanOrder/...` — 14 个 endpoint，照搬 ZQ 模式

**入参**：
```typescript
{
  type: 'zq' | 'yfl',          // ZQ=制曲日计划，YFL=原辅料日计划
  date?: string,                // 单日
  dateRange?: { from, to },     // 多日
  orderId?: string,             // 单工单
  includeMaterialBatches?: boolean,  // 是否加载原料批次明细
  includeQfList?: boolean,           // 是否加载曲房列表
}
```

**when_to_use 样例**：
- 用户问 "今天的制曲日计划" → type=zq + date
- 用户问 "X 日计划工单详情" → orderId
- 用户问 "X 日计划用了哪些原料批次" → orderId + includeMaterialBatches

**注意点**：
- `docs/jsy-findings.md` 重点提到 `LifecycleTrace.vue` 复用 ZQDayPlanOrder 的接口 — 做窖池履历的同学需要这套
- ZQ vs YFL 是两条日计划，业务上要区分

---

## P1.3 jsy.materials.search — 原辅料查询

**对接 endpoint**（Materials/MaterialsController.cs 等 5 个）：
- 该域 31 endpoint，写操作过半（Save/Delete/Output/Restore），**只接 read**：
  - 读类型：GetMaterials / GetMaterialBatch / Detail / Chart / RiceCookChart / Output 报表 read 部分

**入参**：
```typescript
{
  mode: 'list' | 'batch' | 'output',
  materialCode?: string,
  batchId?: string,
  dateRange?: { from, to },
}
```

**注意点**：稻壳蒸煮（RiceCook）是个特殊业务，曲线数据量大，要不要加单独 mode 视联调实际看。

---

## P1.4 jsy.order.search — 工单搜索

**对接 endpoint**（Order/ 5 个 controller）：
- `Order/OrderController.cs` — 主工单 8 endpoint
- `Order/YeastMillingOrderController.cs` — 磨曲工单 6 endpoint
- `Order/YeastInWarehouseOrderController.cs` — 曲入库工单 8 endpoint
- `Order/YeastOutWarehouseOrderController.cs` — 曲出库工单 8 endpoint
- `Order/BendingMachineController.cs` — 压曲机工单 5 endpoint

**入参**：
```typescript
{
  orderType: 'main' | 'milling' | 'in_warehouse' | 'out_warehouse' | 'bending',
  orderId?: string,
  status?: string,
  dateRange?: { from, to },
  pageNo?, pageSize?,
}
```

**注意点**：lantern MES 的 order.search 是个好参照（mes/order-search.ts），照葫芦画瓢即可。

---

## P1.5 jsy.ai.overview — 异常/产能/巡检智能分析

**对接 endpoint**（AIAnalysisController.cs 4 个）：
- `POST /aiAnalysis/qufang/AnomalyOverview` — 异常总览
- `POST /aiAnalysis/qufang/ProductionOverview` — 产能总览
- `POST /aiAnalysis/qufang/InspectionOverview` — 巡检总览
- （第 4 个看源码挑）

**入参**：
```typescript
{
  dimension: 'anomaly' | 'production' | 'inspection',
  dateRange?: { from, to },
  workshopId?: string,
}
```

**注意点**：
- `docs/jsy-findings.md` 提到 `AIAnalysisController` 是"曲房概览/异常分析/巡检分析"已有聚合，适合做"系统整体什么情况"类问题
- 三个 overview 内部已经做了聚合，本工具不必再 fan-out

---

## P2.1 jsy.equipment.search — 设备查询

**对接**：
- `Equipment/EquipmentController.cs` 30 endpoint + `General.GetEqu*` 8 endpoint
- 只接 read（去掉 Save/Delete/Update）

**入参**：
```typescript
{ equType?, equArea?, lineId?, search?, includeProperties? }
```

---

## P2.2 jsy.warning.search — 告警查询

**对接**：
- `Warning/WarningController.cs` 12 endpoint
- 注意 `FermentRoom/RoomWarning` 也是告警，但属于曲房子域

**入参**：
```typescript
{ scope: 'global' | 'room', warningType?, level?, dateRange?, resolved? }
```

---

## P2.3 jsy.workflow.search — 工单流程查询

**对接**（General 工单流程域 14 endpoint，**只读**）：
- `GetWorkflowType` / `GetWorkTypeList` / `GetTicketsList` / `GetTicketDetail` / `GetTicketTransitions` / `GetWorkflowSystemRoles`

**入参**：
```typescript
{ mode: 'list' | 'detail', workflowType?, ticketId?, status?, dateRange? }
```

---

## P2.4 jsy.formula.profile — 配方/工艺查询

**对接**：
- `Formula/FormulaController.cs` 10 endpoint
- `General.GetProcess / getProcessDetail / GetProcessParameters` 4 endpoint

**入参**：
```typescript
{ formulaId?, qzType?, includeProcess?, includeParameters? }
```

---

## P2.5 jsy.makewine.production — 酿造生产查询

**对接**：
- `MakeWine/SouthBrewProductionController.cs` 22 endpoint
- `MakeWine/MakeWineBaseController.cs` 2 endpoint

**入参**：
```typescript
{ mode, dateRange?, pitNo?, includeBoardData? }
```

**注意点**：南厂酿造业务的执行端，跟 NcnxPitLifecycle 是同一条业务链但视角不同（NCNX 是"窖池视角"，MakeWine 是"生产任务视角"）。

---

## P3.1 jsy.lookup — 主数据字典

**对接**（General 中的 Get 类静态主数据，**只 list 不要 Save/Delete**）：
- `GetLocation` 车间 / `GetLine` 产线 / `GetProcess` 工序 / `GetTrick` 班次 / `GetCheckType` 检测类型 / `GetCheckItem` 检测项 / `GetCheckGroup` 检测分组

**入参**：
```typescript
{ entity: 'workshop' | 'line' | 'process' | 'trick' | 'checkType' | 'checkItem' | 'checkGroup', filter? }
```

**注意点**：一个工具用 `entity` 分发到不同 endpoint。LLM 拿到的下拉数据多用于"枚举可选项"场景。

---

## P3.2 jsy.org.search — 组织架构查询

**对接**：班组/成员/岗位/排班/部门/用户 — General 24 个 endpoint 中的 read 类

**入参**：
```typescript
{ mode: 'team' | 'user' | 'position' | 'schedule' | 'department', filter? }
```

---

## P3.3 jsy.report.* — 报表（建议拆 3 个工具）

报表型工具不要做成单一大入口，按周/月/年分开：
- `jsy.report.weekly` — `FermentRoom/FermentRoomWeeklyReport*` 13 endpoint
- `jsy.report.monthly` — `PlanOrder/ZQMonth + YFLMonth` 8 endpoint
- `jsy.report.yearly` — `PlanOrder/ZQYear + YFLYear` 8 endpoint
- 还有 `Ncnx*Report` 系列 4 个 — 按 NCNX 业务归到 jsy.makewine.production 或单独 jsy.report.ncnx

---

## P3.4 jsy.opc.realtime — PLC/SCADA 实时点位

**对接**：
- `OPC/OPCController.cs` 12 endpoint
- `SiloScada/SiloScadaController.cs` 9 endpoint
- `OPC/MaterialTempStockController.cs` 2 endpoint

**入参**：
```typescript
{ scope: 'opc' | 'silo' | 'materialTemp', pointId? }
```

**注意点**：实时点位数据量大、变化快，工具返回时**必须做时间窗采样**（同事最容易忽略的点）。

---

## 总体进度估算

- P0 完成（已交付）
- P1 — 5 个工具，每个 0.5~1 工作日，总计 ~5 工作日
- P2 — 5 个工具，业务规则更复杂，总计 ~7 工作日
- P3 — 5 个工具，多是聚合 + 适配，总计 ~5 工作日

**总计 ~17 工作日**完成 19 个工具全量，覆盖 JSY 系统 ~250 个查询 endpoint。

---

## 取舍参考

每做一个 P1 工具时问自己：

1. **这个 endpoint 在前端哪个页面被调？**（开 `Frontend/src/views/` 搜路径找）— 看真实用户场景而不是凭想象
2. **NL 问题最常见的样式是什么？** — 三个用户最可能的问法写到 yaml 的 examples 里
3. **要不要 fan-out 调多个 endpoint？** — 默认不要；只有当"一个用户问题必须组合多个数据源"时再聚合
4. **返回字段裁剪了没？** — 透传 + 裁剪都是选项。第一版透传，找到大返回的工具再加裁剪

工具不是越多越好。lantern 现有 EAM 12 / EDHR 7 / MES 10 都是反复打磨过的"少而精"。JSY 目标 ~19 是上限，能 15 个搞定就 15 个。

---

> 接手过程中有任何"我不确定要不要这么做"的地方，先在 commit 里写清楚 "为什么这么选"，让 dingjq 师傅 review。不要为了"看着完成"而漏掉判断。
