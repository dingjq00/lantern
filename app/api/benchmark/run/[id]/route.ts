import { NextRequest, NextResponse } from 'next/server'
import { SQLiteStorage } from '@/lib/storage/sqlite'

let storage: SQLiteStorage | null = null
function getStorage(): SQLiteStorage {
  if (!storage) { storage = new SQLiteStorage(); storage.initialize() }
  return storage
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const run = getStorage().getBenchmarkRun(id)
    if (!run) return NextResponse.json({ error: '未找到该运行记录' }, { status: 404 })
    return NextResponse.json(run)
  } catch (error) {
    return NextResponse.json({ error: '获取运行详情失败' }, { status: 500 })
  }
}
