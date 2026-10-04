// Evidence-graded feedback (AA §3.3). Owner M4 may amend once before its first merge.

import type { Id, IsoDay, NumberRef } from './common.ts'

export type EvidenceGrade =
  | 'beyond_band_better' | 'beyond_band_worse'
  | 'within_band_improving' | 'within_band_flat' | 'within_band_worse'
  | 'too_early' | 'not_comparable' | 'first_draw' | 'not_judgeable'
  | 'behaviour_done' | 'projection'
export type Claim = 'younger' | 'improved' | 'celebrate' | 'progress_story' | 'retest_when' | 'affirm' | 'target' | 'see_doctor'
export interface FeedbackMessage {
  id: Id
  subject: { kind: 'bioage' | 'risk' | 'marker' | 'behaviour' | 'plan_item' | 'goal' | 'season'; key: string; label_zh: string }
  /** Deterministic (feedback/grade.ts over M9 verdicts). */
  grade: EvidenceGrade
  /** 'younger' iff kind==='bioage' && grade==='beyond_band_better' && band_verified && interval≥min && same_lab!==false. */
  allowed_claims: Claim[]
  numbers: NumberRef[]
  delta?: {
    value: number; unit: string; band: [number, number] | null; band_verified: boolean
    interval_days: number; min_interval_days: number; same_lab: boolean | null
  }
  retest?: { earliest: IsoDay; recommended: IsoDay; why_zh: string }
  /** The chip and the chat use this exact text. */
  headline_zh: string
  body_zh?: string
  tone: 'celebrate' | 'encourage' | 'neutral' | 'care'
  source: 'model' | 'template'
}

/** The rule behind allowed_claims 'younger' (contract invariant). */
export function youngerAllowed(message: Pick<FeedbackMessage, 'subject' | 'grade' | 'delta'>): boolean {
  const delta = message.delta
  return message.subject.kind === 'bioage' && message.grade === 'beyond_band_better' && delta != null
    && delta.band_verified && delta.interval_days >= delta.min_interval_days && delta.same_lab !== false
}
