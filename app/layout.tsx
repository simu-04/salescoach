import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { createServerClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/Sidebar'
import type { Profile, Organization } from '@/types'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Sales Intelligence',
  description: 'Know exactly why deals are won and lost.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Try to load the current user's profile + org for the sidebar
  let profile: Profile | null = null
  let org: Organization | null = null

  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('*, organizations(*)')
        .eq('id', user.id)
        .single()

      if (data) {
        const { organizations: orgData, ...profileData } = data
        profile = profileData as Profile
        org     = (orgData as Organization) ?? null
      }
    }
  } catch {
    // Not authenticated — middleware handles the redirect
  }

  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 text-white antialiased`}>
        {profile ? (
          /* App shell: fixed sidebar + scrollable content */
          <div className="flex h-screen overflow-hidden">
            <Sidebar profile={profile} org={org} />
            <main className="flex-1 overflow-y-auto">
              <div className="max-w-5xl mx-auto px-6 py-8">
                {children}
              </div>
            </main>
          </div>
        ) : (
          /* Auth / onboarding pages own their full-screen layout */
          children
        )}
      </body>
    </html>
  )
}
