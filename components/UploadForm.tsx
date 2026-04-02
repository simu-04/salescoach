/**
 * UploadForm — multi-file queue flow:
 *   1. Drop / browse multiple audio files
 *   2. Each file: first 2MB slice → /api/extract-details → product + prospect auto-filled
 *   3. User reviews/edits per-file details
 *   4. "Analyze All" → upload + process sequentially
 *   5. Redirect to dashboard when all done
 */
'use client'

import { useState, useRef, useCallback, useId } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'

const ACCEPTED_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/wav',
  'audio/webm', 'audio/ogg', 'video/mp4',
]
const MAX_FILE_SIZE_MB    = 100
const EXTRACT_SLICE_BYTES = 2 * 1024 * 1024  // 2 MB ≈ 60–90 sec of compressed audio

type ItemState = 'extracting' | 'confirming' | 'uploading' | 'processing' | 'done' | 'error'

interface QueueItem {
  id:        string
  file:      File
  state:     ItemState
  product:   string
  prospect:  string
  autoFilled: boolean
  progress:  number
  errorMsg:  string
  callId?:   string
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function toSlug(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function buildFileName(product: string, prospect: string, originalName: string): string {
  const ext  = originalName.includes('.') ? originalName.split('.').pop() ?? '' : ''
  const now  = new Date()
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  const base = [toSlug(product), toSlug(prospect), date, time].filter(Boolean).join('-')
  return ext ? `${base}.${ext}` : base
}

const fieldStyle: React.CSSProperties = {
  background:   'var(--input-bg)',
  border:       '1px solid var(--border-mid)',
  color:        'var(--text-primary)',
  borderRadius: '8px',
  padding:      '7px 11px',
  fontSize:     '13px',
  width:        '100%',
  outline:      'none',
  transition:   'all 0.15s ease',
}

// ── State icon ────────────────────────────────────────────────────────────────
function StateIcon({ state, progress }: { state: ItemState; progress: number }) {
  if (state === 'extracting') {
    return (
      <svg className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: '#818cf8' }} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    )
  }
  if (state === 'uploading' || state === 'processing') {
    return (
      <svg className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: '#0ea5e9' }} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    )
  }
  if (state === 'done') {
    return (
      <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#4ade80' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    )
  }
  if (state === 'error') {
    return (
      <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#f87171' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    )
  }
  // confirming — small dot
  return <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: 'var(--border-mid)' }} />
}

