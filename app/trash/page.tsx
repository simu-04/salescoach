/**
 * Trash — admin only.
 * Lists soft-deleted calls. Admins can restore or permanently purge.
 */
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { TrashClient } from '@/components/TrashClient'
import type { CallRow } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TrashPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const { data: trashed } = await supabase
    .from('calls')
    .select('*')
    .not('deleted_at', 'is', null)
    .eq('org_id', profile.org_id)
    .order('deleted_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Trash</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Deleted calls. Restore to bring them back, or purge to remove permanently.
        </p>
      </div>
      <TrashClient calls={(trashed ?? []) as CallRow[]} />
    </div>
  )
}
