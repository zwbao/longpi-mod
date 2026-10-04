// Put the plan next to the record: read the markers the plan aims at, how the
// plan was followed, what else changed, and the phenotypic age at every past
// checkup; then judge each item and model the goals. Every number comes from
// Mirobody, the person's check-ins, or a skill script. The harness computes
// no clinical formula here: phenotypic age and its levers come from the
// accelerated-biological-aging-risk skill, noise bands from data tables.

import { createHash } from '../sys/crypto.ts'
import type { Catalog, SkillCard } from './catalog.ts'
import { buildChanges, CHANGES_NOTE_ZH, type RecordChange, type UnjudgedChange } from './changes.ts'
import { buildDoctorFirst, NO_STOP } from './doctor-first.ts'
import type { StopResult } from './plan-safety.ts'
import type { Config } from './config.ts'
import { adherenceFor, evaluatePlan, resolveMarkers, suggestNext, wearableTargetFor, type Adherence, type ItemSummary, type LeverHint, type ResolvedMarker, type Suggestion } from './evaluate.ts'
import { bodyAgeWording, codedRecords, missedPlanChanges, PHENOAGE_WINDOW_DAYS, siblingNames } from './honesty/comparability.ts'
import { bodyAgeStory, panelFromMeasurements, type PhenoPanel } from './ux/body-age.ts'
import { dateZh } from './ux/plain.ts'
import { roundPercentPoints } from './honesty/format.ts'
import { modelRangeNote } from './honesty/model-range.ts'
import { readHistory, type HistoryRow } from './history.ts'
import { addDays, CATEGORY_ZH, currentPlan, daysBetween, readCheckIns, readPlans, type CheckIn, type PlanItem, type PlanVersion } from './interventions.ts'
import { calculatorIdentity, notOnePersonReason } from './subject.ts'
import { RISK_FACT_ZH, type RiskFact } from './profile.ts'
import type { InputSpec } from './catalog.ts'
import { aliasIndex, candidatesFor, indicatorFor, measurementInputs, notRead, resolveInput, stageMeasurements, type MeasurementIn } from './measurements.ts'
import { loadCourses, loadDoseLog, loadSeries, readFlags, recordReadable, sameMeasure, type CourseRow, type RecordSnapshot, type SeriesPoint } from './records.ts'
import { expandMarkerNames, loadReference, markerFor, rcvBand, type Reference } from './reference.ts'
import { runSkill, type Levers } from './runner.ts'
import { readSelf, selfKeyOf, selfSeries, SELF_DEVICE_NAMES, SELF_SPEC } from './selfmeasure.ts'
import { currentMedications, GLUCOSE_LOWERING } from './situation.ts'
import { normalizeUnit } from './units.ts'

export const PHENOAGE_SKILL = 'accelerated-biological-aging-risk'
export const RISK_SKILL = 'china-par-ascvd-risk'
const BIOAGE_CHECKUPS = 6
const LOOKBACK_DAYS = 3 * 365
const CACHE_TTL_MS = 60_000
/** A compute still running after this long (every skill run has its own timeout, at most 3 minutes) is started again. */
const PENDING_MAX_MS = 10 * 60_000

export interface TrackingContext {
  config: Config
  dataDir: string
  skillsHome: string
  catalog: Catalog
  records: RecordSnapshot
  today: string
}

export interface BioAgePoint {
  date: string
  phenoage: number
  advance: number | null
  mortality_10y_pct: number | null
}

export interface BioAge {
  status: 'ok' | 'no_skill' | 'no_record' | 'missing_inputs' | 'no_age' | 'no_checkup' | 'not_one_person' | 'error'
  note_zh: string
  missing: string[]
  points: BioAgePoint[]
  /** Change in years that within-person variation alone could explain (two-sided, z from the table). */
  band_years: number | null
  band_verified: boolean
  /** Inputs with no published within-person variation, left out of the band (so the band is a lower bound). */
  band_missing: string[]
  runs: number
  /** The sentence the page chip and the chat both use. Empty until a panel is computed. */
  headline_zh: string
  /** True only when the move is past the noise band toward a lower phenotypic age, with the gates met. */
  allows_younger?: boolean
  /** Days from the earliest to the latest input of the latest panel. 0 is one draw day. */
  panel_span_days: number | null
  /** The first and latest complete panels, in the method's units, when both exist. */
  pheno_compare?: { before: PhenoPanel; after: PhenoPanel } | null
}

export interface ModelCard {
  model: 'phenoage' | 'china-par'
  title_zh: string
  status: 'ok' | 'no_goal' | 'unavailable'
  note_zh: string
  measured_on: string | null
  now: Record<string, number | null>
  goal: Record<string, number | null> | null
  /** The skill's own risk category (低危, 中危, 高危), now and at the goals. */
  category_zh?: { now: string; goal: string | null }
  /** Everything the model still needs, by its Chinese name: missing_labs then missing_facts. */
  missing?: string[]
  /** Measurements the record (or the person's own measurements) does not hold yet. */
  missing_labs?: string[]
  /** Stated facts the profile does not hold yet (age, sex, the yes/no facts); unknown is never no. */
  missing_facts?: string[]
  levers: LeverHint[]
  /** Goals the model could not use (a unit it does not accept, a value out of range), with why. Then no goal value is shown. */
  goal_problems_zh?: string[]
  /** The date each input was measured on, as used: a checkup, the home blood-pressure week, a self measurement. */
  input_dates?: Array<{ key: string; label_zh: string; date: string | null; source: 'checkup' | 'device' | 'self' | 'home' }>
  /**
   * How far one within-person step of each input moves the model, largest first: years of phenotypic age,
   * or for china-par percentage points of 10-year risk. key is the biological-variation key (or waist).
   */
  sensitivity: Array<{ label: string; unit: string; years_per_step: number; step: string; key?: string }>
  boundary_zh: string
}

export interface MarkerChart {
  key: string
  label: string
  indicator: string
  unit: string
  better: string
  points: Array<{ date: string; value: number }>
  /** Points are weekly means dated by the week's Monday (home blood pressure): say 「X 月 X 日起一周」. */
  weekly?: boolean
  band: { base: number; base_date: string; low: number; high: number; verified: boolean } | null
  goal: number | null
  items: string[]
}

export interface Tracking {
  status: 'no_plan' | 'ok'
  today: string
  plan: PlanVersion | null
  versions: Array<{ version: number; saved_at: string; title: string; items: number }>
  items: ItemSummary[]
  suggestions: Suggestion[]
  charts: MarkerChart[]
  bioage: BioAge
  models: ModelCard[]
  checkins: CheckIn[]
  reference: { biovar_markers: number; biovar_verified: number; effects: number; effects_verified: number; error?: string }
  errors: string[]
  /** Changes between checkups larger than normal fluctuation (changes.ts), ask_doctor first. */
  changes: RecordChange[]
  changes_note_zh: string
  /** Markers not judged because their readings did not come back whole: unknown, never "no change". */
  changes_unjudged: UnjudgedChange[]
  /** A critical value or red-cell pattern: see a doctor before any plan (plan-safety.ts). */
  doctor_first: StopResult
}

/** settled: when the compute finished (null while it runs). The TTL runs from then, so a slow compute is never started twice. */
const memo = new Map<string, { started: number; settled: number | null; value: Promise<Tracking> }>()
let generation = 0

export function invalidateTracking(): void {
  memo.clear()
  generation += 1
}

/** Bumped by every invalidateTracking (a check-in, a self measurement, a plan or profile save): readers keeping their own copy refresh on a change. */
export function trackingGeneration(): number {
  return generation
}

function referenceStats(reference: Reference): Tracking['reference'] {
  return {
    biovar_markers: reference.biovar.markers.length,
    biovar_verified: reference.biovar.markers.filter((row) => row.verified).length,
    effects: reference.effects.length,
    effects_verified: reference.effects.filter((row) => row.verified).length,
    ...(reference.error ? { error: reference.error } : {}),
  }
}

