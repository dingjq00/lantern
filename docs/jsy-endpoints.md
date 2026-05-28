# JSY 南厂酿酒车间 — Endpoint 全清单

> 生成时间：2026-05-28  
> 来源：扫描 `/Users/dingjq/IdeaProjects/JSYSmartFactoryII/南厂酿酒车间/Backend/Controllers`  
> 控制器文件数：66  
> Endpoint 总数：**589**  
> 提取方式：Python 静态扫描 `[RoutePrefix]` + `[Route]` + `[Http*]` 属性  

## 统计概览

- HTTP 动词分布：POST=576 / GET=13
- 公开（Authorization.Disable=true）：14
- 受保护（默认 JWT）：575

### 按业务域统计

| 业务域目录 | 控制器数 | Endpoint 数 |
|---|---:|---:|
| `General/` | 2 | 100 |
| `RoomInfo/` | 5 | 60 |
| `App/` | 4 | 56 |
| `PlanOrder/` | 6 | 50 |
| `Inventory/` | 7 | 45 |
| `Equipment/` | 2 | 31 |
| `Materials/` | 5 | 31 |
| `_root/` | 9 | 27 |
| `Check/` | 2 | 27 |
| `Order/` | 5 | 27 |
| `MakeWine/` | 2 | 23 |
| `OPC/` | 2 | 14 |
| `Warning/` | 1 | 12 |
| `ClockIn/` | 1 | 10 |
| `Formula/` | 1 | 10 |
| `MenuRole/` | 1 | 9 |
| `SiloScada/` | 1 | 9 |
| `HygieneCheck/` | 1 | 8 |
| `Login/` | 1 | 7 |
| `ReferenceParameter/` | 1 | 7 |
| `Base/` | 1 | 6 |
| `Violation/` | 1 | 5 |
| `WaterQuality/` | 1 | 5 |
| `AIAnalysis/` | 1 | 3 |
| `File/` | 1 | 3 |
| `FileDownload/` | 1 | 2 |
| `Outside/` | 1 | 2 |

---

## 全量 Endpoint 表

### General/

#### `Controllers/General/GeneralController.cs` — 96 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/General/GetZQMMDef` | GetZQMMDef | PlanOrderRequest | List<MMDefReturn> | JWT | 大曲物料 type = 1 日计划物料 |
| POST | `/General/GetLocation` | GetLocation | GeneralRequest | GetDataByPageVo<LoactionReturn> | JWT | 车间列表 |
| POST | `/General/SaveLocation` | SaveLocation | LoactionReturn | string | JWT |  |
| POST | `/General/DeleteLocation` | DeleteLocation | GeneralRequest | string | JWT |  |
| POST | `/General/GetLine` | GetLine | GeneralRequest | GetDataByPageVo<LineReturn> | JWT | 产线 |
| POST | `/General/SaveLine` | SaveLine | LineReturn | string | JWT |  |
| POST | `/General/DeleteLine` | DeleteLine | GeneralRequest | string | JWT |  |
| POST | `/General/GetProcess` | GetProcess | GeneralRequest | GetDataByPageVo<ProcessReturn> | JWT | 工序 |
| POST | `/General/getProcessDetail` | getProcessDetail | GeneralRequest | GetDataByPageVo<ParamProcessData> | JWT |  |
| POST | `/General/getYFLProcessDetail` | getYFLProcessDetail | GeneralRequest | GetDataByPageVo<ParamProcessData> | JWT |  |
| POST | `/General/SaveProcessSortOrder` | SaveProcessSortOrder | SortDatas | string | JWT |  |
| POST | `/General/SaveProcess` | SaveProcess | ProcessReturn | string | JWT |  |
| POST | `/General/DeleteProcess` | DeleteProcess | GeneralRequest | string | JWT |  |
| POST | `/General/GetProcessParameters` | GetProcessParameters | ProcessParamRequest | GetDataByPageVo<ProcessParamRequest> | JWT |  |
| POST | `/General/SaveProcessParameter` | SaveProcessParameter | ProcessParamRequest | string | JWT |  |
| POST | `/General/DeleteProcessParameter` | DeleteProcessParameter | ProcessParamRequest | string | JWT |  |
| POST | `/General/GetEqu` | GetEqu | EquRequest | GetDataByPageVo<EquReturn> | JWT | 设备 |
| POST | `/General/GetEquArea` | GetEquArea | EquRequest | GetDataByPageVo<ZQEquipmentArea> | JWT |  |
| POST | `/General/GetEquLoc` | GetEquLoc | EquRequest | GetDataByPageVo<ZQEquipmentLocation> | JWT |  |
| POST | `/General/GetLocEquItem` | GetLocEquItem | EquRequest | GetDataByPageVo<EquReturn> | JWT |  |
| POST | `/General/GetEquSearch` | GetEquSearch | EquRequest | GetDataByPageVo<EquSearchReturn> | JWT |  |
| POST | `/General/GetLineDevices` | GetLineDevices | EquRequest | GetDataByPageVo<ZQLineEquipment> | JWT |  |
| POST | `/General/SaveLineDevice` | SaveLineDevice | EquLineRequest | string | JWT |  |
| POST | `/General/DeleteLineDevice` | DeleteLineDevice | EquLineRequest | string | JWT |  |
| POST | `/General/GetTrick` | GetTrick | TrickRequest | GetDataByPageVo<TrickReturn> | JWT | 获取班次 |
| POST | `/General/GetTrickList` | GetTrickList | TrickRequest | GetDataByPageVo<ZQTrick> | JWT |  |
| POST | `/General/SaveTrickList` | SaveTrickList | TrickRequest | string | JWT |  |
| POST | `/General/DeleteTrick` | DeleteTrick | TrickRequest | string | JWT |  |
| POST | `/General/GetWorkTeam` | GetWorkTeam | WorkTeamRequest | GetDataByPageVo<WorkTeamListVO> | JWT | 根据车间PK查班组 |
| POST | `/General/WorkTeamList` | WorkTeamList | WorkTeamRequest | GetDataByPageVo<WorkTeamListVO> | JWT |  |
| POST | `/General/UpdateWorkTeam` | UpdateWorkTeam | UpdateWorkTeamRequest | string | JWT | 修改班组 |
| POST | `/General/DeleteWorkTeam` | DeleteWorkTeam | UpdateWorkTeamRequest | string | JWT | 删除班组 |
| POST | `/General/GetTeamUser` | GetTeamUser | WorkTeamRequest | GetDataByPageVo<ZQWorkTeamUser> | JWT | 根据车间PK查班组成员 |
| POST | `/General/GetTeamUserByID` | GetTeamUserByID | ProcessParamRequest | GetDataByPageVo<ZQWorkTeamUser> | JWT | 根据车间PK查班组成员 |
| POST | `/General/SaveTeamUser` | SaveTeamUser | WorkTeamRequest | string | JWT |  |
| POST | `/General/Getuserlist` | Getuserlist | GeneralRequest | GetDataByPageVo<UserVO> | JWT |  |
| POST | `/General/getDepartmentList` | getDepartmentList | PageBaseRequest | GetDataByPageVo<Department> | JWT |  |
| POST | `/General/Saveuser` | Saveuser | UserReturn | string | JWT |  |
| POST | `/General/GetPositions` | GetPositions | WorkTeamRequest | GetDataByPageVo<MemberPost> | JWT |  |
| POST | `/General/GetWorkshopTeamTree` | GetWorkshopTeamTree | WorkTeamRequest | GetDataByPageVo<GeneralTreeListVO> | JWT |  |
| POST | `/General/SavePosition` | SavePosition | PostRequest | string | JWT |  |
| POST | `/General/DeletePosition` | DeletePosition | PostRequest | string | JWT |  |
| POST | `/General/SavePostUser` | SavePostUser | PostMemRequest | string | JWT |  |
| POST | `/General/GetPostUser` | GetPostUser | PostRequest | GetDataByPageVo<PostMemberConsist> | JWT |  |
| POST | `/General/GetSchedulTable` | GetSchedulTable | SchedulRequest | GetDataByPageVo<SchedTableListVO> | JWT |  |
| POST | `/General/GetSchedulReportTable` | GetSchedulReportTable | GeneralRequest | GetDataByPageVo<SchedTableListVO> | JWT |  |
| POST | `/General/GetSchedulTeam` | GetSchedulTeam | SchedulRequest | GetDataByPageVo<SchedTableTeamListVO> | JWT |  |
| POST | `/General/GetSchedulDateTable` | GetSchedulDateTable | SchedulRequest | GetDataByPageVo<SchedTableDateListVO> | JWT |  |
| POST | `/General/DeleteSchedulDateTable` | DeleteSchedulDateTable | DeSchedulRequest | string | JWT |  |
| POST | `/General/DeleteSchedulDateTables` | DeleteSchedulDateTables | DeSchedulListRequest | string | JWT |  |
| POST | `/General/SaveSchedulUserDefault` | SaveSchedulUserDefault | SchedulSaveRequest | string | JWT |  |
| POST | `/General/SaveSchedulUser` | SaveSchedulUser | SchedulSaveRequest | string | JWT |  |
| POST | `/General/SaveSchedulUserTemplate` | SaveSchedulUserTemplate | SchedulSaveRequest | string | JWT |  |
| POST | `/General/GetHandover` | GetHandover | HandoverRequest | GetDataByPageVo<HandoverVO> | JWT |  |
| POST | `/General/AddHandoverRecord` | AddHandoverRecord | UpdateHandoverRequest | string | JWT |  |
| POST | `/General/DeleteHandoverRecord` | DeleteHandoverRecord | UpdateHandoverRequest | string | JWT |  |
| POST | `/General/GetCheckType` | GetCheckType | GeneralRequest | GetDataByPageVo<ZQCheckType> | JWT |  |
| POST | `/General/SaveCheckType` | SaveCheckType | ZQCheckType | string | JWT |  |
| POST | `/General/DeleteCheckType` | DeleteCheckType | GeneralRequest | string | JWT |  |
| POST | `/General/GetCheckItem` | GetCheckItem | GeneralRequest | GetDataByPageVo<ZQCheckItem> | JWT |  |
| POST | `/General/SaveCheckItem` | SaveCheckItem | ZQCheckItem | string | JWT |  |
| POST | `/General/DeleteCheckItem` | DeleteCheckItem | GeneralRequest | string | JWT |  |
| POST | `/General/GetCheckOptionItem` | GetCheckOptionItem | GeneralRequest | GetDataByPageVo<ZQCheckItemOption> | JWT |  |
| POST | `/General/SaveCheckItemOption` | SaveCheckItemOption | ZQCheckItemOption | string | JWT |  |
| POST | `/General/DeleteCheckItemOption` | DeleteCheckItemOption | GeneralRequest | string | JWT |  |
| POST | `/General/GetCheckGroup` | GetCheckGroup | GeneralRequest | GetDataByPageVo<ZQCheckGroup> | JWT |  |
| POST | `/General/GetCheckGroupItems` | GetCheckGroupItems | GeneralRequest | GetDataByPageVo<ZQCheckGroupDetail> | JWT |  |
| POST | `/General/SaveCheckGroupItems` | SaveCheckGroupItems | CheckGroupRequest | string | JWT |  |
| POST | `/General/SaveCheckGroup` | SaveCheckGroup | ZQCheckGroup | string | JWT |  |
| POST | `/General/DeleteCheckGroup` | DeleteCheckGroup | GeneralRequest | string | JWT |  |
| POST | `/General/GetLimsOrder` | GetLimsOrder | GeneralRequest | GetDataByPageVo<GeneralLimsVO> | JWT |  |
| POST | `/General/GetLimsOrderByID` | GetLimsOrderByID | GeneralRequest | GetDataByPageVo<CheckOrder> | JWT |  |
| POST | `/General/getWWeightChart` | getWWeightChart | GeneralRequest | GetDataByPageVo<OpcNet4Clickhouse> | JWT |  |
| POST | `/General/CheckAutoSettingList` | CheckAutoSettingList | CheckAutoSettingRequest | GetDataByPageVo<CheckAutoSettingVO> | JWT |  |
| POST | `/General/SaveCheckAutoSetting` | SaveCheckAutoSetting | SaveCheckAutoSettingRequest | string | JWT |  |
| POST | `/General/DeleteCheckAutoSetting` | DeleteCheckAutoSetting | CheckAutoSettingRequest | string | JWT |  |
| POST | `/General/CheckParameterList` | CheckParameterList | CheckParameterRequest | GetDataByPageVo<CheckParameterVO> | JWT |  |
| POST | `/General/SaveCheckParameter` | SaveCheckParameter | SaveCheckParameterRequest | string | JWT |  |
| POST | `/General/DeleteCheckParameter` | DeleteCheckParameter | CheckParameterRequest | string | JWT |  |
| POST | `/General/getLimsLevelReportData` | getLimsLevelReportData | GeneralRequest | GetDataByPageVo<GeneralLimsLevelVO> | JWT |  |
| POST | `/General/getDQLimsReportData` | getDQLimsReportData | GeneralRequest | GetDataByPageVo<GeneralLimsLevelVO> | JWT |  |
| POST | `/General/GetZQAttendance` | GetZQAttendance | GeneralRequest | GetDataByPageVo<ZQMemberLeaveLog> | JWT | 考勤 |
| POST | `/General/GetWorkflowType` | GetWorkflowType | ZQOrderManager | GetDataByPageVo<ZQOrderManager> | JWT |  |
| POST | `/General/SaveWorkflowType` | SaveWorkflowType | ZQOrderManager | string | JWT |  |
| POST | `/General/DeleteWorkflowType` | DeleteWorkflowType | ZQOrderManager | string | JWT |  |
| POST | `/General/SaveWorkTypeManage` | SaveWorkTypeManage | ZQOrderTypeManager | string | JWT |  |
| POST | `/General/GetWorkTypeList` | GetWorkTypeList | WorkTypeListRequest | GetDataByPageVo<ZQOrderTypeManager> | JWT |  |
| POST | `/General/GetTicketsList` | GetTicketsList | TicketListRequest | GetDataByPageVo<ZQOrderInstance> | JWT |  |
| POST | `/General/GetTicketDetail` | GetTicketDetail | TicketDetailRequest | ZQOrderInstance | JWT |  |
| POST | `/General/GetTicketTransitions` | GetTicketTransitions | TicketDetailRequest | GetDataByPageVo<ZQOrderTransitionLog> | JWT |  |
| POST | `/General/GetWorkflowSystemRoles` | GetWorkflowSystemRoles | — | List<LoactionReturn> | JWT | 获取流转系统角色列表 |
| POST | `/General/CreateTicket` | CreateTicket | ZQOrderInstance | string | JWT |  |
| POST | `/General/EditTicket` | EditTicket | ZQOrderInstance | string | JWT |  |
| POST | `/General/DeleteTicket` | DeleteTicket | TicketDetailRequest | string | JWT |  |
| POST | `/General/SoftDeleteTicket` | SoftDeleteTicket | TicketDetailRequest | string | JWT |  |
| POST | `/General/TransitionTicket` | TransitionTicket | TransitionRequest | string | JWT |  |

