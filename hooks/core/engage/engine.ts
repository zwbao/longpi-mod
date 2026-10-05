// 长寿图鉴 (docs/codex-design.md 1.2). The main line is a two-week personal experiment: three to choose from, do
// it, reveal. The reveal is the only pack opening. The library is free to read. Packs come only from a season
// start, a finished experiment, or the holder's own retest; a family member's visit or checkup is a footprint.
// State lives in the account holder's LongPi home (engage/state.json), whoever is being looked at.

import { readFileSync } from '../../sys/fs.ts'
import { join } from '../../sys/path.ts'
import type { IsoDay, IsoTime } from '../contracts/common.ts'
import type { Config } from '../config.ts'
import type { ExperimentRun, ExperimentSpec, Footprint, FootprintKind, MetricKey, Pack, ResultCard, RunResult, Tier } from '../contracts/codex.ts'
import type { Bus, HealthEventPayloads, HealthEventType } from '../contracts/events.ts'
import type { FactPack } from '../contracts/factpack.ts'
import type { ActionKind } from '../contracts/surfaces.ts'
import { addDays, civilParts, daysBetween, isoDay } from '../interventions.ts'
import { minorView } from '../privacy/consents.ts'
import { readProfile } from '../profile.ts'
import { loadReference, type Biovar } from '../reference.ts'
import { careItems } from '../triage/care.ts'
import { codexBlock, codexBlockZh, experimentById, loadCatalog, loadLibrary, studyById, type CodexBlock } from './data.ts'
import { blockedBy, devices, eligible, leadInFor, pickThree, primaryFor, randomSchedule, type EligibilityContext } from './eligibility.ts'
import { DEFAULT_MY_DAY, laterReveal, markRevealShown, settleAcks, slotView, standupDays, validClock, type SlotView } from './nudge.ts'
import { readSeriesCache, refreshSeries, stepsOnDay, valuesIn, type SeriesCache } from './series.ts'
import { emptyState, newId, readState, saveState, type CodexContext, type State } from './state.ts'
import { doneZh, judgeMetric, MIN_BASELINE_DAYS, MIN_TRIAL_DAYS, OUTCOME_ZH, praiseZh, thresholdZh } from './verdict.ts'

export const SEASON_DAYS = 56
const MAX_RUNNING = 2
const EXTEND_DAYS = 7
const RETEST_SEASON_CAP_DAYS = 112

export const FOOTPRINT_NOTE_ZH = '只记你做了什么，不代表指标好坏。'

interface Runtime {
  /** The person being looked at (a family member's folder when one is chosen). */
  dataDir: () => string
  /** The account holder's LongPi home: the Codex lives here. */
  rootDir: () => string
  skillsHome: () => string
  codexOn: () => boolean
  bus: Bus | null
  /** Re-read the holder's record and the Codex series (bound by register(); absent in tests). */
  refresh: ((force?: boolean) => Promise<void>) | null
}

let runtime: Runtime = { dataDir: () => '', rootDir: () => '', skillsHome: () => '', codexOn: () => true, bus: null, refresh: null }
let lastKick = 0

/** From the slot poll: refresh the series in the background at most every 15 minutes, so a day away from the page still counts. */
export function kickRefresh(now: number = Date.now()): void {
  if (!runtime.refresh || now - lastKick < 15 * 60_000) return
  lastKick = now
  void runtime.refresh().catch(() => undefined)
}

/** The record changed (a report, an import, a measurement): rebuild the Codex series now, not in 15 minutes. */
export function recordChanged(): Promise<void> {
  lastKick = Date.now()
  return runtime.refresh ? runtime.refresh(true).catch(() => undefined) : Promise.resolve()
}

export function bindRuntime(next: Partial<Runtime>): void {
  runtime = { ...runtime, ...next }
}

export function boundDataDir(): string {
  return runtime.dataDir()
}

/** The holder's home; falls back to the active folder when only that is bound (tests, bare hosts). */
export function boundRootDir(): string {
  return runtime.rootDir() || runtime.dataDir()
}

function emit<T extends HealthEventType>(type: T, payload: HealthEventPayloads[T]): void {
  try { runtime.bus?.emit(type, payload, { module: 'M6', via: 'route' }) } catch { /* the bus is optional */ }
}

function biovar(): Biovar | null {
  try {
    const home = runtime.skillsHome()
    return home ? loadReference(home).biovar : null
  } catch {
    return null
  }
}

// ---- who may use it -----------------------------------------------------------

interface World { today: IsoDay; now: Date; age: number | null; minor: boolean; consent: boolean; memoryOptOut: boolean; memoryStandup: boolean }

function memoryFlags(dataDir: string): { minor: boolean; optOut: boolean; standup: boolean } {
  const out = { minor: false, optOut: false, standup: false }
  try {
    const raw = JSON.parse(readFileSync(join(dataDir, 'memory.json'), 'utf8')) as { items?: unknown[] }
    for (const item of raw.items ?? []) {
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      if (row.status && row.status !== 'active') continue
      if (row.kind === 'condition' && Array.isArray(row.flags) && row.flags.includes('minor')) out.minor = true
      if (row.kind === 'preference' && row.key === 'codex_enabled' && row.value === false) out.optOut = true
      if (row.kind === 'preference' && row.key === 'nudge_in_workflow' && row.value === true) out.standup = true
    }
  } catch { /* memory is M0's file; missing is normal */ }
  return out
}

function worldOf(root: string, now: Date): World {
  const profile = readProfile(root)
  const minor = minorView(profile, now)
  const memory = memoryFlags(root)
  return {
    today: isoDay(now),
    now,
    age: minor.age,
    minor: minor.minor || memory.minor,
    consent: Boolean(profile.consent?.accepted_at),
    memoryOptOut: memory.optOut,
    memoryStandup: memory.standup,
  }
}

function blockOf(state: State, world: World): CodexBlock {
  const optOut = state.choice === 'off' || (state.choice == null && world.memoryOptOut)
  return codexBlock({ age: world.age, minorFlag: world.minor, optOut, configOn: runtime.codexOn() })
}

// ---- the person's data, from the cached series ---------------------------------

function lifeDays(state: State): Set<IsoDay> {
  return new Set(state.life.map((row) => row.day))
}

function isWeekend(day: IsoDay): boolean {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay()
  return weekday === 0 || weekday === 6
}

function runDays(run: ExperimentRun, through: IsoDay): IsoDay[] {
  const last = [run.extended_to ?? run.end, through].sort()[0] as IsoDay
  const out: IsoDay[] = []
  for (let day = run.start; day <= last; day = addDays(day, 1)) out.push(day)
  return out
}

function countable(run: ExperimentRun, state: State): (day: IsoDay) => boolean {
  const life = lifeDays(state)
  return (day) => !life.has(day) && (run.scope !== 'weekdays' || !isWeekend(day))
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] as number : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
}

