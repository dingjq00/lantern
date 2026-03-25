# 方案 A — P1 Prompt 准备

> 三组实验的 Prompt 模板，使用同一测试集，只替换工具描述部分。

## 公共 System Prompt

三组实验共享同一段系统指令（`{TOOL_CATALOG}` 在各组中替换为对应内容）：

```
你是 EAM（设备资产管理）系统的 AI 助手。用户会用自然语言提出查询或分析需求。

你的任务是：
1. 理解用户意图
2. 从下方工具清单中选择需要调用的工具
3. 填入正确的参数

规则：
- 只能使用下方清单中列出的工具，不能编造不存在的工具
- 如果需要多个工具配合才能回答，按执行顺序列出所有需要的工具调用
- 如果没有合适的工具能回答用户问题，返回 {"unsupported": true, "reason": "..."}

{TOOL_CATALOG}
```

---

## G1 — Controller 路由（基线）

### G1 Prompt 中的工具清单

以下是 EAM 系统现有的 Controller API 方法。选择最匹配的方法并指定参数。

输出格式：
```json
{
  "calls": [
    {"method": "方法路径", "params": {"参数名": "值"}}
  ]
}
```

#### Dashboard 仪表盘

| 方法 | 路径 | 参数 | 返回 |
|------|------|------|------|
| 获取设备总览统计 | GET /eam/dashboard/summary | 无 | totalEquipment, runningCount, faultCount, scrapCount, pendingReports, totalReports, pendingOrders, completedOrders, pendingMaintenanceTasks |
| 设备状态分布 | GET /eam/dashboard/equipment-status-distribution | 无 | [{statusId, name, value}] |
| 设备分类统计 | GET /eam/dashboard/category-distribution | 无 | [{id, name, count}] TOP10 |
| 近30天故障趋势 | GET /eam/dashboard/fault-trend | 无 | [{date, fullDate, count}] |
| 待办事项 | GET /eam/dashboard/todo-list | 无 | [{id, code, title, type, time}]（待审核报修+待接单工单+待执行保养，各5条） |

#### Equipment 设备

| 方法 | 路径 | 参数 | 返回 |
|------|------|------|------|
| 获取设备详情 | GET /eam/equipment/get | id | 设备完整信息 |
| 获取设备详情 KPI | GET /eam/equipment/kpi | id | 单台设备的 KPI 指标 |
| 设备台账治理看板概览 | GET /eam/equipment/governance-overview | 无 | 治理概览数据 |
| 设备仪表板统计数据 | GET /eam/equipment/dashboard-statistics | 无 | 统计数据 |
| 设备生命周期审计分页 | GET /eam/equipment/audit-log/page | 分页参数 | 审计日志 |
| 设备审计可追溯指标概览 | GET /eam/equipment/audit-metrics/overview | 无 | 审计指标 |
| 设备全生命周期时间线 | GET /eam/equipment/lifecycle-timeline | equipmentId | [{事件}] |
| 设备数据质量治理看板 | GET /eam/equipment/data-quality/dashboard | 无 | 数据质量指标 |
| 设备分页 | GET /eam/equipment/page | keyword, status, categoryId, locationId, deptId 等 | 设备列表分页 |
| 设备精简列表 | GET /eam/equipment/simple-list | 无 | 所有设备精简信息 |

#### Governance 生命周期治理

| 方法 | 路径 | 参数 | 返回 |
|------|------|------|------|
| 治理看板总览 | GET /eam/governance/dashboard | startTime?, endTime? | 治理总览数据 |
| 治理看板钻取 | GET /eam/governance/drilldown | startTime?, endTime?, keyword?, pageNo, pageSize | 设备级分页明细 |

#### FaultReport 故障报修

| 方法 | 路径 | 参数 | 返回 |
|------|------|------|------|
| 获取报修详情 | GET /eam/fault-report/get | id | 报修单详情 |
| 报修分页 | GET /eam/fault-report/page | 分页参数 | 报修列表 |
| 故障报修状态统计 | GET /eam/fault-report/status-stats | 无 | [{status, count}] |
| 操作记录列表 | GET /eam/fault-report/log-list | faultReportId | 操作日志 |

#### RepairOrder 维修工单