export async function buildTracking(context: TrackingContext): Promise<Tracking> {
  const plan = currentPlan(context.dataDir)
  const checkins = readCheckIns(context.dataDir)
  const { profile, record_status: status, indicators } = context.records
  // The record, the profile and self measurements change results too; a stale memo must not answer for them.
  const key = [
    context.dataDir, context.skillsHome, context.today, plan?.version ?? 0, checkins.length, context.catalog.revision, status,
    JSON.stringify([calculatorIdentity(profile).age, calculatorIdentity(profile).sex, profile.risk, profile.subject ?? null]),
    createHash('sha1').update(indicators.map((row) => `${row.name}=${row.value}@${row.date ?? ''}`).join('\n')).digest('hex'),
  ].join('\u0000')
  const now = Date.now()
  const fresh = (entry: { started: number; settled: number | null }) => entry.settled == null ? now - entry.started < PENDING_MAX_MS : now - entry.settled < CACHE_TTL_MS
  const hit = memo.get(key)
  if (hit && fresh(hit)) return hit.value
  for (const [name, entry] of memo) if (!fresh(entry)) memo.delete(name)
  const value = compute(context, plan, checkins)
  const entry = { started: now, settled: null as number | null, value }
  memo.set(key, entry)
  value.then(() => {
    entry.settled = Date.now()
  }, () => {
    // A failed compute is not kept; a newer entry under the same key is not this one's to remove.
    if (memo.get(key) === entry) memo.delete(key)
  })
  return value
}

async function compute(context: TrackingContext, plan: PlanVersion | null, checkins: CheckIn[]): Promise<Tracking> {
  const reference = loadReference(context.skillsHome)
  const errors: string[] = []
  const versions = readPlans(context.dataDir).map((row) => ({ version: row.version, saved_at: row.saved_at, title: row.title, items: row.items.length }))
  // Read alongside the skill runs; a failed read is named rather than taking the rest down, never shown as no change.
  // Uncoded printed names join the LOINC row of the same marker before the changes card is built.
  const changesRead = buildChanges({ ...context, records: codedRecords(context.records, reference.biovar) }).catch((error: unknown) => ({
    changes: [] as RecordChange[], note_zh: CHANGES_NOTE_ZH,
    unjudged: [{ label_zh: '记录里的变化', reason_zh: `读取失败：${error instanceof Error ? error.message.slice(0, 200) : '原因未知'}，这次没有判断。` }],
  }))
  // Critical values and the red-cell pattern: read alongside, never failing the rest.
  const doctorRead = buildDoctorFirst(context).catch(() => NO_STOP)
  const bioage = await ensureBioAge(context, reference)
  const goals = plan?.goals ?? []
  const models = await modelCards(context, reference, goals)
  const levers = models.find((card) => card.model === 'phenoage')?.levers ?? []
  const readChanges = await changesRead
  // 反向 is the plan-verdict word for a worsening past the band. The changes card uses the same word in the sentence.
  let changes = readChanges.changes.map((row) => row.verdict === 'worse' && !row.text_zh.includes('反向')
    ? { ...row, text_zh: `${row.text_zh}（反向）` }
    : row)
  const changesNote = readChanges.note_zh
  let unjudged = readChanges.unjudged
  const doctorFirst = await doctorRead
  const glucoseTreatedEarly = context.records.profile.risk.diabetes === true
    || currentMedications(context.records.medications).some((name) => GLUCOSE_LOWERING.test(name))
  const bioageTold = narrateBioAge(bioage, changes, doctorFirst, glucoseTreatedEarly)
  if (!plan) {
    if (unjudged.length > 0) errors.push(`没有判断变化：${unjudged.map((row) => row.label_zh).join('、')}（读取失败或不完整）`)
    return {
      status: 'no_plan', today: context.today, plan: null, versions, items: [], suggestions: [], charts: [], bioage: bioageTold, models,
      checkins: [], reference: referenceStats(reference), errors, changes, changes_note_zh: changesNote, changes_unjudged: unjudged, doctor_first: doctorFirst,
    }
  }

  if (context.records.record_status === 'error') errors.push(readFailed(context.records))
  // An item aimed at a word for several markers (血压) is judged on each of them; the plan keeps the person's words.
  const judged: PlanVersion = { ...plan, items: plan.items.map((item) => ({ ...item, markers: expandMarkerNames(reference.biovar, item.markers) })) }
  const names = [...new Set([...judged.items.flatMap((item) => item.markers), ...goals.map((goal) => goal.marker)])]
  const resolvedList = resolveMarkers(names, context.records.indicators, reference.biovar)
  for (const marker of resolvedList) {
    const extra = siblingNames(context.records.indicators, reference.biovar, marker.biovar, marker.indicator)
    if (extra.length > 0) marker.also = [...new Set([...(marker.also ?? []), ...extra])]
    if (!marker.indicator && extra[0]) marker.indicator = extra[0]
  }
  const markers: Record<string, ResolvedMarker> = Object.fromEntries(resolvedList.map((row) => [row.asked, row]))
  const earliest = plan.items.map((item) => item.start).sort()[0] ?? context.today
  const resolvedNames = [...new Set(resolvedList.flatMap((row) => [row.indicator, ...(row.also ?? [])]).filter((name): name is string => Boolean(name)))]
  // A marker resolved to the person's own measurement still has its record history (a wearable cuff, a
  // checkup waist): keep that row's name so it is read from Mirobody, and add the self points to it below.
  const displaced = recordCounterparts(resolvedList, context.records.indicators, reference)
  // Self names are read from dataDir, never asked of Mirobody.
  const indicatorNames = [...new Set([...resolvedNames.filter((name) => !selfKeyOf(name)), ...displaced.values()])]
  const seriesStart = addDays(earliest, -200)
  const labs = recordReadable(context.records) && indicatorNames.length > 0
    ? await loadSeries(context.config, indicatorNames, { start: seriesStart, end: context.today, resolution: 'raw' })
    : { series: {}, truncated: false, failed: [] as string[], cut: [] as string[] }
  if ('error' in labs && labs.error) errors.push(`读取检查结果：${labs.error}`)
  const series: Record<string, SeriesPoint[]> = Object.fromEntries(Object.entries(labs.series).map(([name, row]) => [name, row.points]))
  const selfRows = readSelf(context.dataDir)
  for (const name of resolvedNames) {
    const selfKey = selfKeyOf(name)
    if (!selfKey) continue
    const own = selfSeries(selfRows, selfKey).filter((point) => point.date >= seriesStart && point.date <= context.today)
    const counterpart = displaced.get(name)
    const unit = normalizeUnit(SELF_SPEC[selfKey].unit)
    // Only record points in the self unit join; a series in another unit is left out, never converted here.
    const record = counterpart ? (series[counterpart] ?? []).filter((point) => !normalizeUnit(point.unit) || normalizeUnit(point.unit) === unit) : []
    // Sorted by date, then time: on the same date the self daily mean (dated without a time) comes first.
    series[name] = [...record, ...own].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  }
  // The changes read can miss a plan marker (an unlisted LOINC, or 「不是指标表」). The series just loaded for the verdict is enough to judge it.
  const glucoseTreated = context.records.profile.risk.diabetes === true
    || currentMedications(context.records.medications).some((name) => GLUCOSE_LOWERING.test(name))
  const filled = missedPlanChanges({
    changes, unjudged, resolved: resolvedList, series, unread: new Set([...labs.failed, ...labs.cut]),
    z: reference.biovar.z, glucoseTreated, sex: context.records.profile.sex,
  })
  changes = filled.changes
  unjudged = filled.unjudged
  if (unjudged.length > 0) errors.push(`没有判断变化：${unjudged.map((row) => row.label_zh).join('、')}（读取失败或不完整）`)

  const adherence: Record<string, Adherence> = {}
  const calendarStart = addDays(context.today, -83)
  for (const item of plan.items) {
    // Adherence is read over the last 12 weeks: the stretch the calendar shows and the one a retest reflects.
    const window = { start: calendarStart, end: context.today }
    let daily: SeriesPoint[] | undefined
    let doses
    const wearable = item.target ?? (!item.mirobody ? wearableTargetFor(item) : null)
    if (wearable && recordReadable(context.records)) {
      const read = await loadSeries(context.config, [wearable.metric], { start: item.start < calendarStart ? item.start : calendarStart, end: context.today, resolution: 'day' })
      if (read.error) errors.push(`读取${wearable.metric}：${read.error}`)
      const points = read.series[wearable.metric]?.points ?? []
      // An inferred step/sleep target counts only when the series is actually there. Otherwise check-ins still count.
      if (item.target || points.length > 0) daily = points
    } else if (item.mirobody && recordReadable(context.records)) {
      const read = await loadDoseLog(context.config, item.mirobody.medication, item.start, context.today)
      if (read.error) errors.push(`读取${item.mirobody.medication}的服用记录：${read.error}`)
      doses = read.rows
    }
    adherence[item.id] = adherenceFor(item, window, { daily, doses, checkins })
  }
  const courseRead = recordReadable(context.records) ? await loadCourses(context.config) : { rows: [] as CourseRow[] }
  if (courseRead.error) errors.push(`读取用药变化：${courseRead.error}`)
  const courses = courseRead.rows

  const items = evaluatePlan({
    plan: judged, goals, today: context.today, markers, series, adherence, courses, checkins, biovar: reference.biovar, effects: reference.effects,
    // A marker whose readings failed to read is not judged from what is left: it says the read failed.
    unread: [...labs.failed, ...labs.cut],
    record_unread: context.records.record_status === 'error' ? 'failed' : context.records.catalog_truncated ? 'cut' : undefined,
  })
  const suggestions = suggestNext(items, { today: context.today, levers })
  const charts = chartsFor(judged, resolvedList, series, reference, goals)
  return {
    status: 'ok', today: context.today, plan, versions, items, suggestions, charts, bioage: bioageTold, models,
    checkins: checkins.slice(-30).reverse(), reference: referenceStats(reference), errors, changes, changes_note_zh: changesNote, changes_unjudged: unjudged, doctor_first: doctorFirst,
  }
}

