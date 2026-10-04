// The journey and tracking answers as 总览 reads them: the web client's types and its normalizer (client/types.ts,
// client/normalize.ts), cut to what this page draws. Pure: route JSON in, typed values out.

import type { MethodResult } from '../../../core/contracts/library.ts'
import { parseMethodResults } from '../../../core/core/method-view.ts'

export type Stage = 'consent' | 'profile' | 'records' | 'first_result' | 'plan' | 'routine'
export type Focus = 'bioage' | 'cardio' | 'glucose' | 'weight' | 'sleep' | 'plan'
export type SelfKey = 'waist' | 'sbp' | 'dbp' | 'weight'
export type RiskFact = 'smoker' | 'diabetes' | 'bp_treated' | 'north' | 'urban' | 'family_history'
export type Sex = 'female' | 'male' | 'other' | 'unknown'
export type NextAction = 'consent' | 'profile' | 'records' | 'addons' | 'plan' | 'checkin' | 'review' | 'open' | 'doctor'
export type CheckState = boolean | null
export type RecordStatus = 'unconfigured' | 'ok' | 'partial' | 'error'

export interface JourneyQuestion { key: 'age' | 'sex' | RiskFact; label_zh: string; unlocks_zh: string; answered: boolean; men_only?: boolean }
export interface Addon { item_zh: string; unlocks_zh: string; self_measurable: boolean; self_key?: SelfKey }
export interface SelfLatest { key: SelfKey; label_zh: string; value: number; unit: string; date: string; n: number }
export interface SelfKeySpec { key: SelfKey; label_zh: string; unit: string; units: string[] }
export interface Reminder { kind: 'retest' | 'checkin'; text_zh: string; date: string | null; due: boolean }
export interface RecordsSummary { checkups: number; first_date: string | null; last_date: string | null; categories_zh: string[]; wearable_days: number }

export interface RecordChange {
  key: string
  label_zh: string
  unit: string
  points: Array<{ date: string; value: number }>
  compare: { from_date: string; from: number; to_date: string; to: number; pct: number }
  band_pct: { up: number; down: number }
  direction: 'up' | 'down'
  verdict: 'better' | 'worse' | 'unclear'
  ask_doctor: boolean
  text_zh: string
  advice_zh: string
  caveat_zh?: string
  range_flag?: 'low' | 'high'
  source: { title: string; url: string; doi?: string }
  verified: boolean
}

export interface SurfaceMore { id: string; kind: string; title_zh: string; detail_zh: string; surface: string; prompt_zh: string; tab: string; section: string }

