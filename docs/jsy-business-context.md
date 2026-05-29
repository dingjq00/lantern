# JSY 业务速查 — AI 写代码时该懂的

> 2026-05-28。精炼自 JSY 源码树的 `findings.md`（完整 352 行快照已拷入本仓：`docs/jsy-findings.md`）
> （完整调研背景去看 `docs/jsy-findings.md`；这里只放 **AI 写 JSY 工具时一定要懂** 的部分）

---

## 1. 两条业务链 — 不要混淆

JSY 是白酒酿造 MES，业务有两条相对独立的链。同事 AI 最常犯的错就是把术语混用：

| | **制曲链**（HandleYeast） | **窖池链**（NCNX 浓香） |
|---|---|---|
| 核心容器 | **曲房**（YeastFermentRoom） | **窖池**（Pit / Unit） |
| 主单 | YeastRoomBatchOrder | POMOrderII |
| 工单号样式 | （多个 ID 字段，无统一前缀） | **`PITN<车间><窖号>_<日期>`**，如 `PITN1101_1187_20250217` |
| 业务编号 | `RoomID`（曲房编号，如 ZL-A12） | `UnitCode`（窖池编号，如 1187）+ `CellarID`（车间窖位） |
| 输入端 | 原辅料（稻壳/小麦）+ 压曲 | 入窖（InPit）— 上排次糟醅 + 新粮 |
| 过程 | 发酵房采集（温/湿/氧/蒸汽） | 发酵 + 出窖 + 润粮 + 馏酒 + 转运 |
| 输出端 | 曲块入曲库（Hut） | 馏酒产酒 → 暂存罐 → 交酒（HandInOrder） |
| 主要工具 | `jsy.ferment.room.profile` / `jsy.ferment.order.search` / `jsy.hut.inventory.search` | `jsy.pit.lifecycle` |
| 控制器 | `RoomInfo/FermentRoom*` / `Inventory/Hut*` / `Order/Yeast*` | `NcnxPitLifecycle` / `MakeWine/SouthBrewProduction` |
| 数据库 | `ssit_yeastbatchorder` / `ssit_hym_*` / `ssit_yeast_operation` | `ssit_Pom_OrderII` / `ssit_Pom_OrderII_InPit/OutPit/Distil/Transfer` |

> 一句话区分：用户说"曲房"/"曲架"/"曲块" → 制曲链；说"窖池"/"PITN"/"出窖"/"馏酒"/"糟源" → 窖池链。

---

## 2. 关键标识符格式

写工具入参时，注意这些 ID 的格式约定：

- **窖池工单 `SelectedOrderID`**：`PITN<车间ID><窖号>_<日期>` — 如 `PITN1101_1187_20250217`
  - 车间映射：11→NJNC01 / 12→NJNC02 / 13→NJNC03
- **窖池业务编号 `UnitCode`**：纯数字字符串（如 "1187"），用户最常给的
- **窖池主键 `UnitPK`**：内部 PK，业务问答中用户不会给
- **曲房编号 `RoomID`**：字符串，业务编号
- **设备主键 `EquPK`**：整数，仓的设备主键（HutInventory 用 `LstEquPK: List<int>` 多仓批量查）
- **批次链路键 `PitLayerLotID`**：跨表（OutPit / Distil / Transfer / InPit）串联用，跟踪糟醅流向的硬关联

---

## 3. 几个业务陷阱 — 写代码时必须当心

### 3.1 "来源窖池" 90% 等于本窖池

`POMOrderII_InPit.Source_PitNo` / `Source_Layer` 是糟源窖池/层。
- 全量 168,883 条 InPit 中，90.36% 的 Source_PitNo == 当前 PitNo（同窖回填）
- 不是单条脏数据，是数据模型常态
- 写 NL 工具时，如果用户问"X 窖的来源"，**默认情况下答"来源 = 本窖池"是正确事实**，不要让 AI 误判为异常
- 如果用户期望看"真正不同的上游窖池"，应该看 `POMOrderII.PrevOrderID + 前序工单 OutPit` 或 `Distil.Source_PitNo1/2` 而不是 InPit.Source_PitNo

### 3.2 `Source_OutTime` 大量是 `1990-01-01 00:00:00`

库里大量 InPit 记录的 `Source_OutTime` 写成 `1990-01-01 00:00:00`（占位时间没被实际出窖时间覆盖）。这是后端写库 bug，不是查询逻辑问题。**handler 不要把这个时间当真实糟源出窖时间用**，要么忽略，要么标注"占位值"。

