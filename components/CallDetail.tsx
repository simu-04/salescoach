/**
 * CallDetail v2
 *
 * New in v2:
 *   - Copy to clipboard (full insight as markdown)
 *   - Coaching panel: did_well + fix_immediately (from upgraded Claude prompt)
 *   - Buying signals section (new from v2 prompt)
 *   - Engagement arc badge
 *   - Next step clarity indicator
 *   - Health score in header
 *   - Keyboard shortcut: C to copy, T to toggle transcript
 *   - Theme-aware (CSS vars throughout)
 *   - Auto-poll: refresh page every 15s while processing
 */
'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow, format } from 'date-fns'
import { VerdictBadge } from '@/components/VerdictBadge'
import { TalkRatioBar } from '@/components/TalkRatioBar'
import { computeCallScore } from '@/components/DashboardClient'
import type { CallRow, InsightRow } from '@/types'

interface CallDetailProps {
  call:     CallRow
  insights: InsightRow | null
}

// ── Transcript parser ─────────────────────────────────────────────────────────
interface Paragraph { speaker: string; isRep: boolean; lines: string[] }

function parseTranscript(raw: string): Paragraph[] {
  const utterances = raw.split(/\n\n+/).map(u => u.trim()).filter(Boolean)
  const paragraphs: Paragraph[] = []

  for (const utterance of utterances) {
    const match = utterance.match(/^([^:\n]+):\s*([\s\S]+)$/)
    if (!match) {
      if (paragraphs.length > 0) paragraphs[paragraphs.length - 1].lines.push(utterance)
      else paragraphs.push({ speaker: 'Unknown', isRep: false, lines: [utterance] })
      continue
    }
    const [, speakerRaw, text] = match
    const speaker = speakerRaw.trim()
    const isRep   = /^(rep|sales|agent|speaker\s*0)$/i.test(speaker)
    const last    = paragraphs[paragraphs.length - 1]
    if (last && last.speaker.toLowerCase() === speaker.toLowerCase()) {
      last.lines.push(text.trim())
    } else {
      paragraphs.push({ speaker, isRep, lines: [text.trim()] })
    }
  }
  return paragraphs
}

