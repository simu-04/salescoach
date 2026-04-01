/**
 * CallCard — glass card with 3D hover lift + verdict glow accent.
 */
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { VerdictBadge } from '@/components/VerdictBadge'
import { TalkRatioBar } from '@/components/TalkRatioBar'
import type { CallRow } from '@/types'

interface CallCardProps {
  call:               CallRow
  talkRatio?:         { rep: number; prospect: number }
  topRecommendation?: string
  currentUserId:      string
  currentUserRole:    'admin' | 'rep' | 'pending'
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const VERDICT_ACCENT: Record<string, { left: string; glow: string; hover: string }> = {
  won:     { left: 'rgba(34,197,94,0.7)',   glow: '0 8px 32px rgba(34,197,94,0.12)',   hover: 'rgba(34,197,94,0.15)' },
  at_risk: { left: 'rgba(251,191,36,0.7)',  glow: '0 8px 32px rgba(251,191,36,0.12)',  hover: 'rgba(251,191,36,0.1)' },
  lost:    { left: 'rgba(239,68,68,0.7)',   glow: '0 8px 32px rgba(239,68,68,0.12)',   hover: 'rgba(239,68,68,0.08)' },
  null:    { left: 'rgba(99,102,241,0.5)',  glow: '0 8px 32px rgba(99,102,241,0.1)',   hover: 'rgba(99,102,241,0.08)' },
}

export function CallCard({ call, talkRatio, topRecommendation, currentUserId, currentUserRole }: CallCardProps) {
  const [deleting, setDeleting]   = useState(false)
  const [hovered, setHovered]     = useState(false)
  const router = useRouter()

  const isProcessing = call.status === 'processing'
  const isFailed     = call.status === 'failed'
  const canDelete    = currentUserRole === 'admin' || call.user_id === currentUserId

  const accent = VERDICT_ACCENT[call.verdict ?? 'null'] ?? VERDICT_ACCENT['null']

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${call.file_name}"? This cannot be undone.`)) return
    setDeleting(true)
    const res = await fetch(`/api/calls/${call.id}`, { method: 'DELETE' })
    if (res.ok) {
      router.refresh()
    } else {
      const d = await res.json()
      alert(d.error || 'Failed to delete call')
      setDeleting(false)
    }
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: hovered
          ? `linear-gradient(135deg, rgba(13,13,26,0.98) 0%, ${accent.hover} 100%)`
          : 'rgba(13,13,26,0.95)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderLeft: `3px solid ${accent.left}`,
        boxShadow: hovered
          ? `${accent.glow}, 0 16px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)`
          : '0 2px 8px rgba(0,0,0,0.3)',
        transform: hovered ? 'translateY(-2px) scale(1.002)' : 'translateY(0) scale(1)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <Link href={`/calls/${call.id}`} className="block p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left: file info + verdict */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <VerdictBadge verdict={call.verdict} size="sm" />
              <h3 className="text-sm font-semibold text-white truncate">
                {call.file_name}
              </h3>
            </div>

            {/* Rep name for admins */}
            {call.rep_name && currentUserRole === 'admin' && (
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                by <span style={{ color: 'rgba(255,255,255,0.5)' }}>{call.rep_name}</span>
              </p>
            )}

            {/* Status / verdict reason */}
            <div className="mt-2">
              {isProcessing && (
                <p className="text-sm flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  Analyzing call...
                </p>
              )}
              {isFailed && (
                <p className="text-sm text-red-400">
                  Processing failed. {call.error_message ?? ''}
                </p>
              )}
              {call.status === 'complete' && call.verdict_reason && (
                <p className="text-sm line-clamp-1" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {call.verdict_reason}
                </p>
              )}
            </div>

            {/* Top recommendation */}
            {topRecommendation && call.status === 'complete' && call.verdict !== 'won' && (
              <div className="mt-2 flex items-start gap-1.5">
                <span className="text-amber-400 text-xs mt-0.5 flex-shrink-0">→</span>
                <p className="text-xs line-clamp-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {topRecommendation}
                </p>
              </div>
            )}
          </div>

          {/* Right: metadata + delete */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
              </p>
              {canDelete && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  title="Delete call"
                  className="opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                  style={{ color: 'rgba(255,255,255,0.2)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(239,68,68,0.8)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                >
                  {deleting ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {call.duration_seconds && <span>{formatDuration(call.duration_seconds)}</span>}
              {call.file_size        && <span>{formatFileSize(call.file_size)}</span>}
            </div>
          </div>
        </div>

        {/* Talk ratio */}
        {talkRatio && call.status === 'complete' && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <TalkRatioBar repRatio={talkRatio.rep} prospectRatio={talkRatio.prospect} />
          </div>
        )}
      </Link>
    </div>
  )
}
