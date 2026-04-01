/**
 * UploadForm — new flow:
 *   1. Drop audio file (no prerequisites)
 *   2. File uploads to storage + first 2MB slice sent to /api/extract-details
 *   3. Deepgram transcribes the snippet → Claude Haiku extracts product + prospect
 *   4. Fields auto-fill (editable)
 *   5. User confirms → full pipeline runs
 */
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'

const ACCEPTED_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/wav',
  'audio/webm', 'audio/ogg', 'video/mp4',
]
const MAX_FILE_SIZE_MB    = 100
const EXTRACT_SLICE_BYTES = 2 * 1024 * 1024  // 2 MB ≈ 60–90 sec of compressed audio

type UploadState = 'idle' | 'extracting' | 'confirming' | 'uploading' | 'processing' | 'done' | 'error'

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
  borderRadius: '10px',
  padding:      '9px 13px',
  fontSize:     '14px',
  width:        '100%',
  outline:      'none',
  transition:   'all 0.15s ease',
}

export function UploadForm() {
  const router       = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingFile  = useRef<File | null>(null)

  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [progress,    setProgress]    = useState(0)
  const [errorMsg,    setErrorMsg]    = useState('')
  const [isDragging,  setIsDragging]  = useState(false)

  // Fields
  const [product,    setProduct]    = useState('')
  const [prospect,   setProspect]   = useState('')
  const [autoFilled, setAutoFilled] = useState(false)   // whether fields came from AI

  // ── Step 1: File dropped ────────────────────────────────────────────────────
  const onFilePicked = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrorMsg('Unsupported file type. Upload .mp3, .mp4, .wav, or .webm.')
      setUploadState('error')
      return
    }
    if (file.size / 1024 / 1024 > MAX_FILE_SIZE_MB) {
      setErrorMsg(`File too large. Max ${MAX_FILE_SIZE_MB}MB.`)
      setUploadState('error')
      return
    }

    pendingFile.current = file
    setProduct('')
    setProspect('')
    setAutoFilled(false)
    setUploadState('extracting')

    // ── Slice first 2MB + send to extract-details ─────────────────────────
    try {
      const slice    = file.slice(0, EXTRACT_SLICE_BYTES)
      const formData = new FormData()
      formData.append('slice', new File([slice], 'slice' + file.name.slice(file.name.lastIndexOf('.')), { type: file.type }))

      const res  = await fetch('/api/extract-details', { method: 'POST', body: formData })
      const data = await res.json()

      if (data.product || data.prospect) {
        setProduct(data.product  ?? '')
        setProspect(data.prospect ?? '')
        setAutoFilled(true)
      }
    } catch {
      // Extraction failed — just show empty editable fields
    }

    setUploadState('confirming')
  }, [])

  // ── Step 2: User confirms + hits Analyze ───────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    const file = pendingFile.current
    if (!file) return

    const displayName = buildFileName(product || 'call', prospect || 'prospect', file.name)
    setUploadState('uploading')
    setProgress(0)
    setErrorMsg('')

    try {
      const supabase    = createBrowserClient()
      const timestamp   = Date.now()
      const storagePath = `${timestamp}_${displayName.replace(/[^a-zA-Z0-9._-]/g, '_')}`

      setProgress(15)
      const { error: uploadError } = await supabase.storage
        .from('call-recordings')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false, contentType: file.type })

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

      setProgress(40)
      setUploadState('processing')

      const res = await fetch('/api/process', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ storage_path: storagePath, file_name: displayName, file_size: file.size }),
      })

      setProgress(90)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Processing failed')
      }

      const { call_id } = await res.json()
      setProgress(100)
      setUploadState('done')
      router.push(`/calls/${call_id}`)

    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setUploadState('error')
    }
  }, [router, product, prospect])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (uploadState === 'uploading' || uploadState === 'processing') return
    const file = e.dataTransfer.files[0]
    if (file) onFilePicked(file)
  }, [onFilePicked, uploadState])

  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  const isLocked  = uploadState === 'uploading' || uploadState === 'processing'
  const isIdle    = uploadState === 'idle'
  const isExtracting = uploadState === 'extracting'
  const isConfirming = uploadState === 'confirming'

  return (
    <div className="w-full max-w-xl space-y-4">

      {/* ── Drop zone ────────────────────────────────────────────────────────── */}
      {(isIdle || isExtracting) && (
        <div
          onClick={() => !isExtracting && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className="relative rounded-3xl p-14 text-center transition-all duration-300"
          style={{
            background: isDragging ? 'rgba(99,102,241,0.06)' : 'var(--card-bg)',
            border: isDragging
              ? '2px dashed rgba(99,102,241,0.6)'
              : '2px dashed var(--border-mid)',
            cursor: isExtracting ? 'default' : 'pointer',
            boxShadow: isDragging ? '0 0 32px rgba(99,102,241,0.15)' : 'none',
          }}
          onMouseEnter={(e) => {
            if (!isExtracting && !isDragging) {
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
            accept=".mp3,.mp4,.wav,.webm,.ogg,audio/*,video/mp4"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFilePicked(f); e.target.value = '' }}
            disabled={isExtracting}
          />

          {/* Icon */}
          <div
            className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300"
            style={{
              background: isExtracting
                ? 'rgba(99,102,241,0.12)'
                : isDragging ? 'rgba(99,102,241,0.15)' : 'var(--tag-bg)',
              border: isDragging || isExtracting
                ? '1px solid rgba(99,102,241,0.35)'
                : '1px solid var(--border-subtle)',
            }}
          >
            {isExtracting ? (
              <svg className="w-7 h-7 animate-spin" style={{ color: '#818cf8' }} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <svg
                className="w-8 h-8"
                style={{ color: isDragging ? '#818cf8' : 'var(--text-muted)' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            )}
          </div>

          {isExtracting ? (
            <>
              <p className="font-semibold text-lg mb-1.5" style={{ color: 'var(--text-primary)' }}>
                Reading the call…
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Detecting product and prospect from the opening
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-lg mb-1.5" style={{ color: 'var(--text-primary)' }}>
                Drop your call recording
              </p>
              <p className="text-base mb-3" style={{ color: 'var(--text-secondary)' }}>
                or click to browse
              </p>
              <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
                MP3, MP4, WAV, WebM · Max 100MB · Details auto-detected
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Confirm / edit extracted details ─────────────────────────────────── */}
      {isConfirming && (
        <div
          className="rounded-2xl p-5 space-y-4 animate-fade-up"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Call details
              </p>
              {autoFilled && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
                  style={{
                    background: 'rgba(99,102,241,0.1)',
                    color:      '#818cf8',
                    border:     '1px solid rgba(99,102,241,0.2)',
                  }}
                >
                  ✦ Auto-detected
                </span>
              )}
            </div>
            <button
              onClick={() => { pendingFile.current = null; setUploadState('idle') }}
              className="text-xs transition-colors"
              style={{ color: 'var(--text-faint)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-faint)')}
            >
              ✕ Change file
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Product / Service
              </label>
              <input
                type="text"
                placeholder="e.g. SalesCoach"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                autoFocus={!autoFilled}
                style={fieldStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.08)' }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Prospect / Company
              </label>
              <input
                type="text"
                placeholder="e.g. Acme Corp"
                value={prospect}
                onChange={(e) => setProspect(e.target.value)}
                style={fieldStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.08)' }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>
          </div>

          {(product || prospect) && (
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
              Saved as:{' '}
              <span className="font-mono" style={{ color: 'rgba(165,180,252,0.75)' }}>
                {buildFileName(product || 'call', prospect || 'prospect', pendingFile.current?.name ?? 'recording.mp3')}
              </span>
            </p>
          )}

          <button
            onClick={handleAnalyze}
            className="w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-all"
            style={{
              background:  'linear-gradient(135deg, #6366f1, #0ea5e9)',
              boxShadow:   '0 4px 16px rgba(99,102,241,0.3)',
              opacity:     1,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Analyze Call →
          </button>
        </div>
      )}

      {/* ── Upload / processing / done / error states ─────────────────────────── */}
      {(uploadState === 'uploading' || uploadState === 'processing' || uploadState === 'done' || uploadState === 'error') && (
        <div
          className="rounded-3xl p-14 text-center"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          {uploadState === 'uploading' && (
            <>
              <p className="font-semibold text-lg mb-1.5" style={{ color: 'var(--text-primary)' }}>Uploading…</p>
              <p className="text-base" style={{ color: 'var(--text-secondary)' }}>{progress}%</p>
              <div className="mt-5 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #6366f1, #0ea5e9)' }}
                />
              </div>
            </>
          )}

          {uploadState === 'processing' && (
            <>
              <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <svg className="w-6 h-6 animate-spin" style={{ color: '#818cf8' }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              </div>
              <p className="font-semibold text-lg mb-1.5" style={{ color: 'var(--text-primary)' }}>Analyzing call…</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Deepgram → Claude · 30–90 seconds</p>
            </>
          )}

          {uploadState === 'done' && (
            <p className="text-lg font-semibold" style={{ color: '#4ade80' }}>Done. Redirecting…</p>
          )}

          {uploadState === 'error' && (
            <>
              <p className="text-lg font-semibold mb-2" style={{ color: '#f87171' }}>Failed</p>
              <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>{errorMsg}</p>
              <button
                onClick={() => { setUploadState('idle'); setErrorMsg('') }}
                className="text-sm px-4 py-1.5 rounded-full transition-all"
                style={{ color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)' }}
              >
                Try again
              </button>
            </>
          )}
        </div>
      )}

      {isIdle && (
        <p className="text-center text-xs" style={{ color: 'var(--text-faint)' }}>
          Call recordings stay private. Only your team sees the analysis.
        </p>
      )}
    </div>
  )
}
