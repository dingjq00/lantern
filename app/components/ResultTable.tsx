interface ResultTableProps {
  columns?: string[]
  data: Record<string, unknown>[]
}

export function ResultTable({ columns, data }: ResultTableProps) {
  if (!data || data.length === 0) return null

  // 如果没给 columns，从第一条数据推断
  const cols = columns || Object.keys(data[0])

  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-blue-600 text-white">
            {cols.map(col => (
              <th key={col} className="px-3 py-2 text-left font-medium">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {cols.map(col => (
                <td key={col} className="px-3 py-2 border-t border-gray-100">
                  {String(row[col] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
