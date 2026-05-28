// JSY 南厂酿酒车间 REST 客户端 — JWT 登录 + token 缓存 + 响应解包
//
// 后端栈：.NET Framework 4.5.2 + ASP.NET Web API 5（IIS 部署）
// 鉴权：Header `Authorization: Bearer <token>`，登录端点 `/Login`
// 响应包装：除 `[UnPackage]` 标记接口外，所有响应统一为
//     { Code: 200|0|-1, Msg: string, Data: <原始返回> }
//     Success=200, Failure=-1, Unknown=0
//
// 错误 HTTP 状态码（来自 Backend/Middleware/ErrorFiliterAttribute.cs）：
//     401 → AuthorizationException（token 缺失/无效）
//     402 → AuthorizationTimeOutException（token 超时）
//     400 → DistributeException（并发限制）
//     200 + Code=-1 → 业务异常（CustomException）
//
// 联调旁路：服务端代码内有 MaxLevelToken = "oiiaioiiiai"（上帝口令）
//     若环境变量 JSY_GOD_TOKEN=1 且 JSY_USERNAME 为空，跳过 /Login，直接使用此 token。
//     **不要在生产环境启用**，仅用于本机/测试环境快速联调。

const JSY_BASE_URL = process.env.JSY_API_BASE_URL || 'http://localhost:8080'
const JSY_USERNAME = process.env.JSY_USERNAME || ''
const JSY_PASSWORD = process.env.JSY_PASSWORD || ''
const JSY_USE_GOD_TOKEN = process.env.JSY_GOD_TOKEN === '1'

// 后端枚举 ResponseCodeEnum.Success
const CODE_SUCCESS = 200

let cachedToken: { accessToken: string; loadedAt: number } | null = null

// JWT 内部到期时间（exp）服务端会校验，前端不解析。
// 简单策略：缓存命中后 4 小时主动重新登录（服务端默认 token 有效期通常 8h，留余量）。
// 如果服务端返回 402（token 超时），下次调用前清掉缓存。
const TOKEN_TTL_MS = 4 * 60 * 60 * 1000

class JsyApiError extends Error {
  constructor(public path: string, public httpStatus: number, public code: number | null, public serverMsg: string) {
    super(`JSY API 错误 [${path}] http=${httpStatus} code=${code} msg=${serverMsg}`)
  }
}

/** 上帝口令旁路 — 仅当环境变量启用且没配账号密码时 */
function godToken(): string | null {
  if (JSY_USE_GOD_TOKEN && !JSY_USERNAME) {
    return 'oiiaioiiiai'
  }
  return null
}

/** 登录拿 token，失败时抛错（不掩盖） */
async function login(): Promise<string> {
  const g = godToken()
  if (g) return g

  if (!JSY_USERNAME || !JSY_PASSWORD) {
    throw new Error('JSY 登录失败：必须设置 JSY_USERNAME 和 JSY_PASSWORD 环境变量（或 JSY_GOD_TOKEN=1 走联调旁路）')
  }

  const res = await fetch(`${JSY_BASE_URL}/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      UserName: JSY_USERNAME,
      Password: JSY_PASSWORD,
      VerifiCationCode: '', // 服务端字段拼写就是这样，不要"修正"
    }),
  })

  if (!res.ok) {
    throw new Error(`JSY /Login HTTP ${res.status}`)
  }

  const json = await res.json() as { Code: number; Msg: string; Data: { Token: string } }
  if (json.Code !== CODE_SUCCESS) {
    throw new Error(`JSY /Login 业务失败 code=${json.Code} msg=${json.Msg}`)
  }
  if (!json.Data?.Token) {
    throw new Error('JSY /Login 返回不含 Token 字段')
  }
  return json.Data.Token
}

/** 获取 token — 缓存命中则复用，TTL 过期或显式失效后重登 */
async function getToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && Date.now() - cachedToken.loadedAt < TOKEN_TTL_MS) {
    return cachedToken.accessToken
  }
  const token = await login()
  cachedToken = { accessToken: token, loadedAt: Date.now() }
  return token
}

/**
 * 通用 POST — JSY 项目 576/589 个端点都是 POST + JSON body，统一从这里走。
 * 自动注入 Authorization、自动解包 BaseResponse、自动在 402（token 超时）时重登一次。
 */
export async function jsyPost<T = unknown>(path: string, body: unknown): Promise<T> {
  let token = await getToken()

  const doFetch = async () => fetch(`${JSY_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  })

  let res = await doFetch()

  // 402 = token 超时（服务端用 PaymentRequired 表达，硬编码）
  // 401 = token 缺失/无效，也尝试重登一次
  if (res.status === 402 || res.status === 401) {
    cachedToken = null
    token = await getToken(true)
    res = await doFetch()
  }

  if (!res.ok) {
    let serverMsg = ''
    try {
      const errBody = await res.json() as { Msg?: string }
      serverMsg = errBody?.Msg ?? ''
    } catch { /* ignore */ }
    throw new JsyApiError(path, res.status, null, serverMsg)
  }

  const json = await res.json() as { Code: number; Msg: string; Data: T }
  if (json.Code !== CODE_SUCCESS) {
    throw new JsyApiError(path, res.status, json.Code, json.Msg)
  }
  return json.Data
}

/**
 * 通用 GET — 少数（13 个）端点用 GET，如 /PublicKey、/UserInfo、/RefreshToken、/Logout
 * P0 4 个工具暂时用不到，留接口供后续扩展
 */
export async function jsyGet<T = unknown>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
  let token = await getToken()
  const url = new URL(`${JSY_BASE_URL}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    }
  }

  const doFetch = async () => fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${token}` },
  })

  let res = await doFetch()
  if (res.status === 402 || res.status === 401) {
    cachedToken = null
    token = await getToken(true)
    res = await doFetch()
  }
  if (!res.ok) {
    throw new JsyApiError(path, res.status, null, '')
  }
  const json = await res.json() as { Code: number; Msg: string; Data: T }
  if (json.Code !== CODE_SUCCESS) {
    throw new JsyApiError(path, res.status, json.Code, json.Msg)
  }
  return json.Data
}

/**
 * 分页全量拉取 — 大部分 list 端点返回 GetDataByPageVo<T> { rows, total, pageNo, pageSize } （字段名待联调确认）
 * 调用方传入 path + body，body 内含 pageNo/pageSize，逐页累积到 total。
 * 安全阀：最多 50 页。
 */
export async function jsyGetAllPages<T = unknown>(
  path: string,
  bodyBase: Record<string, unknown>,
  opts: { pageSize?: number; maxPages?: number } = {},
): Promise<T[]> {
  const pageSize = opts.pageSize ?? 100
  const maxPages = opts.maxPages ?? 50
  const all: T[] = []
  let pageNo = 1
  while (pageNo <= maxPages) {
    const page = await jsyPost<JsyPageResult<T>>(path, { ...bodyBase, pageNo, pageSize })
    const rows = page.rows ?? page.list ?? page.data ?? []
    all.push(...rows)
    const total = page.total ?? page.totalCount ?? rows.length
    if (all.length >= total) break
    if (rows.length === 0) break
    pageNo++
  }
  return all
}

/**
 * GetDataByPageVo<T> 的形状 — 字段名以服务端实际为准，这里覆盖几种可能拼写。
 * 联调时若发现实际字段（如 `Rows`/`Total` 大写），统一在此处加适配。
 */
export interface JsyPageResult<T> {
  rows?: T[]
  list?: T[]
  data?: T[]
  total?: number
  totalCount?: number
  pageNo?: number
  pageSize?: number
}

export { JsyApiError }
