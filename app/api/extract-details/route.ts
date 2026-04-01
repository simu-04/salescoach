/**
 * POST /api/extract-details
 *
 * Accepts a raw audio slice (first ~2MB of the file) and returns
 * the product/service name and prospect/company extracted from the
 * opening of the sales call.
 *
 * Flow:
 *   browser slices file → Deepgram transcribes snippet → Claude Haiku extracts names
 *
 * Cheap + fast: ~60 seconds of audio, 1 Haiku call.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createDeepgramClient } from '@deepgram/sdk'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase/server'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Parse audio slice from FormData ──────────────────────────────────────
    const formData = await req.formData()
    const slice    = formData.get('slice') as File | null

    if (!slice) {
      return NextResponse.json({ error: 'No audio slice provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await slice.arrayBuffer())

    // ── Transcribe with Deepgram (nova-3, no diarize for speed) ─────────────
    const deepgramKey = process.env.DEEPGRAM_API_KEY
    if (!deepgramKey) throw new Error('DEEPGRAM_API_KEY not set')

    const deepgram = createDeepgramClient(deepgramKey)

    const { result, error: dgError } = await deepgram.listen.prerecorded.transcribeFile(
      buffer,
      {
        model:        'nova-3',
        smart_format: true,
        diarize:      false,   // skip for speed
        punctuate:    true,
        language:     'en',
      }
    )

    if (dgError) throw new Error(`Deepgram error: ${dgError.message}`)

    const rawTranscript =
      result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''

    if (!rawTranscript || rawTranscript.trim().length < 20) {
      // Not enough speech to extract from
      return NextResponse.json({ product: null, prospect: null, reason: 'insufficient_audio' })
    }

    // Take first 600 words — plenty for company/product detection
    const snippet = rawTranscript.split(/\s+/).slice(0, 600).join(' ')

    // ── Extract product + prospect with Claude Haiku ──────────────────────────
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not set')

    const anthropic = new Anthropic({ apiKey: anthropicKey })

    const message = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `You are extracting two facts from the opening of a sales call transcript.

Transcript (first ~60 seconds):
"""
${snippet}
"""

Return ONLY valid JSON with exactly these two keys:
- "product": the product, service, or solution being sold (short name, 1-4 words). null if unclear.
- "prospect": the company or person being sold to (short name, 1-3 words). null if unclear.

Do not include any explanation. Return only the JSON object.`,
      }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()

    // Parse Claude's JSON response safely
    let product:  string | null = null
    let prospect: string | null = null

    try {
      // Strip any markdown fences if present
      const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      const parsed  = JSON.parse(jsonStr)
      product  = typeof parsed.product  === 'string' ? parsed.product.trim()  : null
      prospect = typeof parsed.prospect === 'string' ? parsed.prospect.trim() : null
    } catch {
      // If JSON parse fails, leave both null — caller degrades gracefully
    }

    return NextResponse.json({ product, prospect })

  } catch (err) {
    console.error('[extract-details] error:', err)
    return NextResponse.json({ product: null, prospect: null, reason: 'error' })
  }
}
