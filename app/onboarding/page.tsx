'use client'

/**
 * Onboarding — glass card over mesh gradient.
 * Create workspace (admin) or join existing one (pending rep).
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'

type Tab = 'create' | 'join'

export default function OnboardingPage() {
  const [tab, setTab]         = useState<Tab>('create')
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const router   = useRouter()
  const supabase = createBrowserClient()

  function handleNameChange(name: string) {
    setOrgName(name)
    setOrgSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }

  async function createOrg(e: React.FormEvent) {
    e.preventDefault()
    if (!orgName.trim() || !orgSlug.trim()) return
    setLoading(true); setError(null)
    const res  = await fetch('/api/org', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: orgName.trim(), slug: orgSlug.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to create organization'); setLoading(false); return }
    router.refresh()
    router.push('/dashboard')
  }

  async function joinOrg(e: React.FormEvent) {
    e.preventDefault()
    if (!orgSlug.trim()) return
    setLoading(true); setError(null)
    const res  = await fetch('/api/org', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'join', slug: orgSlug.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Organization not found'); setLoading(false); return }
    router.refresh()
    router.push('/dashboard')
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'white',
    width: '100%',
    borderRadius: '12px',
    padding: '12px 16px',
    fontSize: '15px',
    transition: 'all 0.15s ease',
    outline: 'none',
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#07070f', position: 'relative', overflow: 'hidden' }}
    >
      {/* Ambient blobs */}
      <div style={{
        position: 'absolute', top: '-15%', right: '-5%',
        width: '50%', height: '50%',
        background: 'radial-gradient(ellipse, rgba(99,102,241,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', left: '-5%',
        width: '45%', height: '45%',
        background: 'radial-gradient(ellipse, rgba(14,165,233,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="w-full max-w-md relative z-10">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
              boxShadow: '0 6px 24px rgba(99,102,241,0.4)',
            }}
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">Sales Intel</span>
        </div>

        {/* Glass card */}
        <div
          className="rounded-3xl p-8"
          style={{
            background: 'rgba(13,13,26,0.85)',
            backdropFilter: 'blur(24px) saturate(1.5)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          <h1 className="text-white font-bold text-2xl mb-1 tracking-tight">Set up your workspace</h1>
          <p className="text-base mb-7" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Create a new workspace, or join an existing one.
          </p>

          {/* Tab switcher */}
          <div
            className="flex gap-1 p-1 rounded-xl mb-7"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            {(['create', 'join'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null); setOrgName(''); setOrgSlug('') }}
                className="flex-1 text-sm font-semibold py-2.5 rounded-lg transition-all duration-150"
                style={tab === t ? {
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
                } : {
                  color: 'rgba(255,255,255,0.35)',
                }}
              >
                {t === 'create' ? 'Create workspace' : 'Join workspace'}
              </button>
            ))}
          </div>

          {error && (
            <div
              className="mb-5 px-4 py-3 rounded-xl text-sm"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                color: '#f87171',
              }}
            >
              {error}
            </div>
          )}

          {tab === 'create' ? (
            <form onSubmit={createOrg} className="space-y-4">
              <div>
                <label className="block text-sm mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Workspace name
                </label>
                <input
                  type="text"
                  placeholder="Acme Sales Team"
                  value={orgName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'
                    e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(99,102,241,0.1)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                    e.currentTarget.style.boxShadow   = 'none'
                  }}
                />
              </div>
              <div>
                <label className="block text-sm mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Workspace ID
                  <span className="ml-2 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    share this so reps can join
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="acme-sales-team"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'
                    e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(99,102,241,0.1)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                    e.currentTarget.style.boxShadow   = 'none'
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !orgName || !orgSlug}
                className="w-full font-semibold text-base px-4 py-3 rounded-xl transition-all text-white mt-2"
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)',
                  opacity: loading || !orgName || !orgSlug ? 0.4 : 1,
                  cursor: loading || !orgName || !orgSlug ? 'not-allowed' : 'pointer',
                  boxShadow: loading || !orgName || !orgSlug ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
                }}
              >
                {loading ? 'Creating...' : 'Create workspace'}
              </button>
              <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
                You&apos;ll be the admin. Reps join using the workspace ID.
              </p>
            </form>
          ) : (
            <form onSubmit={joinOrg} className="space-y-4">
              <div>
                <label className="block text-sm mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Workspace ID
                </label>
                <input
                  type="text"
                  placeholder="acme-sales-team"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'
                    e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(99,102,241,0.1)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                    e.currentTarget.style.boxShadow   = 'none'
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !orgSlug}
                className="w-full font-semibold text-base px-4 py-3 rounded-xl transition-all text-white mt-2"
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)',
                  opacity: loading || !orgSlug ? 0.4 : 1,
                  cursor: loading || !orgSlug ? 'not-allowed' : 'pointer',
                  boxShadow: loading || !orgSlug ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
                }}
              >
                {loading ? 'Joining...' : 'Request to join'}
              </button>
              <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
                An admin will approve your request before you can access calls.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