/** Sleep onset, as distance from the window's own median (minutes): the regularity measure. */
function onsetSpread(series: Record<IsoDay, number> | undefined, days: IsoDay[]): Record<IsoDay, number> {
  const values = days.flatMap((day) => series?.[day] != null ? [{ day, value: series[day] as number }] : [])
  const mid = median(values.map((row) => row.value))
  if (mid == null) return {}
  return Object.fromEntries(values.map((row) => [row.day, Math.abs(row.value - mid)]))
}

function metricValues(key: MetricKey, cache: SeriesCache, days: IsoDay[]): Array<{ day: IsoDay; value: number }> {
  if (key === 'onset') {
    const spread = onsetSpread(cache.days.onset, days)
    return days.flatMap((day) => spread[day] != null ? [{ day, value: spread[day] as number }] : [])
  }
  const series = cache.days[key]
  return days.flatMap((day) => series?.[day] != null ? [{ day, value: series[day] as number }] : [])
}

function baselineDays(run: ExperimentRun): IsoDay[] {
  const out: IsoDay[] = []
  for (let day = run.baseline.from; day <= run.baseline.to; day = addDays(day, 1)) out.push(day)
  return out
}

/** 做到 days LongPi can see itself; check-ins add the ones the person ticked. */
function autoDone(run: ExperimentRun, state: State, cache: SeriesCache, days: IsoDay[]): Set<IsoDay> {
  const out = new Set<IsoDay>()
  const spec = experimentById(run.experiment_id)
  if (!spec) return out
  if (spec.adherence === 'standup') {
    const stood = standupDays(state.nudge)
    for (const day of days) if (stood.has(day)) out.add(day)
  } else if (spec.adherence === 'bp_reading') {
    for (const day of days) if (cache.days.sbp?.[day] != null) out.add(day)
  } else if (spec.adherence === 'sleep_longer') {
    const base = valuesIn(cache.days.sleep, run.baseline.from, run.baseline.to).map((row) => row.value)
    const avg = base.length ? base.reduce((a, b) => a + b, 0) / base.length : null
    if (avg != null) for (const day of days) if ((cache.days.sleep?.[day] ?? -1) >= avg + 0.33) out.add(day)
  } else if (spec.adherence === 'wake_fixed') {
    const key = run.variant === 'fixed-bed' ? 'onset' : 'wake'
    const series = cache.days[key]
    const target = median(valuesIn(series, run.baseline.from, run.baseline.to).map((row) => row.value))
    if (target != null) {
      for (const day of days) {
        const value = series?.[day]
        if (value == null) continue
        const tolerance = isWeekend(day) && run.scope !== 'weekdays' && run.variant !== 'fixed-bed' ? 60 : 30
        if (Math.abs(value - target) <= tolerance) out.add(day)
      }
    }
  }
  return out
}

function doneDays(run: ExperimentRun, state: State, cache: SeriesCache, days: IsoDay[]): Set<IsoDay> {
  const out = autoDone(run, state, cache, days)
  for (const day of run.done) if (days.includes(day)) out.add(day)
  return out
}

/** The 14 cells of the progress bar: d done, m missed, f future. */
function cells(run: ExperimentRun, state: State, cache: SeriesCache, today: IsoDay): Array<'d' | 'm' | 'f'> {
  const total = Math.min(14, daysBetween(run.start, run.end) + 1)
  const days = Array.from({ length: total }, (_, i) => addDays(run.start, Math.round(i * (daysBetween(run.start, run.end) + 1) / total)))
  const done = doneDays(run, state, cache, runDays(run, today))
  return days.map((day) => day >= today && !done.has(day) ? 'f' : done.has(day) ? 'd' : 'm')
}

// ---- judging a run -------------------------------------------------------------

function judgeRun(run: ExperimentRun, state: State, cache: SeriesCache, today: IsoDay, now: Date): RunResult {
  const { metrics } = loadCatalog()
  const keep = countable(run, state)
  const trialDays = runDays(run, addDays(today, -1)).filter(keep)
  const done = doneDays(run, state, cache, trialDays)
  const bv = biovar()
  const judged = (key: MetricKey, role: 'primary' | 'also') => {
    const metric = metrics[key]
    if (run.randomized && run.schedule) {
      const values = metricValues(key, cache, trialDays)
      const on = values.filter((row) => run.schedule?.[row.day] === true).map((row) => row.value)
      const off = values.filter((row) => run.schedule?.[row.day] === false).map((row) => row.value)
      return judgeMetric(metric, off, on, bv, { role, compare: 'off_on', minFirst: role === 'primary' ? 5 : 4, minSecond: role === 'primary' ? 5 : 4 })
    }
    const base = metricValues(key, cache, baselineDays(run).filter((day) => !lifeDays(state).has(day))).map((row) => row.value)
    const trial = metricValues(key, cache, trialDays).map((row) => row.value)
    // A run that measured 7 days first has those days as its baseline.
    const reference = run.baseline.from === addDays(run.start, -7) ? '你先量的 7 天里' : undefined
    return judgeMetric(metric, base, trial, bv, role === 'primary'
      ? { role, minFirst: metric.method === 'personal' ? MIN_BASELINE_DAYS : 3, minSecond: MIN_TRIAL_DAYS, reference }
      : { role, reference })
  }
  const primary = judged(run.primary, 'primary')
  const also = run.also.filter((key) => metrics[key] && metrics[key].method !== 'lab').map((key) => judged(key, 'also'))
  const effective = metricValues(run.primary, cache, trialDays).length
  const { how_zh: how, ...first } = primary
  return {
    outcome: primary.outcome,
    primary: first,
    also: also.map(({ how_zh: _how, ...rest }) => rest),
    done_days: done.size,
    done_zh: doneZh(done.size, trialDays.length),
    effective_days: effective,
    window_days: trialDays.length,
    how_zh: how,
    praise_zh: praiseZh(primary),
    at: now.toISOString() as IsoTime,
  }
}

function judgeLab(run: ExperimentRun, after: { value: number; date: IsoDay }, now: Date): RunResult {
  const { metrics } = loadCatalog()
  const metric = metrics[run.primary]
  const before = run.lab_before
  const judged = before ? judgeMetric(metric, [before.value], [after.value], biovar(), { role: 'primary', minFirst: 1, minSecond: 1 }) : judgeMetric(metric, [], [after.value], biovar(), { role: 'primary' })
  const { how_zh: how, ...first } = judged
  const text = before
    ? `主要结果 · ${metric.label_zh}：${before.value.toFixed(metric.decimals)} → ${after.value.toFixed(metric.decimals)} ${metric.unit_zh}，${judged.outcome === 'outside' ? '超出你的平时波动' : judged.outcome === 'inside' ? '在你的平时波动内' : '数据不够，没法判断'}。`
    : first.text_zh
  return {
    outcome: judged.outcome,
    primary: { ...first, text_zh: text },
    also: [],
    done_days: run.done.length,
    done_zh: doneZh(run.done.length, daysBetween(run.start, run.end) + 1),
    effective_days: 1,
    window_days: daysBetween(run.start, run.end) + 1,
    how_zh: how,
    praise_zh: praiseZh(judged),
    at: now.toISOString() as IsoTime,
  }
}

