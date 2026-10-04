// Where the person is on the way from first open to a routine, as one object
// the page, the home card, the composer dock and the tools all read: consent,
// the profile questions and what each unlocks, the record, the first results
// (or the exact blocker and the add-on tests that remove it), the plan, due
// reminders, and the next step. It adds no number of its own: results come
// from buildTracking (skill scripts), everything else from what is saved.

import type { RecordChange } from './changes.ts'
import { followupSummary, readFollowup, type FollowupState } from './followup.ts'
import { recordsSummary, type RecordsSummary } from './indicators.ts'
import { addDays, checkinStatus, daysBetween, readCheckIns } from './interventions.ts'
import { measurementInputs } from './measurements.ts'
import type { MountState } from './mirobody.ts'
import type { RecordStatus } from './records.ts'
import { CONSENT_VERSION, FOCUS, FOCUS_ZH, RISK_FACTS, RISK_FACT_ZH, type Focus, type Profile, type RiskFact } from './profile.ts'
import { calculatorIdentity } from './subject.ts'
import { loadReference } from './reference.ts'
import { latestSelf, readSelf, SELF_KEYS, SELF_SPEC, type SelfKey } from './selfmeasure.ts'
import { collectMethodResults, collectOnJourney, publishMethodResults } from './method-collect.ts'
import { buildTracking, PHENOAGE_SKILL, trackingGeneration, type BioAge, type Tracking, type TrackingContext } from './tracking.ts'
import { PRODUCT_VERSION } from './version.ts'
import type { SurfaceSet } from './contracts/surfaces.ts'
import type { TriageFinding } from './contracts/triage.ts'
import type { FactPack } from './contracts/factpack.ts'
import type { MethodResult } from './contracts/library.ts'
import { packFrom } from './core/factpack.ts'
import { fallbackSurfaces } from './surfaces/fallback.ts'
import { recordSurfaces } from './surfaces/service.ts'
import { chooseSurfaces } from './surfaces/coach-service.ts'
import { DAILY_WORDING, QUIET_DETAIL, QUIET_TITLE, quietenSurfaces, readQuiet, stripDailyWording } from './engage/quiet.ts'
import { concreteNext, suggestedQuestions } from './ux/plain.ts'
import { careState } from './triage/care.ts'
import { NO_STOP } from './doctor-first.ts'
import { currentMedications } from './situation.ts'
import { findingsFromIndicators } from './datain/narrative.ts'
import { noteCodexContext, refreshCodex } from './engage/engine.ts'
import { codexContextFrom } from './engage/context.ts'

export type Stage = 'consent' | 'profile' | 'records' | 'first_result' | 'plan' | 'routine'
export type { RecordChange } from './changes.ts'