#### `Controllers/General/WorkshopController.cs` — 4 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/Workshop/List` | List | WorkshopRequest | AjaxResult<GetDataByPageVo<WorkshopVO>> | JWT |  |
| POST | `/Workshop/Get` | Get | WorkshopRequest | AjaxResult<WorkshopVO> | JWT |  |
| POST | `/Workshop/Save` | Save | SaveWorkshopRequest | AjaxResult<WorkshopVO> | JWT |  |
| POST | `/Workshop/Delete` | Delete | WorkshopRequest | AjaxResult | JWT |  |

### RoomInfo/

#### `Controllers/RoomInfo/FermentRoomAnalysisController.cs` — 2 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/fermentRoomAnalysis/FermentOrderList` | FermentOrderList | FermentRoomAnalysisRequest | GetDataByPageVo<FermentRoomAnalysisOrderVO> | JWT |  |
| POST | `/fermentRoomAnalysis/GetChartParameters` | GetChartParameters | FermentRoomAnalysisRequest | ChartParametersVO | JWT |  |

#### `Controllers/RoomInfo/FermentRoomController.cs` — 31 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/fermentRoom/FermentRoomInfo` | FermentRoomInfo | FermentOrderRequest | FermentRoomVO | JWT | 曲房信息 |
| POST | `/fermentRoom/FermentOrderList` | FermentOrderList | FermentOrderRequest | GetDataByPageVo<FermentOrderVO> | JWT | 发酵工单列表 |
| POST | `/fermentRoom/ShelfList` | ShelfList | FermentOrderRequest | GetDataByPageVo<ShelfRowVO> | JWT | 曲架列表 |
| POST | `/fermentRoom/EnvironmentChart` | EnvironmentChart | FermentOrderChartRequest | CurveChart | JWT | 参数曲线 |
| POST | `/fermentRoom/TempChart` | TempChart | FermentOrderChartRequest | CurveChart | JWT | 温度曲线 |
| POST | `/fermentRoom/InRoomList` | InRoomList | FermentOrderRequest | GetDataByPageVo<FermentInRoomVO> | JWT | 入房数据 |
| POST | `/fermentRoom/OutRoomList` | OutRoomList | FermentOrderRequest | GetDataByPageVo<FermentOutRoomVO> | JWT | 出房数据 |
| POST | `/fermentRoom/OrderChart` | OrderChart | FermentOrderChartRequest | CurveChart | JWT | 根据发酵工单找参数曲线 |
| POST | `/fermentRoom/SetStandardChart` | SetStandardChart | FermentOrderChartRequest | string | JWT | 根据发酵工单生成标准曲线 |
| POST | `/fermentRoom/FermentOrderParameterAsync` | FermentOrderParameterAsync | FermentOrderChartRequest | Task<GetDataByPageVo<FermentOrderParameterVO>> | JWT |  |
| POST | `/fermentRoom/InRoomSituation` | InRoomSituation | InRoomListRequest | GetDataByPageVo<InRoomListVO> | JWT |  |
| POST | `/fermentRoom/FermentationProgress` | FermentationProgress | EquipmentRequest | GetDataByPageVo<FermentationProgressVO> | JWT | 房间的发酵进度 |
| POST | `/fermentRoom/WaterQualityCheck` | WaterQualityCheck | WaterQualityCheckRequest | string | JWT |  |
| POST | `/fermentRoom/WaterQualityCheckInfo` | WaterQualityCheckInfo | WaterQualityCheckRequest | GetDataByPageVo<WaterQualityCheckInfoVO> | JWT |  |
| POST | `/fermentRoom/QuBlockProductionChartOld` | QuBlockProductionChartOld | QuBlockProductionChartRequest | CurveChart | JWT | 曲块生产情况(按工单) |
| POST | `/fermentRoom/QuBlockProductionChart` | QuBlockProductionChart | QuBlockProductionChartRequest | CurveChart | JWT | 曲块生产情况(按时间) |
| POST | `/fermentRoom/InRoomData` | InRoomData | InRoomDataRequest | InRoomDataVO | JWT |  |
| POST | `/fermentRoom/PlanInRoomData` | PlanInRoomData | InRoomDataRequest | InRoomDataVO | JWT |  |
| POST | `/fermentRoom/PlanOutRoomData` | PlanOutRoomData | InRoomDataRequest | InRoomDataVO | JWT |  |
| POST | `/fermentRoom/GetPlanOrderBySource` | GetPlanOrderBySource | PlanOrderBySourceRequest | GetDataByPageVo<ZQDayPlanMainOrder> | JWT |  |
| POST | `/fermentRoom/RoomWarning` | RoomWarning | RoomWarningRequest | GetDataByPageVo<RoomWarningVO> | JWT |  |
| POST | `/fermentRoom/CorrectionProductionBlock` | CorrectionProductionBlock | CorrectionProductionBlockRequest | GetDataByPageVo<CorrectionProductionBlockVO> | JWT | 校正生产数量 |
| POST | `/fermentRoom/CorrectionProductionProcess` | CorrectionProductionProcess | CorrectionProductionBlockRequest | string | JWT | 校正生产批次流程 |
| POST | `/fermentRoom/OutRoomCompleted` | OutRoomCompleted | OutRoomCompletedRequest | string | JWT | 出房完成 |
| POST | `/fermentRoom/AbnormalList` | AbnormalList | FermentOrderRequest | GetDataByPageVo<AbnormalListVO> | JWT | 当前所有曲房异常数据 |
| POST | `/fermentRoom/HandleAbnormal` | HandleAbnormal | FermentOrderRequest | string | JWT | 处理温度预警 |
| POST | `/fermentRoom/RoomInfoReport` | RoomInfoReport | RoomInfoReportRequest | GetDataByPageVo<RoomInfoReportVO> | JWT |  |
| POST | `/fermentRoom/RoomNowSituation` | RoomNowSituation | EquipmentRequest | RoomNowSituationVO | JWT |  |
| POST | `/fermentRoom/RoomPlanDate` | RoomPlanDate | RoomPlanDateRequest | GetDataByPageVo<RoomPlanDateVO> | JWT |  |
| POST | `/fermentRoom/RoomLifeCycle` | RoomLifeCycle | FermentOrderVO | RoomLifeCycleVO | JWT | 房间生命周期 |
| POST | `/fermentRoom/SourceInfo` | SourceInfo | SourceInfoRequest | SourceInfoVO | JWT |  |

#### `Controllers/RoomInfo/FermentRoomIssueController.cs` — 4 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/roomIssue/FermentStageList` | FermentStageList | FermentRoomIssueRequest | GetDataByPageVo<FermentStageVO> | JWT | 发酵阶段 |
| POST | `/roomIssue/FormulaItemList` | FormulaItemList | FermentRoomIssueRequest | GetDataByPageVo<IssueDataVO> | JWT | 下发参数 |
| POST | `/roomIssue/IssueAsync` | IssueAsync | FermentRoomIssueRequest | Task<string> | JWT | 下发 |
| POST | `/roomIssue/SaveLog` | SaveLog | SaveLogRequest | string | JWT |  |

#### `Controllers/RoomInfo/FermentRoomWeeklyReportController.cs` — 12 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/fermentRoomWeeklyReport/ProductionYear` | ProductionYear | FermentRoomWeeklyReportRequest | GetDataByPageVo<ProductionYearVO> | JWT | 年度生产情况 |
| POST | `/fermentRoomWeeklyReport/ProductionMonth` | ProductionMonth | FermentRoomWeeklyReportRequest | GetDataByPageVo<ProductionMonthVO> | JWT | 月度生产情况 |
| POST | `/fermentRoomWeeklyReport/ProductionMonthByDate` | ProductionMonthByDate | FermentRoomWeeklyReportRequest | GetDataByPageVo<ProductionMonthByDateVO> | JWT | 月度生产情况(根据月份时间段批量返回) |
| POST | `/fermentRoomWeeklyReport/ProductionPlan` | ProductionPlan | FermentRoomWeeklyReportRequest | GetDataByPageVo<ProductionPlanVO> | JWT | 周生产情况 |
| POST | `/fermentRoomWeeklyReport/OutRoomPlan` | OutRoomPlan | FermentRoomWeeklyReportRequest | GetDataByPageVo<OutRoomPlanVO> | JWT | 周出房情况 |
| POST | `/fermentRoomWeeklyReport/OutWarehousePlan` | OutWarehousePlan | FermentRoomWeeklyReportRequest | GetDataByPageVo<OutWarehousePlanVO> | JWT | 周出库情况 |
| POST | `/fermentRoomWeeklyReport/OutWarehousePlatformOld` | OutWarehousePlatformOld | FermentRoomWeeklyReportRequest | GetDataByPageVo<OutWarehousePlatformVO> | JWT | 周出库站台粉碎情况 |
| POST | `/fermentRoomWeeklyReport/OutWarehousePlatform` | OutWarehousePlatform | FermentRoomWeeklyReportRequest | GetDataByPageVo<OutWarehousePlatformVO> | JWT | 周出库站台粉碎情况(自动化数据) |
| POST | `/fermentRoomWeeklyReport/OutWarehousePlatformDate` | OutWarehousePlatformDate | FermentRoomWeeklyReportRequest | OutWarehousePlatformDateVO | JWT |  |
| POST | `/fermentRoomWeeklyReport/TeamMonthlyProductionSummary` | TeamMonthlyProductionSummary | FermentRoomWeeklyReportRequest | GetDataByPageVo<TeamMonthlyProductionSummaryVO> | JWT |  |
| POST | `/fermentRoomWeeklyReport/TeamMonthlyMaterialIssueSummary` | TeamMonthlyMaterialIssueSummary | FermentRoomWeeklyReportRequest | GetDataByPageVo<TeamMonthlyMaterialIssueSummaryVO> | JWT |  |
| POST | `/fermentRoomWeeklyReport/OutRoomPlanV2` | OutRoomPlanV2 | OutRoomPlanV2Request | OutRoomPlanV2VO | JWT | 出房完成情况 V2（只读，计划出房 + AGV 出房间数/明细[剔除当日人工曲块来源房间] + 人工曲块出房确认，支持周/月/季度/年查询） |

