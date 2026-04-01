'use client'

/**
 * DashboardClient — client-side filtering + sorting + per-rep stats.
 * Admin can slice by rep, verdict, date, and sort order.
 * StatsBar re-computes live based on the active filter set.
 */
import { useState, useMemo } from 'react'
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
type SortOption    = 'priority' | 'newest' | 'oldest'

const DATE_LABELS: Record<DateFilter, string> = {
  all: 'All time', '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days',
}

export function DashboardClient({ calls, insightMap, currentUserId, currentUserRole, isAdmin }: Props) {
  const [repFilter,     setRepFilter]     = useState<string>('all')
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>('all')
  const [dateFilter,    setDateFilter]    = useState<DateFilter>('all')
  const [sortBy,        setSortBy]        = useState<SortOption>('priority')

  // All unique reps from call data (admin only)
  const reps = useMemo(() => {
    const seen = new Map<string, string>() // userId → repName
    for (const c of calls) {
      if (c.user_id && c.rep_name && !seen.has(c.user_id)) {
        seen.set(c.user_id, c.rep_name)
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [calls])

  // Apply all filters
  const filteredCalls = useMemo(() => {
    let result = [...calls]

    // Rep filter
    if (repFilter !== 'all') {
      result = result.filter((c) => c.user_id === repFilter)
    }

    // Verdict filter
    if (verdictFilter !== 'all') {
      result = result.filter((c) => c.verdict === verdictFilter)
    }

    // Date filter
    if (dateFilter !== 'all') {
      const days = { '7d': 7, '30d': 30, '90d': 90 }[dateFilter]
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - days)
      result = result.filter((c) => new Date(c.created_at) >= cutoff)
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      // Priority: processing first, then at_risk, lost, won, pending
      if (a.status === 'processing' && b.status !== 'processing') return -1
      if (b.status === 'processing' && a.status !== 'processing') return 1
      const p = { at_risk: 0, lost: 1, won: 2 } as const
      const ap = p[a.verdict as keyof typeof p] ?? 3
      const bp = p[b.verdict as keyof typeof p] ?? 3
      if (ap !== bp) return ap - bp
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return result
  }, [calls, repFilter, verdictFilter, dateFilter, sortBy])

  // Compute stats for the filtered set
  const stats = useMemo((): DashboardStats => {
    const completed = filteredCalls.filter((c) => c.status === 'complete')
    const won       = completed.filter((c) => c.verdict === 'won')
    const atRisk    = completed.filter((c) => c.verdict === 'at_risk')
    const lost      = completed.filter((c) => c.verdict === 'lost')
    const insights  = completed.map((c) => insightMap[c.id]).filter(Boolean)
    const avgRep    = insights.length > 0
      ? Math.round(insights.reduce((s, i) => s + (i.talk_ratio?.rep ?? 50), 0) / insights.length)
      : 0
    return {
      total_calls:        filteredCalls.length,
      complete_calls:     completed.length,
      win_rate:           completed.length > 0 ? Math.round((won.length / completed.length) * 100) : 0,
      at_risk_count:      atRisk.length,
      lost_count:         lost.length,
      avg_rep_talk_ratio: avgRep,
    }
  }, [filteredCalls, insightMap])

  const hasFilters = repFilter !== 'all' || verdictFilter !== 'all' || dateFilter !== 'all'

  return (
    <div className="space-y-5">
      {/* ── Page header ─────────────────────────────────────── */}
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isAdmin ? 'Call Intelligence' : 'My Calls'}
          </h1>
          <p className="text-base mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {isAdmin ? 'Every call analyzed. One metric: conversion rate.' : 'Your uploaded calls and analysis.'}
          </p>
        </div>
        <Link
          href="/upload"
          className="flex-shrink-0 text-white text-sm px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all"
          style={{ background: 'linear-gradient(135deg, #6366f1, #0ea5e9)', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Upload Call
        </Link>
      </div>

      {/* ── Filter bar ──────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-3 p-3 rounded-2xl"
        style={{
          background: 'rgba(13,13,26,0.8)',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Rep filter (admin only) */}
        {isAdmin && reps.length > 0 && (
          <FilterSelect
            label="Rep"
            value={repFilter}
            onChange={setRepFilter}
            options={[
              { value: 'all', label: 'All reps' },
              ...reps.map((r) => ({ value: r.id, label: r.name })),
            ]}
          />
        )}

        {/* Verdict */}
        <FilterSelect
          label="Verdict"
          value={verdictFilter}
          onChange={(v) => setVerdictFilter(v as VerdictFilter)}
          options={[
            { value: 'all',     label: 'All verdicts' },
            { value: 'won',     label: '✓ Won' },
            { value: 'at_risk', label: '⚠ At Risk' },
            { value: 'lost',    label: '✕ Lost' },
          ]}
        />

        {/* Date range */}
        <FilterSelect
          label="Period"
          value={dateFilter}
          onChange={(v) => setDateFilter(v as DateFilter)}
          options={Object.entries(DATE_LABELS).map(([value, label]) => ({ value, label }))}
        />

        {/* Sort */}
        <FilterSelect
          label="Sort"
          value={sortBy}
          onChange={(v) => setSortBy(v as SortOption)}
          options={[
            { value: 'priority', label: 'Priority' },
            { value: 'newest',   label: 'Newest first' },
            { value: 'oldest',   label: 'Oldest first' },
          ]}
        />

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={() => { setRepFilter('all'); setVerdictFilter('all'); setDateFilter('all') }}
            className="ml-auto text-xs px-3 py-1.5 rounded-lg transition-all font-medium"
            style={{ color: 'rgba(99,102,241,0.8)', border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.06)' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Stats (computed from filtered calls) ────────────── */}
      {filteredCalls.length > 0 && <StatsBar stats={stats} />}

      {/* ── Per-rep label when filtered ─────────────────────── */}
      {isAdmin && repFilter !== 'all' && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Showing metrics for <span className="font-bold">{reps.find(r => r.id === repFilter)?.name ?? 'Rep'}</span>
        </div>
      )}

      {/* ── Call list ───────────────────────────────────────── */}
      {filteredCalls.length === 0 ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        <div className="space-y-3">
          {filteredCalls.map((call) => (
            <CallCard
              key={call.id}
              call={call}
              talkRatio={insightMap[call.id]?.talk_ratio}
              topRecommendation={insightMap[call.id]?.top_recommendation}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── FilterSelect ─────────────────────────────────────────────── */
function FilterSelect({
  label, value, onChange, options,
}: {
  label:    string
  value:    string
  onChange: (v: string) => void
  options:  { value: string; label: string }[]
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider flex-shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm rounded-lg px-2.5 py-1.5 pr-7 font-medium cursor-pointer transition-all appearance-none"
        style={{
          background:   'rgba(255,255,255,0.06)',
          border:       value === 'all' || value === 'priority'
            ? '1px solid rgba(255,255,255,0.1)'
            : '1px solid rgba(99,102,241,0.4)',
          color:        value === 'all' || value === 'priority'
            ? 'rgba(255,255,255,0.7)'
            : '#a5b4fc',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.3)' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
          backgroundRepeat:   'no-repeat',
          backgroundPosition: 'right 6px center',
          backgroundSize:     '14px',
          outline: 'none',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: '#0d0d1a', color: 'white' }}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/* ── EmptyState ───────────────────────────────────────────────── */
function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  if (hasFilters) {
    return (
      <div
        className="rounded-2xl p-12 text-center"
        style={{ border: '1px dashed rgba(255,255,255,0.08)', background: 'rgba(13,13,26,0.6)' }}
      >
        <p className="text-white font-semibold text-lg mb-2">No calls match these filters</p>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Try widening your date range or clearing the filters.
        </p>
      </div>
    )
  }
  return (
    <div
      className="rounded-2xl p-16 text-center"
      style={{ border: '1px dashed rgba(255,255,255,0.08)', background: 'rgba(13,13,26,0.6)' }}
    >
      <div
        className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-5"
        style={{ background: 'rgba(13,13,26,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <svg className="w-7 h-7" style={{ color: 'rgba(255,255,255,0.2)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      </div>
      <h3 className="text-white font-semibold text-lg mb-2">No calls yet</h3>
      <p className="text-base mb-6 max-w-xs mx-auto" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Upload your first call recording. Full analysis in under 2 minutes.
      </p>
      <Link
        href="/upload"
        className="inline-flex items-center gap-2 text-white text-sm px-5 py-2.5 rounded-xl font-semibold transition-all"
        style={{ background: 'linear-gradient(135deg, #6366f1, #0ea5e9)', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}
      >
        Upload your first call
      </Link>
    </div>
  )
}
