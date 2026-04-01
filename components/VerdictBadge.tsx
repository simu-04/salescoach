/**
 * VerdictBadge — glowing neon verdict pill.
 * One glance = manager knows if this deal needs attention.
 */
import type { Verdict } from '@/types'

interface VerdictBadgeProps {
  verdict:  Verdict | null
  size?:    'sm' | 'md' | 'lg'
  showDot?: boolean
}

const VERDICT_CONFIG = {
  won: {
    label:  'Won',
    style: {
      background:  'rgba(34,197,94,0.12)',
      color:       '#4ade80',
      border:      '1px solid rgba(34,197,94,0.35)',
      boxShadow:   '0 0 12px rgba(34,197,94,0.2), inset 0 1px 0 rgba(34,197,94,0.1)',
    },
    dot: '#4ade80',
  },
  at_risk: {
    label:  'At Risk',
    style: {
      background:  'rgba(251,191,36,0.1)',
      color:       '#fbbf24',
      border:      '1px solid rgba(251,191,36,0.35)',
      boxShadow:   '0 0 12px rgba(251,191,36,0.2), inset 0 1px 0 rgba(251,191,36,0.1)',
    },
    dot: '#fbbf24',
  },
  lost: {
    label:  'Lost',
    style: {
      background:  'rgba(239,68,68,0.1)',
      color:       '#f87171',
      border:      '1px solid rgba(239,68,68,0.35)',
      boxShadow:   '0 0 12px rgba(239,68,68,0.2), inset 0 1px 0 rgba(239,68,68,0.1)',
    },
    dot: '#f87171',
  },
}

const SIZE_CLASSES = {
  sm: 'text-[10px] px-2.5 py-1 gap-1.5',
  md: 'text-xs px-3 py-1.5 gap-1.5',
  lg: 'text-sm px-3.5 py-2 gap-2',
}

export function VerdictBadge({ verdict, size = 'md', showDot = true }: VerdictBadgeProps) {
  if (!verdict) {
    return (
      <span
        className={`inline-flex items-center rounded-full font-semibold uppercase tracking-wide ${SIZE_CLASSES[size]}`}
        style={{
          background: 'rgba(99,102,241,0.1)',
          color:      'rgba(165,180,252,0.8)',
          border:     '1px solid rgba(99,102,241,0.25)',
          boxShadow:  '0 0 12px rgba(99,102,241,0.1)',
        }}
      >
        {showDot && (
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
            style={{ background: '#818cf8' }}
          />
        )}
        Processing
      </span>
    )
  }

  const config = VERDICT_CONFIG[verdict]

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wider ${SIZE_CLASSES[size]}`}
      style={config.style}
    >
      {showDot && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: config.dot, boxShadow: `0 0 6px ${config.dot}` }}
        />
      )}
      {config.label}
    </span>
  )
}