#### `Controllers/RoomInfo/ProductionTaskController.cs` — 11 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/productionTask/TaskList` | TaskList | TaskRequest | GetDataByPageVo<TaskListVO> | JWT |  |
| POST | `/productionTask/TaskCopy` | TaskCopy | TaskRequest | string | JWT |  |
| POST | `/productionTask/TaskSave` | TaskSave | TaskRequest | string | JWT |  |
| POST | `/productionTask/TaskDelete` | TaskDelete | TaskRequest | string | JWT |  |
| POST | `/productionTask/TaskItemList` | TaskItemList | TaskRequest | GetDataByPageVo<TaskItemListVO> | JWT |  |
| POST | `/productionTask/TaskItemSave` | TaskItemSave | TaskItemRequest | string | JWT |  |
| POST | `/productionTask/TaskItemDelete` | TaskItemDelete | TaskItemRequest | string | JWT |  |
| POST | `/productionTask/MonthScoreReport` | MonthScoreReport | TaskRequest | MonthScoreVO | JWT |  |
| POST | `/productionTask/MonthTaskSetting` | MonthTaskSetting | TaskRequest | MonthTaskSettingVO | JWT |  |
| POST | `/productionTask/MergeDataList` | MergeDataList | TaskRequest | GetDataByPageVo<MergeDataVO> | JWT |  |
| POST | `/productionTask/ProductionWorkload` | ProductionWorkload | ProductionWorkloadRequest | GetDataByPageVo<ProductionWorkloadVO> | JWT | 工作量报表 |

### App/

#### `Controllers/App/AppController.cs` — 28 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/app/Delay` | Delay | DelayRequest | string | 公开 /UnPkg | 没用的接口 |
| POST | `/app/LoginInSystem` | LoginInSystem | DataInterface.App.LoginRequest | AjaxResult<UserInfo> | 公开 /UnPkg | 账号登陆 |
| POST | `/app/Logout` | Logout | — | AjaxResult<string> | JWT /UnPkg | 注销 |
| POST | `/app/UserInfo` | UserInfo | — | AjaxResult<UserInfo> | JWT /UnPkg | 用户信息 |
| POST | `/app/CheckVersion` | CheckVersion | VersionRequest | AjaxResult<VersionVO> | 公开 /UnPkg | 检查版本 |
| POST | `/app/VersionDownload` | VersionDownload | VersionRequest | AjaxResult<VersionDownloadVO> | 公开 /UnPkg | 版本更新 |
| POST | `/app/RefreshToken` | RefreshToken | — | AjaxResult<string> | 公开 /UnPkg | 刷新token |
| POST | `/app/AreaList` | AreaList | EquipmentRequest | AjaxResult<GetDataByPageVo<AreaListVO>> | JWT /UnPkg | 区域列表 |
| POST | `/app/LocationList` | LocationList | EquipmentRequest | AjaxResult<GetDataByPageVo<LocationListVO>> | JWT /UnPkg | 位置列表 |
| POST | `/app/EquList` | EquList | EquipmentRequest | AjaxResult<GetDataByPageVo<EquListVO>> | JWT /UnPkg | 设备列表 |
| POST | `/app/CreateCheck` | CreateCheck | CreateCheckRequest | AjaxResult<string> | JWT /UnPkg | 创建检验工单 |
| POST | `/app/TraceCheckListByRoom` | TraceCheckListByRoom | TraceCheckOrderByRoomRequest | AjaxResult<GetDataByPageVo<CheckOrderList>> | JWT /UnPkg |  |
| POST | `/app/PrepareCheckList` | PrepareCheckList | PrepareCheckInfoRequest | AjaxResult<GetDataByPageVo<CheckOrderList>> | JWT /UnPkg | 房间检验工单列表 |
| POST | `/app/CheckRandomList` | CheckRandomList | PrepareCheckInfoRequest | AjaxResult<GetDataByPageVo<string>> | JWT /UnPkg | 随机抽检 |
| POST | `/app/PrepareCheckInfo` | PrepareCheckInfo | PrepareCheckInfoRequest | AjaxResult<CheckInfoVO> | JWT /UnPkg | 巡检检查信息 |
| POST | `/app/CheckJoinInfo` | CheckJoinInfo | PrepareCheckInfoRequest | AjaxResult<GetDataByPageVo<CheckInfoVO>> | JWT /UnPkg | 关联的检验数据 |
| POST | `/app/CheckSave` | CheckSave | PrepareCheckSaveRequest | AjaxResult<string> | JWT /UnPkg | 保存检验数据 |
| POST | `/app/MonitorCheck` | MonitorCheck | MonitorCheckRequest | AjaxResult<MonitorCheckVO> | JWT /UnPkg | 监控巡检 |
| POST | `/app/MonitorCheckSave` | MonitorCheckSave | MonitorCheckInfoVO | AjaxResult<string> | JWT /UnPkg | 监控巡检保存 |
| POST | `/app/OpenCheck` | OpenCheck | OpenCheckRequest | AjaxResult<string> | JWT /UnPkg | 入房检查前下发启动检查 |
| POST | `/app/InRoomPrepare` | InRoomPrepare | InRoomPrepareRequest | AjaxResult<string> | JWT /UnPkg | 入房准备 |
| POST | `/app/FermentationBegins` | FermentationBegins | InRoomPrepareRequest | AjaxResult<string> | JWT /UnPkg | 发酵开始 |
| POST | `/app/FermentationCompleted` | FermentationCompleted | InRoomPrepareRequest | AjaxResult<string> | JWT /UnPkg | 发酵完成 |
| POST | `/app/OutRoomToWarehouse` | OutRoomToWarehouse | OutRoomToWarehouseRequest | AjaxResult<string> | JWT /UnPkg | 出房到库 |
| POST | `/app/SaveRoomProperty` | SaveRoomProperty | SaveRoomPropertyRequest | AjaxResult<string> | JWT /UnPkg |  |
| POST | `/app/PrepareFermentationRoom` | PrepareFermentationRoom | PrepareFermentationRoomRequest | AjaxResult<GetDataByPageVo<PrepareFermentationRoomVO>> | JWT /UnPkg | 计划发酵房间 |
| POST | `/app/PutawayCompletedInfo` | PutawayCompletedInfo | PutawayCompletedRequest | AjaxResult<PutawayCompletedInfoVO> | JWT /UnPkg |  |
| POST | `/app/PutawayCompleted` | PutawayCompleted | PutawayCompletedRequest | AjaxResult<string> | JWT /UnPkg | 库房入库完成 |

#### `Controllers/App/AppHXController.cs` — 7 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/apphx/DayOrderInfo` | DayOrderInfo | DayOrderInfoRequest | AjaxResult<GetDataByPageVo<DayOrderInfoVO>> | JWT /UnPkg |  |
| POST | `/apphx/Devices` | Devices | EquRequest | AjaxResult<GetDataByPageVo<ZQLineEquipment>> | JWT /UnPkg | 压曲机 |
| POST | `/apphx/SaveInRoom` | SaveInRoom | SaveInRoomRequest | AjaxResult<string> | JWT /UnPkg | 入房填报 |
| POST | `/apphx/SaveEnv` | SaveEnv | SaveEnvRequest | AjaxResult<string> | JWT /UnPkg | 房间环境填报 |
| POST | `/apphx/OperationList` | OperationList | SaveOperationRequest | AjaxResult<GetDataByPageVo<OperationVO>> | JWT /UnPkg |  |
| POST | `/apphx/SaveOperation` | SaveOperation | SaveOperationRequest | AjaxResult<string> | JWT /UnPkg | 保存培养房操作 |
| POST | `/apphx/MergeRoom` | MergeRoom | MergeRoomRequest | AjaxResult<string> | JWT /UnPkg | 并房 |

#### `Controllers/App/AppOtherController.cs` — 16 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/app1/UserList` | UserList | UserRequest | AjaxResult<GetDataByPageVo<DataInterface.App.UserVO>> | JWT /UnPkg | 用户列表 |
| POST | `/app1/FermentationProgress` | FermentationProgress | EquipmentRequest | AjaxResult<GetDataByPageVo<FermentationProgressVO>> | JWT /UnPkg | 发酵进度 |
| POST | `/app1/GetLocation` | GetLocation | GeneralRequest | AjaxResult<GetDataByPageVo<LoactionReturn>> | JWT /UnPkg |  |
| POST | `/app1/TrickList` | TrickList | TrickListRequest | AjaxResult<GetDataByPageVo<TrickVO>> | JWT /UnPkg |  |
| POST | `/app1/ZQXJTrickList` | ZQXJTrickList | TrickListRequest | AjaxResult<GetDataByPageVo<TrickVO>> | JWT /UnPkg | 自动创建那边是带班次配置的 |
| POST | `/app1/WorkTeamList` | WorkTeamList | TrickListRequest | AjaxResult<GetDataByPageVo<WorkTeamVO>> | JWT /UnPkg |  |
| POST | `/app1/GetTeamUserByID` | GetTeamUserByID | ProcessParamRequest | AjaxResult<GetDataByPageVo<ZQWorkTeamUser>> | JWT /UnPkg |  |
| POST | `/app1/EnterData` | EnterData | EnterDataRequest | AjaxResult<string> | JWT /UnPkg |  |
| POST | `/app1/CheckTaskSituation` | CheckTaskSituation | CheckTaskSituationRequest | AjaxResult<GetDataByPageVo<EquCheckTaskSituationVO>> | JWT /UnPkg |  |
| POST | `/app1/YeastLiquidQty` | YeastLiquidQty | YeastLiquidQtyRequest | AjaxResult<string> | JWT /UnPkg | 填写酵母液 |
| POST | `/app1/PrepareOutRoom` | PrepareOutRoom | PrepareOutRoomRequest | AjaxResult<GetDataByPageVo<PrepareOutRoomVO>> | JWT /UnPkg | 计划出房房间 |
| POST | `/app1/PlanInRoomData` | PlanInRoomData | InRoomDataRequest | AjaxResult<InRoomDataVO> | JWT /UnPkg | 入房情况 |
| POST | `/app1/ShiftInfo` | ShiftInfo | ShiftInfoRequest | AjaxResult<ShiftInfoVO> | JWT /UnPkg |  |
| POST | `/app1/ShiftSave` | ShiftSave | ShiftInfoRequest | AjaxResult<string> | JWT /UnPkg |  |
| POST | `/app1/ConfirmShift` | ConfirmShift | ShiftInfoRequest | AjaxResult<string> | JWT /UnPkg |  |
| POST | `/app1/CheckParameterList` | CheckParameterList | CheckParameterRequest | AjaxResult<GetDataByPageVo<CheckParameterVO>> | JWT /UnPkg |  |

#### `Controllers/App/VersionController.cs` — 5 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/version/VersionList` | VersionList | VersionListRequest | GetDataByPageVo<VersionListVO> | JWT |  |
| POST | `/version/GetID` | GetID | — | string | JWT |  |
| POST | `/version/Save` | Save | VersionSaveRequest | string | JWT |  |
| POST | `/version/Release` | Release | VersionSaveRequest | string | JWT |  |
| POST | `/version/Delete` | Delete | VersionSaveRequest | string | JWT |  |

### PlanOrder/

#### `Controllers/PlanOrder/YFLDayPlanOrderController.cs` — 13 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/YFLDayPlanOrder/GetList` | GetList | PlanOrderRequest | GetDataByPageVo<YFLDayPlanMainOrder> | JWT |  |
| POST | `/YFLDayPlanOrder/Getdatabyorderid` | Getdatabyorderid | PlanOrderRequest | YFLDayPlanMainOrder | JWT |  |
| POST | `/YFLDayPlanOrder/doEdit` | doEdit | OrderRequest | string | JWT |  |
| POST | `/YFLDayPlanOrder/doDelete` | doDelete | OrderRequest | string | JWT |  |
| POST | `/YFLDayPlanOrder/qfConf` | qfConf | OrderRequest | string | JWT |  |
| POST | `/YFLDayPlanOrder/GetqfList` | GetqfList | PlanOrderRequest | GetDataByPageVo<YeastRoomBatchOrder> | JWT |  |
| POST | `/YFLDayPlanOrder/ScnyInfo` | ScnyInfo | PlanOrderRequest | string | JWT |  |
| POST | `/YFLDayPlanOrder/getCurveData` | getCurveData | OrderRequest | GetDataByPageVo<ParamProcessData> | JWT |  |
| POST | `/YFLDayPlanOrder/getCurveDataByParam` | getCurveDataByParam | OrderRequest | GetDataByPageVo<ProcessLineReturn> | JWT |  |
| POST | `/YFLDayPlanOrder/qfwater` | qfwater | PlanOrderRequest | string | JWT |  |
| POST | `/YFLDayPlanOrder/qfyeast` | qfyeast | PlanOrderRequest | string | JWT |  |
| POST | `/YFLDayPlanOrder/MaterialBatchDetails` | MaterialBatchDetails | PlanOrderRequest | List<OutHutResGroup> | JWT |  |
| POST | `/YFLDayPlanOrder/DemandDayPlan` | DemandDayPlan | DemandDayPlanRequest | GetDataByPageVo<DemandDayPlanVO> | JWT | 酿酒车间需求计划 |

