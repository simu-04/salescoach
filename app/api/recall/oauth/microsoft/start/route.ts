/**
 * GET /api/recall/oauth/microsoft/start
 *
 * Redirects the user to Microsoft's OAuth consent screen.
 * Requests Calendars.Read + offline_access so Recall can see meetings
 * and refresh the token automatically.
 *
 * Required env vars:
 *   MICROSOFT_CLIENT_ID   (Azure AD App Registration → Application (client) ID)
 *   NEXT_PUBLIC_APP_URL
 *
 * Azure setup:
 *   portal.azure.com → App registrations → new app
 *   API permissions: Microsoft Graph → Calendars.Read, User.Read, offline_access
 *   Authentication → add redirect URI: https://your-app.vercel.app/api/recall/oauth/microsoft/callback
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin))
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'MICROSOFT_CLIENT_ID is not configured' }, { status: 500 })
  }

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const redirectUri = `${appUrl}/api/recall/oauth/microsoft/callback`

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope: [
      'https://graph.microsoft.com/Calendars.Read',
      'https://graph.microsoft.com/User.Read',
      'offline_access',
    ].join(' '),
    response_mode: 'query',
    state:         user.id,   // carry user ID through to callback
  })

  // Use the common endpoint so both personal and work accounts work
  const msOAuthUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
  return NextResponse.redirect(msOAuthUrl)
}
