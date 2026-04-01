/**
 * Supabase server-side clients — Next.js 14 App Router edition.
 *
 * createServerClient()      → cookie-based auth client (respects RLS + user session)
 * createServerAdminClient() → service-role client (bypasses RLS, for pipeline work)
 */
import { createServerClient as createSSRClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// ─── Auth-aware server client ─────────────────────────────────────────────────
export function createServerClient() {
  const cookieStore = cookies()
  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // In Server Components we can't set cookies — expected, not an error
          }
        },
      },
    }
  )
}

// ─── Service-role admin client (bypasses RLS) ─────────────────────────────────
// Use ONLY in API routes for pipeline work. NEVER in browser code.
export function createServerAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.')
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
