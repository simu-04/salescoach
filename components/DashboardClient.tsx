'use client'

/**
 * DashboardClient v2
 *
 * New in v2:
 *   - Global search (searches call name + rep name + verdict reason)
 *   - Auto-refresh every 20s when any call is still processing
 *   - Call health score (0-100) computed client-side
 *   - Win rate trend badge (last 7d vs previous 7d)
 *   - Processing calls live counter
 *   - Theme-aware (CSS vars)
 *   - Keyboard shortcut: / to focus search, Escape to clear
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { StatsBar } from '@/components/StatsBar'
import { CallCard } from '@/components/CallCard'
import type { CallRow, InsightRow, DashboardStats } from '@/types'

interface Props {
  calls:           CallRow[]
  insightMap:      Record<string, InsightRow>
  currentUserId:   string
  currentUserRole: 'admin' | 'rep' | 'pending'
  isAdmin:         boolean
}

type VerdictFilter = 'all' | 'won' | 'at_risk' | 'lost'
type DateFilter    = 'all' | '7d' | '30d' | '90d'
type SortOption    = 'priority' | 'newest' | 'oldest' | 'score'

const DATE_LABELS: Record<DateFilter, string> = {
  all: 'All time', '7d': 'Last 7d', '30d': 'Last 30d', '90d': 'Last 90d',
}

// ── Call health score ──────────────────────────────────────────────────────────
// Computed entirely client-side. No API needed.
// Score: 0–100 representing deal health / rep performance on this call.
export function computeCallScore(call: CallRow, insight: InsightRow | undefined): number {
  if (call.status !== 'complete' || !insight) return 0

  let score = 50

  // Verdict impact (±30)
  if (call.verdict === 'won')     score += 30
  if (call.verdict === 'at_risk') score += 0
  if (call.verdict === 'lost')    score -= 20

  // Talk ratio (ideal 40–50% for rep)
  const repRatio = insight.talk_ratio?.rep ?? 50
  if (repRatio >= 38 && repRatio <= 52)  score += 15   // ideal zone
  else if (repRatio >= 53 && repRatio <= 62) score += 5
  else if (repRatio >= 63 && repRatio <= 70) score -= 8
  else if (repRatio > 70)                score -= 18
  else if (repRatio < 30)                score -= 5    // too passive

  // Objections (unresolved objections hurt)
  const objCount = insight.objections?.length ?? 0
  score -= Math.min(objCount * 4, 16)

  // Risk signals
  const riskCount = insight.risk_signals?.length ?? 0
  score -= Math.min(riskCount * 3, 12)

  // Buying signals (positive)
  const buyingCount = (insight as any).buying_signals?.length ?? 0
  score += Math.min(buyingCount * 5, 10)

  return Math.max(0, Math.min(100, Math.round(score)))
}

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 70 ? { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#4ade80' } :
    score >= 45 ? { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)', text: '#fbbf24' } :
                  { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  text: '#f87171' }
  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.text }}
    >
      {score}
    </span>
  )
}

// ── Win rate trend ─────────────────────────────────────────────────────────────
function computeTrend(calls: CallRow[]): { delta: number; label: string } | null {
  const now = Date.now()
  const DAY = 86400000

  const recent = calls.filter(c =>
    c.status === 'complete' && now - new Date(c.created_at).getTime() < 7 * DAY
  )
  const prior = calls.filter(c => {
    const age = now - new Date(c.created_at).getTime()
    return c.status === 'complete' && age >= 7 * DAY && age < 14 * DAY
  })

  if (recent.length < 2 || prior.length < 2) return null

  const recentRate = recent.filter(c => c.verdict === 'won').length / recent.length * 100
  const priorRate  = prior.filter(c => c.verdict === 'won').length / prior.length * 100
  const delta = Math.round(recentRate - priorRate)

  return { delta, label: `vs prior 7d` }
}

export function DashboardClient({ calls, insightMap, currentUserId, currentUserRole, isAdmin }: Props) {
  const router = useRouter()
  const searchRef = useRef<HTMLInputElement>(null)

  const [repFilter,     setRepFilter]     = useState<string>('all')
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>('all')
  const [dateFilter,    setDateFilter]    = useState<DateFilter>('all')
  const [sortBy,        setSortBy]        = useState<SortOption>('priority')
  const [search,        setSearch]        = useState('')

  // ── Auto-refresh when calls are processing ──────────────────────────────────
  const processingCount = useMemo(
    () => calls.filter(c => c.status === 'processing').length,
    [calls]
  )

  useEffect(() => {
    if (processingCount === 0) return
    const id = setInterval(() => router.refresh(), 20_000)
    return () => clearInterval(id)
  }, [processingCount, router])

  // ── Keyboard shortcut: / to focus search ────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // ⌘K or / — focus search
      if ((e.metaKey && e.key === 'k') || (e.key === '/' && document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setSearch('')
        searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── All unique reps ──────────────────────────────────────────────────────────
  const reps = useMemo(() => {
    const seen = new Map<string, string>()
    for (const c of calls) {
      if (c.user_id && c.rep_name && !seen.has(c.user_id)) seen.set(c.user_id, c.rep_name)
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [calls])

  // ── Apply all filters + search ──────────────────────────────────────────────
  const filteredCalls = useMemo(() => {
    let result = [...calls]

    if (repFilter !== 'all')     result = result.filter(c => c.user_id === repFilter)
    if (verdictFilter !== 'all') result = result.filter(c => c.verdict === verdictFilter)
    if (dateFilter !== 'all') {
      const days = { '7d': 7, '30d': 30, '90d': 90 }[dateFilter]
      const cutoff = new Date(Date.now() - days * 86400000)
      result = result.filter(c => new Date(c.created_at) >= cutoff)
    }

    // Search: name, rep, verdict reason
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(c =>
        c.file_name.toLowerCase().includes(q) ||
        (c.rep_name ?? '').toLowerCase().includes(q) ||
        (c.verdict_reason ?? '').toLowerCase().includes(q) ||
        (c.summary ?? '').toLowerCase().includes(q)
      )
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sortBy === 'score') {
        const sa = computeCallScore(a, insightMap[a.id])
        const sb = computeCallScore(b, insightMap[b.id])
        return sb - sa
      }
      // Priority: processing → at_risk → lost → won
      if (a.status === 'processing' && b.status !== 'processing') return -1
      if (b.status === 'processing' && a.status !== 'processing') return 1
      const p = { at_risk: 0, lost: 1, won: 2 } as const
      const ap = p[a.verdict as keyof typeof p] ?? 3
      const bp = p[b.verdict as keyof typeof p] ?? 3
      if (ap !== bp) return ap - bp
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return result
  }, [calls, repFilter, verdictFilter, dateFilter, sortBy, search, insightMap])

  // ── Stats from filtered set ──────────────────────────────────────────────────
  const stats = useMemo((): DashboardStats => {
    const completed = filteredCalls.filter(c => c.status === 'complete')
    const won    = completed.filter(c => c.verdict === 'won')
    const atRisk = completed.filter(c => c.verdict === 'at_risk')
    const lost   = completed.filter(c => c.verdict === 'lost')
    const insights = completed.map(c => insightMap[c.id]).filter(Boolean)
    const avgRep = insights.length > 0
      ? Math.round(insights.reduce((s, i) => s + (i.talk_ratio?.rep ?? 50), 0) / insights.length)
      : 0
    return {
      total_calls:        filteredCalls.length,
      complete_calls:     completed.length,
      win_rate:           completed.length > 0 ? Math.round(won.length / completed.length * 100) : 0,
      at_risk_count:      atRisk.length,
      lost_count:         lost.length,
      avg_rep_talk_ratio: avgRep,
    }
  }, [filteredCalls, insightMap])

  const trend       = useMemo(() => computeTrend(calls), [calls])
  const hasFilters  = repFilter !== 'all' || verdictFilter !== 'all' || dateFilter !== 'all' || !!search.trim()
  const clearAll    = useCallback(() => {
    setRepFilter('all'); setVerdictFilter('all'); setDateFilter('all'); setSearch('')
  }, [])

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {isAdmin ? 'Call Intelligence' : 'My Calls'}
            </h1>
            {/* Processing badge */}
            {processingCount > 0 && (
              <span
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full animate-soft-pulse"
                style={{
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  color: '#a5b4fc',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                {processingCount} analyzing…
              </span>
            )}
            {/* Win rate trend */}
            {trend && (
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: trend.delta >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${trend.delta >= 0 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  color: trend.delta >= 0 ? '#4ade80' : '#f87171',
                }}
              >
                {trend.delta >= 0 ? '↑' : '↓'} {Math.abs(trend.delta)}% win rate {trend.label}
              </span>
            )}
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {isAdmin ? 'Every call analyzed. One metric: conversion rate.' : 'Your uploaded calls and analysis.'}
          </p>
        </div>
        <Link
          href="/upload"
          className="flex-shrink-0 text-white text-sm px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all"
          style={{ background: 'var(--accent-gradient)', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Upload
        </Link>
      </div>

      {/* ── Search + Filters ──────────────────────────────────── */}
      <div
        className="rounded-2xl p-3 space-y-3"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Search bar */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--text-faint)' }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search calls, reps, or insights… (press /)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-dark w-full pl-9 pr-10 py-2.5 rounded-xl text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded"
              style={{ color: 'var(--text-faint)' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && reps.length > 0 && (
            <FilterSelect label="Rep" value={repFilter} onChange={setRepFilter}
              options={[{ value: 'all', label: 'All reps' }, ...reps.map(r => ({ value: r.id, label: r.name }))]}
            />
          )}
          <FilterSelect label="Verdict" value={verdictFilter} onChange={v => setVerdictFilter(v as VerdictFilter)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'won', label: '✓ Won' },
              { value: 'at_risk', label: '⚠ At Risk' },
              { value: 'lost', label: '✕ Lost' },
            ]}
          />
          <FilterSelect label="Period" value={dateFilter} onChange={v => setDateFilter(v as DateFilter)}
            options={Object.entries(DATE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          />
          <FilterSelect label="Sort" value={sortBy} onChange={v => setSortBy(v as SortOption)}
            options={[
              { value: 'priority', label: 'Priority' },
              { value: 'score',    label: '↓ Health score' },
              { value: 'newest',   label: 'Newest' },
              { value: 'oldest',   label: 'Oldest' },
            ]}
          />

          {hasFilters && (
            <button
              onClick={clearAll}
              className="ml-auto text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
              style={{ color: 'rgba(99,102,241,0.8)', border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.06)' }}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────── */}
      {filteredCalls.length > 0 && <StatsBar stats={stats} />}

      {/* ── Per-rep banner ────────────────────────────────────── */}
      {isAdmin && repFilter !== 'all' && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Metrics for <strong>{reps.find(r => r.id === repFilter)?.name ?? 'Rep'}</strong>
        </div>
      )}

      {/* ── Call list ─────────────────────────────────────────── */}
      {filteredCalls.length === 0 ? (
        <EmptyState hasFilters={hasFilters} isSearch={!!search.trim()} searchQuery={search} />
      ) : (
        <div className="space-y-3">
          {filteredCalls.map((call, i) => {
            const score = computeCallScore(call, insightMap[call.id])
            return (
              <div key={call.id} className="animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
                <CallCard
                  call={call}
                  talkRatio={insightMap[call.id]?.talk_ratio}
                  topRecommendation={insightMap[call.id]?.top_recommendation}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                  healthScore={call.status === 'complete' ? score : undefined}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── FilterSelect ─────────────────────────────────────────────── */
function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  const active = value !== 'all' && value !== 'priority'
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
        {label}
      </span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-sm rounded-lg px-2.5 py-1.5 pr-6 font-medium cursor-pointer appearance-none transition-all"
        style={{
          background: active ? 'rgba(99,102,241,0.1)' : 'var(--tag-bg)',
          border: active ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border-subtle)',
          color: active ? '#a5b4fc' : 'var(--text-secondary)',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(160,160,200,0.5)' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 5px center',
          backgroundSize: '13px',
          outline: 'none',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: 'var(--bg-surface)' }}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/* ── EmptyState ───────────────────────────────────────────────── */
function EmptyState({ hasFilters, isSearch, searchQuery }: {
  hasFilters: boolean; isSearch: boolean; searchQuery: string
}) {
  if (isSearch) return (
    <div className="rounded-2xl p-12 text-center" style={{ border: '1px dashed var(--border-subtle)', background: 'var(--card-bg)' }}>
      <p className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>
        No results for &ldquo;{searchQuery}&rdquo;
      </p>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Try searching by rep name, verdict, or meeting title.
      </p>
    </div>
  )
  if (hasFilters) return (
    <div className="rounded-2xl p-12 text-center" style={{ border: '1px dashed var(--border-subtle)', background: 'var(--card-bg)' }}>
      <p className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>No calls match these filters</p>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Try widening the date range or clearing filters.</p>
    </div>
  )
  return (
    <div className="rounded-2xl p-16 text-center" style={{ border: '1px dashed var(--border-subtle)', background: 'var(--card-bg)' }}>
      <div
        className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'var(--tag-bg)', border: '1px solid var(--border-subtle)' }}
      >
        <svg className="w-7 h-7" style={{ color: 'var(--text-faint)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
        </svg>
      </div>
      <h3 className="font-bold text-xl mb-2" style={{ color: 'var(--text-primary)' }}>No calls yet</h3>
      <p className="text-sm mb-6 max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
        Upload your first call recording and get a full deal analysis — verdict, objections, coaching — in under 2 minutes.
      </p>
      <Link
        href="/upload"
        className="inline-flex items-center gap-2 text-white text-sm px-5 py-2.5 rounded-xl font-semibold transition-all"
        style={{ background: 'var(--accent-gradient)', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}
      >
        Upload your first call
      </Link>
    </div>
  )
}
