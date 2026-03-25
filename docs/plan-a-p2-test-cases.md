# 方案 A — P2 测试集

> 共 40 题，按 L1-L5 分级。每题标注涉及的数据域和桥接表。
> Ground Truth 分别给出 G1/G2/G3 三组的期望输出。

---

## L1 — 单操作直查（10 题）

### T01 "现在系统里一共有多少台设备？"

- **域**：设备
- **G1**：`GET /eam/dashboard/summary` → 取 totalEquipment
- **G2**：`get_dashboard_summary` → 取 totalEquipment
- **G3**：`QUERY equipment AGGREGATE COUNT`

### T02 "当前有几个待审核的故障报修？"

- **域**：故障
- **G1**：`GET /eam/dashboard/summary` → 取 pendingReports 或 `GET /eam/fault-report/status-stats`
- **G2**：`get_dashboard_summary` → 取 pendingReports
- **G3**：`QUERY fault_report WHERE status = 0 AGGREGATE COUNT`

### T03 "设备 EQ-001 的详细信息是什么？"

- **域**：设备
- **G1**：`GET /eam/equipment/get {id: "EQ-001"}`
- **G2**：`get_equipment_detail {equipmentId: "EQ-001"}`
- **G3**：`QUERY equipment WHERE equipment_code = "EQ-001"`

### T04 "各状态的设备数量分布是怎样的？"

- **域**：设备
- **G1**：`GET /eam/dashboard/equipment-status-distribution`
- **G2**：`get_equipment_status_distribution`
- **G3**：`QUERY equipment AGGREGATE COUNT ORDER BY status`

### T05 "最近 30 天的故障趋势怎么样？"

- **域**：故障
- **G1**：`GET /eam/dashboard/fault-trend`
- **G2**：`get_fault_trend {days: 30}`
- **G3**：`QUERY fault_report WHERE report_time >= "2026-02-23" AGGREGATE COUNT ORDER BY report_time`

### T06 "巡检异常的整体统计指标是什么？"

- **域**：巡检/异常
- **G1**：`GET /eam/anomaly/statistics`
- **G2**：`get_anomaly_statistics`
- **G3**：`QUERY anomaly_record AGGREGATE COUNT`

### T07 "当前有哪些库存预警？"

- **域**：备件
- **G1**：`GET /eam/spare/alert/list`
- **G2**：`get_spare_alerts`
- **G3**：`QUERY spare_stock WHERE quantity < safety_line`

### T08 "我有哪些待办事项？"

- **域**：综合
- **G1**：`GET /eam/dashboard/todo-list`
- **G2**：`get_todo_list`
- **G3**：*(DSL 难以表达多源聚合待办，预期 unsupported)*

### T09 "维修工单目前各状态有多少个？"

- **域**：维修
- **G1**：`GET /eam/repair-order/status-stats`
- **G2**：`query_repair_orders` → 按 status 分组（或用 get_dashboard_summary）
- **G3**：`QUERY repair_order AGGREGATE COUNT ORDER BY status`

### T10 "设备分类中哪类设备最多？"

- **域**：设备
- **G1**：`GET /eam/dashboard/category-distribution`
- **G2**：`query_equipment` → 按 category 聚合（注：G2 无直接对应工具，需 get_dashboard_summary 级别能力）
- **G3**：`QUERY equipment AGGREGATE COUNT ORDER BY category_id DESC LIMIT 1`

---

## L2 — 双操作关联（10 题）

### T11 "上月故障最多的设备是哪台？"

- **域**：故障 → 设备
- **G1**：`GET /eam/fault-report/page {reportTimeBegin: "2026-02-01", reportTimeEnd: "2026-02-28"}` → 按 equipmentId 分组计数
- **G2**：`query_fault_reports {dateRange: {start: "2026-02-01", end: "2026-02-28"}}` → 按设备聚合
- **G3**：`QUERY fault_report WHERE report_time BETWEEN "2026-02-01" AND "2026-02-28" AGGREGATE COUNT ORDER BY COUNT DESC LIMIT 1`

### T12 "维修工单 WO-001 用了哪些备件？"

- **域**：维修 → 备件
- **G1**：`GET /eam/repair-order/spare/list {repairOrderId: "WO-001"}`
- **G2**：`get_repair_detail {repairOrderId: "WO-001"}` → 取备件清单
- **G3**：`QUERY repair_spare_usage WHERE repair_order_id = "WO-001" JOIN spare_part`

