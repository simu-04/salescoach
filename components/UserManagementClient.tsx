'use client'

/**
 * UserManagementClient — glass panel member table with neon role badges.
 */
import { useState } from 'react'
import type { Profile, UserRole } from '@/types'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  members:       Profile[]
  currentUserId: string
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin:   'Admin',
  rep:     'Rep',
  pending: 'Pending',
}

const ROLE_STYLES: Record<UserRole, React.CSSProperties> = {
  admin: {
    background: 'rgba(139,92,246,0.1)',
    color:      '#c4b5fd',
    border:     '1px solid rgba(139,92,246,0.3)',
    boxShadow:  '0 0 8px rgba(139,92,246,0.15)',
  },
  rep: {
    background: 'rgba(14,165,233,0.1)',
    color:      '#7dd3fc',
    border:     '1px solid rgba(14,165,233,0.3)',
    boxShadow:  '0 0 8px rgba(14,165,233,0.15)',
  },
  pending: {
    background: 'rgba(251,191,36,0.08)',
    color:      '#fcd34d',
    border:     '1px solid rgba(251,191,36,0.25)',
  },
}

export function UserManagementClient({ members: initial, currentUserId }: Props) {
  const [members, setMembers] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  async function updateRole(userId: string, role: UserRole) {
    setLoading(userId + role); setError(null)
    const res = await fetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role }),
    })
    if (res.ok) {
      setMembers((prev) => prev.map((m) => m.id === userId ? { ...m, role } : m))
    } else {
      const d = await res.json()
      setError(d.error || 'Failed to update role')
    }
    setLoading(null)
  }

  async function removeUser(userId: string) {
    if (!confirm('Remove this user from the organization?')) return
    setLoading(userId + 'remove'); setError(null)
    const res = await fetch(`/api/users?user_id=${userId}`, { method: 'DELETE' })
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== userId))
    } else {
      const d = await res.json()
      setError(d.error || 'Failed to remove user')
    }
    setLoading(null)
  }

  const pending = members.filter((m) => m.role === 'pending')
  const active  = members.filter((m) => m.role !== 'pending')

  const panelStyle: React.CSSProperties = {
    background:    'var(--card-bg)',
    backdropFilter:'blur(16px)',
    border:        '1px solid var(--card-border)',
    borderRadius:  '16px',
    overflow:      'hidden',
  }

  return (
    <div className="space-y-6">
      {error && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
        >
          {error}
        </div>
      )}

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Pending Approval</h2>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(251,191,36,0.12)', color: '#fcd34d', border: '1px solid rgba(251,191,36,0.25)' }}
            >
              {pending.length}
            </span>
          </div>
          <div style={panelStyle}>
            {pending.map((member, i) => (
              <MemberRow
                key={member.id}
                member={member}
                isSelf={member.id === currentUserId}
                loading={loading}
                onRoleChange={updateRole}
                onRemove={removeUser}
                hasBorder={i < pending.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* Active members */}
      <div>
        <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          Team Members{' '}
          <span className="text-sm font-normal" style={{ color: 'var(--text-faint)' }}>
            ({active.length})
          </span>
        </h2>
        {active.length === 0 ? (
          <div
            className="p-10 text-center rounded-2xl"
            style={{ border: '1px dashed var(--border-mid)', background: 'var(--bg-surface)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-faint)' }}>No active members yet.</p>
          </div>
        ) : (
          <div style={panelStyle}>
            {active.map((member, i) => (
              <MemberRow
                key={member.id}
                member={member}
                isSelf={member.id === currentUserId}
                loading={loading}
                onRoleChange={updateRole}
                onRemove={removeUser}
                hasBorder={i < active.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Invite hint */}
      <div
        className="p-5 rounded-2xl"
        style={{
          background: 'rgba(99,102,241,0.04)',
          border:     '1px solid rgba(99,102,241,0.15)',
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}
          >
            <svg className="w-4 h-4" style={{ color: '#818cf8' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Invite your team</h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Share your workspace ID with reps. They join via the signup page and appear here as pending.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MemberRow({
  member, isSelf, loading, onRoleChange, onRemove, hasBorder
}: {
  member:       Profile
  isSelf:       boolean
  loading:      string | null
  onRoleChange: (id: string, role: UserRole) => void
  onRemove:     (id: string) => void
  hasBorder:    boolean
}) {
  const initials = (member.full_name || 'U')
    .split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  const joined   = formatDistanceToNow(new Date(member.created_at), { addSuffix: true })

  return (
    <div
      className="flex items-center gap-4 px-5 py-4"
      style={hasBorder ? { borderBottom: '1px solid var(--border-subtle)' } : {}}
    >
      {/* Avatar */}
      {member.avatar_url ? (
        <img
          src={member.avatar_url}
          alt={member.full_name ?? ''}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          style={{ border: '1px solid var(--border-mid)' }}
        />
      ) : (
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.5), rgba(14,165,233,0.5))',
            border: '1px solid rgba(99,102,241,0.3)',
          }}
        >
          {initials}
        </div>
      )}

      {/* Name + joined */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {member.full_name || 'Unnamed user'}
          {isSelf && <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-faint)' }}>(you)</span>}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Joined {joined}
        </div>
      </div>

      {/* Role badge */}
      <span
        className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide flex-shrink-0"
        style={ROLE_STYLES[member.role]}
      >
        {ROLE_LABELS[member.role]}
      </span>

      {/* Actions */}
      {!isSelf && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {member.role === 'pending' && (
            <button
              onClick={() => onRoleChange(member.id, 'rep')}
              disabled={!!loading}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 text-white"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
                boxShadow:  '0 2px 8px rgba(99,102,241,0.35)',
              }}
            >
              Approve
            </button>
          )}
          {member.role === 'rep' && (
            <button
              onClick={() => onRoleChange(member.id, 'admin')}
              disabled={!!loading}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
              style={{
                background: 'var(--tag-bg)',
                border:     '1px solid var(--border-mid)',
                color:      'var(--text-secondary)',
              }}
            >
              Make Admin
            </button>
          )}
          {member.role === 'admin' && (
            <button
              onClick={() => onRoleChange(member.id, 'rep')}
              disabled={!!loading}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
              style={{
                background: 'var(--tag-bg)',
                border:     '1px solid var(--border-mid)',
                color:      'var(--text-secondary)',
              }}
            >
              Demote to Rep
            </button>
          )}
          <button
            onClick={() => onRemove(member.id)}
            disabled={!!loading}
            title="Remove from org"
            className="transition-all disabled:opacity-50 p-1.5 rounded-lg"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-faint)')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
