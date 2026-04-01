/**
 * /api/calls/[id]
 *
 * GET    — single call + insights (RLS-scoped)
 * DELETE — delete call + its storage file (owner or admin)
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

    // Fetch call to verify ownership + get storage path
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id, user_id, org_id, storage_path')
      .eq('id', id)
      .single()

    if (callError || !call) {
      return NextResponse.json<ApiError>({ error: 'Call not found' }, { status: 404 })
    }

    // Use admin client for delete operations (bypasses RLS for cleanliness)
    const adminClient = createServerAdminClient()

    // Delete insights first (foreign key)
    await adminClient.from('insights').delete().eq('call_id', id)

    // Delete call record
    const { error: deleteError } = await adminClient.from('calls').delete().eq('id', id)
    if (deleteError) {
      return NextResponse.json<ApiError>({ error: deleteError.message }, { status: 500 })
    }

    // Delete storage file (best-effort — don't fail if already gone)
    if (call.storage_path) {
      await adminClient.storage
        .from('call-recordings')
        .remove([call.storage_path])
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error(`DELETE /api/calls/${params.id} error:`, error)
    return NextResponse.json<ApiError>({ error: 'Internal server error' }, { status: 500 })
  }
}
