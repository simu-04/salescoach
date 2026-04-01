/**
 * /settings/calendar
 *
 * Server component — reads existing connections for this user.
 * Supports Google Calendar and Microsoft 365 Calendar simultaneously.
 */
import { redirect } from 'next/navigation'
import { createServerClient, createServerAdminClient } from '@/lib/supabase/server'
import { CalendarSettingsClient } from './CalendarSettingsClient'

export const metadata = { title: 'Calendar Integration — SalesCoach' }

export interface CalendarConnection {
  provider:    'google' | 'microsoft'
  connectedAt: string
}

export default async function CalendarSettingsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string }
}) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createServerAdminClient()

  // Fetch all calendar connections for this user (could be google + microsoft)
  const { data: rows } = await adminClient
    .from('calendar_connections')
    .select('provider, connected_at')
    .eq('user_id', user.id)

  const connections: CalendarConnection[] = (rows ?? []).map((r) => ({
    provider:    r.provider as 'google' | 'microsoft',
    connectedAt: r.connected_at,
  }))

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <CalendarSettingsClient
        connections={connections}
        flashConnected={searchParams.connected ?? null}
        flashError={searchParams.error ?? null}
      />
    </div>
  )
}
