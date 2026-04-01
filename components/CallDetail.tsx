/**
 * CallDetail — full analysis for a single call.
 * Transcript: groups consecutive same-speaker utterances into paragraphs,
 * Rep gets indigo accent, Prospect gets slate accent.
 */
'use client'

import { useState, useMemo } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { VerdictBadge } from '@/components/VerdictBadge'
import { TalkRatioBar } from '@/components/TalkRatioBar'
import type { CallRow, InsightRow } from '@/types'

interface CallDetailProps {
  call:     CallRow
  insights: InsightRow | null
}

// ── Transcript parser ────────────────────────────────────────────────────
interface Paragraph {
  speaker:  string
  isRep:    boolean
  lines:    string[]
}

/**
 * Transcript format from Deepgram: "Rep: text\n\nProspect: text\n\n..."
 * Each double-newline-separated block is one utterance.
 * We group consecutive same-speaker utterances into one paragraph.
 */
function parseTranscript(raw: string): Paragraph[] {
  // Split on double newlines (utterance boundaries)
  const utterances = raw.split(/\n\n+/).map(u => u.trim()).filter(Boolean)
  const paragraphs: Paragraph[] = []

  for (const utterance of utterances) {
    // Match "Speaker: text" — speaker label can be multi-word (e.g. "Speaker 0")
    const match = utterance.match(/^([^:\n]+):\s*(.+)$/s)
    if (!match) {
      // No speaker label — append to last paragraph or create generic one
      if (paragraphs.length > 0) {
        paragraphs[paragraphs.length - 1].lines.push(utterance)
      } else {
        paragraphs.push({ speaker: 'Unknown', isRep: false, lines: [utterance] })
      }
      continue
    }

    const [, speakerRaw, text] = match
    const speaker = speakerRaw.trim()
    const isRep   = /^(rep|sales|agent|speaker\s*0)$/i.test(speaker)

    const last = paragraphs[paragraphs.length - 1]
    if (last && last.speaker.toLowerCase() === speaker.toLowerCase()) {
      // Same speaker — merge into existing paragraph
      last.lines.push(text.trim())
    } else {
      paragraphs.push({ speaker, isRep, lines: [text.trim()] })
    }
  }

  return paragraphs
}

// ── Sub-components ───────────────────────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'rgba(13,13,26,0.95)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(16px)' }}
    >
      <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--'
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