### T13 "设备 EQ-002 的保养任务执行情况怎样？"

- **域**：设备 → 保养
- **G1**：`GET /eam/maintenance/task/page {equipmentId: "EQ-002"}`
- **G2**：`query_maintenance_tasks {equipmentId: "EQ-002"}`
- **G3**：`QUERY maintenance_task WHERE equipment_id = "EQ-002"`

### T14 "近 7 天完成了几个巡检任务？"

- **域**：巡检
- **G1**：`GET /eam/patrol/task/page {status: 已完成, startTimeBegin: "2026-03-18"}` → 取总数
- **G2**：`query_patrol_tasks {status: 已完成, dateRange: {start: "2026-03-18", end: "2026-03-25"}}`
- **G3**：`QUERY patrol_task WHERE status = "completed" AND start_time >= "2026-03-18" AGGREGATE COUNT`

### T15 "当前维修中的设备都是哪些？"

- **域**：设备
- **G1**：`GET /eam/equipment/page {status: 2}`
- **G2**：`query_equipment {status: 2}`
- **G3**：`QUERY equipment WHERE status = 2`

### T16 "备件 SP-001 都用在哪些设备上？"

- **域**：备件 → 设备
- **G1**：`GET /eam/spare/bom/by-spare {spareId: "SP-001"}`
- **G2**：`get_equipment_spare_bom {spareId: "SP-001"}`
- **G3**：`QUERY equipment_spare_bom WHERE spare_id = "SP-001" JOIN equipment`

### T17 "设备 EQ-001 最近一次保养是什么时候？"

- **域**：设备 → 保养
- **G1**：`GET /eam/maintenance/task/page {equipmentId: "EQ-001", status: 已完成}` → 按时间倒序取第一条
- **G2**：`query_maintenance_tasks {equipmentId: "EQ-001", status: 2}` → 最近一条
- **G3**：`QUERY maintenance_task WHERE equipment_id = "EQ-001" AND status = "completed" ORDER BY actual_time DESC LIMIT 1`

### T18 "本月新增了多少故障报修？"

- **域**：故障
- **G1**：`GET /eam/fault-report/page {reportTimeBegin: "2026-03-01"}` → 取 total
- **G2**：`query_fault_reports {dateRange: {start: "2026-03-01", end: "2026-03-25"}}`
- **G3**：`QUERY fault_report WHERE report_time >= "2026-03-01" AGGREGATE COUNT`

### T19 "设备 EQ-003 的全生命周期事件有哪些？"

- **域**：设备
- **G1**：`GET /eam/equipment/lifecycle-timeline {equipmentId: "EQ-003"}`
- **G2**：`get_equipment_lifecycle {equipmentId: "EQ-003"}`
- **G3**：*(DSL 难以表达多源时间线合并，预期 unsupported 或多条 QUERY)*

### T20 "近 30 天巡检发现最多异常的设备是哪台？"

- **域**：巡检/异常 → 设备
- **G1**：`GET /eam/patrol/task/analytics/by-equipment {days: 30}` → 按异常数排序
- **G2**：`get_patrol_analytics {days: 30, dimension: "by_equipment"}` → 按异常数排序
- **G3**：`QUERY anomaly_record WHERE source = "patrol" AND create_time >= "2026-02-23" AGGREGATE COUNT ORDER BY COUNT DESC LIMIT 1`

---

## L3 — 链式多跳（8 题）

> 必须覆盖 4 张桥接表：RepairSpareUsage ✓, ProductionLineEquipment ✓, EquipmentSpareBom ✓, RepairOrderKnowledgeRef ✓

### T21 "A 线上月维修用了哪些备件？" ⛓️

- **域**：产线 → 设备 → 维修 → 备件
- **桥接表**：ProductionLineEquipment, RepairSpareUsage
- **G1**：
  1. *(无产线→设备直接查询)* → 需先知道 A 线的产线 ID
  2. `GET /eam/repair-order/page {equipmentId: ...各设备}` → 拿到工单
  3. `GET /eam/repair-order/spare/list {repairOrderId: ...}` → 逐个查备件
- **G2**：
  1. `query_equipment {productionLineId: "A线"}` → 拿设备列表
  2. `query_repair_orders {equipmentId: ..., dateRange: {start: "2026-02-01", end: "2026-02-28"}}` → 工单
  3. `get_repair_detail {repairOrderId: ...}` → 备件
