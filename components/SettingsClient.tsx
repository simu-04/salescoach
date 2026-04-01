'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Profile, Organization } from '@/types'

interface Props {
  profile: Profile
  org:     Organization | null
  email:   string | null
}

export function SettingsClient({ profile: initial, org, email }: Props) {
  const [fullName, setFullName]   = useState(initial.full_name ?? '')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    // Use the API route (server-side admin client) to avoid RLS issues on profile updates
    const res = await fetch('/api/profile', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ full_name: fullName }),
    })
    const data = await res.json()
    const error = res.ok ? null : { message: data.error || 'Failed to save' }

    if (error) {
      setError(error.message)
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-4">Profile</h2>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Display name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Email</label>
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-500">
              {email ?? 'Unknown'}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Role:</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${roleBadgeColor}`}>
                {initial.role}
              </span>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-medium text-sm px-4 py-2 rounded-xl transition-colors"
            >
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Workspace card */}
      {org ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Workspace</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <span className="text-sm text-slate-400">Name</span>
              <span className="text-sm text-white font-medium">{org.name}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <span className="text-sm text-slate-400">Workspace ID</span>
              <span className="text-sm text-white font-mono">{org.slug}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-slate-400">Share this ID</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(org.slug)
                }}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
              >
                Copy to clipboard
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6">
          <p className="text-amber-400 text-sm font-medium mb-1">Not in a workspace</p>
          <p className="text-amber-500/70 text-sm">
            You haven&apos;t joined a workspace yet.{' '}
            <a href="/onboarding" className="underline hover:text-amber-400">Set one up now.</a>
          </p>
        </div>
      )}

      {/* Danger zone */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-1">Account</h2>
        <p className="text-slate-500 text-sm mb-4">
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
      className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors disabled:opacity-60"
    >
      {loading ? 'Signing out...' : 'Sign out'}
    </button>
  )
}
