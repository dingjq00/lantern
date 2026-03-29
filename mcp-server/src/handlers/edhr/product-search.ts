// edhr.product.search — 产品+配方查询
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { jmixList, jmixSearch, textResult, type JmixCondition } from '../../jmix-api.js'

export function registerEdhrProductSearch(server: McpServer) {
  server.tool(
    'edhr.product.search',
    '查询产品和配方信息。返回产品列表及对应的配方工序模板。适用于"有哪些产品""这个产品的配方版本""产品分类有哪些"等问题。',
    {
      keyword: z.string().optional().describe('产品编号或名称（模糊匹配）'),
      categoryCode: z.string().optional().describe('产品类别编号'),
    },
    async (args) => {
      // 产品列表
      const conditions: JmixCondition[] = []
      if (args.keyword) {
        conditions.push({
          group: 'OR',
          conditions: [
            { property: 'code', operator: 'contains', value: args.keyword },
            { property: 'name', operator: 'contains', value: args.keyword },
          ]
        })
      }

      const filter = conditions.length > 0 ? { conditions } : { conditions: [] }
      const products = conditions.length > 0
        ? await jmixSearch('Product', filter, { limit: 50, fetchPlan: '_local' })
        : await jmixList('Product', { limit: 50, fetchPlan: '_local' })

      // 产品类别
      const categories = await jmixList('ProductCategory', { limit: 20, fetchPlan: '_local' })

      // 配方工序（顶层）
      const recipes = await jmixList('RecipeProcedure', { limit: 50, fetchPlan: '_local' })

      return textResult({
        products: {
          total: products.items.length,
          items: products.items.map(p => ({
            code: p.code, name: p.name, alterCode: p.alterCode,
            mainMaterialCode: p.mainMaterialCode, mainMaterialName: p.mainMaterialName,
          })),
        },
        categories: {
          total: categories.items.length,
          items: categories.items.map(c => ({
            code: c.code, name: c.name, categoryVersion: c.categoryVersion,
            status: c.status, documentNo: c.documentNo,
          })),
        },
        recipes: {
          total: recipes.items.length,
          items: recipes.items.map(r => ({
            code: r.code, name: r.name, sequence: r.sequence,
            fitForProducts: r.fitForProducts,
          })),
        },
      })
    }
  )
}
