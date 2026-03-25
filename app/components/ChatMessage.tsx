import { ResultTable } from './ResultTable'
import { ConfidenceHint } from './ConfidenceHint'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  data?: Record<string, unknown>[]
  display?: 'text' | 'table' | 'chart'
  columns?: string[]
  confidence?: 'high' | 'medium' | 'low'
  followUp?: string[]
}

interface ChatMessageProps {
  message: Message
  onFollowUp?: (query: string) => void
}

export function ChatMessage({ message, onFollowUp }: ChatMessageProps) {
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

        {/* 表格展示 */}
        {!isUser && message.display === 'table' && message.data && message.data.length > 0 && (
          <ResultTable columns={message.columns} data={message.data} />
        )}

        {/* 置信度提示 */}
        {!isUser && message.confidence && (
          <ConfidenceHint confidence={message.confidence} />
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
