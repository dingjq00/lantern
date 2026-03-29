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
    pageSize: 200, // EAM 后端限制最大 200
  })
  return page.list.map(e => e.id)
}

/**
 * 通用范围过滤解析 — 处理 productionLine/department 参数
 * 返回 equipmentIds（过滤成功）/ error 响应（未找到）/ null（未传参数）
 * 所有 search handler 共用，避免静默过滤失败
 */
export async function resolveScope(args: { productionLine?: string; department?: string }): Promise<
  { type: 'ids'; ids: number[] } | { type: 'error'; response: any } | { type: 'skip' }
> {
  if (args.productionLine) {
    const line = await resolveProductionLine(args.productionLine)
    if (line.match === 'exact' && line.entity) {
      return { type: 'ids', ids: await getEquipmentIdsByProductionLine(line.entity.id) }
    }
    if (line.match === 'candidates') {
      return { type: 'error', response: { message: `找到多个匹配的产线，请确认`, candidates: line.candidates } }
    }
    return { type: 'error', response: { message: `未找到名为"${args.productionLine}"的产线。请检查名称或使用 eam.equipment.search 浏览设备列表` } }
  }

  if (args.department) {
    const dept = await resolveDepartment(args.department)
    if (dept.match === 'exact' && dept.entity) {
      return { type: 'ids', ids: await getEquipmentIdsByDepartment(dept.entity.id) }
    }
    if (dept.match === 'candidates') {
      return { type: 'error', response: { message: `找到多个匹配的部门，请确认`, candidates: dept.candidates } }
    }
    return { type: 'error', response: { message: `未找到名为"${args.department}"的部门/车间。请检查名称` } }
  }

  return { type: 'skip' }
}

/**
 * 构建 equipmentId → 产线名称 的映射表
 * 用于 groupBy=productionLine 时将 equipmentId 映射到产线
 */
export async function getEquipmentToLineMap(): Promise<Map<number, string>> {
  const lines = await eamGet<PageResult<{ id: number; lineName: string }>>('/eam/production-line/page', { pageNo: 1, pageSize: 50 })
  const map = new Map<number, string>()
  await Promise.all(lines.list.map(async (line) => {
    const eqList = await eamGet<Array<{ equipmentId: number }>>('/eam/production-line/equipment/list', { lineId: line.id }).catch(() => [])
    for (const e of eqList) {
      map.set(e.equipmentId, line.lineName)
    }
  }))
  return map
}

/**
 * groupBy 结果名称解析 — 把数字 ID 替换为人类可读名称
 * equipment → 设备编号+名称，productionLine 已经是名称无需解析
 */
export async function enrichGroupNames(
  groups: Array<{ group: string; count: number }>,
  groupBy: string,
): Promise<Array<{ group: string; count: number }>> {
  if (groupBy !== 'equipment' || groups.length === 0) return groups

  // 批量查设备名称
  const eqPage = await eamGet<PageResult<Equipment>>('/eam/equipment/page', { pageNo: 1, pageSize: 200 })
  const nameMap = new Map(eqPage.list.map(e => [String(e.id), `${e.equipmentCode} ${e.equipmentName}`]))

  return groups.map(g => ({
    ...g,
    group: nameMap.get(g.group) ?? g.group,
  }))
}