#### `Controllers/PlanOrder/YFLMonthPlanOrderController.cs` — 3 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/YFLMonthPlanOrder/GetList` | GetList | PlanOrderRequest | GetDataByPageVo<YFLMonthPlanMainOrder> | JWT | 年度计划 |
| POST | `/YFLMonthPlanOrder/doEdit` | doEdit | OrderRequest | string | JWT |  |
| POST | `/YFLMonthPlanOrder/doDelete` | doDelete | OrderRequest | string | JWT |  |

#### `Controllers/PlanOrder/YFLYearPlanOrderController.cs` — 3 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/YFLYearPlanOrder/GetYFLYearPlanOrder` | GetYFLYearPlanOrder | PlanOrderRequest | GetDataByPageVo<YFLYearPlanMainOrder> | JWT |  |
| POST | `/YFLYearPlanOrder/doEdit` | doEdit | OrderRequest | string | JWT |  |
| POST | `/YFLYearPlanOrder/doDelete` | doDelete | OrderRequest | string | JWT |  |

#### `Controllers/PlanOrder/ZQDayPlanOrderController.cs` — 25 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/ZQDayPlanOrder/GetList` | GetList | PlanOrderRequest | GetDataByPageVo<ZQDayPlanMainOrder> | JWT | 制曲年度计划 |
| POST | `/ZQDayPlanOrder/Getdatabyorderid` | Getdatabyorderid | PlanOrderRequest | ZQDayPlanMainOrder | JWT |  |
| POST | `/ZQDayPlanOrder/doEdit` | doEdit | OrderRequest | string | JWT |  |
| POST | `/ZQDayPlanOrder/doFinish` | doFinish | OrderRequest | string | JWT |  |
| POST | `/ZQDayPlanOrder/doDelete` | doDelete | OrderRequest | string | JWT |  |
| POST | `/ZQDayPlanOrder/doDeleteFJ` | doDeleteFJ | OrderRequest | string | JWT |  |
| POST | `/ZQDayPlanOrder/qfConf` | qfConf | OrderRequest | string | JWT |  |
| POST | `/ZQDayPlanOrder/GetqfList` | GetqfList | PlanOrderRequest | GetDataByPageVo<YeastRoomBatchOrder> | JWT |  |
| POST | `/ZQDayPlanOrder/GetBatchqf` | GetBatchqf | PlanOrderRequest | GetDataByPageVo<YeastRoomBatchOrder> | JWT |  |
| POST | `/ZQDayPlanOrder/Getqforder` | Getqforder | PlanOrderRequest | GetDataByPageVo<YeastRoomBatchOrder> | JWT |  |
| POST | `/ZQDayPlanOrder/ScnyInfo` | ScnyInfo | PlanOrderRequest | string | JWT |  |
| POST | `/ZQDayPlanOrder/getCurveData` | getCurveData | OrderRequest | GetDataByPageVo<ParamProcessData> | JWT |  |
| POST | `/ZQDayPlanOrder/getCurveDataByParam` | getCurveDataByParam | OrderRequest | GetDataByPageVo<ProcessLineReturn> | JWT |  |
| POST | `/ZQDayPlanOrder/qfwater` | qfwater | PlanOrderRequest | string | JWT |  |
| POST | `/ZQDayPlanOrder/qfyeast` | qfyeast | PlanOrderRequest | string | JWT |  |
| POST | `/ZQDayPlanOrder/MaterialBatchDetails` | MaterialBatchDetails | PlanOrderRequest | List<OutHutResGroup> | JWT |  |
| POST | `/ZQDayPlanOrder/getProcessDetailById` | getProcessDetailById | PlanOrderRequest | GetDataByPageVo<ParamProcessData> | JWT |  |
| POST | `/ZQDayPlanOrder/GetSchedulTeamById` | GetSchedulTeamById | PlanOrderRequest | GetDataByPageVo<SchedTableTeamListVO> | JWT |  |
| POST | `/ZQDayPlanOrder/getoutplanList` | getoutplanList | PlanOrderRequest | GetDataByPageVo<RoomOutPlanOrder> | JWT |  |
| POST | `/ZQDayPlanOrder/dooutplanEdit` | dooutplanEdit | OrderRequest | string | JWT |  |
| POST | `/ZQDayPlanOrder/dooutplanDelete` | dooutplanDelete | OrderRequest | string | JWT |  |
| POST | `/ZQDayPlanOrder/getcrushplanList` | getcrushplanList | PlanOrderRequest | GetDataByPageVo<YeastPowderCrushPlanOrder> | JWT |  |
| POST | `/ZQDayPlanOrder/docrushplanEdit` | docrushplanEdit | OrderRequest | string | JWT |  |
| POST | `/ZQDayPlanOrder/docrushplanDelete` | docrushplanDelete | OrderRequest | string | JWT |  |
| POST | `/ZQDayPlanOrder/docrushplanBatchAdd` | docrushplanBatchAdd | List<OrderRequest> | string | JWT |  |

#### `Controllers/PlanOrder/ZQMonthPlanOrderController.cs` — 3 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/ZQMonthPlanOrder/GetList` | GetList | PlanOrderRequest | GetDataByPageVo<ZQMonthPlanMainOrder> | JWT | 制曲年度计划 |
| POST | `/ZQMonthPlanOrder/doEdit` | doEdit | OrderRequest | string | JWT |  |
| POST | `/ZQMonthPlanOrder/doDelete` | doDelete | OrderRequest | string | JWT |  |

#### `Controllers/PlanOrder/ZQYearPlanOrderController.cs` — 3 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/ZQYearPlanOrder/GetZQYearPlanOrder` | GetZQYearPlanOrder | PlanOrderRequest | GetDataByPageVo<ZQYearPlanMainOrder> | JWT | 制曲年度计划 |
| POST | `/ZQYearPlanOrder/doEdit` | doEdit | OrderRequest | string | JWT |  |
| POST | `/ZQYearPlanOrder/doDelete` | doDelete | OrderRequest | string | JWT |  |

### Inventory/

#### `Controllers/Inventory/HutInfoController.cs` — 7 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/HutInfo/GetHutLastArchiveInfo` | GetHutLastArchiveInfo | GetHutLastArchiveInfoRequest | List<GetHutLastArchiveInfoGroupData> | JWT | 获得某个仓最新归档信息 |
| POST | `/HutInfo/AdjustHutInventory` | AdjustHutInventory | Dictionary<int, | string | JWT | 调整库存接口 |
| POST | `/HutInfo/EasyAdjustHutInventory` | EasyAdjustHutInventory | EasyAdjustHutInventoryRequest | string | JWT | 调整库存接口 |
| POST | `/HutInfo/GetMixHutReport` | GetMixHutReport | GetMixHutReportRequest | List<MixHutReportData> | JWT | 获得混合仓报表 混合仓有点特别 是来自不同仓的物料, 总和成报表 这里会根据仓进行聚合 |
| POST | `/HutInfo/GetMixHutReportGroupByTimeSpan` | GetMixHutReportGroupByTimeSpan | GetMixHutReportRequest | List<MixHutReportData> | JWT | 仅根据短时间聚合 聚合时间越短, 数据越多 |
| POST | `/HutInfo/GetMixHutReportGroupByInHut` | GetMixHutReportGroupByInHut | GetMixHutReportRequest | List<MixHutReportData> | JWT | 获得混合仓报表 混合仓有点特别 是来自不同仓的物料, 总和成报表 |
| POST | `/HutInfo/GetLstCheckInventoryRecord` | GetLstCheckInventoryRecord | GetLstCheckInventoryRecord | List<CheckInventoryRecordVO> | JWT | 获得盘点记录 |

#### `Controllers/Inventory/HutInventoryController.cs` — 12 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/HutInventory/GetDicInventoryRealTimeInfoOld` | GetDicInventoryRealTimeInfoOld | GetLstHutInventoryRealTimeInfoRequest | Dictionary<int, HutInventoryRealTimeInfoData> | JWT | 获得事务的仓实时信息 |
| POST | `/HutInventory/GetDicOutHutQty` | GetDicOutHutQty | GetLstHutInventoryRealTimeInfoRequest | Dictionary<int, HutInventoryRealTimeInfoData> | JWT | 获得出仓量 |
| POST | `/HutInventory/GetLstInventoryTransaction` | GetLstInventoryTransaction | GetLstHutInventoryTransactionRequest | GetDataByPageVo<HutInventoryTransactionVo> | JWT | 获得事务信息 |
| POST | `/HutInventory/GetIoQtyByTransaction` | GetIoQtyByTransaction | GetIoQtyByTransactionRequest | GetIoQtyByTransactionResponse | JWT | 根据事务获得出入量 |
| POST | `/HutInventory/GetIoQtyByTransactionWithBatch` | GetIoQtyByTransactionWithBatch | GetIoQtyByTransactionRequest | GetIoQtyByTransactionResponseWithBatch | JWT | 根据事务获得出入量带批次 |
| POST | `/HutInventory/GetLstInventoryForceTransaction` | GetLstInventoryForceTransaction | GetLstHutInventoryTransactionRequest | GetDataByPageVo<HutInventoryForceTransactionVo> | JWT | 获得所有强制事务 |
| POST | `/HutInventory/GetLstOutHutRes` | GetLstOutHutRes | GetLstHutInventoryTransactionRequest | GetDataByPageVo<RawInOutHutResult> | JWT | 获得出仓记录结果 |
| POST | `/HutInventory/GetLstOutHutResGroup` | GetLstOutHutResGroup | GetLstHutInventoryTransactionRequest | List<OutHutResGroup> | JWT | 获得出仓记录结果 |
| POST | `/HutInventory/GetLstInOutHutResByDay` | GetLstInOutHutResByDay | GetLstInOutResultByDayRequest | List<RawInOutHutResult> | JWT | 获得某天的出入结果 |
| POST | `/HutInventory/FixHutInventoryRealTimeInfoByTransaction` | FixHutInventoryRealTimeInfoByTransaction | — | string | JWT | 修正事务的仓实时信息 |
| POST | `/HutInventory/GetHutIoReportData` | GetHutIoReportData | GetHutIoReportDataRequest | GetHutIoReportDataReponse | JWT | 出入仓报表 |
| POST | `/HutInventory/GetMillingReportData` | GetMillingReportData | MillingReportRequest | MillingReportResponse | JWT | 曲块制粉报表 |

#### `Controllers/Inventory/HutInventoryController2Admin.cs` — 3 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/GetDicRealInventoryRealTimeInfo` | GetDicRealInventoryRealTimeInfo | GetLstHutInventoryRealTimeInfoRequest | Dictionary<int, HutInventoryRealTimeInfoData> | JWT | 获得事务的仓实时信息 |
| POST | `/GetDicInventoryRealTimeInfo` | GetDicInventoryRealTimeInfo | GetLstHutInventoryRealTimeInfoRequest | Dictionary<int, HutInventoryRealTimeInfoData> | JWT |  |
| POST | `/ImportReport4Output2Nj` | ImportReport4Output2Nj | ImportReport4Output2NjRequest | string | JWT | 导入酿酒发放报表数据 |

#### `Controllers/Inventory/HutInventoryController2HeXi.cs` — 1 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/EasyIo` | EasyIo | EasyIoRequest | string | JWT | 简易出入 |

#### `Controllers/Inventory/HutInventoryController2RawMaterial.cs` — 3 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/GetRawMaterialHutInventory` | GetRawMaterialHutInventory | GetRawMaterialHutInventoryRequest | Dictionary<int, HutInventoryRealTimeInfoData> | JWT |  |
| POST | `/GetRawMaterialDicOutHutQty` | GetRawMaterialDicOutHutQty | GetRawMaterialHutInventoryRequest | Dictionary<int, HutInventoryRealTimeInfoData> | JWT |  |
| POST | `/GetDailyC3HutOutputReport` | GetDailyC3HutOutputReport | — | void | JWT | C3仓每日出仓报表 |

