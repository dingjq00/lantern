import { NextRequest, NextResponse } from 'next/server'
import { SQLiteStorage } from '@/lib/storage/sqlite'

let storage: SQLiteStorage | null = null
function getStorage(): SQLiteStorage {
  if (!storage) {
    storage = new SQLiteStorage()
    storage.initialize()
  }
  return storage
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, feedback } = await request.json() as {
      sessionId?: string
      feedback?: 'up' | 'down'
    }

    if (!sessionId || !feedback || !['up', 'down'].includes(feedback)) {
      return NextResponse.json({ error: '需要 sessionId 和 feedback (up/down)' }, { status: 400 })
    }

    getStorage().updateSessionFeedback('default', sessionId, feedback)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Feedback API error:', error)
    return NextResponse.json({ error: '保存反馈失败' }, { status: 500 })
  }
}