/**
 * For each marker resolved to a self row, the record row it displaced: what
 * resolveMarkers picks from the record alone, or else any record row measuring
 * the same thing (same LOINC, the wearable's device row, the same report name).
 */
function recordCounterparts(resolved: readonly ResolvedMarker[], indicators: RecordSnapshot['indicators'], reference: Reference): Map<string, string> {
  const out = new Map<string, string>()
  const recordRows = indicators.filter((row) => row.source !== 'self' && row.value)
  for (const marker of resolved) {
    const selfKey = marker.indicator ? selfKeyOf(marker.indicator) : null
    if (!marker.indicator || !selfKey) continue
    const alone = resolveMarkers([marker.asked], recordRows, reference.biovar)[0]?.indicator
    const name = alone && recordRows.some((row) => row.name === alone && sameMeasure(selfKey, row)) ? alone
      : recordRows.find((row) => sameMeasure(selfKey, row))?.name
    if (name) out.set(marker.indicator, name)
  }
  return out
}

function chartsFor(plan: PlanVersion, markers: ResolvedMarker[], series: Record<string, SeriesPoint[]>, reference: Reference, goals: PlanVersion['goals']): MarkerChart[] {
  const out: MarkerChart[] = []
  const seen = new Set<string>()
  for (const marker of markers) {
    if (!marker.indicator || seen.has(marker.indicator)) continue
    seen.add(marker.indicator)
    // The marker's own series plus the same test under another printed name; a reading already merged into the
    // marker's series (a self row carries its record counterpart) is drawn once.
    const seenPoint = new Set<string>()
    const raw = [marker.indicator, ...(marker.also ?? [])].flatMap((name) => series[name] ?? [])
      .map((point) => ({ date: point.date, value: point.value }))
      .filter((point) => { const key = `${point.date}|${point.value}`; if (seenPoint.has(key)) return false; seenPoint.add(key); return true })
      .sort((a, b) => a.date.localeCompare(b.date))
    // Markers judged on weekly means (home blood pressure) are drawn as weekly means too.
    const points = marker.biovar?.average_days ? weeklyMeans(raw) : raw
    if (points.length === 0) continue
    const items = plan.items.filter((item) => item.markers.includes(marker.asked)).map((item) => item.id)
    const firstStart = plan.items.filter((item) => items.includes(item.id)).map((item) => item.start).sort()[0]
    const base = (firstStart ? points.filter((point) => point.date <= firstStart).at(-1) : undefined) ?? points[0]
    let band: MarkerChart['band'] = null
    if (base && marker.biovar) {
      const rcv = rcvBand(marker.biovar, reference.biovar.z)
      band = { base: base.value, base_date: base.date, low: base.value * (1 + rcv.down), high: base.value * (1 + rcv.up), verified: marker.biovar.verified }
    }
    const goal = goals.find((row) => row.marker === marker.asked || markers.find((other) => other.asked === row.marker)?.indicator === marker.indicator)
    out.push({
      key: marker.biovar?.key ?? marker.indicator,
      label: marker.label,
      indicator: marker.indicator,
      unit: marker.unit,
      better: marker.biovar?.better ?? 'none',
      points,
      ...(marker.biovar?.average_days ? { weekly: true } : {}),
      band,
      goal: goal ? goal.value : null,
      items,
    })
  }
  return out
}

function weeklyMeans(points: Array<{ date: string; value: number }>): Array<{ date: string; value: number }> {
  const weeks = new Map<string, number[]>()
  for (const point of points) {
    const at = new Date(`${point.date}T00:00:00Z`)
    at.setUTCDate(at.getUTCDate() - ((at.getUTCDay() + 6) % 7))
    const key = at.toISOString().slice(0, 10)
    weeks.set(key, [...(weeks.get(key) ?? []), point.value])
  }
  return [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, value: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 }))
}

// --- phenotypic age at every checkup ------------------------------------------

/** One required input: the record row holding its latest value, and every series that can hold it, best code first. */
interface Pair {
  spec: InputSpec
  indicator: RecordSnapshot['indicators'][number] | null
  names: string[]
}

function pairsFor(card: SkillCard, records: RecordSnapshot): Pair[] {
  return measurementInputs(card).filter((spec) => spec.required).map((spec) => ({
    spec,
    indicator: indicatorFor(spec, records.indicators),
    // Self measurements live in dataDir, not in Mirobody series.
    names: [...new Set(candidatesFor(spec, records.indicators).filter((item) => item.row.source !== 'self').map((item) => item.row.name))],
  }))
}

/** The inputs the record lacks, split: truly not on file, and not read (a failed read, or a catalogue cut short). */
function absentInputs(pairs: readonly Pair[], records: RecordSnapshot): { missing: Pair[]; unread: Pair[] } {
  const reads = readFlags(records)
  const absent = pairs.filter((pair) => !pair.indicator)
  const unread = absent.filter((pair) => notRead(pair.spec, records.indicators, reads))
  return { missing: absent.filter((pair) => !unread.includes(pair)), unread }
}

function ageOn(date: string, today: string, ageNow: number): number {
  return Math.round((ageNow - daysBetween(date, today) / 365.25) * 10) / 10
}

interface CheckupDays {
  /** One map per panel, keyed by the panel's end date. A windowed panel's inputs are copied onto that date. */
  byDate: Map<string, Map<string, SeriesPoint>>
  complete: string[]
  /** Days from the earliest input to the end date. 0 means every input was drawn that day. */
  spans: Map<string, number>
  error: string
}

