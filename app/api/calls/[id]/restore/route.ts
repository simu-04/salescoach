/**
 * POST /api/calls/[id]/restore — admin only
 * Restores a soft-deleted call from the trash.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServerAdminClient } from '@/lib/supabase/server'
import type { ApiError } from '@/types'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json<ApiError>({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json<ApiError>({ error: 'Admin only' }, { status: 403 })
    }

    const adminClient = createServerAdminClient()
    const { error } = await adminClient
      .from('calls')
      .update({ deleted_at: null })
      .eq('id', params.id)

    if (error) return NextResponse.json<ApiError>({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json<ApiError>({ error: 'Internal server error' }, { status: 500 })
  }
}
