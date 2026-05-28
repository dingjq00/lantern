// jsy.hut.inventory.search — 仓状态/出入库事务查询
//
// 对接端点（HutInventoryController.cs）：
//   POST /HutInventory/GetDicInventoryRealTimeInfoOld   → Dictionary<EquPK, HutInventoryRealTimeInfoData>
//        实时库存（多仓批量查询，按设备主键列表）
//   POST /HutInventory/GetLstInventoryTransaction        → GetDataByPageVo<HutInventoryTransactionVo>
//        历史事务流水（按仓/物料/供应商/日期过滤）
//
// 设计：本工具同时承载两种模式（realtime / transaction），由 mode 入参切换：
//   mode=realtime → 用 equPkList 多仓实时拉取
//   mode=transaction → 用 dateRange + 仓/物料/供应商过滤拉流水
//
// 拆成两个工具也可，但 NL 场景下"仓的情况"语义连贯，合并能减少 LLM 选错工具的概率。
// 后续如果发现两个 mode 互相干扰 LLM 路由，可在 P1 拆开。

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { jsyPost } from '../../jsy-api.js'
import { textResult } from '../../shared.js'

export function registerJsyHutInventorySearch(server: McpServer) {
  server.tool(
    'jsy.hut.inventory.search',
    '查询曲库存（hut/仓）状态。两种模式：(1) realtime 模式按仓主键列表拿当前实时库存量；(2) transaction 模式按仓/物料/供应商/日期范围查出入库事务流水。用户问"X 仓还剩多少""上周的出库记录""某物料的库存变化"时用本工具。',
    {
      mode: z.enum(['realtime', 'transaction']).describe('查询模式：realtime=当前实时库存，transaction=出入库事务流水'),
      // realtime 模式参数
      equPkList: z.array(z.number().int()).optional().describe('[realtime] 仓设备主键列表（多仓批量查），如 [101, 102, 103]'),
      // transaction 模式参数
      equ: z.string().optional().describe('[transaction] 仓编号过滤'),
      mmDef: z.string().optional().describe('[transaction] 物料编号过滤'),
      supplier: z.string().optional().describe('[transaction] 供应商号过滤'),
      inDate: z.string().optional().describe('[transaction] 入库日期过滤（精确到天，格式 "2026-04-15"）'),
      dateRange: z.object({ from: z.string(), to: z.string() }).optional().describe('[transaction] 事务发生日期范围'),
      pageNo: z.number().int().optional().default(1),
      pageSize: z.number().int().optional().default(20),
    },
    async (args) => {
      if (args.mode === 'realtime') {
        // GetLstHutInventoryRealTimeInfoRequest
        if (!args.equPkList || args.equPkList.length === 0) {
          return textResult({ error: 'realtime 模式必须提供 equPkList（仓设备主键列表）' })
        }
        const body = {
          LstEquPK: args.equPkList,
          IsNeedFakeInfo: false,
        }
        const data = await jsyPost('/HutInventory/GetDicInventoryRealTimeInfoOld', body)
        return textResult(data)
      }

      // transaction 模式
      // GetLstHutInventoryTransactionRequest extends PageDateTimeRangeRequest
      const body: Record<string, unknown> = {
        Equ: args.equ ?? '',
        MMDef: args.mmDef ?? '',
        Supplier: args.supplier ?? '',
        InDate: args.inDate ?? '',
        pageNo: args.pageNo,
        pageSize: args.pageSize,
      }
      if (args.dateRange) {
        body.StartTime = args.dateRange.from
        body.EndTime = args.dateRange.to
      }
      const data = await jsyPost('/HutInventory/GetLstInventoryTransaction', body)
      return textResult(data)
    },
  )
}
