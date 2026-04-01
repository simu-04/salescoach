/**
 * StatsBar — neon glass stat cards. One number per thing that matters.
 */
import type { DashboardStats } from '@/types'

interface StatsBarProps {
  stats: DashboardStats
}

interface StatItemProps {
  label:      string
  value:      string | number
  subtext?:   string
  highlight?: 'normal' | 'warning' | 'danger' | 'success'
  icon?:      React.ReactNode
}

function StatCard({ label, value, subtext, highlight = 'normal', icon }: StatItemProps) {
  const valueStyle = {
    normal:  { color: '#ffffff' },
    success: { color: '#4ade80', textShadow: '0 0 20px rgba(74,222,128,0.4)' },
    warning: { color: '#fbbf24', textShadow: '0 0 20px rgba(251,191,36,0.4)' },
    danger:  { color: '#f87171', textShadow: '0 0 20px rgba(248,113,113,0.4)' },
  }[highlight]

  const borderStyle = {
    normal:  'rgba(255,255,255,0.07)',
    success: 'rgba(74,222,128,0.2)',
    warning: 'rgba(251,191,36,0.2)',
    danger:  'rgba(248,113,113,0.2)',
  }[highlight]

  const bgGlow = {
    normal:  'transparent',
    success: 'rgba(74,222,128,0.04)',
    warning: 'rgba(251,191,36,0.04)',
    danger:  'rgba(248,113,113,0.04)',
  }[highlight]

  return (
    <div
      className="flex flex-col gap-1.5 p-4 rounded-2xl transition-all duration-200"
      style={{
        background: `linear-gradient(135deg, rgba(13,13,26,0.98) 0%, ${bgGlow} 100%)`,
        border: `1px solid ${borderStyle}`,
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center gap-2">
        {icon && <span style={{ color: 'rgba(255,255,255,0.3)' }}>{icon}</span>}
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          {label}
        </p>
      </div>
      <p className="text-3xl font-bold tabular-nums leading-none" style={valueStyle}>
        {value}
      </p>
      {subtext && (
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {subtext}
        </p>
      )}
    </div>
  )
}

export function StatsBar({ stats }: StatsBarProps) {
  const repRatioHighlight = stats.avg_rep_talk_ratio > 60 ? 'warning' : 'normal'
  const winRateHighlight  = stats.win_rate < 30 ? 'danger' : stats.win_rate >= 60 ? 'success' : 'normal'

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <StatCard
        label="Total Calls"
        value={stats.total_calls}
        subtext={`${stats.complete_calls} analyzed`}
        icon={
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
          </svg>
        }
      />
      <StatCard
        label="Win Rate"
        value={`${stats.win_rate}%`}
        subtext="of analyzed calls"
        highlight={winRateHighlight}
        icon={
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        }
      />
      <StatCard
        label="At Risk"
        value={stats.at_risk_count}
        subtext="need attention"
        highlight={stats.at_risk_count > 0 ? 'warning' : 'normal'}
        icon={
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        }
      />
      <StatCard
        label="Lost"
        value={stats.lost_count}
        highlight={stats.lost_count > 0 ? 'danger' : 'normal'}
        icon={
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
      <StatCard
        label="Avg Rep Talk"
        value={`${stats.avg_rep_talk_ratio}%`}
        subtext="ideal: 40–50%"
        highlight={repRatioHighlight}
        icon={
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        }
      />
    </div>
  )
}