| 方法 | 路径 | 参数 | 返回 |
|------|------|------|------|
| 获取工单详情 | GET /eam/repair-order/get | id | 工单详情 |
| 按报修单查询工单 | GET /eam/repair-order/get-by-fault-report-id | faultReportId | 工单详情 |
| 工单分页 | GET /eam/repair-order/page | 分页参数 | 工单列表 |
| 维修工单状态统计 | GET /eam/repair-order/status-stats | 无 | [{status, count}] |
| 获取操作日志 | GET /eam/repair-order/log-list | repairOrderId | 操作日志 |
| 获取工作量列表 | GET /eam/repair-order/workload/list | repairOrderId | 工时记录 |
| 获取备件使用列表 | GET /eam/repair-order/spare/list | repairOrderId | 备件用量 |
| 查询维修知识引用 | GET /eam/repair-order/knowledge-ref/list | repairOrderId | 知识引用 |
| 查询维修关联出库单 | GET /eam/repair-order/related-stock-out/list | repairOrderId | 出库单 |
| 查询关联出库单明细 | GET /eam/repair-order/related-stock-out/items | stockOutOrderId | 出库明细 |

#### RepairPlan 维修计划

| 方法 | 路径 | 参数 | 返回 |
|------|------|------|------|
| 获取维修计划 | GET /eam/repair-plan/get | id | 维修计划详情 |
| 维修计划分页 | GET /eam/repair-plan/page | 分页参数 | 维修计划列表 |
| 维修计划状态统计 | GET /eam/repair-plan/status-stats | 无 | [{status, count}] |

#### OutsourceOrder 外委工单

| 方法 | 路径 | 参数 | 返回 |
|------|------|------|------|
| 获取外委工单详情 | GET /eam/outsource-order/get | id | 外委工单详情 |
| 外委工单分页 | GET /eam/outsource-order/page | 分页参数 | 外委工单列表 |
| 外委工单状态统计 | GET /eam/outsource-order/status-stats | 无 | [{status, count}] |
| 外委工单操作日志 | GET /eam/outsource-order/log-list | id | 操作日志 |

#### Maintenance 保养管理

| 方法 | 路径 | 参数 | 返回 |
|------|------|------|------|
| 获取保养标准 | GET /eam/maintenance/standard/get | id | 标准详情 |
| 保养标准分页 | GET /eam/maintenance/standard/page | 分页参数 | 标准列表 |
| 获取标准检查项 | GET /eam/maintenance/standard/items | standardId | 检查项列表 |
| 保养标准状态统计 | GET /eam/maintenance/standard/status-stats | 无 | [{status, count}] |
| 保养计划分页 | GET /eam/maintenance/plan/page | 分页参数 | 计划列表 |
| 保养计划状态统计 | GET /eam/maintenance/plan/status-stats | 筛选参数 | 状态分布 |
| 获取保养任务详情 | GET /eam/maintenance/task/get | id | 任务详情 |
| 保养任务分页 | GET /eam/maintenance/task/page | 分页参数 | 任务列表 |
| 保养任务状态统计 | GET /eam/maintenance/task/status-stats | 无 | [{status, count}] |
| 获取任务保养记录 | GET /eam/maintenance/task/records | taskId | 执行记录 |

#### Anomaly 异常记录

| 方法 | 路径 | 参数 | 返回 |
|------|------|------|------|
| 获取异常记录详情 | GET /eam/anomaly/get | id | 异常详情 |
| 异常记录分页 | GET /eam/anomaly/page | 分页参数 | 异常列表 |
| 异常分组聚合 | GET /eam/anomaly/grouped | keyword?, source?, severity?, status? | 按设备+来源+日期分组 |
| 异常统计 KPI | GET /eam/anomaly/statistics | 无 | KPI 指标 |

#### PatrolTask 巡检

