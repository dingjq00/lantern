interface ConfidenceHintProps {
  confidence: 'high' | 'medium' | 'low'
}

export function ConfidenceHint({ confidence }: ConfidenceHintProps) {
  if (confidence === 'high') return null

  if (confidence === 'medium') {
    return (
      <div className="mt-2 px-3 py-1.5 bg-blue-50 text-blue-600 text-xs rounded-md">
        这是我的理解，如果不对请换个方式描述
      </div>
    )
  }

  return (
    <div className="mt-2 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs rounded-md">
      我不太确定您的问题，请选择或重新描述
    </div>
  )
}
