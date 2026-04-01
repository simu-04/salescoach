/**
 * /api/recall/calendar
 *
 * POST   ?provider=google|microsoft
 *        Register an OAuth token with Recall + persist connection in DB.
 *        Called by the Google and Microsoft OAuth callbacks.
 *
 * DELETE ?provider=google|microsoft
 *        Remove token from Recall + delete from DB.
 *        Called by the settings UI disconnect buttons.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServerAdminClient } from '@/lib/supabase/server'
import {
  connectGoogleCalendar,
  connectMicrosoftCalendar,
  disconnectCalendar,
} from '@/lib/recall'
import type { ApiError } from '@/types'

// ─── POST: Connect a calendar ─────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json<ApiError>({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single()

    if (!profile?.org_id) {
      return NextResponse.json<ApiError>(
        { error: 'You must be in an organisation to connect a calendar.' },
        { status: 403 }
      )
    }

    if (profile.role === 'pending') {
      return NextResponse.json<ApiError>(
        { error: 'Your account is pending admin approval.' },
        { status: 403 }
      )
    }

    // provider query param: "google" (default) | "microsoft"
    const provider = (req.nextUrl.searchParams.get('provider') ?? 'google') as 'google' | 'microsoft'
    if (provider !== 'google' && provider !== 'microsoft') {
      return NextResponse.json<ApiError>({ error: 'Invalid provider' }, { status: 400 })
    }

    const body = await req.json()
    const { access_token, refresh_token, expiry } = body as {
      access_token:  string
      refresh_token?: string
      expiry?:       string
    }

    if (!access_token) {
      return NextResponse.json<ApiError>({ error: 'access_token is required' }, { status: 400 })
    }

    // Register token with Recall
    const recallCalendarUser =
      provider === 'google'
        ? await connectGoogleCalendar({ access_token, refresh_token, expiry })
        : await connectMicrosoftCalendar({ access_token, refresh_token, expiry })

    // Persist to DB — upsert on (user_id, provider) so reconnecting replaces stale token
    const adminClient = createServerAdminClient()
    const { error: upsertError } = await adminClient
      .from('calendar_connections')
      .upsert(
        {
          user_id:            user.id,
          org_id:             profile.org_id,
          recall_calendar_id: recallCalendarUser.id,
          provider,
        },
        { onConflict: 'user_id,provider' }
      )

    if (upsertError) {
      // Recall token registered but we failed to persist — clean up to avoid orphan
      await disconnectCalendar(recallCalendarUser.id).catch(console.error)
      console.error('[Calendar Connect] DB upsert failed:', upsertError.message)
      return NextResponse.json<ApiError>(
        { error: 'Failed to save calendar connection', details: upsertError.message },
        { status: 500 }
      )
    }

    console.log(
      `[Calendar Connect] User ${user.id} connected ${provider} calendar → Recall ID: ${recallCalendarUser.id}`
    )
    return NextResponse.json({ success: true, provider, recall_calendar_id: recallCalendarUser.id })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Calendar Connect] Error:', message)
    return NextResponse.json<ApiError>({ error: message }, { status: 500 })
  }
}

// ─── DELETE: Disconnect a calendar ───────────────────────────────────────────

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json<ApiError>({ error: 'Unauthorized' }, { status: 401 })
    }

    const provider = (req.nextUrl.searchParams.get('provider') ?? 'google') as 'google' | 'microsoft'
    if (provider !== 'google' && provider !== 'microsoft') {
      return NextResponse.json<ApiError>({ error: 'Invalid provider' }, { status: 400 })
    }

    const adminClient = createServerAdminClient()

    const { data: connection, error: fetchError } = await adminClient
      .from('calendar_connections')
      .select('recall_calendar_id')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single()

    if (fetchError || !connection) {
      return NextResponse.json<ApiError>({ error: 'No calendar connection found' }, { status: 404 })
    }

    // Remove from Recall first (idempotent — won't throw on 404)
    await disconnectCalendar(connection.recall_calendar_id)

    const { error: deleteError } = await adminClient
      .from('calendar_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider)

    if (deleteError) {
      console.error('[Calendar Disconnect] DB delete failed:', deleteError.message)
      return NextResponse.json<ApiError>(
        { error: 'Failed to delete calendar connection', details: deleteError.message },
        { status: 500 }
      )
    }

    console.log(`[Calendar Disconnect] User ${user.id} disconnected ${provider} calendar`)
    return NextResponse.json({ success: true })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Calendar Disconnect] Error:', message)
    return NextResponse.json<ApiError>({ error: message }, { status: 500 })
  }
}