- **G3**：
  ```
  QUERY repair_spare_usage
    JOIN repair_order
    JOIN equipment
    JOIN production_line_equipment
    WHERE production_line_equipment.production_line_id = "A线"
      AND repair_order.create_time BETWEEN "2026-02-01" AND "2026-02-28"
  ```

### T22 "设备 EQ-003 的 BOM 里哪些备件库存不足？" ⛓️

- **域**：设备 → BOM → 备件 → 库存
- **桥接表**：EquipmentSpareBom
- **G1**：
  1. `GET /eam/spare/bom/by-equipment {equipmentId: "EQ-003"}` → BOM 清单
  2. `GET /eam/spare/part/stock-summary {ids: [...]}` → 批量查库存
  3. 对比安全库存
- **G2**：
  1. `get_equipment_spare_bom {equipmentId: "EQ-003"}` → BOM
  2. `get_spare_stock {spareId: ...}` → 逐个查库存
- **G3**：
  ```
  QUERY equipment_spare_bom
    JOIN spare_part
    JOIN spare_stock
    WHERE equipment_spare_bom.equipment_id = "EQ-003"
      AND spare_stock.quantity < spare_part.safety_stock
  ```

### T23 "上月维修时参考了哪些知识文档？" ⛓️

- **域**：维修 → 知识
- **桥接表**：RepairOrderKnowledgeRef
- **G1**：
  1. `GET /eam/repair-order/page {dateRange: 上月, status: 已完成}` → 工单列表
  2. `GET /eam/repair-order/knowledge-ref/list {repairOrderId: ...}` → 逐个查知识引用
- **G2**：
  1. `query_repair_orders {dateRange: {start: "2026-02-01", end: "2026-02-28"}}` → 工单
  2. `get_repair_detail {repairOrderId: ...}` → 包含知识引用
- **G3**：
  ```
  QUERY repair_order
    JOIN repair_order_knowledge_ref
    WHERE repair_order.create_time BETWEEN "2026-02-01" AND "2026-02-28"
  ```

### T24 "B 线上个月巡检发现了几次异常？" ⛓️

- **域**：产线 → 设备 → 巡检 → 异常
- **桥接表**：ProductionLineEquipment
- **G1**：
  1. *(需要知道 B 线设备列表)*
  2. `GET /eam/anomaly/grouped {source: "patrol"}` → 过滤 B 线设备
- **G2**：
  1. `query_equipment {productionLineId: "B线"}` → 设备列表
  2. `query_anomaly_records {source: "patrol"}` → 过滤设备+日期
- **G3**：
  ```
  QUERY anomaly_record
    JOIN equipment
    JOIN production_line_equipment
    WHERE production_line_equipment.production_line_id = "B线"
      AND anomaly_record.source = "patrol"
      AND anomaly_record.create_time BETWEEN "2026-02-01" AND "2026-02-28"
    AGGREGATE COUNT
  ```

### T25 "最近维修用量最大的备件，关联了哪些设备？" ⛓️

- **域**：维修 → 备件 → BOM → 设备
- **桥接表**：RepairSpareUsage, EquipmentSpareBom
- **G1**：
  1. 需要遍历近期工单的备件用量 → 聚合找 top 备件
  2. `GET /eam/spare/bom/by-spare {spareId: ...}` → 关联设备
- **G2**：
  1. `query_repair_orders {dateRange: 近期}` → 工单列表
  2. `get_repair_detail {repairOrderId: ...}` → 备件用量
  3. 聚合找 top 备件
  4. `get_equipment_spare_bom {spareId: ...}` → 关联设备
- **G3**：
  ```
  QUERY repair_spare_usage
    JOIN spare_part
    JOIN equipment_spare_bom
    JOIN equipment
    AGGREGATE SUM(quantity)
    ORDER BY SUM DESC
    LIMIT 1
  ```

### T26 "A 线设备的保养计划执行率是多少？" ⛓️

- **域**：产线 → 设备 → 保养
- **桥接表**：ProductionLineEquipment
- **G1**：
  1. *(需要产线→设备映射)*
  2. `GET /eam/maintenance/task/page {equipmentId: ...}` → 各设备保养任务
  3. 计算完成率
- **G2**：
  1. `query_equipment {productionLineId: "A线"}` → 设备列表
  2. `query_maintenance_tasks {equipmentId: ...}` → 保养任务
  3. 计算完成/总数