// ── Main component ───────────────────────────────────────────────────────
export function CallDetail({ call, insights }: CallDetailProps) {
  const [showTranscript, setShowTranscript] = useState(false)

  const parsedTranscript = useMemo(
    () => (insights?.transcript ? parseTranscript(insights.transcript) : []),
    [insights?.transcript]
  )

  if (call.status === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div
          className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(99,102,241,0.3)', borderTopColor: '#6366f1' }}
        />
        <p className="text-white font-medium text-lg">Analyzing call…</p>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Deepgram is transcribing, Claude is reading. 30–90 seconds.
        </p>
      </div>
    )
  }

  if (call.status === 'failed') {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
      >
        <p className="font-semibold text-lg mb-2" style={{ color: '#f87171' }}>Analysis failed</p>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{call.error_message ?? 'Unknown error'}</p>
      </div>
    )
  }

  if (!insights) {
    return (
      <div className="text-center py-12" style={{ color: 'rgba(255,255,255,0.4)' }}>
        No insight data found for this call.
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Header ──────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6"
        style={{ background: 'rgba(13,13,26,0.95)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(16px)' }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <VerdictBadge verdict={call.verdict} size="lg" />
              <h1 className="text-xl font-bold text-white truncate max-w-sm tracking-tight">
                {call.file_name}
              </h1>
            </div>
            <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {insights.verdict_reason}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {format(new Date(call.created_at), 'MMM d, yyyy')}
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
            </p>
            {call.duration_seconds && (
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {formatDuration(call.duration_seconds)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Top Recommendation ──────────────────────────────── */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}
      >
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#fbbf24' }}>
          Top Recommendation
        </p>
        <p className="text-white font-semibold text-lg leading-relaxed">
          {insights.top_recommendation}
        </p>
      </div>

      {/* ── Summary ─────────────────────────────────────────── */}
      <SectionCard title="Call Summary">
        <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {insights.summary}
        </p>
      </SectionCard>

      {/* ── Talk Ratio ──────────────────────────────────────── */}
      <SectionCard title="Talk Ratio">
        <TalkRatioBar repRatio={insights.talk_ratio.rep} prospectRatio={insights.talk_ratio.prospect} />
        <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Ideal: Rep 40–50%. Over 60% means pitching, not discovering.
        </p>
      </SectionCard>

      {/* ── Risk Signals ────────────────────────────────────── */}
      {insights.risk_signals.length > 0 && (
        <SectionCard title="Risk Signals">
          <ul className="space-y-3">
            {insights.risk_signals.map((signal, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 mt-0.5" style={{ color: '#f87171' }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </span>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{signal}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* ── Objections ──────────────────────────────────────── */}
      {insights.objections.length > 0 && (
        <SectionCard title={`Objections (${insights.objections.length})`}>
          <ul className="space-y-3">
            {insights.objections.map((obj, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="font-bold text-xs shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
                >
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{obj}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* ── Competitor Mentions ─────────────────────────────── */}
      {insights.competitor_mentions.length > 0 && (
        <SectionCard title="Competitor Mentions">
          <div className="flex flex-wrap gap-2">
            {insights.competitor_mentions.map((comp, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full text-sm font-medium"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                {comp}
              </span>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Transcript ──────────────────────────────────────── */}
      {insights.transcript && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(13,13,26,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Toggle header */}
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full flex items-center justify-between p-5 text-left transition-colors"
            style={{ borderBottom: showTranscript ? '1px solid rgba(255,255,255,0.07)' : 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Full Transcript
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {parsedTranscript.length} turns
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Legend */}
              {!showTranscript && (
                <div className="flex items-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#6366f1' }} />
                    Rep
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#64748b' }} />
                    Prospect
                  </span>
                </div>
              )}
              <svg
                className={`w-4 h-4 transition-transform ${showTranscript ? 'rotate-180' : ''}`}
                style={{ color: 'rgba(255,255,255,0.3)' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {/* Transcript body */}
          {showTranscript && (
            <div className="p-5 space-y-0 max-h-[520px] overflow-y-auto">
              {/* Color legend */}
              <div className="flex items-center gap-4 mb-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#6366f1', boxShadow: '0 0 6px rgba(99,102,241,0.6)' }} />
                  Rep
                </span>
                <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#64748b' }} />
                  Prospect
                </span>
              </div>

              {parsedTranscript.length > 0 ? (
                parsedTranscript.map((para, i) => (
                  <TranscriptParagraph key={i} paragraph={para} />
                ))
              ) : (
                // Fallback: raw pre-formatted text
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {insights.transcript}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── TranscriptParagraph ──────────────────────────────────────────────────
function TranscriptParagraph({ paragraph }: { paragraph: Paragraph }) {
  const { speaker, isRep, lines } = paragraph

  const accentColor  = isRep ? '#6366f1' : '#64748b'
  const labelStyle   = isRep
    ? { color: '#a5b4fc', fontWeight: 700 }
    : { color: '#94a3b8', fontWeight: 600 }
  const borderStyle  = { borderLeft: `2px solid ${accentColor}` }
  const bgStyle      = isRep
    ? { background: 'rgba(99,102,241,0.04)' }
    : { background: 'rgba(255,255,255,0.02)' }

  return (
    <div
      className="pl-4 pr-3 py-3 rounded-r-xl mb-1"
      style={{ ...borderStyle, ...bgStyle }}
    >
      <p className="text-xs mb-1.5 uppercase tracking-wider" style={{ ...labelStyle, fontSize: '10px' }}>
        {speaker}
      </p>
      <p className="text-sm leading-relaxed" style={{ color: isRep ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.6)' }}>
        {lines.join(' ')}
      </p>
    </div>
  )
}