| 方法 | 路径 | 参数 | 返回 |
|------|------|------|------|
| 获取巡检任务 | GET /eam/patrol/task/get | id | 任务详情 |
| 巡检任务分页 | GET /eam/patrol/task/page | 分页参数 | 任务列表 |
| 获取任务巡检记录 | GET /eam/patrol/task/records | taskId | 巡检记录 |
| 获取巡检记录明细 | GET /eam/patrol/task/records-detail | taskId | 含检查项名称和设备名称 |
| 巡检任务状态统计 | GET /eam/patrol/task/statistics | 无 | 状态统计 |
| 巡检综合分析 | GET /eam/patrol/task/analytics | days=30 | 综合分析 |
| 按巡检计划统计 | GET /eam/patrol/task/analytics/by-plan | days=30 | 按计划维度统计 |
| 按设备统计 | GET /eam/patrol/task/analytics/by-equipment | days=30 | 按设备维度统计 |
| 按检查标准统计 | GET /eam/patrol/task/analytics/by-standard | days=30 | 按标准维度统计 |
| 按设备聚合巡检记录 | GET /eam/patrol/task/equipment-records | equipmentId?, equipmentCode?, equipmentName?, deptId?, startTimeBegin?, startTimeEnd?, pageNo, pageSize | 按设备聚合 |

#### PatrolPlan 巡检计划

| 方法 | 路径 | 参数 | 返回 |
|------|------|------|------|
| 获取巡检计划 | GET /eam/patrol/plan/get | id | 计划详情 |
| 巡检计划分页 | GET /eam/patrol/plan/page | 分页参数 | 计划列表 |
| 获取计划关联设备 | GET /eam/patrol/plan/equipments | planId | 设备列表 |
| 巡检计划状态统计 | GET /eam/patrol/plan/status-stats | 无 | [{status, count}] |

#### SparePart 备件

| 方法 | 路径 | 参数 | 返回 |
|------|------|------|------|
| 获取备件详情 | GET /eam/spare/part/get | id | 备件详情 |
| 备件分页 | GET /eam/spare/part/page | 分页参数 | 备件列表 |
| 获取备件库存 | GET /eam/spare/part/stock | spareId | 各仓库库存 |
| 批量查询备件库存汇总 | GET /eam/spare/part/stock-summary | ids | {spareId: totalQty} |
| 查询备件出入库明细 | GET /eam/spare/part/inout-records | spareId | 出入库流水 |
| 查询设备备件BOM | GET /eam/spare/bom/by-equipment | equipmentId | BOM 清单 |
| 查询备件关联设备 | GET /eam/spare/bom/by-spare | spareId | 设备清单 |
| 获取仓库有库存备件 | GET /eam/spare/stock/by-warehouse | warehouseId | 备件列表 |
| 获取仓库库存列表 | GET /eam/spare/stock/list-by-warehouse | warehouseId | 库存列表 |
| 备件类型列表 | GET /eam/spare/type/list | 无 | 树形分类 |
| 入库单分页 | GET /eam/spare/stock-in/page | 分页参数 | 入库单列表 |
| 入库单明细 | GET /eam/spare/stock-in/items | orderId | 入库明细 |
| 出库单分页 | GET /eam/spare/stock-out/page | 分页参数 | 出库单列表 |
| 出库单明细 | GET /eam/spare/stock-out/items | orderId | 出库明细 |
| 调拨单分页 | GET /eam/spare/transfer/page | 分页参数 | 调拨列表 |
| 购置单分页 | GET /eam/spare/purchase/page | 分页参数 | 购置列表 |
| 盘点单分页 | GET /eam/spare/inventory/page | 分页参数 | 盘点列表 |
| 归还单分页 | GET /eam/spare/return/page | 分页参数 | 归还列表 |
| 报废单分页 | GET /eam/spare/scrap/page | 分页参数 | 报废列表 |
| 查询未处理预警 | GET /eam/spare/alert/list | 无 | 库存预警列表 |
| 查询备件替代件 | GET /eam/spare/substitute/by-spare | spareId | 替代件列表 |
| 备件台账状态统计 | GET /eam/spare/part/status-stats | 无 | [{status, count}] |
| 各类单据状态统计 | GET /eam/spare/{type}/status-stats | 无 | 入库/出库/调拨/购置/盘点/归还/报废 各自的状态统计 |

#### Acquisition 设备购置

