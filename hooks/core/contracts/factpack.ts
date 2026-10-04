// The per-person fact pack (AA §2.4, §3.3). Frozen at C0, plus method_results (0.6.0 C1).

import type { Id, IsoDay, NumberRef } from './common.ts'
import type { MethodResult } from './library.ts'
import type { ConditionFlag, DrugClass, ExclusionItem } from './memory.ts'
import type { NextBestAction } from './surfaces.ts'
import type { FeedbackMessage } from './feedback.ts'
import type { ScienceMode } from './science.ts'
import type { TriageFinding } from './triage.ts'

export type FactPriority = 'emergency' | 'must_surface' | 'should_surface' | 'context'
export interface TopFact {
  id: Id
  kind: 'triage' | 'safety_med' | 'safety_condition' | 'screening' | 'care_followup' | 'milestone' | 'goal'
  priority: FactPriority
  /** Deterministic wording; the fallback shows it verbatim. */
  text_zh: string
  refs: NumberRef[]
  /** TriageFinding / MemoryItem / FeedbackMessage ids. */
  source_ids: Id[]
  /** e.g. 'triage.pattern.microcytic_progressive'. */
  rule: string
}
export type Stage = 'consent' | 'profile' | 'records' | 'first_result' | 'plan' | 'routine'   // = journey.ts Stage
export interface FactPack {
  version: 1
  /** sha256 of the canonical generator-visible fields. */
  fp: string
  today: IsoDay
  stage: Stage
  /** display_name stays on this machine: it is never part of a model input (D10). */
  person: { display_name: string; age: number | null; sex: 'female' | 'male' | 'other' | 'unknown' }
  /** Ranked (§2.4). */
  top_facts: TopFact[]
  numbers: NumberRef[]
  /** From the nba-registry providers, unranked. */
  candidates: NextBestAction[]
  /** Graded (M4); bioage and risk chips render these. */
  feedback: FeedbackMessage[]
  plan: { exists: boolean; version: number | null; days: number | null; open_checkins: number; adherence_pct: number | null; draft_hold: boolean }
  exclusions: ExclusionItem[]
  safety: { drug_classes: DrugClass[]; conditions: ConditionFlag[] }
  memory_digest_zh: string
  /** Topic keys asked in the last 7 days. */
  asked_recent: string[]
  /** 长寿图鉴: the season week, experiments running, packs waiting, and whether a card can be turned. No values. */
  engagement: { season_week: number | null; season_weeks: number | null; experiments_running: string[]; reveal_ready: boolean; packs_waiting: number } | null
  science: { mode: ScienceMode; active_studies: number }
  generations: { records: number; tracking: number; memory_rev: number; plan: number | null; triage_rev: number; season_rev: number }
  /** M1: the findings after visits, the care answers, and the doctor-first stop still open (null when none). */
  triage: {
    findings: TriageFinding[]
    care: Array<{ finding_id: string; care_status: string; visit_date: string | null; outcome_zh: string | null; updated: string }>
    stop: { title_zh: string; sentence_zh: string; needs_sex: boolean } | null
  }
  /** M5: the stage's own next step (the journey's rule), which the fact-ranked floor ranks among the others. */
  stage_next: { title_zh: string; detail_zh: string; action: string } | null
  /** Labeled library results for this generation. Empty until L4 records them. */
  method_results: MethodResult[]
}
export const FACT_PRIORITY_RANK: Readonly<Record<FactPriority, number>> = { emergency: 0, must_surface: 1, should_surface: 2, context: 3 }
