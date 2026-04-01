/**
 * Recall.ai API client
 *
 * Handles calendar connections (Calendar V2) and bot queries.
 * Used by:
 *   - /api/recall/oauth/callback  → connectGoogleCalendar()
 *   - /api/recall/calendar        → disconnectCalendar()
 *   - /api/recall/webhook         → getBot() + verifyWebhookSignature()
 *
 * Docs: https://docs.recall.ai
 */
import { createHmac, timingSafeEqual } from 'crypto'

// Recall region — change to eu-west-2 if your account is EU
const RECALL_API_BASE = 'https://us-west-2.recall.ai/api/v1'

function getApiKey(): string {
  const key = process.env.RECALL_API_KEY
  if (!key) throw new Error('RECALL_API_KEY environment variable is not set')
  return key
}

function headers(): HeadersInit {
  return {
    Authorization: `Token ${getApiKey()}`,
    'Content-Type': 'application/json',
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecallCalendarUser {
  id: string               // e.g. "cal_user_abc123" — store this in calendar_connections
  platform: string         // "google_calendar"
  created_at: string
  status?: string          // "active" | "expired" | "invalid"
}

export interface RecallBot {
  id: string
  meeting_url: string
  status_changes: Array<{
    code: string           // "ready" | "joining" | "in_call" | "done" | "error" | "fatal"
    created_at: string
    sub_code?: string
    message?: string
  }>
  media_shortcuts: {
    audio_mixed?: {
      data: { presigned_url: string } | null
    } | null
    video_mixed?: {
      data: { presigned_url: string } | null
    } | null
    speaker_timeline?: {
      data: { presigned_url: string } | null
    } | null
  }
  calendar_meetings?: Array<{
    calendar_user: {
      id: string           // The Recall calendar user ID — matches our stored recall_calendar_id
      external_id?: string // e.g. "user@gmail.com"
    }
    start_time: string
    end_time: string
    title?: string
    meeting_url?: string
  }>
  metadata?: Record<string, string>
}

export interface RecallWebhookPayload {
  event: string
  data: {
    bot: RecallBot
    status: {
      code: string
      sub_code?: string
      message?: string
      created_at: string
    }
  }
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

/**
 * Register a Google Calendar OAuth token with Recall.
 * Returns a RecallCalendarUser whose `id` we persist in `calendar_connections`.
 * Recall will auto-schedule recording bots for all future meetings with a join link.
 */
export async function connectGoogleCalendar(tokenData: {
  access_token: string
  refresh_token?: string
  expiry?: string           // ISO string e.g. "2026-04-01T12:00:00Z"
}): Promise<RecallCalendarUser> {
  const res = await fetch(`${RECALL_API_BASE}/calendar/v2/token/`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      platform: 'google_calendar',
      token_data: {
        access_token: tokenData.access_token,
        ...(tokenData.refresh_token && { refresh_token: tokenData.refresh_token }),
        ...(tokenData.expiry && { expiry: tokenData.expiry }),
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Recall connectGoogleCalendar failed [${res.status}]: ${body}`)
  }

  return res.json() as Promise<RecallCalendarUser>
}

/**
 * Delete a calendar token from Recall — bots will stop being auto-scheduled.
 * Idempotent: 404 is treated as success.
 */
export async function disconnectCalendar(recallCalendarId: string): Promise<void> {
  const res = await fetch(`${RECALL_API_BASE}/calendar/v2/token/${recallCalendarId}/`, {
    method: 'DELETE',
    headers: headers(),
  })

  if (!res.ok && res.status !== 404) {
    const body = await res.text()
    throw new Error(`Recall disconnectCalendar failed [${res.status}]: ${body}`)
  }
}

// ─── Bot ──────────────────────────────────────────────────────────────────────

/**
 * Fetch full bot details — includes media_shortcuts with presigned audio URL
 * once the bot's status is "done".
 */
export async function getBot(botId: string): Promise<RecallBot> {
  const res = await fetch(`${RECALL_API_BASE}/bot/${botId}/`, {
    headers: headers(),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Recall getBot failed [${res.status}]: ${body}`)
  }

  return res.json() as Promise<RecallBot>
}

// ─── Webhook verification ─────────────────────────────────────────────────────

/**
 * Verify the HMAC-SHA256 signature Recall sends on every webhook.
 * `signatureHeader` is the value of the `X-Recall-Signature-256` header.
 * Set RECALL_WEBHOOK_SECRET in your Vercel env to the secret from the Recall dashboard.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false

  const expected =
    'sha256=' +
    createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex')

  try {
    return timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(signatureHeader, 'utf8')
    )
  } catch {
    // Buffers different length → invalid
    return false
  }
}
