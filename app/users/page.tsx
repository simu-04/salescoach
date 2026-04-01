/**
 * User Management — admin only.
 * Shows all org members, lets admin change roles or remove users.
 */
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { UserManagementClient } from '@/components/UserManagementClient'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch caller's profile
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  // Only admins can view this page
  if (!myProfile || myProfile.role !== 'admin') redirect('/dashboard')

  // Fetch all org members
  const { data: members } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, created_at')
    .eq('org_id', myProfile.org_id)
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">User Management</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Manage your team members and their access levels.
        </p>
      </div>

      <UserManagementClient
        members={(members ?? []) as Profile[]}
        currentUserId={user.id}
      />
    </div>
  )
}
