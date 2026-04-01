/**
 * StatsBar — top-level dashboard metrics.
 * One number per thing that matters. No decoration.
 */
import type { DashboardStats } from '@/types'

interface StatsBarProps {
  stats: DashboardStats
}

interface StatItemProps {
  label: string
  value: string | number
  subtext?: string
  highlight?: 'normal' | 'warning' | 'danger'
}

function StatItem({ label, value, subtext, highlight = 'normal' }: StatItemProps) {
  const valueClass = {
    normal: 'text-white',
    warning: 'text-amber-400',
    danger: 'text-red-400',
  }[highlight]

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
    </div>
  )
}

export function StatsBar({ stats }: StatsBarProps) {
  const repRatioHighlight =
    stats.avg_rep_talk_ratio > 60 ? 'warning' : 'normal'

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
      {/* Each stat in its own cell */}
      <div className="bg-slate-900 p-4">
        <StatItem
          label="Total Calls"
          value={stats.total_calls}
          subtext={`${stats.complete_calls} analyzed`}
        />
      </div>
      <div className="bg-slate-900 p-4">
        <StatItem
          label="Win Rate"
          value={`${stats.win_rate}%`}
          subtext="of analyzed calls"
          highlight={stats.win_rate < 30 ? 'danger' : 'normal'}
        />
      </div>
      <div className="bg-slate-900 p-4">
        <StatItem
          label="At Risk"
          value={stats.at_risk_count}
          subtext="need attention"
          highlight={stats.at_risk_count > 0 ? 'warning' : 'normal'}
        />
      </div>
      <div className="bg-slate-900 p-4">
        <StatItem
          label="Lost"
          value={stats.lost_count}
          highlight={stats.lost_count > 0 ? 'danger' : 'normal'}
        />
      </div>
      <div className="bg-slate-900 p-4">
        <StatItem
          label="Avg Rep Talk"
          value={`${stats.avg_rep_talk_ratio}%`}
          subtext="ideal: 40–50%"
          highlight={repRatioHighlight}
        />
      </div>
    </div>
  )
}