// ---- footprints and packs ------------------------------------------------------

const FOOTPRINT_TITLES: Record<FootprintKind, string> = {
  care_brief: '带着简报就诊',
  retest: '按时复测',
  addon: '补上一项检查',
  first_experiment: '做完第一个实验',
  season: '走完一个赛季',
  family: '陪家人复查',
}

function addFootprint(state: State, kind: FootprintKind, day: IsoDay, text: string, title?: string): void {
  const footprint: Footprint = { id: newId('fp'), kind, day, title_zh: title ?? FOOTPRINT_TITLES[kind], text_zh: text }
  state.footprints.push(footprint)
  emit('codex.footprint', { footprint_id: footprint.id, kind })
}

function grantPack(state: State, kind: Pack['kind'], day: IsoDay, source: string, results: ResultCard[] = []): Pack {
  const pack: Pack = { id: newId('pk'), kind, source_zh: source, granted: day, opened: null, options: [], chosen: null, results }
  state.packs.push(pack)
  emit('codex.pack_granted', { pack_id: pack.id, kind, source: kind === 'experiment' ? 'season_or_experiment' : 'retest' })
  return pack
}

function ensureSeed(state: State): void {
  if (!state.seed_hex) state.seed_hex = newId('')
}

function startSeason(state: State, day: IsoDay): void {
  const id = newId('sn')
  const end = addDays(day, (state.prefs.season_mode === 'retest' ? RETEST_SEASON_CAP_DAYS : SEASON_DAYS) - 1)
  state.season = { id, mode: state.prefs.season_mode, start: day, end, status: 'active', closed: null }
  state.seasons.push({ id, start: day, closed: null, runs: [] })
  grantPack(state, 'experiment', day, '赛季开始')
  emit('season.started', { season_id: id })
}

function closeSeason(state: State, day: IsoDay): void {
  const season = state.season
  if (!season || season.status === 'closed') return
  season.status = 'closed'
  season.closed = day
  const row = state.seasons.find((item) => item.id === season.id)
  if (row) row.closed = day
  const finished = state.runs.filter((run) => run.status === 'revealed' && run.start >= season.start).length
  addFootprint(state, 'season', day, finished > 0 ? `这个赛季走完了，一共做了 ${finished} 个实验。` : '这个赛季走完了。')
  emit('season.ended', { season_id: season.id, experiments_done: finished })
}

function resultCards(context: CodexContext): ResultCard[] {
  const out: ResultCard[] = []
  const bio = context.results.bioage
  if (bio) {
    const diff = bio.prev != null ? bio.now - bio.prev : null
    const beyond = diff != null && bio.band != null && Math.abs(diff) > bio.band
    out.push({
      id: newId('rc'),
      key: 'bioage',
      title_zh: '表型年龄（用 9 项化验算的生物年龄）',
      value_zh: `${bio.now.toFixed(1)} 岁`,
      compare_zh: bio.prev == null ? '第一次算出这一项。' : `和上次（${bio.prev_date ?? ''}）比：${bio.prev.toFixed(1)} → ${bio.now.toFixed(1)} 岁，${beyond ? OUTCOME_ZH.outside : OUTCOME_ZH.inside}。`,
      outcome: bio.prev == null ? null : beyond ? 'outside' : 'inside',
      tier: 'human',
      plain: diff != null && diff > 0,
      note_zh: null,
    })
  }
  const risk = context.results.risk
  if (risk) {
    out.push({
      id: newId('rc'),
      key: 'risk',
      title_zh: '十年心血管风险（China-PAR）',
      value_zh: risk.applicable && risk.pct != null ? `${risk.pct.toFixed(1)}%` : null,
      compare_zh: risk.applicable && risk.pct != null ? `${risk.category_zh || '本次的估算'}。` : risk.reason_zh,
      outcome: null,
      tier: 'human',
      plain: true,
      note_zh: risk.applicable ? null : risk.reason_zh,
    })
  }
  for (const change of context.results.changes.filter((row) => !row.ask_doctor).slice(0, 4)) {
    out.push({
      id: newId('rc'),
      key: change.key,
      title_zh: change.label_zh,
      value_zh: `${change.to} ${change.unit}`,
      compare_zh: `和上次（${change.from_date}）比：${change.from} → ${change.to} ${change.unit}，${change.beyond ? OUTCOME_ZH.outside : OUTCOME_ZH.inside}。`,
      outcome: change.beyond ? 'outside' : 'inside',
      tier: 'human' as Tier,
      plain: change.verdict !== 'better',
      note_zh: null,
    })
  }
  return out
}

function seasonExperimentIds(state: State, back: number): Set<string> {
  const seasons = state.seasons.slice(-back)
  const starts = seasons.map((row) => row.start).sort()
  const from = starts[0] ?? '0000-00-00'
  return new Set(state.runs.filter((run) => run.start >= from && run.status !== 'stopped').map((run) => run.experiment_id))
}

function eligibilityContext(state: State, today: IsoDay, cache: SeriesCache): EligibilityContext {
  const ctx = state.context
  const retestIn8to12 = ctx.retests.some((row) => {
    const gap = daysBetween(today, row.date)
    return gap >= 56 && gap <= 84
  })
  return {
    today,
    drugClasses: new Set(ctx.drug_classes),
    conditions: new Set(ctx.conditions),
    pregnant: ctx.pregnant,
    openFindings: new Set(ctx.open_findings),
    series: cache,
    ldlOnFile: Boolean(ctx.ldl),
    retestIn8to12Weeks: retestIn8to12,
    personalText: ctx.personal_text,
    focus: new Set(ctx.focus),
    standupOn: state.nudge.standup === 'on',
    recent: seasonExperimentIds(state, 2),
    running: new Set(state.runs.filter((run) => run.status === 'running' || run.status === 'retest_wait').map((run) => run.experiment_id)),
  }
}

// ---- the reducer ---------------------------------------------------------------

