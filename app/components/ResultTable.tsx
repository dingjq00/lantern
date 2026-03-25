interface ResultTableProps {
  columns?: string[]
  data: Record<string, unknown>[]
}

export function ResultTable({ columns, data }: ResultTableProps) {
  if (!data || data.length === 0) return null

  // 先把数据拍平：如果数据是 { pendingX: [...], pendingY: [...] } 这种嵌套结构，
  // 把所有子数组合并成一个平坦的行列表
  const rows = flattenData(data)
  if (rows.length === 0) return null

  const dataKeys = Object.keys(rows[0])

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

  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
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
                  {formatCell(row[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 把嵌套数据拍平成行列表 */
function flattenData(data: Record<string, unknown>[]): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = []

  for (const item of data) {
    // 检查是否每个 value 都是数组（嵌套结构，如 todo list）
    const values = Object.values(item)
    const allArrays = values.length > 0 && values.every(v => Array.isArray(v))

    if (allArrays) {
      // 合并所有子数组的对象
      for (const arr of values) {
        for (const row of arr as Record<string, unknown>[]) {
          if (typeof row === 'object' && row !== null && !Array.isArray(row)) {
            result.push(row)
          }
        }
      }
    } else if ('items' in item && Array.isArray(item.items)) {
      // 常见模式: { total: 128, items: [...] }
      for (const row of item.items as Record<string, unknown>[]) {
        result.push(row)
      }
    } else {
      // 已经是平坦行
      result.push(item)
    }
  }

  return result
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
