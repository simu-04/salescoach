/**
 * CalendarSettingsClient
 *
 * Glass-design card for connecting / disconnecting Google Calendar via Recall.ai.
 * Shows:
 *   - Connected state: green pill, connected date, disconnect button
 *   - Disconnected state: Google sign-in button → redirects to /api/recall/oauth/start
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  isConnected:    boolean
  connectedAt:    string | null
  provider:       string | null
  flashConnected: boolean
  flashError:     string | null
}

export function CalendarSettingsClient({
  isConnected,
  connectedAt,
  flashConnected,
  flashError,
}: Props) {
  const router = useRouter()
  const [disconnecting, setDisconnecting] = useState(false)
  const [localConnected, setLocalConnected] = useState(isConnected)
  const [error, setError] = useState<string | null>(flashError)
  const [success, setSuccess] = useState(flashConnected)

  async function handleDisconnect() {
    if (!confirm('Stop recording your Google Calendar meetings?')) return
    setDisconnecting(true)
    setError(null)

    const res = await fetch('/api/recall/calendar', { method: 'DELETE' })

    if (res.ok) {
      setLocalConnected(false)
      setSuccess(false)
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({ error: 'Unknown error' }))
      setError(data.error ?? 'Failed to disconnect')
    }

    setDisconnecting(false)
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <a
          href="/settings"
          className="text-sm flex items-center gap-1.5 mb-4 transition-colors"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Settings
        </a>
        <h1 className="text-2xl font-bold text-white tracking-tight">Calendar Integration</h1>
        <p className="mt-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Connect your Google Calendar and every sales meeting gets recorded and analysed automatically.
        </p>
      </div>

      {/* Flash messages */}
      {success && (
        <div
          className="mb-6 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2"
          style={{
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.25)',
            color: '#4ade80',
          }}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Google Calendar connected. Bots will join your meetings automatically.
        </div>
      )}

      {error && (
        <div
          className="mb-6 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#f87171',
          }}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Main card */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: 'rgba(13,13,26,0.95)',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        {/* Card header: Google Calendar icon + title */}
        <div className="flex items-start gap-4 mb-6">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {/* Google Calendar SVG icon */}
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="17" rx="2" stroke="#4ade80" strokeWidth="1.5"/>
              <path d="M3 9h18" stroke="#4ade80" strokeWidth="1.5"/>
              <path d="M8 2v4M16 2v4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round"/>
              <rect x="7" y="13" width="3" height="3" rx="0.5" fill="#4ade80" opacity="0.7"/>
              <rect x="14" y="13" width="3" height="3" rx="0.5" fill="#4ade80" opacity="0.4"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold text-white">Google Calendar</h2>
              {localConnected ? (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(34,197,94,0.12)',
                    border: '1px solid rgba(34,197,94,0.25)',
                    color: '#4ade80',
                  }}
                >
                  Connected
                </span>
              ) : (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.35)',
                  }}
                >
                  Not connected
                </span>
              )}
            </div>
            <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {localConnected && connectedAt
                ? `Connected ${formatDistanceToNow(new Date(connectedAt), { addSuffix: true })}`
                : 'Recall.ai joins as a bot and records every meeting with a video link.'}
            </p>
          </div>
        </div>

        {/* How it works */}
        {!localConnected && (
          <div
            className="rounded-xl p-4 mb-6"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              How it works
            </p>
            <div className="space-y-2.5">
              {[
                ['📅', 'You connect Google Calendar with read access'],
                ['🤖', 'Recall.ai joins your meetings as a silent bot'],
                ['🎙️', 'Recording ends → audio sent to Deepgram automatically'],
                ['🧠', 'Claude extracts verdict, objections, and recommendations'],
                ['📊', 'Insight appears on your dashboard within minutes'],
              ].map(([icon, text]) => (
                <div key={text} className="flex items-start gap-2.5">
                  <span className="text-sm mt-0.5">{icon}</span>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action */}
        {localConnected ? (
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Recall will auto-join all meetings that have a video link (Zoom, Meet, Teams).
            </p>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="ml-4 shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#f87171',
              }}
              onMouseEnter={e => !disconnecting && (e.currentTarget.style.background = 'rgba(239,68,68,0.14)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        ) : (
          <a
            href="/api/recall/oauth/start"
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-semibold text-sm text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)',
              boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 28px rgba(99,102,241,0.5)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.35)')}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Connect Google Calendar
          </a>
        )}
      </div>

      {/* Powered by note */}
      <p className="mt-4 text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
        Recording powered by{' '}
        <a
          href="https://recall.ai"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
        >
          Recall.ai
        </a>
      </p>
    </div>
  )
}
