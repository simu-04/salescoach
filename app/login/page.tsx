'use client'

/**
 * Login page — glassmorphism card floating over animated mesh gradient.
 * Google, GitHub, and Email (magic link) sign-in options.
 */
import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const supabase    = createBrowserClient()
  const redirectTo  = `${typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? '')}/auth/callback`

  async function signInWithGoogle() {
    setLoading('google'); setError(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    if (error) { setError(error.message); setLoading(null) }
  }

  async function signInWithGitHub() {
    setLoading('github'); setError(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo } })
    if (error) { setError(error.message); setLoading(null) }
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading('email'); setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
    if (error) { setError(error.message); setLoading(null) }
    else       { setSent(true); setLoading(null) }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: '#07070f',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient glow blobs */}
      <div style={{
        position: 'absolute', top: '-20%', left: '-10%',
        width: '60%', height: '60%',
        background: 'radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-10%',
        width: '55%', height: '55%',
        background: 'radial-gradient(ellipse, rgba(14,165,233,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '40%', height: '40%',
        background: 'radial-gradient(ellipse, rgba(139,92,246,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="w-full max-w-sm relative z-10">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)',
              boxShadow: '0 8px 32px rgba(99,102,241,0.5), 0 0 0 1px rgba(99,102,241,0.3)',
            }}
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <div className="text-white font-bold text-xl tracking-tight">Sales Intel</div>
            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Know why you&apos;re winning or losing</div>
          </div>
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
          <h1 className="text-white font-bold text-2xl mb-1 tracking-tight">Sign in</h1>
          <p className="text-base mb-7" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Access your team&apos;s call intelligence.
          </p>

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

          {sent ? (
            <div className="text-center py-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{
                  background: 'rgba(99,102,241,0.1)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  boxShadow: '0 0 24px rgba(99,102,241,0.2)',
                }}
              >
                <svg className="w-7 h-7" style={{ color: '#818cf8' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-white font-semibold text-lg mb-2">Check your email</p>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Magic link sent to <span className="text-white font-medium">{email}</span>
              </p>
              <button
                onClick={() => { setSent(false); setEmail('') }}
                className="mt-5 text-sm transition-colors"
                style={{ color: 'rgba(99,102,241,0.7)' }}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              {/* OAuth buttons */}
              <div className="space-y-3 mb-6">
                <button
                  onClick={signInWithGoogle}
                  disabled={!!loading}
                  className="w-full flex items-center justify-center gap-3 font-semibold text-base px-4 py-3 rounded-xl transition-all duration-150 disabled:opacity-50"
                  style={{
                    background: 'rgba(255,255,255,0.95)',
                    color: '#1e1e2e',
                  }}
                  onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,1)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.95)' }}
                >
                  {loading === 'google' ? <Spinner dark /> : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  Continue with Google
                </button>

                <button
                  onClick={signInWithGitHub}
                  disabled={!!loading}
                  className="w-full flex items-center justify-center gap-3 font-semibold text-base px-4 py-3 rounded-xl transition-all duration-150 disabled:opacity-50"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.85)',
                  }}
                  onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)' }}
                >
                  {loading === 'github' ? <Spinner /> : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                    </svg>
                  )}
                  Continue with GitHub
                </button>
              </div>

              {/* Divider */}
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />
                </div>
                <div className="relative flex justify-center">
                  <span
                    className="px-3 text-xs"
                    style={{ background: 'rgba(13,13,26,0.85)', color: 'rgba(255,255,255,0.3)' }}
                  >
                    or continue with email
                  </span>
                </div>
              </div>

              {/* Magic link */}
              <form onSubmit={signInWithEmail} className="space-y-3">
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl px-4 py-3 text-base text-white transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
                <button
                  type="submit"
                  disabled={!!loading || !email}
                  className="w-full font-semibold text-base px-4 py-3 rounded-xl transition-all duration-150 flex items-center justify-center gap-2 text-white"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)',
                    boxShadow: loading || !email ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
                    opacity: loading || !email ? 0.45 : 1,
                    cursor: loading || !email ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading === 'email' ? <Spinner /> : null}
                  Send magic link
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.2)' }}>
          By signing in, you agree to use this product for legitimate sales coaching purposes.
        </p>
      </div>
    </div>
  )
}

function Spinner({ dark }: { dark?: boolean }) {
  return (
    <svg
      className="w-4 h-4 animate-spin"
      style={{ color: dark ? 'rgba(30,30,46,0.6)' : 'rgba(255,255,255,0.6)' }}
      fill="none" viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}