/**
 * Each input's value by day, then the panels those days make.
 * A panel is every required input on one day, or, when that never happens, every input inside
 * PHENOAGE_WINDOW_DAYS ending on the latest of them. A same-day panel is kept on its own and is
 * not folded into a neighbour. The chosen points are stored under the panel's end date.
 */
async function checkupDays(context: TrackingContext, pairs: readonly Pair[]): Promise<CheckupDays> {
  const names = [...new Set(pairs.flatMap((pair) => pair.names))]
  const empty = (error: string): CheckupDays => ({ byDate: new Map(), complete: [], spans: new Map(), error })
  const read = await loadSeries(context.config, names, { start: addDays(context.today, -LOOKBACK_DAYS), end: context.today, resolution: 'raw' })
  const raw = new Map<string, Map<string, SeriesPoint>>()
  // Any series that failed to read, or came back cut, makes the days unknown: a value not read is never taken
  // for a checkup without it.
  if (read.failed.length > 0) return empty(read.error || '读取失败')
  if (read.cut.length > 0) return empty('读数过多被截断，未完整读取')
  for (const pair of pairs) {
    const rank = new Map<string, number>()
    pair.names.forEach((name, index) => {
      for (const point of read.series[name]?.points ?? []) {
        const day = raw.get(point.date) ?? new Map<string, SeriesPoint>()
        const held = rank.get(point.date)
        if (held == null || index <= held) {
          day.set(pair.spec.key, point)
          rank.set(point.date, index)
        }
        raw.set(point.date, day)
      }
    })
  }
  const keys = pairs.map((pair) => pair.spec.key)
  const dates = [...raw.keys()].sort()
  const full = (day: Map<string, SeriesPoint> | undefined) => Boolean(day) && keys.every((key) => (day as Map<string, SeriesPoint>).has(key))
  const sameDay = dates.filter((date) => full(raw.get(date)))
  const byDate = new Map<string, Map<string, SeriesPoint>>()
  const spans = new Map<string, number>()
  for (const date of sameDay) {
    byDate.set(date, raw.get(date) as Map<string, SeriesPoint>)
    spans.set(date, 0)
  }
  const seen = new Set<string>()
  for (const end of dates) {
    const start = addDays(end, -PHENOAGE_WINDOW_DAYS)
    if (sameDay.some((date) => date >= start && date <= end)) continue
    const chosen = new Map<string, SeriesPoint>()
    for (const date of dates) {
      if (date < start || date > end) continue
      for (const [key, point] of raw.get(date) ?? []) {
        const prev = chosen.get(key)
        if (!prev || date >= prev.date) chosen.set(key, point)
      }
    }
    if (!keys.every((key) => chosen.has(key))) continue
    let oldest = end
    let latest = oldest
    for (const point of chosen.values()) {
      if (point.date < oldest) oldest = point.date
      if (point.date > latest) latest = point.date
    }
    // Only the window that ends on its own latest input. Later empty days do not spawn another panel.
    if (latest !== end) continue
    const signature = keys.map((key) => `${key}@${(chosen.get(key) as SeriesPoint).date}`).join('|')
    if (seen.has(signature)) continue
    seen.add(signature)
    byDate.set(end, chosen)
    spans.set(end, daysBetween(oldest, end))
  }
  const complete = [...byDate.keys()].sort()
  return { byDate, complete, spans, error: '' }
}

/** What one checkup's phenotypic age is computed from (with the age as saved); a stored result with another key is stale. */
function inputsKey(context: TrackingContext, date: string, measurements: MeasurementIn[], age: number): string {
  const version = [context.catalog.version, context.catalog.revision]
  return createHash('sha1').update(JSON.stringify([date, measurements.map((row) => [row.key, row.value, row.unit]), age, version])).digest('hex').slice(0, 16)
}

async function ensureBioAge(context: TrackingContext, reference: Reference): Promise<BioAge> {
  const empty = (status: BioAge['status'], note: string, missing: string[] = []): BioAge => ({
    status, note_zh: note, missing, points: [], band_years: null, band_verified: false, band_missing: [], runs: 0,
    headline_zh: '', panel_span_days: null,
  })
  const card = context.catalog.cards.find((item) => item.name === PHENOAGE_SKILL)
  if (!card || !card.script) return empty('no_skill', '方法库中没有身体年龄（表型年龄）这项计算。')
  // A record that is configured but failed to read is not 'not connected': name the failure.
  if (context.records.record_status === 'error') return empty('error', readFailed(context.records))
  if (!recordReadable(context.records)) return empty('no_record', '尚未读取到体检记录，暂时无法计算历次身体年龄。')
  // Two people's labs never make one body age (INT062 fix 1): the father's checkups with the daughter's age and sex.
  const mixed = notOnePersonReason(context.records.profile, context.records.indicators)
  if (mixed) return empty('not_one_person', mixed)
  const pairs = pairsFor(card, context.records)
  const { missing, unread } = absentInputs(pairs, context.records)
  if (missing.length > 0) {
    const also = unread.length > 0 ? `另外${unread.map((pair) => pair.spec.label_zh).join('、')}未读取到。` : ''
    return empty('missing_inputs', `记录中还缺${missing.map((pair) => pair.spec.label_zh).join('、')}，九项血检齐全后才能计算身体年龄。${also}`, missing.map((pair) => pair.spec.label_zh))
  }
  // Not read is not "not measured": the series may still be readable, so the checkups are read either way.
  if (unread.some((pair) => pair.names.length === 0)) {
    return empty('error', `指标目录未完整读取，${unread.map((pair) => pair.spec.label_zh).join('、')}可能在未读取的部分中，暂时无法计算身体年龄。`)
  }
  const who = calculatorIdentity(context.records.profile)
  const ageNow = who.age
  if (ageNow == null) return empty('no_age', who.subject ? '这份记录属于家人，档案中尚无其年龄。' : '档案中尚无实足年龄。保存年龄后才能计算身体年龄。')

  const days = await checkupDays(context, pairs)
  if (days.error) return empty('error', `读取历次血检失败：${days.error}`)
  // A panel is one day, or every input inside PHENOAGE_WINDOW_DAYS. Nothing is carried further than that.
  const checkups = days.complete.slice(-BIOAGE_CHECKUPS)
  if (checkups.length === 0) return empty('no_checkup', `没有一次检查在 ${PHENOAGE_WINDOW_DAYS} 天内测齐九项血检，暂时无法计算身体年龄。`)
  // Each checkup's inputs, its age then and the skill version; a stored result for other inputs is recomputed.
  const wanted = new Map(checkups.map((date) => {
    const measurements = latestMeasurements(pairs, days.byDate, date)
    const age = ageOn(date, context.today, ageNow)
    // Keyed on the age as saved, not the age worked out from today: the saved age does not grow with the calendar,
    // so a key on the worked-out age would recompute a past checkup every few weeks at an ever lower age.
    return [date, { measurements, age, key: inputsKey(context, date, measurements, ageNow) }]
  }))
  const have = currentRows(context.dataDir, wanted)
  let runs = 0
  let lastError = ''
  for (const [date, want] of wanted) {
    if (have.has(date)) continue
    const failedKey = JSON.stringify([context.dataDir, want.key, who.sex])
    if (recentlyFailed(failedKey)) continue
    const result = await runSkill({
      home: context.skillsHome, dataDir: context.dataDir, name: PHENOAGE_SKILL, args: [], files: [], measurements: want.measurements,
      profile: { age: want.age, sex: who.sex }, useProfile: true,
      python: context.config.skillPython, runtimes: context.config.skillRuntimes, timeoutMs: context.config.skillTimeoutMs,
      revision: context.catalog.revision, measuredAt: date, inputsKey: want.key,
    })
    if (!result.ok) {
      failedRuns.set(failedKey, Date.now())
      if (date === checkups.at(-1)) lastError = (result.error || result.error_kind || '').slice(0, 200)
    }
    runs += 1
  }
  const points = pointsOf(currentRows(context.dataDir, wanted))
  const latest = checkups.at(-1) as string
  const band = await bioAgeBand(context, reference, card, pairs, days.byDate, latest, ageNow)
  // A result for the latest complete checkup, computed from today's inputs; an older point never stands in for it.
  const current = points.at(-1)?.date === latest
  const span = days.spans.get(latest) ?? 0
  const latestPoint = points.at(-1)
  const wording = current && latestPoint
    ? bodyAgeWording({
      phenoage: latestPoint.phenoage,
      advance: latestPoint.advance,
      bandYears: band?.years ?? null,
      dates: points.map((row) => row.date),
      advances: points.map((row) => row.advance),
      spanDays: span,
      date: latest,
    })
    : null
  const sameDayCount = checkups.filter((date) => (days.spans.get(date) ?? 0) === 0).length
  const windowNote = span > 0
    ? `最近一次九项血检在 ${span} 天内测齐（截至 ${dateZh(latest, context.today)}，不超过 ${PHENOAGE_WINDOW_DAYS} 天），不是同一天抽血。`
    : `按 ${points.length} 次同一天测齐九项血检的检查回算${sameDayCount < points.length ? '（另有不在同一天、但在窗口内的检查）' : ''}。`
  const firstDate = checkups[0]
  const beforePanel = firstDate && firstDate !== latest
    ? panelFromMeasurements(wanted.get(firstDate)?.measurements ?? [], wanted.get(firstDate)?.age ?? ageNow)
    : null
  const afterPanel = panelFromMeasurements(wanted.get(latest)?.measurements ?? [], wanted.get(latest)?.age ?? ageNow)
  const pheno_compare = beforePanel && afterPanel ? { before: beforePanel, after: afterPanel } : null
  return {
    status: current ? 'ok' : 'error',
    note_zh: current
      ? `${wording?.headline_zh ?? ''} ${windowNote}`.trim()
      : `${dateZh(latest, context.today)}这次血检的身体年龄未能计算${lastError ? `：${lastError}` : ''}。请在对话里运行身体年龄（表型年龄）方法查看原因。`,
    headline_zh: wording?.headline_zh ?? '',
    allows_younger: wording?.allows_younger === true,
    panel_span_days: current ? span : null,
    missing: [], points, band_years: band?.years ?? null, band_verified: band?.verified ?? false, band_missing: band?.missing ?? [], runs,
    ...(pheno_compare ? { pheno_compare } : {}),
  }
}

