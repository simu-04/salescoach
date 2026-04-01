/**
 * VerdictBadge — the most important visual in the product.
 * One glance = manager knows if this deal needs attention.
 */
import type { Verdict } from '@/types'

interface VerdictBadgeProps {
  verdict: Verdict | null
  size?: 'sm' | 'md' | 'lg'
  showDot?: boolean
}

const VERDICT_CONFIG = {
  won: {
    label: 'Won',
    bg: 'bg-green-900/40',
    text: 'text-green-400',
    border: 'border-green-800',
    dot: 'bg-green-400',
  },
  at_risk: {
    label: 'At Risk',
    bg: 'bg-amber-900/40',
    text: 'text-amber-400',
    border: 'border-amber-800',
    dot: 'bg-amber-400',
  },
  lost: {
    label: 'Lost',
    bg: 'bg-red-900/40',
    text: 'text-red-400',
    border: 'border-red-800',
    dot: 'bg-red-400',
  },
}

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
}

export function VerdictBadge({ verdict, size = 'md', showDot = true }: VerdictBadgeProps) {
  if (!verdict) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 text-slate-400 font-medium ${SIZE_CLASSES[size]}`}>
        {showDot && <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />}
        Processing
      </span>
    )
  }

  const config = VERDICT_CONFIG[verdict]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide uppercase ${config.bg} ${config.text} ${config.border} ${SIZE_CLASSES[size]}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />}
      {config.label}
    </span>
  )
}
