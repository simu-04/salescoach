/**
 * GET /api/recall/oauth/start
 *
 * Redirects the user to Google's OAuth consent screen.
 * Requests calendar.readonly scope so Recall can see the user's meetings.
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID
 *   NEXT_PUBLIC_APP_URL  (used to build the redirect_uri)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Must be authenticated
  const supabase = createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    const loginUrl = new URL('/login', req.nextUrl.origin)
    return NextResponse.redirect(loginUrl)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID is not configured' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const redirectUri = `${appUrl}/api/recall/oauth/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
    access_type: 'offline',   // request refresh_token
    prompt: 'consent',        // always show consent to get refresh_token
    state: user.id,           // pass user ID through so callback can verify
  })

  const googleOAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  return NextResponse.redirect(googleOAuthUrl)
}