function reduce(state: State, world: World, cache: SeriesCache): void {
  const today = world.today
  if (!world.consent || blockOf(state, world) || !state.started) return
  ensureSeed(state)
  const ctx = state.context
  // A season: 8 weeks, or until the next retest (capped).
  if (!state.season) startSeason(state, today)
  const season = state.season
  if (season && season.status === 'active' && today > season.end) closeSeason(state, today)
  // A new checkup of the holder: a retest pack and a footprint; a season in retest mode ends with it.
  const latest = ctx.latest_checkup
  if (latest && !state.seen.checkups.includes(latest)) {
    const first = state.seen.checkups.length === 0
    state.seen.checkups.push(latest)
    // Any checkup that arrives after the Codex started counts, the very first one included.
    if (state.started && latest >= state.started) {
      const results = resultCards(ctx)
      for (const run of state.runs) {
        if (run.status !== 'retest_wait' || !ctx.ldl || ctx.ldl.date < addDays(run.start, 42)) continue
        run.result = judgeLab(run, ctx.ldl, world.now)
        run.status = 'ready'
        results.unshift({ id: newId('rc'), key: `run:${run.id}`, title_zh: run.title_zh, value_zh: null, compare_zh: run.result.primary.text_zh, outcome: run.result.outcome, tier: 'human', plain: run.result.primary.direction !== 'better', note_zh: null })
      }
      grantPack(state, 'retest', today, first ? '第一次体检的结果到了' : '新的体检结果到了', results)
      const due = ctx.retests.some((row) => Math.abs(daysBetween(row.date, latest)) <= 30)
      addFootprint(state, 'retest', today, due ? '到了该复查的时候，按时去复查了。' : '做了一次复查，新的结果进了档案。', due ? '按时复测' : '做了一次复查')
      if (state.season?.status === 'active' && state.season.mode === 'retest') closeSeason(state, today)
    }
  }
  // Footprints from the holder's own care visits (with a brief) and add-on tests.
  for (const item of careItems(boundRootDir())) {
    if (item.care_status !== 'visited' || !item.brief_id || state.seen.care.includes(item.id)) continue
    state.seen.care.push(item.id)
    if (!state.footprints.some((row) => row.kind === 'care_brief')) addFootprint(state, 'care_brief', item.visit_date ?? today, '拿着整理好的问题去见了医生。')
  }
  for (const key of ['hscrp', 'waist'] as const) {
    if (ctx.labs[key] && !state.seen.labs[key]) {
      state.seen.labs[key] = true
      addFootprint(state, 'addon', today, key === 'hscrp' ? '补查了超敏 C 反应蛋白。' : '量了腰围，这一项补上了。')
    }
  }
  // Experiments: a 14-day run becomes ready when 10 days had data; else it runs on for up to 7 more days.
  const { metrics } = loadCatalog()
  for (const run of state.runs) {
    if (run.status !== 'running') continue
    if (metrics[run.primary]?.method === 'lab') {
      if (today > run.end) run.status = 'retest_wait'
      continue
    }
    if (today <= run.end) continue
    const keep = countable(run, state)
    const effective = metricValues(run.primary, cache, runDays(run, addDays(today, -1)).filter(keep)).length
    const hardEnd = addDays(run.end, EXTEND_DAYS)
    if (effective >= MIN_TRIAL_DAYS || run.randomized || today > hardEnd) {
      run.result = judgeRun(run, state, cache, today, world.now)
      run.status = 'ready'
    } else if (!run.extended_to) {
      run.extended_to = hardEnd
    }
  }
}

// ---- views ---------------------------------------------------------------------

export interface ExperimentOption {
  id: string
  title_zh: string
  do_zh: string
  icon: ExperimentSpec['icon']
  days: number
  primary_zh: string
  also_zh: string[]
  randomizable: boolean
  questions: Array<{ id: string; text_zh: string }>
  source_zh: string
  needs_retest: boolean
  /** 7 days of measuring first, because the two weeks before have too few readings. */
  lead_in: boolean
}

export interface RunView {
  id: string
  experiment_id: string
  title_zh: string
  do_zh: string
  icon: ExperimentSpec['icon']
  checkin_zh: string
  start: IsoDay
  end: IsoDay
  extended_to: IsoDay | null
  day: number
  days: number
  cells: Array<'d' | 'm' | 'f'>
  done_today: boolean
  done_count: number
  status: ExperimentRun['status']
  randomized: boolean
  today_zh: string | null
  threshold_zh: string
  primary_zh: string
  progress_zh: string
  result: RunResult | null
  /** Today, for the folded pane's line. */
  today_day: IsoDay
}

export interface CodexView {
  ok: true
  today: IsoDay
  needs_consent: boolean
  enabled: boolean
  reason: CodexBlock
  reason_zh: string
  member: null | { label_zh: string; note_zh: string }
  started: boolean
  intro: { my_day: { start: string; end: string }; season_mode: '8w' | 'retest'; standup: boolean; wristband: boolean }
  season: null | { id: string; mode: '8w' | 'retest'; start: IsoDay; end: IsoDay; week: number; weeks: number; status: 'active' | 'closed' }
  packs: Array<{ id: string; kind: Pack['kind']; source_zh: string; granted: IsoDay; opened: IsoDay | null; options: ExperimentOption[]; results: ResultCard[]; empty_zh: string | null }>
  reserve: ExperimentOption[]
  running: RunView[]
  ready: RunView[]
  deck: RunView[]
  library: { size: number; read: number; pending: number; chapters: Array<{ id: string; no: number; title_zh: string; size: number; read: number }> }
  species: { met: number; total: number }
  footprints: Footprint[]
  footprints_note_zh: string
  prefs: { simple: boolean; presentation: boolean; my_day: { start: string; end: string }; season_mode: '8w' | 'retest'; standup: boolean }
  devices: { wristband: boolean; bp_cuff: boolean; scale: boolean }
  slot: SlotView
  /** The page's in-flow line: 「饭后走 10 分钟 · 第 9/14 天」. No result, no metric value. */
  pane_zh: string | null
  /** The folded pane's line: no experiment name either (a name like 降脂 or 量血压 says too much on a shared screen). */
  pane_neutral_zh: string | null
  rules_zh: string[]
}

const RULES_ZH = [
  '长寿图鉴免费，没有付费，不能交易。',
  '未满 18 岁不开放，可以随时关闭。',
  '卡包只来自真实发生的事：赛季开始、做完一个实验、你自己复查。',
  '颜色表示研究是怎么做的，不表示和你多相关。',
  '结果只用三种说法：「超出平时波动」「在平时波动内」「数据不够」。',
]

function optionOf(spec: ExperimentSpec, primary: MetricKey | null, leadIn = false): ExperimentOption {
  const { metrics } = loadCatalog()
  const main = primary ?? spec.primary[0]
  const also = [...spec.primary.filter((key) => key !== main), ...spec.also].filter((key, i, all) => all.indexOf(key) === i)
  return {
    id: spec.id,
    title_zh: spec.title_zh,
    do_zh: spec.do_zh,
    icon: spec.icon,
    days: spec.days,
    primary_zh: main ? metrics[main]?.label_zh ?? '' : '',
    also_zh: also.map((key) => metrics[key]?.label_zh ?? '').filter(Boolean),
    randomizable: spec.randomizable,
    questions: spec.questions.map((row) => ({ id: row.id, text_zh: row.text_zh })),
    source_zh: spec.source_zh,
    needs_retest: Boolean(spec.retest_markers?.length) && spec.days > 14,
    lead_in: leadIn,
  }
}