| 方法 | 路径 | 参数 | 返回 |
|------|------|------|------|
| 购置申请分页 | GET /eam/acquisition/page | 分页参数 | 购置申请列表 |
| 获取购置申请详情 | GET /eam/acquisition/get | id | 购置详情 |
| 购置申请状态统计 | GET /eam/acquisition/status-stats | 无 | [{status, count}] |
| 获取购置行项目 | GET /eam/acquisition/items | id | 行项目列表 |
| 购置流程指南统计指标 | GET /eam/acquisition/guide-metrics | 无 | 流程指标 |
| 获取购置关联设备 | GET /eam/acquisition/equipment-list | id | 设备列表 |

#### EquipmentChange 设备变动

| 方法 | 路径 | 参数 | 返回 |
|------|------|------|------|
| 获取变动单详情 | GET /eam/equipment-change/get | id | 变动详情 |
| 变动分页 | GET /eam/equipment-change/page | 分页参数 | 变动列表 |
| 设备变动状态统计 | GET /eam/equipment-change/status-stats | 无 | [{status, count}] |

**G1 合计：约 75 个查询方法**

---

## G2 — MCP Tool 路由（核心实验）

### G2 Prompt 中的工具清单

以下是可用的 MCP Tools。选择需要的 tool 并填入参数。

输出格式：
```json
{
  "calls": [
    {"tool": "tool_name", "arguments": {"参数名": "值"}}
  ]
}
```

### Tool 清单（22 个）

#### 1. query_equipment
```json
{
  "name": "query_equipment",
  "description": "按条件查询设备列表。支持按分类、位置、产线、状态、关键字等条件筛选设备。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "keyword": {"type": "string", "description": "设备编号或名称关键字"},
      "status": {"type": "integer", "description": "设备状态：0=待验收 1=运行中 2=维修中 3=停机 4=封存 5=待整改 6=闲置 7=报废"},
      "categoryId": {"type": "integer", "description": "设备分类ID"},
      "locationId": {"type": "integer", "description": "位置ID"},
      "productionLineId": {"type": "integer", "description": "产线ID"},
      "deptId": {"type": "integer", "description": "所属部门ID"},
      "isKey": {"type": "integer", "description": "是否重点设备：0=否 1=是"}
    }
  }
}
```

#### 2. get_equipment_detail
```json
{
  "name": "get_equipment_detail",
  "description": "获取单台设备的完整详情，包括基本信息和KPI指标（故障次数、维修时长、保养执行率等）。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "equipmentId": {"type": "integer", "description": "设备ID"}
    },
    "required": ["equipmentId"]
  }
}
```

#### 3. get_equipment_lifecycle
```json
{
  "name": "get_equipment_lifecycle",
  "description": "获取设备全生命周期时间线事件，包括购置、验收、状态变更、故障、维修、保养、变动等所有历史事件。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "equipmentId": {"type": "integer", "description": "设备ID"}
    },
    "required": ["equipmentId"]
  }
}
```

#### 4. get_equipment_status_distribution
```json
{
  "name": "get_equipment_status_distribution",
  "description": "获取设备状态分布统计，返回各状态（运行中、维修中、停机、报废等）的设备数量。",
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}
```

#### 5. query_fault_reports
```json
{
  "name": "query_fault_reports",
  "description": "查询故障报修记录列表。支持按设备、状态、时间范围、故障类型筛选。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "equipmentId": {"type": "integer", "description": "设备ID"},
      "status": {"type": "integer", "description": "报修状态：0=待审核 1=已通过 2=已拒绝 3=已撤回"},
      "faultTypeId": {"type": "integer", "description": "故障分类ID"},
      "dateRange": {
        "type": "object",
        "properties": {
          "start": {"type": "string", "format": "date", "description": "开始日期"},
          "end": {"type": "string", "format": "date", "description": "结束日期"}
        }
      }
    }
  }
}
```

#### 6. query_repair_orders
```json
{
  "name": "query_repair_orders",
  "description": "查询维修工单列表。支持按设备、状态、时间范围筛选。状态包括从待分配到已关闭的全流程。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "equipmentId": {"type": "integer", "description": "设备ID"},
      "status": {"type": "integer", "description": "工单状态：0=待分配 1=待接单 2=待维修 3=维修中 4=待验收 5=已验收 6=已关闭"},
      "dateRange": {
        "type": "object",
        "properties": {
          "start": {"type": "string", "format": "date"},
          "end": {"type": "string", "format": "date"}
        }
      }
    }
  }
}
```

