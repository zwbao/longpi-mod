// Per-person surfaces and next-best actions (AA §2.7, §3.3). Frozen at C0.

import type { Id, IsoDay, IsoTime, ModuleId } from './common.ts'
import type { FactPack, TopFact } from './factpack.ts'
import type { FeedbackMessage } from './feedback.ts'
import type { AgentRunRecord } from './agents.ts'

export type ActionKind = 'emergency' | 'see_doctor' | 'prepare_brief' | 'log_visit_outcome' | 'screening_topic'
  | 'book_addon_test' | 'self_measure' | 'answer_profile' | 'connect_records' | 'upload_report'
  | 'checkin' | 'retest' | 'review_verdict' | 'draft_plan' | 'adjust_plan' | 'read_result' | 'learn'
  | 'codex_experiment' | 'codex_reveal' | 'study_consent' | 'rest'
export interface NextBestAction {
  id: Id
  kind: ActionKind
  /** Who proposed it (nba-registry). */
  provider: ModuleId
  /** 0–100, deterministic. */
  priority: number
  /** Only M1 (triage) may set true. */
  mandatory: boolean
  /** e.g. see_doctor(anaemia) blocks draft_plan for bioage levers. */
  blocks?: ActionKind[]
  reason_codes: string[]
  fact_ids: Id[]
  target: { surface: 'page' | 'chat' | 'pane' | 'settings'; tab?: string; section?: string; prompt_zh?: string; tool?: string }
  due?: IsoDay
  expires?: IsoDay
  /** Deterministic fallback wording. */
  title_zh: string
  detail_zh: string
}
export type SurfaceKind = 'greeting' | 'status' | 'next_step' | 'suggestion' | 'weekly_narrative' | 'nudge' | 'care' | 'season'
export interface SurfaceCard {
  id: Id
  kind: SurfaceKind
  text_zh: string
  detail_zh?: string
  /** NextBestAction.id this card performs. */
  action_id?: Id
  /** Suggestion chips: exactly what goes into the composer. */
  prompt_zh?: string
  /** TopFact ids referenced. */
  fact_ids: Id[]
  /** Every number in text ∈ FactPack.numbers[].key. */
  number_keys: string[]
  tone: 'neutral' | 'encourage' | 'celebrate' | 'care' | 'urgent'
  source: 'model' | 'fallback' | 'rule'
  /** Set by the post-filter; the renderer trusts it. */
  override?: { rule: string; reason: string }
}
export interface SurfaceSet {
  version: 1
  /** = FactPack.fp used. */
  inputs_fp: string
  day: IsoDay
  generated_at: IsoTime
  valid_until: IsoTime
  source: 'model' | 'fallback' | 'mixed'
  stale: boolean
  greeting: SurfaceCard
  status: SurfaceCard
  next: { action: NextBestAction; card: SurfaceCard }
  /** Ranked rest (page 概览). */
  more: NextBestAction[]
  /** 2–4. */
  suggestions: SurfaceCard[]
  weekly?: SurfaceCard
  nudge?: SurfaceCard
  run?: AgentRunRecord
  validation: { passed: string[]; failed: Array<{ rule: string; card_id: Id; detail: string }> }
}
/** What chat and page both read (read_personal_situation.page, /journey.surfaces, pre-step snapshot). */
export interface PageState {
  inputs_fp: string
  status_zh: string
  next: { kind: ActionKind; title_zh: string; detail_zh: string; mandatory: boolean }
  top_facts: Array<Pick<TopFact, 'id' | 'kind' | 'priority' | 'text_zh'>>
  feedback: Array<Pick<FeedbackMessage, 'id' | 'subject' | 'grade' | 'headline_zh' | 'allowed_claims'>>
  suggestions_zh: string[]
}
export type CandidateProvider = (pack: Omit<FactPack, 'candidates' | 'fp'>) => NextBestAction[]
/** Providers registered as these modules may propose a mandatory action. */
export const MANDATORY_PROVIDERS: readonly ModuleId[] = ['M1']
