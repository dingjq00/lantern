import { NextResponse } from 'next/server'
import { SQLiteStorage } from '@/lib/storage/sqlite'

let storage: SQLiteStorage | null = null
function getStorage(): SQLiteStorage {
  if (!storage) { storage = new SQLiteStorage(); storage.initialize() }
  return storage
}

export async function GET() {
  try {
    const lessons = getStorage().getAllLessons('default', 200)
    return NextResponse.json(lessons)
  } catch (error) {
    console.error('Lessons API error:', error)
    return NextResponse.json({ error: '获取 lessons 失败', detail: String(error) }, { status: 500 })
  }
}
