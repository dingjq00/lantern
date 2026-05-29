'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ChatInput } from './components/ChatInput'
import { ChatMessage, type Message } from './components/ChatMessage'

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // 加载计时器
  useEffect(() => {
    if (loading) {
      setElapsedSec(0)
      timerRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [loading])

  const handleSend = async (query: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: query }
    const allMessages = [...messages, userMsg]
    setMessages(allMessages)
    setLoading(true)

    const startMs = Date.now()
    // 取最近 3 轮对话作为上下文
    const recent = allMessages.slice(-6).map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, history: recent }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      const latencyMs = Date.now() - startMs
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer || '查询已完成，请查看下方数据。',
        data: data.data,
        display: data.display,
        columns: data.columns,
        confidence: data.confidence,
        followUp: data.followUp,
        sources: data.sources,
        dataSources: data.dataSources,
        chartHints: data.chartHints,
        displayPlan: data.displayPlan,
        trace: data.trace,
        latencyMs,
      } as any
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '查询出错，请稍后重试。',
        confidence: 'low' as const,
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleFeedback = async (sessionId: string, feedback: 'up' | 'down') => {
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, feedback }),
      })
    } catch { /* 反馈失败不影响用户体验 */ }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 标题栏 */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center">
          <h1 className="text-lg font-semibold text-blue-800">Lantern 执灯系统</h1>
          <span className="ml-2 text-sm text-gray-500">智能查询助手</span>
        </div>
        <div className="flex items-center gap-3">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="px-3 py-1.5 text-xs text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              清除对话
            </button>
          )}
          <Link
            href="/benchmark"
            className="px-3 py-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            Benchmark
          </Link>
        </div>
      </header>

      {/* 消息区域 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 select-none">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-sm">输入问题，查询企业系统数据</p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-md">
              {['系统里有多少台设备？', '生产情况怎么样？', '当前有哪些质量异常？', '上月故障趋势'].map(q => (
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
          <ChatMessage key={msg.id} message={msg} onFollowUp={handleSend} onFeedback={handleFeedback} />
        ))}
        {loading && (
          <div className="flex justify-start mb-4">
            <div className="px-4 py-3 bg-gray-100 rounded-2xl rounded-bl-md text-sm text-gray-500">
              <span className="animate-pulse">查询中... {elapsedSec > 0 && `${elapsedSec}s`}</span>
            </div>
          </div>
        )}
      </div>

      {/* 输入框 */}
      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  )
}
