import { flattenMcpData, formatCellValue, buildMetaSummary } from '@/lib/ui/data-flatten'

interface ResultTableProps {
  columns?: string[]
  data: Record<string, unknown>[]
}

export function ResultTable({ columns, data }: ResultTableProps) {
  if (!data || data.length === 0) return null

  const { rows, meta } = flattenMcpData(data)
  if (rows.length === 0) return null

  // 用所有行的 key 并集作为列（处理多工具返回不同列的情况）
  const keySet = new Set<string>()
  for (const row of rows) for (const k of Object.keys(row)) keySet.add(k)
  const dataKeys = [...keySet]

  let keys: string[]
  let headers: string[]

  if (columns && columns.length > 0 && columns.every(c => c in rows[0])) {
    keys = columns
    headers = columns
  } else if (columns && columns.length === dataKeys.length) {
    keys = dataKeys
    headers = columns
  } else {
    keys = dataKeys
    headers = dataKeys
  }

  const metaSummary = buildMetaSummary(meta)

  return (
    <div className="mt-3">
      {/* 元数据摘要 */}
      {metaSummary && (
        <div className="text-xs text-gray-500 mb-1.5 px-1">{metaSummary}</div>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm text-gray-900">
          <thead>
            <tr className="bg-blue-600 text-white">
              {headers.map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {keys.map((key, j) => (
                  <td key={j} className="px-3 py-2 border-t border-gray-100">
                    {formatCellValue(row[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
