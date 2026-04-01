/**
 * /api/users
 *
 * GET    — list all members in caller's org (admin only)
 * POST   — update a member's role (admin only)
 * DELETE — remove a member from the org (admin only)
 *
 * Auth is verified via the cookie client; all DB writes use the admin client
 * to avoid RLS edge cases (e.g. updating another user's profile row).
 */
import { NextResponse } from 'next/server'
import { createServerClient, createServerAdminClient } from '@/lib/supabase/server'
import type { ApiError } from '@/types'

// ─── GET /api/users ───────────────────────────────────────────────────────────
export async function GET() {
  try {
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json<ApiError>({ error: 'Unauthorized' }, { status: 401 })

    const admin = createServerAdminClient()

    // Fetch caller's profile (admin client — reliable regardless of RLS state)
    const { data: myProfile } = await admin
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single()

    if (!myProfile?.org_id || myProfile.role !== 'admin') {
      return NextResponse.json<ApiError>({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: members, error } = await admin
      .from('profiles')
      .select('id, full_name, avatar_url, role, created_at')
      .eq('org_id', myProfile.org_id)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json<ApiError>({ error: error.message }, { status: 500 })

    return NextResponse.json({ members })

  } catch (err) {
    console.error('GET /api/users error:', err)
    return NextResponse.json<ApiError>({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST /api/users — update role ───────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json<ApiError>({ error: 'Unauthorized' }, { status: 401 })

    const admin = createServerAdminClient()

    const { data: myProfile } = await admin
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single()

    if (!myProfile?.org_id || myProfile.role !== 'admin') {
      return NextResponse.json<ApiError>({ error: 'Forbidden' }, { status: 403 })
    }

    const { user_id, role } = await request.json()
    if (!user_id || !['admin', 'rep', 'pending'].includes(role)) {
      return NextResponse.json<ApiError>({ error: 'Invalid user_id or role' }, { status: 400 })
    }

    // Verify target is in the same org
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('org_id')
      .eq('id', user_id)
      .single()

    if (targetProfile?.org_id !== myProfile.org_id) {
      return NextResponse.json<ApiError>({ error: 'User not in your organization' }, { status: 403 })
    }

    const { error } = await admin
      .from('profiles')
      .update({ role })
      .eq('id', user_id)

    if (error) return NextResponse.json<ApiError>({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('POST /api/users error:', err)
    return NextResponse.json<ApiError>({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── DELETE /api/users — remove from org ─────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json<ApiError>({ error: 'Unauthorized' }, { status: 401 })

    const admin = createServerAdminClient()

    const { data: myProfile } = await admin
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single()

    if (!myProfile?.org_id || myProfile.role !== 'admin') {
      return NextResponse.json<ApiError>({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    if (!user_id || user_id === user.id) {
      return NextResponse.json<ApiError>({ error: 'Cannot remove yourself' }, { status: 400 })
    }

    const { error } = await admin
      .from('profiles')
      .update({ org_id: null, role: 'pending' })
      .eq('id', user_id)
      .eq('org_id', myProfile.org_id)

    if (error) return NextResponse.json<ApiError>({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('DELETE /api/users error:', err)
    return NextResponse.json<ApiError>({ error: 'Internal server error' }, { status: 500 })
  }
}
