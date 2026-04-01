/**
 * CallCard — one row in the dashboard call list.
 * Includes delete button for call owners and admins.
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

export function CallCard({ call, talkRatio, topRecommendation, currentUserId, currentUserRole }: CallCardProps) {
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const isProcessing = call.status === 'processing'
  const isFailed     = call.status === 'failed'
  const canDelete    = currentUserRole === 'admin' || call.user_id === currentUserId

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
    <div className="group bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all duration-150">
      <Link href={`/calls/${call.id}`} className="block">
        <div className="flex items-start justify-between gap-4">
          {/* Left: file info + verdict */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <VerdictBadge verdict={call.verdict} size="sm" />
              <h3 className="text-sm font-medium text-white truncate">
                {call.file_name}
              </h3>
            </div>

            {/* Rep name (for admins seeing all org calls) */}
            {call.rep_name && currentUserRole === 'admin' && (
              <p className="text-xs text-slate-500 mt-1">
                by <span className="text-slate-400">{call.rep_name}</span>
              </p>
            )}

            {/* Status / verdict reason */}
            <div className="mt-2">
              {isProcessing && (
                <p className="text-sm text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  Analyzing call...
                </p>
              )}
              {isFailed && (
                <p className="text-sm text-red-400">
                  Processing failed. {call.error_message ?? ''}
                </p>
              )}
              {call.status === 'complete' && call.verdict_reason && (
                <p className="text-sm text-slate-300 line-clamp-1">
                  {call.verdict_reason}
                </p>
              )}
            </div>

            {/* Top recommendation */}
            {topRecommendation && call.status === 'complete' && call.verdict !== 'won' && (
              <div className="mt-2 flex items-start gap-1.5">
                <span className="text-amber-400 text-xs mt-0.5">→</span>
                <p className="text-xs text-slate-400 line-clamp-1">{topRecommendation}</p>
              </div>
            )}
          </div>

          {/* Right: metadata + delete */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-500">
                {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
              </p>
              {canDelete && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  title="Delete call"
                  className="opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-400 transition-all disabled:opacity-50"
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
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {call.duration_seconds && <span>{formatDuration(call.duration_seconds)}</span>}
              {call.file_size        && <span>{formatFileSize(call.file_size)}</span>}
            </div>
          </div>
        </div>

        {/* Talk ratio */}
        {talkRatio && call.status === 'complete' && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <TalkRatioBar repRatio={talkRatio.rep} prospectRatio={talkRatio.prospect} />
          </div>
        )}
      </Link>
    </div>
  )
}
