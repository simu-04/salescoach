/**
 * UploadForm — glass drop zone with gradient glow on drag + active states.
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

export function UploadForm() {
  const router       = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [progress, setProgress]       = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [isDragging, setIsDragging]   = useState(false)

  const handleFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrorMessage('Unsupported file type. Upload .mp3, .mp4, .wav, or .webm.')
      setUploadState('error')
      return
    }
    const fileSizeMB = file.size / (1024 * 1024)
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      setErrorMessage(`File too large. Max ${MAX_FILE_SIZE_MB}MB.`)
      setUploadState('error')
      return
    }

    setUploadState('uploading'); setProgress(0); setErrorMessage('')

    try {
      const supabase    = createBrowserClient()
      const timestamp   = Date.now()
      const safeName    = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${timestamp}_${safeName}`

      setProgress(10)
      const { error: uploadError } = await supabase.storage
        .from('call-recordings')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false, contentType: file.type })

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

      setProgress(40); setUploadState('processing')

      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: storagePath, file_name: file.name, file_size: file.size }),
      })

      setProgress(90)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error ?? 'Processing failed')
      }

      const { call_id } = await response.json()
      setProgress(100); setUploadState('done')
      router.push(`/calls/${call_id}`)

    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong')
      setUploadState('error')
    }
  }, [router])

  const handleDrop      = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  const isActive = uploadState === 'uploading' || uploadState === 'processing'

  const zoneStyle = (() => {
    if (isDragging) return {
      background: 'rgba(99,102,241,0.08)',
      border:     '2px dashed rgba(99,102,241,0.6)',
      boxShadow:  '0 0 32px rgba(99,102,241,0.2), inset 0 0 32px rgba(99,102,241,0.05)',
    }
    if (isActive) return {
      background: 'rgba(13,13,26,0.95)',
      border:     '2px dashed rgba(255,255,255,0.12)',
    }
    return {
      background: 'rgba(13,13,26,0.95)',
      border:     '2px dashed rgba(255,255,255,0.1)',
    }
  })()

  return (
    <div className="w-full max-w-xl">
      <div
        onClick={() => !isActive && fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className="relative rounded-3xl p-14 text-center transition-all duration-300"
        style={{
          ...zoneStyle,
          cursor: isActive ? 'not-allowed' : 'pointer',
          backdropFilter: 'blur(16px)',
        }}
        onMouseEnter={(e) => {
          if (!isActive && !isDragging) {
            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'
            e.currentTarget.style.background  = 'rgba(99,102,241,0.04)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragging) {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
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
          disabled={isActive}
        />

        {/* Icon */}
        <div
          className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{
            background: isDragging
              ? 'rgba(99,102,241,0.2)'
              : 'rgba(255,255,255,0.05)',
            border: isDragging
              ? '1px solid rgba(99,102,241,0.4)'
              : '1px solid rgba(255,255,255,0.08)',
            boxShadow: isDragging ? '0 0 20px rgba(99,102,241,0.3)' : 'none',
            transition: 'all 0.3s ease',
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

        {uploadState === 'idle' && (
          <>
            <p className="text-white font-semibold text-lg mb-1.5">Drop your call recording here</p>
            <p className="text-base mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>or click to browse</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>MP3, MP4, WAV, WebM · Max 100MB</p>
          </>
        )}

        {uploadState === 'uploading' && (
          <>
            <p className="text-white font-semibold text-lg mb-1.5">Uploading...</p>
            <p className="text-base" style={{ color: 'rgba(255,255,255,0.4)' }}>{progress}%</p>
          </>
        )}

        {uploadState === 'processing' && (
          <>
            <p className="text-white font-semibold text-lg mb-1.5">Analyzing call...</p>
            <p className="text-base" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Deepgram → Claude · 30–90 seconds
            </p>
          </>
        )}

        {uploadState === 'done' && (
          <p className="text-lg font-semibold" style={{ color: '#4ade80' }}>Done. Redirecting...</p>
        )}

        {uploadState === 'error' && (
          <>
            <p className="text-lg font-semibold mb-2" style={{ color: '#f87171' }}>Upload failed</p>
            <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>{errorMessage}</p>
            <button
              onClick={(e) => { e.stopPropagation(); setUploadState('idle'); setErrorMessage('') }}
              className="text-sm px-4 py-1.5 rounded-full transition-all"
              style={{
                color: '#818cf8',
                border: '1px solid rgba(99,102,241,0.3)',
                background: 'rgba(99,102,241,0.08)',
              }}
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
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #6366f1, #0ea5e9)',
                boxShadow: '0 0 8px rgba(99,102,241,0.6)',
              }}
            />
          </div>
        )}
      </div>

      {uploadState === 'idle' && (
        <p className="text-center text-xs mt-4" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Call recordings stay private. Only your team sees the analysis.
        </p>
      )}
    </div>
  )
}
