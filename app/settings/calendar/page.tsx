/**
 * /settings/calendar
 *
 * Server component — reads the current connection state from Supabase.
 * Passes it to <CalendarSettingsClient> for interactive connect/disconnect.
 */
import { redirect } from 'next/navigation'
import { createServerClient, createServerAdminClient } from '@/lib/supabase/server'
import { CalendarSettingsClient } from './CalendarSettingsClient'

export const metadata = { title: 'Calendar Integration — SalesCoach' }

export default async function CalendarSettingsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string }
}) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createServerAdminClient()

  // Check if this user already has a calendar connected
  const { data: connection } = await adminClient
    .from('calendar_connections')
    .select('recall_calendar_id, provider, connected_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const isConnected = !!connection
  const connectedAt = connection?.connected_at ?? null
  const provider    = connection?.provider ?? null

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <CalendarSettingsClient
        isConnected={isConnected}
        connectedAt={connectedAt}
        provider={provider}
        flashConnected={searchParams.connected === '1'}
        flashError={searchParams.error ?? null}
      />
    </div>
  )
}