function runView(run: ExperimentRun, state: State, cache: SeriesCache, today: IsoDay): RunView {
  const { metrics } = loadCatalog()
  const total = daysBetween(run.start, run.end) + 1
  const day = Math.min(total, Math.max(1, daysBetween(run.start, today) + 1))
  const done = doneDays(run, state, cache, runDays(run, today))
  const assignment = run.randomized && run.schedule ? run.schedule[today] : undefined
  const waiting = run.status === 'retest_wait'
  return {
    id: run.id,
    experiment_id: run.experiment_id,
    title_zh: run.title_zh,
    do_zh: run.do_zh,
    icon: run.icon,
    checkin_zh: run.checkin_zh,
    start: run.start,
    end: run.end,
    extended_to: run.extended_to,
    day,
    days: total,
    cells: cells(run, state, cache, today),
    done_today: done.has(today),
    done_count: done.size,
    status: run.status,
    randomized: run.randomized,
    today_zh: assignment === undefined ? null : assignment ? '今天：做' : '今天：不做（照常生活）',
    threshold_zh: run.threshold_zh,
    primary_zh: metrics[run.primary]?.label_zh ?? '',
    progress_zh: waiting ? `${run.title_zh} · 等复查` : run.status === 'ready' ? `${run.title_zh} · 可以翻了`
      : today < run.start ? `${run.title_zh} · 先量 7 天 · 第 ${Math.max(1, daysBetween(run.baseline.from, today) + 1)}/7 天`
        : `${run.title_zh} · 第 ${day}/${total} 天`,
    result: run.status === 'revealed' ? run.result : null,
    today_day: today,
  }
}

function libraryCounts(state: State): CodexView['library'] {
  const lib = loadLibrary()
  return {
    size: lib.studies.length,
    read: lib.studies.filter((card) => state.read[card.id]).length,
    pending: lib.pending.length,
    chapters: lib.chapters.map((chapter) => ({
      id: chapter.id,
      no: chapter.no,
      title_zh: chapter.title_zh,
      size: lib.studies.filter((card) => card.chapter === chapter.id).length,
      read: lib.studies.filter((card) => card.chapter === chapter.id && state.read[card.id]).length,
    })),
  }
}

function memberNote(): CodexView['member'] {
  const root = boundRootDir()
  const active = runtime.dataDir()
  if (!root || !active || active === root) return null
  let label = '家人'
  try {
    const reg = JSON.parse(readFileSync(join(root, 'people.json'), 'utf8')) as { active?: string; people?: Array<{ id: string; label_zh?: string }> }
    label = reg.people?.find((row) => row.id === reg.active)?.label_zh || label
  } catch { /* the default label */ }
  return { label_zh: label, note_zh: `长寿图鉴是你自己的。陪${label}看医生或复查，会记一张足迹卡。` }
}

function viewOf(state: State, world: World, cache: SeriesCache): CodexView {
  const block = blockOf(state, world)
  const today = world.today
  const have = devices(cache, today)
  const ctx = eligibilityContext(state, today, cache)
  const options = (ids: string[]) => ids.flatMap((id) => {
    const spec = experimentById(id)
    if (!spec) return []
    const ready = primaryFor(spec, ctx)
    return [optionOf(spec, ready ?? leadInFor(spec, ctx), !ready && Boolean(leadInFor(spec, ctx)))]
  })
  const runs = state.runs.map((run) => runView(run, state, cache, today))
  const season = state.season
  const ready = runs.filter((run) => run.status === 'ready')
  const packsReady = state.packs.filter((pack) => pack.kind === 'retest' && !pack.opened)
  const slot = slotView({
    now: world.now,
    enabled: !block && Boolean(state.started),
    wristband: have.wristband,
    presentation: state.prefs.presentation,
    myDay: state.prefs.my_day,
    nudge: state.nudge,
    ready: [
      ...state.runs.filter((run) => run.status === 'ready').map((run) => ({ ref: run.id, since: run.result?.at?.slice(0, 10) ?? today })),
      ...packsReady.map((pack) => ({ ref: pack.id, since: pack.granted })),
    ],
  })
  const active = runs.filter((run) => run.status === 'running' || run.status === 'retest_wait' || run.status === 'ready')
  const shown = !block && world.consent
  return {
    ok: true,
    today,
    needs_consent: !world.consent,
    enabled: shown,
    reason: block,
    reason_zh: !world.consent ? '先完成使用说明里的同意，再打开长寿图鉴。' : codexBlockZh(block),
    member: memberNote(),
    started: Boolean(state.started),
    intro: { my_day: { start: state.prefs.my_day.start, end: state.prefs.my_day.end }, season_mode: state.prefs.season_mode, standup: state.nudge.standup === 'on', wristband: have.wristband },
    season: shown && season ? {
      id: season.id,
      mode: season.mode,
      start: season.start,
      end: season.end,
      week: Math.min(Math.ceil((daysBetween(season.start, season.end) + 1) / 7), Math.floor(daysBetween(season.start, today) / 7) + 1),
      weeks: Math.ceil((daysBetween(season.start, season.end) + 1) / 7),
      status: season.status,
    } : null,
    packs: shown ? state.packs.filter((pack) => !pack.opened || (pack.kind === 'experiment' && !pack.chosen)).map((pack) => ({
      id: pack.id,
      kind: pack.kind,
      source_zh: pack.source_zh,
      granted: pack.granted,
      opened: pack.opened,
      options: pack.opened ? options(pack.options) : [],
      results: pack.opened ? pack.results : [],
      empty_zh: pack.opened && pack.kind === 'experiment' && pack.options.length === 0 ? emptyPackZh(ctx) : null,
    })) : [],
    reserve: shown ? options(state.reserve.filter((id) => {
      const spec = experimentById(id)
      return spec ? !blockedBy(spec, ctx) : false
    })) : [],
    running: shown ? active.filter((run) => run.status !== 'ready') : [],
    ready: shown ? ready : [],
    deck: shown ? runs.filter((run) => run.status === 'revealed').reverse() : [],
    library: libraryCounts(state),
    species: { met: Object.keys(state.met).length, total: loadLibrary().species.length },
    footprints: shown ? [...state.footprints].reverse() : [],
    footprints_note_zh: FOOTPRINT_NOTE_ZH,
    prefs: { simple: state.prefs.simple, presentation: state.prefs.presentation, my_day: { start: state.prefs.my_day.start, end: state.prefs.my_day.end }, season_mode: state.prefs.season_mode, standup: state.nudge.standup === 'on' },
    devices: have,
    slot,
    pane_zh: shown && active.length > 0 ? active.map((run) => run.progress_zh).join('；') : null,
    pane_neutral_zh: shown ? neutralLine(active) : null,
    rules_zh: RULES_ZH,
  }
}

