interface ConfidenceHintProps {
  confidence: 'high' | 'medium' | 'low'
}

export function ConfidenceHint({ confidence }: ConfidenceHintProps) {
  if (confidence === 'high') return null

  if (confidence === 'medium') {
    return (
      <div className="mt-2 px-3 py-1.5 bg-blue-50 text-blue-600 text-xs rounded-md">
        以上是根据您的描述匹配的结果，如需调整请补充细节
      </div>
    )
  }

  return (
    <div className="mt-2 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs rounded-md">
      请补充更多细节，帮助我为您精确定位信息
    </div>
  )
}
