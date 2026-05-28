// jsy.ferment.room.profile — 曲房/发酵房全景（制曲链）
//
// 对接端点（FermentRoomController.cs）：
//   POST /fermentRoom/FermentRoomInfo  → FermentRoomVO（房间基本信息 + 配方阶段 + 当前批次主单）
//
// 业务术语：
//   "曲房"/"发酵房" 是同一概念（YeastFermentRoom），RoomID 是房间业务编号（如 "ZL-A12"）
//   一个房间同时只承载一个 YeastRoomBatchOrder（发酵生命周期主单）
//
// 是同事联调时第一个该跑通的工具 —— 入参极简，能验证 token + 解包链路。
// 后续可在此 handler 内追加 fan-out 调用 FermentOrderList 拿当前工单。

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { jsyPost } from '../../jsy-api.js'
import { textResult } from '../../shared.js'

export function registerJsyFermentRoomProfile(server: McpServer) {
  server.tool(
    'jsy.ferment.room.profile',
    '查询单个曲房/发酵房的全景信息：房间基础属性、当前承载的发酵批次主单、配方阶段（天数/起始日期）、是否智能房。用户问"X 号曲房什么状态/在跑什么/什么时候出房"时用本工具。',
    {
      roomId: z.string().describe('曲房编号（YeastFermentRoom 的业务编号，如 "ZL-A12"）'),
    },
    async (args) => {
      // FermentOrderRequest 中只用 RoomID 字段
      // 其余字段不传，后端有默认值
      const body = {
        RoomID: args.roomId,
      }

      const data = await jsyPost('/fermentRoom/FermentRoomInfo', body)
      return textResult(data)
    },
  )
}