/** Replace a younger celebration when the input that moved the age is itself a concern. */
export function narrateBioAge(bioage: BioAge, changes: readonly RecordChange[], doctor: StopResult, glucoseTreated: boolean): BioAge {
  const compare = bioage.pheno_compare
  const first = bioage.points[0]
  const last = bioage.points.at(-1)
  if (!compare || !first || !last || first.advance == null || last.advance == null) return bioage
  // A caution is a change the page already sends to a doctor, or a doctor-first hit. A method note on a
  // marker (caveat_zh, e.g. how CRP's variation was measured) is not a health concern.
  const cautions = [
    ...changes.filter((row) => row.ask_doctor || row.range_flag).map((row) => row.key),
    ...(doctor.hits ?? []).map((hit) => hit.key),
  ]
  const story = bodyAgeStory({
    deltaYears: last.advance - first.advance,
    bandYears: bioage.band_years,
    draws: bioage.points.length,
    before: compare.before,
    after: compare.after,
    cautions,
    glucoseTreated,
  })
  if (!story) return bioage
  // The celebration needs a verified noise band, the same rule the graded message applies. Without it the
  // existing wording stays; a concern sentence is never a celebration, so it stands either way.
  if (story.allows_younger && !bioage.band_verified) return bioage
  // A panel measured across days stays labelled as a window. The story replaces the celebration, not that fact.
  const clause = bioage.panel_span_days != null && bioage.panel_span_days > 0
    ? (`${bioage.headline_zh} ${bioage.note_zh}`.match(/九项血检在 \d+ 天内测齐[^。]*不是同一天抽血。/)?.[0] ?? '')
    : ''
  const headline = clause && !story.headline_zh.includes('不是同一天抽血') ? `${story.headline_zh}${clause}` : story.headline_zh
  const told = /身体年龄/.test(headline) ? headline : `身体年龄（模型估计）。${headline}`
  return {
    ...bioage,
    headline_zh: headline,
    note_zh: bioage.status === 'ok' ? told : bioage.note_zh,
    allows_younger: story.allows_younger,
  }
}

/** The blocker when Mirobody is configured but the read failed. */
export function readFailed(records: Pick<RecordSnapshot, 'record_error'>): string {
  const reason = records.record_error.trim().replace(/[。.]$/, '')
  return `记录读取失败：${reason || '原因未知'}。`
}

/** For each wanted checkup date, the latest stored run whose inputs key is that date's key today. */
function currentRows(dataDir: string, wanted: Map<string, { key: string }>): Map<string, HistoryRow> {
  const out = new Map<string, HistoryRow>()
  for (const row of readHistory(dataDir, 1000)) {
    if (row.skill !== PHENOAGE_SKILL || !row.measured_at || !row.inputs_key) continue
    if (wanted.get(row.measured_at)?.key === row.inputs_key) out.set(row.measured_at, row)
  }
  return out
}

function pointsOf(rows: Map<string, HistoryRow>): BioAgePoint[] {
  const number = (row: HistoryRow, key: string) => {
    const value = row.outputs[key]?.value
    return value == null || !Number.isFinite(Number(value)) ? null : Number(value)
  }
  return [...rows.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([date, row]) => {
    const phenoage = number(row, 'phenoage')
    if (phenoage == null) return []
    return [{
      date,
      phenoage: Math.round(phenoage * 10) / 10,
      advance: roundPercentPoints(number(row, 'phenoage_advance'), 1),
      mortality_10y_pct: roundPercentPoints(number(row, 'mortality_10y_pct'), 2),
    }]
  }).slice(-BIOAGE_CHECKUPS)
}

async function leversAt(
  context: TrackingContext,
  card: SkillCard,
  measurements: MeasurementIn[],
  age: number,
  targets: MeasurementIn[],
  date: string,
  extraArgs: string[] = [],
): Promise<Levers | null> {
  return (await runModel(context, card, measurements, age, targets, date, extraArgs))?.levers ?? null
}

interface ModelRun {
  levers: Levers | null
  outputs: Record<string, { value: number | string | null }>
  error: string
}

const runMemo = new Map<string, ModelRun & { at: number }>()
// Failed runs are remembered for the memo TTL, so a broken runtime is not retried on every request.
const failedRuns = new Map<string, number>()

function recentlyFailed(key: string): boolean {
  const at = failedRuns.get(key)
  if (at == null) return false
  if (Date.now() - at < CACHE_TTL_MS) return true
  failedRuns.delete(key)
  return false
}