- **G3**：
  ```
  QUERY maintenance_task
    JOIN equipment
    JOIN production_line_equipment
    WHERE production_line_equipment.production_line_id = "A线"
    AGGREGATE COUNT
  ```

### T27 "维修工单 WO-005 的出库单涉及了哪些仓库？" ⛓️

- **域**：维修 → 出库 → 仓库
- **桥接表**：*(间接 — 通过出库单关联)*
- **G1**：
  1. `GET /eam/repair-order/related-stock-out/list {repairOrderId: "WO-005"}` → 出库单
  2. `GET /eam/repair-order/related-stock-out/items {stockOutOrderId: ...}` → 明细含仓库
- **G2**：
  1. `get_repair_detail {repairOrderId: "WO-005"}` → 包含备件和出库信息
  2. `query_spare_transactions {type: "stock_out"}` → 补充仓库信息
- **G3**：
  ```
  QUERY stock_out_order
    JOIN repair_order
    WHERE repair_order.id = "WO-005"
  ```

### T28 "设备 EQ-001 最近一次故障的维修花了多少工时？" ⛓️

- **域**：设备 → 故障 → 维修 → 工时
- **桥接表**：*(通过 fault_report_id 关联)*
- **G1**：
  1. `GET /eam/fault-report/page {equipmentId: "EQ-001"}` → 最近故障
  2. `GET /eam/repair-order/get-by-fault-report-id {faultReportId: ...}` → 工单
  3. `GET /eam/repair-order/workload/list {repairOrderId: ...}` → 工时
- **G2**：
  1. `query_fault_reports {equipmentId: "EQ-001"}` → 最近故障
  2. `get_repair_detail {faultReportId: ...}` → 含工时
- **G3**：
  ```
  QUERY repair_workload
    JOIN repair_order
    JOIN fault_report
    WHERE fault_report.equipment_id = "EQ-001"
    ORDER BY fault_report.report_time DESC
    LIMIT 1
  ```

---

## L4 — 跨域关联（6 题）

### T29 "故障率最高的设备，保养是否按计划执行？"

- **域**：故障 + 保养 + 设备
- **G1**：
  1. `GET /eam/fault-report/page` → 按设备聚合找 top
  2. `GET /eam/maintenance/task/page {equipmentId: top设备}` → 保养任务
  3. 对比计划数 vs 完成数
- **G2**：
  1. `query_fault_reports {}` → 聚合找 top 设备
  2. `query_maintenance_tasks {equipmentId: top设备}` → 保养执行情况
- **G3**：
  ```
  QUERY fault_report
    JOIN equipment
    AGGREGATE COUNT
    ORDER BY COUNT DESC
    LIMIT 1
  -- then --
  QUERY maintenance_task
    WHERE equipment_id = <上一步结果>
    AGGREGATE COUNT
  ```

### T30 "上月维修成本最高的设备，它的巡检有没有发现过异常？"

- **域**：维修 + 备件成本 + 巡检 + 异常
- **桥接表**：RepairSpareUsage
- **G1**：
  1. 遍历上月工单 → `spare/list` 算成本 → 找 top 设备
  2. `GET /eam/anomaly/grouped {source: "patrol"}` → 过滤该设备
- **G2**：
  1. `query_repair_orders {dateRange: 上月}` → 工单
  2. `get_repair_detail` → 备件成本
  3. `query_anomaly_records {source: "patrol"}` → 过滤 top 设备
- **G3**：
  ```
  QUERY repair_spare_usage
    JOIN repair_order
    WHERE repair_order.create_time BETWEEN "2026-02-01" AND "2026-02-28"
    AGGREGATE SUM(quantity * unit_price)
    ORDER BY SUM DESC
    LIMIT 1
  -- then --
  QUERY anomaly_record
    WHERE equipment_id = <上一步设备> AND source = "patrol"
  ```

### T31 "备件库存预警涉及的设备中，有哪些正在维修？"

- **域**：备件 + BOM + 设备
- **桥接表**：EquipmentSpareBom
- **G1**：
  1. `GET /eam/spare/alert/list` → 预警备件
  2. `GET /eam/spare/bom/by-spare {spareId: ...}` → 关联设备
  3. `GET /eam/equipment/get {id: ...}` → 检查 status=2
- **G2**：
  1. `get_spare_alerts` → 预警备件
  2. `get_equipment_spare_bom {spareId: ...}` → 关联设备
  3. `query_equipment {status: 2}` → 交集
