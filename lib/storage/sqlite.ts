// SQLite 存储层实现（P0: better-sqlite3 + WAL）
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import type { StorageInterface } from './types'
import type { MemorySession, MemoryVerdict, MemoryPreference, ExecutionTrace, Lesson, BenchmarkRun, BenchmarkRunSummary } from '@/lib/types'

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
    this.db.pragma('journal_mode = WAL')
    // 按顺序加载所有 migration
    const migrationsDir = path.join(process.cwd(), 'lib', 'storage', 'migrations')
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
      const ddl = sql.replace(/^PRAGMA.*$/gm, '').trim()
      this.db.exec(ddl)
    }
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

  updateSessionFeedback(tenantId: string, sessionId: string, feedback: 'up' | 'down'): void {
    const stmt = this.db.prepare(`
      UPDATE nl_memory_sessions SET feedback = ?
      WHERE tenant_id = ? AND session_id = ?
    `)
    stmt.run(feedback, tenantId, sessionId)
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

  // --- 执行追踪 ---

  insertTrace(tenantId: string, trace: ExecutionTrace, sessionId?: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO nl_traces (trace_id, tenant_id, session_id, query, trace_json, created_at)
      VALUES (@traceId, @tenantId, @sessionId, @query, @traceJson, @createdAt)
    `)
    stmt.run({
      traceId: trace.traceId,
      tenantId,
      sessionId: sessionId ?? null,
      query: trace.query,
      traceJson: JSON.stringify(trace),
      createdAt: new Date().toISOString(),
    })
  }

  getTrace(traceId: string): ExecutionTrace | null {
    const stmt = this.db.prepare('SELECT trace_json FROM nl_traces WHERE trace_id = ?')
    const row = stmt.get(traceId) as { trace_json: string } | undefined
    return row ? JSON.parse(row.trace_json) : null
  }

  // --- 自学习 Lessons ---

  insertLesson(lesson: Lesson): void {
    // 同 intent_hash + tenant_id 只保留最新一条，upsert
    // 先删旧的同 source 记录，再 insert
    this.db.prepare(`DELETE FROM nl_lessons WHERE tenant_id = ? AND intent_hash = ? AND source = ?`)
      .run(lesson.tenantId, lesson.intentHash, lesson.source)
    const stmt = this.db.prepare(`
      INSERT INTO nl_lessons (intent_hash, tenant_id, query, selected_tools, quality, error_reason, better_path, lesson, source, created_at)
      VALUES (@intentHash, @tenantId, @query, @selectedTools, @quality, @errorReason, @betterPath, @lesson, @source, @createdAt)
    `)
    stmt.run({
      intentHash: lesson.intentHash,
      tenantId: lesson.tenantId,
      query: lesson.query,
      selectedTools: JSON.stringify(lesson.selectedTools),
      quality: lesson.quality,
      errorReason: lesson.errorReason ?? null,
      betterPath: lesson.betterPath ? JSON.stringify(lesson.betterPath) : null,
      lesson: lesson.lesson,
      source: lesson.source,
      createdAt: lesson.createdAt.toISOString(),
    })
  }

  getLessonsByIntentHash(tenantId: string, intentHash: string, limit = 3): Lesson[] {
    const stmt = this.db.prepare(`
      SELECT * FROM nl_lessons
      WHERE tenant_id = ? AND intent_hash = ? AND quality != 'good'
      ORDER BY created_at DESC
      LIMIT ?
    `)
    const rows = stmt.all(tenantId, intentHash, limit) as Record<string, unknown>[]
    return rows.map(row => ({
      intentHash: row.intent_hash as string,
      tenantId: row.tenant_id as string,
      query: row.query as string,
      selectedTools: JSON.parse(row.selected_tools as string),
      quality: row.quality as Lesson['quality'],
      errorReason: row.error_reason as string | undefined,
      betterPath: row.better_path ? JSON.parse(row.better_path as string) : undefined,
      lesson: row.lesson as string,
      source: row.source as Lesson['source'],
      createdAt: new Date(row.created_at as string),
    }))
  }

  getAllLessons(tenantId: string, limit = 200): Lesson[] {
    const stmt = this.db.prepare(`
      SELECT * FROM nl_lessons
      WHERE tenant_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
    const rows = stmt.all(tenantId, limit) as Record<string, unknown>[]
    return rows.map(row => ({
      intentHash: row.intent_hash as string,
      tenantId: row.tenant_id as string,
      query: row.query as string,
      selectedTools: JSON.parse(row.selected_tools as string),
      quality: row.quality as Lesson['quality'],
      errorReason: row.error_reason as string | undefined,
      betterPath: row.better_path ? JSON.parse(row.better_path as string) : undefined,
      lesson: row.lesson as string,
      source: row.source as Lesson['source'],
      createdAt: new Date(row.created_at as string),
    }))
  }

  // --- Benchmark 追踪 ---

  saveBenchmarkRun(run: BenchmarkRun): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO benchmark_runs (run_id, timestamp, config, summary, results, notes, created_at)
      VALUES (@runId, @timestamp, @config, @summary, @results, @notes, @createdAt)
    `)
    stmt.run({
      runId: run.runId,
      timestamp: run.timestamp,
      config: JSON.stringify(run.config),
      summary: JSON.stringify(run.summary),
      results: JSON.stringify(run.results),
      notes: run.config.notes ?? null,
      createdAt: new Date().toISOString(),
    })
  }

  getBenchmarkRuns(): BenchmarkRunSummary[] {
    const stmt = this.db.prepare(`SELECT run_id, timestamp, config, summary, notes FROM benchmark_runs ORDER BY timestamp DESC`)
    const rows = stmt.all() as Record<string, unknown>[]
    return rows.map(row => {
      const config = JSON.parse(row.config as string)
      const summary = JSON.parse(row.summary as string)
      return {
        runId: row.run_id as string,
        timestamp: row.timestamp as string,
        model: config.model,
        totalQuestions: summary.total,
        recall: summary.recall,
        precision: summary.precision,
        perfectCount: summary.perfectCount,
        notes: row.notes as string | undefined,
      }
    })
  }

  getBenchmarkRun(runId: string): BenchmarkRun | null {
    const stmt = this.db.prepare(`SELECT * FROM benchmark_runs WHERE run_id = ?`)
    const row = stmt.get(runId) as Record<string, unknown> | undefined
    if (!row) return null
    return {
      runId: row.run_id as string,
      timestamp: row.timestamp as string,
      config: JSON.parse(row.config as string),
      summary: JSON.parse(row.summary as string),
      results: JSON.parse(row.results as string),
    }
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