function neutralLine(active: RunView[]): string | null {
  if (active.length === 0) return null
  const ready = active.filter((run) => run.status === 'ready').length
  const running = active.filter((run) => run.status === 'running')
  const parts: string[] = []
  if (running.length === 1) parts.push(running[0]!.start > running[0]!.today_day ? '1 个实验正在量对照' : `1 个实验进行中 · 第 ${running[0]!.day}/${running[0]!.days} 天`)
  else if (running.length > 1) parts.push(`${running.length} 个实验进行中`)
  if (ready > 0) parts.push('有一张卡可以翻了')
  if (active.some((run) => run.status === 'retest_wait')) parts.push('1 个实验等复查')
  return parts.join(' · ') || null
}

function emptyPackZh(ctx: EligibilityContext): string {
  const have = devices(ctx.series, ctx.today)
  if (ctx.pregnant) return '孕期不出现实验。图书馆照常可以读。'
  if (!have.wristband && !have.bp_cuff && !have.scale) return '实验要用手环、血压计或体重秤的数据来看结果，现在还没有。把 Apple 健康的导出（iPhone「健康」→ 头像 → 导出所有健康数据）或其他手环的导出文件交给 Claude，这个包里就会有实验。包会一直留着。'
  return '现在没有适合你的实验。包会一直留着，数据多了再来拆。'
}

// ---- reading and acting --------------------------------------------------------

function load(now: Date): { root: string; state: State; world: World; cache: SeriesCache } {
  const root = boundRootDir()
  const world = worldOf(root, now)
  const state = root ? readState(root, now, world.today) : emptyState()
  const cache = readSeriesCache(root)
  return { root, state, world, cache }
}

export function syncCodex(now: Date = new Date()): CodexView {
  const { root, state, world, cache } = load(now)
  if (!root) return viewOf(state, world, cache)
  reduce(state, world, cache)
  saveState(root, state)
  return viewOf(state, world, cache)
}

export type CodexAction =
  | { action: 'start'; my_day?: { start?: string; end?: string }; season_mode?: '8w' | 'retest'; standup?: boolean }
  | { action: 'prefs'; simple?: boolean; presentation?: boolean; my_day?: { start?: string; end?: string }; season_mode?: '8w' | 'retest'; standup?: boolean; codex?: boolean }
  | { action: 'open_pack'; pack_id: string }
  | { action: 'begin'; experiment_id: string; pack_id?: string; answers?: Record<string, boolean>; randomized?: boolean }
  | { action: 'checkin'; run_id: string; done?: boolean }
  | { action: 'reveal'; run_id: string }
  | { action: 'stop'; run_id: string }
  | { action: 'read'; card_id: string }
  | { action: 'next_season' }
  | { action: 'nudge'; event: 'shown' | 'ok' | 'dismiss_today' | 'reveal_shown' | 'reveal_later' | 'reveal_open'; ref?: string }

export interface ActResult { ok: boolean; error?: string; note_zh?: string; met?: string[]; run?: RunView; pack?: { id: string; kind: Pack['kind']; source_zh: string; results: ResultCard[] }; view: CodexView }

function setMyDay(state: State, input: { start?: string; end?: string } | undefined): void {
  if (!input) return
  if (validClock(input.start)) state.prefs.my_day.start = input.start
  if (validClock(input.end)) state.prefs.my_day.end = input.end
  state.prefs.my_day.asked = true
}

export function actCodex(input: CodexAction, now: Date = new Date()): ActResult {
  const { root, state, world, cache } = load(now)
  const done = (extra: Partial<ActResult> = {}): ActResult => {
    reduce(state, world, cache)
    if (root) saveState(root, state)
    return { ok: true, ...extra, view: viewOf(state, world, cache) }
  }
  const fail = (error: string): ActResult => ({ ok: false, error, view: viewOf(state, world, cache) })
  if (!root) return fail('还没有 LongPi 档案。')
  if (input.action === 'prefs') {
    if (typeof input.codex === 'boolean') state.choice = input.codex ? 'on' : 'off'
    if (typeof input.simple === 'boolean') state.prefs.simple = input.simple
    if (typeof input.presentation === 'boolean') state.prefs.presentation = input.presentation
    if (input.season_mode === '8w' || input.season_mode === 'retest') state.prefs.season_mode = input.season_mode
    if (typeof input.standup === 'boolean') state.nudge.standup = input.standup ? 'on' : 'off'
    setMyDay(state, input.my_day)
    return done()
  }
  if (input.action === 'nudge') return nudgeEvent(state, input, now, done)
  if (!world.consent) return fail('先完成使用说明里的同意，再打开长寿图鉴。')
  const block = blockOf(state, world)
  if (block) return fail(codexBlockZh(block))
  if (input.action === 'start') {
    setMyDay(state, input.my_day ?? DEFAULT_MY_DAY)
    if (input.season_mode === '8w' || input.season_mode === 'retest') state.prefs.season_mode = input.season_mode
    state.nudge.standup = input.standup === true ? 'on' : input.standup === false ? 'off' : (world.memoryStandup ? 'on' : 'off')
    if (!state.started) {
      state.started = world.today
      state.pressure = 'on'
      if (state.context.latest_checkup && !state.seen.checkups.includes(state.context.latest_checkup)) state.seen.checkups.push(state.context.latest_checkup)
      state.seen.labs = { ...state.context.labs }
      state.seen.care = careItems(root).map((item) => item.id)
    }
    return done()
  }
  if (!state.started) return fail('先打开长寿图鉴，回答两个小问题。')
  if (input.action === 'read') {
    const card = studyById(input.card_id)
    if (!card || card.id !== input.card_id) return fail('没有这张卡。')
    const met: string[] = []
    if (!state.read[card.id]) state.read[card.id] = world.today
    for (const key of card.meet) {
      if (!state.met[key]) { state.met[key] = world.today; met.push(key) }
    }
    return done({ met })
  }
  if (input.action === 'next_season') {
    if (state.season?.status !== 'closed') return fail('这个赛季还没有结束。')
    state.season = null
    return done()
  }
  if (input.action === 'open_pack') {
    const pack = state.packs.find((row) => row.id === input.pack_id)
    if (!pack) return fail('没有这个包。')
    if (pack.kind === 'experiment' && (!pack.opened || pack.options.length === 0)) {
      const candidates = eligible(eligibilityContext(state, world.today, cache))
      pack.options = pickThree(candidates, `${state.seed_hex}:${pack.id}`, new Set(state.reserve))
      if (pack.options.length === 0) {
        pack.opened = null
        reduce(state, world, cache)
        saveState(root, state)
        return { ok: true, note_zh: emptyPackZh(eligibilityContext(state, world.today, cache)), view: viewOf(state, world, cache) }
      }
    }
    pack.opened = pack.opened ?? world.today
    if (pack.kind === 'retest') {
      state.nudge.reveal[pack.id] = { first: state.nudge.reveal[pack.id]?.first ?? world.today, later: null, done: true }
      for (const card of pack.results) {
        const runId = card.key.startsWith('run:') ? card.key.slice(4) : null
        const run = runId ? state.runs.find((row) => row.id === runId) : null
        if (run && run.status === 'ready') revealRun(state, run, world)
      }
      return done({ pack: { id: pack.id, kind: pack.kind, source_zh: pack.source_zh, results: pack.results } })
    }
    return done()
  }
  if (input.action === 'begin') return begin(state, world, cache, input, done, fail)
  const run = 'run_id' in input ? state.runs.find((row) => row.id === input.run_id) : undefined
  if (!run) return fail('没有这个实验。')
  if (input.action === 'checkin') {
    if (run.status !== 'running' || world.today < run.start || world.today > (run.extended_to ?? run.end)) return fail('这个实验今天不能打卡。')
    const on = input.done !== false
    run.done = on ? [...new Set([...run.done, world.today])] : run.done.filter((day) => day !== world.today)
    return done()
  }
  if (input.action === 'stop') {
    if (run.status !== 'running' && run.status !== 'retest_wait') return fail('这个实验已经结束。')
    run.status = 'stopped'
    return done({ note_zh: '已停下，不算失败，也不扣任何东西。' })
  }
  if (input.action === 'reveal') {
    if (run.status !== 'ready') return fail(run.status === 'revealed' ? '这张卡已经翻开了。' : '还没到揭晓的时候。')
    revealRun(state, run, world)
    return done({ run: runView(run, state, cache, world.today) })
  }
  return fail('不能识别的操作。')
}

