'use client'

/**
 * Onboarding — first screen after signup.
 * New users choose to CREATE an organization (→ admin) or JOIN one (→ rep pending approval).
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
  const router = useRouter()
  const supabase = createBrowserClient()

  // Auto-generate slug from name
  function handleNameChange(name: string) {
    setOrgName(name)
    setOrgSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }

  async function createOrg(e: React.FormEvent) {
    e.preventDefault()
    if (!orgName.trim() || !orgSlug.trim()) return
    setLoading(true)
    setError(null)

    const res = await fetch('/api/org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: orgName.trim(), slug: orgSlug.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to create organization'); setLoading(false); return }
    // Refresh server components so the layout picks up the new org + admin role
    router.refresh()
    router.push('/dashboard')
  }

  async function joinOrg(e: React.FormEvent) {
    e.preventDefault()
    if (!orgSlug.trim()) return
    setLoading(true)
    setError(null)

    const res = await fetch('/api/org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'join', slug: orgSlug.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Organization not found'); setLoading(false); return }
    // Refresh server components so the layout picks up the new org
    router.refresh()
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="text-white font-bold text-lg">Sales Intel</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7">
          <h1 className="text-white font-semibold text-xl mb-1">Set up your workspace</h1>
          <p className="text-slate-400 text-sm mb-6">
            Create a new workspace for your team, or join an existing one.
          </p>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-slate-800 rounded-xl mb-6">
            {(['create', 'join'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null); setOrgName(''); setOrgSlug('') }}
                className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors ${
                  tab === t
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                {t === 'create' ? 'Create workspace' : 'Join workspace'}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {tab === 'create' ? (
            <form onSubmit={createOrg} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Workspace name</label>
                <input
                  type="text"
                  placeholder="Acme Sales Team"
                  value={orgName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">
                  Workspace ID
                  <span className="text-slate-600 ml-2 text-xs">(share this so reps can join)</span>
                </label>
                <input
                  type="text"
                  placeholder="acme-sales-team"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !orgName || !orgSlug}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-medium text-sm px-4 py-2.5 rounded-xl transition-colors"
              >
                {loading ? 'Creating...' : 'Create workspace'}
              </button>
              <p className="text-slate-600 text-xs text-center">
                You&apos;ll be the admin. Reps join using the workspace ID.
              </p>
            </form>
          ) : (
            <form onSubmit={joinOrg} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Workspace ID</label>
                <input
                  type="text"
                  placeholder="acme-sales-team"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !orgSlug}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-medium text-sm px-4 py-2.5 rounded-xl transition-colors"
              >
                {loading ? 'Joining...' : 'Request to join'}
              </button>
              <p className="text-slate-600 text-xs text-center">
                An admin will need to approve your request before you can access calls.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
