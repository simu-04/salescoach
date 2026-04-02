/**
 * Claude insight engine — v2
 *
 * This is the core of the product. The prompt is everything.
 * v2 improvements over v1:
 *   - Extracts buying signals (not just risk signals)
 *   - Scores call momentum (how engagement changed across the call)
 *   - Rep coaching points: 1 thing done well, 1 thing to fix
 *   - Objection handling quality (did rep address or deflect?)
 *   - Next step clarity rating
 *   - Deeper, quote-backed verdict reasoning
 *   - top_recommendation is now a specific script, not vague advice
 */
import Anthropic from '@anthropic-ai/sdk'
import type { InsightEngineOutput } from '@/types'

// ─── System Prompt ────────────────────────────────────────────────────────────
const INSIGHT_SYSTEM_PROMPT = `You are a world-class B2B sales coach and conversation analyst. You've personally reviewed 50,000+ sales calls. You think like a revenue operations director — every insight you produce must be specific enough to change rep behaviour.

You analyze sales call transcripts and return structured JSON. You are obsessed with one metric: conversion rate. Vague feedback is your enemy.

VERDICT CRITERIA (be strict):
- "won": Multiple buying signals (budget confirmed, timeline set, champion identified, or explicit next step with date agreed). Prospect is leaning in.
- "at_risk": Mixed signals. Prospect showed some interest but left objections unresolved, timeline vague, or next steps unclear. Could go either way.
- "lost": Clear disinterest, hard no, ghosting signals, competitor explicitly preferred, budget definitively unavailable, or "send me info" brush-off with no real engagement.

TALK RATIO RULES:
- Ideal rep ratio: 40–50%. This is how top closers operate.
- 51–60%: Slightly rep-heavy. Flag it.
- 61–70%: Problem. Rep is pitching, not discovering.
- 71%+: Red flag. Rep is killing the deal.
- Under 35%: Rep may be too passive, not guiding the conversation.

OUTPUT RULES:
- Return ONLY valid JSON. No preamble. No explanation. No markdown fences.
- All string values must be specific — name the exact moment, quote the exact words, cite the exact mistake.
- "top_recommendation" must be ONE actionable sentence that a rep could implement in their NEXT call within 24 hours. Include what to SAY, not just what to do.`

// ─── User Prompt ──────────────────────────────────────────────────────────────
const INSIGHT_USER_PROMPT = (transcript: string) => `Analyze this sales call transcript and return JSON with EXACTLY this structure:

{
  "summary": "3 sentences: (1) what product/service was being sold and to whom, (2) how the prospect responded and what their key concern was, (3) what the likely outcome is and why",
  "verdict": "won" | "at_risk" | "lost",
  "verdict_reason": "One sentence, max 20 words. Quote the prospect if possible. No filler.",
  "objections": [
    "Max 10 words each. Format: '[Objection] — [rep's response in 3 words]'. Example: 'Budget tight, only 89k available — rep ignored'. No filler."
  ],
  "risk_signals": [
    "Max 10 words each. Lead with the specific moment or quote. Example: 'Rep declared sale done before payment confirmed'. Max 4."
  ],
  "buying_signals": [
    "Max 8 words each. One crisp observation. Example: 'Prospect asked about onboarding timeline'. Max 3. Empty array if none."
  ],
  "competitor_mentions": [
    "Format as: '[Competitor name]: [context — what was said about them]'. Empty array if none."
  ],
  "talk_ratio": { "rep": <integer 0-100>, "prospect": <integer 0-100> },
  "top_recommendation": "The single highest-leverage thing the rep should do differently in their next call. Start with the verb. Include what to SAY. Example: 'Open with the question: What does your current process cost you per month in lost time? — then stay silent. Right now you jump to pitching before discovering pain.'",
  "coaching": {
    "did_well": "Max 12 words. One specific positive. Example: 'Uncovered budget constraint early with direct question'.",
    "fix_immediately": "Max 12 words. The single biggest mistake. Example: 'Declared sale done before payment confirmed on call'."
  },
  "next_step_clarity": "clear" | "vague" | "none",
  "engagement_arc": "rising" | "flat" | "declining" | "mixed"
}

TRANSCRIPT:
${transcript}

Return only valid JSON. No markdown. No explanation.`

// ─── Insight Engine ───────────────────────────────────────────────────────────

export async function extractInsights(transcript: string): Promise<InsightEngineOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 1500,   // increased for richer output
    system:     INSIGHT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: INSIGHT_USER_PROMPT(transcript) }],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Claude returned unexpected content type')
  }

  let parsed: InsightEngineOutput
  try {
    // Strip accidental markdown fences
    const cleaned = content.text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Claude returned invalid JSON: ${content.text.substring(0, 300)}`)
  }

  // ── Validate required core fields ────────────────────────────────────────
  const required: (keyof InsightEngineOutput)[] = [
    'summary', 'verdict', 'verdict_reason', 'objections',
    'risk_signals', 'competitor_mentions', 'talk_ratio', 'top_recommendation',
  ]
  for (const field of required) {
    if (parsed[field] === undefined || parsed[field] === null) {
      throw new Error(`Claude response missing required field: ${field}`)
    }
  }

  if (!['won', 'at_risk', 'lost'].includes(parsed.verdict)) {
    throw new Error(`Invalid verdict: ${parsed.verdict}`)
  }

  // ── Normalize talk_ratio ─────────────────────────────────────────────────
  const ratioSum = (parsed.talk_ratio?.rep ?? 0) + (parsed.talk_ratio?.prospect ?? 0)
  if (Math.abs(ratioSum - 100) > 2) {
    parsed.talk_ratio = {
      rep: parsed.talk_ratio?.rep ?? 50,
      prospect: 100 - (parsed.talk_ratio?.rep ?? 50),
    }
  }

  // ── Backfill v2 fields gracefully (old DB rows won't have them) ──────────
  parsed.buying_signals     = parsed.buying_signals ?? []
  parsed.coaching           = parsed.coaching ?? null
  parsed.next_step_clarity  = parsed.next_step_clarity ?? 'vague'
  parsed.engagement_arc     = parsed.engagement_arc ?? 'flat'

  return parsed
}
