/**
 * Claude insight engine.
 * The core of the product — this is what separates us from a transcription tool.
 *
 * Input: speaker-labeled transcript
 * Output: structured JSON insight object (InsightEngineOutput)
 *
 * The prompt is the most important file in this codebase.
 * Treat it like production code — version it, test it, iterate it.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { InsightEngineOutput } from '@/types'

// ─── The Insight Prompt ───────────────────────────────────────────────────────
// Designed to extract exactly what a sales manager needs to know.
// One call, one verdict, one recommendation. No noise.

const INSIGHT_SYSTEM_PROMPT = `You are a senior sales intelligence analyst. You have studied thousands of B2B sales calls and know exactly what separates deals that close from deals that die.

Your only job is to analyze a sales call transcript and return structured JSON insights. You are obsessed with one metric: conversion rate. Every insight you produce should help a sales manager coach their rep to close more deals.

Rules:
- Return ONLY valid JSON. No explanation, no preamble, no markdown code fences.
- Be specific. Vague insights are worthless. Name the exact moment, the exact objection, the exact mistake.
- verdict must be one of: "won", "at_risk", "lost"
  - "won": strong buying signals, prospect engaged, next steps agreed
  - "at_risk": mixed signals, unresolved objections, vague next steps, timeline unclear
  - "lost": clear disinterest, hard no, ghosting signals, competitor preferred
- talk_ratio rep + prospect must sum to 100. Ideal rep ratio is 40-50%. If rep talks 70%+, flag it.
- top_recommendation must be ONE sentence. The single most important thing the rep should do differently next time.`

const INSIGHT_USER_PROMPT = (transcript: string) => `Analyze this sales call transcript and return JSON with exactly this structure:

{
  "summary": "2 sentence overview of what happened in this call",
  "verdict": "won" | "at_risk" | "lost",
  "verdict_reason": "one sentence explaining exactly why you gave this verdict",
  "objections": ["array of specific objections the prospect raised"],
  "risk_signals": ["top 3 specific moments or statements that hurt conversion chances"],
  "competitor_mentions": ["any competitor names mentioned by either party"],
  "talk_ratio": { "rep": <number 0-100>, "prospect": <number 0-100> },
  "top_recommendation": "the single most important thing the rep should do differently"
}

TRANSCRIPT:
${transcript}

Return only valid JSON.`

// ─── Insight Engine ───────────────────────────────────────────────────────────

export async function extractInsights(transcript: string): Promise<InsightEngineOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: INSIGHT_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: INSIGHT_USER_PROMPT(transcript),
      },
    ],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Claude returned unexpected content type')
  }

  // Parse and validate the JSON output
  let parsed: InsightEngineOutput
  try {
    // Strip any accidental markdown code fences if Claude added them
    const cleaned = content.text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Claude returned invalid JSON: ${content.text.substring(0, 200)}`)
  }

  // Validate required fields
  const required: (keyof InsightEngineOutput)[] = [
    'summary', 'verdict', 'verdict_reason', 'objections',
    'risk_signals', 'competitor_mentions', 'talk_ratio', 'top_recommendation'
  ]
  for (const field of required) {
    if (parsed[field] === undefined || parsed[field] === null) {
      throw new Error(`Claude response missing required field: ${field}`)
    }
  }

  // Validate verdict value
  if (!['won', 'at_risk', 'lost'].includes(parsed.verdict)) {
    throw new Error(`Invalid verdict value: ${parsed.verdict}`)
  }

  // Ensure talk_ratio sums to ~100 (allow ±2 for rounding)
  const ratioSum = (parsed.talk_ratio?.rep ?? 0) + (parsed.talk_ratio?.prospect ?? 0)
  if (Math.abs(ratioSum - 100) > 2) {
    // Normalize rather than error — don't fail a call over a math rounding issue
    parsed.talk_ratio = {
      rep: parsed.talk_ratio?.rep ?? 50,
      prospect: 100 - (parsed.talk_ratio?.rep ?? 50),
    }
  }

  return parsed
}
