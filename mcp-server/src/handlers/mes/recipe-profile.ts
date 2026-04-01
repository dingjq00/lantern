// mes.recipe.profile — 配方/工艺详情（Recipe → UnitProcedure → Phase → Step）
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { mesClient, type JmixCondition } from '../../jmix-api.js'
import { textResult } from '../../shared.js'

export function registerMesRecipeProfile(server: McpServer) {
  server.tool(
    'mes.recipe.profile',
    '获取配方/工艺的完整详情。返回配方基本信息、物料、产线、工艺层级(UnitProcedure→Phase)和配方组分(Component)。支持按配方文档号、物料编号或ID查询。适用于"这个产品怎么做的""配方详情""工艺路线"等问题。',
    {
      docNo: z.string().optional().describe('配方文档号'),
      materialCode: z.string().optional().describe('物料编号（查该物料的配方）'),
      id: z.string().optional().describe('配方内部 ID（UUID）'),
    },
    async (args) => {
      let recipe: any

      if (args.id) {
        recipe = await mesClient.get('Recipe', args.id)
      } else {
        const conditions: JmixCondition[] = []
        if (args.docNo) conditions.push({ property: 'docNo', operator: 'contains', value: args.docNo })
        if (args.materialCode) conditions.push({ property: 'material.materialCode', operator: '=', value: args.materialCode })
        if (conditions.length === 0) return textResult({ error: '请提供 docNo、materialCode 或 id' })

        const result = await mesClient.search('Recipe', { conditions }, { limit: 5, sort: '-effectiveTime' })
        if (result.items.length === 0) return textResult({ error: '未找到匹配的配方' })
        // 如果有多个（同物料多版本），返回最新的
        recipe = result.items[0]
      }

      // 构建工艺层级
      const unitProcedures = (recipe.recipeUnitProcedures ?? []).map((up: any) => ({
        code: up.code,
        name: up.name,
        sequence: up.sequence,
        type: up.type,
        device: up.device ? { code: (up.device as any).code, name: (up.device as any).name } : null,
        operations: (up.recipeOperations ?? []).map((op: any) => ({
          code: op.code,
          name: op.name,
          sequence: op.sequence,
          phases: (op.recipePhases ?? []).map((ph: any) => ({
            code: ph.code,
            name: ph.name,
            sequence: ph.sequence,
            phaseType: ph.phaseType,
            description: ph.description || null,
          })),
        })),
      })).sort((a: any, b: any) => (a.sequence ?? 0) - (b.sequence ?? 0))

      // 配方组分
      const components = (recipe.recipeComponents ?? []).map((c: any) => ({
        material: c.material ? { code: (c.material as any).materialCode, name: (c.material as any).materialName } : null,
        quantity: c.quantity,
        unit: c.unit,
        scrapRate: c.scrapRate,
      }))

      return textResult({
        docNo: recipe.docNo,
        formDocNo: recipe.formDocNo,
        status: recipe.status,
        recipeVersion: recipe.recipeVersion,
        material: recipe.material ? {
          code: recipe.material.materialCode,
          name: recipe.material.materialName,
        } : null,
        productionLine: recipe.productionLine ? {
          code: recipe.productionLine.lineCode,
          name: recipe.productionLine.lineName,
        } : null,
        refQuantity: recipe.refQuantity,
        productSpecifications: recipe.productSpecifications,
        effectiveTime: recipe.effectiveTime,
        unitProcedures,
        components,
      })
    }
  )
}