export interface Journey {
  version: string
  today: string
  consent: { accepted: boolean; version: string; accepted_at: string | null; current: string }
  profile: {
    displayName: string; birthYear: number | null; age: number | null
    sex: 'female' | 'male' | 'other' | 'unknown'
    risk: Partial<Record<RiskFact, boolean>>
    riskUnknown?: RiskFact[]
    focus: Focus[]
    complete: boolean
    questions: Array<{ key: 'age' | 'sex' | RiskFact; label_zh: string; unlocks_zh: string; answered: boolean; men_only?: boolean }>
  }
  focus_options: Array<{ key: Focus; label_zh: string }>
  /**
   * status partial: read, but some reads failed or came back cut; read_errors says which, and missing_reads names
   * indicators not read (unknown, never "not measured"). summary: what the record holds, for onboarding (checkup days
   * and their span, the groups present, wearable days in the last year); null when the record is not connected, or a
   * read failed or timed out (a count would then be too small).
   */
  records: {
    status: RecordStatus; error: string; read_errors: string[]; missing_reads: string[]
    indicator_count: number; full_checkups: number; latest_checkup: string | null; mirobody_mounted: boolean
    summary: RecordsSummary | null
  }
  results: {
    /**
     * band_verified and band_missing are additions for the model: with band_missing the band is a lower bound.
     * caveat_zh is set when a PhenoAge input changed beyond normal fluctuation in a direction to show a doctor.
     */
    bioage: { status: 'ok' | 'blocked'; phenoage: number | null; advance: number | null; date: string | null; checkups: number; band_years: number | null; band_verified: boolean; band_missing: string[]; blocker_zh: string; missing: string[]; caveat_zh?: string; headline_zh?: string; allows_younger?: boolean }
    risk: { status: 'ok' | 'blocked'; risk_pct: number | null; category_zh: string; date: string | null; blocker_zh: string; missing_labs: string[]; missing_facts: string[] }
  }
  addons: Array<{ item_zh: string; unlocks_zh: string; self_measurable: boolean; self_key?: SelfKey }>
  /** Changes between checkups larger than normal fluctuation, ask_doctor first; empty when the record cannot be read. */
  changes: RecordChange[]
  changes_note_zh: string
  /** Markers not judged because their series read failed or came back cut: unknown, never "no change". */
  changes_unjudged: Array<{ label_zh: string; reason_zh: string }>
  self: { latest: Array<{ key: SelfKey; label_zh: string; value: number; unit: string; date: string; n: number }>; keys: Array<{ key: SelfKey; label_zh: string; unit: string; units: string[] }> }
  /** done_total: check-ins marked done across the plan, cumulative (what is shown); streak is kept for older readers. */
  plan: { exists: boolean; title: string; version: number | null; items: number; started: string | null; days: number | null; checkin_items: Array<{ id: string; title: string; done_today: boolean | null }>; streak: number; done_total: number; adherence_pct: number | null }
  reminders: Array<{ kind: 'retest' | 'checkin'; text_zh: string; date: string | null; due: boolean }>
  stage: Stage
  /**
   * A critical value or red-cell pattern (plan-safety.ts): see a doctor before any plan. When stop is true the
   * next step is this, whatever the stage after the profile, and no plan is drafted.
   */
  doctor_first: { stop: boolean; title_zh: string; sentence_zh: string; hits: Array<{ key: string; short_zh: string; text_zh: string }> }
  next: { stage: Stage; title_zh: string; detail_zh: string; action: 'consent' | 'profile' | 'records' | 'addons' | 'plan' | 'checkin' | 'review' | 'open' | 'doctor' }
  suggestions: Array<{ id: string; text_zh: string }>
  boundary_zh: string
  /** Follow-up reminders: on or off, the channels in use, and the next planned send (local ISO). */
  followup: { enabled: boolean; channels: Array<'desktop' | 'webhook'>; next_at: string | null }
  /**
   * 0.5.3: the fact-ranked surfaces (status, next step, suggestions) the page, the home and the chat all read.
   * next and suggestions above are this set in the older shape.
   */
  surfaces: SurfaceSet
  /** 0.5.3 (M1): the findings for a doctor, what the person answered about going, and whether sex is needed. */
  triage: {
    findings: TriageFinding[]
    care: FactPack['triage']['care']
    needs_sex: boolean
    top_facts: FactPack['top_facts']
  }
  /** Labeled library results for this generation. Empty until one is recorded. */
  method_results: MethodResult[]
}

type Next = Journey['next']
type Body = Omit<Journey, 'stage' | 'next' | 'suggestions' | 'followup' | 'surfaces' | 'triage' | 'method_results'>
/** What a journey is built from; now (default the clock) only times the next follow-up. */
export type JourneyContext = TrackingContext & { mount: MountState; now?: Date }
type Addon = Journey['addons'][number]

const BOUNDARY_ZH = '模型估计，不是诊断，也不是用药建议。紧急情况请拨打 120。'
const BOTH = '身体年龄、心血管风险'
const CARDIO = '心血管风险'
const BIOAGE = '身体年龄'
// China-PAR's women's equation does not use these two; they are still asked, of men.
const MEN_ONLY: ReadonlySet<RiskFact> = new Set(['urban', 'family_history'])
const REMIND_AHEAD_DAYS = 7
const DETAIL_MAX = 40
const JOURNEY_TTL_MS = 10 * 60_000

const BIOAGE_BLOCKER: Partial<Record<BioAge['status'], string>> = {
  no_skill: '方法库里没有身体年龄这项计算。',
  no_record: '尚未读取到体检记录。',
  no_age: '档案里还没有周岁。',
  no_checkup: '九项血检还没有在同一天测齐。',
}

const FOCUS_PROMPT: Record<Focus | 'none', { id: string; text_zh: string }> = {
  bioage: { id: 'focus-bioage', text_zh: '我的身体年龄怎么样？哪些指标影响最大？' },
  cardio: { id: 'focus-cardio', text_zh: '我的心血管风险怎么样？哪些因素影响最大？' },
  glucose: { id: 'focus-glucose', text_zh: '我的血糖情况怎么样？' },
  weight: { id: 'focus-weight', text_zh: '帮我记录今天的体重' },
  sleep: { id: 'focus-sleep', text_zh: '我最近的睡眠怎么样？' },
  plan: { id: 'focus-overall', text_zh: '我的检查结果整体怎么样？' },
  none: { id: 'focus-overall', text_zh: '我的检查结果整体怎么样？' },
}

let lastBuilt: { at: number; journey: Journey } | null = null

/** A switch to another person (M13). */
export function forgetLastBuilt(): void {
  lastBuilt = null
}

export async function buildJourney(context: JourneyContext): Promise<Journey> {
  return (await buildJourneyFull(context)).journey
}

