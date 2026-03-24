# EAM 数据模型概览

> 来源：/Users/dingjq/IdeaProjects/eamNewGe

## 模块

- **EAM**（设备资产管理）— 91 个实体
- **PTM**（项目任务管理）— 10 个实体

## 核心数据域

### 1. 设备管理
| 实体 | 说明 |
|------|------|
| EamEquipment | 设备台账 |
| EamEquipmentCategory | 设备分类（层级） |
| EamEquipmentParameter | 设备技术参数 |
| EamEquipmentStatusHistory | 设备状态变更审计 |
| EamLocation | 物理位置 |
| EamProductionLine | 产线 |
| EamProductionLineEquipment | 产线-设备关联 |
| EamEquipmentRunRecord | 设备运行记录 |
| EamConditionReading | 工况参数读数 |
| EamConditionAlert | 工况告警 |

### 2. 故障维修
| 实体 | 说明 |
|------|------|
| EamFaultReport | 故障报告 |
| EamFaultType | 故障分类（层级） |
| EamRepairOrder | 维修工单 |
| EamRepairPlan | 维修计划 |
| EamRepairSpareUsage | 维修备件用量 |
| EamRepairWorkload | 维修工时 |
| EamOutsourceOrder | 外协维修 |

**流程链**：FaultReport → RepairOrder → RepairPlan → RepairWorkload → 完工

### 3. 保养巡检
| 实体 | 说明 |
|------|------|
| EamMaintenancePlan | 保养计划 |
| EamMaintenanceTask | 保养任务 |
| EamMaintenanceRecord | 保养记录 |
| EamMaintenanceStandard | 保养标准 |
| EamPatrolPlan | 巡检计划 |
| EamPatrolTask | 巡检任务 |
| EamPatrolRecord | 巡检记录 |
| EamCheckStandard | 检查标准 |
| EamAnomalyRecord | 异常记录 |
| EamSpotCheck | 抽检 |
| EamSafetyInspection | 安全检查 |

**流程链**：Plan → Task → Record → AnomalyRecord

### 4. 备件管理
| 实体 | 说明 |
|------|------|
| EamSparePart | 备件台账 |
| EamSpareType | 备件分类 |
| EamSpareStock | 库存 |
| EamWarehouse | 仓库 |
| EamEquipmentSpareBom | 设备 BOM |
| EamSparePurchaseOrder | 采购单 |
| EamStockInOrder | 入库单 |
| EamStockOutOrder | 出库单 |
| EamSpareReturnOrder | 退库单 |
| EamSpareTransferOrder | 调拨单 |

### 5. 知识管理
| 实体 | 说明 |
|------|------|
| EamDocument | 技术文档 |
| EamMaintenanceExperience | 维修经验/最佳实践 |
| EamRepairOrderKnowledgeRef | 维修-知识关联 |

### 6. 设备生命周期
| 实体 | 说明 |
|------|------|
| EamEquipmentAcquisition | 设备采购申请 |
| EamEquipmentAcceptance | 设备验收 |
| EamEquipmentChange | 设备变更 |

### 7. PTM 项目管理
| 实体 | 说明 |
|------|------|
| PtmProject | 项目 |
| PtmMilestone | 里程碑 |
| PtmIssue | 问题（Bug/Task/Feature） |
| PtmIssueWorklog | 工时 |

## 现有分析能力

- **EamDashboardController** — 设备汇总统计、故障状态、维修指标、设备状态分布
- **EamGovernanceController** — 生命周期治理概览、设备状态分析
- **EamAnomalyRecordController** — 异常分组（按设备/来源/日期）
- **EamPatrolTaskController** — 巡检 KPI、按标准/设备/计划分析

**结论**：基础仪表盘有了，但只是汇总数字。缺乏跨域关联分析、趋势预测、自然语言查询。

## 核心关系图（简化）

```
Equipment (主数据)
├── Categories (层级分类)
├── Locations (位置)
├── ProductionLines (产线)
├── StatusHistory (状态变更)
├── RunRecords (运行记录)
├── Parameters (技术参数)
└── Files/Documents (文档)

故障维修链：
FaultReport → RepairOrder → RepairSpareUsage → SparePart
                          → RepairWorkload
                          → OutsourceOrder

保养巡检链：
MaintenancePlan → MaintenanceTask → MaintenanceRecord
PatrolPlan → PatrolTask → PatrolRecord → AnomalyRecord

备件流转链：
SparePart → SpareStock → PurchaseOrder → StockIn
                       → StockOut → RepairSpareUsage
                       → Transfer / Return / Scrap
```
