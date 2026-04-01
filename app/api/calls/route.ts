/**
 * GET /api/calls — list calls scoped to the user's org / role.
 * Admin sees all org calls. Rep sees only their own.
 * RLS in Supabase enforces this automatically.
 */
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { ApiError, DashboardStats } from '@/types'

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json<ApiError>({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: calls, error } = await supabase
      .from('calls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100) // Paginate in v2 when needed

    if (error) {
      return NextResponse.json<ApiError>(
        { error: 'Failed to fetch calls', details: error.message },
        { status: 500 }
      )
    }

    // Compute dashboard stats server-side — keep the client dumb
    const completedCalls = calls.filter((c) => c.status === 'complete')
    const wonCalls = completedCalls.filter((c) => c.verdict === 'won')
    const atRiskCalls = completedCalls.filter((c) => c.verdict === 'at_risk')
    const lostCalls = completedCalls.filter((c) => c.verdict === 'lost')

    const stats: DashboardStats = {
      total_calls: calls.length,
      complete_calls: completedCalls.length,
      win_rate:
        completedCalls.length > 0
          ? Math.round((wonCalls.length / completedCalls.length) * 100)
          : 0,
      at_risk_count: atRiskCalls.length,
      lost_count: lostCalls.length,
      avg_rep_talk_ratio: 0, // Computed below if we have insight data
    }

    // For avg talk ratio, fetch talk_ratio from insights for completed calls
    // Only do this if we have completed calls (avoid unnecessary query)
    if (completedCalls.length > 0) {
      const completedIds = completedCalls.map((c) => c.id)
      const { data: insights } = await supabase
        .from('insights')
        .select('call_id, talk_ratio')
        .in('call_id', completedIds)

      if (insights && insights.length > 0) {
        const avgRatio =
          insights.reduce((sum, i) => sum + (i.talk_ratio?.rep ?? 50), 0) / insights.length
        stats.avg_rep_talk_ratio = Math.round(avgRatio)
      }
    }

    return NextResponse.json({ calls, stats })

  } catch (error) {
    console.error('Unexpected error in GET /api/calls:', error)
    return NextResponse.json<ApiError>(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
