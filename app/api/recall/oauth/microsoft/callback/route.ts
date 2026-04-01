/**
 * GET /api/recall/oauth/microsoft/callback
 *
 * Microsoft redirects here after OAuth consent.
 * Steps:
 *   1. Exchange auth code for access + refresh tokens
 *   2. POST tokens to /api/recall/calendar?provider=microsoft
 *   3. Redirect to settings page with success/error param
 *
 * Required env vars:
 *   MICROSOFT_CLIENT_ID
 *   MICROSOFT_CLIENT_SECRET
 *   NEXT_PUBLIC_APP_URL
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = req.nextUrl
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? origin
  const settingsUrl = `${appUrl}/settings/calendar`

  // ─── Check for OAuth error ───────────────────────────────────────────────
  const oauthError = searchParams.get('error')
  if (oauthError) {
    const desc = searchParams.get('error_description') ?? oauthError
    console.error('[MS OAuth Callback] Error from Microsoft:', desc)
    return NextResponse.redirect(`${settingsUrl}?error=${encodeURIComponent(desc)}`)
  }

  const code = searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(`${settingsUrl}?error=missing_code`)
  }

  const clientId     = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${settingsUrl}?error=microsoft_not_configured`)
  }

  const redirectUri = `${appUrl}/api/recall/oauth/microsoft/callback`

  try {
    // ─── Exchange code for tokens ────────────────────────────────────────
    const tokenRes = await fetch(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id:     clientId,
          client_secret: clientSecret,
          redirect_uri:  redirectUri,
          grant_type:    'authorization_code',
        }),
      }
    )

    if (!tokenRes.ok) {
      const body = await tokenRes.text()
      console.error('[MS OAuth Callback] Token exchange failed:', body)
      return NextResponse.redirect(`${settingsUrl}?error=token_exchange_failed`)
    }

    const tokens = await tokenRes.json() as {
      access_token:  string
      refresh_token?: string
      expires_in?:   number    // seconds
      token_type:    string
    }

    const expiry = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : undefined

    // ─── Register with Recall (provider=microsoft) ───────────────────────
    const connectRes = await fetch(`${appUrl}/api/recall/calendar?provider=microsoft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
      console.error('[MS OAuth Callback] Calendar connect failed:', body)
      return NextResponse.redirect(
        `${settingsUrl}?error=${encodeURIComponent((body as { error?: string }).error ?? 'connect_failed')}`
      )
    }

    return NextResponse.redirect(`${settingsUrl}?connected=microsoft`)

  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    console.error('[MS OAuth Callback] Unhandled error:', message)
    return NextResponse.redirect(`${settingsUrl}?error=${encodeURIComponent(message)}`)
  }
}
