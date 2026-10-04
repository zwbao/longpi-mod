// M4 seam (AA §3.6). Grades the record the page and the chat already share.
// The signature stays feedbackFor(tracking, memory).

import type { FeedbackMessage } from '../contracts/feedback.ts'
import type { GoalItem } from '../contracts/memory.ts'
import type { MemoryApi } from '../contracts/memory.ts'
import type { CheckIn } from '../interventions.ts'
import type { Tracking } from '../tracking.ts'
import {
  bioAgeStory,
  buildFeedback,
  markerFromChange,
  markerFromEngine,
  type BehaviourInput,
  type BioAgeInput,
  type FeedbackInput,
  type LabMarkerInput,
  type ProjectionInput,
} from './grade.ts'

export {
  announcesYounger,
  buildFeedback,
  classifyMarker,
  gradeBioAge,
  gradeMarker,
  markerFromChange,
  markerFromEngine,
  markerFromGroundTruth,
  mentionsDeathRisk,
  projectionSentence,
} from './grade.ts'
export { shareCard, shareText } from './share.ts'
export { retestAdvice, retestDates } from './retest-timing.ts'

function projectionsFrom(tracking: Tracking, memory: MemoryApi | null): ProjectionInput[] {
  const pheno = tracking.models?.find((card) => card.model === 'phenoage')
  const levers = pheno?.levers ?? []
  if (levers.length > 0) {
    return levers.slice(0, 4).map((row) => ({
      label_zh: row.label,
      from_zh: row.from,
      target_zh: row.to,
      years: row.years,
    }))
  }
  if (!memory) return []
  try {
    return memory.active('goal').slice(0, 3).flatMap((item: GoalItem) => {
      const target = item.target?.value != null ? `${item.target.value}${item.target.unit ? ` ${item.target.unit}` : ''}` : ''
      if (!target && !item.text_zh) return []
      return [{ label_zh: item.text_zh, target_zh: target || item.text_zh, years: null }]
    })
  } catch {
    return []
  }
}

function behavioursFrom(tracking: Tracking): BehaviourInput[] {
  const today = tracking.today
  const byKey = new Map<string, BehaviourInput>()
  for (const item of tracking.items ?? []) {
    const done = item.adherence?.calendar?.some((day) => day.date === today && day.status === 'done')
    if (done) byKey.set(item.id, { key: item.id, title_zh: item.title, date: today })
  }
  for (const row of tracking.checkins ?? []) {
    const check = row as CheckIn
    if (check.date !== today || check.done !== true || check.undo) continue
    const titled = tracking.plan?.items.find((item) => item.id === check.item)?.title ?? check.item
    byKey.set(check.item, { key: check.item, title_zh: titled, date: today })
  }
  return [...byKey.values()]
}

function markersFrom(tracking: Tracking): LabMarkerInput[] {
  const out: LabMarkerInput[] = []
  const seen = new Set<string>()
  for (const item of tracking.items ?? []) {
    for (const verdict of item.verdicts ?? []) {
      const key = (verdict.indicator || verdict.marker || item.id).toString()
      const row = markerFromEngine({ ...verdict, confounders: verdict.confounders }, key)
      const id = row.label_zh
      if (seen.has(id)) continue
      seen.add(id)
      out.push(row)
    }
  }
  for (const change of tracking.changes ?? []) {
    if (seen.has(change.label_zh) || seen.has(change.key)) continue
    seen.add(change.label_zh)
    seen.add(change.key)
    out.push(markerFromChange(change))
  }
  return out
}

export function feedbackInput(tracking: Tracking, memory: MemoryApi | null): FeedbackInput {
  const latest = tracking.bioage?.points?.at(-1)
  const bio: BioAgeInput | null = tracking.bioage
    ? {
      points: tracking.bioage.points ?? [],
      band_years: tracking.bioage.band_years,
      band_verified: tracking.bioage.band_verified,
      age: latest?.advance != null && latest.phenoage != null ? latest.phenoage - latest.advance : null,
      phenoage: latest?.phenoage ?? null,
      advance: latest?.advance ?? null,
      date: latest?.date ?? null,
      draws: tracking.bioage.points?.length ?? 0,
      same_lab: null,
      ...bioAgeStory(tracking.bioage.headline_zh, tracking.bioage.allows_younger),
    }
    : null
  return {
    today: tracking.today,
    markers: markersFrom(tracking),
    bioage: bio && (bio.draws > 0 || bio.phenoage != null) ? bio : null,
    behaviours: behavioursFrom(tracking),
    projections: projectionsFrom(tracking, memory),
  }
}

export function feedbackFor(tracking: Tracking, memory: MemoryApi | null): FeedbackMessage[] {
  if (!tracking) return []
  return buildFeedback(feedbackInput(tracking, memory))
}
