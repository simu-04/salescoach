/**
 * TalkRatioBar — visual representation of rep vs prospect talk time.
 * Ideal rep ratio: 40-50%. If rep is at 70%+, it's a coaching signal.
 */
interface TalkRatioBarProps {
  repRatio: number      // 0-100
  prospectRatio: number // 0-100
  showLabel?: boolean
}

export function TalkRatioBar({ repRatio, prospectRatio, showLabel = true }: TalkRatioBarProps) {
  // Flag if rep is talking too much — visual warning for managers
  const repTooHigh = repRatio > 60

  return (
    <div className="space-y-1.5">
      {showLabel && (
        <div className="flex justify-between text-xs text-slate-400">
          <span className={repTooHigh ? 'text-amber-400 font-medium' : ''}>
            Rep {repRatio}%{repTooHigh ? ' ⚠' : ''}
          </span>
          <span>Prospect {prospectRatio}%</span>
        </div>
      )}
      <div className="flex h-2 rounded-full overflow-hidden bg-slate-800">
        <div
          className={`h-full transition-all ${repTooHigh ? 'bg-amber-500' : 'bg-blue-500'}`}
          style={{ width: `${repRatio}%` }}
        />
        <div
          className="h-full bg-slate-600 flex-1"
        />
      </div>
    </div>
  )
}
