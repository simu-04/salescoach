/**
 * The core processing pipeline.
 * Orchestrates: Deepgram → Claude → Supabase → Slack
 *
 * This is the engine. Everything else is UI.
 *
 * Designed to be called from an API route today.
 * Designed to be dropped into a job queue (Inngest, Trigger.dev) tomorrow
 * without changing any of this logic — just swap the caller.
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

export interface PipelineResult {
  success: boolean
  callId: string
  error?: string
}

export async function processCall(input: PipelineInput): Promise<PipelineResult> {
  const { callId, storagePath, fileName } = input
  const supabase = createServerAdminClient()

  try {
    // ─── Step 1: Get a signed URL for the audio file ─────────────────────────
    // Deepgram fetches the audio directly from this URL.
    // We use a signed URL (expires in 1 hour) rather than making the bucket public.
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('call-recordings')
      .createSignedUrl(storagePath, 3600) // 1 hour expiry

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${signedUrlError?.message}`)
    }

    const audioUrl = signedUrlData.signedUrl

    // ─── Step 2: Transcribe with Deepgram ────────────────────────────────────
    console.log(`[Pipeline] Transcribing call ${callId} with Deepgram...`)
    const transcript = await transcribeAudio(audioUrl)

    // Update duration now that we have it from Deepgram
    await supabase
      .from('calls')
      .update({ duration_seconds: transcript.duration_seconds })
      .eq('id', callId)

    // ─── Step 3: Extract insights with Claude ────────────────────────────────
    console.log(`[Pipeline] Extracting insights for call ${callId} with Claude...`)
    const insights = await extractInsights(transcript.text)

    // ─── Step 4: Persist to Supabase ─────────────────────────────────────────
    // Store full insight row
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

    // Denormalize key fields onto the call row for fast dashboard queries
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

    // ─── Step 5: Send Slack notification ─────────────────────────────────────
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    await sendSlackNotification({
      callId,
      fileName,
      insights,
      callUrl: `${appUrl}/calls/${callId}`,
    })

    console.log(`[Pipeline] Call ${callId} processed successfully. Verdict: ${insights.verdict}`)

    return { success: true, callId }

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Pipeline] Failed to process call ${callId}:`, message)

    // Mark the call as failed — don't leave it stuck in "processing" forever
    await supabase
      .from('calls')
      .update({
        status: 'failed',
        error_message: message,
      })
      .eq('id', callId)

    return { success: false, callId, error: message }
  }
}