/** The journey and the tracking it was built from (retest dates, bands, adherence calendars). */
export async function buildJourneyFull(context: JourneyContext): Promise<{ journey: Journey; tracking: Tracking }> {
  // The summary's reads run beside the skill runs and have their own deadline; a failure leaves it null.
  const collect = collectOnJourney()
    ? collectMethodResults({
      home: context.skillsHome,
      dataDir: context.dataDir,
      pinnedVersion: context.config.skillsVersion,
      profile: {
        age: context.records.profile.age,
        sex: context.records.profile.sex,
        risk: context.records.profile.risk,
      },
      indicators: context.records.indicators,
      python: context.config.skillPython,
      timeoutMs: context.config.skillTimeoutMs,
      runtimes: context.config.skillRuntimes,
    }).then((rows) => ({ ok: true as const, rows })).catch(() => ({ ok: false as const, rows: [] }))
    : Promise.resolve(null)
  const [tracking, summary, ran] = await Promise.all([
    buildTracking(context),
    recordsSummary(context).catch(() => null),
    collect,
  ])
  if (ran?.ok) publishMethodResults(ran.rows)
  const journey = journeyFrom(context, tracking, summary)
  lastBuilt = { at: Date.now(), journey }
  // The Codex's daily series (the holder only); it never holds up the page.
  void refreshCodex({ config: context.config, dataDir: context.dataDir, present: context.records.indicators.map((row) => row.name), now: context.now }).catch(() => undefined)
  return { journey, tracking }
}

/**
 * The value of a promise, or null when it has not settled within ms. The work
 * goes on: buildTracking memoizes the promise, so the next call picks it up.
 */
