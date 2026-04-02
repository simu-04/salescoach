/**
 * /api/calls/[id]
 *
 * GET    — single call + insights (RLS-scoped)
 * DELETE — soft-delete (moves to trash). Owner or admin only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServerAdminClient } from '@/lib/supabase/server'
import type { ApiError } from '@/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json<ApiError>({ error: 'Unauthorized' }, { status: 401 })

    const { id } = params

    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('*')
      .eq('id', id)
      .single()

    if (callError) {
      if (callError.code === 'PGRST116') {
        return NextResponse.json<ApiError>({ error: 'Call not found' }, { status: 404 })
      }
      return NextResponse.json<ApiError>(
        { error: 'Failed to fetch call', details: callError.message },
        { status: 500 }
      )
    }

    const { data: insights } = await supabase
      .from('insights')
      .select('*')
      .eq('call_id', id)
      .single()

    return NextResponse.json({ call, insights: insights ?? null })

  } catch (error) {
    console.error(`GET /api/calls/${params.id} error:`, error)
    return NextResponse.json<ApiError>({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json<ApiError>({ error: 'Unauthorized' }, { status: 401 })

    const { id } = params

    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id, user_id, org_id')
      .eq('id', id)
      .single()

    if (callError || !call) {
      return NextResponse.json<ApiError>({ error: 'Call not found' }, { status: 404 })
    }

    // Soft-delete: set deleted_at timestamp
    const adminClient = createServerAdminClient()
    const { error: updateError } = await adminClient
      .from('calls')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json<ApiError>({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, trashed: true })

  } catch (error) {
    console.error(`DELETE /api/calls/${params.id} error:`, error)
    return NextResponse.json<ApiError>({ error: 'Internal server error' }, { status: 500 })
  }
}