### 3.3 交酒（HandInOrder）不是出窖的强关联

`POMOrderII.HandInOrderID` 经常是空的。
- 当前样例 `PITN1101_1184_20251108` 的 `HandInOrderID` 为空，但实际有产酒、有交酒记录（在 `JSYMESMainDb.ssit_pom_HandInBill`）
- 旧库 → 新库的 PITN ↔ NJ交酒单映射没建立
- 写 `jsy.pit.lifecycle` 不要假设交酒数据"应该有"；找不到就如实标"未关联"
- 后段执行主链（出窖 → 转运 → 润粮 → 馏酒 → 入窖）不依赖交酒，**交酒是下游不是节点**

### 3.4 工单号 `PITN1101_1187_20250217` 的"_" 不是分隔符

注意 PITN 工单号包含下划线 `_`，但**它整体是一个字符串 ID**，不要在 handler 里 split 它去解析车间/窖号。要拆解就用源头字段（WorkshopID / UnitCode）。

### 3.5 YeastFermentOperation 事件枚举

`ssit_yeast_operation` 表的事件枚举：`倒浆` / `平翻` / `加3高` / `加4高` / `加5高` / `并房` / `头火` / `二火` / `盖草帘` / `判曲`。这些是制曲发酵的工艺动作，做工具入参的 enum 时直接放进 zod 不要翻译。

### 3.6 状态字段经常被冗余

`POMOrderII` 同时有 `OutQMOrderID`（出窖质检）+ `LiquorYield/Alcohol*Quantity`（产出指标）+ `HandInOrderID`（交酒单号）。三者属于"出窖 → 产酒 → 交酒"链的三个阶段，**做工具时分清场景**：算产量看 `LiquorYield`，看质检看 `OutQMOrderID`，问交酒看 `HandInOrderID`，不要混用。

---

## 4. 跨表关联键（联调时按图索骥）

```
POMOrderII (窖池工单主表)
  ├── PrevOrderID  ────────→  POMOrderII (前序排次工单)
  ├── OrderID = SelectedOrderID
  ├── PitLayerLotID ─────┐
  │                      ├──→  POMOrderII_OutPit / Distil / Transfer
  │                      │     (按 PitLayerLotID 串联)
  ├── OutQMOrderID ─────→  质检系统
  ├── HandInOrderID ────→  ssit_pom_HandInBill (旧库)
  └── 子表: _InPit / _OutPit / _Distil / _Transfer

WMS 回写流（旧业务，了解即可，新系统重写中）:
  WMSOrderID → TaskID → ProduceOrderID
```

---

## 5. 时间字段约定

- JSY 后端的 Request 类里 `StartTime` / `EndTime` 一般是 **`string` 类型，不是 DateTime**（前端传 `"2026-04-01"` 字符串）
- 子流水表里 `CreateTime` / `FactoryDate` / `Source_OutTime` 是 SQL Server `datetime` 类型，序列化为 `"2026-04-01T00:00:00"`
- `ProduceDate` 跟 `FactoryDate` 都是"生产日期"语义，不同 controller 用不同字段，**对照 endpoint 清单确认实际字段名**

---

## 6. 配方阶段（FormulaRatio / FormulaWeight）

曲房工单（YeastRoomBatchOrder）跟随配方阶段推进，每个阶段有规定的天数和起始日期。
- handler 返回房间信息时，配方阶段是关键字段（用户问"配方走到哪一步了"）
- 阶段切换由后端按 `WaterStartTime/WaterEndTime/InStartTime/InEndTime/StartTime/StartFirstTime/EndTime/OutFirstTime/OutEndTime` 时间轴推断

---

## 7. 想了解更多 → docs/jsy-findings.md

- `docs/jsy-findings.md`（仓内完整快照；若你本机有 JSY 源码树，源码里的 `findings.md` 是最新源）
- 完整 352 行，含：
  - 2026-05-20 产酒定级与交酒链路排查
  - 2026-05-22 生命周期"来源窖池层"数据库核查
  - 2026-05-22 同窖池来源占比统计
  - 2026-05-22 生命周期里可用的其他来源线索

写复杂工具（特别是 jsy.pit.lifecycle 的扩展、Distil/Transfer 相关工具）前先把 findings 对应段读一遍。