async function runModel(
  context: TrackingContext,
  card: SkillCard,
  measurements: MeasurementIn[],
  age: number,
  targets: MeasurementIn[],
  date: string,
  extraArgs: string[],
): Promise<ModelRun> {
  const key = JSON.stringify([card.name, context.catalog.revision, date, measurements, age, targets, extraArgs, context.records.profile.sex])
  const hit = runMemo.get(key)
  // A successful run is kept (same inputs, same output); a failed one only for the memo TTL.
  if (hit && (!hit.error || Date.now() - hit.at < CACHE_TTL_MS)) return hit
  const files: Array<{ name: string; text: string }> = []
  const args: string[] = [...extraArgs]
  const flag = card.entry?.targets_flag
  if (flag && targets.length > 0) {
    const staged = stageMeasurements(card, targets)
    files.push({ name: 'targets.csv', text: staged.csv })
    args.push(flag, 'targets.csv')
  }
  const result = await runSkill({
    home: context.skillsHome, dataDir: context.dataDir, name: card.name, args, files, measurements,
    profile: { age, sex: context.records.profile.sex }, useProfile: true,
    python: context.config.skillPython, runtimes: context.config.skillRuntimes, timeoutMs: context.config.skillTimeoutMs,
    revision: context.catalog.revision, measuredAt: date,
  })
  const run = {
    levers: result.ok ? result.levers ?? null : null,
    outputs: result.outputs ?? {},
    error: result.ok ? '' : (result.error || result.error_kind || 'skill run failed').slice(0, 300),
    at: Date.now(),
  }
  runMemo.delete(key)
  runMemo.set(key, run)
  if (runMemo.size > 50) runMemo.delete(runMemo.keys().next().value as string)
  if (failedRuns.size > 200) failedRuns.delete(failedRuns.keys().next().value as string)
  return run
}

function latestMeasurements(pairs: ReturnType<typeof pairsFor>, byDate: Map<string, Map<string, SeriesPoint>>, date: string): MeasurementIn[] {
  const day = byDate.get(date) as Map<string, SeriesPoint>
  return pairs.map((pair) => {
    const point = day.get(pair.spec.key) as SeriesPoint
    return { key: pair.spec.key, value: point.value, unit: point.unit }
  })
}

/** Years of phenotypic age that within-person variation of the nine inputs could move, from the skill's own slopes. */
async function bioAgeBand(
  context: TrackingContext,
  reference: Reference,
  card: SkillCard,
  pairs: ReturnType<typeof pairsFor>,
  byDate: Map<string, Map<string, SeriesPoint>>,
  date: string,
  ageNow: number,
): Promise<{ years: number; verified: boolean; missing: string[] } | null> {
  const levers = await leversAt(context, card, latestMeasurements(pairs, byDate, date), ageOn(date, context.today, ageNow), [], date)
  if (!levers) return null
  let variance = 0
  let verified = true
  const missing: string[] = []
  for (const row of levers.sensitivity) {
    const pair = pairs.find((item) => item.spec.key === row.key)
    const marker = pair?.indicator ? markerFor(reference.biovar, pair.indicator) : null
    if (!marker || row.years_per_unit == null) {
      missing.push(row.label_zh)
      continue
    }
    verified &&= marker.verified
    const cvi = marker.cvi_pct / 100
    const cva = (marker.cva_pct ?? marker.cvi_pct / 2) / 100
    const relative = marker.log_normal
      ? Math.sqrt(Math.log(1 + cvi * cvi) + Math.log(1 + cva * cva))
      : Math.sqrt(cvi * cvi + cva * cva)
    variance += (row.years_per_unit * row.value * relative) ** 2
  }
  if (missing.length === levers.sensitivity.length) return null
  return { years: Math.SQRT2 * reference.biovar.z * Math.sqrt(variance), verified, missing }
}

// --- models of the goals -------------------------------------------------------

/** A plan goal as one skill input: the name to stage it under, and the input it fills. */
interface GoalTarget {
  spec: InputSpec
  staged: MeasurementIn
}

/**
 * The plan's goals this skill takes, each under a name that keeps the input's unit rules: the goal's own name
 * when the skill knows it, else the input's label (never its key, which would read a goal given without a unit
 * as already in the input's unit). Goals for other inputs are not this skill's, and not a problem.
 */
function goalTargets(card: SkillCard, goals: PlanVersion['goals'], reference: Reference): GoalTarget[] {
  const index = aliasIndex(measurementInputs(card))
  const out: GoalTarget[] = []
  for (const goal of goals) {
    const hit = resolveInput(index, goal.marker)
    let spec = hit?.spec
    let name = hit && !hit.byKey ? goal.marker : spec?.label_zh
    if (!spec) {
      const marker = reference.biovar.markers.find((row) => row.key === goal.marker) ?? markerFor(reference.biovar, { name: goal.marker, label: goal.marker })
      spec = marker ? measurementInputs(card).find((item) => (item.loinc ?? []).some((code) => marker.loinc.includes(code))) : undefined
      name = spec?.label_zh
    }
    if (spec && name) out.push({ spec, staged: { key: name, value: goal.value, unit: goal.unit } })
  }
  return out
}

/** The goals staged as the skill would read them, and why any could not be: then none is modelled. */
function stagedGoals(card: SkillCard, goals: PlanVersion['goals'], reference: Reference): { targets: GoalTarget[]; problems: string[] } {
  const targets = goalTargets(card, goals, reference)
  if (targets.length === 0) return { targets, problems: [] }
  // Missing inputs are expected (a goal is set for some markers only); any other problem is the goal's own.
  const problems = stageMeasurements(card, targets.map((row) => row.staged)).problems.filter((row) => row.kind !== 'missing')
  return problems.length > 0 ? { targets: [], problems: [...new Set(problems.map((row) => `目标值：${row.message_zh}`))] } : { targets, problems: [] }
}

/** What is wrong with the plan's goals for the result models, in Chinese (empty when they can all be modelled). */
export function goalProblems(catalog: Catalog, goals: PlanVersion['goals'], skillsHome: string): string[] {
  const reference = loadReference(skillsHome)
  const out: string[] = []
  for (const name of [PHENOAGE_SKILL, RISK_SKILL]) {
    const card = catalog.cards.find((item) => item.name === name)
    if (card) out.push(...stagedGoals(card, goals, reference).problems)
  }
  return [...new Set(out)]
}

/** A missing lab, with a tape-measure waist said as not measured yet rather than as a failed read. */
function missingLabsNote(labels: readonly string[]): string {
  const waist = labels.filter((label) => label.includes('腰围'))
  const rest = labels.filter((label) => !label.includes('腰围'))
  const parts: string[] = []
  if (rest.length > 0) parts.push(`记录里还缺${rest.join('、')}。`)
  if (waist.length > 0) parts.push(`${waist.join('、')}尚未测量，测量并填写后即可计算。`)
  return parts.join('')
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(3)))
}

