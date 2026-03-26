// 执行追踪收集器 — P1 调优基础设施
import { randomUUID } from 'crypto'
import type {
  ExecutionTrace, TraceRound, TraceCall, IntentTags,
  MemoryVerdict, ConfidenceSignals, ConfidenceLevel, ValidationResult,
} from '@/lib/types'

export class TraceCollector {
  private trace: ExecutionTrace
  private currentRound: TraceRound | null = null

  constructor(query: string) {
    this.trace = {
      traceId: `t-${randomUUID().slice(0, 8)}`,
      query,
      startTime: Date.now(),
      rounds: [],
      confidence: { toolMatch: 'medium', verdictConfidence: 'low', queryClarity: 'medium' },
      finalConfidence: 'medium',
      validation: [],
      sources: [],
    }
  }

  startRound(round: number, thought: string): void {
    this.currentRound = { round, thought, calls: [], observation: '' }
  }

  addCall(call: TraceCall): void {
    if (this.currentRound) {
      this.currentRound.calls.push(call)
    }
  }

  endRound(observation: string): void {
    if (this.currentRound) {
      this.currentRound.observation = observation
      this.trace.rounds.push(this.currentRound)
      this.currentRound = null
    }
  }

  setIntent(intent: IntentTags): void {
    this.trace.intent = intent
  }

  setVerdict(verdict: MemoryVerdict | null): void {
    this.trace.verdict = verdict
  }

  setConfidence(signals: ConfidenceSignals, final: ConfidenceLevel): void {
    this.trace.confidence = signals
    this.trace.finalConfidence = final
  }

  addValidation(result: ValidationResult): void {
    this.trace.validation.push(result)
  }

  addSource(tool: string, description: string): void {
    // 去重
    if (!this.trace.sources.some(s => s.tool === tool)) {
      this.trace.sources.push({ tool, description })
    }
  }

  build(): ExecutionTrace {
    this.trace.endTime = Date.now()
    return { ...this.trace }
  }
}
