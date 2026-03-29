import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const filePath = path.join(process.cwd(), 'data/quality-eval-latest.json')
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: '暂无质量评估数据，请先运行 quality-eval 脚本' }, { status: 404 })
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  return NextResponse.json(data)
}
