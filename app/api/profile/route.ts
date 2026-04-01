/**
 * PATCH /api/profile — update the current user's own profile fields.
 * Uses admin client server-side so we never hit RLS issues on self-update.
 */
import { NextResponse } from 'next/server'
import { createServerClient, createServerAdminClient } from '@/lib/supabase/server'
import type { ApiError } from '@/types'

export async function PATCH(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json<ApiError>({ error: 'Unauthorized' }, { status: 401 })

    const { full_name } = await request.json()

    const admin = createServerAdminClient()
    const { error } = await admin
      .from('profiles')
      .update({ full_name: full_name?.trim() || null })
      .eq('id', user.id)

    if (error) return NextResponse.json<ApiError>({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('PATCH /api/profile error:', err)
    return NextResponse.json<ApiError>({ error: 'Internal server error' }, { status: 500 })
  }
}
