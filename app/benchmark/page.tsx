'use client'
import { useState, useEffect } from 'react'
import { flattenMcpData, formatCellValue, buildMetaSummary } from '@/lib/ui/data-flatten'

interface RunSummary {
  runId: string; timestamp: string; model: string
  totalQuestions: number; recall: number; precision: number; perfectCount: number; notes?: string
}

interface RunDetail {
  runId: string; timestamp: string
  config: { model: string; maxChaseRounds: number; escalationModel: string; promptVersion: string; notes?: string }
  summary: {
    total: number; success: number; recall: number; precision: number; perfectCount: number
    byLevel: Record<string, { recall: number; perfect: number; count: number; avgLatency: number; avgRounds: number }>
    sourcesCoverage: number; latencyP50: number; latencyP95: number
    // v3 三层评估
    factScore?: number; factAsserted?: number; forbiddenViolations?: number; followUpScore?: number
  }
  results: Array<{
    id: string; query: string; level: string; success: boolean
    actualTools: string[]; expectedTools: string[]; recall: number; precision: number
    rounds: number; latencyMs: number; confidence: string; hasSources: boolean; answer: string
    data?: Record<string, unknown>[]; display?: string; columns?: string[]
    followUp?: string[]; sources?: Array<{ tool: string; description: string }>
    trace?: any
  }>
}

interface LessonItem {
  intentHash: string; query: string; quality: 'good' | 'partial' | 'bad'
  errorReason?: string; lesson: string; selectedTools: string[]
  source: string; createdAt: string
}

