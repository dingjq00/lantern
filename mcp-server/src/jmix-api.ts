// Jmix 通用 REST API 客户端 — 封装 OAuth2 认证、实体 CRUD、搜索过滤
// 适用于任何 Jmix 2.x 应用（EDHR 是第一个接入的系统）

const JMIX_BASE_URL = process.env.EDHR_BASE_URL || 'https://localhost'
const JMIX_CLIENT_ID = process.env.EDHR_CLIENT_ID || 'afwurugfzf'
const JMIX_CLIENT_SECRET = process.env.EDHR_CLIENT_SECRET || 'fpMqaLPAAB'

let cachedToken: { accessToken: string; expiresAt: number } | null = null

/** OAuth2 Client Credentials 认证，自动缓存和续期 */
async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken
  }

  const res = await fetch(`${JMIX_BASE_URL}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${JMIX_CLIENT_ID}:${JMIX_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) throw new Error(`Jmix OAuth2 失败: ${res.status} ${await res.text()}`)

  const json = await res.json() as { access_token: string; expires_in: number }
  cachedToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  }
  return cachedToken.accessToken
}

/** Jmix 自签名证书 — 全局禁用 TLS 验证（仅开发环境） */
if (JMIX_BASE_URL.startsWith('https://localhost')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

// ============ 实体 API ============

export interface JmixEntity {
  _entityName: string
  _instanceName?: string
  id: string
  [key: string]: unknown
}

/** 查询实体列表 */
export async function jmixList<T extends JmixEntity = JmixEntity>(
  entityName: string,
  options?: {
    limit?: number
    offset?: number
    sort?: string          // "+name,-date" 格式
    fetchPlan?: string     // 命名 fetchPlan 或 _local/_base/_instance_name
    returnCount?: boolean
  },
): Promise<{ items: T[]; count?: number }> {
  const token = await getToken()
  const url = new URL(`${JMIX_BASE_URL}/rest/entities/${entityName}`)

  if (options?.limit) url.searchParams.set('limit', String(options.limit))
  if (options?.offset) url.searchParams.set('offset', String(options.offset))
  if (options?.sort) url.searchParams.set('sort', options.sort)
  if (options?.fetchPlan) url.searchParams.set('fetchPlan', options.fetchPlan)
  if (options?.returnCount) url.searchParams.set('returnCount', 'true')

  const headers: Record<string, string> = { 'Authorization': `Bearer ${token}` }

  const res = await fetch(url.toString(), { headers })
  if (!res.ok) throw new Error(`Jmix GET ${entityName} 失败: ${res.status}`)

  const items = await res.json() as T[]
  const countHeader = res.headers.get('X-Total-Count')
  return { items, count: countHeader ? parseInt(countHeader) : undefined }
}

/** 获取单个实体 */
export async function jmixGet<T extends JmixEntity = JmixEntity>(
  entityName: string,
  id: string,
  fetchPlan?: string,
): Promise<T> {
  const token = await getToken()
  const url = new URL(`${JMIX_BASE_URL}/rest/entities/${entityName}/${id}`)
  if (fetchPlan) url.searchParams.set('fetchPlan', fetchPlan)

  const res = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Jmix GET ${entityName}/${id} 失败: ${res.status}`)

  return await res.json() as T
}

/** 条件搜索 — POST /rest/entities/{entity}/search */
export interface JmixFilter {
  conditions: JmixCondition[]
  group?: 'AND' | 'OR'
}

export interface JmixCondition {
  property?: string
  operator?: '=' | '<>' | '>' | '>=' | '<' | '<=' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'notIn' | 'notEmpty' | 'isNull'
  value?: unknown
  // 嵌套分组
  group?: 'AND' | 'OR'
  conditions?: JmixCondition[]
}