#### `Controllers/Inventory/HutInventoryController2Report.cs` — 4 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/GetDailyOutput2NJF3456Report` | GetDailyOutput2NJF3456Report | BaseDateTimeRequest | List<DailyOutput2NJF3456ReportRow> | JWT | 345六车间报表 |
| POST | `/GetDailyOutput2NJF10Report` | GetDailyOutput2NJF10Report | BaseDateTimeRequest | List<DailyOutput2NJF10ReportRow> | JWT | 十车间报表 |
| POST | `/GetDailyOutputYeastRatio` | GetDailyOutputYeastRatio | BaseDateTimeRequest | List<DailyOutputYeastRatio> | JWT | 制曲配比 |
| POST | `/GetDailyPerHutIoQtyReport` | GetDailyPerHutIoQtyReport | GetMixHutReportRequest | List<DailyPerHutIoQtyReportRow> | JWT | 每日出入报表 |

#### `Controllers/Inventory/YeastInventoryController.cs` — 15 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/YeastInventory/TraceHierarchy` | TraceHierarchy | — | GetDataByPageVo<TraceHierarchyAreaVO> | JWT |  |
| POST | `/YeastInventory/GetDicInventoryRealTimeInfo` | GetDicInventoryRealTimeInfo | GetDicInventoryRealTimeInfoRequest | Dictionary<int, YeastInventoryRealTimeInfoData> | JWT | 获得事务的仓实时信息 |
| POST | `/YeastInventory/GetLstInventoryTransaction` | GetLstInventoryTransaction | GetLstYeastInventoryTransactionRequest | GetDataByPageVo<YeastInventoryTransactionVo> | JWT | 获得事务信息 |
| POST | `/YeastInventory/GetHistoryInventoryRealTimeInfoGroup` | GetHistoryInventoryRealTimeInfoGroup | GetHistoryInventoryRealTimeInfoRequest | List<YeastInventoryRealTimeInfoGroupVo> | JWT | 获得历史信息 |
| POST | `/YeastInventory/GetHistoryInventoryRealTimeInfo` | GetHistoryInventoryRealTimeInfo | GetHistoryInventoryRealTimeInfoRequest | List<YeastInventoryTransactionVo> | JWT | 获得历史信息明细 |
| POST | `/YeastInventory/GetWarehouseInfo` | GetWarehouseInfo | FrameListRequest | WarehouseInfoVO | JWT | 曲库展示信息 |
| POST | `/YeastInventory/FrameList` | FrameList | FrameListRequest | GetDataByPageVo<FrameRowVO> | JWT | 曲框位置列表 |
| POST | `/YeastInventory/GetWarehouseHistoryInfo` | GetWarehouseHistoryInfo | FrameListRequest | WarehouseHistoryInfoVO | JWT |  |
| POST | `/YeastInventory/WarehouseOrderList` | WarehouseOrderList | FrameListRequest | GetDataByPageVo<WarehouseOrderVO> | JWT |  |
| POST | `/YeastInventory/InOutDataList` | InOutDataList | InOutDataListRequest | GetDataByPageVo<InOutDataListVO> | JWT | 库房出入库记录 |
| POST | `/YeastInventory/InWarehouseSituation` | InWarehouseSituation | EquipmentRequest | GetDataByPageVo<InWarehouseSituationVO> | JWT | 制曲曲库实时信息 |
| POST | `/YeastInventory/WarehouseByPlan` | WarehouseByPlan | WarehouseByPlanRequest | GetDataByPageVo<InOutDataListVO> | JWT |  |
| POST | `/YeastInventory/WarehouseByPlanWithDetail` | WarehouseByPlanWithDetail | WarehouseByPlanRequest | GetDataByPageVo<InOutDataListVO> | JWT | 增加曲房详细信息 |
| POST | `/YeastInventory/InWarehouseInfoByPlan` | InWarehouseInfoByPlan | WarehouseByPlanRequest | GetDataByPageVo<InWarehouseInfoVO> | JWT | 根据生产计划查询入库信息 |
| POST | `/YeastInventory/DayOutputByPlan` | DayOutputByPlan | WarehouseByPlanRequest | DayOutputVO | JWT |  |

### Equipment/

#### `Controllers/Equipment/EquipmentController.cs` — 29 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/equ/AreaList` | AreaList | EquipmentRequest | GetDataByPageVo<AreaListVO> | JWT |  |
| POST | `/equ/LocationList` | LocationList | EquipmentRequest | GetDataByPageVo<LocationListVO> | JWT |  |
| POST | `/equ/TypeList` | TypeList | EquipmentRequest | GetDataByPageVo<TypeListVO> | JWT |  |
| POST | `/equ/SubTypeList` | SubTypeList | EquipmentRequest | GetDataByPageVo<SubTypeListVO> | JWT |  |
| POST | `/equ/AreaLocationTree` | AreaLocationTree | EquipmentRequest | GetDataByPageVo<AreaLocationTreeVO> | JWT | 区域位置树列表 |
| GET | `/equ/GetPropertyTree` | GetPropertyTree | — | GetDataByPageVo<GetPropertyTreeListVO> | JWT | 属性树列表 |
| POST | `/equ/PropertyTypeList` | PropertyTypeList | GetPropertyDataRequest | GetDataByPageVo<PropertyTypeListVO> | JWT | 属性分类列表 |
| POST | `/equ/PropertyList` | PropertyList | GetPropertyDataRequest | GetDataByPageVo<PropertyListVO> | JWT | 属性列表 |
| POST | `/equ/GetPropertyData` | GetPropertyData | GetPropertyDataRequest | GetDataByPageVo<PropertyDataVO> | JWT | 点位 |
| POST | `/equ/GetTreeList` | GetTreeList | GetTreeListRequest | GetDataByPageVo<GetTreeListVO> | JWT | 包含区域位置树结构 |
| POST | `/equ/EquList` | EquList | EquipmentRequest | GetDataByPageVo<EquListVO> | JWT |  |
| POST | `/equ/EquLedger` | EquLedger | EquipmentRequest | GetDataByPageVo<EquItemVO> | JWT | 设备台账列表 |
| POST | `/equ/UpdateEqu` | UpdateEqu | EquipmentSaveRequest | string | JWT |  |
| POST | `/equ/EditEqu` | EditEqu | EquipmentSaveRequest | string | JWT |  |
| POST | `/equ/DeleteEqu` | DeleteEqu | EquipmentSaveRequest | string | JWT |  |
| POST | `/equ/SignalList` | SignalList | SignalRequest | GetDataByPageVo<SignalListVO> | JWT |  |
| POST | `/equ/SignalSave` | SignalSave | SignalRequest | string | JWT |  |
| POST | `/equ/SignalDelete` | SignalDelete | SignalRequest | string | JWT |  |
| POST | `/equ/StatusList` | StatusList | StatusRequest | GetDataByPageVo<StatusListVO> | JWT |  |
| POST | `/equ/StatusSave` | StatusSave | StatusRequest | string | JWT |  |
| POST | `/equ/StatusDelete` | StatusDelete | StatusRequest | string | JWT |  |
| POST | `/equ/StatusRecordList` | StatusRecordList | StatusRecordRequest | GetDataByPageVo<StatusRecordVO> | JWT |  |
| POST | `/equ/EquInspectionList` | EquInspectionList | EquipmentSaveRequest | GetDataByPageVo<EquInspectionVO> | JWT |  |
| POST | `/equ/SaveEquInspection` | SaveEquInspection | EquInspectionVO | string | JWT |  |
| POST | `/equ/AgvOptionList` | AgvOptionList | EquipmentRequest | GetDataByPageVo<AgvOptionVO> | JWT |  |
| POST | `/equ/AgvFaultPartOptions` | AgvFaultPartOptions | — | GetDataByPageVo<AgvTextOptionVO> | JWT |  |
| POST | `/equ/AgvFaultRecordList` | AgvFaultRecordList | AgvFaultRecordListRequest | GetDataByPageVo<AgvFaultRecordVO> | JWT |  |
| POST | `/equ/SaveAgvFaultRecord` | SaveAgvFaultRecord | AgvFaultRecordSaveRequest | string | JWT |  |
| POST | `/equ/DeleteAgvFaultRecord` | DeleteAgvFaultRecord | AgvFaultRecordSaveRequest | string | JWT |  |

#### `Controllers/Equipment/EquipmentReportController.cs` — 2 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/equReport/MonthReport` | MonthReport | MonthReportRequest | MonthReportVO | JWT |  |
| POST | `/equReport/MonthReportIOT` | MonthReportIOT | MonthReportRequest | MonthReportIOTVO | JWT |  |

### Materials/

#### `Controllers/Materials/MaterialGbController.cs` — 3 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/GetFakeOutputReport` | GetFakeOutputReport | GetFakeOutputReportRequest | List<Dictionary<string, string>> | JWT | 假逻辑 |
| POST | `/GetFakeOutputReportWithTran` | GetFakeOutputReportWithTran | GetRealOutputReport | List<Dictionary<string, string>> | JWT | 重写逻辑 旧逻辑不好处理将某些 |
| POST | `/GetFakeOutputReportWithBatch` | GetFakeOutputReportWithBatch | GetRealOutputReport | List<Dictionary<string, string>> | JWT | 重写逻辑 将事务分成批去处理 |

#### `Controllers/Materials/MaterialsController.cs` — 18 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/materials/RiceCookList` | RiceCookList | RiceCookListRequest | GetDataByPageVo<RiceCookListVO> | JWT | 稻壳蒸煮数据 |
| POST | `/materials/RiceCookChart` | RiceCookChart | RiceCookChartRequest | CurveChart | JWT |  |
| POST | `/materials/WeightChart` | WeightChart | WeightChartRequest | Dictionary<string, WeightChartVO> | JWT | 稻壳出仓重量比 |
| POST | `/materials/GetBrokenData` | GetBrokenData | WeightChartRequest | Dictionary<string, Dictionary<string, decimal>> | JWT | 破碎出仓数据 |
| POST | `/materials/GetOutputCuLiangData` | GetOutputCuLiangData | WeightChartRequest | Dictionary<string, decimal> | JWT | 粗粮发送累计数量数据 |
| POST | `/materials/GetOutputXiLiangData` | GetOutputXiLiangData | WeightChartRequest | Dictionary<string, decimal> | JWT | 细粮发送累计数量数据 |
| POST | `/materials/GetOutputJiangXiangData` | GetOutputJiangXiangData | WeightChartRequest | Dictionary<string, decimal> | JWT | 酱香输送 |
| POST | `/materials/GetOutputSanLiaoData` | GetOutputSanLiaoData | BaseChartRequest | Dictionary<string, Dictionary<string, decimal>> | JWT | 获取散料发料数据 |
| POST | `/materials/GetOutputLiangShiOpcData` | GetOutputLiangShiOpcData | BaseChartRequest | List<Dictionary<string, string>> | JWT | 获取粮食数据 |
| POST | `/materials/GetOutputLiangShiDKOpcData` | GetOutputLiangShiDKOpcData | BaseChartRequest | List<Dictionary<string, string>> | JWT | 获取粮食数据 |
| POST | `/materials/GetOutputMwData` | GetOutputMwData | BaseChartRequest | List<Dictionary<string, string>> | JWT | 获取酿酒数据 |
| POST | `/materials/GetOutputMwData2Jx` | GetOutputMwData2Jx | BaseChartRequest | List<Dictionary<string, string>> | JWT | 获取酱香酿酒数据 |
| POST | `/materials/GetOutputJiangXiangReport` | GetOutputJiangXiangReport | BaseChartRequest | List<Dictionary<string, string>> | JWT | 获取酱香发料数据 |
| POST | `/materials/GetOutputNongXiangData` | GetOutputNongXiangData | BaseChartRequest | List<Dictionary<string, string>> | JWT | 获取浓香发料数据 |
| POST | `/materials/GetRealOutputReportOld` | GetRealOutputReportOld | GetRealOutputReport | List<Dictionary<string, string>> | JWT | 真实发料数据报表 |
| POST | `/materials/GetRealOutputReport` | GetRealOutputReport | GetRealOutputReport | List<Dictionary<string, string>> | JWT | 重写逻辑 旧逻辑不好处理将某些 |
| POST | `/materials/GetOutputNongXiangData_Xi` | GetOutputNongXiangData_Xi | BaseChartRequest | List<Dictionary<string, string>> | JWT | 获取浓香发料数据 |
| POST | `/materials/GetDicPerDateDaoKeData` | GetDicPerDateDaoKeData | WeightChartRequest | Dictionary<string, PerDateDaoKeData> | JWT | 每日稻壳数据 |

