// Jmix 通用 REST API 客户端 — 工厂模式，支持多 Jmix 实例（EDHR、MES 等）
// 每个实例持有独立的 baseUrl、OAuth2 凭证和 token 缓存

// ============ 类型定义 ============

export interface JmixEntity {
  _entityName: string
  _instanceName?: string
  id: string
  [key: string]: unknown
}

export interface JmixFilter {
  conditions: JmixCondition[]
  group?: 'AND' | 'OR'
}

export interface JmixCondition {
  property?: string
  operator?: '=' | '<>' | '>' | '>=' | '<' | '<=' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'notIn' | 'notEmpty' | 'isNull'
  value?: unknown
  group?: 'AND' | 'OR'
  conditions?: JmixCondition[]
}

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

interface JmixClientConfig {
  baseUrl: string
  clientId: string
  clientSecret: string
}

// ============ 工厂函数 ============

export function createJmixClient(config: JmixClientConfig) {
  let cachedToken: { accessToken: string; expiresAt: number } | null = null

  /** Jmix 自签名证书 — 全局禁用 TLS 验证（仅开发环境） */
  if (config.baseUrl.startsWith('https://localhost')) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  }

  /** OAuth2 Client Credentials 认证，自动缓存和续期 */
  async function getToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
      return cachedToken.accessToken
    }

    const res = await fetch(`${config.baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64'),
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

  /** 查询实体列表 */
  async function list<T extends JmixEntity = JmixEntity>(
    entityName: string,
    options?: {
      limit?: number
      offset?: number
      sort?: string
      fetchPlan?: string
      returnCount?: boolean
    },
  ): Promise<{ items: T[]; count?: number }> {
    const token = await getToken()
    const url = new URL(`${config.baseUrl}/rest/entities/${entityName}`)

    if (options?.limit) url.searchParams.set('limit', String(options.limit))
    if (options?.offset) url.searchParams.set('offset', String(options.offset))
    if (options?.sort) url.searchParams.set('sort', options.sort)
    if (options?.fetchPlan) url.searchParams.set('fetchPlan', options.fetchPlan)
    if (options?.returnCount) url.searchParams.set('returnCount', 'true')

    const res = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Jmix GET ${entityName} 失败: ${res.status}`)

    const items = await res.json() as T[]
    const countHeader = res.headers.get('X-Total-Count')
    return { items, count: countHeader ? parseInt(countHeader) : undefined }
  }

  /** 获取单个实体 */
  async function get<T extends JmixEntity = JmixEntity>(
    entityName: string,
    id: string,
    fetchPlan?: string,
  ): Promise<T> {
    const token = await getToken()
    const url = new URL(`${config.baseUrl}/rest/entities/${entityName}/${id}`)
    if (fetchPlan) url.searchParams.set('fetchPlan', fetchPlan)

    const res = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Jmix GET ${entityName}/${id} 失败: ${res.status}`)

    return await res.json() as T
  }

  /** 条件搜索 — POST /rest/entities/{entity}/search */
  async function search<T extends JmixEntity = JmixEntity>(
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
    const url = new URL(`${config.baseUrl}/rest/entities/${entityName}/search`)

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

  /** 条件计数 */
  async function count(
    entityName: string,
    filter: JmixFilter,
  ): Promise<number> {
    const token = await getToken()
    const url = new URL(`${config.baseUrl}/rest/entities/${entityName}/search`)
    url.searchParams.set('fetchPlan', '_instance_name')
    url.searchParams.set('limit', '50000')

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

  /** 全量拉取（聚合用） */
  async function getAll<T extends JmixEntity = JmixEntity>(
    entityName: string,
    options?: {
      filter?: JmixFilter
      sort?: string
      fetchPlan?: string
    },
  ): Promise<T[]> {
    if (options?.filter) {
      const { items } = await search<T>(entityName, options.filter, {
        limit: 10000, sort: options.sort, fetchPlan: options.fetchPlan,
      })
      return items
    }

    const PAGE_SIZE = 500
    let all: T[] = []
    let offset = 0
    while (true) {
      const { items } = await list<T>(entityName, {
        limit: PAGE_SIZE, offset, sort: options?.sort, fetchPlan: options?.fetchPlan,
      })
      all.push(...items)
      if (items.length < PAGE_SIZE) break
      offset += PAGE_SIZE
      if (offset > 50_000) break
    }
    return all
  }

  /** Metadata */
  async function metadata(entityName?: string): Promise<JmixEntityMeta | JmixEntityMeta[]> {
    const token = await getToken()
    const path = entityName ? `/rest/metadata/entities/${entityName}` : '/rest/metadata/entities'
    const res = await fetch(`${config.baseUrl}${path}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Jmix metadata 失败: ${res.status}`)
    return await res.json()
  }

  return { list, get, search, count, getAll, metadata }
}

// ============ 预置实例 ============

/** EDHR 实例（向后兼容） */
const edhrClient = createJmixClient({
  baseUrl: process.env.EDHR_BASE_URL || 'https://localhost',
  clientId: process.env.EDHR_CLIENT_ID || 'afwurugfzf',
  clientSecret: process.env.EDHR_CLIENT_SECRET || 'fpMqaLPAAB',
})

/** MES 实例 */
export const mesClient = createJmixClient({
  baseUrl: process.env.MES_BASE_URL || 'https://localhost:443',
  clientId: process.env.MES_CLIENT_ID || 'suuxrhsdjs',
  clientSecret: process.env.MES_CLIENT_SECRET || 'yLdhwhEBNo',
})

// ============ EDHR 向后兼容导出（已有 handler 不用改） ============

export const jmixList = edhrClient.list
export const jmixGet = edhrClient.get
export const jmixSearch = edhrClient.search
export const jmixCount = edhrClient.count
export const jmixGetAll = edhrClient.getAll
export const jmixMetadata = edhrClient.metadata

// ============ 工具函数 ============

/**
 * Jmix 日期格式化 — OffsetDateTime 字段必须含时间+时区
 */
export function jmixDate(dateStr: string, endOfDay = false): string {
  if (!dateStr) return dateStr
  if (/[Z+]\d{0,2}:?\d{0,2}$/.test(dateStr)) return dateStr
  if (dateStr.includes('T')) return dateStr + 'Z'
  return endOfDay ? `${dateStr}T23:59:59Z` : `${dateStr}T00:00:00Z`
}

export { textResult } from './shared.js'
