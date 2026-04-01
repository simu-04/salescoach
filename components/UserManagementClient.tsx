'use client'

/**
 * Interactive user management table.
 * Admin can promote/demote roles and remove users from org.
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

const ROLE_COLORS: Record<UserRole, string> = {
  admin:   'bg-purple-500/15 text-purple-400 border-purple-500/30',
  rep:     'bg-blue-500/15 text-blue-400 border-blue-500/30',
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
}

export function UserManagementClient({ members: initial, currentUserId }: Props) {
  const [members, setMembers] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  async function updateRole(userId: string, role: UserRole) {
    setLoading(userId + role)
    setError(null)
    const res = await fetch('/api/users', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ user_id: userId, role }),
    })
    if (res.ok) {
      setMembers((prev) =>
        prev.map((m) => m.id === userId ? { ...m, role } : m)
      )
    } else {
      const d = await res.json()
      setError(d.error || 'Failed to update role')
    }
    setLoading(null)
  }

  async function removeUser(userId: string) {
    if (!confirm('Remove this user from the organization?')) return
    setLoading(userId + 'remove')
    setError(null)
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

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-white">Pending Approval</h2>
            <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full font-medium">
              {pending.length}
            </span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
            {pending.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                isSelf={member.id === currentUserId}
                loading={loading}
                onRoleChange={updateRole}
                onRemove={removeUser}
              />
            ))}
          </div>
        </div>
      )}

      {/* Active members */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">
          Team Members <span className="text-slate-500 font-normal">({active.length})</span>
        </h2>
        {active.length === 0 ? (
          <div className="bg-slate-900 border border-dashed border-slate-800 rounded-xl p-8 text-center">
            <p className="text-slate-500 text-sm">No active members yet.</p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
            {active.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                isSelf={member.id === currentUserId}
                loading={loading}
                onRoleChange={updateRole}
                onRemove={removeUser}
              />
            ))}
          </div>
        )}
      </div>

      {/* Invite hint */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-1">Invite your team</h3>
        <p className="text-slate-400 text-sm">
          Share your workspace ID with reps. They can join via the signup page and you&apos;ll see them here as pending.
        </p>
      </div>
    </div>
  )
}

function MemberRow({
  member, isSelf, loading, onRoleChange, onRemove
}: {
  member:       Profile
  isSelf:       boolean
  loading:      string | null
  onRoleChange: (id: string, role: UserRole) => void
  onRemove:     (id: string) => void
}) {
  const initials = (member.full_name || 'U')
    .split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  const joined = formatDistanceToNow(new Date(member.created_at), { addSuffix: true })

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      {/* Avatar */}
      {member.avatar_url ? (
        <img src={member.avatar_url} alt={member.full_name ?? ''} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {initials}
        </div>
      )}

      {/* Name + joined */}
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium truncate">
          {member.full_name || 'Unnamed user'}
          {isSelf && <span className="ml-2 text-xs text-slate-500">(you)</span>}
        </div>
        <div className="text-slate-500 text-xs mt-0.5">Joined {joined}</div>
      </div>

      {/* Role badge */}
      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${ROLE_COLORS[member.role]}`}>
        {ROLE_LABELS[member.role]}
      </span>

      {/* Actions (not for self) */}
      {!isSelf && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {member.role === 'pending' && (
            <button
              onClick={() => onRoleChange(member.id, 'rep')}
              disabled={!!loading}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-60"
            >
              Approve as Rep
            </button>
          )}
          {member.role === 'rep' && (
            <button
              onClick={() => onRoleChange(member.id, 'admin')}
              disabled={!!loading}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-60 border border-slate-700"
            >
              Make Admin
            </button>
          )}
          {member.role === 'admin' && (
            <button
              onClick={() => onRoleChange(member.id, 'rep')}
              disabled={!!loading}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-60 border border-slate-700"
            >
              Demote to Rep
            </button>
          )}
          <button
            onClick={() => onRemove(member.id)}
            disabled={!!loading}
            title="Remove from org"
            className="text-slate-600 hover:text-red-400 transition-colors disabled:opacity-60"
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
