'use client'
import { useState, useEffect } from 'react'

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
  }
  results: Array<{
    id: string; query: string; level: string; success: boolean
    actualTools: string[]; expectedTools: string[]; recall: number; precision: number
    rounds: number; latencyMs: number; confidence: string; hasSources: boolean; answer: string
    trace?: any
  }>
}

export default function BenchmarkDashboard() {
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null)
  const [compareRun, setCompareRun] = useState<RunDetail | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/benchmark/runs').then(r => r.json()).then(data => { setRuns(data); setLoading(false) })
  }, [])

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
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">Benchmark Dashboard</h1>
            <p className="text-sm text-gray-500">实验追踪 · 历史对比 · 逐题分析</p>
          </div>
          {selectedRun && (
            <button onClick={() => { setSelectedRun(null); setCompareRun(null); setCompareMode(false) }}
              className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              ← 返回列表
            </button>
          )}
        </div>

        {/* 运行列表 */}
        {!selectedRun && (
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
              <table className="w-full text-sm">
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
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => { setCompareMode(true); loadRun(run.runId, true) }}
                          className="text-xs text-blue-600 hover:text-blue-800">对比</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 运行详情 */}
        {selectedRun && (
          <>
            {/* 概览卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
              {[
                { label: 'Recall', value: `${(selectedRun.summary.recall * 100).toFixed(1)}%`, color: selectedRun.summary.recall >= 0.9 ? '#22C55E' : '#F59E0B' },
                { label: 'Precision', value: `${(selectedRun.summary.precision * 100).toFixed(1)}%`, color: '#4472C4' },
                { label: '完美召回', value: `${selectedRun.summary.perfectCount}/${selectedRun.summary.total}`, color: '#4472C4' },
                { label: 'Sources', value: `${(selectedRun.summary.sourcesCoverage * 100).toFixed(0)}%`, color: '#22C55E' },
                { label: 'P50 延迟', value: `${(selectedRun.summary.latencyP50 / 1000).toFixed(1)}s`, color: '#666' },
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
              <table className="w-full text-sm">
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
  const missing = r.expectedTools.filter((t: string) => !r.actualTools.includes(t))
  const extra = r.actualTools.filter((t: string) => !r.expectedTools.includes(t))

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
          <td colSpan={cr !== undefined ? 8 : 7} className="px-4 py-4 bg-gray-50">
            <div className="space-y-3 text-xs">
              {/* 回答 */}
              <div><span className="font-semibold">回答:</span> {r.answer?.slice(0, 200)}</div>

              {/* 工具对比 */}
              <div className="flex flex-wrap gap-1">
                <span className="font-semibold mr-1">期望:</span>
                {r.expectedTools.map((t: string) => (
                  <span key={t} className="px-2 py-0.5 rounded bg-blue-100 text-blue-800">{t}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="font-semibold mr-1">实际:</span>
                {r.actualTools.map((t: string) => (
                  <span key={t} className={`px-2 py-0.5 rounded ${r.expectedTools.includes(t) ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{t}</span>
                ))}
                {r.actualTools.length === 0 && <span className="text-gray-400">(无)</span>}
              </div>
              {missing.length > 0 && (
                <div className="text-red-600">漏选: {missing.join(', ')}</div>
              )}
              {extra.length > 0 && (
                <div className="text-amber-600">多选: {extra.join(', ')}</div>
              )}

              {/* Trace */}
              {r.trace?.rounds && (
                <div className="mt-2 space-y-2">
                  <div className="font-semibold">执行追踪:</div>
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
                              <pre className="bg-gray-900 text-gray-200 p-2 rounded mt-1 overflow-x-auto max-h-40">
                                {JSON.stringify(c.result, null, 2)}
                              </pre>
                            </details>
                          </div>
                        ))}
                        <div>👁 <span className="font-semibold">观察:</span> {round.observation}</div>
                      </div>
                    </div>
                  ))}
                  {/* 元信息 */}
                  <div className="text-gray-500 space-y-0.5">
                    {r.trace.intent && <div>意图: {r.trace.intent.domains?.join('/')} / {r.trace.intent.operation}</div>}
                    <div>置信度: {r.confidence}</div>
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
