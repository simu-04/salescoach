'use client'

/**
 * ConfirmModal — glass-design confirmation dialog.
 * Replaces browser window.confirm() for delete and destructive actions.
 */
import { useEffect } from 'react'

interface ConfirmModalProps {
  open:          boolean
  title:         string
  message:       string
  confirmLabel?: string
  loading?:      boolean
  onConfirm:     () => void
  onCancel:      () => void
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-sm rounded-2xl p-6"
        style={{
          background: 'rgba(18,18,30,0.97)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {/* Icon */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.25)',
          }}
        >
          <svg className="w-5 h-5" style={{ color: '#f87171' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>

        <h2 id="modal-title" className="text-white font-bold text-lg mb-2 tracking-tight">
          {title}
        </h2>
        <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.65)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 text-white flex items-center gap-2"
            style={{
              background: 'rgba(239,68,68,0.85)',
              border: '1px solid rgba(239,68,68,0.4)',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(239,68,68,0.3)',
            }}
          >
            {loading && (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
            {loading ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