export async function jmixSearch<T extends JmixEntity = JmixEntity>(
  entityName: string,
  filter: JmixFilter,
  options?: {
    limit?: number
    offset?: number
    sort?: string
    fetchPlan?: string
    returnCount?: boolean
  },
): Promise<{ items: T[]; count?: number }> {
  const token = await getToken()
  const url = new URL(`${JMIX_BASE_URL}/rest/entities/${entityName}/search`)

  if (options?.limit) url.searchParams.set('limit', String(options.limit))
  if (options?.offset) url.searchParams.set('offset', String(options.offset))
  if (options?.sort) url.searchParams.set('sort', options.sort)
  if (options?.fetchPlan) url.searchParams.set('fetchPlan', options.fetchPlan)
  if (options?.returnCount) url.searchParams.set('returnCount', 'true')

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filter }),
  })
  if (!res.ok) throw new Error(`Jmix SEARCH ${entityName} 失败: ${res.status} ${await res.text()}`)

  const items = await res.json() as T[]
  const countHeader = res.headers.get('X-Total-Count')
  return { items, count: countHeader ? parseInt(countHeader) : undefined }
}

// ============ 条件计数 ============

/**
 * 条件计数 — search 端点不支持 returnCount，
 * 用大 limit + offset 翻到末尾的方式估算总数
 * 注意: Jmix search 没有 X-Total-Count，这里拉全量 ID 计数
 */
export async function jmixCount(
  entityName: string,
  filter: JmixFilter,
): Promise<number> {
  const token = await getToken()
  // 只取 id 字段，减少传输量
  const url = new URL(`${JMIX_BASE_URL}/rest/entities/${entityName}/search`)
  url.searchParams.set('fetchPlan', '_instance_name')
  url.searchParams.set('limit', '10000')

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filter }),
  })
  if (!res.ok) throw new Error(`Jmix COUNT ${entityName} 失败: ${res.status}`)

  const items = await res.json() as JmixEntity[]
  return items.length
}

// ============ 全量拉取（聚合用） ============

/**
 * 全量拉取 — groupBy 聚合时使用
 * 注意: Jmix search 端点的 offset 不生效（已验证），所以 search 用大 limit 一次拉取
 * list 端点的 offset 正常，可以分页
 */
export async function jmixGetAll<T extends JmixEntity = JmixEntity>(
  entityName: string,
  options?: {
    filter?: JmixFilter
    sort?: string
    fetchPlan?: string
  },
): Promise<T[]> {
  if (options?.filter) {
    // search 端点: offset 不生效，一次性拉取（limit=10000 是 Jmix 默认上限）
    const { items } = await jmixSearch<T>(entityName, options.filter, {
      limit: 10000, sort: options.sort, fetchPlan: options.fetchPlan,
    })
    return items
  }

  // list 端点: offset 正常，分页拉取
  const PAGE_SIZE = 500
  let all: T[] = []
  let offset = 0
  while (true) {
    const { items } = await jmixList<T>(entityName, {
      limit: PAGE_SIZE, offset, sort: options?.sort, fetchPlan: options?.fetchPlan,
    })
    all.push(...items)
    if (items.length < PAGE_SIZE) break
    offset += PAGE_SIZE
    if (offset > 50_000) break
  }
  return all
}

// ============ Metadata（自描述能力） ============

export interface JmixEntityMeta {
  entityName: string
  properties: Array<{
    name: string
    attributeType: 'DATATYPE' | 'ASSOCIATION' | 'COMPOSITION'
    type: string
    cardinality?: 'NONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY'
    mandatory: boolean
    readOnly: boolean
  }>
}

export async function jmixMetadata(entityName?: string): Promise<JmixEntityMeta | JmixEntityMeta[]> {
  const token = await getToken()
  const path = entityName ? `/rest/metadata/entities/${entityName}` : '/rest/metadata/entities'
  const res = await fetch(`${JMIX_BASE_URL}${path}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Jmix metadata 失败: ${res.status}`)
  return await res.json()
}

// ============ 工具函数 ============

/**
 * Jmix 日期格式化 — OffsetDateTime 字段不接受纯日期，必须含时间部分
 * "2024-07-01" → "2024-07-01T00:00:00"
 * "2024-07-01T00:00:00" → 不变
 */
export function jmixDate(dateStr: string, endOfDay = false): string {
  if (!dateStr) return dateStr
  if (dateStr.includes('T')) return dateStr  // 已含时间部分
  return endOfDay ? `${dateStr}T23:59:59` : `${dateStr}T00:00:00`
}

/** 构建 MCP 文本响应 */
export function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}
