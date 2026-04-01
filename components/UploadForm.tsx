/**
 * UploadForm — collects product + prospect name, then renames the file
 * to: {product}-{prospect}-{YYYYMMDD}-{HHmm}.{ext}
 * before uploading to storage.
 */
'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'

const ACCEPTED_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/wav',
  'audio/webm', 'audio/ogg', 'video/mp4',
]
const MAX_FILE_SIZE_MB = 100

type UploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

/** Slugify a label for the filename */
function toSlug(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** Build the display name: product-prospect-YYYYMMDD-HHmm.ext */
function buildFileName(product: string, prospect: string, originalName: string): string {
  const ext  = originalName.includes('.') ? originalName.split('.').pop() ?? '' : ''
  const now  = new Date()
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  const base = [toSlug(product), toSlug(prospect), date, time].filter(Boolean).join('-')
  return ext ? `${base}.${ext}` : base
}

export function UploadForm() {
  const router       = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [product,    setProduct]    = useState('')
  const [prospect,   setProspect]   = useState('')
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [progress,   setProgress]   = useState(0)
  const [errorMsg,   setErrorMsg]   = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [renamedFile, setRenamedFile] = useState<string | null>(null)

  const metaReady = product.trim().length > 0 && prospect.trim().length > 0

  const handleFile = useCallback(async (file: File) => {
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

    const displayName = buildFileName(product, prospect, file.name)
    setRenamedFile(displayName)
    setUploadState('uploading')
    setProgress(0)
    setErrorMsg('')

    try {
      const supabase    = createBrowserClient()
      const timestamp   = Date.now()
      const storagePath = `${timestamp}_${displayName.replace(/[^a-zA-Z0-9._-]/g, '_')}`

      setProgress(10)
      const { error: uploadError } = await supabase.storage
        .from('call-recordings')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false, contentType: file.type })

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

      setProgress(40)
      setUploadState('processing')

      const response = await fetch('/api/process', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          storage_path: storagePath,
          file_name:    displayName,   // renamed display name stored in DB
          file_size:    file.size,
        }),
      })

      setProgress(90)
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error ?? 'Processing failed')
      }

      const { call_id } = await response.json()
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
    if (!metaReady) return
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile, metaReady])

  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  const isActive = uploadState === 'uploading' || uploadState === 'processing'

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border:     '1px solid rgba(255,255,255,0.1)',
    color:      'white',
    borderRadius: '12px',
    padding:    '10px 14px',
    fontSize:   '14px',
    width:      '100%',
    outline:    'none',
    transition: 'all 0.15s ease',
  }

  return (
    <div className="w-full max-w-xl space-y-5">

      {/* ── Metadata fields ─────────────────────────────────── */}
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: 'rgba(13,13,26,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Call details
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Product / Service <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. SalesCoach"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              disabled={isActive}
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Prospect / Company <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Acme Corp"
              value={prospect}
              onChange={(e) => setProspect(e.target.value)}
              disabled={isActive}
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
        </div>
        {metaReady && (
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            File will be saved as:{' '}
            <span className="font-mono" style={{ color: 'rgba(165,180,252,0.8)' }}>
              {buildFileName(product, prospect, 'recording.mp3')}
            </span>
          </p>
        )}
      </div>

      {/* ── Drop zone ───────────────────────────────────────── */}
      <div
        onClick={() => metaReady && !isActive && fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className="relative rounded-3xl p-14 text-center transition-all duration-300"
        style={{
          background: isDragging
            ? 'rgba(99,102,241,0.08)'
            : 'rgba(13,13,26,0.95)',
          border: isDragging
            ? '2px dashed rgba(99,102,241,0.6)'
            : !metaReady
              ? '2px dashed rgba(255,255,255,0.05)'
              : '2px dashed rgba(255,255,255,0.1)',
          cursor: isActive || !metaReady ? 'not-allowed' : 'pointer',
          opacity: !metaReady ? 0.5 : 1,
          boxShadow: isDragging ? '0 0 32px rgba(99,102,241,0.2), inset 0 0 32px rgba(99,102,241,0.05)' : 'none',
          backdropFilter: 'blur(16px)',
        }}
        onMouseEnter={(e) => {
          if (metaReady && !isActive && !isDragging) {
            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'
            e.currentTarget.style.background  = 'rgba(99,102,241,0.04)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragging) {
            e.currentTarget.style.borderColor = metaReady ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'
            e.currentTarget.style.background  = 'rgba(13,13,26,0.95)'
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.mp4,.wav,.webm,.ogg,audio/*,video/mp4"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
          disabled={isActive || !metaReady}
        />

        {/* Icon */}
        <div
          className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300"
          style={{
            background: isDragging ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
            border:     isDragging ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.08)',
            boxShadow:  isDragging ? '0 0 20px rgba(99,102,241,0.3)' : 'none',
          }}
        >
          <svg
            className="w-8 h-8"
            style={{ color: isDragging ? '#818cf8' : 'rgba(255,255,255,0.3)' }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>

        {/* States */}
        {uploadState === 'idle' && (
          <>
            <p className="text-white font-semibold text-lg mb-1.5">
              {metaReady ? 'Drop your call recording here' : 'Fill in the details above first'}
            </p>
            {metaReady
              ? <p className="text-base mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>or click to browse</p>
              : <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Product and prospect name are required</p>
            }
            {metaReady && <p className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>MP3, MP4, WAV, WebM · Max 100MB</p>}
          </>
        )}

        {uploadState === 'uploading' && (
          <>
            <p className="text-white font-semibold text-lg mb-1.5">Uploading…</p>
            <p className="text-base" style={{ color: 'rgba(255,255,255,0.4)' }}>{progress}%</p>
            {renamedFile && <p className="text-xs mt-2 font-mono" style={{ color: 'rgba(165,180,252,0.6)' }}>{renamedFile}</p>}
          </>
        )}

        {uploadState === 'processing' && (
          <>
            <p className="text-white font-semibold text-lg mb-1.5">Analyzing call…</p>
            <p className="text-base" style={{ color: 'rgba(255,255,255,0.4)' }}>Deepgram → Claude · 30–90 seconds</p>
          </>
        )}

        {uploadState === 'done' && (
          <p className="text-lg font-semibold" style={{ color: '#4ade80' }}>Done. Redirecting…</p>
        )}

        {uploadState === 'error' && (
          <>
            <p className="text-lg font-semibold mb-2" style={{ color: '#f87171' }}>Upload failed</p>
            <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>{errorMsg}</p>
            <button
              onClick={(e) => { e.stopPropagation(); setUploadState('idle'); setErrorMsg('') }}
              className="text-sm px-4 py-1.5 rounded-full transition-all"
              style={{ color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)' }}
            >
              Try again
            </button>
          </>
        )}

        {/* Progress bar */}
        {isActive && (
          <div
            className="absolute bottom-0 left-0 right-0 h-1 rounded-b-3xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <div
              className="h-full transition-all duration-500"
              style={{
                width:      `${progress}%`,
                background: 'linear-gradient(90deg, #6366f1, #0ea5e9)',
                boxShadow:  '0 0 8px rgba(99,102,241,0.6)',
              }}
            />
          </div>
        )}
      </div>

      {uploadState === 'idle' && (
        <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Call recordings stay private. Only your team sees the analysis.
        </p>
      )}
    </div>
  )
}
