/**
 * Call detail page.
 * Full analysis: verdict, summary, recommendation, objections, risk signals, talk ratio, transcript.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { CallDetail } from '@/components/CallDetail'
import type { CallRow, InsightRow } from '@/types'

// Poll for updates while a call is still processing
// Next.js revalidate: processing calls get fresh data on each request
export async function generateMetadata({ params }: { params: { id: string } }) {
  return {
    title: `Call Analysis | Sales Intel`,
  }
}

async function getCallData(id: string): Promise<{
  call: CallRow
  insights: InsightRow | null
} | null> {
  const supabase = createServerClient()

  const { data: call, error } = await supabase
    .from('calls')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !call) return null

  const { data: insights } = await supabase
    .from('insights')
    .select('*')
    .eq('call_id', id)
    .single()

  return { call, insights: insights ?? null }
}

export default async function CallDetailPage({ params }: { params: { id: string } }) {
  const data = await getCallData(params.id)

  if (!data) {
    notFound()
  }

  const { call, insights } = data

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">
          Dashboard
        </Link>
        <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-slate-300 truncate max-w-xs">{call.file_name}</span>
      </div>

      <CallDetail call={call} insights={insights} />

      {/* If still processing, auto-refresh every 10 seconds */}
      {call.status === 'processing' && (
        <AutoRefresh />
      )}
    </div>
  )
}

// Client component to auto-refresh the page while a call is processing
function AutoRefresh() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          setTimeout(function() {
            window.location.reload();
          }, 10000);
        `,
      }}
    />
  )
}
