/**
 * The core processing pipeline.
 * Orchestrates: Deepgram → Claude → Supabase → Slack
 *
 * This is the engine. Everything else is UI.
 *
 * Two entry points:
 *   processCall()        → for manually uploaded files (storage path → signed URL)
 *   processCallFromUrl() → for Recall.ai bot recordings (direct presigned URL)
 *
 * Both share the same inner pipeline via _runPipeline().
 * Designed to be dropped into a job queue (Inngest, Trigger.dev) without changing logic.
 */
import { createServerAdminClient } from '@/lib/supabase/server'
import { transcribeAudio } from '@/lib/deepgram'
import { extractInsights } from '@/lib/claude'
import { sendSlackNotification } from '@/lib/slack'

export interface PipelineInput {
  callId: string
  storagePath: string
  fileName: string
}

export interface PipelineInputFromUrl {
  callId: string
  audioUrl: string
  fileName: string
}

export interface PipelineResult {
  success: boolean
  callId: string
  error?: string
}

// ─── Shared inner pipeline ────────────────────────────────────────────────────

async function _runPipeline(
  callId: string,
  audioUrl: string,
  fileName: string
): Promise<PipelineResult> {
  const supabase = createServerAdminClient()

  try {
    // ─── Step 1: Transcribe with Deepgram ──────────────────────────────────
    console.log(`[Pipeline] Transcribing call ${callId} with Deepgram...`)
    const transcript = await transcribeAudio(audioUrl)

    await supabase
      .from('calls')
      .update({ duration_seconds: transcript.duration_seconds })
      .eq('id', callId)

    // ─── Step 2: Extract insights with Claude ──────────────────────────────
    console.log(`[Pipeline] Extracting insights for call ${callId} with Claude...`)
    const insights = await extractInsights(transcript.text)

    // ─── Step 3: Persist to Supabase ───────────────────────────────────────
    const { error: insightError } = await supabase.from('insights').insert({
      call_id: callId,
      transcript: transcript.text,
      summary: insights.summary,
      verdict: insights.verdict,
      verdict_reason: insights.verdict_reason,
      objections: insights.objections,
      risk_signals: insights.risk_signals,
      competitor_mentions: insights.competitor_mentions,
      talk_ratio: insights.talk_ratio,
      top_recommendation: insights.top_recommendation,
    })

    if (insightError) {
      throw new Error(`Failed to save insights: ${insightError.message}`)
    }

    const { error: callUpdateError } = await supabase
      .from('calls')
      .update({
        status: 'complete',
        verdict: insights.verdict,
        verdict_reason: insights.verdict_reason,
        summary: insights.summary,
      })
      .eq('id', callId)

    if (callUpdateError) {
      throw new Error(`Failed to update call status: ${callUpdateError.message}`)
    }

    // ─── Step 4: Slack notification ────────────────────────────────────────
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    await sendSlackNotification({
      callId,
      fileName,
      insights,
      callUrl: `${appUrl}/calls/${callId}`,
    })

    console.log(`[Pipeline] Call ${callId} processed. Verdict: ${insights.verdict}`)
    return { success: true, callId }

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Pipeline] Failed to process call ${callId}:`, message)

    await supabase
      .from('calls')
      .update({ status: 'failed', error_message: message })
      .eq('id', callId)

    return { success: false, callId, error: message }
  }
}

// ─── Entry point 1: manually uploaded file (Supabase Storage) ─────────────────

export async function processCall(input: PipelineInput): Promise<PipelineResult> {
  const { callId, storagePath, fileName } = input
  const supabase = createServerAdminClient()

  // Get a signed URL from Supabase Storage — Deepgram fetches audio from this URL.
  // Signed URL expires in 1 hour (well past any reasonable transcription time).
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('call-recordings')
    .createSignedUrl(storagePath, 3600)

  if (signedUrlError || !signedUrlData?.signedUrl) {
    const msg = `Failed to create signed URL: ${signedUrlError?.message}`
    await supabase
      .from('calls')
      .update({ status: 'failed', error_message: msg })
      .eq('id', callId)
    return { success: false, callId, error: msg }
  }

  return _runPipeline(callId, signedUrlData.signedUrl, fileName)
}

// ─── Entry point 2: Recall.ai bot recording (direct presigned URL) ────────────

/**
 * Used by the Recall webhook handler.
 * The audio URL comes directly from Recall's media_shortcuts.audio_mixed.data.presigned_url.
 * No Supabase Storage upload needed — Deepgram fetches it straight from Recall's CDN.
 */
export async function processCallFromUrl(input: PipelineInputFromUrl): Promise<PipelineResult> {
  const { callId, audioUrl, fileName } = input
  return _runPipeline(callId, audioUrl, fileName)
}
