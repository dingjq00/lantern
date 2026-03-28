// 公共 identifier 解析器 — 所有工具共用
// 策略: exact match > startsWith > contains
// 唯一匹配 → 返回实体，多个 → 返回候选列表（最多 5 个）

import { eamGet, type Equipment, type PageResult } from './eam-api.js'

export interface ResolveResult<T> {
  match: 'exact' | 'candidates' | 'none'
  entity?: T
  candidates?: Array<{ id: number; code: string; name: string }>
}

/** 解析设备标识符 — name/code/ID 均可 */
export async function resolveEquipment(identifier: string): Promise<ResolveResult<Equipment>> {
  // 纯数字 → 直接按 ID 查
  if (/^\d+$/.test(identifier)) {
    try {
      const eq = await eamGet<Equipment>('/eam/equipment/get', { id: identifier })
      return { match: 'exact', entity: eq }
    } catch {
      return { match: 'none' }
    }
  }

  // keyword 搜索（同时搜 code 和 name）
  const page = await eamGet<PageResult<Equipment>>('/eam/equipment/page', {
    keyword: identifier,
    pageNo: 1,
    pageSize: 10,
  })

  if (page.list.length === 0) return { match: 'none' }

  // 精确匹配（code 或 name 完全一致）
  const exactMatch = page.list.find(
    e => e.equipmentCode === identifier || e.equipmentName === identifier
  )
  if (exactMatch) return { match: 'exact', entity: exactMatch }

  // startsWith 匹配
  const startsWithMatch = page.list.filter(
    e => e.equipmentCode.startsWith(identifier) || e.equipmentName.startsWith(identifier)
  )
  if (startsWithMatch.length === 1) return { match: 'exact', entity: startsWithMatch[0] }

  // 唯一结果
  if (page.list.length === 1) return { match: 'exact', entity: page.list[0] }

  // 多个候选
  return {
    match: 'candidates',
    candidates: page.list.slice(0, 5).map(e => ({
      id: e.id,
      code: e.equipmentCode,
      name: e.equipmentName,
    })),
  }
}

/** 解析产线标识符 */
export async function resolveProductionLine(identifier: string): Promise<ResolveResult<{ id: number; lineCode: string; lineName: string }>> {
  if (/^\d+$/.test(identifier)) {
    try {
      const line = await eamGet<{ id: number; lineCode: string; lineName: string }>('/eam/production-line/get', { id: identifier })
      return { match: 'exact', entity: line }
    } catch {
      return { match: 'none' }
    }
  }

  const page = await eamGet<PageResult<{ id: number; lineCode: string; lineName: string }>>('/eam/production-line/page', {
    keyword: identifier,
    pageNo: 1,
    pageSize: 10,
  })

  if (page.list.length === 0) return { match: 'none' }

  const exact = page.list.find(l => l.lineCode === identifier || l.lineName === identifier)
  if (exact) return { match: 'exact', entity: exact }

  if (page.list.length === 1) return { match: 'exact', entity: page.list[0] }

  return {
    match: 'candidates',
    candidates: page.list.slice(0, 5).map(l => ({ id: l.id, code: l.lineCode, name: l.lineName })),
  }
}

/** 解析部门/车间标识符 */
export async function resolveDepartment(identifier: string): Promise<ResolveResult<{ id: number; name: string; parentId: number }>> {
  if (/^\d+$/.test(identifier)) {
    try {
      const dept = await eamGet<{ id: number; name: string; parentId: number }>('/system/dept/get', { id: identifier })
      return { match: 'exact', entity: dept }
    } catch {
      return { match: 'none' }
    }
  }

  // 部门 API 返回列表（非分页），按 name 过滤
  const depts = await eamGet<Array<{ id: number; name: string; parentId: number }>>('/system/dept/list', { name: identifier })

  if (depts.length === 0) return { match: 'none' }

  const exact = depts.find(d => d.name === identifier)
  if (exact) return { match: 'exact', entity: exact }

  if (depts.length === 1) return { match: 'exact', entity: depts[0] }

  return {
    match: 'candidates',
    candidates: depts.slice(0, 5).map(d => ({ id: d.id, code: String(d.id), name: d.name })),
  }
}

/** 查指定产线下的所有设备 ID */
export async function getEquipmentIdsByProductionLine(lineId: number): Promise<number[]> {
  const list = await eamGet<Array<{ equipmentId: number }>>('/eam/production-line/equipment/list', { lineId })
  return list.map(e => e.equipmentId)
}

/** 查指定部门下的所有设备 ID */
export async function getEquipmentIdsByDepartment(deptId: number): Promise<number[]> {
  const page = await eamGet<PageResult<Equipment>>('/eam/equipment/page', {
    deptId,
    pageNo: 1,
    pageSize: 1000, // 部门下设备不会超过这个数
  })
  return page.list.map(e => e.id)
}