#### `Controllers/Materials/MaterialsController2Output.cs` — 7 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/CreateOrUpdateStandValue` | CreateOrUpdateStandValue | OutputStandardValueRecord | string | JWT | 创建或更新标准值 |
| POST | `/GetLastOutputStandardValueRecord` | GetLastOutputStandardValueRecord | GetLastOutputStandardValueRecordRequest | OutputStandardValueRecord | JWT | 获得当前使用标准值 |
| POST | `/GetTwentyMeshStandardRuleList` | GetTwentyMeshStandardRuleList | GetTwentyMeshStandardRuleListRequest | AjaxResult<List<TwentyMeshStandardRuleVO>> | JWT | 获得20目筛上物标准规则 |
| POST | `/GetCurrentTwentyMeshStandard` | GetCurrentTwentyMeshStandard | GetCurrentTwentyMeshStandardRequest | AjaxResult<TwentyMeshStandardRuleVO> | JWT | 获得当前生效20目筛上物标准 |
| POST | `/CreateOrUpdateTwentyMeshStandardRule` | CreateOrUpdateTwentyMeshStandardRule | SaveTwentyMeshStandardRuleRequest | AjaxResult<string> | JWT | 创建或更新20目筛上物标准规则 |
| POST | `/DeleteTwentyMeshStandardRule` | DeleteTwentyMeshStandardRule | DeleteTwentyMeshStandardRuleRequest | AjaxResult<string> | JWT | 删除20目筛上物标准规则 |
| POST | `/GetOutput2NjReport` | GetOutput2NjReport | GetRealOutputReport | List<Dictionary<string, string>> | JWT |  |

#### `Controllers/Materials/MaterialsController2Restore.cs` — 1 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/ImportOutputReportData` | ImportOutputReportData | — | HttpResponseMessage | JWT | 导入发放数据 |

#### `Controllers/Materials/ProduceController.cs` — 2 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/GetLstProduceOrder` | GetLstProduceOrder | GetLstProduceOrderRequest | GetDataByPageVo<MaterialProduceOrderVO> | JWT | 获得生产工单 |
| POST | `/GetLstProduceOrderFeedingItem` | GetLstProduceOrderFeedingItem | GetLstProduceOrderFeedingItemRequest | List<MaterialProduceOrderFeedingItemVO> | JWT | 获得生产工单投料明细 |

### _root/

#### `Controllers/BaseController.cs` — 1 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/base/RouterList` | RouterList | — | List<MenuInfoVO> | JWT |  |

#### `Controllers/NcnxCoarseGrainUnitUsageController.cs` — 1 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/ncnxCoarseGrainUnitUsage/query` | Query | CoarseGrainUnitUsageRequest | CoarseGrainUnitUsageVO | JWT |  |

#### `Controllers/NcnxHandInReportController.cs` — 2 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/ncnxHandInReport/query` | Query | NcnxHandInReportRequest | NcnxHandInReportResponse | JWT |  |
| POST | `/ncnxHandInReport/inputDetails` | InputDetails | NcnxHandInReportRequest | List<NcnxHandInReportInputDetailRowVO> | JWT |  |

#### `Controllers/NcnxInputOutputAnalysisReportController.cs` — 1 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/ncnxInputOutputAnalysisReport/query` | Query | NcnxInputOutputAnalysisReportRequest | NcnxInputOutputAnalysisReportResponse | JWT |  |

#### `Controllers/NcnxPitLifecycleController.cs` — 12 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/ncnxPitLifecycle/query` | Query | NcnxPitLifecycleQueryRequest | NcnxPitLifecycleQueryResponse | JWT |  |
| POST | `/ncnxPitLifecycle/overview` | QueryOverview | NcnxPitLifecycleQueryRequest | NcnxPitStatusOverviewResponse | JWT |  |
| POST | `/ncnxPitLifecycle/overviewHistory` | QueryOverviewHistory | NcnxPitLifecycleQueryRequest | NcnxPitStatusOverviewHistoryResponse | JWT |  |
| POST | `/ncnxPitLifecycle/overviewDetail` | QueryOverviewDetail | NcnxPitLifecycleQueryRequest | NcnxPitStatusOverviewDetailResponse | JWT |  |
| POST | `/ncnxPitLifecycle/options` | Options | NcnxPitLifecycleQueryRequest | NcnxPitLifecycleQueryResponse | JWT |  |
| POST | `/ncnxPitLifecycle/fermentationCompare/candidates` | QueryFermentationCompareCandidates | NcnxPitCompareCandidateRequest | NcnxPitCompareCandidateResponse | JWT |  |
| POST | `/ncnxPitLifecycle/lineage` | QueryLineage | NcnxPitLifecycleQueryRequest | NcnxPitLineageVO | JWT |  |
| POST | `/ncnxPitLifecycle/stageDetail` | QueryStageDetail | NcnxPitLifecycleStageDetailRequest | NcnxPitLifecycleStageDetailResponse | JWT |  |
| POST | `/ncnxPitLifecycle/energySummary` | QueryEnergySummary | NcnxPitLifecycleQueryRequest | NcnxPitEnergySummaryResponse | JWT |  |
| POST | `/ncnxPitLifecycle/distilPotDetail` | QueryDistilPotDetail | NcnxPitLifecycleQueryRequest | NcnxDistilPotDetailResponse | JWT |  |
| POST | `/ncnxPitLifecycle/distilPotTemperatureCurve` | QueryDistilPotTemperatureCurve | — | NcnxDistilPotTemperatureCurveResponse | JWT |  |
| POST | `/ncnxPitLifecycle/efficiencyAnalysis` | QueryEfficiencyAnalysis | NcnxPitLifecycleQueryRequest | NcnxPitEfficiencyAnalysisVO | JWT |  |

#### `Controllers/NcnxPlanManagementController.cs` — 5 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/ncnxPlanManagement/query` | Query | NcnxPlanManagementQueryRequest | NcnxPlanManagementQueryResponse | JWT |  |
| POST | `/ncnxPlanManagement/exudingPlans` | QueryExudingPlans | NcnxPlanManagementQueryRequest | NcnxExudingPlanQueryResponse | JWT |  |
| POST | `/ncnxPlanManagement/autoPreview` | AutoPreview | NcnxAutoPitPlanPreviewRequest | NcnxAutoPitPlanResponse | JWT |  |
| POST | `/ncnxPlanManagement/autoOptions` | AutoOptions | NcnxAutoPitPlanOptionsRequest | NcnxAutoPitPlanOptionsResponse | JWT |  |
| POST | `/ncnxPlanManagement/saveAutoPlan` | SaveAutoPlan | NcnxAutoPitPlanSaveRequest | NcnxAutoPitPlanSaveResponse | JWT |  |

#### `Controllers/NcnxProductionPerformanceReportController.cs` — 2 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/ncnxProductionPerformanceReport/query` | Query | NcnxProductionPerformanceReportRequest | NcnxProductionPerformanceReportResponse | JWT |  |
| POST | `/ncnxProductionPerformanceReport/winformAligned` | QueryWinformAligned | NcnxProductionPerformanceReportRequest | NcnxProductionPerformanceWinformResponse | JWT |  |

#### `Controllers/NcnxWarningAnalysisController.cs` — 1 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/ncnxWarningAnalysis/query` | Query | NcnxWarningAnalysisRequest | NcnxWarningAnalysisResponse | JWT |  |

#### `Controllers/TestController.cs` — 2 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/test/Test` | Test | — | IHttpActionResult | 公开 |  |
| POST | `/test/TestWithLock` | TestWithLock | — | string | JWT |  |

### Check/

#### `Controllers/Check/CheckController.cs` — 20 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/CheckOrder/GetList` | GetList | PlanOrderRequest | GetDataByPageVo<ZQCheckOrder> | JWT |  |
| POST | `/CheckOrder/doEdit` | doEdit | OrderRequest | string | JWT |  |
| POST | `/CheckOrder/ZQXJTrickList` | ZQXJTrickList | TrickListRequest | GetDataByPageVo<TrickVO> | JWT |  |
| POST | `/CheckOrder/CreateCheckOrder` | CreateCheckOrder | OrderRequest | string | JWT |  |
| POST | `/CheckOrder/deleteOrder` | deleteOrder | OrderRequest | string | JWT |  |
| POST | `/CheckOrder/getCheckItemByOrderID` | getCheckItemByOrderID | OrderRequest | GetDataByPageVo<CheckItemVO> | JWT |  |
| POST | `/CheckOrder/getCheckItemByOrderIDs` | getCheckItemByOrderIDs | OrderRequest | GetDataByPageVo<CheckItemVO> | JWT |  |
| POST | `/CheckOrder/getCheckItemByOrderID1` | getCheckItemByOrderID1 | OrderRequest | GetDataByPageVo<CheckItemVO> | JWT |  |
| POST | `/CheckOrder/submitCheckItemData` | submitCheckItemData | CheckItemVO | string | JWT |  |
| POST | `/CheckOrder/getAbnormalRecord` | getAbnormalRecord | OrderRequest | GetDataByPageVo<ZQCheckAbnormalHandlingRecord> | JWT |  |
| POST | `/CheckOrder/saveAbnormalRecord` | saveAbnormalRecord | ZQCheckAbnormalHandlingRecord | string | JWT |  |
| POST | `/CheckOrder/saveImprovementMeasure` | saveImprovementMeasure | ZQCheckAbnormalLogDetail | string | JWT |  |
| POST | `/CheckOrder/deleteImprovementMeasure` | deleteImprovementMeasure | OrderRequest | string | JWT |  |
| POST | `/CheckOrder/approveOrders` | approveOrders | OrderRequest | string | JWT |  |
| POST | `/CheckOrder/GetAbCheckData` | GetAbCheckData | GeneralRequest | GetDataByPageVo<GeneralLimsVO> | JWT |  |
| POST | `/CheckOrder/GetDayFJQCheckData` | GetDayFJQCheckData | GeneralRequest | GetDataByPageVo<GeneralLimsVO> | JWT |  |
| POST | `/CheckOrder/PassRate` | PassRate | PassRateRequest | PassRateVO | JWT |  |
| POST | `/CheckOrder/InRoomCheckFinishRate` | InRoomCheckFinishRate | FinishRateRequest | GetDataByPageVo<InRoomCheckFinishRateVO> | JWT | 入房检查完成情况 |
| POST | `/CheckOrder/CheckFinishRate` | CheckFinishRate | FinishRateRequest | GetDataByPageVo<InRoomCheckFinishRateVO> | JWT | 房间检验完成情况 |
| POST | `/CheckOrder/TeamFinishRate` | TeamFinishRate | FinishRateRequest | GetDataByPageVo<TeamFinishRateDateVO> | JWT | 按照班组（项目分类）统计完成率 |

#### `Controllers/Check/PhysicochemicalIndicatorsController.cs` — 7 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/PhysicochemicalIndicators/GetTrendData` | GetTrendData | TrendDataRequest | IHttpActionResult | JWT | 获取趋势图数据 |
| POST | `/PhysicochemicalIndicators/GetPitTrendData` | GetPitTrendData | TrendDataRequest | IHttpActionResult | JWT | 获取按池口聚合的理化趋势数据 |
| POST | `/PhysicochemicalIndicators/GetDistributionData` | GetDistributionData | DistributionDataRequest | IHttpActionResult | JWT | 获取分布图数据 |
| POST | `/PhysicochemicalIndicators/GetDowngradeComments` | GetDowngradeComments | CommentDataRequest | IHttpActionResult | JWT | 获取降级评语数据 |
| POST | `/PhysicochemicalIndicators/GetGradeIndicatorAnalysis` | GetGradeIndicatorAnalysis | GradeIndicatorAnalysisRequest | IHttpActionResult | JWT | 获取按酒级别聚合的指标分析 |
| POST | `/PhysicochemicalIndicators/GetDowngradeIndicatorCorrelation` | GetDowngradeIndicatorCorrelation | GradeIndicatorAnalysisRequest | IHttpActionResult | JWT | 获取降级/降负与酯类指标的关联分析 |
| POST | `/PhysicochemicalIndicators/ExportComments` | ExportComments | ExportCommentRequest | IHttpActionResult | JWT | 导出评语数据 |

### Order/

#### `Controllers/Order/BendingMachineController.cs` — 4 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/bendingMachine/BendingMachineSituation` | BendingMachineSituation | BendingMachineSituationRequest | GetDataByPageVo<BendingMachineVO> | JWT |  |
| POST | `/bendingMachine/BendingMachineItem` | BendingMachineItem | BendingMachineSituationRequest | GetDataByPageVo<BendingMachineItemVO> | JWT |  |
| POST | `/bendingMachine/RealtimeData` | RealtimeData | BendingMachineSituationRequest | BendingMachineRealtimeVO | JWT |  |
| POST | `/bendingMachine/TrafficChart` | TrafficChart | TrafficChartRequest | CurveChart | JWT |  |