#### 7. get_repair_detail
```json
{
  "name": "get_repair_detail",
  "description": "获取维修工单完整详情，包括工单基本信息、使用的备件清单、工时记录、关联的知识引用。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "repairOrderId": {"type": "integer", "description": "维修工单ID"},
      "faultReportId": {"type": "integer", "description": "故障报修ID（二选一，通过报修单找工单）"}
    }
  }
}
```

#### 8. get_fault_trend
```json
{
  "name": "get_fault_trend",
  "description": "获取故障趋势分析。按日统计故障报修数量，支持自定义时间范围。默认近30天。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "days": {"type": "integer", "description": "统计天数，默认30", "default": 30},
      "equipmentId": {"type": "integer", "description": "指定设备ID（可选，不传则全局统计）"},
      "productionLineId": {"type": "integer", "description": "指定产线ID（可选）"}
    }
  }
}
```

#### 9. query_maintenance_tasks
```json
{
  "name": "query_maintenance_tasks",
  "description": "查询保养任务列表。支持按设备、状态、保养计划、时间范围筛选。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "equipmentId": {"type": "integer", "description": "设备ID"},
      "status": {"type": "integer", "description": "任务状态：0=待执行 1=执行中 2=已完成 3=已跳过"},
      "planId": {"type": "integer", "description": "保养计划ID"},
      "dateRange": {
        "type": "object",
        "properties": {
          "start": {"type": "string", "format": "date"},
          "end": {"type": "string", "format": "date"}
        }
      }
    }
  }
}
```

#### 10. get_maintenance_detail
```json
{
  "name": "get_maintenance_detail",
  "description": "获取保养任务详情，包括任务基本信息和执行记录（各检查项的完成情况）。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "taskId": {"type": "integer", "description": "保养任务ID"}
    },
    "required": ["taskId"]
  }
}
```

#### 11. query_patrol_tasks
```json
{
  "name": "query_patrol_tasks",
  "description": "查询巡检任务列表。支持按设备、状态、巡检计划、时间范围筛选。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "equipmentId": {"type": "integer", "description": "设备ID"},
      "status": {"type": "integer", "description": "任务状态"},
      "planId": {"type": "integer", "description": "巡检计划ID"},
      "dateRange": {
        "type": "object",
        "properties": {
          "start": {"type": "string", "format": "date"},
          "end": {"type": "string", "format": "date"}
        }
      }
    }
  }
}
```

#### 12. get_patrol_analytics
```json
{
  "name": "get_patrol_analytics",
  "description": "获取巡检综合分析数据。支持按不同维度（整体/按计划/按设备/按检查标准）统计巡检完成率、异常率等指标。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "days": {"type": "integer", "description": "统计天数，默认30", "default": 30},
      "dimension": {"type": "string", "enum": ["overview", "by_plan", "by_equipment", "by_standard"], "description": "统计维度", "default": "overview"}
    }
  }
}
```

#### 13. query_anomaly_records
```json
{
  "name": "query_anomaly_records",
  "description": "查询异常记录。支持按设备、来源、严重程度、状态筛选，支持分组聚合模式。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "keyword": {"type": "string", "description": "关键字搜索（设备名/异常描述）"},
      "source": {"type": "string", "description": "异常来源（巡检/保养/其他）"},
      "severity": {"type": "integer", "description": "严重程度"},
      "status": {"type": "integer", "description": "处理状态"},
      "grouped": {"type": "boolean", "description": "是否按设备+来源+日期分组聚合", "default": false}
    }
  }
}
```

#### 14. get_anomaly_statistics
```json
{
  "name": "get_anomaly_statistics",
  "description": "获取异常统计KPI，包括总数、待处理数、处理率、各严重级别分布等。",
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}
```

#### 15. query_spare_parts
```json
{
  "name": "query_spare_parts",
  "description": "查询备件列表。支持按名称、类型、状态筛选。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "keyword": {"type": "string", "description": "备件名称或编号关键字"},
      "typeId": {"type": "integer", "description": "备件类型ID"},
      "status": {"type": "integer", "description": "备件状态"}
    }
  }
}
```

