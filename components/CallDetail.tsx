/**
 * CallDetail — full analysis view for a single call.
 * The manager gets everything they need to coach the rep.
 */
'use client'

import { useState } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { VerdictBadge } from '@/components/VerdictBadge'
import { TalkRatioBar } from '@/components/TalkRatioBar'
import type { CallRow, InsightRow } from '@/types'

interface CallDetailProps {
  call: CallRow
  insights: InsightRow | null
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
        {title}
      </h3>
      {children}
    </div>
  )
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

export function CallDetail({ call, insights }: CallDetailProps) {
  const [showTranscript, setShowTranscript] = useState(false)

  // Processing state
  if (call.status === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <p className="text-white font-medium">Analyzing call...</p>
        <p className="text-sm text-slate-400">Deepgram is transcribing, Claude is reading. 30–90 seconds.</p>
      </div>
    )
  }

  // Failed state
  if (call.status === 'failed') {
    return (
      <div className="bg-red-950/30 border border-red-900 rounded-xl p-8 text-center">
        <p className="text-red-400 font-medium mb-2">Analysis failed</p>
        <p className="text-sm text-slate-400">{call.error_message ?? 'Unknown error'}</p>
      </div>
    )
  }

  if (!insights) {
    return (
      <div className="text-center py-12 text-slate-400">
        No insight data found for this call.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <VerdictBadge verdict={call.verdict} size="lg" />
              <h1 className="text-lg font-semibold text-white truncate max-w-sm">
                {call.file_name}
              </h1>
            </div>
            <p className="text-slate-300">{insights.verdict_reason}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm text-slate-400">
              {format(new Date(call.created_at), 'MMM d, yyyy')}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
            </p>
            {call.duration_seconds && (
              <p className="text-xs text-slate-600 mt-1">
                {formatDuration(call.duration_seconds)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Top Recommendation — the #1 thing ────────────────────────── */}
      <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl p-5">
        <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
          Top Recommendation
        </p>
        <p className="text-white font-medium text-lg leading-relaxed">
          {insights.top_recommendation}
        </p>
      </div>

      {/* ── Summary ──────────────────────────────────────────────────── */}
      <SectionCard title="Call Summary">
        <p className="text-slate-300 leading-relaxed">{insights.summary}</p>
      </SectionCard>

      {/* ── Talk Ratio ───────────────────────────────────────────────── */}
      <SectionCard title="Talk Ratio">
        <TalkRatioBar
          repRatio={insights.talk_ratio.rep}
          prospectRatio={insights.talk_ratio.prospect}
        />
        <p className="text-xs text-slate-500 mt-3">
          Ideal: Rep 40–50%. Over 60% means the rep is pitching, not discovering.
        </p>
      </SectionCard>

      {/* ── Risk Signals ─────────────────────────────────────────────── */}
      {insights.risk_signals.length > 0 && (
        <SectionCard title="Risk Signals">
          <ul className="space-y-3">
            {insights.risk_signals.map((signal, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="text-red-400 mt-0.5 shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </span>
                <p className="text-slate-300 text-sm">{signal}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* ── Objections ───────────────────────────────────────────────── */}
      {insights.objections.length > 0 && (
        <SectionCard title={`Objections Raised (${insights.objections.length})`}>
          <ul className="space-y-2">
            {insights.objections.map((obj, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="text-amber-400 font-bold text-sm shrink-0 mt-0.5">Q{i + 1}</span>
                <p className="text-slate-300 text-sm">{obj}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* ── Competitor Mentions ───────────────────────────────────────── */}
      {insights.competitor_mentions.length > 0 && (
        <SectionCard title="Competitor Mentions">
          <div className="flex flex-wrap gap-2">
            {insights.competitor_mentions.map((comp, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-sm text-slate-300"
              >
                {comp}
              </span>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Transcript ───────────────────────────────────────────────── */}
      {insights.transcript && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800/50 transition-colors"
          >
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Full Transcript
            </span>
            <svg
              className={`w-4 h-4 text-slate-500 transition-transform ${showTranscript ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showTranscript && (
            <div className="px-5 pb-5 border-t border-slate-800">
              <pre className="text-sm text-slate-400 whitespace-pre-wrap font-sans leading-relaxed max-h-96 overflow-y-auto mt-4">
                {insights.transcript}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