#### `Controllers/Order/OrderController.cs` — 4 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/order/GetLstDeliveryOrder` | GetLstDeliveryOrder | GetLstDeliveryOrderRequest | GetDataByPageVo<DeliveryOrder> | JWT | 获得交货单 |
| POST | `/order/GetInHutReportByDeliveryOrder` | GetInHutReportByDeliveryOrder | BaseChartRequest | GetIoQtyByTransactionResponse | JWT | 通过交货单获得入仓报表 |
| POST | `/order/MoisturizingList` | MoisturizingList | MoisturizingListRequest | GetDataByPageVo<MoisturizingListVO> | JWT | 补水记录 |
| POST | `/order/GetDeliveryOrderCreateByMES` | GetDeliveryOrderCreateByMES | GetDeliveryOrderCreateByMESRequest | List<DeliveryOrder> | JWT | 获得MES创建的交货单 |

#### `Controllers/Order/YeastInWarehouseOrderController.cs` — 7 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/order/yeast_in_wh/GetLstOrder` | GetLstOrder | GetYeastInWarehouseOrderRequest | GetDataByPageVo<YeastInWarehouseOrderVo> | JWT | 曲块入库主单 |
| POST | `/order/yeast_in_wh/GetLstOrderItem` | GetLstOrderItem | GetYeastInWarehouseOrderRequest | List<YeastInWarehouseOrderItemVo> | JWT | 曲块入库明细 |
| POST | `/order/yeast_in_wh/GetLstUnusedOrderItem` | GetLstUnusedOrderItem | PageDateTimeRangeRequest | GetDataByPageVo<YeastInWarehouseOrderItem> | JWT | 获取未使用的条目 |
| POST | `/order/yeast_in_wh/Create` | Create | CreateYeastInWarehouseOrderRequest | string | JWT | 创建 |
| POST | `/order/yeast_in_wh/Update` | Update | CreateYeastInWarehouseOrderRequest | string | JWT | 更新 |
| POST | `/order/yeast_in_wh/Delete` | Delete | CreateYeastInWarehouseOrderRequest | string | JWT | 删除 |
| POST | `/order/yeast_in_wh/Send2Wms` | Send2Wms | UpdateYeastInWarehouseOrderRequest | string | JWT | 发送到 Wms |

#### `Controllers/Order/YeastMillingOrderController.cs` — 5 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/order/yeast_milling/GetLstOrder` | GetLstOrder | GetYeastMillingOrderRequest | GetDataByPageVo<YeastMillingOrderVo> | JWT | 曲块制粉主单 |
| POST | `/order/yeast_milling/GetLstOrderItem` | GetLstOrderItem | GetYeastMillingOrderRequest | List<YeastMillingOrderItemVo> | JWT | 曲块出库明细 |
| POST | `/order/yeast_milling/Create` | Create | CreateYeastMillingOrderRequest | string | JWT | 创建 |
| POST | `/order/yeast_milling/Update` | Update | UpdateYeastOutWarehouseOrderRequest | string | JWT | 更新 |
| POST | `/order/yeast_milling/Delete` | Delete | UpdateYeastOutWarehouseOrderRequest | string | JWT | 删除 |

#### `Controllers/Order/YeastOutWarehouseOrderController.cs` — 7 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/order/yeast_out_wh/GetLstOrder` | GetLstOrder | GetYeastOutWarehouseOrderRequest | GetDataByPageVo<YeastOutWarehouseOrderVo> | JWT | 曲块出库主单 |
| POST | `/order/yeast_out_wh/GetLstOrderItem` | GetLstOrderItem | GetYeastOutWarehouseOrderRequest | List<YeastOutWarehouseOrderItemVo> | JWT | 曲块出库明细 |
| POST | `/order/yeast_out_wh/GetLstUnusedOrderItem` | GetLstUnusedOrderItem | PageDateTimeRangeRequest | GetDataByPageVo<YeastOutWarehouseOrderItem> | JWT | 获取未使用的条目 |
| POST | `/order/yeast_out_wh/Create` | Create | CreateYeastOutWarehouseOrderRequest | string | JWT | 创建 |
| POST | `/order/yeast_out_wh/Update` | Update | CreateYeastOutWarehouseOrderRequest | string | JWT | 更新 |
| POST | `/order/yeast_out_wh/Delete` | Delete | CreateYeastOutWarehouseOrderRequest | string | JWT | 删除 |
| POST | `/order/yeast_out_wh/Send2Wms` | Send2Wms | UpdateYeastOutWarehouseOrderRequest | string | JWT | 发送到Wms |

### MakeWine/

#### `Controllers/MakeWine/MakeWineBaseController.cs` — 1 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/makewine/GetLstFactoryLocation` | GetLstFactoryLocation | — | object | JWT | 获取车间列表 |

#### `Controllers/MakeWine/SouthBrewProductionController.cs` — 22 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/makewine/production/GetProductionKPI` | GetProductionKPI | object | object | JWT | 获取生产KPI指标 |
| POST | `/makewine/production/GetProcessFlowData` | GetProcessFlowData | object | object | JWT | 获取工艺流程数据（静态结构） |
| POST | `/makewine/production/GetMultiDimensionReport` | GetMultiDimensionReport | object | object | JWT | 获取多维报表数据（静态结构） |
| POST | `/makewine/production/teamWorkload/summary` | GetTeamWorkloadSummary | object | object | JWT | 获取班组工作量统计（对齐老系统“查询班组工作量”口径） |
| POST | `/makewine/production/traceability/dashboard` | GetTraceabilityDashboard | object | object | JWT | 获取生产看板追溯汇总，一次 NCTraceQuery 返回多类明细，避免前端重复查同一数据源。 |
| POST | `/makewine/production/traceability/orderList` | GetTraceabilityOrderList | object | object | JWT | 获取追溯数据 - 工单/窖池主表 |
| POST | `/makewine/production/traceability/potList` | GetTraceabilityPotList | object | object | JWT | 获取追溯数据 - 甑序明细表 |
| POST | `/makewine/production/loadingEfficiency/list` | GetLoadingEfficiencyList | object | object | JWT | 获取装甑效率排名报表明细（老报表口径） |
| POST | `/makewine/production/loadingEfficiency/dailyTrend` | GetLoadingEfficiencyDailyTrend | object | object | JWT | 装甑按日汇总（趋势决策区），从 Ncnx_Report_Distil 聚合，避免拉取大批明细。 |
| POST | `/makewine/production/traceability/dosingDetail` | GetTraceabilityDosingDetail | object | object | JWT | 获取追溯数据 - 配料润粮明细 |
| POST | `/makewine/production/traceability/distilDetail` | GetTraceabilityDistilDetail | object | object | JWT | 获取追溯数据 - 蒸馏温压明细 |
| POST | `/makewine/production/traceability/distilDurationTrend` | GetDistilDurationTrend | object | object | JWT | 获取馏酒时长按天趋势汇总，供驾驶舱趋势区使用，避免拉取大批蒸馏明细。 |
| POST | `/makewine/production/traceability/coolerDetail` | GetTraceabilityCoolerDetail | object | object | JWT | 获取追溯数据 - 摊凉入窖明细 |
| POST | `/makewine/production/GetQualityTraceability` | GetQualityTraceability | object | object | JWT | 获取质量追溯数据 |
| POST | `/makewine/production/GetIndicatorWeights` | GetIndicatorWeights | object | object | JWT | 获取指标权重数据（静态） |
| POST | `/makewine/production/GetEquipmentWaitRanking` | GetEquipmentWaitRanking | object | object | JWT | 获取设备等待排行数据 |
| POST | `/makewine/production/GetProductionRhythm` | GetProductionRhythm | object | object | JWT | 获取生产节拍数据 |
| POST | `/makewine/production/GetAnomalyDistribution` | GetAnomalyDistribution | object | object | JWT | 获取异常分布数据 |
| POST | `/makewine/production/GetTempPressureTrend` | GetTempPressureTrend | object | object | JWT | 获取温度压力趋势数据 |
| POST | `/makewine/production/getPitList` | GetPitList | object | object | JWT | 获取窖池列表 |
| POST | `/makewine/production/getTeamList` | GetTeamList | object | object | JWT | 获取班组列表 |
| POST | `/makewine/production/getPotList` | GetPotList | object | object | JWT | 获取甑桶列表 |

### OPC/

#### `Controllers/OPC/MaterialTempStockController.cs` — 2 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/opc/GetMaterialTempStockRealtime` | GetMaterialTempStockRealtime | — | MaterialTempStockRealtimeVO | JWT |  |
| POST | `/opc/GetCoarseGrainUnitUsage` | GetCoarseGrainUnitUsage | CoarseGrainUnitUsageRequest | CoarseGrainUnitUsageVO | JWT |  |

#### `Controllers/OPC/OPCController.cs` — 12 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/opc/PageRealTimeList` | PageRealTimeList | PageRealTimeListRequest | GetDataByPageVo<PageRealTimeListVO> | JWT |  |
| POST | `/opc/SavePageRealTime` | SavePageRealTime | SavePageRealTimeRequest | string | JWT |  |
| POST | `/opc/DeletePageRealTime` | DeletePageRealTime | SavePageRealTimeRequest | string | JWT |  |
| POST | `/opc/PageRealTimeTableList` | PageRealTimeTableList | PageRealTimeRequest | GetDataByPageVo<PageRealTimeTableVO> | JWT |  |
| POST | `/opc/SavePageRealTimeTable` | SavePageRealTimeTable | SavePageRealTimeTableRequest | string | JWT |  |
| POST | `/opc/DeletePageRealTimeTable` | DeletePageRealTimeTable | SavePageRealTimeTableRequest | string | JWT |  |
| POST | `/opc/PageRealTimeItemList` | PageRealTimeItemList | PageRealTimeRequest | GetDataByPageVo<PageRealTimeItemVO> | JWT |  |
| POST | `/opc/SavePageRealTimeItem` | SavePageRealTimeItem | SavePageRealTimeItemRequest | string | JWT |  |
| POST | `/opc/DeletePageRealTimeItem` | DeletePageRealTimeItem | SavePageRealTimeItemRequest | string | JWT |  |
| POST | `/opc/PointList` | PointList | PageRealTimeListRequest | GetDataByPageVo<PointListVO> | JWT |  |
| POST | `/opc/SavePoint` | SavePoint | SavePointRequest | string | JWT |  |
| POST | `/opc/GetMHRMData` | GetMHRMData | MHRMDataRequest | List<MhRMOpc> | JWT |  |

### Warning/

#### `Controllers/Warning/WarningController.cs` — 12 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/warning/WarningReminderRuleList` | WarningReminderRuleList | WarningRequest | GetDataByPageVo<WarningReminderRuleVO> | JWT |  |
| POST | `/warning/SaveWarningReminderRule` | SaveWarningReminderRule | WarningRequest | string | JWT |  |
| POST | `/warning/DeleteWarningReminderRule` | DeleteWarningReminderRule | WarningRequest | string | JWT |  |
| POST | `/warning/WarningTypeList` | WarningTypeList | WarningRequest | GetDataByPageVo<WarningTypeVO> | JWT |  |
| POST | `/warning/SaveWarningType` | SaveWarningType | WarningRequest | string | JWT |  |
| POST | `/warning/DeleteWarningType` | DeleteWarningType | WarningRequest | string | JWT |  |
| POST | `/warning/WarningSourceList` | WarningSourceList | WarningRequest | GetDataByPageVo<WarningSourceVO> | JWT |  |
| POST | `/warning/SaveWarningSource` | SaveWarningSource | WarningRequest | string | JWT |  |
| POST | `/warning/DeleteWarningSourcee` | DeleteWarningSourcee | WarningRequest | string | JWT |  |
| POST | `/warning/WarningItemList` | WarningItemList | WarningRequest | GetDataByPageVo<WarningItemVO> | JWT |  |
| POST | `/warning/SaveWarningItem` | SaveWarningItem | WarningRequest | string | JWT |  |
| POST | `/warning/DeleteWarningItem` | DeleteWarningItem | WarningRequest | string | JWT |  |

### ClockIn/

