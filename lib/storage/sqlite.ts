// SQLite 存储层实现（P0: better-sqlite3 + WAL）
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import type { StorageInterface } from './types'
import type { MemorySession, MemoryVerdict, MemoryPreference } from '@/lib/types'

export class SQLiteStorage implements StorageInterface {
  private db: Database.Database

  constructor(dbPath: string = './data/insight68.db') {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    }
    this.db = new Database(dbPath)
  }

  initialize(): void {
    const migrationPath = path.join(__dirname, 'migrations', '001-init.sql')
    const sql = fs.readFileSync(migrationPath, 'utf-8')
    // PRAGMA 不能在 exec 里和其他语句一起跑，单独执行
    this.db.pragma('journal_mode = WAL')
    // 去掉 PRAGMA 行后执行建表
    const ddl = sql.replace(/^PRAGMA.*$/gm, '').trim()
    this.db.exec(ddl)
  }

  // --- 会话层 ---

  insertSession(session: MemorySession): void {
    const stmt = this.db.prepare(`
      INSERT INTO nl_memory_sessions
        (session_id, user_id, tenant_id, query, intent_hash, tool_chain, result_summary, routing_decision, feedback, created_at, expires_at)
      VALUES
        (@sessionId, @userId, @tenantId, @query, @intentHash, @toolChain, @resultSummary, @routingDecision, @feedback, @createdAt, @expiresAt)
    `)
    stmt.run({
      sessionId: session.sessionId,
      userId: session.userId,
      tenantId: session.tenantId,
      query: session.query,
      intentHash: session.intentHash,
      toolChain: JSON.stringify(session.toolChain),
      resultSummary: session.resultSummary,
      routingDecision: JSON.stringify(session.routingDecision),
      feedback: session.feedback ?? null,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    })
  }

  getSessionsByIntentHash(tenantId: string, intentHash: string, limit = 10): MemorySession[] {
    const stmt = this.db.prepare(`
      SELECT * FROM nl_memory_sessions
      WHERE tenant_id = ? AND intent_hash = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
    const rows = stmt.all(tenantId, intentHash, limit) as Record<string, unknown>[]
    return rows.map(rowToSession)
  }

  // --- 经验层 ---

  getVerdict(tenantId: string, intentHash: string): MemoryVerdict | null {
    const stmt = this.db.prepare(`
      SELECT * FROM nl_memory_verdicts
      WHERE tenant_id = ? AND intent_hash = ?
    `)
    const row = stmt.get(tenantId, intentHash) as Record<string, unknown> | undefined
    return row ? rowToVerdict(row) : null
  }

  upsertVerdict(verdict: MemoryVerdict): void {
    const stmt = this.db.prepare(`
      INSERT INTO nl_memory_verdicts
        (intent_hash, tenant_id, tool_chain, avg_score, sample_count, confidence, bonus_points, last_updated, expires_at)
      VALUES
        (@intentHash, @tenantId, @toolChain, @avgScore, @sampleCount, @confidence, @bonusPoints, @lastUpdated, @expiresAt)
      ON CONFLICT (tenant_id, intent_hash) DO UPDATE SET
        tool_chain = excluded.tool_chain,
        avg_score = excluded.avg_score,
        sample_count = excluded.sample_count,
        confidence = excluded.confidence,
        bonus_points = excluded.bonus_points,
        last_updated = excluded.last_updated,
        expires_at = excluded.expires_at
    `)
    stmt.run({
      intentHash: verdict.intentHash,
      tenantId: verdict.tenantId,
      toolChain: JSON.stringify(verdict.toolChain),
      avgScore: verdict.avgScore,
      sampleCount: verdict.sampleCount,
      confidence: verdict.confidence,
      bonusPoints: verdict.bonusPoints,
      lastUpdated: verdict.lastUpdated.toISOString(),
      expiresAt: verdict.expiresAt.toISOString(),
    })
  }

  // --- 持久层 ---

  getPreference(tenantId: string, userId: string): MemoryPreference | null {
    const stmt = this.db.prepare(`
      SELECT * FROM nl_memory_preferences
      WHERE tenant_id = ? AND user_id = ?
    `)
    const row = stmt.get(tenantId, userId) as Record<string, unknown> | undefined
    return row ? rowToPreference(row) : null
  }

  setPreference(pref: MemoryPreference): void {
    const stmt = this.db.prepare(`
      INSERT INTO nl_memory_preferences
        (user_id, tenant_id, preferences, created_at, updated_at)
      VALUES
        (@userId, @tenantId, @preferences, @createdAt, @updatedAt)
      ON CONFLICT (tenant_id, user_id) DO UPDATE SET
        preferences = excluded.preferences,
        updated_at = excluded.updated_at
    `)
    stmt.run({
      userId: pref.userId,
      tenantId: pref.tenantId,
      preferences: JSON.stringify(pref.preferences),
      createdAt: pref.createdAt.toISOString(),
      updatedAt: pref.updatedAt.toISOString(),
    })
  }

  close(): void {
    this.db.close()
  }
}

// --- Row → Domain 映射 ---

function rowToSession(row: Record<string, unknown>): MemorySession {
  return {
    sessionId: row.session_id as string,
    userId: row.user_id as string,
    tenantId: row.tenant_id as string,
    query: row.query as string,
    intentHash: row.intent_hash as string,
    toolChain: JSON.parse(row.tool_chain as string),
    resultSummary: row.result_summary as string,
    routingDecision: JSON.parse(row.routing_decision as string),
    feedback: row.feedback as string | undefined,
    createdAt: new Date(row.created_at as string),
    expiresAt: new Date(row.expires_at as string),
  }
}

function rowToVerdict(row: Record<string, unknown>): MemoryVerdict {
  return {
    intentHash: row.intent_hash as string,
    tenantId: row.tenant_id as string,
    toolChain: JSON.parse(row.tool_chain as string),
    avgScore: row.avg_score as number,
    sampleCount: row.sample_count as number,
    confidence: row.confidence as MemoryVerdict['confidence'],
    bonusPoints: row.bonus_points as number,
    lastUpdated: new Date(row.last_updated as string),
    expiresAt: new Date(row.expires_at as string),
  }
}

function rowToPreference(row: Record<string, unknown>): MemoryPreference {
  return {
    userId: row.user_id as string,
    tenantId: row.tenant_id as string,
    preferences: JSON.parse(row.preferences as string),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}