async function modelCards(context: TrackingContext, reference: Reference, goals: PlanVersion['goals']): Promise<ModelCard[]> {
  const cards: ModelCard[] = []
  const pheno = context.catalog.cards.find((item) => item.name === PHENOAGE_SKILL)
  const boundary = '模型估计，基于人群数据拟合，不是对你个人的预测，也不是寿命预测。'
  if (pheno && pheno.entry?.levers_json && recordReadable(context.records) && calculatorIdentity(context.records.profile).age != null) {
    const pairs = pairsFor(pheno, context.records)
    if (pairs.every((pair) => pair.names.length > 0)) {
      const days = await checkupDays(context, pairs)
      const date = days.complete.at(-1)
      if (date) {
        const { targets, problems } = stagedGoals(pheno, goals, reference)
        const age = ageOn(date, context.today, calculatorIdentity(context.records.profile).age as number)
        const current = latestMeasurements(pairs, days.byDate, date)
        const levers = await leversAt(context, pheno, current, age, targets.map((row) => row.staged), date)
        // Show each lever in the units of the person's own report and goal, not the method's.
        const inTheirUnits = (key: string, fallback: { from: string; to: string }) => {
          const now = current.find((row) => row.key === key)
          const goal = targets.find((row) => row.spec.key === key)?.staged
          return now && goal ? { from: `${fmt(Number(now.value))} ${now.unit}`.trim(), to: `${fmt(Number(goal.value))} ${goal.unit}`.trim() } : fallback
        }
        if (levers) {
          const target = levers.targets as { phenoage?: number; phenoage_delta?: number; mortality_10y_pct?: number } | undefined
          const sensitivity = levers.sensitivity.map((row) => {
            const pair = pairs.find((item) => item.spec.key === row.key)
            const marker = pair?.indicator ? markerFor(reference.biovar, pair.indicator) : null
            const relative = marker ? marker.cvi_pct / 100 : 0.1
            const stepValue = row.value * relative
            return { label: row.label_zh, unit: row.unit, years_per_step: (row.years_per_unit ?? 0) * stepValue, step: `${fmt(stepValue)} ${row.unit}`, ...(marker ? { key: marker.key } : {}) }
          }).filter((row) => Number.isFinite(row.years_per_step)).sort((a, b) => Math.abs(b.years_per_step) - Math.abs(a.years_per_step)).slice(0, 5)
          cards.push({
            model: 'phenoage',
            title_zh: '身体年龄',
            status: target ? 'ok' : 'no_goal',
            note_zh: target
              ? `按 ${date} 的血检，达到方案目标时身体年龄 ${target.phenoage_delta != null && target.phenoage_delta <= 0 ? '年轻' : '变化'} ${fmt(Math.abs(target.phenoage_delta ?? 0))} 岁。`
              : problems.length > 0
                ? `方案目标没有用于计算：${problems.join(' ')}`
                : '方案里还没有和九项血检对应的目标值。设定目标（如空腹血糖、超敏 CRP）后，这里会算出达到目标时的表型年龄。',
            measured_on: date,
            now: {
              phenoage: roundPercentPoints(numberOrNull(levers.current.phenoage), 1),
              mortality_10y_pct: roundPercentPoints(numberOrNull(levers.current.mortality_10y_pct), 2),
              age,
            },
            goal: target ? {
              phenoage: roundPercentPoints(target.phenoage ?? null, 1),
              mortality_10y_pct: roundPercentPoints(target.mortality_10y_pct ?? null, 2),
              phenoage_delta: roundPercentPoints(target.phenoage_delta ?? null, 1),
            } : null,
            levers: levers.levers.map((row) => ({
              label: row.label_zh,
              ...inTheirUnits(row.key, { from: `${fmt(row.from)} ${row.unit}`, to: `${fmt(row.to)} ${row.unit}` }),
              years: row.phenoage_delta ?? 0,
            })),
            ...(problems.length > 0 ? { goal_problems_zh: problems } : {}),
            input_dates: pairs.map((pair) => ({ key: pair.spec.key, label_zh: pair.spec.label_zh, date, source: 'checkup' as const })),
            sensitivity,
            boundary_zh: boundary,
          })
        }
      }
    }
  }
  const risk = context.catalog.cards.find((item) => item.name === RISK_SKILL)
  cards.push(await riskCard(context, reference, risk, goals))
  return cards
}

const RISK_FLAGS: Array<{ fact: RiskFact; flag: string; men_only?: boolean }> = [
  { fact: 'bp_treated', flag: '--treated' },
  { fact: 'smoker', flag: '--smoker' },
  { fact: 'diabetes', flag: '--diabetes' },
  { fact: 'north', flag: '--north' },
  { fact: 'urban', flag: '--urban', men_only: true },
  { fact: 'family_history', flag: '--family-history', men_only: true },
]

/**
 * The home blood pressure a risk equation should see: the mean of every home
 * reading, the wearable cuff's and the ones the person typed, in the 7 days
 * ending at the latest of them (days −6 to 0, the same window latestSelf uses).
 * A typed reading joins the cuff's week; it never displaces it.
 */
export async function homeBloodPressure(context: TrackingContext): Promise<{ value: number; unit: string; date: string; n: number } | null> {
  const unit = SELF_SPEC.sbp.unit
  const readings = readSelf(context.dataDir).filter((row) => row.key === 'sbp').map((row) => ({ date: row.date, value: row.value }))
  const devices = context.records.indicators.filter((row) => row.source !== 'self' && (SELF_DEVICE_NAMES.sbp ?? []).includes(row.name))
  const latestOf = (dates: string[]) => dates.filter(Boolean).sort().at(-1) ?? ''
  const guess = latestOf([...readings.map((row) => row.date), ...devices.map((row) => row.date || row.last_date || '')])
  if (devices.length > 0 && guess && recordReadable(context.records)) {
    const read = await loadSeries(context.config, devices.map((row) => row.name), { start: addDays(guess, -6), end: guess, resolution: 'raw' })
    for (const row of devices) {
      for (const point of read.series[row.name]?.points ?? []) {
        if (!normalizeUnit(point.unit) || normalizeUnit(point.unit) === normalizeUnit(unit)) readings.push({ date: point.date, value: point.value })
      }
    }
  }
  const last = latestOf(readings.map((row) => row.date))
  if (!last) return null
  const week = readings.filter((row) => row.date >= addDays(last, -6) && row.date <= last)
  return { value: Math.round((week.reduce((sum, row) => sum + row.value, 0) / week.length) * 10) / 10, unit, date: last, n: week.length }
}

