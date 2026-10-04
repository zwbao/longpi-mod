// A card the person can copy when a change is past the noise band.
// It repeats the graded headline; it does not add a "younger" claim of its own.

import type { FeedbackMessage } from '../contracts/feedback.ts'

export interface ShareCardModel {
  id: string
  title_zh: string
  headline_zh: string
  lines_zh: string[]
  footnote_zh: string
}

export function shareCard(messages: readonly FeedbackMessage[]): ShareCardModel | null {
  const bio = messages.find((row) => row.subject.kind === 'bioage' && row.allowed_claims.includes('younger'))
  const wins = messages.filter((row) => row.grade === 'beyond_band_better' && row.tone === 'celebrate' && row.subject.kind === 'marker' && row.subject.key !== 'panel')
  if (!bio && wins.length === 0) return null
  const lines = wins.map((row) => row.headline_zh)
  if (bio) {
    return {
      id: 'fb-share',
      title_zh: '可以分享的一句话',
      headline_zh: bio.headline_zh,
      lines_zh: lines,
      footnote_zh: '超出了测量波动，是真实的变化。仅在同一实验室、间隔充足时作此结论。这不是诊断。',
    }
  }
  const summary = messages.find((row) => row.id === 'fb-summary' && row.grade === 'beyond_band_better')
  return {
    id: 'fb-share',
    title_zh: '可以分享的一句话',
    headline_zh: summary?.headline_zh ?? wins[0]?.headline_zh ?? '',
    lines_zh: lines,
    footnote_zh: '超出了测量波动，是真实的变化。这不是诊断，也不是「多活几年」。',
  }
}

export function shareText(card: ShareCardModel): string {
  return [card.headline_zh, ...card.lines_zh, card.footnote_zh].filter(Boolean).join('\n')
}
