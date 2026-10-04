// The graded sentences on 总览, computed exactly as the web page did (client/feedback/index.ts): the server's own
// grader over the journey and tracking, leaving out markers that only come from record changes (值得注意的变化
// says those once). The `feedback` route grades with the record changes included, which would say HbA1c twice.

import type { FeedbackMessage } from '../../../core/contracts/feedback.ts'
import { bioAgeStory, buildFeedback, markerFromChange, markerFromEngine, type BehaviourInput, type BioAgeInput, type FeedbackInput, type ProjectionInput } from '../../../core/feedback/grade.ts'
import { shareCard, shareText, type ShareCardModel } from '../../../core/feedback/share.ts'
import type { Journey, Tracking } from './journey.ts'
import { datesZh, keepWhole } from './words.ts'

export type { FeedbackMessage, ShareCardModel }

export function feedbackInputOf(journey: Journey, tracking: Tracking | null, opts: { recordChanges?: boolean } = {}): FeedbackInput {
  const markers = []
  const seen = new Set<string>()
  for (const item of tracking?.items ?? []) {
    for (const verdict of item.verdicts ?? []) {
      const key = verdict.indicator || verdict.marker
      const row = markerFromEngine(verdict, key)
      if (seen.has(row.label_zh)) continue
      seen.add(row.label_zh)
      markers.push(row)
    }
  }
  for (const change of opts.recordChanges === false ? [] : journey.changes) {
    if (seen.has(change.label_zh) || seen.has(change.key)) continue
    seen.add(change.label_zh)
    markers.push(markerFromChange(change))
  }
  const loose = tracking?.bioage
  const points = loose?.points ?? []
  const result = journey.results.bioage
  const bio: BioAgeInput = {
    points,
    band_years: loose?.band_years ?? result.band_years,
    band_verified: loose?.band_verified === true,
    age: journey.profile.age,
    phenoage: points.at(-1)?.phenoage ?? result.phenoage,
    advance: points.at(-1)?.advance ?? result.advance,
    date: points.at(-1)?.date ?? result.date,
    draws: points.length > 0 ? points.length : result.checkups,
    same_lab: null,
    ...bioAgeStory(result.headline_zh, result.allows_younger),
  }
  const behaviours: BehaviourInput[] = journey.plan.checkin_items
    .filter((item) => item.done_today === true)
    .map((item) => ({ key: item.id, title_zh: item.title, date: journey.today }))
  const pheno = tracking?.models?.find((card) => card.model === 'phenoage')
  const projections: ProjectionInput[] = (pheno?.levers ?? []).slice(0, 4).map((row) => ({
    label_zh: row.label,
    from_zh: row.from,
    target_zh: row.to,
    years: row.years,
  }))
  return {
    today: journey.today,
    markers,
    bioage: result.status === 'ok' || points.length > 0 ? bio : null,
    behaviours,
    projections,
  }
}

export function messagesFor(journey: Journey, tracking: Tracking | null, opts: { recordChanges?: boolean } = {}): FeedbackMessage[] {
  try {
    return buildFeedback(feedbackInputOf(journey, tracking, opts))
  } catch {
    return []
  }
}

export function shareOf(messages: readonly FeedbackMessage[]): { card: ShareCardModel; text: string } | null {
  const card = shareCard(messages)
  return card ? { card, text: shareText(card) } : null
}

function retestLine(retest: NonNullable<FeedbackMessage['retest']>, today: string): string {
  if (retest.why_zh.includes('复测已在')) return datesZh(retest.why_zh, today)
  return `建议复测：${datesZh(retest.earliest, today)}至 ${datesZh(retest.recommended, today)}。${datesZh(retest.why_zh, today)}`
}

/** feedback-card.ts linesOf: each thing said once; a later clause that restates a waiting time is dropped. */
export function linesOf(row: FeedbackMessage, today: string): string[] {
  const seen: string[] = []
  const waits = new Set<string>()
  const key = (text: string) => text.replace(/[\s，,。；]/g, '')
  const out = [row.headline_zh, row.body_zh ?? '', row.retest ? retestLine(row.retest, today) : ''].map((line) => {
    const clauses = datesZh(line, today).split(/(?<=[，。；])/)
    const kept = clauses.filter((clause) => {
      const k = key(clause)
      if (!k) return false
      const wait = /至少(?:要满|要隔|隔)?\s*(\d+)\s*天/.exec(clause)?.[1]
      const dup = seen.some((other) => other.includes(k)) || (wait != null && waits.has(wait))
      return !dup
    })
    for (const clause of kept) {
      seen.push(key(clause))
      const wait = /至少(?:要满|要隔|隔)?\s*(\d+)\s*天/.exec(clause)?.[1]
      if (wait) waits.add(wait)
    }
    return kept.join('').replace(/[，；]$/, '。')
  })
  return out.filter(Boolean).map(keepWhole)
}
