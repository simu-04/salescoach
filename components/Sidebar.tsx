'use client'

/**
 * Left sidebar navigation — glassmorphism dark 3D design.
 * Role-aware: admins see User Management, reps don't, pending see Dashboard only.
 */
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Profile, Organization } from '@/types'

interface SidebarProps {
  profile:  Profile
  org:      Organization | null
  onClose?: () => void
}

interface NavItem {
  label: string
  href:  string
  roles: ('admin' | 'rep' | 'pending')[]
  icon:  React.ReactNode
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href:  '/dashboard',
    roles: ['admin', 'rep', 'pending'],
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: 'Upload Call',
    href:  '/upload',
    roles: ['admin', 'rep'],
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
  },
  {
    label: 'User Management',
    href:  '/users',
    roles: ['admin'],
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href:  '/settings',
    roles: ['admin', 'rep'],
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export function Sidebar({ profile, org, onClose }: SidebarProps) {
  const pathname  = usePathname()
  const router    = useRouter()
  const supabase  = createBrowserClient()
  const [signing, setSigning] = useState(false)

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(profile.role as 'admin' | 'rep' | 'pending')
  )

  async function handleSignOut() {
    setSigning(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = (profile.full_name || 'U')
    .split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  const roleBadgeClass = {
    admin:   'text-violet-400 border-violet-500/30 bg-violet-500/10',
    rep:     'text-sky-400 border-sky-500/30 bg-sky-500/10',
    pending: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  }[profile.role] ?? 'text-slate-400 border-slate-500/30 bg-slate-500/10'

  return (
    <aside
      className="flex flex-col h-full w-64 py-5 px-3"
      style={{
        background: 'rgba(7, 7, 15, 0.92)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* ── Brand ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-2 mb-8">
        {/* Logo icon with gradient */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)', boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}
        >
          <svg className="w-[18px] h-[18px] text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base text-white leading-tight truncate tracking-tight">
            {org?.name || 'Sales Intel'}
          </div>
          <div className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {org?.slug || 'workspace'}
          </div>
        </div>
        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="lg:hidden p-1 rounded-lg transition-colors flex-shrink-0"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Nav section label ─────────────────────────────── */}
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] px-3 mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
        Navigation
      </p>

      {/* ── Nav items ─────────────────────────────────────── */}
      <nav className="flex-1 space-y-0.5">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                ${isActive ? 'nav-active text-white' : 'hover:bg-white/[0.04]'}
              `}
              style={isActive ? {} : { color: 'rgba(255,255,255,0.45)' }}
            >
              <span className={isActive ? 'text-indigo-400' : ''}>
                {item.icon}
              </span>
              {item.label}
              {isActive && (
                <span
                  className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #0ea5e9)', boxShadow: '0 0 6px rgba(99,102,241,0.8)' }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Pending warning ───────────────────────────────── */}
      {profile.role === 'pending' && (
        <div
          className="mx-1 mb-3 p-3 rounded-xl"
          style={{
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.2)',
          }}
        >
          <p className="text-amber-400 text-xs font-semibold mb-1">Pending approval</p>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(251,191,36,0.6)' }}>
            Your admin needs to approve your account.
          </p>
        </div>
      )}

      {/* ── User profile ──────────────────────────────────── */}
      <div
        className="mt-1 pt-3 px-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-3">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name || 'User'}
              className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-2"
              style={{ ringColor: 'rgba(99,102,241,0.3)' }}
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.6), rgba(14,165,233,0.6))',
                border: '1px solid rgba(99,102,241,0.3)',
              }}
            >
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate leading-tight">
              {profile.full_name || 'User'}
            </div>
            <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide mt-1 ${roleBadgeClass}`}>
              {profile.role}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signing}
            title="Sign out"
            className="transition-colors flex-shrink-0 p-1 rounded-lg hover:bg-white/5"
            style={{ color: 'rgba(255,255,255,0.25)' }}
          >
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
