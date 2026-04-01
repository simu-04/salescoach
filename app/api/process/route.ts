/**
 * POST /api/process
 *
 * Triggered after a file is uploaded to Supabase Storage (client-side).
 * Creates a call record, attaches user/org context, kicks off the pipeline.
 *
 * maxDuration: 300 seconds (Vercel Pro / Enterprise)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServerAdminClient } from '@/lib/supabase/server'
import { processCall } from '@/lib/pipeline'
import type { ProcessCallRequest, ApiError } from '@/types'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    // ─── Auth check ───────────────────────────────────────────────────────────
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json<ApiError>({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get profile for org_id + rep_name
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id, role, full_name')
      .eq('id', user.id)
      .single()

    if (!profile?.org_id) {
      return NextResponse.json<ApiError>(
        { error: 'You must join an organization before uploading calls.' },
        { status: 403 }
      )
    }

    if (profile.role === 'pending') {
      return NextResponse.json<ApiError>(
        { error: 'Your account is pending admin approval.' },
        { status: 403 }
      )
    }

    // ─── Validate input ───────────────────────────────────────────────────────
    const body: ProcessCallRequest = await req.json()
    const { storage_path, file_name, file_size } = body

    if (!storage_path || !file_name) {
      return NextResponse.json<ApiError>(
        { error: 'storage_path and file_name are required' },
        { status: 400 }
      )
    }

    // ─── Create call record (admin client to bypass RLS on insert edge cases) ─
    const adminClient = createServerAdminClient()
    const { data: call, error: insertError } = await adminClient
      .from('calls')
      .insert({
        file_name,
        storage_path,
        file_size: file_size ?? null,
        status: 'processing',
        user_id: user.id,
        org_id: profile.org_id,
        rep_name: profile.full_name ?? null,
      })
      .select('id')
      .single()

    if (insertError || !call) {
      console.error('Failed to create call record:', insertError)
      return NextResponse.json<ApiError>(
        { error: 'Failed to create call record', details: insertError?.message },
        { status: 500 }
      )
    }

    // ─── Run pipeline ──────────────────────────────────────────────────────────
    const result = await processCall({
      callId: call.id,
      storagePath: storage_path,
      fileName: file_name,
    })

    if (!result.success) {
      return NextResponse.json<ApiError>(
        { error: 'Pipeline failed', details: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, call_id: call.id }, { status: 200 })

  } catch (error) {
    console.error('Unexpected error in /api/process:', error)
    return NextResponse.json<ApiError>({ error: 'Internal server error' }, { status: 500 })
  }
}