export async function within<T>(promise: Promise<T>, ms: number): Promise<{ value: T } | { timeout: true }> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<{ timeout: true }>((resolve) => {
    timer = setTimeout(() => resolve({ timeout: true }), ms)
    timer.unref?.()
  })
  try {
    return await Promise.race([promise.then((value) => ({ value })), deadline])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Age is set and sex is answered (female, male or other). China-PAR's own need for male or female shows in its missing_facts. */
export function profileComplete(profile: Pick<Profile, 'age' | 'sex'>): boolean {
  return profile.age != null && profile.sex !== 'unknown'
}

export function consentAccepted(profile: Pick<Profile, 'consent'>): boolean {
  return profile.consent?.version === CONSENT_VERSION
}

function clip(text: string, max = DETAIL_MAX): string {
  const chars = [...text]
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join('')}…`
}

/**
 * Retest dates the plan's verdicts give, the earliest per marker. The only dates LongPi suggests a retest on.
 * date moves with today once the retest is due; first_due is the day it first became due and does not move.
 */
export function retestsOf(tracking: Tracking): Array<{ marker: string; date: string; first_due: string }> {
  const earliest = new Map<string, { date: string; first_due: string }>()
  for (const item of tracking.items) {
    for (const row of item.verdicts) {
      if (!row.indicator || !row.next_retest) continue
      const seen = earliest.get(row.marker)
      const firstDue = row.first_due ?? row.next_retest
      if (!seen || row.next_retest < seen.date || (row.next_retest === seen.date && firstDue < seen.first_due)) {
        earliest.set(row.marker, { date: row.next_retest, first_due: firstDue })
      }
    }
  }
  return [...earliest.entries()].map(([marker, row]) => ({ marker, ...row }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.marker.localeCompare(b.marker))
}

/** Labels of the profile questions not answered yet (unknown is not an answer). */
export function unansweredOf(profile: Profile): string[] {
  return questionsOf(profile).filter((row) => !row.answered).map((row) => row.label_zh)
}

function questionsOf(profile: Profile): Journey['profile']['questions'] {
  return [
    { key: 'age', label_zh: '年龄', unlocks_zh: BOTH, answered: profile.age != null },
    // PhenoAge does not use sex; China-PAR does (male or female). Same predicate as profileComplete.
    { key: 'sex', label_zh: '性别', unlocks_zh: CARDIO, answered: profile.sex !== 'unknown' },
    ...RISK_FACTS.map((fact) => ({
      key: fact, label_zh: RISK_FACT_ZH[fact], unlocks_zh: CARDIO,
      answered: profile.risk[fact] != null || (profile.riskUnknown ?? []).includes(fact),
      ...(MEN_ONLY.has(fact) ? { men_only: true } : {}),
    })),
  ]
}

function bioageResult(bioage: BioAge): Journey['results']['bioage'] {
  const last = bioage.status === 'ok' ? bioage.points.at(-1) : undefined
  const blocker = last ? '' : bioage.status === 'missing_inputs'
    ? `记录里还缺${bioage.missing.join('、')}。`
    : BIOAGE_BLOCKER[bioage.status] ?? bioage.note_zh
  return {
    status: last ? 'ok' : 'blocked',
    phenoage: last?.phenoage ?? null,
    // One draw has no gap to show (INT062 fix 3): the headline says it is one reading, and advance stays empty.
    advance: last && bioage.points.length >= 2 ? last.advance ?? null : null,
    date: last?.date ?? null,
    checkups: bioage.points.length,
    band_years: last ? bioage.band_years : null,
    band_verified: last ? bioage.band_verified : false,
    band_missing: last ? [...bioage.band_missing] : [],
    blocker_zh: blocker,
    missing: [...bioage.missing],
    ...(bioage.headline_zh ? { headline_zh: bioage.headline_zh } : {}),
    allows_younger: bioage.allows_younger === true,
  }
}

/** The caveat on phenotypic age when one of its own inputs changed beyond normal fluctuation in a direction to show a doctor. */
function bioageCaveat(context: TrackingContext, changes: readonly RecordChange[]): string | null {
  const card = context.catalog.cards.find((item) => item.name === PHENOAGE_SKILL)
  if (!card) return null
  // PhenoAge's inputs by their LOINC codes, matched to the biological-variation rows the changes come from.
  const codes = new Set(measurementInputs(card).filter((spec) => spec.required).flatMap((spec) => spec.loinc ?? []))
  const markers = loadReference(context.skillsHome).biovar.markers
  const labels = changes
    .filter((row) => row.ask_doctor && (markers.find((marker) => marker.key === row.key)?.loinc ?? []).some((code) => codes.has(code)))
    .map((row) => row.label_zh)
  return labels.length > 0 ? `身体年龄用到的${labels.join('、')}近期变化明显，原因可能与衰老无关，这次的结果请谨慎看待。` : null
}

function riskResult(tracking: Tracking): Journey['results']['risk'] {
  const card = tracking.models.find((row) => row.model === 'china-par')
  const pct = card?.now.risk_pct
  const ok = typeof pct === 'number'
  return {
    status: ok ? 'ok' : 'blocked',
    risk_pct: ok ? pct : null,
    category_zh: ok ? card?.category_zh?.now ?? '' : '',
    date: ok ? card?.measured_on ?? null : null,
    blocker_zh: ok ? '' : card?.note_zh || '心血管风险模型没有给出结果。',
    missing_labs: [...(card?.missing_labs ?? [])],
    missing_facts: [...(card?.missing_facts ?? [])],
  }
}

function selfKeyForLab(label: string): SelfKey | undefined {
  // China-PAR's own inputs a tape measure or a home cuff can supply.
  return (['waist', 'sbp'] as const).find((key) => label.includes(SELF_SPEC[key].label_zh))
}

function hasLab(indicators: ReadonlyArray<{ name: string; label?: string; loinc?: string; value?: string }>, kind: 'hscrp' | 'waist'): boolean {
  return indicators.some((row) => {
    const text = `${row.name} ${row.label ?? ''} ${row.loinc ?? ''} ${row.value ?? ''}`
    if (kind === 'waist') return /腰围/.test(text)
    if (/总蛋白/.test(text) && !/C反应|CRP/i.test(text)) return false
    return row.loinc === '30522-7' || row.loinc === '1988-5' || /超敏\s*C\s*反应蛋白|hs-?CRP|C反应蛋白/i.test(text)
  })
}

function addonsOf(bioage: BioAge, risk: Journey['results']['risk'], indicators: ReadonlyArray<{ name: string; label?: string; loinc?: string; value?: string }> = []): Addon[] {
  const list: Addon[] = []
  const add = (item: string, unlocks: string, selfKey?: SelfKey) => {
    const hit = list.find((row) => row.item_zh === item)
    if (!hit) {
      list.push({ item_zh: item, unlocks_zh: unlocks, self_measurable: Boolean(selfKey), ...(selfKey ? { self_key: selfKey } : {}) })
      return
    }
    if (!hit.unlocks_zh.split('、').includes(unlocks)) hit.unlocks_zh = `${hit.unlocks_zh}、${unlocks}`
    if (selfKey && !hit.self_key) Object.assign(hit, { self_measurable: true, self_key: selfKey })
  }
  for (const label of bioage.missing) add(label, BIOAGE)
  for (const label of risk.missing_labs) add(label, CARDIO, selfKeyForLab(label))
  if (bioage.status === 'no_checkup') add('九项血检安排在同一天', BIOAGE)
  const hscrp = hasLab(indicators, 'hscrp')
  const waist = hasLab(indicators, 'waist')
  const filtered = list.filter((row) => {
    if (hscrp && /C反应蛋白|hs-?CRP|\bCRP\b/i.test(row.item_zh) && !/总蛋白/.test(row.item_zh)) return false
    if (waist && /腰围/.test(row.item_zh)) return false
    return true
  })
  return [...filtered.filter((row) => row.self_measurable), ...filtered.filter((row) => !row.self_measurable)]
}

function planOf(context: TrackingContext, tracking: Tracking): Journey['plan'] {
  const plan = tracking.plan
  if (!plan) return { exists: false, title: '', version: null, items: 0, started: null, days: null, checkin_items: [], streak: 0, done_total: 0, adherence_pct: null }
  const today = context.today
  // The latest check-in of the day wins: true done, false 没做到, null not checked in (or taken back).
  const status = checkinStatus(readCheckIns(context.dataDir))
  // Wearable items count themselves and medicines are logged in Mirobody; only the rest need a tap.
  const checkinItems = plan.items
    .filter((item) => !item.target && !item.mirobody && item.start <= today && (!item.end || item.end >= today))
    .map((item) => ({ id: item.id, title: item.title, done_today: status.get(item.id)?.get(today) ?? null }))
  const started = plan.items.map((item) => item.start).sort()[0] ?? null
  const rates = tracking.items.map((item) => item.adherence.rate).filter((rate): rate is number => rate != null)
  return {
    exists: true,
    title: plan.title,
    version: plan.version,
    items: plan.items.length,
    started,
    days: started ? Math.max(0, daysBetween(started, today)) : null,
    checkin_items: checkinItems,
    streak: Math.max(0, ...tracking.items.map((item) => item.adherence.streak)),
    done_total: plan.items.reduce((sum, item) => sum + [...(status.get(item.id)?.values() ?? [])].filter(Boolean).length, 0),
    adherence_pct: rates.length > 0 ? Math.round((rates.reduce((sum, rate) => sum + rate, 0) / rates.length) * 100) : null,
  }
}

function remindersOf(today: string, tracking: Tracking, plan: Journey['plan']): Journey['reminders'] {
  const out: Journey['reminders'] = retestsOf(tracking)
    .filter((row) => row.date <= addDays(today, REMIND_AHEAD_DAYS))
    .map((row) => ({ kind: 'retest', text_zh: `复测${row.marker}`, date: row.date, due: row.date <= today }))
  const open = plan.checkin_items.filter((item) => item.done_today == null).length
  if (open > 0) out.push({ kind: 'checkin', text_zh: `今天还有 ${open} 项待打卡`, date: today, due: true })
  return out
}

function stageOf(journey: Pick<Journey, 'consent' | 'profile' | 'records' | 'results' | 'plan'>): Stage {
  if (!journey.consent.accepted) return 'consent'
  if (!journey.profile.complete) return 'profile'
  // A saved plan is lived day by day even while the record is unreachable or no first result can be computed yet.
  if (journey.plan.exists) return 'routine'
  // A record read in part is connected: the rows that failed say so where they are shown.
  // Connected but empty (the local service is paired before any report exists) is still the 上传报告 step.
  if ((journey.records.status !== 'ok' && journey.records.status !== 'partial') || journey.records.indicator_count === 0) return 'records'
  if (journey.results.bioage.status !== 'ok' && journey.results.risk.status !== 'ok') return 'first_result'
  return 'plan'
}

function nextOf(stage: Stage, journey: Body): Next {
  const step = (title: string, detail: string, action: Next['action']): Next => ({ stage, title_zh: title, detail_zh: detail, action })
  // A doctor first is no longer decided here: triage (M1) proposes it as a mandatory action and the
  // fact-ranked floor (surfaces/fallback.ts) puts it ahead of this stage step, at any stage after consent.
  switch (stage) {
    case 'consent':
      return step('完成设置', '了解 LongPi 的功能，并确认数据的使用方式。', 'consent')
    case 'profile':
      return step('填写年龄和性别', '填写后即可计算身体年龄。', 'profile')
    case 'records':
      return journey.records.status === 'error'
        ? step('连接健康数据服务', clip(`记录读取失败：${journey.records.error}`), 'records')
        : step('上传一份体检报告', '上传后即可计算身体年龄和心血管风险。', 'records')
    case 'first_result': {
      const n = journey.addons.length
      if (n > 0) {
        const one = concreteNext(journey.addons)
        return step(one.title_zh, one.detail_zh, 'addons')
      }
      const facts = journey.results.risk.missing_facts.length
      if (facts > 0) return step('补充档案', `回答档案里的 ${facts} 个问题即可计算心血管风险。`, 'profile')
      return step('暂时无法计算结果', clip(journey.results.bioage.blocker_zh || journey.results.risk.blocker_zh), 'open')
    }
    case 'plan':
      return step('制定改善方案', 'LongPi 根据你的检查结果和研究证据起草方案，经你确认后保存。', 'plan')
    case 'routine': {
      const open = journey.plan.checkin_items.filter((item) => item.done_today == null).length
      if (open > 0) return step('今天的打卡', `还有 ${open} 项待完成`, 'checkin')
      const due = journey.reminders.filter((row) => row.kind === 'retest' && row.due).map((row) => row.text_zh.replace(/^复测/, ''))
      if (due.length > 0) return step('已到复测时间', `可以复测${due.slice(0, 3).join('、')}`, 'review')
      return step('继续保持', journey.plan.days ? `方案已进行 ${journey.plan.days} 天` : '方案从今天开始', 'open')
    }
  }
}

function suggestionsOf(stage: Stage, journey: Body, followupOn: boolean): Journey['suggestions'] {
  const picks: Journey['suggestions'] = []
  if (stage === 'consent' || stage === 'profile') {
    picks.push({ id: 'what-longpi-does', text_zh: 'LongPi 能帮我做什么？' }, { id: 'build-profile', text_zh: '帮我建立健康档案' })
  } else if (stage === 'records') {
    picks.push({ id: 'import-reports', text_zh: '体检报告上传到哪里，才能在这里查看？' }, { id: 'before-records', text_zh: '还没有报告，我现在可以先做什么？' })
  } else if (stage === 'first_result') {
    picks.push(...suggestedQuestions({ changes: journey.addons.slice(0, 2).map((row) => row.item_zh) }).map((text, index) => ({ id: `ask-${index}`, text_zh: text })))
    picks.push({ id: 'draft-plan', text_zh: '帮我制定一份改善方案' })
    if (journey.addons.some((row) => row.self_measurable)) picks.push({ id: 'log-self', text_zh: '帮我记录腰围和家庭血压' })
  } else if (stage === 'plan') {
    picks.push(FOCUS_PROMPT[journey.profile.focus[0] ?? 'none'], { id: 'draft-plan', text_zh: '帮我制定一份改善方案' }, { id: 'save-plan', text_zh: '帮我保存我的干预方案' })
  } else {
    picks.push({ id: 'checkin-all', text_zh: '今天的方案我都完成了' })
    if (journey.reminders.some((row) => row.kind === 'retest' && row.due)) picks.push({ id: 'retest-due', text_zh: '哪些项目需要复测？' })
    if (!followupOn) picks.push({ id: 'followup-on', text_zh: '每天晚上提醒我打卡' })
    picks.push({ id: 'plan-effect', text_zh: '我的方案有没有效果？' })
  }
  // A doctor first (M1) puts its own prompts ahead of these (surfaces/fallback.ts); other changes for a
  // doctor still come first here.
  if (stage !== 'consent' && stage !== 'profile' && !journey.doctor_first.stop && journey.changes.some((row) => row.ask_doctor)) {
    picks.unshift({ id: 'record-changes', text_zh: '我的记录里哪些变化需要注意？' })
  }
  const seen = new Set<string>()
  return picks.filter((row) => !seen.has(row.text_zh) && seen.add(row.text_zh)).slice(0, 3)
}

/** The stage's one-line status (the home hero's wording), for the chat snapshot when no fact must surface. */
function stageStatus(stage: Stage, journey: Body, next: Next): string {
  if (stage === 'consent' || stage === 'profile') return '用 2 分钟建立档案，计算你的身体年龄和心血管风险'
  if (stage === 'records') return journey.records.status === 'error' ? '体检记录读取失败，暂时无法计算结果' : '上传一份体检报告后，即可计算你的身体年龄'
  if (stage === 'first_result' && journey.addons.length > 0) return concreteNext(journey.addons).title_zh
  const { bioage, risk } = journey.results
  const parts: string[] = []
  if (bioage.status === 'ok' && bioage.headline_zh && /你确实年轻了|计算结果小了/.test(bioage.headline_zh)) parts.push(bioage.headline_zh)
  else if (bioage.status === 'ok' && bioage.phenoage != null) parts.push(`身体年龄 ${Number(bioage.phenoage.toFixed(1))} 岁（模型估计）`)
  if (risk.status === 'ok' && risk.risk_pct != null) parts.push(`心血管 10 年风险 ${Number(risk.risk_pct.toFixed(1))}%`)
  return parts.length > 0 ? parts.join('，') : next.detail_zh
}

/** The surfaces' next step in the journey's older shape (the client's closed action list), in the card's words. */
function legacyNext(stage: Stage, set: SurfaceSet, fallback: Next): Next {
  const action = set.next.action
  const title = set.next.card.text_zh || action.title_zh
  const detail = set.next.card.detail_zh ?? action.detail_zh
  if (action.kind === 'see_doctor' || action.kind === 'log_visit_outcome' || action.kind === 'prepare_brief') return { stage, title_zh: title, detail_zh: detail, action: 'doctor' }
  if (action.id.startsWith('stage-')) return { ...fallback, title_zh: title, detail_zh: detail }
  if (action.kind === 'answer_profile') return { stage, title_zh: title, detail_zh: detail, action: 'profile' }
  return fallback
}

function journeyFrom(context: JourneyContext, tracking: Tracking, summary: RecordsSummary | null = null): Journey {
  const { records, today } = context
  const profile = records.profile
  try { findingsFromIndicators(context.dataDir, records.indicators) } catch { /* the page still lists what was already stored */ }
  const points = tracking.bioage.points
  const latest = latestSelf(readSelf(context.dataDir))
  const bioage = bioageResult(tracking.bioage)
  const caveat = bioage.status === 'ok' && !/不一定是好事/.test(bioage.headline_zh ?? '') ? bioageCaveat(context, tracking.changes) : null
  if (caveat) bioage.caveat_zh = caveat
  const risk = riskResult(tracking)
  const plan = planOf(context, tracking)
  // The record's stop with the person's doctor visits applied (M1): a finding a doctor saw no longer stops.
  const recordStop = tracking.doctor_first ?? NO_STOP
  const care = careState(context.dataDir, recordStop, today)
  const body: Body = {
    version: PRODUCT_VERSION,
    today,
    consent: {
      accepted: consentAccepted(profile),
      version: profile.consent?.version ?? '',
      accepted_at: profile.consent?.accepted_at ?? null,
      current: CONSENT_VERSION,
    },
    profile: {
      displayName: profile.displayName,
      birthYear: profile.birthYear,
      age: profile.age,
      sex: profile.sex,
      risk: { ...profile.risk },
      ...((profile.riskUnknown ?? []).length > 0 ? { riskUnknown: [...(profile.riskUnknown ?? [])] } : {}),
      focus: [...profile.focus],
      complete: profileComplete(profile),
      questions: questionsOf(profile),
    },
    focus_options: FOCUS.map((key) => ({ key, label_zh: FOCUS_ZH[key] })),
    records: {
      status: records.record_status,
      error: records.record_error,
      read_errors: [...records.read_errors],
      missing_reads: [...records.missing_reads],
      indicator_count: records.indicators.filter((row) => row.source !== 'self').length,
      full_checkups: points.length,
      latest_checkup: points.at(-1)?.date ?? null,
      mirobody_mounted: context.mount.mounted,
      summary,
    },
    results: { bioage, risk },
    addons: addonsOf(tracking.bioage, risk, records.indicators),
    changes: tracking.changes,
    changes_note_zh: tracking.changes_note_zh,
    changes_unjudged: tracking.changes_unjudged,
    doctor_first: {
      stop: care.stop.stop === true,
      title_zh: care.stop.title_zh ?? '',
      sentence_zh: care.stop.sentence_zh ?? '',
      hits: (care.stop.hits ?? []).map((hit) => ({ key: hit.key, short_zh: hit.short_zh, text_zh: hit.text_zh })),
    },
    self: {
      latest: SELF_KEYS.flatMap((key) => {
        const row = latest[key]
        return row ? [{ key, label_zh: SELF_SPEC[key].label_zh, ...row }] : []
      }),
      keys: SELF_KEYS.map((key) => ({ key, label_zh: SELF_SPEC[key].label_zh, unit: SELF_SPEC[key].unit, units: Object.keys(SELF_SPEC[key].units) })),
    },
    plan,
    reminders: remindersOf(today, tracking, plan),
    boundary_zh: BOUNDARY_ZH,
  }
  const stage = stageOf(body)
  const followupOn = readFollowup(context.dataDir).enabled
  const stageNext = nextOf(stage, body)
  const stageSuggestions = suggestionsOf(stage, body, followupOn)
  // One fact pack and one fact-ranked set of surfaces; next and suggestions below are that set.
  const pack = packFrom({
    dataDir: context.dataDir, today, stage,
    person: { display_name: profile.displayName, age: calculatorIdentity(profile).age, sex: calculatorIdentity(profile).sex },
    care, hits: recordStop.hits, needsSex: recordStop.needs_sex === true,
    medications: currentMedications(records.medications), changes: tracking.changes,
    results: { bioage: { phenoage: bioage.phenoage, advance: bioage.advance, date: bioage.date, status: bioage.status, ...(bioage.headline_zh ? { headline_zh: bioage.headline_zh } : {}) }, risk: { risk_pct: risk.risk_pct, date: risk.date } },
    plan: { exists: plan.exists, version: plan.version, days: plan.days, open_checkins: plan.checkin_items.filter((item) => item.done_today == null).length, adherence_pct: plan.adherence_pct },
    self: body.self.latest.map((row) => ({ key: row.key, label_zh: row.label_zh, value: row.value, unit: row.unit, date: row.date })),
    stageNext: { title_zh: stageNext.title_zh, detail_zh: stageNext.detail_zh, action: stageNext.action },
    emptyRecord: body.records.indicator_count === 0,
    tracking, trackingGeneration: trackingGeneration(),
  })
  const floor = fallbackSurfaces(pack, { suggestions: stageSuggestions, status_zh: stageStatus(stage, body, stageNext) }, context.now ?? new Date())
  // The coach's set when one is valid for this pack; otherwise the floor, and the coach is asked (step 2).
  const signals = readQuiet(context.dataDir)
  const surfaces = quietenSurfaces(chooseSurfaces(context.dataDir, floor, pack), stageNext, signals)
  recordSurfaces(context.dataDir, surfaces, pack)
  let next = legacyNext(stage, surfaces, stageNext)
  if (stripDailyWording(signals) && DAILY_WORDING.test(`${next.title_zh}${next.detail_zh}`)) {
    next = { ...next, title_zh: QUIET_TITLE, detail_zh: QUIET_DETAIL }
  }
  const reminders = stripDailyWording(signals) ? body.reminders.filter((row) => !DAILY_WORDING.test(row.text_zh)) : body.reminders
  const journey: Journey = {
    ...body, stage, reminders,
    next,
    suggestions: surfaces.suggestions.slice(0, 3).map((row) => ({ id: row.id, text_zh: row.prompt_zh ?? row.text_zh })),
    followup: { enabled: followupOn, channels: [], next_at: null },
    surfaces,
    triage: { findings: care.findings, care: pack.triage.care, needs_sex: pack.triage.stop?.needs_sex === true, top_facts: pack.top_facts },
    method_results: pack.method_results.map((row) => {
      const card = context.catalog.cards.find((item) => item.name === row.skill)
      const paper = card?.paper?.title_zh?.trim() ?? ''
      const blurb = (card?.blurb ?? '').replace(/。$/, '').trim()
      const title = /[\u4e00-\u9fff]/.test(paper) && !/[A-Za-z]{4,}/.test(paper) ? paper : blurb
      return title ? { ...row, title_zh: title } : row
    }),
  }
  journey.followup = followupSummary(context.dataDir, followupStateOf(journey, tracking), context.now ?? new Date())
  try {
    noteCodexContext(context.dataDir, codexContextFrom({
      dataDir: context.dataDir,
      profile,
      age: calculatorIdentity(profile).age,
      records,
      tracking,
      pack,
      findings: care.findings,
      next: { title_zh: next.title_zh, detail_zh: next.detail_zh },
      planText: plan.exists ? JSON.stringify(plan).slice(0, 1500) : '',
      retests: retestsOf(tracking),
      risk: { status: risk.status, risk_pct: risk.risk_pct, date: risk.date, category_zh: risk.category_zh },
    }), context.now ?? new Date())
  } catch { /* the Codex keeps the last good copy */ }
  return journey
}

/** What the follow-up scheduler decides from: the stage, open check-ins, retest dates, this ISO week's adherence. */
export function followupStateOf(journey: Journey, tracking: Tracking): FollowupState {
  const weekday = (new Date(`${journey.today}T00:00:00Z`).getUTCDay() + 6) % 7
  const monday = addDays(journey.today, -weekday)
  let done = 0
  let known = 0
  for (const item of tracking.items) {
    for (const day of item.adherence.calendar) {
      if (day.date < monday || day.date > journey.today || day.status === 'unknown') continue
      known += 1
      if (day.status === 'done') done += 1
    }
  }
  const retests = retestsOf(tracking)
  const upcoming = retests.find((row) => row.date >= journey.today)
  return {
    stage: journey.stage,
    consent_at: journey.consent.accepted ? journey.consent.accepted_at : null,
    next_title_zh: journey.next.title_zh,
    next_detail_zh: journey.next.detail_zh,
    plan_exists: journey.plan.exists,
    checkin_items: journey.plan.checkin_items.length,
    checkin_open: journey.plan.checkin_items.filter((item) => item.done_today == null).map((item) => item.title),
    retests,
    week: { pct: known > 0 ? Math.round((done / known) * 100) : null, streak: journey.plan.streak, done_total: journey.plan.done_total, next_retest: upcoming ? { marker: upcoming.marker, date: upcoming.date } : null },
  }
}

/**
 * Stage and next step without running anything, for the synchronous /longpi
 * command: exact up to the records step, after that the journey last built in
 * this process (by the page or a tool), or null when there is none yet.
 */
export function stageNow(profile: Profile, mcpConfigured: boolean): { stage: Stage | null; title_zh: string } {
  if (!consentAccepted(profile)) return { stage: 'consent', title_zh: '开始使用 LongPi' }
  if (!profileComplete(profile)) return { stage: 'profile', title_zh: '建立档案' }
  if (!mcpConfigured) return { stage: 'records', title_zh: '连接健康数据服务' }
  const last = lastBuilt && Date.now() - lastBuilt.at < JOURNEY_TTL_MS ? lastBuilt.journey : null
  if (!last || last.stage === 'consent' || last.stage === 'profile') return { stage: null, title_zh: '打开健康页查看' }
  return { stage: last.stage, title_zh: last.next.title_zh }
}
