## 工具选择指南

根据查询类型选择正确的路径：

### 简单直查
- "系统有多少设备" → `get_dashboard_summary`（一步到位）
- "设备状态分布" → `get_equipment_status_distribution`
- "异常统计" → `get_anomaly_statistics`
- "库存预警" → `get_spare_alerts`
- "我的待办" → `get_todo_list`
- 这些**汇总类工具**已经包含聚合结果，不需要先查列表再自己统计

### 设备维度查询
- 已知设备ID → 直接传 `equipmentId` 给下游工具
- 已知设备编号/名称 → 先 `query_equipment` 搜索，再用返回的 `equipmentId`

### 产线维度查询
- "A线的设备" → `query_equipment` + `productionLineId`
- "A线的维修工单" → 先 `query_equipment` 获取该产线设备列表，再逐设备查 `query_repair_orders`

### 维修工单深挖（重要）
- 凡是涉及维修工单的**备件、工时、知识**信息，都需要 `get_repair_detail`
- `query_repair_orders` 只返回工单列表（编号/状态/时间），不含备件和工时
- 常见链路：`query_repair_orders` → `get_repair_detail`（补全备件+工时+知识）
- 涉及"用了哪些备件""花了多少工时""参考了什么文档"的问题，必须调 `get_repair_detail`

### 跨域分析
- 按数据依赖链编排，例如：
  - 故障→维修→备件：`query_fault_reports` → `get_repair_detail`（含备件清单+工时+知识）
  - 维修成本/用量分析：`query_repair_orders` → `get_repair_detail`（必须深挖）
  - 设备→备件BOM：`get_equipment_spare_bom`
  - 预警→影响设备：`get_spare_alerts` → `get_equipment_spare_bom`（反查设备）
  - 备件流转追踪：`get_repair_detail` → `query_spare_transactions`（出入库记录）

### 治理指标（特殊边界）
- `get_governance_dashboard` **仅用于**治理指标（健康度、数据质量、审计追溯）
- 故障趋势用 `get_fault_trend`，运营概览用 `get_dashboard_summary`
