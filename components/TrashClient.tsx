'use client'
/**
 * TrashClient — lists deleted calls with restore + permanent delete.
 * Admin-only component.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import type { CallRow } from '@/types'

export function TrashClient({ calls: initial }: { calls: CallRow[] }) {
  const [calls, setCalls]   = useState(initial)
  const [busy, setBusy]     = useState<string | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const router = useRouter()

  async function restore(id: string) {
    setBusy(id + 'restore'); setError(null)
    const res = await fetch(`/api/calls/${id}/restore`, { method: 'POST' })
    if (res.ok) {
      setCalls(prev => prev.filter(c => c.id !== id))
      router.refresh()
    } else {
      const d = await res.json()
      setError(d.error || 'Failed to restore')
    }
    setBusy(null)
  }

  async function purge(id: string, name: string) {
    if (!confirm(`Permanently delete "${name}"? This cannot be undone.`)) return
    setBusy(id + 'purge'); setError(null)
    const res = await fetch(`/api/calls/${id}/purge`, { method: 'DELETE' })
    if (res.ok) {
      setCalls(prev => prev.filter(c => c.id !== id))
    } else {
      const d = await res.json()
      setError(d.error || 'Failed to delete')
    }
    setBusy(null)
  }

  async function purgeAll() {
    if (!confirm(`Permanently delete all ${calls.length} trashed calls? This cannot be undone.`)) return
    setBusy('all'); setError(null)
    await Promise.all(calls.map(c =>
      fetch(`/api/calls/${c.id}/purge`, { method: 'DELETE' })
    ))
    setCalls([])
    setBusy(null)
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {calls.length === 0 ? (
        <div className="py-20 text-center rounded-2xl"
          style={{ border: '1px dashed var(--border-mid)', background: 'var(--bg-surface)' }}>
          <div className="text-3xl mb-3">🗑️</div>
          <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>Trash is empty</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>Deleted calls appear here</p>
        </div>
      ) : (
        <>
          {/* Empty all button */}
          <div className="flex justify-end">
            <button
              onClick={purgeAll}
              disabled={busy === 'all'}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
              style={{ color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)' }}
            >
              {busy === 'all' ? 'Deleting…' : `Empty trash (${calls.length})`}
            </button>
          </div>

          {/* Call list */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}
          >
            {calls.map((call, i) => {
              const deletedAt = call.deleted_at
                ? formatDistanceToNow(new Date(call.deleted_at), { addSuffix: true })
                : 'Unknown'
              const isBusy = busy === call.id + 'restore' || busy === call.id + 'purge'

              return (
                <div
                  key={call.id}
                  className="flex items-center gap-4 px-5 py-4"
                  style={i < calls.length - 1 ? { borderBottom: '1px solid var(--border-subtle)' } : {}}
                >
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <svg className="w-4 h-4" style={{ color: '#f87171' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {call.file_name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Deleted {deletedAt}
                      {call.rep_name && <> · by {call.rep_name}</>}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => restore(call.id)}
                      disabled={isBusy}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                      style={{
                        background: 'var(--tag-bg)',
                        border:     '1px solid var(--border-mid)',
                        color:      'var(--text-secondary)',
                      }}
                    >
                      {busy === call.id + 'restore' ? '…' : 'Restore'}
                    </button>
                    <button
                      onClick={() => purge(call.id, call.file_name)}
                      disabled={isBusy}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                      style={{ color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)' }}
                    >
                      {busy === call.id + 'purge' ? '…' : 'Delete forever'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