- **G3**：
  ```
  QUERY spare_stock
    JOIN spare_part
    JOIN equipment_spare_bom
    JOIN equipment
    WHERE spare_stock.quantity < spare_part.safety_stock
      AND equipment.status = 2
  ```

### T32 "A 线设备的故障、保养、巡检三项指标概览"

- **域**：产线 + 设备 + 故障 + 保养 + 巡检
- **桥接表**：ProductionLineEquipment
- **G1**：
  1. *(需产线→设备)*
  2. `GET /eam/fault-report/page {equipmentId: ...}` → 故障数
  3. `GET /eam/maintenance/task/page {equipmentId: ...}` → 保养完成率
  4. `GET /eam/patrol/task/analytics/by-equipment {days: 30}` → 巡检指标
- **G2**：
  1. `query_equipment {productionLineId: "A线"}` → 设备列表
  2. `query_fault_reports {equipmentId: ...}` → 故障
  3. `query_maintenance_tasks {equipmentId: ...}` → 保养
  4. `get_patrol_analytics {dimension: "by_equipment"}` → 巡检
- **G3**：
  ```
  QUERY fault_report JOIN equipment JOIN production_line_equipment
    WHERE production_line_equipment.production_line_id = "A线" AGGREGATE COUNT
  -- and --
  QUERY maintenance_task JOIN equipment JOIN production_line_equipment
    WHERE production_line_equipment.production_line_id = "A线" AGGREGATE COUNT
  -- and --
  QUERY patrol_task JOIN equipment JOIN production_line_equipment
    WHERE production_line_equipment.production_line_id = "A线" AGGREGATE COUNT
  ```

### T33 "近 3 个月有故障但没安排保养的设备有哪些？"

- **域**：故障 + 保养 + 设备
- **G1**：
  1. `GET /eam/fault-report/page {reportTimeBegin: "2026-01-01"}` → 有故障的设备集合
  2. `GET /eam/maintenance/task/page {各设备}` → 检查有无保养任务
  3. 取差集
- **G2**：
  1. `query_fault_reports {dateRange: {start: "2026-01-01"}}` → 有故障设备
  2. `query_maintenance_tasks {equipmentId: ..., dateRange: ...}` → 有保养设备
  3. 取差集
- **G3**：
  ```
  QUERY fault_report
    JOIN equipment
    WHERE fault_report.report_time >= "2026-01-01"
      AND equipment.id NOT IN (
        QUERY maintenance_task WHERE planned_time >= "2026-01-01"
      )
  ```

### T34 "外协维修的设备中，有没有重点设备？"

- **域**：维修（外协）+ 设备
- **G1**：
  1. `GET /eam/outsource-order/page` → 外协工单设备
  2. `GET /eam/equipment/get {id: ...}` → 检查 isKey
- **G2**：
  1. `query_repair_orders` → *(G2 无独立外协工具，需通过维修工单间接查)*
  2. `get_equipment_detail {equipmentId: ...}` → 检查 isKey
- **G3**：
  ```
  QUERY outsource_order
    JOIN repair_order
    JOIN equipment
    WHERE equipment.is_key = 1
  ```

---

## L5 — 聚合 + 时间推理（6 题）

### T35 "哪条产线近 3 个月故障呈上升趋势，且备件库存不足？"

- **域**：产线 + 故障趋势 + 备件库存
- **桥接表**：ProductionLineEquipment, EquipmentSpareBom
- **G1**：*(需要多次调用并自行做趋势计算，Controller 无直接能力)*
- **G2**：
  1. `get_fault_trend {days: 90}` → 全局趋势
  2. `query_equipment {productionLineId: ...}` → 各产线设备
  3. `get_spare_alerts` → 库存不足
  4. 交叉分析
- **G3**：
  ```
  QUERY fault_report
    JOIN equipment
    JOIN production_line_equipment
    WHERE report_time >= "2026-01-01"
    AGGREGATE COUNT, TREND(report_time)
    ORDER BY TREND DESC
  -- cross with --
  QUERY spare_stock
    JOIN spare_part
    JOIN equipment_spare_bom
    JOIN equipment
    JOIN production_line_equipment
    WHERE spare_stock.quantity < spare_part.safety_stock
  ```

### T36 "上季度各产线的保养完成率排名？"

- **域**：产线 + 保养
- **桥接表**：ProductionLineEquipment
- **G1**：*(无产线维度的保养统计，需要手动关联)*
- **G2**：
  1. `query_equipment {productionLineId: ...}` → 各产线设备
  2. `query_maintenance_tasks {dateRange: Q4, equipmentId: ...}` → 完成 vs 总数
