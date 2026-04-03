/**
 * Recall.ai API client
 *
 * Handles calendar connections (Calendar V2) and bot queries (V1).
 * Region: Asia Pacific (Tokyo) - ap-northeast-1
 * Docs: https://docs.recall.ai
 */
import { createHmac, timingSafeEqual } from 'crypto'

// Bot and Webhook endpoints use V1
const RECALL_API_V1_BASE = 'https://ap-northeast-1.recall.ai/api/v1'

// Calendar Integration endpoints use V2
const RECALL_API_V2_BASE = 'https://ap-northeast-1.recall.ai/api/v2'

function getApiKey(): string {
  const key = process.env.RECALL_API_KEY
  if (!key) throw new Error('RECALL_API_KEY environment variable is not set')
  return key
}

function getOAuthCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in your environment variables')
  }
  return { clientId, clientSecret }
}

function headers(): HeadersInit {
  return {
    Authorization: `Token ${getApiKey()}`,
    'Content-Type': 'application/json',
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecallCalendarUser {
  id: string               // e.g. "cal_user_abc123" — store this in your DB
  platform: string         // "google_calendar" | "microsoft_outlook"
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
    audio_mixed?: { data: { presigned_url: string } | null } | null
    video_mixed?: { data: { presigned_url: string } | null } | null
    speaker_timeline?: { data: { presigned_url: string } | null } | null
  }
  calendar_meetings?: Array<{
    calendar_user: { id: string; external_id?: string }
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

// ─── Calendar V2 ──────────────────────────────────────────────────────────────

export type CalendarProvider = 'google' | 'microsoft'

interface CalendarTokenData {
  access_token?: string
  refresh_token: string    // REQUIRED for Recall Calendar V2
  expiry?: string
}

/**
 * Internal: POST refresh token to Recall V2.
 * Recall platform values: "google_calendar" | "microsoft_outlook"
 */
async function connectCalendarToken(
  recallPlatform: 'google_calendar' | 'microsoft_outlook',
  tokenData: CalendarTokenData
): Promise<RecallCalendarUser> {
  if (!tokenData.refresh_token) {
    throw new Error('A refresh_token is required to connect a calendar using Recall V2.')
  }

  // Fetch your app credentials needed for Recall to manage the token lifecycle
  const { clientId, clientSecret } = getOAuthCredentials()

  const res = await fetch(`${RECALL_API_V2_BASE}/calendars/`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      platform: recallPlatform,
      oauth_client_id: clientId,
      oauth_client_secret: clientSecret,
      oauth_refresh_token: tokenData.refresh_token,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Recall connectCalendar (${recallPlatform}) failed [${res.status}]: ${body}`)
  }

  return res.json() as Promise<RecallCalendarUser>
}

/**
 * Register a Google Calendar refresh token with Recall.
 */
export function connectGoogleCalendar(tokenData: CalendarTokenData): Promise<RecallCalendarUser> {
  return connectCalendarToken('google_calendar', tokenData)
}

/**
 * Register an Outlook/M365 refresh token with Recall.
 */
export function connectMicrosoftCalendar(tokenData: CalendarTokenData): Promise<RecallCalendarUser> {
  return connectCalendarToken('microsoft_outlook', tokenData)
}

/**
 * Delete a calendar connection from Recall.
 * Uses the V2 REST route.
 */
export async function disconnectCalendar(recallCalendarId: string): Promise<void> {
  const res = await fetch(`${RECALL_API_V2_BASE}/calendars/${recallCalendarId}/`, {
    method: 'DELETE',
    headers: headers(),
  })

  if (!res.ok && res.status !== 404) {
    const body = await res.text()
    throw new Error(`Recall disconnectCalendar failed [${res.status}]: ${body}`)
  }
}

// ─── Bot V1 ───────────────────────────────────────────────────────────────────

/**
 * Fetch full bot details.
 */
export async function getBot(botId: string): Promise<RecallBot> {
  const res = await fetch(`${RECALL_API_V1_BASE}/bot/${botId}/`, {
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
    return false
  }
}