#### `Controllers/ClockIn/ClockInController.cs` — 10 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/clockIn/PunchInParameterList` | PunchInParameterList | PunchInParameterRequest | GetDataByPageVo<PunchInParameterVO> | JWT |  |
| POST | `/clockIn/SavePunchInParameter` | SavePunchInParameter | PunchInParameterRequest | string | JWT |  |
| POST | `/clockIn/DeletePunchInParameter` | DeletePunchInParameter | PunchInParameterRequest | string | JWT |  |
| POST | `/clockIn/HolidayList` | HolidayList | HolidayRequest | GetDataByPageVo<HolidayVO> | JWT |  |
| POST | `/clockIn/SaveHoliday` | SaveHoliday | HolidayRequest | string | JWT |  |
| POST | `/clockIn/DeleteHoliday` | DeleteHoliday | HolidayRequest | string | JWT |  |
| POST | `/clockIn/WorkTeamUserList` | WorkTeamUserList | ClockInRequest | GetDataByPageVo<WorkTeamUserVO> | JWT | 班组岗位人员列表 |
| POST | `/clockIn/SaveWorkTeamUser` | SaveWorkTeamUser | ClockInRequest | string | JWT |  |
| POST | `/clockIn/ClockInRecordList` | ClockInRecordList | ClockInRecordRequest | GetDataByPageVo<ClockInRecordVO> | JWT | 考勤记录 |
| POST | `/clockIn/ClockInMonthReport` | ClockInMonthReport | ClockInMonthReportRequest | GetDataByPageVo<ClockInMonthReportVO> | JWT | 月考勤记录报表 |

### Formula/

#### `Controllers/Formula/FormulaController.cs` — 10 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/formula/FormulaList` | FormulaList | FormulaReqeust | GetDataByPageVo<FormulaListVO> | JWT |  |
| POST | `/formula/FormulaVersionList` | FormulaVersionList | FormulaReqeust | GetDataByPageVo<FormulaVersionVO> | JWT |  |
| POST | `/formula/FormulaItemList` | FormulaItemList | FormulaReqeust | GetDataByPageVo<FormulaItemVO> | JWT |  |
| POST | `/formula/SaveFormula` | SaveFormula | SaveFormulaRequest | string | JWT |  |
| POST | `/formula/DeleteFormula` | DeleteFormula | SaveFormulaRequest | string | JWT |  |
| POST | `/formula/SaveFormulaVersion` | SaveFormulaVersion | SaveFormulaVersionRequest | string | JWT |  |
| POST | `/formula/DeleteFormulaVersion` | DeleteFormulaVersion | SaveFormulaVersionRequest | string | JWT |  |
| POST | `/formula/SaveFormulaItem` | SaveFormulaItem | SaveFormulaItemRequest | string | JWT |  |
| POST | `/formula/DeleteFormulaItem` | DeleteFormulaItem | SaveFormulaItemRequest | string | JWT |  |
| POST | `/formula/CopyFormulaVersion` | CopyFormulaVersion | SaveFormulaVersionRequest | string | JWT | 克隆版本项目明细 |

### MenuRole/

#### `Controllers/MenuRole/MenuRoleController.cs` — 9 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| GET | `/RouterList` | RouterList | string, int | GetDataByPageVo<MenuInfoVO> | JWT | 路由列表 |
| POST | `/PagePermission` | PagePermission | — | List<PagePermissionVO> | JWT | 页面权限 |
| GET | `/menuManagement/getTree` | RoleList | — | GetDataByPageVo<RoleListVO> | JWT | 角色组列表 |
| POST | `/menuManagement/doEdit` | UpdateRouter | UpdateRouterRequest | string | JWT | 编辑菜单 |
| POST | `/menuManagement/doDelete` | DeleteRouter | DeleteRouterRequest | string | JWT | 删除菜单 |
| GET | `/roleManagement/getList` | RoleAuthList | int, int, string | GetDataByPageVo<RoleBtnListVO> | JWT | 角色权限列表 |
| POST | `/roleManagement/doEdit` | UpdateRoleAuth | UpdateRoleAuthRequest | string | JWT |  |
| POST | `/roleManagement/doDelete` | DaleteRoleAuth | DaleteRoleAuthRequest | string | JWT |  |
| POST | `/roleManagement/SaveUserRole` | SaveUserRole | SaveUserRoleRequest | string | JWT |  |

### SiloScada/

#### `Controllers/SiloScada/SiloScadaController.cs` — 9 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/SiloScada/GetNodes` | GetNodes | — | List<ScadaNode> | JWT | 获取所有组态节点 (仓、秤、锅等) |
| POST | `/SiloScada/SaveNode` | SaveNode | ScadaNode | string | JWT | 保存或更新节点 (坐标、PLC点位等) |
| POST | `/SiloScada/DeleteNode` | DeleteNode | int | string | JWT | 删除节点 |
| POST | `/SiloScada/GetDevices` | GetDevices | — | List<ScadaDevice> | JWT |  |
| POST | `/SiloScada/SaveDevice` | SaveDevice | ScadaDevice | string | JWT |  |
| POST | `/SiloScada/GetRoutes` | GetRoutes | — | List<ScadaRoute> | JWT |  |
| POST | `/SiloScada/SaveRoute` | SaveRoute | ScadaRoute | string | JWT |  |
| POST | `/SiloScada/GetRouteConfigs` | GetRouteConfigs | int | List<ScadaRouteConfig> | JWT |  |
| POST | `/SiloScada/SaveRouteConfig` | SaveRouteConfig | ScadaRouteConfig | string | JWT |  |

### HygieneCheck/

#### `Controllers/HygieneCheck/HygieneCheckController.cs` — 8 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/hygieneCheck/HygieneCheckSettingList` | HygieneCheckSettingList | HygieneCheckSettingRequest | GetDataByPageVo<HygieneCheckSettingVO> | JWT |  |
| POST | `/hygieneCheck/SaveHygieneCheckSetting` | SaveHygieneCheckSetting | HygieneCheckSettingRequest | string | JWT |  |
| POST | `/hygieneCheck/DeleteHygieneCheckSetting` | DeleteHygieneCheckSetting | HygieneCheckSettingRequest | string | JWT |  |
| POST | `/hygieneCheck/HygieneCheckList` | HygieneCheckList | HygieneCheckRequest | GetDataByPageVo<HygieneCheckListVO> | JWT |  |
| POST | `/hygieneCheck/HygieneCheckInfo` | HygieneCheckInfo | HygieneCheckRequest | HygieneCheckVO | JWT |  |
| POST | `/hygieneCheck/SaveHygieneCheckInfo` | SaveHygieneCheckInfo | SaveHygieneCheckInfoRequest | string | JWT |  |
| POST | `/hygieneCheck/ConfirmHygieneCheck` | ConfirmHygieneCheck | SaveHygieneCheckInfoRequest | string | JWT |  |
| POST | `/hygieneCheck/ExportData` | ExportData | HygieneCheckRequest | GetDataByPageVo<ExportDataVO> | JWT |  |

### Login/

#### `Controllers/Login/LoginController.cs` — 7 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| GET | `/PublicKey` | PublicKey | — | PublicKeyVO | 公开 |  |
| POST | `/Login` | Login | LoginRequest | UserInfoVO | 公开 |  |
| GET | `/UserInfo` | UserInfo | — | UserInfoVO | JWT |  |
| POST | `/UserTreeList` | UserTreeList | UserTreeRequest | GetDataByPageVo<UserTreeVO> | JWT |  |
| GET | `/RefreshToken` | RefreshToken | — | RefreshTokenVO | 公开 |  |
| GET | `/Logout` | Logout | — | string | JWT |  |
| POST | `/ForceLogout` | ForceLogout | ForceLogoutRequest | Task<string> | 公开 |  |

### ReferenceParameter/

#### `Controllers/ReferenceParameter/ReferenceParameterController.cs` — 7 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/referenceParameter/ParameterList` | ParameterList | ParameterReqeust | GetDataByPageVo<ParameterListVO> | JWT |  |
| POST | `/referenceParameter/ParameterItemList` | ParameterItemList | ParameterReqeust | GetDataByPageVo<ParameterItemVO> | JWT |  |
| POST | `/referenceParameter/SaveParameter` | SaveParameter | SaveParameterRequest | string | JWT |  |
| POST | `/referenceParameter/DeleteParameter` | DeleteParameter | SaveParameterRequest | string | JWT |  |
| POST | `/referenceParameter/SaveParameterItem` | SaveParameterItem | SaveParameterItemRequest | string | JWT |  |
| POST | `/referenceParameter/DeleteParameterItem` | DeleteParameterItem | SaveParameterItemRequest | string | JWT |  |
| POST | `/referenceParameter/ParameterItemChart` | ParameterItemChart | ParameterReqeust | CurveChart | JWT |  |

### Base/

#### `Controllers/Base/BaseController.cs` — 6 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| GET | `/notice/getList` | NoticeList | — | GetDataByPageVo<NoticeListVO> | JWT |  |
| GET | `/notice/clear` | ClearNotice | — | string | JWT |  |
| POST | `/errorLog/addLog` | AddErrorLog | AddErrorLogRequest | string | JWT |  |
| GET | `/remixIcon/getList` | IconList | int, int, string | GetDataByPageVo<string> | JWT |  |
| GET | `/ws` | Connect | — | HttpResponseMessage | 公开 /UnPkg |  |
| GET | `/UpdateRefresh` | UpdateRefresh | string | Task<string> | 公开 |  |

### Violation/

#### `Controllers/Violation/ViolationController.cs` — 5 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/violation/GetList` | GetList | ViolationListRequest | GetDataByPageVo<ViolationOrderListVO> | JWT |  |
| POST | `/violation/GetDetail` | GetDetail | ViolationOrderRequest | ViolationOrderDetailVO | JWT |  |
| POST | `/violation/CreateOrder` | CreateOrder | CreateViolationOrderRequest | string | JWT |  |
| POST | `/violation/HandleOrder` | HandleOrder | HandleViolationOrderRequest | string | JWT |  |
| POST | `/violation/ConfirmOrder` | ConfirmOrder | ConfirmViolationOrderRequest | string | JWT |  |

### WaterQuality/

#### `Controllers/WaterQuality/WaterQualityController.cs` — 5 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/waterQuality/WaterQualityList` | WaterQualityList | WaterQualityRequest | GetDataByPageVo<WaterQualityListVO> | JWT |  |
| POST | `/waterQuality/WaterQualityInfo` | WaterQualityInfo | WaterQualityRequest | WaterQualityVO | JWT |  |
| POST | `/waterQuality/SaveWaterQuality` | SaveWaterQuality | SaveWaterQualityRequest | string | JWT |  |
| POST | `/waterQuality/DeleteWaterQuality` | DeleteWaterQuality | WaterQualityRequest | string | JWT |  |
| POST | `/waterQuality/ExportData` | ExportData | WaterQualityRequest | GetDataByPageVo<ExportWaterQualityVO> | JWT |  |

### AIAnalysis/

#### `Controllers/AIAnalysis/AIAnalysisController.cs` — 3 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/aiAnalysis/qufang/anomalyOverview` | AnomalyOverview | QufangAnomalyOverviewRequest | QufangAnomalyOverviewVO | JWT |  |
| POST | `/aiAnalysis/qufang/productionOverview` | ProductionOverview | QufangProductionOverviewRequest | QufangProductionOverviewVO | JWT |  |
| POST | `/aiAnalysis/qufang/inspectionOverview` | InspectionOverview | QufangInspectionOverviewRequest | QufangInspectionOverviewVO | JWT |  |

### File/

#### `Controllers/File/FileController.cs` — 3 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/file/Upload` | Upload | — | Task<IHttpActionResult> | JWT | 上传文件 |
| POST | `/file/UploadImage` | UploadImage | — | Task<IHttpActionResult> | JWT | 上传图片 |
| POST | `/file/UploadAppVersion` | UploadAppVersion | — | Task<IHttpActionResult> | JWT | 上传APP版本文件 |

### FileDownload/

#### `Controllers/FileDownload/ImportFileController.cs` — 2 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/ImportFile/ImportSchedulUserData` | ImportSchedulUserData | — | Task<HttpResponseMessage> | JWT |  |
| POST | `/ImportFile/ImportEquipmentData` | ImportEquipmentData | — | Task<HttpResponseMessage> | JWT | 导入设备数据 |

### Outside/

#### `Controllers/Outside/OutsideController.cs` — 2 endpoints

| Method | Path | Action | 参数类型 | 返回类型 | Auth | 说明 |
|---|---|---|---|---|---|---|
| POST | `/outside/RoomList` | RoomList | EquipmentRequest | GetDataByPageVo<EquListVO> | 公开 |  |
| POST | `/outside/RoomFermentParameters` | RoomFermentParameters | OutsideRequest | GetDataByPageVo<RoomFermentParameterVO> | 公开 |  |
