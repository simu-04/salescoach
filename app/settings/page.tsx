/**
 * Settings page — available to all roles.
 * Users can update their name, view org details, and manage their account.
 */
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { SettingsClient } from '@/components/SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const { organizations: org, ...profileData } = profile

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Manage your profile and workspace settings.
        </p>
      </div>

      <SettingsClient
        profile={profileData}
        org={org ?? null}
        email={user.email ?? null}
      />
    </div>
  )
}