export default function BenchmarkDashboard() {
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null)
  const [compareRun, setCompareRun] = useState<RunDetail | null>(null)
  const [tab, setTab] = useState<'benchmark' | 'lessons' | 'quality'>('benchmark')
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [lessons, setLessons] = useState<LessonItem[]>([])
  const [lessonsLoading, setLessonsLoading] = useState(false)
  const [qualityData, setQualityData] = useState<any>(null)
  const [qualityLoading, setQualityLoading] = useState(false)

  useEffect(() => {
    fetch('/api/benchmark/runs').then(r => r.json()).then(data => { setRuns(data); setLoading(false) })
  }, [])

  const loadLessons = async () => {
    if (lessons.length > 0) return  // 已加载
    setLessonsLoading(true)
    const res = await fetch('/api/benchmark/lessons')
    const data = await res.json()
    setLessons(data)
    setLessonsLoading(false)
  }

  const loadQuality = async () => {
    if (qualityData) return
    setQualityLoading(true)
    try {
      const res = await fetch('/api/benchmark/quality')
      if (res.ok) setQualityData(await res.json())
    } catch {}
    setQualityLoading(false)
  }

  const loadRun = async (runId: string, isCompare = false) => {
    const res = await fetch(`/api/benchmark/run/${runId}`)
    const data = await res.json()
    if (isCompare) setCompareRun(data)
    else setSelectedRun(data)
  }

  const filteredResults = selectedRun?.results.filter(r => {
    if (filter === 'all') return true
    if (filter === 'pass') return r.recall === 1
    if (filter === 'fail') return r.recall < 0.5
    if (filter === 'partial') return r.recall >= 0.5 && r.recall < 1
    return r.level === filter
  }) ?? []

  const getCompareResult = (id: string) => compareRun?.results.find(r => r.id === id)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* 标题 + Tab 切换 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">Benchmark Dashboard</h1>
            <div className="flex gap-4 mt-2">
              <button onClick={() => setTab('benchmark')}
                className={`text-sm pb-1 border-b-2 transition-colors ${tab === 'benchmark' ? 'text-blue-700 border-blue-700 font-semibold' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>
                实验追踪
              </button>
              <button onClick={() => { setTab('lessons'); loadLessons() }}
                className={`text-sm pb-1 border-b-2 transition-colors ${tab === 'lessons' ? 'text-blue-700 border-blue-700 font-semibold' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>
                Lessons ({lessons.length || '...'})
              </button>
              <button onClick={() => { setTab('quality'); loadQuality() }}
                className={`text-sm pb-1 border-b-2 transition-colors ${tab === 'quality' ? 'text-blue-700 border-blue-700 font-semibold' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>
                输出质量
              </button>
            </div>
          </div>
          {tab === 'benchmark' && selectedRun && (
            <div className="flex items-center gap-3">
              <button onClick={() => { setSelectedRun(null); setCompareRun(null) }}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                ← 返回列表
              </button>
              <select
                value={compareRun?.runId ?? ''}
                onChange={e => { if (e.target.value) loadRun(e.target.value, true); else setCompareRun(null) }}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700"
              >
                <option value="">选择对比运行...</option>
                {runs.filter(r => r.runId !== selectedRun.runId).map(r => (
                  <option key={r.runId} value={r.runId}>
                    {new Date(r.timestamp).toLocaleString('zh-CN')} — {(r.recall * 100).toFixed(1)}% {r.notes || ''}
                  </option>
                ))}
              </select>
              {compareRun && (
                <span className="text-xs text-blue-600">对比中: {(compareRun.summary.recall * 100).toFixed(1)}%</span>
              )}
            </div>
          )}
        </div>

        {/* Lessons Tab */}
        {tab === 'lessons' && <LessonsPanel lessons={lessons} loading={lessonsLoading} />}

        {/* Quality Tab */}
        {tab === 'quality' && <QualityPanel data={qualityData} loading={qualityLoading} />}

        {/* 运行列表 */}
        {tab === 'benchmark' && !selectedRun && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">历史运行记录</h2>
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-400">加载中...</div>
            ) : runs.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                暂无运行记录。运行 <code className="bg-gray-100 px-2 py-1 rounded">npx tsx scripts/benchmark.ts</code> 生成。
              </div>
            ) : (
              <table className="w-full text-sm text-gray-900">
                <thead>
                  <tr className="bg-blue-800 text-white">
                    <th className="px-4 py-3 text-left">时间</th>
                    <th className="px-4 py-3 text-left">模型</th>
                    <th className="px-4 py-3 text-center">Recall</th>
                    <th className="px-4 py-3 text-center">完美</th>
                    <th className="px-4 py-3 text-center">题数</th>
                    <th className="px-4 py-3 text-left">备注</th>
                    <th className="px-4 py-3 text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run, i) => (
                    <tr key={run.runId} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 cursor-pointer`}>
                      <td className="px-4 py-3" onClick={() => loadRun(run.runId)}>
                        {new Date(run.timestamp).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" onClick={() => loadRun(run.runId)}>{run.model}</td>
                      <td className="px-4 py-3 text-center font-semibold" onClick={() => loadRun(run.runId)}
                        style={{ color: run.recall >= 0.9 ? '#22C55E' : run.recall >= 0.7 ? '#F59E0B' : '#EF4444' }}>
                        {(run.recall * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-center" onClick={() => loadRun(run.runId)}>
                        {run.perfectCount}/{run.totalQuestions}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={() => loadRun(run.runId)}>{run.totalQuestions}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs" onClick={() => loadRun(run.runId)}>{run.notes || '-'}</td>
                      <td className="px-4 py-3 text-center" onClick={() => loadRun(run.runId)}>
                        <span className="text-xs text-blue-600">查看 →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 运行详情 */}
        {tab === 'benchmark' && selectedRun && (
          <>
            {/* 概览卡片 — 三层评估 */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
              {[
                { label: '① 工具 Recall', value: `${(selectedRun.summary.recall * 100).toFixed(1)}%`, color: selectedRun.summary.recall >= 0.9 ? '#22C55E' : '#F59E0B' },
                { label: '② 事实得分', value: selectedRun.summary.factScore != null ? `${(selectedRun.summary.factScore * 100).toFixed(0)}%` : '-', color: (selectedRun.summary.factScore ?? 0) >= 0.8 ? '#22C55E' : (selectedRun.summary.factScore ?? 0) >= 0.5 ? '#F59E0B' : '#EF4444' },
                { label: '③ FollowUp', value: selectedRun.summary.followUpScore != null ? `${(selectedRun.summary.followUpScore * 100).toFixed(0)}%` : '-', color: (selectedRun.summary.followUpScore ?? 0) >= 0.8 ? '#22C55E' : '#F59E0B' },
                { label: '禁用词违规', value: selectedRun.summary.forbiddenViolations != null ? `${selectedRun.summary.forbiddenViolations}题` : '-', color: (selectedRun.summary.forbiddenViolations ?? 0) > 0 ? '#EF4444' : '#22C55E' },
                { label: '完美召回', value: `${selectedRun.summary.perfectCount}/${selectedRun.summary.total}`, color: '#4472C4' },
                { label: '模型', value: selectedRun.config.model, color: '#666' },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{card.label}</div>
                </div>
              ))}
            </div>

            {/* 按等级统计 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">按等级统计</h3>
              <div className="grid grid-cols-5 gap-3">
                {Object.entries(selectedRun.summary.byLevel).sort().map(([level, stats]) => (
                  <div key={level} className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold" style={{ color: stats.recall >= 0.9 ? '#22C55E' : stats.recall >= 0.7 ? '#F59E0B' : '#EF4444' }}>
                      {(stats.recall * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500">{level} · {stats.perfect}/{stats.count} · {stats.avgLatency}ms</div>
                    {compareRun && (
                      <div className="text-xs mt-1" style={{ color: '#4472C4' }}>
                        对比: {compareRun.summary.byLevel[level] ? `${(compareRun.summary.byLevel[level].recall * 100).toFixed(0)}%` : '-'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 筛选按钮 */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {[
                { key: 'all', label: `全部 (${selectedRun.results.length})` },
                { key: 'fail', label: `❌ 失败 (${selectedRun.results.filter(r => r.recall < 0.5).length})` },
                { key: 'partial', label: `⚠️ 部分 (${selectedRun.results.filter(r => r.recall >= 0.5 && r.recall < 1).length})` },
                { key: 'pass', label: `✅ 通过 (${selectedRun.results.filter(r => r.recall === 1).length})` },
                ...['L1', 'L2', 'L3', 'L4', 'L5'].map(l => ({ key: l, label: l })),
              ].map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${filter === f.key ? 'bg-blue-800 text-white border-blue-800' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* 结果列表 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-sm text-gray-900">
                <thead>
                  <tr className="bg-blue-800 text-white">
                    <th className="px-3 py-2 text-left w-12">ID</th>
                    <th className="px-3 py-2 text-left w-12">等级</th>
                    <th className="px-3 py-2 text-left">查询</th>
                    <th className="px-3 py-2 text-center w-16">Recall</th>
                    {compareRun && <th className="px-3 py-2 text-center w-16">对比</th>}
                    <th className="px-3 py-2 text-center w-12">轮次</th>
                    <th className="px-3 py-2 text-center w-16">延迟</th>
                    <th className="px-3 py-2 text-left">详情</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((r, i) => {
                    const cr = getCompareResult(r.id)
                    return (
                      <ResultRow key={r.id} result={r} compareResult={cr} index={i} />
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ResultRow({ result: r, compareResult: cr, index }: { result: any; compareResult?: any; index: number }) {
  const [open, setOpen] = useState(false)
  const recallColor = r.recall === 1 ? '#22C55E' : r.recall >= 0.5 ? '#F59E0B' : '#EF4444'

  return (
    <>
      <tr className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 cursor-pointer`} onClick={() => setOpen(!open)}>
        <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
        <td className="px-3 py-2 text-xs">{r.level}</td>
        <td className="px-3 py-2 max-w-[300px] truncate">{r.query}</td>
        <td className="px-3 py-2 text-center font-semibold" style={{ color: recallColor }}>
          {(r.recall * 100).toFixed(0)}%
        </td>
        {cr !== undefined && (
          <td className="px-3 py-2 text-center text-xs" style={{ color: cr ? (cr.recall > r.recall ? '#22C55E' : cr.recall < r.recall ? '#EF4444' : '#666') : '#ccc' }}>
            {cr ? `${(cr.recall * 100).toFixed(0)}%` : '-'}
          </td>
        )}
        <td className="px-3 py-2 text-center text-xs">{r.rounds}</td>
        <td className="px-3 py-2 text-center text-xs">{(r.latencyMs / 1000).toFixed(1)}s</td>
        <td className="px-3 py-2 text-xs text-blue-600">{open ? '▼ 收起' : '▶ 展开'}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={cr !== undefined ? 8 : 7} className="px-2 py-3 bg-gray-50">
            {cr ? (
              /* 对比模式：左右两列 */
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-semibold text-blue-700 mb-2 px-2">当前运行 — Recall {(r.recall * 100).toFixed(0)}%</div>
                  <RunDetailPanel result={r} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-purple-700 mb-2 px-2">对比运行 — Recall {(cr.recall * 100).toFixed(0)}%</div>
                  <RunDetailPanel result={cr} />
                </div>
              </div>
            ) : (
              /* 单运行模式 */
              <RunDetailPanel result={r} />
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function RunDetailPanel({ result: r }: { result: any }) {
  const [traceOpen, setTraceOpen] = useState(false)
  const missing = r.expectedTools.filter((t: string) => !r.actualTools.includes(t))
  const extra = r.actualTools.filter((t: string) => !r.expectedTools.includes(t))

  // 智能展平 MCP 返回数据（自动识别 items/groups/records/trend 等模式）
  const flatResult = r.data?.length > 0 ? flattenMcpData(r.data) : null
  const tableData = flatResult?.rows ?? null
  const metaSummary = flatResult ? buildMetaSummary(flatResult.meta) : null

  const dataKeys = tableData?.length ? Object.keys(tableData[0]) : []
  const tableHeaders = r.columns?.length > 0 && r.columns.length === dataKeys.length
    ? r.columns
    : r.columns?.length > 0 && r.columns.every((c: string) => c in (tableData?.[0] ?? {}))
      ? r.columns
      : dataKeys
  const tableKeys = r.columns?.length > 0 && r.columns.every((c: string) => c in (tableData?.[0] ?? {}))
    ? r.columns
    : dataKeys

  return (
    <div className="space-y-3 text-xs text-gray-800 bg-white rounded-lg border border-gray-200 p-4">
      {/* ① 回答气泡 — 模拟聊天 UI */}
      <div className="px-4 py-3 bg-gray-100 rounded-2xl rounded-bl-md text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
        {r.answer || '(无回答)'}
      </div>

      {/* ② 数据表格 */}
      {tableData && tableKeys.length > 0 && (
        <div className="overflow-x-auto">
          {metaSummary && (
            <div className="text-xs text-gray-500 mb-1">{metaSummary}</div>
          )}
          <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-blue-700 text-white">
                {tableHeaders.map((h: string, i: number) => (
                  <th key={i} className="px-3 py-1.5 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.slice(0, 10).map((row: any, ri: number) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {tableKeys.map((key: string, ki: number) => (
                    <td key={ki} className="px-3 py-1.5 text-gray-700">
                      {formatCellValue(row[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {tableData.length > 10 && <div className="text-gray-400 mt-1">... 共 {tableData.length} 行</div>}
        </div>
      )}

      {/* ③ 置信度提示 */}
      {r.confidence === 'low' && (
        <div className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs border border-amber-200">
          请补充更多细节，帮助我为您精确定位信息
        </div>
      )}
      {r.confidence === 'medium' && (
        <div className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs border border-blue-200">
          以上是根据您的描述匹配的结果，如需精确查询请补充条件
        </div>
      )}

      {/* ④ 数据来源 */}
      {(r.sources?.length > 0 || r.trace?.sources?.length > 0) && (
        <div className="text-xs text-gray-400">
          数据来源: {(r.sources || r.trace?.sources || []).map((s: any) => s.description).join('、')}
        </div>
      )}

      {/* ⑤ 追问建议（Perplexity 式） */}
      {r.followUp?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {r.followUp.map((q: string, i: number) => (
            <span key={i} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs border border-blue-200">{q}</span>
          ))}
        </div>
      )}

      {/* ⑥ 事实层 + followUp 检查 (v3) */}
      {(r.factCheck || r.followUpCheck) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {r.factCheck && r.factCheck.mustTotal > 0 && (
            <span className={`px-2 py-1 rounded border ${r.factCheck.score >= 0.8 ? 'bg-green-50 text-green-700 border-green-200' : r.factCheck.score >= 0.5 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
              事实 {r.factCheck.mustHit}/{r.factCheck.mustTotal}
              {r.factCheck.shouldTotal > 0 && ` (+${r.factCheck.shouldHit}/${r.factCheck.shouldTotal})`}
            </span>
          )}
          {r.factCheck?.forbiddenHit?.length > 0 && (
            <span className="px-2 py-1 rounded border bg-red-50 text-red-700 border-red-200">
              ⛔ {r.factCheck.forbiddenHit.join(', ')}
            </span>
          )}
          {r.followUpCheck && (
            <span className={`px-2 py-1 rounded border ${r.followUpCheck.score >= 0.8 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              followUp {r.followUpCheck.count}条
              {r.followUpCheck.hasQuestionMark && ' ⚠️问句'}
              {r.followUpCheck.relatedTotal > 0 && ` 域${r.followUpCheck.relatedHit}/${r.followUpCheck.relatedTotal}`}
            </span>
          )}
        </div>
      )}

      {/* ⑦ 工具对比 */}
      <div className="border-t border-gray-100 pt-2 space-y-1.5">
        <div className="flex flex-wrap gap-1 items-center">
          <span className="font-semibold text-gray-500 mr-1">期望:</span>
          {r.expectedTools.map((t: string) => (
            <span key={t} className="px-2 py-0.5 rounded bg-blue-100 text-blue-800">{t}</span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 items-center">
          <span className="font-semibold text-gray-500 mr-1">实际:</span>
          {r.actualTools.map((t: string) => (
            <span key={t} className={`px-2 py-0.5 rounded ${r.expectedTools.includes(t) ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{t}</span>
          ))}
          {r.actualTools.length === 0 && <span className="text-gray-400">(无)</span>}
        </div>
        {missing.length > 0 && <div className="text-red-600">漏选: {missing.join(', ')}</div>}
        {extra.length > 0 && <div className="text-amber-600">多选: {extra.join(', ')}</div>}
      </div>

      {/* ⑧ 执行追踪（可折叠） */}
      {r.trace?.rounds && (
        <div className="border-t border-gray-100 pt-2">
          <button onClick={() => setTraceOpen(!traceOpen)}
            className="text-xs text-gray-500 hover:text-blue-600 transition-colors flex items-center gap-1">
            <span>{traceOpen ? '▼' : '▶'}</span>
            <span>执行追踪 ({r.trace.rounds.length} 轮, {r.latencyMs}ms)</span>
          </button>
          {traceOpen && (
            <div className="mt-2 space-y-2">
              {r.trace.rounds.map((round: any, ri: number) => (
                <div key={ri} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-1.5 bg-gray-100 font-semibold text-gray-700">
                    轮次 {round.round} — {round.round === 0 ? '首轮规划' : `追查轮 ${round.round}`}
                  </div>
                  <div className="px-3 py-2 space-y-1">
                    <div>💭 <span className="font-semibold">思考:</span> {round.thought}</div>
                    {round.calls?.map((c: any, ci: number) => (
                      <div key={ci}>
                        🔧 <span className="font-semibold">{c.tool}</span>
                        <span className="text-gray-400 ml-1">({JSON.stringify(c.arguments)})</span>
                        <span className={`ml-2 ${c.status === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                          → {c.durationMs}ms {c.status === 'success' ? '✅' : '❌'}
                        </span>
                        <details className="ml-6 mt-1">
                          <summary className="text-gray-400 cursor-pointer">返回数据</summary>
                          <pre className="bg-gray-900 text-gray-200 p-2 rounded mt-1 overflow-x-auto max-h-32 text-[11px]">
                            {JSON.stringify(c.result, null, 2)}
                          </pre>
                        </details>
                      </div>
                    ))}
                    <div>👁 <span className="font-semibold">观察:</span> {round.observation}</div>
                  </div>
                </div>
              ))}
              <div className="text-gray-500 space-y-0.5">
                {r.trace.intent && <div>意图: {r.trace.intent.domains?.join('/')} / {r.trace.intent.operation}</div>}
                <div>置信度: toolMatch={r.trace.confidence?.toolMatch} verdict={r.trace.confidence?.verdictConfidence} clarity={r.trace.confidence?.queryClarity} → {r.confidence}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LessonsPanel({ lessons, loading }: { lessons: LessonItem[]; loading: boolean }) {
  const [qualityFilter, setQualityFilter] = useState<string>('all')

  if (loading) return <div className="p-8 text-center text-gray-400">加载中...</div>
  if (lessons.length === 0) return (
    <div className="p-8 text-center text-gray-400">
      暂无 Lesson 数据。运行 benchmark 或在聊天中使用后会自动积累。
    </div>
  )

  // 汇总统计
  const badCount = lessons.filter(l => l.quality === 'bad').length
  const partialCount = lessons.filter(l => l.quality === 'partial').length
  const goodCount = lessons.filter(l => l.quality === 'good').length

  // 按 intentHash 聚合
  const byIntent = new Map<string, LessonItem[]>()
  for (const l of lessons) {
    if (!byIntent.has(l.intentHash)) byIntent.set(l.intentHash, [])
    byIntent.get(l.intentHash)!.push(l)
  }

  const filtered = qualityFilter === 'all' ? lessons : lessons.filter(l => l.quality === qualityFilter)

  return (
    <div className="space-y-4">
      {/* 汇总卡片 */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-800">{lessons.length}</div>
          <div className="text-xs text-gray-500">总 Lessons</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-red-500">{badCount}</div>
          <div className="text-xs text-gray-500">Bad（选错工具）</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-amber-500">{partialCount}</div>
          <div className="text-xs text-gray-500">Partial（不完整）</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-green-500">{goodCount}</div>
          <div className="text-xs text-gray-500">Good</div>
        </div>
      </div>

      {/* 按 intent 聚合视图 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">按意图聚合（{byIntent.size} 个 intent）</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {[...byIntent.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 12).map(([hash, items]) => {
            const worst = items.some(i => i.quality === 'bad') ? 'bad' : items.some(i => i.quality === 'partial') ? 'partial' : 'good'
            return (
              <div key={hash} className={`p-2 rounded-lg border text-xs ${worst === 'bad' ? 'border-red-200 bg-red-50' : worst === 'partial' ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
                <div className="font-mono text-gray-500">{hash.slice(0, 8)}...</div>
                <div className="truncate text-gray-700 mt-0.5">{items[0].query.slice(0, 30)}</div>
                <div className="mt-1 text-gray-500">{items.length} 条 · {worst}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 筛选 */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: `全部 (${lessons.length})` },
          { key: 'bad', label: `❌ Bad (${badCount})` },
          { key: 'partial', label: `⚠️ Partial (${partialCount})` },
          { key: 'good', label: `✅ Good (${goodCount})` },
        ].map(f => (
          <button key={f.key} onClick={() => setQualityFilter(f.key)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${qualityFilter === f.key ? 'bg-blue-800 text-white border-blue-800' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lesson 列表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-gray-900">
          <thead>
            <tr className="bg-blue-800 text-white">
              <th className="px-3 py-2 text-left w-16">质量</th>
              <th className="px-3 py-2 text-left">查询</th>
              <th className="px-3 py-2 text-left">选用工具</th>
              <th className="px-3 py-2 text-left">错误原因</th>
              <th className="px-3 py-2 text-left">教训</th>
              <th className="px-3 py-2 text-left w-16">来源</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l, i) => (
              <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${l.quality === 'bad' ? 'bg-red-100 text-red-700' : l.quality === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                    {l.quality}
                  </span>
                </td>
                <td className="px-3 py-2 max-w-[200px] truncate" title={l.query}>{l.query}</td>
                <td className="px-3 py-2 text-xs">
                  <div className="flex flex-wrap gap-1">
                    {l.selectedTools.map(t => (
                      <span key={t} className="px-1.5 py-0.5 bg-gray-100 rounded">{t}</span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-gray-600 max-w-[250px]">{l.errorReason || '-'}</td>
                <td className="px-3 py-2 text-xs text-gray-600 max-w-[250px]">{l.lesson}</td>
                <td className="px-3 py-2 text-xs text-gray-400">{l.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function QualityPanel({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <div className="p-8 text-center text-gray-400">加载中...</div>
  if (!data) return (
    <div className="p-8 text-center text-gray-400">
      暂无质量评估数据。运行: <code className="bg-gray-100 px-2 py-1 rounded text-sm">LLM_BASE_URL=xxx npx tsx scripts/quality-eval.ts</code>
    </div>
  )

  const { stats, scores, runId, model, timestamp } = data

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Run: {runId} | 模型: {model} | {new Date(timestamp).toLocaleString('zh-CN')}</p>

      {/* 汇总卡片 */}
      <div className="grid grid-cols-6 gap-3">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{stats.avgOverall.toFixed(1)}</div>
          <div className="text-xs text-gray-500">综合平均</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold">{stats.avgComplete.toFixed(1)}</div>
          <div className="text-xs text-gray-500">完整性</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold">{stats.avgAccuracy.toFixed(1)}</div>
          <div className="text-xs text-gray-500">准确性</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold">{stats.avgUsability.toFixed(1)}</div>
          <div className="text-xs text-gray-500">可用性</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-500">{scores.filter((s: any) => s.qualityAvg >= 4).length}</div>
          <div className="text-xs text-gray-500">优秀(≥4)</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-red-500">{scores.filter((s: any) => s.qualityAvg < 3).length}</div>
          <div className="text-xs text-gray-500">差(&lt;3)</div>
        </div>
      </div>

      {/* 详细表格 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-gray-900">
          <thead>
            <tr className="bg-blue-800 text-white">
              <th className="px-3 py-2 text-left w-16">ID</th>
              <th className="px-3 py-2 text-left w-12">级</th>
              <th className="px-3 py-2 text-left">查询</th>
              <th className="px-3 py-2 text-center w-16">Recall</th>
              <th className="px-3 py-2 text-center w-14">完整</th>
              <th className="px-3 py-2 text-center w-14">准确</th>
              <th className="px-3 py-2 text-center w-14">可用</th>
              <th className="px-3 py-2 text-center w-14">均分</th>
              <th className="px-3 py-2 text-left">问题</th>
              <th className="px-3 py-2 text-left">建议</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s: any, i: number) => {
              const color = s.qualityAvg >= 4 ? 'text-green-700' : s.qualityAvg >= 3 ? 'text-amber-600' : 'text-red-600'
              return (
                <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                  <td className="px-3 py-2 font-mono text-xs">{s.id}</td>
                  <td className="px-3 py-2 text-xs">{s.level}</td>
                  <td className="px-3 py-2 max-w-[200px] truncate" title={s.query}>{s.query}</td>
                  <td className="px-3 py-2 text-center text-xs">{(s.recall * 100).toFixed(0)}%</td>
                  <td className="px-3 py-2 text-center">{s.completeness}</td>
                  <td className="px-3 py-2 text-center">{s.accuracy}</td>
                  <td className="px-3 py-2 text-center">{s.usability}</td>
                  <td className={`px-3 py-2 text-center font-bold ${color}`}>{s.qualityAvg}</td>
                  <td className="px-3 py-2 text-xs text-gray-600 max-w-[200px]">{s.issues}</td>
                  <td className="px-3 py-2 text-xs text-gray-600 max-w-[200px]">{s.suggestion}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
