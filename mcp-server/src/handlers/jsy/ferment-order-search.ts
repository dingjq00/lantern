// jsy.ferment.order.search — 发酵工单搜索
//
// 对接端点（FermentRoomController.cs）：
//   POST /fermentRoom/FermentOrderList → GetDataByPageVo<FermentOrderVO>
//
// FermentOrderRequest 字段：
//   StartTime / EndTime（string，发酵开始时间过滤）
//   RoomID（曲房编号）
//   PlanOrderID（关联日计划工单）
//   QZTypeName（曲种名 如 "大曲"/"小曲"）
//   SmartRoom (-1 全部 / 0 非智能 / 1 智能)
//   IsEnd（是否已结束发酵）
//   IsExecute（是否有入房记录，默认 true — 过滤掉空壳工单）
//   + 分页 pageNo / pageSize（来自 PageBaseRequest4Form）

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { jsyPost } from '../../jsy-api.js'
import { textResult } from '../../shared.js'

export function registerJsyFermentOrderSearch(server: McpServer) {
  server.tool(
    'jsy.ferment.order.search',
    '搜索发酵工单（曲房批次主单）。支持按曲房编号、计划工单、曲种、智能房/非智能房、是否结束、日期范围过滤。返回工单列表（分页）。用户问"最近发酵了哪些大曲""智能房有几个工单在跑""上周完成的发酵工单"时用本工具。',
    {
      roomId: z.string().optional().describe('曲房编号过滤'),
      planOrderId: z.string().optional().describe('关联日计划工单号过滤'),
      qzType: z.string().optional().describe('曲种名，如 "大曲"/"小曲"。模糊匹配'),
      smartRoom: z.enum(['all', 'smart', 'manual']).optional().default('all').describe('智能房筛选：all 全部 / smart 智能 / manual 非智能'),
      isEnd: z.boolean().optional().describe('是否已结束发酵。true=已结束，false=进行中，不传=不过滤'),
      dateRange: z.object({ from: z.string(), to: z.string() }).optional().describe('发酵开始日期范围，格式 {from:"2026-04-01", to:"2026-04-30"}'),
      pageNo: z.number().int().optional().default(1),
      pageSize: z.number().int().optional().default(20),
    },
    async (args) => {
      const smartRoomCode = args.smartRoom === 'smart' ? 1 : args.smartRoom === 'manual' ? 0 : -1

      const body: Record<string, unknown> = {
        RoomID: args.roomId ?? '',
        PlanOrderID: args.planOrderId ?? '',
        QZTypeName: args.qzType ?? '',
        SmartRoom: smartRoomCode,
        IsExecute: true,
        pageNo: args.pageNo,
        pageSize: args.pageSize,
        IsPage: true,
      }
      if (args.isEnd !== undefined) body.IsEnd = args.isEnd
      if (args.dateRange) {
        body.StartTime = args.dateRange.from
        body.EndTime = args.dateRange.to
      }

      const data = await jsyPost('/fermentRoom/FermentOrderList', body)
      return textResult(data)
    },
  )
}
