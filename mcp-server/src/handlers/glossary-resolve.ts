// glossary.resolve — 业务术语解析（Concept Resolver）
// AI 遇到不确定的业务概念时调用，返回精确定义和计算公式
// 模式：同 resolveEquipment，从实体解析扩展到语义解析
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { textResult } from '../shared.js'

// 术语表从环境变量或内联配置加载（与 systems.ts 同步）
// 这里内联定义，后续可改为从 systems.ts 导入
const GLOSSARY: Record<string, { system: string; definition: string; computation: string; relatedTools?: string[] }> = {
  // EAM
  '故障率': { system: 'eam', definition: '设备发生故障的频率', computation: '故障次数 ÷ 设备总数（或运行时间）', relatedTools: ['eam.fault.search'] },
  'MTBF': { system: 'eam', definition: '平均故障间隔（Mean Time Between Failures）', computation: '同一设备相邻两次故障的时间差平均值，预计算字段 avgIntervalDays', relatedTools: ['eam.fault.search'] },
  'MTTR': { system: 'eam', definition: '平均修复时间（Mean Time To Repair）', computation: '维修工单 repairMinutes 的平均值', relatedTools: ['eam.repair.search'] },
  'OEE': { system: 'eam', definition: '设备综合效率（Overall Equipment Effectiveness）', computation: '可用率 × 性能率 × 良率', relatedTools: ['eam.equipment.profile'] },
  '保养完成率': { system: 'eam', definition: '按计划完成的保养任务占比', computation: '状态=已完成的保养数 ÷ 保养总数', relatedTools: ['eam.maintenance.search'] },
  '备件周转率': { system: 'eam', definition: '备件消耗速度与库存的比值', computation: '一段时间内出库量 ÷ 平均库存量', relatedTools: ['eam.spare.search'] },
  // EDHR
  '积压': { system: 'edhr', definition: '截至某时点未关闭的工单累积数', computation: '过滤状态为 WAITING/PENDING/INIT 的工单数。按月分析需看各月末快照，不是创建量', relatedTools: ['edhr.order.search'] },
  '产能': { system: 'edhr', definition: '单位时间内完成的工单数', computation: '过滤 progressStatus=FINISHED，按月/周 groupBy 统计', relatedTools: ['edhr.order.search', 'edhr.trend'] },
  '良率': { system: 'edhr', definition: '检测合格率', computation: '检测状态 PASSED 数 ÷ 总检测数', relatedTools: ['edhr.item.search'] },
  '异常率': { system: 'edhr', definition: '产生质量异常的工单占比', computation: '有异常记录的工单数 ÷ 工单总数', relatedTools: ['edhr.exception.search', 'edhr.order.search'] },
}

export function registerGlossaryResolve(server: McpServer) {
  server.tool(
    'glossary.resolve',
    '查询业务术语的精确定义和计算公式。当用户使用"积压""产能""故障率""良率"等业务指标词时，先调此工具确认含义再计算，避免理解偏差。',
    {
      term: z.string().describe('要查询的业务术语（如"积压""MTBF""良率"）'),
    },
    async (args) => {
      const query = args.term.trim()

      // 精确匹配
      if (GLOSSARY[query]) {
        return textResult({ match: 'exact', term: query, ...GLOSSARY[query] })
      }

      // 模糊匹配：包含关系
      const fuzzy = Object.entries(GLOSSARY).filter(([key]) =>
        key.includes(query) || query.includes(key)
      )
      if (fuzzy.length === 1) {
        const [key, val] = fuzzy[0]
        return textResult({ match: 'fuzzy', term: key, ...val })
      }
      if (fuzzy.length > 1) {
        return textResult({
          match: 'multiple',
          candidates: fuzzy.map(([key, val]) => ({ term: key, system: val.system, definition: val.definition })),
        })
      }

      // 未找到
      return textResult({
        match: 'none',
        message: `术语"${query}"未在术语表中找到。请直接基于数据分析，或询问用户具体含义。`,
      })
    }
  )
}
