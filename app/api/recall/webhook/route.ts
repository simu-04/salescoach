/**
 * POST /api/recall/webhook
 *
 * Recall.ai fires this endpoint when a bot's recording status changes.
 * We only act on `bot.status_change` events where status.code === "done".
 *
 * Flow:
 *   1. Verify HMAC signature (optional but strongly recommended in prod)
 *   2. Ignore all events except bot.status_change / done
 *   3. Get bot details (audio presigned URL + meeting metadata)
 *   4. Look up which org/user owns the calendar connection
 *   5. Create a call record
 *   6. Run processCallFromUrl (Deepgram → Claude → Supabase → Slack)
 *
 * Always return 200 — Recall retries on non-2xx, and we don't want double processing.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/server'
import { getBot, verifyWebhookSignature } from '@/lib/recall'
import { processCallFromUrl } from '@/lib/pipeline'
import type { RecallWebhookPayload } from '@/lib/recall'

export const maxDuration = 300

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ─── Read raw body (needed for HMAC verification) ───────────────────────────
  const rawBody = await req.text()
  const signatureHeader = req.headers.get('x-recall-signature-256')

  // ─── Verify signature if secret is configured ───────────────────────────────
  const webhookSecret = process.env.RECALL_WEBHOOK_SECRET
  if (webhookSecret) {
    if (!verifyWebhookSignature(rawBody, signatureHeader, webhookSecret)) {
      console.warn('[Recall Webhook] Invalid signature — rejecting')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  // ─── Parse payload ──────────────────────────────────────────────────────────
  let payload: RecallWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { event, data } = payload

  // ─── Only process bot.status_change → done ──────────────────────────────────
  if (event !== 'bot.status_change') {
    return NextResponse.json({ received: true, action: 'ignored', reason: `event=${event}` })
  }

  const statusCode = data?.status?.code
  if (statusCode !== 'done') {
    return NextResponse.json({ received: true, action: 'ignored', reason: `status=${statusCode}` })
  }

  const botId = data?.bot?.id
  if (!botId) {
    console.error('[Recall Webhook] Payload missing bot.id')
    return NextResponse.json({ received: true, error: 'Missing bot ID' })
  }

  console.log(`[Recall Webhook] Bot ${botId} is done — starting pipeline`)

  try {
    const supabase = createServerAdminClient()

    // ─── Fetch full bot details from Recall ─────────────────────────────────
    const bot = await getBot(botId)

    // ─── Get audio presigned URL ─────────────────────────────────────────────
    const audioUrl = bot.media_shortcuts?.audio_mixed?.data?.presigned_url
    if (!audioUrl) {
      // This can happen if the meeting had no audio (e.g. host didn't admit the bot)
      console.warn(`[Recall Webhook] Bot ${botId} has no audio — skipping`)
      return NextResponse.json({ received: true, action: 'skipped', reason: 'no_audio' })
    }

    // ─── Extract meeting context ─────────────────────────────────────────────
    const calMeeting = bot.calendar_meetings?.[0]
    const recallCalendarId = calMeeting?.calendar_user?.id

    if (!recallCalendarId) {
      console.warn(`[Recall Webhook] Bot ${botId} has no calendar_user — skipping`)
      return NextResponse.json({ received: true, action: 'skipped', reason: 'no_calendar_user' })
    }

    // Build a human-readable file name: "Meeting Title YYYY-MM-DD" or just title
    const rawTitle = calMeeting?.title ?? 'Untitled Meeting'
    const dateStr = calMeeting?.start_time
      ? new Date(calMeeting.start_time).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
    const meetingTitle = `${rawTitle} ${dateStr}`

    // ─── Resolve org + user from calendar_connections table ─────────────────
    const { data: connection, error: connError } = await supabase
      .from('calendar_connections')
      .select('user_id, org_id')
      .eq('recall_calendar_id', recallCalendarId)
      .single()

    if (connError || !connection) {
      // Calendar connected by someone we don't recognise — log and skip
      console.error(
        `[Recall Webhook] No calendar_connection for recall_calendar_id=${recallCalendarId}:`,
        connError?.message
      )
      return NextResponse.json({ received: true, action: 'skipped', reason: 'unknown_calendar_user' })
    }

    // Fetch rep name from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', connection.user_id)
      .single()

    const repName = profile?.full_name ?? null

    // ─── Create call record ─────────────────────────────────────────────────
    const { data: call, error: insertError } = await supabase
      .from('calls')
      .insert({
        file_name: meetingTitle,
        storage_path: null,           // Recall-sourced — no Supabase storage
        file_url: null,               // Presigned URLs expire; transcript stored in insights
        status: 'processing',
        user_id: connection.user_id,
        org_id: connection.org_id,
        rep_name: repName,
      })
      .select('id')
      .single()

    if (insertError || !call) {
      console.error('[Recall Webhook] Failed to create call record:', insertError?.message)
      return NextResponse.json({ received: true, error: 'DB insert failed' })
    }

    console.log(`[Recall Webhook] Created call ${call.id} for meeting "${meetingTitle}"`)

    // ─── Run pipeline ──────────────────────────────────────────────────────
    const result = await processCallFromUrl({
      callId: call.id,
      audioUrl,
      fileName: meetingTitle,
    })

    if (!result.success) {
      console.error(`[Recall Webhook] Pipeline failed for call ${call.id}:`, result.error)
      // Call is already marked failed inside processCallFromUrl
    } else {
      console.log(`[Recall Webhook] Pipeline complete for call ${call.id}`)
    }

    return NextResponse.json({ received: true, call_id: call.id })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Recall Webhook] Unhandled error:', message)
    // Still return 200 — prevents Recall from retrying a broken payload indefinitely
    return NextResponse.json({ received: true, error: message })
  }
}