function revealRun(state: State, run: ExperimentRun, world: World): void {
  run.status = 'revealed'
  run.revealed_at = world.now.toISOString() as IsoTime
  state.nudge.reveal[run.id] = { first: state.nudge.reveal[run.id]?.first ?? world.today, later: null, done: true }
  emit('codex.experiment_revealed', { run_id: run.id, experiment_id: run.experiment_id, outcome: run.result?.outcome ?? 'insufficient' })
  if (state.runs.filter((row) => row.status === 'revealed').length === 1) addFootprint(state, 'first_experiment', world.today, `做完了第一个小实验：${run.title_zh}。`)
  if (state.season?.status === 'active') grantPack(state, 'experiment', world.today, `做完「${run.title_zh}」`)
}

function begin(state: State, world: World, cache: SeriesCache, input: Extract<CodexAction, { action: 'begin' }>, done: (extra?: Partial<ActResult>) => ActResult, fail: (error: string) => ActResult): ActResult {
  const pack = input.pack_id ? state.packs.find((row) => row.id === input.pack_id) : null
  const fromPack = pack && pack.opened && pack.options.includes(input.experiment_id)
  const fromReserve = state.reserve.includes(input.experiment_id)
  if (!fromPack && !fromReserve) return fail('只能从拆开的实验包或待选里开始。')
  if (state.runs.filter((run) => run.status === 'running').length >= MAX_RUNNING) return fail('同时最多做 2 个实验。先做完一个，或者停下一个。')
  let spec = experimentById(input.experiment_id)
  if (!spec) return fail('没有这个实验。')
  const answers = input.answers ?? {}
  let variant: string | null = null
  for (const question of spec.questions) {
    if (answers[question.id] !== true) continue
    if (question.yes.swap) {
      const swapped = experimentById(question.yes.swap)
      if (swapped) { spec = swapped; break }
    }
    if (question.yes.variant && !variant) variant = question.yes.variant
  }
  const ctx = eligibilityContext(state, world.today, cache)
  const blocked = blockedBy(spec, ctx)
  if (blocked) return fail(blocked === 'no_data' ? '这个实验要用到开始前两周的数据，现在还不够。' : '这个实验现在不适合你。')
  const ready = primaryFor(spec, ctx)
  const primary = (ready ?? leadInFor(spec, ctx)) as MetricKey
  const leadIn = !ready
  const { metrics } = loadCatalog()
  const randomized = input.randomized === true && spec.randomizable
  const days = spec.days
  // Too few readings before today: measure for 7 days first; those days are the baseline.
  const start = leadIn ? addDays(world.today, 7) : world.today
  const v = variant ? spec.variants[variant] : null
  const run: ExperimentRun = {
    id: newId('rn'),
    experiment_id: spec.id,
    variant,
    title_zh: v?.title_zh ?? spec.title_zh,
    do_zh: v?.do_zh ?? spec.do_zh,
    checkin_zh: spec.checkin_zh,
    icon: spec.icon,
    primary,
    also: [...spec.primary.filter((key) => key !== primary), ...spec.also].filter((key, i, all) => all.indexOf(key) === i && key !== primary),
    threshold_zh: thresholdZh(metrics[primary], biovar(), { randomized, lab: metrics[primary].method === 'lab', leadIn }),
    start,
    end: addDays(start, days - 1),
    extended_to: null,
    baseline: leadIn ? { from: world.today, to: addDays(world.today, 6) } : { from: addDays(start, -14), to: addDays(start, -1) },
    randomized,
    schedule: randomized ? randomSchedule(start, days, `${state.seed_hex}:${start}:${spec.id}`) : null,
    scope: v?.scope === 'weekdays' ? 'weekdays' : 'all',
    answers,
    done: [],
    lab_before: metrics[primary].method === 'lab' ? state.context.ldl : null,
    status: 'running',
    result: null,
    revealed_at: null,
  }
  state.runs.push(run)
  const season = state.seasons.find((row) => row.id === state.season?.id)
  if (season) season.runs.push(run.id)
  if (fromPack && pack) {
    pack.chosen = input.experiment_id
    for (const other of pack.options) if (other !== input.experiment_id && !state.reserve.includes(other)) state.reserve.push(other)
  }
  state.reserve = state.reserve.filter((id) => id !== input.experiment_id && id !== spec!.id).slice(-6)
  emit('codex.experiment_started', { run_id: run.id, experiment_id: spec.id, randomized })
  const notes = [
    spec.id !== input.experiment_id ? `按你的回答，换成了「${spec.title_zh}」。` : '',
    leadIn ? '开始前两周量得还不多，先量 7 天当对照，再开始这 14 天。' : '',
  ].filter(Boolean).join('')
  return done({ run: runView(run, state, cache, world.today), note_zh: notes || undefined })
}

function nudgeEvent(state: State, input: Extract<CodexAction, { action: 'nudge' }>, now: Date, done: (extra?: Partial<ActResult>) => ActResult): ActResult {
  const today = isoDay(now)
  if (input.event === 'shown') {
    state.nudge.shown.push({ at: now.toISOString() as IsoTime, kind: 'standup' })
    emit('nudge.shown', { nudge_id: newId('ng'), where: 'overlay', kind: 'standup' })
  } else if (input.event === 'ok') {
    state.nudge.acks.push({ at: now.toISOString() as IsoTime, status: 'pending' })
  } else if (input.event === 'dismiss_today') {
    state.nudge.dismissed_day = today
  } else if (input.event === 'reveal_shown' && input.ref) {
    markRevealShown(state.nudge, input.ref, now)
    emit('nudge.shown', { nudge_id: newId('ng'), where: 'overlay', kind: 'reveal' })
  } else if (input.event === 'reveal_later' && input.ref) {
    laterReveal(state.nudge, input.ref, today)
  } else if (input.event === 'reveal_open' && input.ref) {
    const prev = state.nudge.reveal[input.ref]
    state.nudge.reveal[input.ref] = { first: prev?.first ?? today, later: null, done: true }
  }
  return done()
}

