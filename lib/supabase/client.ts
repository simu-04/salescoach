/**
 * Supabase browser-side client — uses @supabase/ssr.
 * Uses the anon key — safe to expose to the browser.
 * Used in client components for auth + direct Storage uploads.
 */
import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createSSRBrowserClient> | null = null

export function createBrowserClient() {
  if (client) return client
  client = createSSRBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return client
}
