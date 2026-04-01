/**
 * Deepgram transcription layer.
 * Model: Nova-3 — ~$4.30/1,000 min, <300ms latency, built-in speaker diarization.
 *
 * Input: public audio URL (from Supabase Storage signed URL)
 * Output: formatted transcript with speaker labels ("Rep: ..." / "Prospect: ...")
 */
import { createClient } from '@deepgram/sdk'

// Speaker label mapping — Rep is always speaker 0 in a sales call.
// This assumption holds for 1-on-1 calls. For multi-prospect calls, expand later.
const SPEAKER_LABELS: Record<number, string> = {
  0: 'Rep',
  1: 'Prospect',
}

function getSpeakerLabel(speakerIndex: number): string {
  return SPEAKER_LABELS[speakerIndex] ?? `Speaker ${speakerIndex}`
}

export interface TranscriptResult {
  text: string          // Speaker-labeled formatted transcript
  duration_seconds: number
  word_count: number
}

export async function transcribeAudio(audioUrl: string): Promise<TranscriptResult> {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY is not set')

  const deepgram = createClient(apiKey)

  const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
    { url: audioUrl },
    {
      model: 'nova-3',
      smart_format: true,       // auto-punctuation + formatting
      diarize: true,            // speaker detection
      utterances: true,         // segment by speaker turn
      punctuate: true,
      language: 'en',
    }
  )

  if (error) {
    throw new Error(`Deepgram transcription failed: ${error.message}`)
  }

  const metadata = result?.metadata
  const duration = metadata?.duration ?? 0
  const channels = result?.results?.channels

  if (!channels || channels.length === 0) {
    throw new Error('Deepgram returned no transcription channels')
  }

  // Use utterances for speaker-turn-level formatting (cleaner than word-level)
  const utterances = result?.results?.utterances

  let formattedTranscript: string
  let wordCount = 0

  if (utterances && utterances.length > 0) {
    const lines = utterances.map((u) => {
      const speaker = getSpeakerLabel(u.speaker ?? 0)
      const text = u.transcript.trim()
      wordCount += text.split(/\s+/).length
      return `${speaker}: ${text}`
    })
    formattedTranscript = lines.join('\n\n')
  } else {
    // Fallback: use full transcript without speaker labels
    const fullText = channels[0]?.alternatives?.[0]?.transcript ?? ''
    formattedTranscript = fullText
    wordCount = fullText.split(/\s+/).length
  }

  return {
    text: formattedTranscript,
    duration_seconds: Math.round(duration),
    word_count: wordCount,
  }
}
