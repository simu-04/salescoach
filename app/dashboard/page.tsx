/**
 * Dashboard page — server component that fetches data and passes it to
 * DashboardClient for client-side filtering, sorting and stats.
 */
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/DashboardClient'
import type { CallRow, InsightRow } from '@/types'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) redirect('/onboarding')

  // Pending users see an approval screen
  if (profile.role === 'pending') return <PendingApprovalScreen name={profile.full_name} />

  const { data: calls = [] } = await supabase
    .from('calls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const allCalls = (calls ?? []) as CallRow[]

  // Fetch insights for all completed calls
  const completedIds = allCalls.filter((c) => c.status === 'complete').map((c) => c.id)
  let insightMap: Record<string, InsightRow> = {}

  if (completedIds.length > 0) {
    const { data: insightRows } = await supabase
      .from('insights')
      .select('call_id, talk_ratio, top_recommendation')
      .in('call_id', completedIds)

    if (insightRows) {
      insightMap = Object.fromEntries(
        insightRows.map((i: any) => [i.call_id, i as InsightRow])
      )
    }
  }

  return (
    <DashboardClient
      calls={allCalls}
      insightMap={insightMap}
      currentUserId={user.id}
      currentUserRole={profile.role as 'admin' | 'rep' | 'pending'}
      isAdmin={profile.role === 'admin'}
    />
  )
}

function PendingApprovalScreen({ name }: { name?: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
        style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}
      >
        <svg className="w-8 h-8" style={{ color: '#fbbf24' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-white mb-3">
        You&apos;re on the waitlist{name ? `, ${name.split(' ')[0]}` : ''}
      </h1>
      <p className="text-base max-w-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Your workspace admin needs to approve your account before you can view and upload calls.
      </p>
      <div
        className="mt-8 px-4 py-3 rounded-xl text-sm"
        style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}
      >
        Status: <span className="font-bold">Pending approval</span>
      </div>
    </div>
  )
}
