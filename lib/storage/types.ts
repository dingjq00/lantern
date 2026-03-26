// 存储层接口定义
import type { MemorySession, MemoryVerdict, MemoryPreference, ExecutionTrace, Lesson } from '@/lib/types'

export interface StorageInterface {
  /** 初始化数据库（建表等） */
  initialize(): void

  // --- 会话层 ---
  insertSession(session: MemorySession): void
  getSessionsByIntentHash(tenantId: string, intentHash: string, limit?: number): MemorySession[]
  updateSessionFeedback(tenantId: string, sessionId: string, feedback: 'up' | 'down'): void

  // --- 经验层 ---
  getVerdict(tenantId: string, intentHash: string): MemoryVerdict | null
  upsertVerdict(verdict: MemoryVerdict): void

  // --- 持久层 ---
  getPreference(tenantId: string, userId: string): MemoryPreference | null
  setPreference(pref: MemoryPreference): void

  // --- 执行追踪 ---
  insertTrace(tenantId: string, trace: ExecutionTrace, sessionId?: string): void
  getTrace(traceId: string): ExecutionTrace | null

  // --- 自学习 Lessons ---
  insertLesson(lesson: Lesson): void
  getLessonsByIntentHash(tenantId: string, intentHash: string, limit?: number): Lesson[]

  /** 关闭连接 */
  close(): void
}
