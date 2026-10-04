// The shapes the research routes answer (core/science/routes.ts, community.ts, registry-page.ts, nof1.ts).

export type Mode = 'off' | 'local' | 'simulated' | 'live'

export interface StudyQuestion { id: string; question_zh: string; options_zh: string[] }
export interface StudyRow {
  id: string
  title_zh: string
  summary_zh: string
  kind: string
  ethics_zh: string
  consented: 'none' | 'granted' | 'withdrawn' | 'declined'
  questions: StudyQuestion[]
  text_zh: string
}
export interface VoteTopic { id: string; title_zh: string; votes: number }
export interface ScienceCard { id: string; title_zh: string; body_zh: string }
export interface LogRow { seq: number; at: string; kind: string; study_id?: string; detail_zh: string }
export interface Threshold { study_id: string; title_zh: string; line_zh: string; early: boolean; enrolled?: number; threshold?: number }

export interface Community {
  mode: Mode
  configured?: Mode
  live_refused?: boolean
  reason_zh?: string
  studies?: StudyRow[]
  progress?: { label_zh: string; contributed: number; studies: number; min_cohort: number; week: number; weeks: number }
  pulse?: { headline_zh: string; detail_zh: string } | null
  voting?: { topics: VoteTopic[]; mine: string | null; note_zh: string }
  give_back_zh?: string
  cards?: ScienceCard[]
  translog?: LogRow[]
  thresholds?: Threshold[]
  early_zh?: string
  release_stays_zh?: string
}

export interface StudiesList {
  mode: Mode
  reason_zh?: string
  live_refused?: boolean
  studies?: Array<{ id: string; verified?: boolean; consent_text_ok?: boolean; reason?: string }>
}

export interface Invite { show?: boolean; mode?: Mode; intro_zh?: string; waiting_zh?: string; preference?: Mode; user_set?: boolean }

export interface RegistryRow {
  id: string
  version: string
  title_zh: string
  manifest_sha256: string
  key_id: string
  analysis_sha256: string
  sim_status: string
  live_zh: string
  threshold: number
  enrolled: number
  line_zh: string
  ethics_zh: string
}
export interface Registry { analysis_sha256?: string; live_refused?: boolean; reason_zh?: string; rows?: RegistryRow[] }

export type Chain = { ok: true } | { ok: false; seq?: number; reason?: string }
export interface Transparency { chain?: Chain; export_zh?: string; text?: string }
export interface Translog { mode?: Mode; chain?: Chain; entries?: LogRow[] }

export interface ScheduleBlock { arm: 'morning' | 'after_dinner' | 'washout'; label_zh: string; from: string; to: string; role: 'treatment' | 'washout' }
export interface NOf1Plan {
  design: 'abab' | 'crossover'
  title_zh: string
  protocol_zh: string
  schedule: ScheduleBlock[]
  result_zh: string
  stopping?: { decision: string; reason_zh: string }
  quest?: { title_zh?: string }
  carryover_days?: number
}

/** What a local run answered (POST science/run), kept for the study card. */
export interface RunAnswer {
  give_back_zh?: string
  waiting_zh?: string
  sent?: boolean
  local?: Array<{ key: string; detail_zh: string; n: number }>
  result?: { study_id: string; n_local: number; stats: Array<{ stat: string; key: string; value: number[] }>; dp: { epsilon_spent: number } }
}

/** Every route the 研究 page reads; a write reads them all again. */
export const SCIENCE_ROUTES = ['science/community', 'science/studies', 'science/invite', 'science/translog', 'science/transparency', 'science/registry'] as const
