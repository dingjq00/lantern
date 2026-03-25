'use client'
import { useState, useRef, useEffect } from 'react'
import { ChatInput } from './components/ChatInput'
import { ChatMessage, type Message } from './components/ChatMessage'

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSend = async (query: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: query }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer || '暂无回答',
        data: data.data,
        display: data.display,
        columns: data.columns,
        confidence: data.confidence,
        followUp: data.followUp,
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '查询出错，请稍后重试',
        confidence: 'low' as const,
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 标题栏 */}
      <header className="flex items-center px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
        <h1 className="text-lg font-semibold text-blue-800">Insight68</h1>
        <span className="ml-2 text-sm text-gray-500">智能查询助手</span>
      </header>

      {/* 消息区域 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 select-none">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-sm">输入问题，开始查询 EAM 系统数据</p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-md">
              {['系统里有多少台设备？', '上月故障趋势', '库存预警有哪些？', '我的待办'].map(q => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="px-3 py-1.5 text-xs bg-white text-gray-600 border border-gray-200 rounded-full hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} onFollowUp={handleSend} />
        ))}
        {loading && (
          <div className="flex justify-start mb-4">
            <div className="px-4 py-3 bg-gray-100 rounded-2xl rounded-bl-md text-sm text-gray-500">
              <span className="animate-pulse">查询中...</span>
            </div>
          </div>
        )}
      </div>

      {/* 输入框 */}
      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  )
}