- **G3**：
  ```
  QUERY maintenance_task
    JOIN equipment
    JOIN production_line_equipment
    WHERE maintenance_task.planned_time BETWEEN "2025-10-01" AND "2025-12-31"
    AGGREGATE COUNT
    ORDER BY production_line_equipment.production_line_id
  ```

### T37 "同比去年同期，今年 Q1 的故障报修数是增还是减？"

- **域**：故障（时间对比）
- **G1**：
  1. `GET /eam/fault-report/page {reportTimeBegin: "2026-01-01", reportTimeEnd: "2026-03-31"}` → 今年 Q1
  2. `GET /eam/fault-report/page {reportTimeBegin: "2025-01-01", reportTimeEnd: "2025-03-31"}` → 去年 Q1
- **G2**：
  1. `query_fault_reports {dateRange: {start: "2026-01-01", end: "2026-03-31"}}` → 今年 Q1
  2. `query_fault_reports {dateRange: {start: "2025-01-01", end: "2025-03-31"}}` → 去年 Q1
- **G3**：
  ```
  QUERY fault_report WHERE report_time BETWEEN "2026-01-01" AND "2026-03-31" AGGREGATE COUNT
  -- compare --
  QUERY fault_report WHERE report_time BETWEEN "2025-01-01" AND "2025-03-31" AGGREGATE COUNT
  ```

### T38 "近半年维修频次最高的 3 台设备，各自的平均维修周期是多少？"

- **域**：故障 + 维修（时间聚合）
- **G1**：
  1. `GET /eam/repair-order/page {dateRange: 近半年}` → 按设备聚合 → top 3
  2. 计算每台设备相邻维修间隔平均值
- **G2**：
  1. `query_repair_orders {dateRange: {start: "2025-09-25", end: "2026-03-25"}}` → 按设备聚合 top 3
  2. `get_equipment_detail {equipmentId: ...}` → KPI 中可能有 MTBF
- **G3**：
  ```
  QUERY repair_order
    WHERE create_time >= "2025-09-25"
    AGGREGATE COUNT, AVG(repair_interval)
    ORDER BY COUNT DESC
    LIMIT 3
  ```

### T39 "备件月消耗量环比分析，哪些备件用量在持续上升？"

- **域**：维修 + 备件（时间趋势）
- **桥接表**：RepairSpareUsage
- **G1**：*(需多次调用工单备件列表并手动按月聚合)*
- **G2**：
  1. `query_repair_orders {dateRange: 近几个月}` → 工单
  2. `get_repair_detail` → 备件用量
  3. 按月聚合做环比
- **G3**：
  ```
  QUERY repair_spare_usage
    JOIN repair_order
    WHERE repair_order.create_time >= "2025-10-01"
    AGGREGATE SUM(quantity), TREND(repair_order.create_time)
    ORDER BY TREND DESC
  ```

### T40 "近 6 个月巡检异常率变化趋势，有没有季节性规律？"

- **域**：巡检 + 异常（时间趋势）
- **G1**：
  1. `GET /eam/patrol/task/analytics {days: 180}` → 综合分析
  2. *(Controller 返回的是聚合值，无逐月细分)*
- **G2**：
  1. `get_patrol_analytics {days: 180, dimension: "overview"}` → 整体趋势
  2. `query_anomaly_records {source: "patrol"}` → 按月细分
- **G3**：
  ```
  QUERY anomaly_record
    JOIN patrol_task
    WHERE anomaly_record.source = "patrol"
      AND anomaly_record.create_time >= "2025-09-25"
    AGGREGATE COUNT, TREND(create_time)
  ```

---

## 桥接表覆盖检查

| 桥接表 | 覆盖题目 |
|--------|---------|
| RepairSpareUsage | T21, T25, T30, T35, T39 ✓ |
| ProductionLineEquipment | T21, T24, T26, T32, T35, T36 ✓ |
| EquipmentSpareBom | T22, T25, T31, T35 ✓ |
| RepairOrderKnowledgeRef | T23 ✓ |

## 难度分布统计

| 级别 | 数量 | 题号 |
|------|------|------|
| L1 | 10 | T01-T10 |
| L2 | 10 | T11-T20 |
| L3 | 8 | T21-T28 |
| L4 | 6 | T29-T34 |
| L5 | 6 | T35-T40 |
| **合计** | **40** | |