export interface Journey {
  version: string
  today: string
  consent: { accepted: boolean; version: string; accepted_at: string | null; current: string }
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
  records: {
    status: RecordStatus
    error: string
    indicator_count: number
    full_checkups: number
    latest_checkup: string | null
    read_errors: string[]
    missing_reads: string[]
    summary: RecordsSummary | null
  }
  results: {
    bioage: { status: 'ok' | 'blocked'; phenoage: number | null; advance: number | null; date: string | null; checkups: number; band_years: number | null; blocker_zh: string; missing: string[]; caveat_zh?: string; headline_zh?: string; allows_younger?: boolean }
    risk: { status: 'ok' | 'blocked'; risk_pct: number | null; category_zh: string; date: string | null; blocker_zh: string; missing_labs: string[]; missing_facts: string[] }
  }
  addons: Addon[]
  self: { latest: SelfLatest[]; keys: SelfKeySpec[] }
  plan: {
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
  reminders: Reminder[]
  stage: Stage
  next: { stage: Stage; title_zh: string; detail_zh: string; action: NextAction }
  suggestions: Array<{ id: string; text_zh: string }>
  followup: { enabled: boolean; channels: Array<'desktop' | 'webhook'>; next_at: string | null }
  changes: RecordChange[]
  changes_note_zh: string
  changes_unjudged: Array<{ label_zh: string; reason_zh: string }>
  surfaceMore: SurfaceMore[]
  triage: {
    findings: Array<{ id: string; title_zh: string; department_zh: string; status: string }>
    care: Array<{ finding_id: string; care_status: string; visit_date: string | null; outcome_zh: string | null }>
    needs_sex: boolean
  }
  method_results: MethodResult[]
  doctor_first: { stop: boolean; hits: Array<{ key: string; short_zh: string }> }
}

// --- tracking (the parts 总览 reads) ---------------------------------------------------------------

export interface Verdict {
  item?: string
  marker: string
  indicator?: string | null
  unit?: string
  verdict: string
  reason_zh?: string
  direction?: string
  baseline?: { date: string; value: number } | null
  followup?: { date: string; value: number } | null
  change?: { abs: number; pct: number } | null
  band?: { up_pct: number; down_pct: number; verified?: boolean } | null
  confounders?: string[]
  next_retest?: string | null
}

export interface TrackingItem {
  id: string
  title: string
  adherence?: { rate?: number | null; level?: string; calendar?: Array<{ date: string; status: string }> }
  verdicts?: Verdict[]
}

export interface ModelCard {
  model: string
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

export interface BioAgePoint { date: string; phenoage: number; advance: number | null }

export interface Tracking {
  plan?: unknown
  items?: TrackingItem[]
  suggestions?: Array<{ kind: string; text_zh: string; date?: string; marker?: string }>
  bioage?: { points?: BioAgePoint[]; band_years?: number | null; band_missing?: string[]; band_verified?: boolean }
  models?: ModelCard[]
}

// --- the normalizer ------------------------------------------------------------------------------

type Raw = Record<string, unknown>

const STAGES: readonly Stage[] = ['consent', 'profile', 'records', 'first_result', 'plan', 'routine']
const ACTIONS: readonly NextAction[] = ['consent', 'profile', 'records', 'addons', 'plan', 'checkin', 'review', 'open', 'doctor']
const SEXES: readonly Sex[] = ['female', 'male', 'other', 'unknown']
const SELF_KEYS: readonly SelfKey[] = ['waist', 'sbp', 'dbp', 'weight']
const FOCUS: readonly Focus[] = ['bioage', 'cardio', 'glucose', 'weight', 'sleep', 'plan']
export const RISK_FACT_KEYS: readonly RiskFact[] = ['smoker', 'diabetes', 'bp_treated', 'north', 'urban', 'family_history']

export function obj(value: unknown): Raw {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Raw : {}
}

export function objects(value: unknown): Raw[] {
  return Array.isArray(value) ? value.filter((row): row is Raw => !!row && typeof row === 'object' && !Array.isArray(row)) : []
}

export function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

export function numOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((row): row is string => typeof row === 'string' && row.length > 0) : []
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback
}

function profileOf(raw: Raw): Journey['profile'] {
  const risk: Partial<Record<RiskFact, boolean>> = {}
  for (const [key, value] of Object.entries(obj(raw.risk))) if (typeof value === 'boolean') risk[key as RiskFact] = value
  const riskUnknown = strings(raw.riskUnknown).filter((key): key is RiskFact => (RISK_FACT_KEYS as readonly string[]).includes(key))
  const age = numOf(raw.age)
  const sex = oneOf(raw.sex, SEXES, 'unknown')
  const questions: JourneyQuestion[] = objects(raw.questions)
    .filter((row) => typeof row.key === 'string')
    .map((row) => ({
      key: row.key as JourneyQuestion['key'],
      label_zh: str(row.label_zh),
      unlocks_zh: str(row.unlocks_zh),
      answered: row.answered === true,
      ...(row.men_only === true ? { men_only: true } : {}),
    }))
  return {
    displayName: str(raw.displayName),
    birthYear: numOf(raw.birthYear),
    age,
    sex,
    risk,
    ...(riskUnknown.length > 0 ? { riskUnknown } : {}),
    focus: strings(raw.focus).filter((key): key is Focus => FOCUS.includes(key as Focus)),
    complete: typeof raw.complete === 'boolean' ? raw.complete : age != null && (sex === 'male' || sex === 'female'),
    questions,
  }
}

function resultsOf(raw: Raw): Journey['results'] {
  const bio = obj(raw.bioage)
  const risk = obj(raw.risk)
  const phenoage = numOf(bio.phenoage)
  const riskPct = numOf(risk.risk_pct)
  return {
    bioage: {
      status: bio.status === 'ok' && phenoage != null ? 'ok' : 'blocked',
      phenoage,
      advance: numOf(bio.advance),
      date: strOrNull(bio.date),
      checkups: numOf(bio.checkups) ?? 0,
      band_years: numOf(bio.band_years),
      blocker_zh: str(bio.blocker_zh),
      missing: strings(bio.missing),
      ...(str(bio.caveat_zh) ? { caveat_zh: str(bio.caveat_zh) } : {}),
      ...(str(bio.headline_zh) ? { headline_zh: str(bio.headline_zh) } : {}),
      ...(bio.allows_younger === true ? { allows_younger: true } : {}),
    },
    risk: {
      status: risk.status === 'ok' && riskPct != null ? 'ok' : 'blocked',
      risk_pct: riskPct,
      category_zh: str(risk.category_zh),
      date: strOrNull(risk.date),
      blocker_zh: str(risk.blocker_zh),
      missing_labs: strings(risk.missing_labs),
      missing_facts: strings(risk.missing_facts),
    },
  }
}

function pointsOf(value: unknown): RecordChange['points'] {
  return objects(value)
    .filter((row) => str(row.date) && numOf(row.value) != null)
    .map((row) => ({ date: str(row.date), value: numOf(row.value) as number }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** A change row is shown only with its comparison and its band; a row not marked good news is one for the doctor. */
function changeOf(row: Raw): RecordChange | null {
  const compare = obj(row.compare)
  const band = obj(row.band_pct)
  const from = numOf(compare.from)
  const to = numOf(compare.to)
  const pct = numOf(compare.pct)
  const up = numOf(band.up)
  const down = numOf(band.down)
  const key = str(row.key)
  const label = str(row.label_zh)
  const text = str(row.text_zh)
  if (!key || !label || !text || from == null || to == null || pct == null || up == null || down == null) return null
  const verdict = oneOf(row.verdict, ['better', 'worse', 'unclear'] as const, 'unclear')
  const source = obj(row.source)
  return {
    key,
    label_zh: label,
    unit: str(row.unit),
    points: pointsOf(row.points),
    compare: { from_date: str(compare.from_date), from, to_date: str(compare.to_date), to, pct },
    band_pct: { up, down },
    direction: oneOf(row.direction, ['up', 'down'] as const, pct < 0 ? 'down' : 'up'),
    verdict,
    ask_doctor: row.ask_doctor === true || verdict === 'worse',
    text_zh: text,
    advice_zh: str(row.advice_zh),
    ...(str(row.caveat_zh) ? { caveat_zh: str(row.caveat_zh) } : {}),
    ...(row.range_flag === 'low' || row.range_flag === 'high' ? { range_flag: row.range_flag } : {}),
    source: { title: str(source.title), url: str(source.url), ...(str(source.doi) ? { doi: str(source.doi) } : {}) },
    verified: row.verified === true,
  }
}

function changesOf(value: unknown): RecordChange[] {
  const rows = objects(value).map(changeOf).filter((row): row is RecordChange => row != null)
  return [...rows.filter((row) => row.ask_doctor), ...rows.filter((row) => !row.ask_doctor)]
}

function summaryOf(value: unknown): RecordsSummary | null {
  const raw = obj(value)
  const checkups = numOf(raw.checkups)
  if (checkups == null) return null
  return { checkups, first_date: strOrNull(raw.first_date), last_date: strOrNull(raw.last_date), categories_zh: strings(raw.categories_zh), wearable_days: numOf(raw.wearable_days) ?? 0 }
}

function moreOf(value: unknown): SurfaceMore[] {
  return objects(obj(value).more).map((row) => {
    const target = obj(row.target)
    return {
      id: str(row.id), kind: str(row.kind), title_zh: str(row.title_zh), detail_zh: str(row.detail_zh),
      surface: str(target.surface), prompt_zh: str(target.prompt_zh), tab: str(target.tab), section: str(target.section),
    }
  }).filter((row) => row.id && row.title_zh)
}

/** Whether the record answered, fully or in part: some reads failing is not "not connected". */
export function recordConnected(status: RecordStatus): boolean {
  return status === 'ok' || status === 'partial'
}

function stageOf(journey: Pick<Journey, 'consent' | 'profile' | 'records' | 'results' | 'plan'>): Stage {
  if (!journey.consent.accepted) return 'consent'
  if (!journey.profile.complete) return 'profile'
  if (!recordConnected(journey.records.status)) return 'records'
  if (journey.results.bioage.status !== 'ok' && journey.results.risk.status !== 'ok') return 'first_result'
  return journey.plan.exists ? 'routine' : 'plan'
}

export function journeyOf(input: unknown): Journey | null {
  const raw = obj(input)
  if (!('stage' in raw) && !('consent' in raw) && !('profile' in raw)) return null
  const consent = obj(raw.consent)
  const records = obj(raw.records)
  const plan = obj(raw.plan)
  const self = obj(raw.self)
  const triage = obj(raw.triage)
  const body = {
    version: str(raw.version),
    today: str(raw.today),
    consent: {
      accepted: consent.accepted === true,
      version: str(consent.version),
      accepted_at: strOrNull(consent.accepted_at),
      current: str(consent.current, str(consent.version)),
    },
    profile: profileOf(obj(raw.profile)),
    focus_options: objects(raw.focus_options)
      .filter((row) => FOCUS.includes(row.key as Focus))
      .map((row) => ({ key: row.key as Focus, label_zh: str(row.label_zh, row.key as string) })),
    records: {
      status: oneOf(records.status, ['unconfigured', 'ok', 'partial', 'error'] as const, 'unconfigured'),
      error: str(records.error),
      indicator_count: numOf(records.indicator_count) ?? 0,
      full_checkups: numOf(records.full_checkups) ?? 0,
      latest_checkup: strOrNull(records.latest_checkup),
      read_errors: strings(records.read_errors),
      missing_reads: strings(records.missing_reads),
      summary: summaryOf(records.summary),
    },
    results: resultsOf(obj(raw.results)),
    addons: objects(raw.addons).filter((row) => str(row.item_zh)).map((row) => {
      const key = SELF_KEYS.includes(row.self_key as SelfKey) ? row.self_key as SelfKey : undefined
      return { item_zh: str(row.item_zh), unlocks_zh: str(row.unlocks_zh), self_measurable: row.self_measurable === true && key != null, ...(key ? { self_key: key } : {}) }
    }),
    self: {
      latest: objects(self.latest)
        .filter((row) => SELF_KEYS.includes(row.key as SelfKey) && numOf(row.value) != null)
        .map((row) => ({ key: row.key as SelfKey, label_zh: str(row.label_zh), value: numOf(row.value) as number, unit: str(row.unit), date: str(row.date), n: numOf(row.n) ?? 1 })),
      keys: objects(self.keys)
        .filter((row) => SELF_KEYS.includes(row.key as SelfKey))
        .map((row) => ({ key: row.key as SelfKey, label_zh: str(row.label_zh), unit: str(row.unit), units: strings(row.units) })),
    },
    plan: {
      exists: plan.exists === true,
      title: str(plan.title),
      version: numOf(plan.version),
      items: numOf(plan.items) ?? 0,
      started: strOrNull(plan.started),
      days: numOf(plan.days),
      checkin_items: objects(plan.checkin_items)
        .filter((row) => typeof row.id === 'string')
        .map((row) => ({ id: row.id as string, title: str(row.title, row.id as string), done_today: row.done_today === true ? true : row.done_today === false ? false : null })),
      streak: numOf(plan.streak) ?? 0,
      done_total: numOf(plan.done_total) ?? 0,
      adherence_pct: numOf(plan.adherence_pct),
    },
    reminders: objects(raw.reminders).filter((row) => str(row.text_zh)).map((row): Reminder => ({
      kind: row.kind === 'retest' ? 'retest' : 'checkin',
      text_zh: str(row.text_zh),
      date: strOrNull(row.date),
      due: row.due === true,
    })),
  }
  const stage = oneOf(raw.stage, STAGES, stageOf(body))
  const next = obj(raw.next)
  const followup = obj(raw.followup)
  const doctorFirst = obj(raw.doctor_first)
  return {
    ...body,
    stage,
    next: {
      stage: oneOf(next.stage, STAGES, stage),
      title_zh: str(next.title_zh),
      detail_zh: str(next.detail_zh),
      action: oneOf(next.action, ACTIONS, 'open'),
    },
    suggestions: objects(raw.suggestions)
      .filter((row) => str(row.text_zh))
      .map((row, index) => ({ id: str(row.id) || `s${index}`, text_zh: str(row.text_zh) })),
    followup: {
      enabled: followup.enabled === true,
      channels: strings(followup.channels).filter((row): row is 'desktop' | 'webhook' => row === 'desktop' || row === 'webhook'),
      next_at: strOrNull(followup.next_at),
    },
    changes: changesOf(raw.changes),
    changes_note_zh: str(raw.changes_note_zh),
    changes_unjudged: objects(raw.changes_unjudged)
      .filter((row) => str(row.label_zh))
      .map((row) => ({ label_zh: str(row.label_zh), reason_zh: str(row.reason_zh) })),
    surfaceMore: moreOf(raw.surfaces),
    triage: {
      findings: objects(triage.findings).map((row) => ({ id: str(row.id), title_zh: str(row.title_zh), department_zh: str(row.department_zh), status: str(row.status) })).filter((row) => row.id),
      care: objects(triage.care).map((row) => ({ finding_id: str(row.finding_id), care_status: str(row.care_status), visit_date: strOrNull(row.visit_date), outcome_zh: strOrNull(row.outcome_zh) })),
      needs_sex: triage.needs_sex === true,
    },
    method_results: parseMethodResults(raw.method_results),
    doctor_first: {
      stop: doctorFirst.stop === true,
      hits: objects(doctorFirst.hits).map((row) => ({ key: str(row.key), short_zh: str(row.short_zh) })).filter((row) => row.key),
    },
  }
}

/** Tracking as the page reads it: arrays where it expects arrays, nothing invented. */
export function trackingOf(input: unknown): Tracking | null {
  const raw = obj(input)
  if (Object.keys(raw).length === 0) return null
  const bio = obj(raw.bioage)
  return {
    plan: raw.plan ?? null,
    items: objects(raw.items).map((row) => ({
      id: str(row.id),
      title: str(row.title),
      adherence: {
        rate: numOf(obj(row.adherence).rate),
        level: str(obj(row.adherence).level),
        calendar: objects(obj(row.adherence).calendar).map((day) => ({ date: str(day.date), status: str(day.status) })),
      },
      verdicts: objects(row.verdicts).map((v) => v as unknown as Verdict).filter((v) => typeof v.marker === 'string'),
    })),
    suggestions: objects(raw.suggestions).map((row) => ({ kind: str(row.kind), text_zh: str(row.text_zh), ...(str(row.date) ? { date: str(row.date) } : {}), ...(str(row.marker) ? { marker: str(row.marker) } : {}) })),
    bioage: {
      points: objects(bio.points).filter((row) => str(row.date) && numOf(row.phenoage) != null).map((row) => ({ date: str(row.date), phenoage: numOf(row.phenoage) as number, advance: numOf(row.advance) })),
      band_years: numOf(bio.band_years),
      band_missing: strings(bio.band_missing),
      band_verified: bio.band_verified === true,
    },
    models: objects(raw.models).map((row) => row as unknown as ModelCard).filter((row) => typeof row.model === 'string'),
  }
}
