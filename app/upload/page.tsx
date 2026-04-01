/**
 * Upload page.
 * Deliberately simple — one action, zero distraction.
 */
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { UploadForm } from '@/components/UploadForm'

export const dynamic = 'force-dynamic'

export default async function UploadPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) redirect('/onboarding')
  if (profile.role === 'pending') redirect('/dashboard')
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-12">
      <div className="text-center mb-10">
        <h1 className="text-2xl font-bold text-white mb-3">
          Upload a call recording
        </h1>
        <p className="text-slate-400 max-w-md">
          Drop in any sales call. In 60–90 seconds you'll have a verdict,
          objection map, risk signals, and one coaching recommendation.
        </p>
      </div>

      <UploadForm />

      {/* Process transparency */}
      <div className="mt-12 grid grid-cols-3 gap-8 max-w-lg w-full">
        {[
          {
            step: '01',
            label: 'Transcribe',
            desc: 'Deepgram Nova-3 — speaker-labeled in seconds',
          },
          {
            step: '02',
            label: 'Analyze',
            desc: 'Claude reads the call like a senior sales coach',
          },
          {
            step: '03',
            label: 'Deliver',
            desc: 'Dashboard update + Slack notification',
          },
        ].map((item) => (
          <div key={item.step} className="text-center">
            <p className="text-xs font-bold text-slate-600 mb-1">{item.step}</p>
            <p className="text-sm font-semibold text-white mb-1">{item.label}</p>
            <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
