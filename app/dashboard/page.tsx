/**
 * Dashboard — the manager and rep home base.
 * Admins see all org calls. Reps see their own.
 * At-risk and lost calls bubble to the top.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { StatsBar } from '@/components/StatsBar'
import { CallCard } from '@/components/CallCard'
import type { CallRow, DashboardStats, InsightRow } from '@/types'

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

  const { data: calls = [], error: callsError } = await supabase
    .from('calls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (callsError) console.error('Error fetching calls:', callsError)

  const completedIds = (calls ?? []).filter((c: CallRow) => c.status === 'complete').map((c: CallRow) => c.id)
  let insightMap: Record<string, InsightRow> = {}

  if (completedIds.length > 0) {
    const { data: insightRows } = await supabase
      .from('insights')
      .select('call_id, talk_ratio, top_recommendation')
      .in('call_id', completedIds)

    if (insightRows) {
      insightMap = Object.fromEntries(insightRows.map((i: { call_id: string; talk_ratio: any; top_recommendation: any }) => [i.call_id, i as unknown as InsightRow]))
    }
  }

  const allCalls       = (calls ?? []) as CallRow[]
  const completedCalls = allCalls.filter((c) => c.status === 'complete')
  const wonCalls       = completedCalls.filter((c) => c.verdict === 'won')
  const atRiskCalls    = completedCalls.filter((c) => c.verdict === 'at_risk')
  const lostCalls      = completedCalls.filter((c) => c.verdict === 'lost')

  const avgRep = Object.values(insightMap).length > 0
    ? Math.round(
        Object.values(insightMap).reduce((sum, i) => sum + (i.talk_ratio?.rep ?? 50), 0) /
          Object.values(insightMap).length
      )
    : 0

  const stats: DashboardStats = {
    total_calls:        allCalls.length,
    complete_calls:     completedCalls.length,
    win_rate:           completedCalls.length > 0
      ? Math.round((wonCalls.length / completedCalls.length) * 100) : 0,
    at_risk_count:      atRiskCalls.length,
    lost_count:         lostCalls.length,
    avg_rep_talk_ratio: avgRep,
  }

  const sortedCalls = [...allCalls].sort((a, b) => {
    if (a.status === 'processing' && b.status !== 'processing') return -1
    if (b.status === 'processing' && a.status !== 'processing') return 1
    const priority = { at_risk: 0, lost: 1, won: 2 } as const
    const ap = priority[a.verdict as keyof typeof priority] ?? 3
    const bp = priority[b.verdict as keyof typeof priority] ?? 3
    if (ap !== bp) return ap - bp
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const isAdmin = profile.role === 'admin'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">
            {isAdmin ? 'Call Intelligence' : 'My Calls'}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {isAdmin
              ? 'Every call analyzed. One metric: conversion rate.'
              : 'Your uploaded calls and analysis.'}
          </p>
        </div>
        <Link
          href="/upload"
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Upload Call
        </Link>
      </div>

      {allCalls.length > 0 && <StatsBar stats={stats} />}

      {allCalls.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {sortedCalls.map((call) => (
            <CallCard
              key={call.id}
              call={call}
              talkRatio={insightMap[call.id]?.talk_ratio}
              topRecommendation={insightMap[call.id]?.top_recommendation}
              currentUserId={user.id}
              currentUserRole={profile.role as 'admin' | 'rep' | 'pending'}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="border border-dashed border-slate-800 rounded-2xl p-16 text-center">
      <div className="mx-auto w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-5">
        <svg className="w-7 h-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      </div>
      <h3 className="text-white font-semibold mb-2">No calls yet</h3>
      <p className="text-sm text-slate-400 mb-6 max-w-xs mx-auto">
        Upload your first call recording. Full analysis — verdict, objections, coaching tip — in under 2 minutes.
      </p>
      <Link
        href="/upload"
        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-5 py-2.5 rounded-lg font-medium transition-colors"
      >
        Upload your first call
      </Link>
    </div>
  )
}
