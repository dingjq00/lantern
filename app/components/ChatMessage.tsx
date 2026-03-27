import { ResultTable } from './ResultTable'
import { ConfidenceHint } from './ConfidenceHint'
import { TracePanel } from './TracePanel'
import type { ExecutionTrace } from '@/lib/types'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  data?: Record<string, unknown>[]
  display?: 'text' | 'table' | 'chart'
  columns?: string[]
  confidence?: 'high' | 'medium' | 'low'
  followUp?: string[]
  sources?: Array<{ tool: string; description: string }>
  trace?: ExecutionTrace
}

interface ChatMessageProps {
  message: Message
  onFollowUp?: (query: string) => void
  onFeedback?: (sessionId: string, feedback: 'up' | 'down') => void
}

export function ChatMessage({ message, onFollowUp, onFeedback }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : ''}`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-gray-100 text-gray-800 rounded-bl-md'
          }`}
        >
          {message.content}
        </div>

        {/* 表格展示 — 有数据就尝试展示，不完全依赖 LLM 的 display 判断 */}
        {!isUser && message.data && message.data.length > 0 && (
          <ResultTable columns={message.columns} data={message.data} />
        )}

        {/* 置信度提示 */}
        {!isUser && message.confidence && (
          <ConfidenceHint confidence={message.confidence} />
        )}

        {/* Thumbs Up/Down 反馈 */}
        {!isUser && message.trace?.traceId && (
          <div className="mt-1.5 flex gap-2">
            <button
              onClick={() => onFeedback?.(message.trace!.traceId, 'up')}
              className="text-xs text-gray-400 hover:text-green-600 transition-colors"
              title="有帮助"
            >👍</button>
            <button
              onClick={() => onFeedback?.(message.trace!.traceId, 'down')}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              title="不准确"
            >👎</button>
          </div>
        )}

        {/* 数据来源 */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-1.5 text-xs text-gray-400">
            数据来源：{message.sources.map(s => s.description).join('、')}
          </div>
        )}

        {/* 执行追踪 */}
        {!isUser && message.trace && (
          <TracePanel trace={message.trace} lessonEval={(message as any).lessonEval} />
        )}

        {/* 追问建议 */}
        {!isUser && message.followUp && message.followUp.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.followUp.map((q, i) => (
              <button
                key={i}
                onClick={() => onFollowUp?.(q)}
                className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
