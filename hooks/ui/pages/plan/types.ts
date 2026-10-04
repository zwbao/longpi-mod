// The route JSON the 方案 and 日程 pages read (client/types.ts, the parts these pages use). Every field the
// server may leave out is optional, so an older or partial answer still draws.

export type CheckState = boolean | null

export interface JourneyPlan {
  exists: boolean
  title: string
  version: number | null
  items: number
  started: string | null
  days: number | null
  checkin_items: Array<{ id: string; title: string; done_today: CheckState }>
  streak: number
  done_total: number
  adherence_pct: number | null
}

export interface Reminder {
  kind: 'retest' | 'checkin'
  text_zh: string
  date: string | null
  due: boolean
}

export interface Journey {
  today: string
  plan: JourneyPlan
  reminders: Reminder[]
  suggestions: Array<{ id: string; text_zh: string }>
  changes?: Array<{ label_zh: string; compare?: { from_date?: string; to_date?: string } }>
  followup?: { enabled: boolean; channels: string[]; next_at: string | null }
}

export interface Adherence {
  source?: string
  rate?: number | null
  coverage?: number
  level?: string
  streak?: number
  note_zh?: string
  done_days?: number
  known_days?: number
  calendar?: Array<{ date: string; status: string }>
}

export interface Verdict {
  item?: string
  marker: string
  indicator?: string | null
  unit?: string
  verdict: string
  reason_zh?: string
  baseline?: { date: string; value: number } | null
  followup?: { date: string; value: number } | null
  change?: { abs: number; pct: number } | null
  combined_with?: string[]
  confounders?: string[]
  next_retest?: string | null
  expected?: Array<{ id: string; text_zh: string; doi: string; verified?: boolean; comparison?: string }>
}

export interface Item {
  id: string
  title: string
  category?: string
  category_zh?: string
  start: string
  end?: string | null
  days?: number
  adherence?: Adherence
  verdicts?: Verdict[]
  headline?: string
}

export interface PlanItemRaw {
  id: string
  title?: string
  detail?: string
  category?: string
  frequency?: string | null
  markers?: string[]
  target?: { metric: string; op?: string; value?: number; unit?: string } | null
  mirobody?: { medication: string } | null
}

export interface Chart {
  key: string
  label: string
  indicator: string
  unit: string
  better?: string
  points: Array<{ date: string; value: number }>
  weekly?: boolean
  band?: { base: number; base_date: string; low: number; high: number; verified?: boolean } | null
  goal?: number | null
  items?: string[]
}

export interface ModelCard {
  model: string
  title_zh?: string
  status?: string
  note_zh?: string
  measured_on?: string | null
  now?: Record<string, number | null>
  goal?: Record<string, number | null> | null
  category_zh?: { now: string; goal: string | null }
  missing?: string[]
  levers?: Array<{ label: string; from: string; to: string; years: number }>
  sensitivity?: Array<{ label: string; unit: string; years_per_step: number; step: string }>
  boundary_zh?: string
}

export interface Suggestion { kind: string; text_zh: string; date?: string; marker?: string }

export interface Tracking {
  status?: string
  today?: string
  plan?: {
    version: number
    saved_at: string
    title: string
    source?: string
    items: PlanItemRaw[]
    goals?: Array<{ marker: string; value: number; unit: string }>
  } | null
  versions?: Array<{ version: number; saved_at: string; title: string; items: number }>
  items?: Item[]
  suggestions?: Suggestion[]
  charts?: Chart[]
  bioage?: { points?: Array<{ date: string }> }
  models?: ModelCard[]
  checkins?: Array<{ date: string; item: string; done: boolean | null; tags?: string[] }>
  errors?: string[]
}

// --- the draft ------------------------------------------------------------------------------------

export interface DraftItem {
  id: string
  category: string
  category_zh: string
  title: string
  detail: string
  start: string
  markers: string[]
  target?: { metric: string; op: '>=' | '<='; value: number; unit: string } | null
  evidence: { effect_id: string; expected_zh: string; doi: string; verified: boolean; population: string }
  needs_doctor: boolean
  cautions_zh: string[]
}

export interface DraftGoal { marker: string; value: number; unit: string; basis_zh: string; basis_item_id?: string }

export interface PlanDraft {
  title: string
  items: DraftItem[]
  goals: DraftGoal[]
  notes_zh: string[]
}

export interface PlanBrief {
  priorities: Array<{ marker_key: string; label_zh: string; value: number | null; unit: string; date: string | null; why_zh: string }>
  safety: { medications: string[]; notes_zh: string[]; stop_zh?: string }
  notes_zh: string[]
  boundary_zh: string
}

export interface PlanDraftResponse {
  brief: PlanBrief
  draft: PlanDraft | null
  removed_items: Array<{ id: string; title: string }>
}

// --- follow-up and the calendar -------------------------------------------------------------------

export interface FollowupResponse {
  settings: {
    enabled: boolean
    checkin_time: string
    retest_time: string
    weekly: { day: number; time: string } | null
    desktop: boolean
    webhook: { kind: string; url_masked: string; secret_set: boolean } | null
    detail: 'minimal' | 'full'
    quiet: { start: string; end: string } | null
  }
  next: { checkin: string | null; retest: string | null; weekly: string | null }
  log: Array<{ at: string; kind: string; ok: boolean }>
  platform_desktop: boolean
  silence_zh?: string
}

export interface ScheduleRow {
  id: string
  date: string
  title_zh: string
  brief_zh: string
  questions_zh: string[]
  confirmed: boolean
  kind: string
}

export interface ScheduleResponse {
  suggestions?: ScheduleRow[]
  events?: ScheduleRow[]
}
