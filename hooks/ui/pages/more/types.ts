// The route answers the 档案 and 设置 pages read, as far as they read them (client/types.ts, field for field).

import type { RecordsSummary } from './util.ts'

export type Sex = 'female' | 'male' | 'other' | 'unknown'
export type RiskFact = 'smoker' | 'diabetes' | 'bp_treated' | 'north' | 'urban' | 'family_history'
export type Focus = 'bioage' | 'cardio' | 'glucose' | 'weight' | 'sleep' | 'plan'
export type SelfKey = 'waist' | 'sbp' | 'dbp' | 'weight'

export type JourneyQuestion = { key: 'age' | 'sex' | RiskFact; label_zh: string; unlocks_zh: string; answered: boolean; men_only?: boolean }
export type Addon = { item_zh: string; unlocks_zh: string; self_measurable: boolean; self_key?: SelfKey }
export type SelfLatest = { key: SelfKey; label_zh: string; value: number; unit: string; date: string; n: number }
export type SelfKeySpec = { key: SelfKey; label_zh: string; unit: string; units: string[] }
export type SelfRow = { id: string; key: SelfKey; value: number; unit: string; date: string; saved_at: string; given?: { value: number; unit: string } }

export type Journey = {
  version: string
  today: string
  profile: {
    displayName: string
    birthYear: number | null
    age: number | null
    sex: Sex
    risk: Partial<Record<RiskFact, boolean>>
    riskUnknown?: RiskFact[]
    focus: Focus[]
    complete: boolean
    questions: JourneyQuestion[]
  }
  focus_options: Array<{ key: Focus; label_zh: string }>
  records: { status: string; summary: RecordsSummary | null; latest_checkup: string | null; indicator_count: number }
  addons: Addon[]
  self: { latest: SelfLatest[]; keys: SelfKeySpec[] }
  followup?: { enabled: boolean; channels: string[]; next_at: string | null }
}

export type PersonRow = { id: string; label_zh: string; name: string; sex?: string; birth_year?: number | null; connected: boolean; managed: boolean; link_error_zh?: string; demo?: boolean }
export type People = { ok: boolean; active: string; people: PersonRow[]; can_create_in_mirobody: boolean; create_hint_zh: string; warning_zh?: string }

export type Finding = { id: string; date: string; kind: string; text_zh: string; grade?: string; page_note_zh?: string }
export type Genetics = { sample_id?: string; generated?: string; variants?: Array<{ rsid: string; genotype: string; note_zh: string }>; headlines_zh?: string[]; caveats_zh?: string[]; raw_export_zh?: string }

export type Privacy = {
  ok: boolean
  version: string
  processing_allowed: boolean
  consents: Record<string, { decision: string | null; granted: boolean; at: string | null }>
  copy: {
    pipl?: { title?: string; lead?: string; paragraphs?: string[] }
    data_flow?: { title?: string; to_deepseek?: string[]; stays_local?: string[]; mirobody?: string[]; name?: string; session_log?: string }
    buttons?: { pipl_grant?: string; pipl_decline?: string; flow_grant?: string; flow_decline?: string }
    delete?: { phrase?: string; note?: string }
    minor?: { ask?: string; under_18?: string; under_14?: string }
  }
  minor?: { age?: number | null; minor?: boolean; child?: boolean; ask_age?: boolean; codex_allowed?: boolean }
  export?: { href?: string; mirobody_url?: string; mirobody_note_zh?: string }
  delete?: { phrase?: string; note?: string }
}

export type WebhookKind = 'feishu' | 'wecom' | 'dingtalk' | 'bark' | 'generic'
export type FollowupKind = 'checkin' | 'retest' | 'weekly' | 'nudge' | 'custom' | 'test'
export type FollowupSettings = {
  enabled: boolean
  checkin_time: string
  retest_time: string
  weekly: { day: number; time: string } | null
  desktop: boolean
  webhook: { kind: WebhookKind; url_masked: string; secret_set: boolean } | null
  detail: 'minimal' | 'full'
  quiet: { start: string; end: string } | null
}
export type FollowupLogRow = { at: string; kind: FollowupKind; key: string; ok: boolean; channels: { desktop?: boolean; webhook?: boolean }; error?: string }
export type Followup = {
  settings: FollowupSettings
  next: { checkin: string | null; retest: string | null; weekly: string | null }
  log: FollowupLogRow[]
  platform_desktop: boolean
  silence_zh?: string
}

export type Memory = { ok: boolean; rev: number; digest_zh: string; items: Array<{ id?: string; kind?: string; text_zh?: string }> }
export type Stores = { ok: boolean; stores: Record<string, { on: boolean; rows?: number; error?: string }> }
