'use client'
import { useState } from 'react'
import type { ExecutionTrace } from '@/lib/types'

interface TracePanelProps {
  trace: ExecutionTrace
}

export function TracePanel({ trace }: TracePanelProps) {
  const [open, setOpen] = useState(false)
  // endTime 应该在 trace.build() 时已填充，fallback 用 startTime 避免 hydration mismatch
  const totalMs = (trace.endTime ?? trace.startTime) - trace.startTime
  const roundCount = trace.rounds.length

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-gray-500 hover:text-blue-600 transition-colors flex items-center gap-1"
      >
        <span>{open ? '▼' : '▶'}</span>
        <span>执行详情 ({roundCount} 轮, {totalMs}ms)</span>
      </button>

      {open && (
        <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden text-xs">
          {/* 每轮详情 */}
          {trace.rounds.map((round) => (
            <div key={round.round} className="border-b border-gray-100 last:border-b-0">
              <div className="px-3 py-2 bg-gray-50 font-medium text-gray-700">
                轮次 {round.round} — {round.round === 0 ? '首轮规划' : `追查轮 ${round.round}`}
              </div>
              <div className="px-3 py-2 space-y-1.5">
                <div className="text-gray-600">
                  <span className="mr-1">💭</span>
                  <span className="font-medium">思考:</span> {round.thought}
                </div>
                {round.calls.map((call, ci) => (
                  <div key={ci} className="text-gray-600">
                    <span className="mr-1">🔧</span>
                    <span className="font-medium">{call.tool}</span>
                    <span className="text-gray-400 ml-1">({JSON.stringify(call.arguments)})</span>
                    <span className={`ml-2 ${call.status === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                      → {call.durationMs}ms {call.status === 'success' ? '✅' : '❌'}
                    </span>
                  </div>
                ))}
                <div className="text-gray-600">
                  <span className="mr-1">👁</span>
                  <span className="font-medium">观察:</span> {round.observation}
                </div>
              </div>
            </div>
          ))}

          {/* 元信息 */}
          <div className="px-3 py-2 bg-gray-50 space-y-1 text-gray-500">
            {trace.intent && (
              <div>意图: {trace.intent.domains.join('/')} / {trace.intent.operation} / [{trace.intent.filters.join(', ')}]</div>
            )}
            <div>Verdict: {trace.verdict ? `${trace.verdict.toolChain.join('→')} (score ${trace.verdict.avgScore})` : '无历史记录'}</div>
            <div>
              置信度: toolMatch={trace.confidence.toolMatch} verdict={trace.confidence.verdictConfidence} clarity={trace.confidence.queryClarity}
              → 最终={trace.finalConfidence}
            </div>
            {trace.validation.length > 0 && (
              <div className="text-amber-600">
                验证警告: {trace.validation.map(v => v.message).join('; ')}
              </div>
            )}
            {trace.validation.length === 0 && <div>验证: 无异常</div>}
          </div>
        </div>
      )}
    </div>
  )
}