// ---- seams for the rest of LongPi ---------------------------------------------

/** From the journey: what the Codex needs of the holder's record, or a family member's visits and checkups. */
export function noteCodexContext(dataDir: string, context: Omit<CodexContext, 'at'> & { care_visits?: Array<{ id: string; date: IsoDay | null; with_brief: boolean }> }, now: Date = new Date()): void {
  const root = boundRootDir()
  if (!root || !dataDir) return
  const world = worldOf(root, now)
  const state = readState(root, now, world.today)
  if (dataDir !== root) {
    // A family member: footprints only, never a pack.
    const member = memberNote()
    const label = member?.label_zh ?? '家人'
    let changed = false
    const memberId = dataDir.split('/').filter(Boolean).at(-1) ?? 'member'
    if (state.started && !blockOf(state, world)) {
      for (const visit of context.care_visits ?? []) {
        const key = `${memberId}:care:${visit.id}`
        if (!visit.with_brief || state.seen.member.includes(key)) continue
        state.seen.member.push(key)
        if ((visit.date ?? world.today) >= state.started) addFootprint(state, 'family', visit.date ?? world.today, `带着简报陪${label}看了医生。`, `陪${label}复查`)
        changed = true
      }
      if (context.latest_checkup) {
        const key = `${memberId}:checkup:${context.latest_checkup}`
        const known = state.seen.member.some((row) => row.startsWith(`${memberId}:checkup:`))
        if (!state.seen.member.includes(key)) {
          state.seen.member.push(key)
          if (known && context.latest_checkup >= state.started) addFootprint(state, 'family', world.today, `${label}的新检查结果进了档案。`, `陪${label}复查`)
          changed = true
        }
      }
    }
    if (changed) saveState(root, state)
    return
  }
  const { care_visits: _visits, ...rest } = context
  state.context = { ...rest, at: now.toISOString() as IsoTime }
  if (!state.started) {
    // Before the first open, remember what is already on file so nothing back-dated becomes a pack or footprint.
    if (context.latest_checkup && !state.seen.checkups.includes(context.latest_checkup)) state.seen.checkups.push(context.latest_checkup)
    state.seen.labs = { ...context.labs }
  }
  reduce(state, world, readSeriesCache(root))
  saveState(root, state)
}

/** A sick or travel day: not an experiment day, never a failure. */
export function logLifeCodex(input: { event: string; from: IsoDay; to: IsoDay | null }, now: Date = new Date()): { ok: boolean; error?: string; days: IsoDay[] } {
  const root = boundRootDir()
  if (!root) return { ok: false, error: '还没有 LongPi 档案。', days: [] }
  const to = input.to ?? input.from
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < input.from) return { ok: false, error: '日期格式须为 YYYY-MM-DD，且结束日期不早于开始日期。', days: [] }
  if (daysBetween(input.from, to) > 13) return { ok: false, error: '一次最多记 14 天。', days: [] }
  const world = worldOf(root, now)
  const state = readState(root, now, world.today)
  const days: IsoDay[] = []
  for (let day = input.from; day <= to; day = addDays(day, 1)) {
    if (day > world.today) break
    if (!state.life.some((row) => row.day === day)) { state.life.push({ day, reason: input.event }); days.push(day) }
  }
  state.life = state.life.slice(-120)
  saveState(root, state)
  emit('life_event.logged', { memory_id: newId('lf'), event: input.event as HealthEventPayloads['life_event.logged']['event'], from: input.from, to: input.to })
  return { ok: true, days }
}

export function engagementSummary(): FactPack['engagement'] {
  try {
    const view = syncCodex(new Date())
    if (!view.enabled || !view.started) return null
    return {
      season_week: view.season?.week ?? null,
      season_weeks: view.season?.weeks ?? null,
      experiments_running: view.running.map((run) => run.title_zh),
      reveal_ready: view.ready.length > 0 || view.packs.some((pack) => pack.kind === 'retest'),
      packs_waiting: view.packs.length,
    }
  } catch {
    return null
  }
}

export function candidateSeeds(now: Date = new Date()): Array<{ id: string; kind: ActionKind; priority: number; title_zh: string; detail_zh: string; prompt_zh: string }> {
  let view: CodexView
  try { view = syncCodex(now) } catch { return [] }
  if (!view.enabled || !view.started) return []
  const out: Array<{ id: string; kind: ActionKind; priority: number; title_zh: string; detail_zh: string; prompt_zh: string }> = []
  if (view.ready.length > 0 || view.packs.some((pack) => pack.kind === 'retest')) {
    out.push({ id: 'nba-codex-reveal', kind: 'codex_reveal', priority: 40, title_zh: '有一张实验卡可以翻了', detail_zh: '在长寿图鉴里翻开它。', prompt_zh: '我的实验结果出来了吗？' })
  }
  if (view.packs.some((pack) => pack.kind === 'experiment' && !pack.opened)) {
    out.push({ id: 'nba-codex-pack', kind: 'codex_experiment', priority: 30, title_zh: '有一个实验包可以拆', detail_zh: '三选一，挑一个两周的小实验。', prompt_zh: '长寿图鉴里的三个实验，哪个适合我？' })
  }
  return out
}

/** The weekly plain reminder had season quests; the Codex sends no reminders of its own (design §2). */
export function plainReminderOf(_dataDir: string): string | null {
  return null
}

/**
 * After a journey build of the holder: re-read the daily series the experiments are judged on, settle 好 presses
 * against raw steps, and bring the Codex up to date. Never for a family member's record.
 */
export async function refreshCodex(input: { config: Config; dataDir: string; present: Iterable<string>; now?: Date; force?: boolean }): Promise<void> {
  const root = boundRootDir()
  if (!root || input.dataDir !== root) return
  const now = input.now ?? new Date()
  const state = readState(root, now, isoDay(now))
  if (!state.started) return
  await refreshSeries({ config: input.config, dataDir: root, present: input.present, now, force: input.force })
  const pending = state.nudge.acks.filter((row) => row.status === 'pending')
  if (pending.length > 0) {
    const fresh = readState(root, now, isoDay(now))
    for (const day of [...new Set(pending.map((row) => isoDay(new Date(row.at))))]) {
      const samples = await stepsOnDay(input.config, day)
      settleAcks(fresh.nudge, samples, now, day)
    }
    saveState(root, fresh)
  }
  syncCodex(now)
}

/** Today's civil hour, for tests of 我的白天. */
export function civilHour(now: Date): number {
  return civilParts(now).hour
}
