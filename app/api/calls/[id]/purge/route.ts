/**
 * DELETE /api/calls/[id]/purge — admin only
 * Permanently deletes a trashed call + its storage file. Irreversible.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServerAdminClient } from '@/lib/supabase/server'
import type { ApiError } from '@/types'

export async function DELETE(
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

    // Get storage path before deleting
    const { data: call } = await adminClient
      .from('calls')
      .select('storage_path, deleted_at')
      .eq('id', params.id)
      .single()

    if (!call?.deleted_at) {
      return NextResponse.json<ApiError>(
        { error: 'Call must be in trash before permanent deletion' },
        { status: 400 }
      )
    }

    // Delete insights first
    await adminClient.from('insights').delete().eq('call_id', params.id)

    // Delete call record
    const { error: deleteError } = await adminClient.from('calls').delete().eq('id', params.id)
    if (deleteError) return NextResponse.json<ApiError>({ error: deleteError.message }, { status: 500 })

    // Remove storage file
    if (call.storage_path) {
      await adminClient.storage.from('call-recordings').remove([call.storage_path])
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json<ApiError>({ error: 'Internal server error' }, { status: 500 })
  }
}
