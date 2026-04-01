/**
 * UploadForm — the entry point for all value delivery.
 * Uploads audio directly to Supabase Storage (client-side),
 * then triggers server-side processing. Bypasses Next.js body size limit.
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
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    // Validate type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrorMessage('Unsupported file type. Upload .mp3, .mp4, .wav, or .webm.')
      setUploadState('error')
      return
    }

    // Validate size
    const fileSizeMB = file.size / (1024 * 1024)
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      setErrorMessage(`File too large. Max ${MAX_FILE_SIZE_MB}MB.`)
      setUploadState('error')
      return
    }

    setUploadState('uploading')
    setProgress(0)
    setErrorMessage('')

    try {
      const supabase = createBrowserClient()

      // Generate a unique storage path
      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${timestamp}_${safeName}`

      // ─── Upload to Supabase Storage ───────────────────────────────────────
      // Client uploads directly — avoids server payload limits entirely
      setProgress(10)
      const { error: uploadError } = await supabase.storage
        .from('call-recordings')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      setProgress(40)
      setUploadState('processing')

      // ─── Trigger server-side processing ───────────────────────────────────
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_path: storagePath,
          file_name: file.name,
          file_size: file.size,
        }),
      })

      setProgress(90)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error ?? 'Processing failed')
      }

      const { call_id } = await response.json()
      setProgress(100)
      setUploadState('done')

      // Redirect to the call detail page
      router.push(`/calls/${call_id}`)

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setErrorMessage(message)
      setUploadState('error')
    }
  }, [router])

  // Drag and drop handlers
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const isActive = uploadState === 'uploading' || uploadState === 'processing'

  return (
    <div className="w-full max-w-xl">
      {/* Drop zone */}
      <div
        onClick={() => !isActive && fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200
          ${isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : isActive
              ? 'border-slate-600 bg-slate-800/30 cursor-not-allowed'
              : 'border-slate-700 bg-slate-900 hover:border-slate-500 hover:bg-slate-800/50 cursor-pointer'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.mp4,.wav,.webm,.ogg,audio/*,video/mp4"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            // Reset so same file can be re-uploaded
            e.target.value = ''
          }}
          disabled={isActive}
        />

        {/* Icon */}
        <div className="mx-auto w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>

        {/* Content by state */}
        {uploadState === 'idle' && (
          <>
            <p className="text-white font-medium mb-1">Drop your call recording here</p>
            <p className="text-sm text-slate-400">or click to browse</p>
            <p className="text-xs text-slate-600 mt-3">MP3, MP4, WAV, WebM · Max 100MB</p>
          </>
        )}

        {uploadState === 'uploading' && (
          <>
            <p className="text-white font-medium mb-1">Uploading...</p>
            <p className="text-sm text-slate-400">{progress}%</p>
          </>
        )}

        {uploadState === 'processing' && (
          <>
            <p className="text-white font-medium mb-1">Analyzing call...</p>
            <p className="text-sm text-slate-400">Deepgram → Claude · This takes 30–90 seconds</p>
          </>
        )}

        {uploadState === 'done' && (
          <>
            <p className="text-green-400 font-medium mb-1">Done. Redirecting...</p>
          </>
        )}

        {uploadState === 'error' && (
          <>
            <p className="text-red-400 font-medium mb-1">Upload failed</p>
            <p className="text-sm text-slate-400">{errorMessage}</p>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setUploadState('idle')
                setErrorMessage('')
              }}
              className="mt-3 text-xs text-blue-400 hover:text-blue-300"
            >
              Try again
            </button>
          </>
        )}

        {/* Progress bar */}
        {isActive && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800 rounded-b-2xl overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Helper text */}
      {uploadState === 'idle' && (
        <p className="text-center text-xs text-slate-600 mt-3">
          Call recordings stay private. Only your team sees the analysis.
        </p>
      )}
    </div>
  )
}