// ── Single queue row ──────────────────────────────────────────────────────────
function QueueRow({
  item,
  onRemove,
  onUpdate,
  isRunning,
}: {
  item:      QueueItem
  onRemove:  (id: string) => void
  onUpdate:  (id: string, patch: Partial<QueueItem>) => void
  isRunning: boolean
}) {
  const canEdit = item.state === 'confirming'
  const busy    = item.state === 'uploading' || item.state === 'processing' || item.state === 'extracting'

  return (
    <div
      className="rounded-2xl p-4 space-y-3 transition-all"
      style={{
        background:  'var(--card-bg)',
        border:      `1px solid ${item.state === 'error' ? 'rgba(248,113,113,0.25)' : item.state === 'done' ? 'rgba(74,222,128,0.2)' : 'var(--card-border)'}`,
      }}
    >
      {/* Row header */}
      <div className="flex items-center gap-3">
        <StateIcon state={item.state} progress={item.progress} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {item.file.name}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {(item.file.size / 1024 / 1024).toFixed(1)} MB
            {item.state === 'extracting' && ' · reading…'}
            {item.state === 'uploading'  && ` · uploading ${item.progress}%`}
            {item.state === 'processing' && ' · analyzing…'}
            {item.state === 'done'       && ' · done'}
            {item.state === 'error'      && ` · ${item.errorMsg}`}
          </p>
        </div>

        {!busy && !isRunning && item.state !== 'done' && (
          <button
            onClick={() => onRemove(item.id)}
            className="text-xs px-2 py-0.5 rounded transition-all flex-shrink-0"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-faint)')}
          >
            ✕
          </button>
        )}
      </div>

      {/* Editable fields — shown only in confirming state */}
      {canEdit && (
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Product / Service
              {item.autoFilled && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>
                  auto
                </span>
              )}
            </label>
            <input
              type="text"
              placeholder="e.g. SalesCoach"
              value={item.product}
              onChange={(e) => onUpdate(item.id, { product: e.target.value })}
              style={fieldStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.08)' }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Prospect / Company
            </label>
            <input
              type="text"
              placeholder="e.g. Acme Corp"
              value={item.prospect}
              onChange={(e) => onUpdate(item.id, { prospect: e.target.value })}
              style={fieldStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.08)' }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
        </div>
      )}

      {/* Upload progress bar */}
      {(item.state === 'uploading' || item.state === 'processing') && (
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
          <div
            className="h-full transition-all duration-500"
            style={{
              width:      `${item.state === 'processing' ? 100 : item.progress}%`,
              background: 'linear-gradient(90deg, #6366f1, #0ea5e9)',
              opacity:    item.state === 'processing' ? 0.5 : 1,
            }}
          />
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function UploadForm() {
  const router       = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [queue,      setQueue]      = useState<QueueItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isRunning,  setIsRunning]  = useState(false)  // "Analyze All" in progress

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const updateItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue(q => q.map(item => item.id === id ? { ...item, ...patch } : item))
  }, [])

  const removeItem = useCallback((id: string) => {
    setQueue(q => q.filter(item => item.id !== id))
  }, [])

  // ── Add files to queue + run extraction ─────────────────────────────────────
  const enqueueFiles = useCallback(async (files: FileList | File[]) => {
    const valid: File[] = []
    const arr = Array.from(files)

    for (const file of arr) {
      if (!ACCEPTED_TYPES.includes(file.type)) continue
      if (file.size / 1024 / 1024 > MAX_FILE_SIZE_MB) continue
      valid.push(file)
    }
    if (valid.length === 0) return

    // Add all as 'extracting'
    const newItems: QueueItem[] = valid.map(file => ({
      id:        uid(),
      file,
      state:     'extracting',
      product:   '',
      prospect:  '',
      autoFilled: false,
      progress:  0,
      errorMsg:  '',
    }))

    setQueue(q => [...q, ...newItems])

    // Run extract-details in parallel for all new files
    await Promise.all(newItems.map(async (item) => {
      try {
        const slice    = item.file.slice(0, EXTRACT_SLICE_BYTES)
        const ext      = item.file.name.slice(item.file.name.lastIndexOf('.'))
        const formData = new FormData()
        formData.append('slice', new File([slice], `slice${ext}`, { type: item.file.type }))

        const res  = await fetch('/api/extract-details', { method: 'POST', body: formData })
        const data = await res.json()

        setQueue(q => q.map(qi => qi.id !== item.id ? qi : {
          ...qi,
          state:     'confirming',
          product:   data.product  ?? '',
          prospect:  data.prospect ?? '',
          autoFilled: !!(data.product || data.prospect),
        }))
      } catch {
        // Extraction failed — still let user confirm with empty fields
        setQueue(q => q.map(qi => qi.id !== item.id ? qi : { ...qi, state: 'confirming' }))
      }
    }))
  }, [])

  // ── Analyze all confirmed items sequentially ─────────────────────────────────
  const handleAnalyzeAll = useCallback(async () => {
    const supabase = createBrowserClient()
    const toProcess = queue.filter(item => item.state === 'confirming')
    if (toProcess.length === 0) return

    setIsRunning(true)

    for (const item of toProcess) {
      const { file, product, prospect } = item
      const displayName = buildFileName(product || 'call', prospect || 'prospect', file.name)

      try {
        // Upload
        updateItem(item.id, { state: 'uploading', progress: 10 })
        const timestamp   = Date.now()
        const storagePath = `${timestamp}_${displayName.replace(/[^a-zA-Z0-9._-]/g, '_')}`

        const { error: uploadError } = await supabase.storage
          .from('call-recordings')
          .upload(storagePath, file, { cacheControl: '3600', upsert: false, contentType: file.type })

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

        updateItem(item.id, { progress: 40, state: 'processing' })

        // Process
        const res = await fetch('/api/process', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ storage_path: storagePath, file_name: displayName, file_size: file.size }),
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error ?? 'Processing failed')
        }

        const { call_id } = await res.json()
        updateItem(item.id, { state: 'done', progress: 100, callId: call_id })

      } catch (err) {
        updateItem(item.id, {
          state:    'error',
          errorMsg: err instanceof Error ? err.message : 'Something went wrong',
        })
      }
    }

    setIsRunning(false)

    // Navigate after all items are processed
    // Read final queue state via setter to avoid stale closure
    setQueue(q => {
      const done = q.filter(qi => qi.state === 'done')
      if (done.length === 1 && done[0].callId) {
        router.push(`/calls/${done[0].callId}`)
      } else if (done.length > 1) {
        router.push('/dashboard')
      }
      return q
    })
  }, [queue, updateItem, router])

  // ── Drop zone handlers ───────────────────────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (isRunning) return
    if (e.dataTransfer.files.length > 0) enqueueFiles(e.dataTransfer.files)
  }, [enqueueFiles, isRunning])

  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  // ── Derived state ────────────────────────────────────────────────────────────
  const confirming  = queue.filter(i => i.state === 'confirming')
  const hasQueue    = queue.length > 0
  const allDone     = queue.length > 0 && queue.every(i => i.state === 'done' || i.state === 'error')
  const anyExtracting = queue.some(i => i.state === 'extracting')

  return (
    <div className="w-full max-w-xl space-y-4">

      {/* ── Drop zone ────────────────────────────────────────────────────────── */}
      <div
        onClick={() => !isRunning && fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className="relative rounded-3xl p-10 text-center transition-all duration-300"
        style={{
          background: isDragging ? 'rgba(99,102,241,0.06)' : 'var(--card-bg)',
          border:     isDragging ? '2px dashed rgba(99,102,241,0.6)' : '2px dashed var(--border-mid)',
          cursor:     isRunning ? 'default' : 'pointer',
          boxShadow:  isDragging ? '0 0 32px rgba(99,102,241,0.15)' : 'none',
        }}
        onMouseEnter={(e) => {
          if (!isRunning && !isDragging) {
            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'
            e.currentTarget.style.background  = 'rgba(99,102,241,0.03)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragging) {
            e.currentTarget.style.borderColor = 'var(--border-mid)'
            e.currentTarget.style.background  = 'var(--card-bg)'
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".mp3,.mp4,.wav,.webm,.ogg,audio/*,video/mp4"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) enqueueFiles(e.target.files)
            e.target.value = ''
          }}
          disabled={isRunning}
        />

        {/* Icon */}
        <div
          className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300"
          style={{
            background: isDragging ? 'rgba(99,102,241,0.15)' : 'var(--tag-bg)',
            border:     isDragging ? '1px solid rgba(99,102,241,0.35)' : '1px solid var(--border-subtle)',
          }}
        >
          <svg
            className="w-7 h-7"
            style={{ color: isDragging ? '#818cf8' : 'var(--text-muted)' }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>

        <p className="font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
          {hasQueue ? 'Drop more recordings' : 'Drop your call recordings'}
        </p>
        <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
          or click to browse · multiple files supported
        </p>
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          MP3, MP4, WAV, WebM · Max 100MB each · Details auto-detected
        </p>
      </div>

      {/* ── Queue list ───────────────────────────────────────────────────────── */}
      {hasQueue && (
        <div className="space-y-3">
          {queue.map(item => (
            <QueueRow
              key={item.id}
              item={item}
              onRemove={removeItem}
              onUpdate={updateItem}
              isRunning={isRunning}
            />
          ))}
        </div>
      )}

      {/* ── Analyze All button ───────────────────────────────────────────────── */}
      {confirming.length > 0 && !isRunning && (
        <button
          onClick={handleAnalyzeAll}
          className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
            boxShadow:  '0 4px 16px rgba(99,102,241,0.3)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          {anyExtracting
            ? 'Reading files…'
            : confirming.length === 1
              ? 'Analyze Call →'
              : `Analyze ${confirming.length} Calls →`}
        </button>
      )}

      {/* Running indicator */}
      {isRunning && (
        <div className="flex items-center justify-center gap-2 py-2">
          <svg className="w-4 h-4 animate-spin" style={{ color: '#818cf8' }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Processing queue…
          </span>
        </div>
      )}

      {!hasQueue && (
        <p className="text-center text-xs" style={{ color: 'var(--text-faint)' }}>
          Call recordings stay private. Only your team sees the analysis.
        </p>
      )}
    </div>
  )
}
