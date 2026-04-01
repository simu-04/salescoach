/**
 * CalendarSettingsClient
 *
 * Two-panel settings page:
 *   - Supported platforms bar (Zoom / Google Meet / Teams / Webex / Slack)
 *   - Google Calendar connection card
 *   - Microsoft 365 Calendar connection card
 *
 * Connects via Google or Microsoft OAuth → tokens sent to Recall →
 * Recall auto-schedules bots for any meeting with a video link.
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import type { CalendarConnection } from './page'

interface Props {
  connections:    CalendarConnection[]
  flashConnected: string | null   // "google" | "microsoft" | null
  flashError:     string | null
}

// ─── Platform badges ──────────────────────────────────────────────────────────

const PLATFORMS = [
  {
    name: 'Zoom',
    color: '#2D8CFF',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.5 12.55V9.45a.45.45 0 00-.714-.364L12 11.166V9.45A1.45 1.45 0 0010.55 8h-5.1A1.45 1.45 0 004 9.45v5.1A1.45 1.45 0 005.45 16h5.1a1.45 1.45 0 001.45-1.45v-1.716l2.786 2.08A.45.45 0 0015.5 14.55v-2z"/>
      </svg>
    ),
  },
  {
    name: 'Google Meet',
    color: '#00AC47',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.5 6.75h-1.875V5.25A2.25 2.25 0 0015.375 3H4.5A2.25 2.25 0 002.25 5.25v13.5A2.25 2.25 0 004.5 21h10.875a2.25 2.25 0 002.25-2.25v-1.5H19.5A2.25 2.25 0 0021.75 15V9A2.25 2.25 0 0019.5 6.75zm0 8.25H17.25V9H19.5v6zm-4.125 3.75H4.5V5.25h10.875v13.5z"/>
      </svg>
    ),
  },
  {
    name: 'Teams',
    color: '#5059C9',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.25 7.5a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5zM14.25 8.25a2.625 2.625 0 100-5.25 2.625 2.625 0 000 5.25zM21.75 9h-3a1.5 1.5 0 00-1.5 1.5v4.5a3 3 0 002.764 2.986A3.75 3.75 0 0023.25 13.5V10.5A1.5 1.5 0 0021.75 9zM14.25 9.75H8.25A2.25 2.25 0 006 12v5.25a4.5 4.5 0 009 0V12a2.25 2.25 0 00-2.25-2.25h1.5z"/>
      </svg>
    ),
  },
  {
    name: 'Webex',
    color: '#00BCEB',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm4.5 13.5l-5-3V7h1.5v4.5l4 2.4-1.5 1.6z" opacity=".9"/>
      </svg>
    ),
  },
  {
    name: 'Slack',
    color: '#E01E5A',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.958 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.52 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zM15.165 18.958a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.52v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z"/>
      </svg>
    ),
  },
]

// ─── Calendar provider card ───────────────────────────────────────────────────

function CalendarCard({
  providerKey,
  label,
  description,
  oauthHref,
  googleIcon,
  connection,
  onDisconnect,
  disconnecting,
}: {
  providerKey:   'google' | 'microsoft'
  label:         string
  description:   string
  oauthHref:     string
  googleIcon:    React.ReactNode
  connection:    CalendarConnection | undefined
  onDisconnect:  (provider: 'google' | 'microsoft') => void
  disconnecting: 'google' | 'microsoft' | null
}) {
  const isConnected = !!connection
  const isLoading   = disconnecting === providerKey

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'rgba(13,13,26,0.95)',
        border: `1px solid ${isConnected ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.07)'}`,
        backdropFilter: 'blur(16px)',
        boxShadow: isConnected
          ? '0 8px 32px rgba(99,102,241,0.08)'
          : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {googleIcon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">{label}</span>
            {isConnected ? (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.2)',
                  color: '#4ade80',
                }}
              >
                Connected
              </span>
            ) : (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.3)',
                }}
              >
                Not connected
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {isConnected && connection
              ? `Connected ${formatDistanceToNow(new Date(connection.connectedAt), { addSuffix: true })}`
              : description}
          </p>
        </div>

        {/* Action */}
        <div className="shrink-0">
          {isConnected ? (
            <button
              onClick={() => onDisconnect(providerKey)}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
              style={{
                background: 'rgba(239,68,68,0.07)',
                border: '1px solid rgba(239,68,68,0.18)',
                color: '#f87171',
              }}
              onMouseEnter={e => !isLoading && (e.currentTarget.style.background = 'rgba(239,68,68,0.14)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.07)')}
            >
              {isLoading ? 'Removing…' : 'Disconnect'}
            </button>
          ) : (
            <a
              href={oauthHref}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all flex items-center gap-1.5"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)',
                boxShadow: '0 2px 12px rgba(99,102,241,0.3)',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.45)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(99,102,241,0.3)')}
            >
              Connect
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CalendarSettingsClient({ connections, flashConnected, flashError }: Props) {
  const router = useRouter()
  const [localConnections, setLocalConnections] = useState<CalendarConnection[]>(connections)
  const [disconnecting, setDisconnecting] = useState<'google' | 'microsoft' | null>(null)
  const [error, setError] = useState<string | null>(flashError)

  const googleConn    = localConnections.find(c => c.provider === 'google')
  const microsoftConn = localConnections.find(c => c.provider === 'microsoft')

  async function handleDisconnect(provider: 'google' | 'microsoft') {
    setDisconnecting(provider)
    setError(null)

    const res = await fetch(`/api/recall/calendar?provider=${provider}`, { method: 'DELETE' })

    if (res.ok) {
      setLocalConnections(prev => prev.filter(c => c.provider !== provider))
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({ error: 'Unknown error' }))
      setError(data.error ?? 'Failed to disconnect')
    }

    setDisconnecting(null)
  }

  return (
    <div>
      {/* Header */}
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
          Connect your calendar and every sales meeting gets recorded and analysed — zero manual work.
        </p>
      </div>

      {/* Supported platforms */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{
          background: 'rgba(13,13,26,0.95)',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Bot joins meetings on
        </p>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(p => (
            <div
              key={p.name}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{
                background: `${p.color}12`,
                border: `1px solid ${p.color}28`,
                color: p.color,
              }}
            >
              {p.icon}
              {p.name}
            </div>
          ))}
          <div
            className="flex items-center px-3 py-1.5 rounded-lg text-xs"
            style={{ color: 'rgba(255,255,255,0.25)' }}
          >
            + more
          </div>
        </div>
        <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
          The bot joins any meeting with a video link found in your calendar events.
        </p>
      </div>

      {/* Flash messages */}
      {flashConnected && (
        <div
          className="mb-5 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2"
          style={{
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.25)',
            color: '#4ade80',
          }}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {flashConnected === 'microsoft' ? 'Microsoft 365' : 'Google'} Calendar connected.
          Recall bots will now join your meetings automatically.
        </div>
      )}

      {error && (
        <div
          className="mb-5 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2"
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

      {/* Calendar cards */}
      <div className="space-y-3">
        <CalendarCard
          providerKey="google"
          label="Google Calendar"
          description="For Zoom, Google Meet, or Teams meetings scheduled via Gmail / Workspace"
          oauthHref="/api/recall/oauth/start"
          googleIcon={
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          }
          connection={googleConn}
          onDisconnect={handleDisconnect}
          disconnecting={disconnecting}
        />

        <CalendarCard
          providerKey="microsoft"
          label="Microsoft 365 Calendar"
          description="For Teams, Zoom, or Meet meetings scheduled via Outlook / Microsoft 365"
          oauthHref="/api/recall/oauth/microsoft/start"
          googleIcon={
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
              <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
              <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
              <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
            </svg>
          }
          connection={microsoftConn}
          onDisconnect={handleDisconnect}
          disconnecting={disconnecting}
        />
      </div>

      {/* How it works */}
      {!googleConn && !microsoftConn && (
        <div
          className="mt-5 rounded-xl p-4"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
            How it works
          </p>
          <div className="space-y-2">
            {[
              ['📅', 'Connect the calendar your team uses to schedule calls'],
              ['🤖', 'Recall.ai joins as a silent bot — no install needed for attendees'],
              ['🎙️', 'Recording ends → audio processed by Deepgram automatically'],
              ['🧠', 'Claude extracts verdict, objections, and recommendations'],
              ['📊', 'Insight appears on your dashboard within minutes'],
            ].map(([icon, text]) => (
              <div key={text as string} className="flex items-start gap-2">
                <span className="text-sm mt-0.5">{icon}</span>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Powered by */}
      <p className="mt-5 text-center text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>
        Recording powered by{' '}
        <a
          href="https://recall.ai"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'rgba(255,255,255,0.3)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
        >
          Recall.ai
        </a>
      </p>
    </div>
  )
}