#### 16. get_spare_stock
```json
{
  "name": "get_spare_stock",
  "description": "查询备件库存。可按备件ID查各仓库库存明细，也可按仓库ID查该仓库所有备件库存。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "spareId": {"type": "integer", "description": "备件ID（按备件查库存）"},
      "warehouseId": {"type": "integer", "description": "仓库ID（按仓库查库存）"}
    }
  }
}
```

#### 17. get_equipment_spare_bom
```json
{
  "name": "get_equipment_spare_bom",
  "description": "查询设备与备件的BOM关联关系。可正向查设备的备件清单，也可反向查备件适用的设备。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "equipmentId": {"type": "integer", "description": "设备ID（查设备的备件BOM清单）"},
      "spareId": {"type": "integer", "description": "备件ID（查备件关联的设备清单）"}
    }
  }
}
```

#### 18. query_spare_transactions
```json
{
  "name": "query_spare_transactions",
  "description": "查询备件流转记录，包括入库、出库、调拨、归还、报废等各类单据。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "type": {"type": "string", "enum": ["stock_in", "stock_out", "transfer", "return", "scrap", "purchase"], "description": "单据类型"},
      "spareId": {"type": "integer", "description": "备件ID（查指定备件的出入库明细）"},
      "dateRange": {
        "type": "object",
        "properties": {
          "start": {"type": "string", "format": "date"},
          "end": {"type": "string", "format": "date"}
        }
      }
    }
  }
}
```

#### 19. get_spare_alerts
```json
{
  "name": "get_spare_alerts",
  "description": "查询库存预警信息，返回库存低于安全线的备件列表。",
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}
```

#### 20. get_dashboard_summary
```json
{
  "name": "get_dashboard_summary",
  "description": "获取系统总览统计，包括设备总数、运行中/故障/报废数、待处理报修数、待处理工单数、待执行保养任务数。",
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}
```

#### 21. get_governance_dashboard
```json
{
  "name": "get_governance_dashboard",
  "description": "获取设备生命周期治理看板，包含设备健康度、数据质量、审计追溯等治理指标。支持时间范围和设备关键字钻取。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "startTime": {"type": "string", "format": "date-time", "description": "开始时间"},
      "endTime": {"type": "string", "format": "date-time", "description": "结束时间"},
      "keyword": {"type": "string", "description": "设备编号或名称（钻取模式）"},
      "drilldown": {"type": "boolean", "description": "是否返回设备级明细", "default": false}
    }
  }
}
```

#### 22. get_todo_list
```json
{
  "name": "get_todo_list",
  "description": "获取当前待办事项列表，包括待审核报修、待接单工单、待执行保养任务。",
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}
```

**G2 合计：22 个 MCP Tools**

### G2 相对 G1 的设计差异

| 差异点 | G1 Controller | G2 MCP Tool |
|--------|--------------|-------------|
| 粒度 | 75 个细碎方法 | 22 个语义化工具 |
| 聚合 | 备件7种单据各自独立 | 统一为 query_spare_transactions(type=...) |
| 聚合 | 巡检4种维度各自独立 | 统一为 get_patrol_analytics(dimension=...) |
| 聚合 | 维修详情+备件+工时+知识各自独立 | 统一为 get_repair_detail 一站式返回 |
| 增强 | 故障趋势固定30天 | get_fault_trend 支持自定义天数+按设备/产线过滤 |
| 增强 | Governance 看板和钻取是两个API | 统一为 get_governance_dashboard(drilldown=true/false) |
| 缺失补全 | 无跨域设备全景 | *(待实现，预留)* |

---

## G3 — DSL 路由（备选方案）

### G3 Prompt 中的 DSL 规范

以下是 EAM 查询 DSL 语法规范。将用户的自然语言转换为 DSL 表达式。

输出格式：
```json
{
  "dsl": "DSL 表达式"
}
```

### 语法规范

```bnf
<query>     ::= QUERY <entity> [<where>] [<join>]* [<aggregate>] [<order>] [<limit>]
<where>     ::= WHERE <condition> (AND <condition>)*
<condition> ::= <field> <op> <value>
<op>        ::= = | != | > | >= | < | <= | IN | LIKE | BETWEEN
<value>     ::= <string> | <number> | <date> | <list>
<join>      ::= JOIN <entity> [ON <field> = <field>]
<aggregate> ::= AGGREGATE <agg_func> (, <agg_func>)*
<agg_func>  ::= COUNT | SUM(<field>) | AVG(<field>) | MIN(<field>) | MAX(<field>) | TREND(<field>)
<order>     ::= ORDER BY <field> [ASC | DESC]
<limit>     ::= LIMIT <number>
```

