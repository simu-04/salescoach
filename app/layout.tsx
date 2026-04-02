import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { createServerClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/AppShell'
import { ThemeProvider } from '@/components/ThemeProvider'
import { NavigationProgress } from '@/components/NavigationProgress'
import type { Profile, Organization } from '@/types'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SalesCoach — Deal Intelligence',
  description: 'Know exactly why deals are won and lost.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
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
    // Not authenticated — middleware handles redirect
  }

  return (
    // suppressHydrationWarning: ThemeProvider sets data-theme on mount
    // which differs from server HTML — this suppresses the mismatch warning
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`} style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <ThemeProvider>
          <NavigationProgress />
          {profile ? (
            <AppShell profile={profile} org={org}>
              {children}
            </AppShell>
          ) : (
            children
          )}
        </ThemeProvider>
      </body>
    </html>
  )
}
