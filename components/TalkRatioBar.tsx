/**
 * TalkRatioBar — gradient progress bar with glow accent.
 * Ideal rep ratio: 40-50%. If rep is at 60%+, amber warning kicks in.
 */
interface TalkRatioBarProps {
  repRatio:      number  // 0-100
  prospectRatio: number  // 0-100
  showLabel?:    boolean
}

export function TalkRatioBar({ repRatio, prospectRatio, showLabel = true }: TalkRatioBarProps) {
  const repTooHigh = repRatio > 60

  const repColor  = repTooHigh
    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
    : 'linear-gradient(90deg, #6366f1, #0ea5e9)'

  const repGlow = repTooHigh
    ? '0 0 10px rgba(251,191,36,0.5)'
    : '0 0 10px rgba(99,102,241,0.5)'

  return (
    <div className="space-y-2">
      {showLabel && (
        <div className="flex justify-between text-xs">
          <span
            className="font-medium"
            style={{ color: repTooHigh ? '#fbbf24' : 'rgba(255,255,255,0.5)' }}
          >
            Rep {repRatio}%{repTooHigh ? ' ⚠' : ''}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.35)' }}>
            Prospect {prospectRatio}%
          </span>
        </div>
      )}
      <div
        className="flex h-1.5 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width:      `${repRatio}%`,
            background: repColor,
            boxShadow:  repGlow,
          }}
        />
      </div>
    </div>
  )
}
