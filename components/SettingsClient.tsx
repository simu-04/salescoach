'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Profile, Organization } from '@/types'

interface Props {
  profile: Profile
  org:     Organization | null
  email:   string | null
}

const cardStyle: React.CSSProperties = {
  background:   'var(--card-bg)',
  border:       '1px solid var(--card-border)',
  borderRadius: '16px',
  padding:      '24px',
}

const inputStyle: React.CSSProperties = {
  width:        '100%',
  background:   'var(--input-bg)',
  border:       '1px solid var(--border-mid)',
  borderRadius: '12px',
  padding:      '10px 16px',
  fontSize:     '14px',
  color:        'var(--text-primary)',
  outline:      'none',
  transition:   'border-color 0.15s',
}

const labelStyle: React.CSSProperties = {
  display:      'block',
  fontSize:     '13px',
  color:        'var(--text-secondary)',
  marginBottom: '6px',
}

const dividerStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border-subtle)',
}

export function SettingsClient({ profile: initial, org, email }: Props) {
  const [fullName, setFullName] = useState(initial.full_name ?? '')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null); setSaved(false)
    const res  = await fetch('/api/profile', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ full_name: fullName }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to save')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  const roleBadgeColor = {
    admin:   'bg-purple-500/15 text-purple-400 border-purple-500/30',
    rep:     'bg-blue-500/15 text-blue-400 border-blue-500/30',
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  }[initial.role]

  return (
    <div className="space-y-5 max-w-lg">

      {/* Profile card */}
      <div style={cardStyle}>
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Profile</h2>

        {error && (
          <div className="mb-4 rounded-lg px-4 py-3 text-sm"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
            {error}
          </div>
        )}

        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label style={labelStyle}>Display name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              style={inputStyle}
              onFocus={(e)  => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)')}
              onBlur={(e)   => (e.currentTarget.style.borderColor = 'var(--border-mid)')}
            />
          </div>

          <div>
            <label style={labelStyle}>Email</label>
            <div style={{ ...inputStyle, color: 'var(--text-muted)', cursor: 'default' }}>
              {email ?? 'Unknown'}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Role:</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${roleBadgeColor}`}>
                {initial.role}
              </span>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="font-medium text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-60 text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #0ea5e9)' }}
            >
              {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Workspace card */}
      {org ? (
        <div style={cardStyle}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Workspace</h2>
          <div className="space-y-0">
            <div className="flex justify-between items-center py-3" style={dividerStyle}>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Name</span>
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{org.name}</span>
            </div>
            <div className="flex justify-between items-center py-3" style={dividerStyle}>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Workspace ID</span>
              <span style={{ fontSize: '14px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{org.slug}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Share this ID</span>
              <button
                onClick={() => navigator.clipboard.writeText(org.slug)}
                className="text-xs font-medium transition-colors"
                style={{ color: 'var(--accent-primary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Copy to clipboard
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-6"
          style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <p className="text-amber-400 text-sm font-medium mb-1">Not in a workspace</p>
          <p className="text-sm" style={{ color: 'rgba(251,191,36,0.65)' }}>
            You haven&apos;t joined a workspace yet.{' '}
            <a href="/onboarding" className="underline hover:opacity-80">Set one up now.</a>
          </p>
        </div>
      )}

      {/* Account */}
      <div style={cardStyle}>
        <h2 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Account</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Sign out of your account on this device.
        </p>
        <SignOutButton />
      </div>

    </div>
  )
}

function SignOutButton() {
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserClient()

  async function handleSignOut() {
    setLoading(true)
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="text-sm font-medium transition-colors disabled:opacity-60"
      style={{ color: '#f87171' }}
      onMouseEnter={(e) => (e.currentTarget.style.color = '#fca5a5')}
      onMouseLeave={(e) => (e.currentTarget.style.color = '#f87171')}
    >
      {loading ? 'Signing out...' : 'Sign out'}
    </button>
  )
}
