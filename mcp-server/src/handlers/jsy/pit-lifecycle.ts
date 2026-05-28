// jsy.pit.lifecycle — 窖池履历查询（NCNX 浓香）
//
// 对接端点（NcnxPitLifecycleController.cs）：
//   主查询：POST /ncnxPitLifecycle/query    → NcnxPitLifecycleQueryResponse
//   总览：   POST /ncnxPitLifecycle/overview → NcnxPitStatusOverviewResponse
//
// 一个 NcnxPitLifecycleQueryRequest 本身就是聚合开关式入参（LoadLayout/LoadDetail/...
// LoadLineage/LoadStageDetails/LoadTemperatureTrend/LoadHistoryOrders/LoadTraceState），
// 因此本工具只对一个 endpoint /query 做"业务参数 → 服务端字段"的翻译。
//
// 业务术语对照（基于 findings.md 2026-05-22 调研）：
//   "窖池"     = Pit / Unit（UnitPK 内部主键，UnitCode 业务编号 如 "1187"）
//   "排次"     = CrossNo（同一窖池每次入出窖循环编号）
//   "窖号"     = CellarID（车间维度的窖位标识）
//   "工单"     = SelectedOrderID 形如 PITN1101_1187_20250217
//   "车间"     = WorkshopID  11=NJNC01 / 12=NJNC02 / 13=NJNC03
//
// 返回大对象（含 Workshops/UnitOptions/Units/Realtime/HistoryOrders/Detail）—— 当前透传不裁剪。
// 联调后可在此 handler 末尾按 NL 实际命中的问题模式做字段裁剪。

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { jsyPost } from '../../jsy-api.js'
import { textResult } from '../../shared.js'

export function registerJsyPitLifecycle(server: McpServer) {
  server.tool(
    'jsy.pit.lifecycle',
    '查询白酒酿造窖池(NCNX 浓香)生命周期履历。支持按窖池编号(unitCode)、工单号(orderId)、窖号(cellarId) 任一定位；可控制是否加载来源链(lineage)、阶段明细(stageDetails)、温度趋势、历史工单。一次返回该窖池/排次的实时状态+阶段面板+温度趋势+历史排次工单，是窖池追溯类问题的主入口。',
    {
      workshopId: z.string().optional().describe('车间ID：11/12/13 对应 NJNC01/02/03。不传则后端按用户默认或第一个车间'),
      unitCode: z.string().optional().describe('窖池业务编号，如"1187"。用户最常用的标识。与 cellarId/orderId 三选一'),
      unitPk: z.string().optional().describe('窖池主键（内部）— 一般用 unitCode 即可，不必传'),
      crossNo: z.string().optional().describe('排次号 — 同一窖池的循环计次。不传取当前排次'),
      cellarId: z.string().optional().describe('窖号 — 车间维度的位置标识'),
      orderId: z.string().optional().describe('工单号，形如 PITN1101_1187_20250217。按特定排次工单查时用'),
      state: z.string().optional().describe('状态过滤（具体枚举待联调确认）'),
      onlyWarning: z.boolean().optional().describe('只看告警中的窖池'),
      includeLineage: z.boolean().optional().default(false).describe('是否加载来源链路（前序窖池/糟源），分析跨排次追溯时打开'),
      includeStageDetails: z.boolean().optional().default(true).describe('是否加载阶段面板（入窖/发酵/出窖/润粮/馏酒）'),
      includeTemperatureTrend: z.boolean().optional().default(true).describe('是否加载温度趋势曲线'),
      includeHistoryOrders: z.boolean().optional().default(true).describe('是否加载该窖池的历史排次工单列表'),
      includeTraceState: z.boolean().optional().default(true).describe('是否加载追溯状态提示'),
    },
    async (args) => {
      // 业务参数 → 服务端 NcnxPitLifecycleQueryRequest 字段
      // 注意：服务端字段名一律 PascalCase，不要"修正"成 camelCase
      const body = {
        WorkshopID: args.workshopId ?? '',
        UnitPK: args.unitPk ?? '',
        UnitCode: args.unitCode ?? '',
        CrossNo: args.crossNo ?? '',
        State: args.state ?? '',
        OnlyWarning: args.onlyWarning ?? false,
        AllUnits: false,
        AllCrosses: false,
        CellarID: args.cellarId ?? '',
        SelectedOrderID: args.orderId ?? '',
        LoadLayout: true,
        LoadDetail: true,
        LoadLineage: args.includeLineage,
        LoadStageDetails: args.includeStageDetails,
        LoadTemperatureTrend: args.includeTemperatureTrend,
        LoadHistoryOrders: args.includeHistoryOrders,
        LoadTraceState: args.includeTraceState,
      }

      const data = await jsyPost('/ncnxPitLifecycle/query', body)
      return textResult(data)
    },
  )
}
