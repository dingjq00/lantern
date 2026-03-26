import { NextResponse } from 'next/server'
import { SQLiteStorage } from '@/lib/storage/sqlite'

let storage: SQLiteStorage | null = null
function getStorage(): SQLiteStorage {
  if (!storage) { storage = new SQLiteStorage(); storage.initialize() }
  return storage
}

export async function GET() {
  try {
    const runs = getStorage().getBenchmarkRuns()
    return NextResponse.json(runs)
  } catch (error) {
    return NextResponse.json({ error: '获取运行记录失败' }, { status: 500 })
  }
}
