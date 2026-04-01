/**
 * GET /api/recall/oauth/callback
 *
 * Google redirects here after the user approves the consent screen.
 * Steps:
 *   1. Exchange auth code for access + refresh tokens
 *   2. POST tokens to /api/recall/calendar (which registers with Recall + saves to DB)
 *   3. Redirect back to settings page with success or error query param
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   NEXT_PUBLIC_APP_URL
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = req.nextUrl
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin
  const settingsUrl = `${appUrl}/settings/calendar`

  // ─── Check for OAuth error from Google ──────────────────────────────────
  const oauthError = searchParams.get('error')
  if (oauthError) {
    console.error('[OAuth Callback] Google returned error:', oauthError)
    return NextResponse.redirect(`${settingsUrl}?error=${encodeURIComponent(oauthError)}`)
  }

  const code = searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(`${settingsUrl}?error=missing_code`)
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${settingsUrl}?error=google_not_configured`)
  }

  const redirectUri = `${appUrl}/api/recall/oauth/callback`

  try {
    // ─── Exchange code for tokens ──────────────────────────────────────────
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const body = await tokenRes.text()
      console.error('[OAuth Callback] Token exchange failed:', body)
      return NextResponse.redirect(`${settingsUrl}?error=token_exchange_failed`)
    }

    const tokens = await tokenRes.json() as {
      access_token: string
      refresh_token?: string
      expires_in?: number   // seconds from now
      token_type: string
    }

    // Build ISO expiry string for Recall
    const expiry = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : undefined

    // ─── Register with Recall via our internal API ───────────────────────
    // Use an absolute URL so fetch works in server context
    const connectRes = await fetch(`${appUrl}/api/recall/calendar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward the request cookies so our API route can authenticate the user
        Cookie: req.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry,
      }),
    })

    if (!connectRes.ok) {
      const body = await connectRes.json().catch(() => ({ error: 'unknown' }))
      console.error('[OAuth Callback] Calendar connect failed:', body)
      return NextResponse.redirect(
        `${settingsUrl}?error=${encodeURIComponent((body as { error?: string }).error ?? 'connect_failed')}`
      )
    }

    // ─── Success ──────────────────────────────────────────────────────────
    return NextResponse.redirect(`${settingsUrl}?connected=1`)

  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    console.error('[OAuth Callback] Unhandled error:', message)
    return NextResponse.redirect(`${settingsUrl}?error=${encodeURIComponent(message)}`)
  }
}
