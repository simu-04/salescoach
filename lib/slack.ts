/**
 * Slack notification layer.
 * Delivers call insights to where managers already live — their Slack.
 * No new habit required. This is the highest-value delivery mechanism.
 *
 * If SLACK_WEBHOOK_URL is not set, notifications are silently skipped.
 * This keeps the pipeline from failing during dev/testing.
 */
import type { InsightEngineOutput } from '@/types'

const VERDICT_EMOJI: Record<string, string> = {
  won: ':large_green_circle:',
  at_risk: ':large_yellow_circle:',
  lost: ':red_circle:',
}

const VERDICT_LABEL: Record<string, string> = {
  won: 'WON',
  at_risk: 'AT RISK',
  lost: 'LOST',
}

interface SlackNotificationInput {
  callId: string
  fileName: string
  insights: InsightEngineOutput
  callUrl: string   // Link back to the dashboard for this call
}

export async function sendSlackNotification(input: SlackNotificationInput): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    // Not configured — skip silently
    return
  }

  const { callId, fileName, insights, callUrl } = input
  const emoji = VERDICT_EMOJI[insights.verdict] ?? ':white_circle:'
  const label = VERDICT_LABEL[insights.verdict] ?? insights.verdict.toUpperCase()

  // Format a clean, scannable Slack message
  // Manager should get the signal in 5 seconds without clicking through
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} Call Analysis: ${label}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${fileName}*\n${insights.verdict_reason}`,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Summary*\n${insights.summary}`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Talk Ratio*\nRep ${insights.talk_ratio.rep}% / Prospect ${insights.talk_ratio.prospect}%`,
        },
        {
          type: 'mrkdwn',
          text: `*Competitors Mentioned*\n${
            insights.competitor_mentions.length > 0
              ? insights.competitor_mentions.join(', ')
              : 'None'
          }`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Top Recommendation*\n${insights.top_recommendation}`,
      },
    },
  ]

  // Add objections if any
  if (insights.objections.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Objections Raised*\n${insights.objections.map((o) => `• ${o}`).join('\n')}`,
      },
    })
  }

  // Add risk signals if not a won deal
  if (insights.verdict !== 'won' && insights.risk_signals.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Risk Signals*\n${insights.risk_signals.map((r) => `• ${r}`).join('\n')}`,
      },
    })
  }

  // CTA to view full analysis
  blocks.push(
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<${callUrl}|View full analysis →>`,
      },
    }
  )

  const payload = { blocks }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    // Log but don't throw — a failed Slack notification shouldn't fail the pipeline
    console.error(`Slack notification failed: ${response.status} ${response.statusText}`)
  }
}