// ── Copy insight to clipboard as markdown ─────────────────────────────────────
function buildInsightMarkdown(call: CallRow, insights: InsightRow): string {
  const lines: string[] = [
    `# Call Analysis: ${call.file_name}`,
    `**Date:** ${format(new Date(call.created_at), 'MMM d, yyyy')}`,
    `**Verdict:** ${call.verdict?.toUpperCase() ?? 'PENDING'}`,
    `**Rep:** ${call.rep_name ?? 'Unknown'}`,
    '',
    `## Summary`,
    insights.summary,
    '',
    `## Verdict Reason`,
    insights.verdict_reason,
    '',
    `## Top Recommendation`,
    insights.top_recommendation,
    '',
    `## Talk Ratio`,
    `Rep: ${insights.talk_ratio.rep}% | Prospect: ${insights.talk_ratio.prospect}%`,
    '',
  ]

  if (insights.risk_signals?.length) {
    lines.push('## Risk Signals')
    insights.risk_signals.forEach(s => lines.push(`- ${s}`))
    lines.push('')
  }
  if ((insights as any).buying_signals?.length) {
    lines.push('## Buying Signals')
    ;(insights as any).buying_signals.forEach((s: string) => lines.push(`- ${s}`))
    lines.push('')
  }
  if (insights.objections?.length) {
    lines.push('## Objections')
    insights.objections.forEach(o => lines.push(`- ${o}`))
    lines.push('')
  }
  if (insights.competitor_mentions?.length) {
    lines.push('## Competitor Mentions')
    insights.competitor_mentions.forEach(c => lines.push(`- ${c}`))
    lines.push('')
  }
  if ((insights as any).coaching) {
    const c = (insights as any).coaching
    lines.push('## Coaching')
    lines.push(`✓ Did well: ${c.did_well}`)
    lines.push(`✗ Fix immediately: ${c.fix_immediately}`)
    lines.push('')
  }

  return lines.join('\n')
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionCard({ title, children, accent }: {
  title: string; children: React.ReactNode; accent?: string
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'var(--card-bg)',
        border: `1px solid ${accent ?? 'var(--card-border)'}`,
        backdropFilter: 'blur(16px)',
      }}
    >
      <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
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

// ── Main component ────────────────────────────────────────────────────────────
export function CallDetail({ call, insights }: CallDetailProps) {
  const router              = useRouter()
  const [showTranscript,  setShowTranscript]  = useState(false)
  const [copied,          setCopied]          = useState(false)

  const parsedTranscript = useMemo(
    () => (insights?.transcript ? parseTranscript(insights.transcript) : []),
    [insights?.transcript]
  )

  const healthScore = useMemo(
    () => insights ? computeCallScore(call, insights) : null,
    [call, insights]
  )

  // ── Auto-poll while processing ──────────────────────────────────────────────
  useEffect(() => {
    if (call.status !== 'processing') return
    const id = setInterval(() => router.refresh(), 15_000)
    return () => clearInterval(id)
  }, [call.status, router])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    if (!insights) return
    const md = buildInsightMarkdown(call, insights)
    await navigator.clipboard.writeText(md)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [call, insights])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'c' || e.key === 'C') handleCopy()
      if (e.key === 't' || e.key === 'T') setShowTranscript(p => !p)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleCopy])

  // ── Processing state ────────────────────────────────────────────────────────
  if (call.status === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div
          className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(99,102,241,0.3)', borderTopColor: '#6366f1' }}
        />
        <p className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Analyzing call…</p>
        <p className="text-sm text-center max-w-xs" style={{ color: 'var(--text-muted)' }}>
          Deepgram is transcribing, Claude is reading your call line by line.
          Usually 30–90 seconds. Page auto-refreshes.
        </p>
        <div className="flex gap-1.5 mt-2">
          {[0,1,2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full animate-soft-pulse"
              style={{ background: '#6366f1', animationDelay: `${i * 0.3}s` }}
            />
          ))}
        </div>
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
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{call.error_message ?? 'Unknown error'}</p>
      </div>
    )
  }

  if (!insights) {
    return (
      <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
        No insight data found for this call.
      </div>
    )
  }

  const buyingSignals = (insights as any).buying_signals as string[] | undefined
  const coaching      = (insights as any).coaching as { did_well: string; fix_immediately: string } | null
  const nextStep      = (insights as any).next_step_clarity as string | undefined
  const engArc        = (insights as any).engagement_arc as string | undefined

  return (
    <div className="space-y-4">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', backdropFilter: 'blur(16px)' }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <VerdictBadge verdict={call.verdict} size="lg" />
              <h1 className="text-xl font-bold truncate max-w-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {call.file_name}
              </h1>
              {/* Health score */}
              {healthScore !== null && (
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: healthScore >= 70 ? 'rgba(34,197,94,0.1)' : healthScore >= 45 ? 'rgba(251,191,36,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${healthScore >= 70 ? 'rgba(34,197,94,0.3)' : healthScore >= 45 ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    color: healthScore >= 70 ? '#4ade80' : healthScore >= 45 ? '#fbbf24' : '#f87171',
                  }}
                  title="Call health score (0–100)"
                >
                  Score {healthScore}
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {insights.verdict_reason}
            </p>
            {/* Meta badges */}
            <div className="flex flex-wrap gap-2 mt-3">
              {nextStep && (
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{
                    background: nextStep === 'clear' ? 'rgba(34,197,94,0.1)' : nextStep === 'none' ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.1)',
                    border: `1px solid ${nextStep === 'clear' ? 'rgba(34,197,94,0.25)' : nextStep === 'none' ? 'rgba(239,68,68,0.25)' : 'rgba(251,191,36,0.25)'}`,
                    color: nextStep === 'clear' ? '#4ade80' : nextStep === 'none' ? '#f87171' : '#fbbf24',
                  }}
                >
                  Next step: {nextStep}
                </span>
              )}
              {engArc && (
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{
                    background: 'var(--tag-bg)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Engagement: {engArc}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0">
            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl font-semibold transition-all"
              style={{
                background: copied ? 'rgba(34,197,94,0.1)' : 'var(--tag-bg)',
                border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'var(--border-subtle)'}`,
                color: copied ? '#4ade80' : 'var(--text-secondary)',
              }}
              title="Copy insights as markdown (C)"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy (C)
                </>
              )}
            </button>

            <div className="text-right">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {format(new Date(call.created_at), 'MMM d, yyyy')}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
              </p>
              {call.duration_seconds && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                  {formatDuration(call.duration_seconds)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Top Recommendation ──────────────────────────────────── */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}
      >
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#fbbf24' }}>
          Top Recommendation
        </p>
        <p className="font-semibold text-base leading-relaxed" style={{ color: 'var(--text-primary)' }}>
          {insights.top_recommendation}
        </p>
      </div>

      {/* ── Coaching ────────────────────────────────────────────── */}
      {coaching && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            className="rounded-2xl p-5"
            style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }}
          >
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#4ade80' }}>
              ✓ Did Well
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {coaching.did_well}
            </p>
          </div>
          <div
            className="rounded-2xl p-5"
            style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#f87171' }}>
              ✗ Fix Immediately
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {coaching.fix_immediately}
            </p>
          </div>
        </div>
      )}

      {/* ── Summary ─────────────────────────────────────────────── */}
      <SectionCard title="Call Summary">
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {insights.summary}
        </p>
      </SectionCard>

      {/* ── Talk Ratio ──────────────────────────────────────────── */}
      <SectionCard title="Talk Ratio">
        <TalkRatioBar repRatio={insights.talk_ratio.rep} prospectRatio={insights.talk_ratio.prospect} />
        <p className="text-xs mt-3" style={{ color: 'var(--text-faint)' }}>
          Ideal: Rep 40–50%. Over 60% = pitching instead of discovering pain.
        </p>
      </SectionCard>

      {/* ── Risk Signals ────────────────────────────────────────── */}
      {insights.risk_signals.length > 0 && (
        <SectionCard title={`Risk Signals (${insights.risk_signals.length})`}>
          <ul className="space-y-3">
            {insights.risk_signals.map((signal, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 mt-0.5" style={{ color: '#f87171' }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </span>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{signal}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* ── Buying Signals ──────────────────────────────────────── */}
      {buyingSignals && buyingSignals.length > 0 && (
        <SectionCard title={`Buying Signals (${buyingSignals.length})`}>
          <ul className="space-y-3">
            {buyingSignals.map((signal, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 mt-0.5" style={{ color: '#4ade80' }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </span>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{signal}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* ── Objections ──────────────────────────────────────────── */}
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
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{obj}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* ── Competitor Mentions ─────────────────────────────────── */}
      {insights.competitor_mentions.length > 0 && (
        <SectionCard title="Competitor Mentions">
          <div className="flex flex-wrap gap-2">
            {insights.competitor_mentions.map((comp, i) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-full text-sm font-medium"
                style={{
                  background: 'var(--tag-bg)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                {comp}
              </span>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Transcript ──────────────────────────────────────────── */}
      {insights.transcript && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full flex items-center justify-between p-5 text-left transition-colors"
            style={{ borderBottom: showTranscript ? '1px solid var(--border-subtle)' : 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--tag-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Full Transcript
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'var(--tag-bg)', color: 'var(--text-faint)', border: '1px solid var(--border-subtle)' }}
              >
                {parsedTranscript.length} turns
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ color: 'var(--text-faint)' }}
              >
                T
              </span>
            </div>
            <div className="flex items-center gap-3">
              {!showTranscript && (
                <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-faint)' }}>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: '#6366f1' }} /> Rep
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: '#64748b' }} /> Prospect
                  </span>
                </div>
              )}
              <svg
                className={`w-4 h-4 transition-transform ${showTranscript ? 'rotate-180' : ''}`}
                style={{ color: 'var(--text-faint)' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {showTranscript && (
            <div className="p-5 max-h-[520px] overflow-y-auto">
              <div className="flex items-center gap-4 mb-5 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#6366f1', boxShadow: '0 0 6px rgba(99,102,241,0.6)' }} />
                  Rep
                </span>
                <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#64748b' }} />
                  Prospect
                </span>
              </div>

              {parsedTranscript.length > 0 ? (
                parsedTranscript.map((para, i) => (
                  <TranscriptParagraph key={i} paragraph={para} />
                ))
              ) : (
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {insights.transcript}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Keyboard hint ───────────────────────────────────────── */}
      <p className="text-xs text-center pb-4" style={{ color: 'var(--text-faint)' }}>
        Shortcuts: <kbd className="px-1 py-0.5 rounded font-mono" style={{ background: 'var(--tag-bg)', border: '1px solid var(--border-subtle)' }}>C</kbd> copy·
        <kbd className="px-1 py-0.5 rounded font-mono ml-1" style={{ background: 'var(--tag-bg)', border: '1px solid var(--border-subtle)' }}>T</kbd> transcript
      </p>
    </div>
  )
}

// ── TranscriptParagraph ───────────────────────────────────────────────────────
function TranscriptParagraph({ paragraph }: { paragraph: Paragraph }) {
  const { speaker, isRep, lines } = paragraph
  const accentColor = isRep ? '#6366f1' : '#64748b'
  const labelColor  = isRep ? '#a5b4fc' : '#94a3b8'

  return (
    <div
      className="pl-4 pr-3 py-3 rounded-r-xl mb-1"
      style={{
        borderLeft: `2px solid ${accentColor}`,
        background: isRep ? 'rgba(99,102,241,0.04)' : 'var(--tag-bg)',
      }}
    >
      <p className="text-[10px] mb-1.5 uppercase tracking-wider font-bold" style={{ color: labelColor }}>
        {speaker}
      </p>
      <p className="text-sm leading-relaxed" style={{ color: isRep ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
        {lines.join(' ')}
      </p>
    </div>
  )
}