async function riskCard(context: TrackingContext, reference: Reference, card: SkillCard | undefined, goals: PlanVersion['goals']): Promise<ModelCard> {
  const base: ModelCard = {
    model: 'china-par', title_zh: '10 年动脉粥样硬化性心血管病风险（China-PAR）', status: 'unavailable', note_zh: '', measured_on: null,
    now: {}, goal: null, missing: [], missing_labs: [], missing_facts: [], levers: [], sensitivity: [],
    boundary_zh: `模型估计：China-PAR 按中国成人队列建立，给出的是和你条件相同的人群平均风险，不是诊断，也不决定是否用药。${modelRangeNote('china-par', context.records.profile.age) ?? ''}`,
  }
  if (!card || !card.script) {
    base.note_zh = '方法库里没有 10 年心血管风险这项计算。'
    return base
  }
  if (card.inputsStatus !== 'verified') {
    base.note_zh = '风险模型还没有通过系数校验，暂不显示数值。'
    return base
  }
  const who = calculatorIdentity(context.records.profile)
  const profile = { ...context.records.profile, age: who.age, sex: who.sex }
  const missingFacts: string[] = []
  const uncertainFacts: string[] = []
  const uncertain = new Set(profile.riskUnknown ?? [])
  if (profile.age == null) missingFacts.push('实足年龄')
  // China-PAR has one equation for men and one for women; 'other' or unknown cannot pick one.
  if (profile.sex !== 'male' && profile.sex !== 'female') missingFacts.push('性别（男或女）')
  const args: string[] = []
  for (const item of RISK_FLAGS) {
    if (item.men_only && profile.sex !== 'male') continue
    const value = profile.risk?.[item.fact]
    if (value == null && uncertain.has(item.fact)) uncertainFacts.push(RISK_FACT_ZH[item.fact])
    else if (value == null) missingFacts.push(RISK_FACT_ZH[item.fact])
    else args.push(item.flag, value ? 'yes' : 'no')
  }
  // Labs are listed even without a record, so the person knows what a checkup (or a tape measure) must supply.
  const found: Array<{ spec: InputSpec; key: string; row: NonNullable<ReturnType<typeof indicatorFor>> }> = []
  const missingLabs: string[] = []
  // On file but not read (a failed read, or a catalogue cut short): unknown, never listed as a test to add.
  const unreadLabs: string[] = []
  const reads = readFlags(context.records)
  for (const spec of measurementInputs(card)) {
    const row = indicatorFor(spec, context.records.indicators)
    if (row) found.push({ spec, key: spec.key, row })
    else if (spec.required) (notRead(spec, context.records.indicators, reads) ? unreadLabs : missingLabs).push(spec.label_zh)
  }
  base.missing_labs = missingLabs
  base.missing_facts = missingFacts
  base.missing = [...missingLabs, ...missingFacts]
  const factsHint = missingFacts.length > 0 ? `档案里还缺${missingFacts.join('、')}（在健康页填写，或在对话里告诉我）。` : ''
  const uncertainHint = uncertainFacts.length > 0 ? `${uncertainFacts.join('、')}记为不确定。10 年心血管风险需要回答「是」或「否」才能计算。` : ''
  if (context.records.record_status === 'error') {
    // Which labs the record lacks is unknown while the read fails, so none are listed as add-ons.
    base.missing_labs = []
    base.missing = [...missingFacts]
    base.note_zh = `${readFailed(context.records)}${factsHint}${uncertainHint}`
    return base
  }
  if (!recordReadable(context.records)) {
    const labsHint = missingLabs.length > 0 ? `，计算还需要${missingLabs.join('、')}` : ''
    base.note_zh = `尚未读取到体检记录${labsHint}。${factsHint}${uncertainHint}`
    return base
  }
  if (missingLabs.length > 0 || missingFacts.length > 0 || unreadLabs.length > 0 || uncertainFacts.length > 0) {
    const unreadHint = unreadLabs.length > 0 ? `${unreadLabs.join('、')}的最新值未读取到（读取失败），并非未检测。` : ''
    base.note_zh = `${missingLabsNote(missingLabs)}${unreadHint}${factsHint}${uncertainHint}`
    return base
  }
  const measurements: MeasurementIn[] = []
  const inputDates: NonNullable<ModelCard['input_dates']> = []
  for (const { spec, key, row } of found) {
    const source = row.source === 'self' ? 'self' as const : row.loinc ? 'checkup' as const : 'device' as const
    // Home readings (typed or from the wearable cuff) are judged as their 7-day mean, pooled. A clinic reading
    // from a checkup is used as it is while it is the newer; a newer home week takes its place.
    if (key === 'sbp_mmhg') {
      const home = row.source === 'self' || (SELF_DEVICE_NAMES.sbp ?? []).includes(row.name)
      const week = await homeBloodPressure(context)
      if (week && (home || week.date > (row.date || row.last_date || ''))) {
        measurements.push({ key, value: week.value, unit: week.unit })
        inputDates.push({ key, label_zh: spec.label_zh, date: week.date, source: 'home' })
        continue
      }
    }
    measurements.push({ key, value: row.value, unit: row.unit })
    inputDates.push({ key, label_zh: spec.label_zh, date: row.date || row.last_date || null, source })
  }
  // The date of the newest input actually used; each input's own date is in input_dates.
  const measuredOn = inputDates.map((row) => row.date ?? '').sort().at(-1) ?? ''
  const { targets, problems } = stagedGoals(card, goals, reference)
  const run = await runModel(context, card, measurements, profile.age as number, targets.map((row) => row.staged), context.today, args)
  if (!run.levers) {
    base.note_zh = run.error ? `风险模型没有算出结果：${run.error}` : '风险模型没有算出结果，请在对话里运行它查看原因。'
    return base
  }
  const target = run.levers.targets as { risk_pct?: number; risk_delta_pct?: number; category?: string } | undefined
  const rangeNote = modelRangeNote('china-par', profile.age)
  const category = typeof run.levers.current.category === 'string' ? run.levers.current.category
    : typeof run.outputs.risk_category?.value === 'string' ? run.outputs.risk_category.value : ''
  const inTheirUnits = (key: string, fallback: { from: string; to: string }) => {
    const now = measurements.find((row) => row.key === key)
    const goal = targets.find((row) => row.spec.key === key)?.staged
    return now && goal ? { from: `${fmt(Number(now.value))} ${now.unit}`.trim(), to: `${fmt(Number(goal.value))} ${goal.unit}`.trim() } : fallback
  }
  // One within-person step of each modifiable input, in percentage points of risk (the skill's own slope).
  const sensitivity = run.levers.sensitivity.map((row) => {
    const spec = measurementInputs(card).find((item) => item.key === row.key)
    const codes = spec?.loinc ?? []
    const marker = reference.biovar.markers.find((item) => item.loinc.some((code) => codes.includes(code))) ?? null
    const relative = marker ? marker.cvi_pct / 100 : 0.1
    const stepValue = row.value * relative
    // Waist has no biological-variation row (and China-PAR gives it no LOINC): it is keyed as the self measurement.
    const key = marker?.key ?? (codes.includes(SELF_SPEC.waist.loinc) || spec?.label_zh === SELF_SPEC.waist.label_zh ? 'waist' : undefined)
    return { label: row.label_zh, unit: row.unit, years_per_step: (row.per_unit ?? 0) * stepValue, step: `${fmt(stepValue)} ${row.unit}`, ...(key ? { key } : {}) }
  }).filter((row) => Number.isFinite(row.years_per_step)).sort((a, b) => Math.abs(b.years_per_step) - Math.abs(a.years_per_step))
  const riskNow = roundPercentPoints(numberOrNull(run.levers.current.risk_pct), 1)
  return {
    ...base,
    sensitivity,
    status: target ? 'ok' : 'no_goal',
    note_zh: `${target
      ? '达到方案目标时的 10 年风险按同一模型计算。'
      : problems.length > 0
        ? `方案目标没有用于计算：${problems.join(' ')}`
        : '方案里还没有血压、总胆固醇、HDL-C 或腰围的目标。设定后，这里会算出达到目标时的风险。'}${rangeNote ? ` ${rangeNote}` : ''}`,
    measured_on: measuredOn || context.today,
    now: { risk_pct: riskNow },
    goal: target ? { risk_pct: roundPercentPoints(target.risk_pct ?? null, 1), risk_delta_pct: roundPercentPoints(target.risk_delta_pct ?? null, 2) } : null,
    category_zh: { now: category, goal: target?.category ?? null },
    levers: run.levers.levers.map((row) => ({
      label: row.label_zh,
      ...inTheirUnits(row.key, { from: `${fmt(row.from)} ${row.unit}`, to: `${fmt(row.to)} ${row.unit}` }),
      years: row.risk_delta_pct ?? 0,
    })),
    ...(problems.length > 0 ? { goal_problems_zh: problems } : {}),
    input_dates: inputDates,
  }
}

/** Model cards for goal values named in conversation, without saving them to the plan. */
export async function modelGoals(context: TrackingContext, goals: PlanVersion['goals']): Promise<{ models: ModelCard[]; how_to_read: string }> {
  const reference = loadReference(context.skillsHome)
  return {
    models: await modelCards(context, reference, goals),
    how_to_read: 'Model estimates at the latest complete checkup. levers[].years is the change in phenotypic age (years) or, for china-par, in 10-year risk (percentage points) from moving that one marker alone. Say 模型估计 and quote boundary_zh; never present it as a personal prediction or a lifespan.',
  }
}

/** One item as it is stored, to read back before saving: what it is, when, how often, what it aims at, and its details. */
export function describeItem(item: PlanItem): string {
  const parts = [`${CATEGORY_ZH[item.category]}｜${item.title}`, `${item.start} 起${item.end ? `，${item.end} 止` : ''}`]
  if (item.frequency) parts.push(`每${item.frequency.per === 'day' ? '天' : '周'} ${item.frequency.times} 次`)
  if (item.target) parts.push(`手环目标 ${item.target.metric} ${item.target.op} ${item.target.value}${item.target.unit ? ` ${item.target.unit}` : ''}`)
  if (item.markers.length > 0) parts.push(`看 ${item.markers.join('、')}`)
  if (item.mirobody) parts.push(`服用记录来自用药计划（${item.mirobody.medication}）`)
  if (item.detail) parts.push(`说明：${item.detail}`)
  return parts.join('；')
}

/** The plan's own title and note, as stored, read back with its items. */
export function describePlan(plan: Pick<PlanVersion, 'title' | 'note'>): string {
  return `方案：${plan.title}${plan.note ? `；备注：${plan.note}` : ''}`
}
