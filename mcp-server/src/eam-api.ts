// EAM REST API 客户端 — 封装认证、请求、错误处理
// 所有 handler 通过这个客户端调 EAM 后端

const EAM_BASE_URL = process.env.EAM_API_BASE_URL || 'http://localhost:48080'
const EAM_TENANT_ID = process.env.EAM_TENANT_ID || '1'
const EAM_USERNAME = process.env.EAM_USERNAME || 'admin'
const EAM_PASSWORD = process.env.EAM_PASSWORD || 'admin123'

let cachedToken: { accessToken: string; expiresAt: number } | null = null

/** 登录获取 token，自动缓存和续期 */
async function getToken(): Promise<string> {
  // token 未过期，直接用（提前 5 分钟续期）
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.accessToken
  }

  const res = await fetch(`${EAM_BASE_URL}/admin-api/system/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'tenant-id': EAM_TENANT_ID,
    },
    body: JSON.stringify({ username: EAM_USERNAME, password: EAM_PASSWORD }),
  })

  const json = await res.json() as { code: number; data: { accessToken: string; expiresTime: number } }
  if (json.code !== 0) {
    throw new Error(`EAM 登录失败: ${JSON.stringify(json)}`)
  }

  cachedToken = {
    accessToken: json.data.accessToken,
    expiresAt: json.data.expiresTime,
  }
  return cachedToken.accessToken
}

/** 通用 GET 请求 */
export async function eamGet<T = unknown>(path: string, params?: Record<string, unknown>): Promise<T> {
  const token = await getToken()
  const url = new URL(`${EAM_BASE_URL}/admin-api${path}`)

  if (params) {
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null) {
        url.searchParams.set(key, String(val))
      }
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'tenant-id': EAM_TENANT_ID,
    },
  })

  const json = await res.json() as { code: number; msg: string; data: T }
  if (json.code !== 0) {
    throw new Error(`EAM API 错误 [${path}]: code=${json.code} msg=${json.msg}`)
  }
  return json.data
}

/** 通用 POST 请求 */
export async function eamPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const token = await getToken()

  const res = await fetch(`${EAM_BASE_URL}/admin-api${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'tenant-id': EAM_TENANT_ID,
    },
    body: JSON.stringify(body),
  })

  const json = await res.json() as { code: number; msg: string; data: T }
  if (json.code !== 0) {
    throw new Error(`EAM API 错误 [${path}]: code=${json.code} msg=${json.msg}`)
  }
  return json.data
}

/** 自动分页拉取全量数据 — groupBy 等需要全量聚合时使用 */
export async function eamGetAll<T = unknown>(path: string, params?: Record<string, unknown>): Promise<T[]> {
  const PAGE_SIZE = 200  // EAM 后端最大值
  let all: T[] = []
  let pageNo = 1
  while (true) {
    const page = await eamGet<PageResult<T>>(path, { ...params, pageNo, pageSize: PAGE_SIZE })
    all.push(...page.list)
    if (all.length >= page.total) break
    pageNo++
    if (pageNo > 50) break  // 安全阀：最多 10000 条
  }
  return all
}

/**
 * 通用搜索 — 自动处理 groupBy（全量拉取+聚合）和普通分页
 * 所有 search handler 共用，不重复写 groupBy 逻辑
 */
export async function eamSearch<T extends Record<string, unknown>>(
  path: string,
  params: Record<string, unknown>,
  options: {
    groupBy?: string
    groupKeyFn: (item: T, groupBy: string) => string  // 从记录中提取分组 key
    limit?: number
  },
): Promise<{ total: number; list: T[]; groups?: Array<{ group: string; count: number }> }> {
  if (options.groupBy) {
    // groupBy 模式：拉全量 → 内存聚合
    const all = await eamGetAll<T>(path, params)
    const groups = new Map<string, number>()
    for (const item of all) {
      const key = options.groupKeyFn(item, options.groupBy)
      groups.set(key, (groups.get(key) ?? 0) + 1)
    }
    const sorted = [...groups.entries()].sort((a, b) => b[1] - a[1])
    return {
      total: all.length,
      list: all,
      groups: sorted.map(([group, count]) => ({ group, count })),
    }
  } else {
    // 普通分页
    const page = await eamGet<PageResult<T>>(path, { ...params, pageSize: options.limit ?? 20 })
    return { total: page.total, list: page.list }
  }
}

/** 并行调用多个 API，返回 [result1, result2, ...] */
export async function eamParallel<T extends unknown[]>(
  ...calls: { (): Promise<unknown> }[]
): Promise<T> {
  const results = await Promise.allSettled(calls.map(fn => fn()))
  return results.map(r => r.status === 'fulfilled' ? r.value : null) as T
}

// --- 类型定义 ---

export interface PageResult<T> {
  total: number
  list: T[]
}

export interface Equipment {
  id: number
  equipmentCode: string
  equipmentName: string
  categoryId: number | null
  deptId: number | null
  status: number
  locationId: number | null
  manufacturer: string | null
  model: string | null
  serialNumber: string | null
  responsiblePersonIds: string
  isKey: number
  parentId: number
  acquisitionId: number | null
  createTime: number
  updateTime: number
  [key: string]: unknown
}

export interface FaultReport {
  id: number
  reportCode: string
  equipmentId: number
  faultTypeId: number | null
  urgency: number
  status: number
  faultDesc: string | null
  faultTime: number | null
  reportTime: number | null
  [key: string]: unknown
}

export interface RepairOrder {
  id: number
  orderCode: string
  faultReportId: number | null
  equipmentId: number
  orderType: string | null
  status: number
  assigneeId: number | null
  repairMinutes: number | null
  laborCost: number | null
  materialCost: number | null
  [key: string]: unknown
}