### 可用实体

| 实体名 | 说明 | 主要字段 |
|--------|------|---------|
| equipment | 设备 | id, equipment_code, equipment_name, status, category_id, location_id, production_line_id, dept_id, is_key |
| fault_report | 故障报修 | id, equipment_id, report_time, fault_type_id, status, urgency |
| repair_order | 维修工单 | id, equipment_id, fault_report_id, status, create_time, complete_time |
| repair_spare_usage | 维修备件用量 | repair_order_id, spare_part_id, quantity, unit_price |
| repair_workload | 维修工时 | repair_order_id, worker_id, hours |
| maintenance_plan | 保养计划 | id, status, cycle_type, cycle_value |
| maintenance_task | 保养任务 | id, equipment_id, plan_id, status, planned_time, actual_time |
| maintenance_record | 保养记录 | task_id, item_name, result |
| patrol_plan | 巡检计划 | id, status |
| patrol_task | 巡检任务 | id, equipment_id, plan_id, status, start_time |
| patrol_record | 巡检记录 | task_id, check_result |
| anomaly_record | 异常记录 | id, equipment_id, source, severity, status |
| spare_part | 备件 | id, spare_name, spare_code, type_id, status |
| spare_stock | 备件库存 | spare_id, warehouse_id, quantity |
| equipment_spare_bom | 设备备件BOM | equipment_id, spare_id |
| production_line_equipment | 产线设备 | production_line_id, equipment_id |
| stock_in_order | 入库单 | id, status, create_time |
| stock_out_order | 出库单 | id, status, create_time |

### 隐式连接规则

当 JOIN 不指定 ON 条件时，使用以下默认关系：

| FROM | JOIN | 默认 ON |
|------|------|---------|
| equipment | fault_report | fault_report.equipment_id = equipment.id |
| equipment | repair_order | repair_order.equipment_id = equipment.id |
| equipment | maintenance_task | maintenance_task.equipment_id = equipment.id |
| equipment | patrol_task | patrol_task.equipment_id = equipment.id |
| equipment | anomaly_record | anomaly_record.equipment_id = equipment.id |
| equipment | equipment_spare_bom | equipment_spare_bom.equipment_id = equipment.id |
| equipment | production_line_equipment | production_line_equipment.equipment_id = equipment.id |
| repair_order | repair_spare_usage | repair_spare_usage.repair_order_id = repair_order.id |
| repair_order | repair_workload | repair_workload.repair_order_id = repair_order.id |
| repair_order | fault_report | repair_order.fault_report_id = fault_report.id |
| spare_part | spare_stock | spare_stock.spare_id = spare_part.id |
| spare_part | equipment_spare_bom | equipment_spare_bom.spare_id = spare_part.id |

### 示例

**L1 — "A 线有多少台设备？"**
```
QUERY equipment
  JOIN production_line_equipment
  WHERE production_line_equipment.production_line_id = "A线"
  AGGREGATE COUNT
```

**L2 — "上月故障最多的设备是哪台？"**
```
QUERY fault_report
  WHERE report_time BETWEEN "2026-02-01" AND "2026-02-28"
  AGGREGATE COUNT
  ORDER BY COUNT DESC
  LIMIT 1
```

**L3 — "A 线上月维修用了哪些备件？"**
```
QUERY repair_spare_usage
  JOIN repair_order
  JOIN equipment
  JOIN production_line_equipment
  WHERE production_line_equipment.production_line_id = "A线"
    AND repair_order.create_time BETWEEN "2026-02-01" AND "2026-02-28"
```

**L5 — "哪条产线近 3 个月故障呈上升趋势？"**
```
QUERY fault_report
  JOIN equipment
  JOIN production_line_equipment
  WHERE report_time >= "2026-01-01"
  AGGREGATE COUNT, TREND(report_time)
  ORDER BY TREND DESC
```
