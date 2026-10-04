// 长寿图鉴 (docs/codex-design.md 1.2). A library read freely, two-week personal experiments whose reveal is
// the only pack opening, retest packs, and footprints. No draws, no rarity, no streaks; the evidence colour
// is a label of how the study was done.

import type { Id, IsoDay, IsoTime } from './common.ts'

/** 铜 cell · 银 animal · 紫 human (incl. RCT post-hoc) · 金 an RCT's pre-specified primary outcome. */
export type Tier = 'cell' | 'animal' | 'human' | 'trial'
/** The only three verdict words: 超出平时波动 · 在平时波动内 · 数据不够. */
export type Outcome = 'outside' | 'inside' | 'insufficient'
export type PackKind = 'experiment' | 'retest'
export type FootprintKind = 'care_brief' | 'retest' | 'addon' | 'first_experiment' | 'season' | 'family'

export interface StudyCard {
  id: Id
  skill: string
  no: string
  chapter: string
  tier: Tier
  tier_reason_zh: string
  title_zh: string
  line_zh: string
  about_zh: string
  species: string[]
  /** Species from the species log this study uses (first read = met). */
  meet: string[]
  source: { first_author: string; et_al: boolean; journal: string; year: number | null; doi?: string; preprint: boolean; coi_zh?: string | null }
  /** Needs a research-only assay; 「和你的关系」 is never shown. */
  research_assay: boolean
  /** The health page computes a result with this very method. */
  feature_zh?: string | null
  art: { motif: string; seed: number }
}

export interface ChapterInfo { id: string; no: number; title_zh: string; motif: string; intro_zh: string; size: number }
export interface SpeciesInfo { id: Id; key: string; no: string; name_zh: string; latin: string; lifespan_zh: string; lifespan_years: number; hook_zh: string; body_zh: string; studies: Id[] }

export interface LibraryPack {
  version: 3
  library: { revision: string | null; skills: number }
  chapters: ChapterInfo[]
  studies: StudyCard[]
  species: SpeciesInfo[]
  /** Skills whose card has not passed review (待上架). */
  pending: string[]
}

export type MetricKey = 'rhr' | 'hrv' | 'sleep' | 'onset' | 'wakings' | 'steps' | 'sbp' | 'weight' | 'waist' | 'glucose' | 'ldl'

export interface MetricSpec {
  key: MetricKey
  label_zh: string
  unit_zh: string
  better: 'lower' | 'higher' | 'none'
  /** personal: the person's own day-to-day spread (two-sample t) plus a minimal meaningful difference; rcv: reference change value on the means; lab: reference change value on two results. */
  method: 'personal' | 'rcv' | 'lab'
  /** Minimal meaningful difference in unit_zh (personal only). Owner-reviewable defaults. */
  mid?: number
  mid_note?: string
  /** biological_variation.json key (rcv, lab). */
  marker?: string
  /** Mirobody device series, in order of preference. */
  names: string[]
  /** LongPi's own self-measurement key. */
  self?: 'sbp' | 'weight' | 'waist'
  decimals: number
}

export interface ExperimentQuestion {
  id: string
  text_zh: string
  /** On yes: run a variant of this experiment, or offer another experiment instead. */
  yes: { variant?: string; swap?: string }
}

export interface ExperimentSpec {
  id: string
  icon: 'walk' | 'alarm' | 'moon' | 'chair' | 'bp' | 'cup' | 'bowl'
  title_zh: string
  do_zh: string
  days: number
  /** Alternatives in order; the first one the person has data for becomes the primary outcome. */
  primary: MetricKey[]
  also: MetricKey[]
  adherence: 'checkin' | 'sleep_longer' | 'wake_fixed' | 'bp_reading' | 'standup'
  checkin_zh: string
  needs: Array<'wristband' | 'bp_cuff' | 'scale' | 'retest_window'>
  randomizable: boolean
  questions: ExperimentQuestion[]
  variants: Record<string, { title_zh: string; do_zh: string; scope?: 'weekdays' }>
  exclude: { drug_classes: string[]; conditions: string[]; findings: string[] }
  relevance: { words: string[]; focus: string[] }
  source_zh: string
  cards: string[]
  /** Long experiments: the outcome is a lab, revealed in the retest pack. */
  retest_markers?: string[]
}

export interface MetricResult {
  key: MetricKey
  label_zh: string
  unit_zh: string
  before: number | null
  after: number | null
  outcome: Outcome
  direction: 'better' | 'worse' | 'flat' | null
  text_zh: string
}

export interface RunResult {
  outcome: Outcome
  primary: MetricResult
  also: MetricResult[]
  done_days: number
  /** 「14 天里做到了 12 天，坚持得不错。」 */
  done_zh: string
  effective_days: number
  window_days: number
  how_zh: string
  /** Decision 12: a good result outside the usual variation is said plainly, never attributed. */
  praise_zh: string | null
  at: IsoTime
}

export interface ExperimentRun {
  id: Id
  experiment_id: string
  variant: string | null
  title_zh: string
  do_zh: string
  checkin_zh: string
  icon: ExperimentSpec['icon']
  primary: MetricKey
  also: MetricKey[]
  /** The public threshold, fixed before the start. */
  threshold_zh: string
  start: IsoDay
  /** Last planned day. */
  end: IsoDay
  /** Up to 7 more days when fewer than 10 days had data. */
  extended_to: IsoDay | null
  baseline: { from: IsoDay; to: IsoDay }
  randomized: boolean
  /** Randomized version: the day's assignment (true = do it today). */
  schedule: Record<IsoDay, boolean> | null
  scope: 'all' | 'weekdays'
  answers: Record<string, boolean>
  /** 做到 days the person ticked (check-in experiments) or LongPi saw (sleep, wake time, readings, stand-ups). */
  done: IsoDay[]
  /** 8-week lab experiment: the result on file when it started. */
  lab_before?: { value: number; unit: string; date: IsoDay } | null
  status: 'running' | 'ready' | 'revealed' | 'retest_wait' | 'stopped'
  result: RunResult | null
  revealed_at: IsoTime | null
}

export interface ResultCard {
  id: Id
  key: string
  title_zh: string
  value_zh: string | null
  compare_zh: string
  outcome: Outcome | null
  tier: Tier
  /** A worse result: plain flip, no celebration. */
  plain: boolean
  note_zh: string | null
}

export interface Pack {
  id: Id
  kind: PackKind
  source_zh: string
  granted: IsoDay
  opened: IsoDay | null
  /** Experiment pack: the three experiments shown when opened. */
  options: string[]
  chosen: string | null
  /** Retest pack: result cards fixed when the pack was granted. */
  results: ResultCard[]
}

export interface Footprint { id: Id; kind: FootprintKind; day: IsoDay; title_zh: string; text_zh: string }
