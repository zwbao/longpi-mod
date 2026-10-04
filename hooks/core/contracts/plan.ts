// Plan co-design contracts (AA §3.3). Owner M3 may amend once before its first merge.

import type { Id, IsoDay } from './common.ts'

export type DraftCategory = 'diet' | 'exercise' | 'sleep' | 'weight' | 'behavior' | 'supplement'   // = planner.ts DRAFT_CATEGORIES
/** Z's shape, kept as a view: excluded_* also come from ExclusionItems; draft state stays in plan_prefs.json. */
export interface PlanPrefs {
  excluded_ids: string[]
  excluded_phrases: string[]
  /** Items taken out on the page, so 恢复 can put them back after a reload. */
  removed_items: Array<{ id: string; title: string }>
  pregnant: boolean | null
  ckd: boolean | null
  /** Whether they drink alcohol, from their own answer; null = never asked, so no alcohol item. */
  drinks: boolean | null
  drafted_on: IsoDay | ''
  clinical_fp: string
  content_fp: string
  draft: unknown
}
export interface PlanDraftItem {
  id: string
  category: DraftCategory
  title_zh: string
  /** A behavioural target only when evidence, data or a skill gives the number. */
  behaviour_zh: string
  target?: { marker_key: string; label_zh: string }
  evidence: { effect_zh: string; population_zh: string; doi: string | null; design: 'meta' | 'rct' | 'cohort' | 'guideline' | 'mechanistic' }
  needs_doctor: boolean
  /** From plan-safety.ts rules only (e.g. the SGLT2i note, the fish-oil note). */
  cautions_zh: string[]
  start: IsoDay
}
export interface PlanDraftV2 {
  id: Id
  version: 2
  drafted_on: IsoDay
  basis: { fact_fp: string; memory_rev: number; triage: 'clear' | 'doctor_first' }
  /** Doctor-first: the draft is limited or paused, never silently produced. */
  hold?: { reason_zh: string; finding_ids: Id[] }
  items: PlanDraftItem[]
  goals: Array<{ marker_key: string; value: number; unit: string; label_zh: string; kind: 'trial_average_projection' }>
  removed: Array<{ item_id: string; why: 'exclusion' | 'safety' | 'unsuitable' | 'duplicate'; rule_or_memory_id: string }>
  /** The co-designer's own words; validated. */
  rationale_zh?: string
  source: 'rules' | 'co_designer'
}
