// Did an intervention move a marker? Pure functions over data already read:
// the plan, dated marker values, adherence, medication courses and check-ins.
// A change counts only when it is larger than within-person biological plus
// analytical noise (the reference change value), both results are in the same
// unit (converted with the variation table's own factors), the retest came late
// enough, and the plan is known to have been followed. What else changed at the
// same time is named beside it. A change is never credited to one item, nor to
// a combination: the words say which way the marker moved, not why.
// Trial effects are an average for a population, shown for comparison only.

import { factorFor } from './changes.ts'
import type { CheckIn, PlanItem, PlanVersion } from './interventions.ts'
import { addDays, CATEGORY_ZH, checkinStatus, daysBetween, TAG_ZH } from './interventions.ts'
import type { CourseRow, DoseRow, SeriesPoint } from './records.ts'
import { preferSelf } from './measurements.ts'
import { canonicalName, foldName, nameVariants } from './units.ts'
import { effectsFor, markerFor, rcvBand, type Biovar, type BiovarMarker, type EffectRow } from './reference.ts'
import { labToken } from './honesty/comparability.ts'

export type Verdict = '有效' | '波动内' | '反向' | '无法判断'

/** Days to wait after starting before a retest means anything, when the table has no row for the marker. */
const DEFAULT_RETEST_DAYS = 28
const BASELINE_LOOKBACK_DAYS = 180
const ADHERENCE_GOOD = 0.8
const ADHERENCE_LOW = 0.5
const COVERAGE_MIN = 0.3
const CRP_ACUTE_MG_L = 10
/** Mirobody logs doses as taken or skipped; other sources may write it out. A negative is read first. */
const DOSE_MISSED = /未服|没服|not[\s_-]*taken|untaken|missed|skip|漏/i
const DOSE_TAKEN = /taken|done|已服|服用/i

export interface ResolvedMarker {
  /** The marker as the plan named it. */
  asked: string
  label: string
  /** Mirobody indicator name holding its values, when the record has it. */
  indicator: string | null
  loinc?: string
  unit: string
  biovar: BiovarMarker | null
  /**
   * Other catalogue names of the same marker (a printed Chinese name and a LOINC row).
   * Their series are read with `indicator`; a baseline that lives on only one of them still counts.
   */
  also?: string[]
}

export interface Adherence {
  source: 'wearable' | 'dose_log' | 'check_in' | 'none'
  rate: number | null
  coverage: number
  known_days: number
  done_days: number
  window_days: number
  level: 'good' | 'partial' | 'low' | 'unknown'
  streak: number
  calendar: Array<{ date: string; status: 'done' | 'missed' | 'unknown' }>
  note_zh: string
}

export interface Expectation {
  id: string
  text_zh: string
  doi: string
  verified: boolean
  comparison: 'consistent' | 'smaller' | 'larger' | 'opposite' | 'not_comparable'
}

export interface MarkerVerdict {
  item: string
  item_title: string
  marker: string
  indicator: string | null
  unit: string
  verdict: Verdict
  reason_zh: string
  baseline: { date: string; value: number } | null
  followup: { date: string; value: number } | null
  change: { abs: number; pct: number } | null
  band: { up_pct: number; down_pct: number; verified: boolean; cva_default: boolean } | null
  direction: 'improved' | 'worse' | 'within' | 'unknown'
  confounders: string[]
  combined_with: string[]
  expected: Expectation[]
  next_retest: string | null
  /** The first date a retest means anything (start + the marker's minimum interval), when a retest is suggested. Stable while next_retest moves with today. */
  first_due: string | null
  /** Not found because the record was not read whole (never a sign the test is missing). */
  unread?: boolean
}

export interface ItemSummary {
  id: string
  title: string
  category: string
  category_zh: string
  start: string
  end: string | null
  days: number
  adherence: Adherence
  verdicts: MarkerVerdict[]
  headline: Verdict
}

export interface Suggestion {
  kind: 'adherence' | 'retest' | 'missing_marker' | 'one_change' | 'review' | 'worse' | 'acute' | 'lever' | 'record'
  priority: number
  text_zh: string
  item?: string
  marker?: string
  date?: string
}

// --- markers ---------------------------------------------------------------

export function resolveMarkers(
  names: readonly string[],
  indicators: ReadonlyArray<{ name: string; loinc?: string; label?: string; unit?: string; source?: 'self' }>,
  biovar: Biovar,
): ResolvedMarker[] {
  // A self measurement is in the list only when it is the newest of its kind, so it wins.
  const rows = preferSelf(indicators)
  return names.map((asked) => {
    const direct = biovar.markers.find((row) => row.key === asked) ?? markerFor(biovar, { name: asked, label: asked })
    const record = rows.find((row) => row.name === asked || (row.source === 'self' && row.label === asked))
      ?? (direct ? rows.find((row) => (row.loinc && direct.loinc.includes(row.loinc)) || (direct.device_codes ?? []).includes(row.name)) : undefined)
      ?? rows.find((row) => markerFor(biovar, row) === direct && direct != null)
      // A marker with no variation row (腰围) is still found under its report name, as candidatesFor finds it.
      ?? rows.find((row) => [row.name, row.label].some((text) => Boolean(text) && nameVariants(text as string).includes(foldName(asked))))
    const row = direct ?? (record ? markerFor(biovar, record) : null)
    // The same test printed differently by another report (肌酐 / 肌酐 Cr / 肌酐(Cr)) is the same series.
    const canon = record ? canonicalName(record.label || record.name) : ''
    const also = record ? [...new Set(rows.filter((other) => other.name !== record.name && other.source !== 'self' && canonicalName(other.label || other.name) === canon).map((other) => other.name))] : []
    return {
      asked,
      label: row?.label_zh ?? record?.label ?? asked,
      indicator: record?.name ?? null,
      ...(also.length ? { also } : {}),
      ...(record?.loinc ? { loinc: record.loinc } : {}),
      unit: record?.unit || row?.unit || '',
      biovar: row,
    }
  })
}

// --- adherence -------------------------------------------------------------

function meets(value: number, op: '>=' | '<=', threshold: number): boolean {
  return op === '<=' ? value <= threshold : value >= threshold
}

/**
 * The wearable series an item is followed on. An explicit target wins.
 * An exercise or sleep item with no target still counts steps or sleep:
 * 7000 steps or 7 hours unless the item's own words name another number.
 * Check-ins alone are not the only record of those items.
 */
export function wearableTargetFor(item: Pick<PlanItem, 'target' | 'mirobody' | 'category' | 'title' | 'detail'>): { metric: string; op: '>=' | '<='; value: number } | null {
  if (item.target) return { metric: item.target.metric, op: item.target.op, value: item.target.value }
  if (item.mirobody) return null
  const text = `${item.title} ${item.detail ?? ''}`
  if (item.category === 'sleep' || /睡眠|入睡|早睡/.test(text)) {
    const hours = text.match(/(\d+(?:\.\d+)?)\s*小时/)
    return { metric: 'dailyTotalSleepTime', op: '>=', value: hours ? Number(hours[1]) : 7 }
  }
  if (item.category === 'exercise' || /步|快走|步行|走路|有氧|跑步/.test(text)) {
    const steps = text.match(/(\d{3,6})\s*步/)
    return { metric: 'dailySteps', op: '>=', value: steps ? Number(steps[1]) : 7000 }
  }
  return null
}

/**
 * How well one item was followed over [start, end]. Missing data is unknown,
 * never a miss: a dose absent from the log is not evidence it was skipped.
 */
export function adherenceFor(
  item: PlanItem,
  window: { start: string; end: string },
  data: { daily?: SeriesPoint[]; doses?: DoseRow[]; checkins: CheckIn[] },
  calendarDays = 84,
): Adherence {
  const start = item.start > window.start ? item.start : window.start
  const endCap = item.end && item.end < window.end ? item.end : window.end
  const days = Math.max(0, daysBetween(start, endCap) + 1)
  const status = new Map<string, 'done' | 'missed'>()
  let source: Adherence['source'] = 'none'
  // An explicit target is wearable even when the series came back empty (coverage 0, not a missed check-in).
  // An exercise or sleep item with no target uses steps or sleep only when that series has days.
  const wearable = item.target ? wearableTargetFor(item) : (data.daily && data.daily.length > 0 ? wearableTargetFor(item) : null)
  if (wearable && data.daily) {
    source = 'wearable'
    for (const point of data.daily) {
      if (point.date < start || point.date > endCap) continue
      status.set(point.date, meets(point.value, wearable.op, wearable.value) ? 'done' : 'missed')
    }
    // A stated check-in fills a day the watch did not record. It does not override a day the watch did record.
    if (!item.target) {
      for (const [date, done] of checkinStatus(data.checkins).get(item.id) ?? []) {
        if (date < start || date > endCap || status.has(date) || !done) continue
        status.set(date, 'done')
      }
    }
  } else if (item.mirobody && data.doses) {
    source = 'dose_log'
    const byDay = new Map<string, { taken: number; skipped: number }>()
    for (const dose of data.doses) {
      if (dose.date < start || dose.date > endCap) continue
      const day = byDay.get(dose.date) ?? { taken: 0, skipped: 0 }
      // Negatives first: 未服用 contains 服用 and "not taken" contains taken.
      if (DOSE_MISSED.test(dose.status)) day.skipped += 1
      else if (DOSE_TAKEN.test(dose.status)) day.taken += 1
      byDay.set(dose.date, day)
    }
    for (const [date, day] of byDay) {
      if (day.taken + day.skipped > 0) status.set(date, day.skipped === 0 ? 'done' : 'missed')
    }
  } else {
    source = 'check_in'
    // The latest check-in per day wins: a mistaken 完成 can be taken back or corrected to 没做到.
    for (const [date, done] of checkinStatus(data.checkins).get(item.id) ?? []) {
      if (date < start || date > endCap) continue
      status.set(date, done ? 'done' : 'missed')
    }
    if (status.size === 0) source = data.checkins.some((row) => row.item === item.id) ? 'check_in' : 'none'
  }

  let rate: number | null
  let knownDays = status.size
  let doneDays = [...status.values()].filter((value) => value === 'done').length
  if (source === 'check_in' && item.frequency?.per === 'week' && days >= 7) {
    // "3 times a week": count sessions per week against the target
    const weeks = new Map<number, number>()
    for (const [date, value] of status) {
      if (value !== 'done') continue
      const week = Math.floor(daysBetween(start, date) / 7)
      weeks.set(week, (weeks.get(week) ?? 0) + 1)
    }
    const reported = new Set([...status.keys()].map((date) => Math.floor(daysBetween(start, date) / 7)))
    const perWeek = [...reported].map((week) => Math.min(1, (weeks.get(week) ?? 0) / (item.frequency?.times ?? 1)))
    rate = perWeek.length > 0 ? perWeek.reduce((a, b) => a + b, 0) / perWeek.length : null
    knownDays = reported.size * 7
    doneDays = Math.round((rate ?? 0) * knownDays)
  } else {
    rate = knownDays > 0 ? doneDays / knownDays : null
  }
  const coverage = days > 0 ? Math.min(1, knownDays / days) : 0
  let level: Adherence['level'] = 'unknown'
  if (rate != null && coverage >= COVERAGE_MIN) level = rate >= ADHERENCE_GOOD ? 'good' : rate >= ADHERENCE_LOW ? 'partial' : 'low'

  let streak = 0
  for (let day = endCap; day >= start; day = addDays(day, -1)) {
    const value = status.get(day)
    if (value === 'done') streak += 1
    else if (value === 'missed' || day < endCap) break
  }
  const calendar: Adherence['calendar'] = []
  for (let i = calendarDays - 1; i >= 0; i -= 1) {
    const date = addDays(window.end, -i)
    calendar.push({ date, status: date < item.start || (item.end != null && date > item.end) ? 'unknown' : (status.get(date) ?? 'unknown') })
  }
  const sourceZh = { wearable: '手环数据', dose_log: '服用记录', check_in: '打卡', none: '没有记录' }[source]
  let note = ''
  if (source === 'none') note = item.mirobody ? '在健康数据服务中记录服用情况后，才会生成执行记录。' : '还没有打卡记录。'
  else if (level === 'unknown') note = `${sourceZh}仅覆盖 ${Math.round(coverage * 100)}% 的天数，数据不足，暂不计算执行率。`
  else note = `${sourceZh}：执行率 ${Math.round((rate ?? 0) * 100)}%（覆盖 ${Math.round(coverage * 100)}% 的天数）。`
  return { source, rate, coverage, known_days: knownDays, done_days: doneDays, window_days: days, level, streak, calendar, note_zh: note }
}

// --- effects ---------------------------------------------------------------

function crpInMgL(point: { value: number; unit: string }): number {
  return /mg\/dl/i.test(point.unit) ? point.value * 10 : point.value
}

function isCrp(marker: ResolvedMarker): boolean {
  return marker.biovar?.key === 'crp' || /crp|c反应蛋白|c-反应蛋白/i.test(`${marker.asked} ${marker.label}`)
}

function expectationText(row: EffectRow): string {
  const effect = row.effect
  const sign = effect.value > 0 ? '+' : ''
  let amount: string
  if (effect.kind === 'percent_change') amount = `${sign}${effect.value}%`
  else if (effect.kind === 'standardized') amount = `标准化效应 ${effect.value}（${effect.unit}）`
  else if (effect.kind === 'rate') amount = `${sign}${effect.value} ${effect.unit}（年化）`
  else amount = `${sign}${effect.value} ${effect.unit}`
  const ci = effect.ci ? `（95% 区间 ${effect.ci[0]} 至 ${effect.ci[1]}）` : ''
  const per = effect.kind === 'per_unit' && effect.per ? `，按每${effect.per}` : ''
  const weeks = row.duration_weeks ? `，约 ${row.duration_weeks} 周` : ''
  const design = row.design === 'meta-analysis' ? '荟萃分析' : row.design === 'rct' ? '随机对照试验' : row.design
  const checked = row.verified_by === 'person' ? '' : '（数字已由脚本对照原文引文核对，尚未人工复核）'
  return `${row.intervention_zh}对${row.marker_zh}：试验组比对照组平均 ${amount}${ci}${per}${weeks}；${row.population}；${design}。${checked}`
}

/** The published effect in the marker's unit, or null when it cannot be put there. */
function effectInUnit(row: EffectRow, unit: string, marker: BiovarMarker | null): { value: number; ci: [number, number] | null } | null {
  const norm = (text: string) => text.replace(/\s/g, '').toLowerCase()
  const effect = row.effect
  if (norm(effect.unit) === norm(unit)) return { value: effect.value, ci: effect.ci ?? null }
  const factor = marker?.convert ? Object.entries(marker.convert).find(([from]) => norm(from) === norm(effect.unit))?.[1] : undefined
  if (factor == null || norm(marker?.unit ?? '') !== norm(unit)) return null
  return { value: effect.value * factor, ci: effect.ci ? [effect.ci[0] * factor, effect.ci[1] * factor] : null }
}

function compare(row: EffectRow, change: { abs: number; pct: number } | null, unit: string, marker: BiovarMarker | null, years: number): Expectation['comparison'] {
  if (!change) return 'not_comparable'
  const effect = row.effect
  let observed: number
  let expected: { value: number; ci: [number, number] | null } | null
  if (effect.kind === 'standardized' || effect.kind === 'per_unit') return 'not_comparable'
  if (effect.kind === 'percent_change') {
    observed = change.pct * 100
    expected = { value: effect.value, ci: effect.ci ?? null }
  } else {
    observed = change.abs
    expected = effectInUnit(row, unit, marker)
    if (expected && effect.kind === 'rate') {
      expected = { value: expected.value * years, ci: expected.ci ? [expected.ci[0] * years, expected.ci[1] * years] : null }
    }
  }
  if (!expected) return 'not_comparable'
  if (expected.value !== 0 && observed !== 0 && Math.sign(observed) !== Math.sign(expected.value)) return 'opposite'
  const [low, high] = expected.ci ? [Math.min(...expected.ci), Math.max(...expected.ci)] : [expected.value, expected.value]
  if (observed >= low && observed <= high) return 'consistent'
  return Math.abs(observed) < Math.min(Math.abs(low), Math.abs(high)) ? 'smaller' : 'larger'
}

/** Mean of daily means over the last `days` days, dated at the last day, and how many days had a reading. A day with more cuff readings does not outweigh a day with one. */
function meanOver(points: readonly SeriesPoint[], days: number): { point: SeriesPoint; days: number } | undefined {
  const last = points.at(-1)
  if (!last) return undefined
  const from = addDays(last.date, -(days - 1))
  const byDay = new Map<string, number[]>()
  for (const point of points) {
    if (point.date < from || point.date > last.date) continue
    byDay.set(point.date, [...(byDay.get(point.date) ?? []), point.value])
  }
  const daily = [...byDay.values()].map((values) => values.reduce((sum, value) => sum + value, 0) / values.length)
  if (daily.length === 0) return undefined
  const value = daily.reduce((sum, one) => sum + one, 0) / daily.length
  return { point: { ...last, value: Math.round(value * 100) / 100 }, days: byDay.size }
}

/** Names as the next steps and reasons say them: 「甲」和「乙」, 「甲」、「乙」和「丙」. */
function namesZh(names: readonly string[]): string {
  const quoted = names.map((name) => `「${name}」`)
  return quoted.length <= 1 ? quoted.join('') : `${quoted.slice(0, -1).join('、')}和${quoted.at(-1)}`
}

/** One sentence for items on the same marker at the same time; the same words whichever item it is read from. */
export function togetherZh(titles: readonly string[]): string {
  return `同期在执行${namesZh([...new Set(titles)].sort((a, b) => a.localeCompare(b)))}，无法区分各自的作用。`
}

export interface EvaluateInput {
  goals?: PlanVersion['goals']
  plan: PlanVersion
  today: string
  markers: Record<string, ResolvedMarker>
  series: Record<string, SeriesPoint[]>
  adherence: Record<string, Adherence>
  courses: CourseRow[]
  checkins: CheckIn[]
  biovar: Biovar
  effects: EffectRow[]
  /** Indicator names whose readings failed to read or came back cut: judged from nothing, never from what is left. */
  unread?: readonly string[]
  /** The record failed to read, or its catalogue came back cut: a marker not found may be in the part not read. */
  record_unread?: 'failed' | 'cut'
}

export function evaluateMarker(item: PlanItem, marker: ResolvedMarker, input: EvaluateInput): MarkerVerdict {
  const biovar = marker.biovar
  const unit = biovar?.unit || marker.unit
  const base: MarkerVerdict = {
    item: item.id, item_title: item.title, marker: marker.label, indicator: marker.indicator, unit,
    verdict: '无法判断', reason_zh: '', baseline: null, followup: null, change: null, band: null, direction: 'unknown',
    confounders: [], combined_with: [], expected: [], next_retest: null, first_due: null,
  }
  const retestDays = biovar?.min_retest_days ?? DEFAULT_RETEST_DAYS
  const seriesNames = [marker.indicator, ...(marker.also ?? [])].filter((name): name is string => Boolean(name))
  const openNames = seriesNames.filter((name) => !input.unread?.includes(name))
  if (seriesNames.length === 0 && input.record_unread) {
    base.unread = true
    base.reason_zh = input.record_unread === 'failed'
      ? `记录读取失败，未读取到${marker.label}的结果，本次无法判断。`
      : `指标目录未完整读取，${marker.label}可能在未读取的部分中，本次无法判断。`
    return base
  }
  if (seriesNames.length === 0) {
    base.reason_zh = `记录中尚无${marker.label}。下次检查时请加测，才能评估这项干预对它的影响。`
    return base
  }
  if (openNames.length === 0) {
    base.reason_zh = `${marker.label}的历次结果未完整读取（读取失败或被截断），本次无法判断。`
    return base
  }
  // Every result in the variation row's unit, with the row's own factors (as changes.ts does); a result that
  // cannot be put there is kept aside and named, never compared as it is.
  // Names of the same marker (printed name and LOINC) are one series: a baseline on either of them counts.
  const unconverted: SeriesPoint[] = []
  const points = openNames.flatMap((name) => input.series[name] ?? []).slice().sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).flatMap((point) => {
    if (!biovar) return [point]
    const factor = factorFor(biovar, point.unit)
    if (factor == null) {
      unconverted.push(point)
      return []
    }
    return [{ ...point, value: factor === 1 ? point.value : Number((point.value * factor).toPrecision(6)), unit: biovar.unit }]
  })
  const inBefore = (point: { date: string }) => point.date <= item.start && point.date >= addDays(item.start, -BASELINE_LOOKBACK_DAYS)
  const earliest = addDays(item.start, retestDays)
  const lastDay = item.end ? addDays(item.end, 30) : input.today
  const inAfter = (point: { date: string }) => point.date >= earliest && point.date <= lastDay
  const before = points.filter(inBefore)
  const after = points.filter(inAfter)
  const window = biovar?.average_days ?? 0
  // A result in a unit the table cannot convert, newer than any usable one, would have been the one compared.
  const blocked = (side: SeriesPoint[], inSide: (point: { date: string }) => boolean) =>
    unconverted.filter(inSide).find((point) => !side.at(-1) || point.date > (side.at(-1) as SeriesPoint).date)
  // Means over several days (home blood pressure) leave such a result out and count the days that remain.
  const unitProblem = window > 0 ? undefined : blocked(before, inBefore) ?? blocked(after, inAfter)
  if (unitProblem) {
    base.reason_zh = `${dayZh(unitProblem.date, input.today)}的${marker.label}单位是 ${unitProblem.unit || '（没有单位）'}，无法换算成 ${unit}，这次无法比较。`
    base.next_retest = earliest > input.today ? earliest : null
    base.first_due = base.next_retest ? earliest : null
    return base
  }
  const baseMean = window > 0 ? meanOver(before, window) : undefined
  const followMean = window > 0 ? meanOver(after, window) : undefined
  const baseline = window > 0 ? baseMean?.point : before.at(-1)
  const followup = window > 0 ? followMean?.point : after.at(-1)
  if (!baseline) {
    base.reason_zh = `开始前 ${BASELINE_LOOKBACK_DAYS} 天内没有${marker.label}的结果，没有基线可比。`
    base.next_retest = earliest > input.today ? earliest : null
    base.first_due = base.next_retest ? earliest : null
    return base
  }
  base.baseline = { date: baseline.date, value: baseline.value }
  // A band measured on means of several days (home blood pressure) says nothing about fewer days.
  const homeZh = biovar && ['sbp', 'dbp'].includes(biovar.key) ? '家庭血压' : `${marker.label}读数`
  if (window > 0 && (baseMean?.days ?? 0) < window) {
    base.reason_zh = `需要连续 ${window} 天的${homeZh}：开始前只有 ${baseMean?.days ?? 0} 天的读数，没有可比的基线。`
    base.next_retest = earliest > input.today ? earliest : null
    base.first_due = base.next_retest ? earliest : null
    return base
  }
  if (!followup || (window > 0 && (followMean?.days ?? 0) < window)) {
    const premature = window > 0 ? [] : points.filter((point) => point.date > item.start && point.date < earliest && point.date <= lastDay)
    const earlyHit = premature.at(-1)
    base.next_retest = earliest > input.today ? earliest : input.today
    base.first_due = earliest
    if (earlyHit) {
      base.followup = { date: earlyHit.date, value: earlyHit.value }
      base.reason_zh = `太早：${dayZh(earlyHit.date, input.today)}的${marker.label}距方案开始只有 ${Math.max(0, daysBetween(item.start, earlyHit.date))} 天，这项至少隔 ${retestDays} 天才能比较，${dayZh(earliest, input.today)}之后再测。`
    } else {
      base.reason_zh = earliest > input.today
        ? `太早：开始才 ${Math.max(0, daysBetween(item.start, input.today))} 天。${marker.label}至少要隔 ${retestDays} 天复测才可比，${dayZh(earliest, input.today)}之后再测。`
        : followup
          ? `需要连续 ${window} 天的${homeZh}：复测只有 ${followMean?.days ?? 0} 天的读数，还不能比较。`
          : `开始后还没有复测${marker.label}。现在可以复测了。`
    }
    return base
  }
  base.followup = { date: followup.date, value: followup.value }
  const fromLab = labToken(baseline.file)
  const toLab = labToken(followup.file)
  const labChange = input.checkins.some((row) => row.tags.includes('lab_change') && row.date > baseline.date && row.date <= followup.date)
  if ((fromLab && toLab && fromLab !== toLab) || labChange) {
    const where = fromLab && toLab && fromLab !== toLab
      ? `${dayZh(baseline.date, input.today)}来自${fromLab}，${dayZh(followup.date, input.today)}来自${toLab}`
      : `${dayZh(baseline.date, input.today)}至${dayZh(followup.date, input.today)}之间记录了更换检测机构`
    base.reason_zh = `不可比：${where}，${marker.label}的两次结果不能直接比较。`
    return base
  }
  const abs = followup.value - baseline.value
  if (baseline.value === 0) {
    base.reason_zh = '基线为 0，无法计算相对变化。'
    return base
  }
  const pct = abs / baseline.value
  base.change = { abs, pct }

  // what else changed between the two results
  const windowFrom = baseline.date
  const windowTo = followup.date
  const within = (date: string | null | undefined) => Boolean(date) && (date as string) > windowFrom && (date as string) <= windowTo
  for (const other of input.plan.items) {
    if (other.id === item.id) continue
    const sameMarker = other.markers.some((name) => {
      const resolved = input.markers[name]
      return resolved ? resolved.indicator === marker.indicator : name === marker.asked
    })
    if (sameMarker && (within(other.start) || within(other.end) || (other.start <= windowFrom && (!other.end || other.end > windowFrom)))) {
      base.combined_with.push(other.title)
    }
  }
  const combinedMeds = new Set(input.plan.items.filter((other) => other.mirobody && base.combined_with.includes(other.title)).map((other) => other.mirobody?.medication))
  for (const course of input.courses) {
    if (item.mirobody && course.medication === item.mirobody.medication) continue
    // Already named as a plan item acting on the same marker.
    if (combinedMeds.has(course.medication)) continue
    // A course matters when it is still running at the retest, or stopped shortly before it.
    const runningAtRetest = within(course.start) && (!course.end || course.end >= addDays(windowTo, -14))
    const stoppedJustBefore = within(course.end) && daysBetween(course.end, windowTo) <= 30
    if (runningAtRetest) base.confounders.push(`${course.start} 开始用${course.medication}（用药记录）`)
    else if (stoppedJustBefore) base.confounders.push(`${course.end} 停用${course.medication}，距复测不到一个月（用药记录）`)
  }
  for (const row of input.checkins) {
    if (!within(row.date) || row.tags.length === 0) continue
    const recent = row.tags.includes('illness') ? daysBetween(row.date, windowTo) <= 21 : true
    if (recent) base.confounders.push(`${row.date} ${row.tags.map((tag) => TAG_ZH[tag] ?? tag).join('、')}${row.note ? `：${row.note}` : ''}`)
  }
  base.confounders = [...new Set(base.confounders)].slice(0, 6)

  // trial averages for this intervention and marker
  const years = Math.max(0, daysBetween(baseline.date, followup.date)) / 365.25
  // Only rows a person checked against the paper are set beside a change.
  base.expected = effectsFor(input.effects, item, biovar, marker.loinc).filter((row) => row.verified).slice(0, 4).map((row) => ({
    id: row.id, text_zh: expectationText(row), doi: row.doi, verified: row.verified,
    comparison: compare(row, base.change, unit, biovar, years),
  }))

  const adherence = input.adherence[item.id]
  if (isCrp(marker) && (crpInMgL(baseline) > CRP_ACUTE_MG_L || crpInMgL(followup) > CRP_ACUTE_MG_L)) {
    base.reason_zh = 'CRP 高于 10 mg/L，通常提示急性炎症（感冒、感染、受伤），本次比较不予采用。建议恢复两周后复测。'
    return base
  }
  if (!biovar) {
    base.reason_zh = `变化 ${(pct * 100).toFixed(0)}%。缺少${marker.label}的个体内变异数据，分不清是真实变化还是波动。`
    return base
  }
  const band = rcvBand(biovar, input.biovar.z)
  base.band = { up_pct: band.up * 100, down_pct: band.down * 100, verified: biovar.verified, cva_default: band.cva_default }
  const beyondUp = pct > band.up
  const beyondDown = pct < band.down
  // With a goal, moving toward it decides, in the row's unit (a goal without a unit is in the record's unit).
  const goalRow = (input.goals ?? []).find((row) => row.marker === marker.asked || row.marker === biovar.key || row.marker === marker.label)
  const goalFactor = goalRow ? factorFor(biovar, goalRow.unit || marker.unit) : null
  const goal = goalRow && goalFactor != null ? goalRow.value * goalFactor : null
  const goalNote = goalRow && goalFactor == null ? `目标 ${goalRow.value} ${goalRow.unit} 无法换算成 ${unit}，没有按目标判断。` : ''
  const neutral = biovar.better === 'range' || biovar.better === 'none'
  const aim: 'lower' | 'higher' | null = goal != null && goal !== baseline.value ? (goal < baseline.value ? 'lower' : 'higher')
    : biovar.better === 'lower' || biovar.better === 'higher' ? biovar.better : null
  const byGoal = goal != null && goal !== baseline.value
  const rangeNote = biovar.better === 'range' ? '是否合适要结合参考范围。' : ''
  if (!beyondUp && !beyondDown) {
    base.direction = 'within'
    base.verdict = '波动内'
    base.reason_zh = `变化 ${(pct * 100).toFixed(0)}%，在正常波动范围（${(band.down * 100).toFixed(0).replace(/^-/, '−')}% 至 +${(band.up * 100).toFixed(0)}%）内，尚不能视为真实变化。`
  } else if (aim) {
    const toward = (aim === 'lower' && beyondDown) || (aim === 'higher' && beyondUp)
    base.direction = toward ? 'improved' : 'worse'
    base.verdict = toward ? '有效' : '反向'
    const words = byGoal ? (toward ? '朝目标变化' : '偏离目标') : (toward ? '指标朝目标方向变化' : '指标朝不利方向变化')
    const passed = byGoal && neutral && goal != null && (aim === 'lower' ? followup.value < goal : followup.value > goal) ? '已越过目标值。' : ''
    base.reason_zh = `变化 ${(pct * 100).toFixed(0)}%，${words}，超出正常波动。${passed}${rangeNote}`
  } else {
    base.direction = 'unknown'
    base.reason_zh = `变化 ${(pct * 100).toFixed(0)}%，超出正常波动；这一项没有「越低越好」或「越高越好」的方向，请结合参考范围看。`
  }
  base.reason_zh += goalNote
  if ((base.verdict === '有效' || base.verdict === '反向') && base.combined_with.length > 0) {
    base.reason_zh += togetherZh([item.title, ...base.combined_with])
  }
  if ((base.verdict === '有效' || base.verdict === '反向') && base.confounders.length > 0) {
    base.reason_zh += `期间还有其他变化（${base.confounders.slice(0, 2).join('；')}），结论的可靠性降低。`
  }
  if (adherence?.level === 'low') {
    base.verdict = '无法判断'
    base.reason_zh = `执行率只有 ${Math.round((adherence.rate ?? 0) * 100)}%，${marker.label}的变化评价不了这项方案本身。${base.reason_zh}`
  } else if (base.verdict === '有效' && adherence?.level !== 'good' && adherence?.level !== 'partial') {
    // 有效 needs adherence that is known and at least half: a change with no record of the plan says nothing about it.
    base.verdict = '无法判断'
    base.reason_zh = !adherence || adherence.source === 'none'
      ? `没有执行记录，${marker.label}的变化评价不了这项方案本身。${base.reason_zh}`
      : `执行记录太少（覆盖 ${Math.round(adherence.coverage * 100)}% 的天数），${marker.label}的变化评价不了这项方案本身。${base.reason_zh}`
  }
  if (!biovar.verified) base.reason_zh += '（波动范围所用的变异数据尚未核对来源。）'
  return base
}

function headline(verdicts: readonly MarkerVerdict[]): Verdict {
  if (verdicts.some((row) => row.verdict === '有效')) return '有效'
  if (verdicts.some((row) => row.verdict === '反向')) return '反向'
  if (verdicts.some((row) => row.verdict === '波动内')) return '波动内'
  return '无法判断'
}

export function evaluatePlan(input: EvaluateInput): ItemSummary[] {
  return input.plan.items.map((item) => {
    const adherence = input.adherence[item.id] ?? adherenceFor(item, { start: item.start, end: input.today }, { checkins: [] })
    const verdicts = item.markers.map((name) => evaluateMarker(item, input.markers[name] ?? {
      asked: name, label: name, indicator: null, unit: '', biovar: null,
    }, { ...input, adherence: { ...input.adherence, [item.id]: adherence } }))
    return {
      id: item.id,
      title: item.title,
      category: item.category,
      category_zh: CATEGORY_ZH[item.category],
      start: item.start,
      end: item.end,
      days: Math.max(0, daysBetween(item.start, item.end && item.end < input.today ? item.end : input.today)),
      adherence,
      verdicts,
      headline: headline(verdicts),
    }
  })
}

// --- what to do next ---------------------------------------------------------

export interface LeverHint {
  label: string
  from: string
  to: string
  years: number
}

/**
 * Concrete next steps within the harness's boundary: follow the plan, retest on
 * time, measure what is missing, change one thing at a time, and discuss a
 * plan that is not working with the doctor or coach. Never a dose.
 */
export function suggestNext(summaries: readonly ItemSummary[], context: { today: string; levers?: LeverHint[] }): Suggestion[] {
  const out: Suggestion[] = []
  const seenRetest = new Set<string>()
  for (const item of summaries) {
    if ((item.adherence.level === 'low' || item.adherence.level === 'partial') && item.days >= 14) {
      out.push({
        kind: 'adherence', priority: item.adherence.level === 'low' ? 1 : 3, item: item.id,
        text_zh: `「${item.title}」执行率 ${Math.round((item.adherence.rate ?? 0) * 100)}%。请先将执行率稳定在八成以上，再判断其效果。`,
      })
    }
    if (item.adherence.source === 'none' && item.days >= 7) {
      out.push({
        kind: 'record', priority: 4, item: item.id,
        text_zh: item.adherence.note_zh.startsWith('在健康数据服务')
          ? `「${item.title}」没有服用记录。${item.adherence.note_zh}`
          : `「${item.title}」还没有执行记录。每天在对话中告知「今天${item.title}完成了」，即可记录。`,
      })
    }
    for (const row of item.verdicts) {
      if (!row.indicator) {
        // A marker the record was not read whole for may well be on file: never ask for a test it may have.
        if (!row.unread) out.push({ kind: 'missing_marker', priority: 3, item: item.id, marker: row.marker, text_zh: `「${item.title}」针对${row.marker}，但记录里没有这一项。下次检查加测。` })
      } else if (row.next_retest && !seenRetest.has(`${row.marker}:${row.next_retest}`)) {
        seenRetest.add(`${row.marker}:${row.next_retest}`)
        out.push({
          kind: 'retest', priority: row.next_retest <= context.today ? 2 : 5, marker: row.marker, date: row.next_retest,
          text_zh: row.next_retest <= context.today ? `现在可以复测${row.marker}了。` : `${dayZh(row.next_retest, context.today)}之后复测${row.marker}。`,
        })
      }
      if (row.verdict === '反向') {
        out.push({ kind: 'worse', priority: 1, item: item.id, marker: row.marker, text_zh: `${row.marker}在「${item.title}」期间变差且超出波动。建议复查确认，并和医生讨论。` })
      }
      if (row.reason_zh.startsWith('CRP 高于 10')) {
        out.push({ kind: 'acute', priority: 2, marker: row.marker, text_zh: 'CRP 超过 10 mg/L。身体恢复两周后再测一次 CRP，再做比较。' })
      }
      // Items on the same marker at the same time: once per marker and set of items, whichever item it is read from.
      if (row.followup && row.combined_with.length > 0) {
        out.push({ kind: 'one_change', priority: 4, item: item.id, marker: row.marker, text_zh: `${row.marker}：${togetherZh([item.title, ...row.combined_with])}下次调整一次只改一项。` })
      }
      if (row.verdict === '波动内' && item.adherence.level === 'good' && item.days >= 90) {
        out.push({
          kind: 'review', priority: 3, item: item.id, marker: row.marker,
          text_zh: `「${item.title}」执行得很好，但${row.marker}的变化还在波动范围内。可以再复测一次确认，或和医生、长寿师讨论是否调整这一项。`,
        })
      }
    }
  }
  for (const lever of (context.levers ?? []).slice(0, 2)) {
    if (lever.years >= -0.2) continue
    out.push({
      kind: 'lever', priority: 4,
      text_zh: `按身体年龄模型，${lever.label}从 ${lever.from} 到 ${lever.to}，身体年龄约 ${lever.years.toFixed(1)} 岁（模型估计）。它是你当前最大的杠杆。`,
    })
  }
  // Retests due after the same day read as one line: 「10 月 28 日之后复测：LDL-C、总胆固醇、收缩压。」
  const later = out.filter((row) => row.kind === 'retest' && row.date && row.date > context.today)
  const byDate = new Map<string, Suggestion[]>()
  for (const row of later) byDate.set(row.date as string, [...(byDate.get(row.date as string) ?? []), row])
  const merged = out.filter((row) => !(row.kind === 'retest' && row.date && row.date > context.today && (byDate.get(row.date)?.length ?? 0) > 1))
  for (const [date, rows] of byDate) {
    if (rows.length < 2) continue
    merged.push({ ...rows[0], marker: undefined, text_zh: `${dayZh(date, context.today)}之后复测：${rows.map((row) => row.marker).join('、')}。` } as Suggestion)
  }
  const unique = new Map<string, Suggestion>()
  for (const row of merged) if (!unique.has(row.text_zh)) unique.set(row.text_zh, row)
  return [...unique.values()].sort((a, b) => a.priority - b.priority).slice(0, 10)
}

/** 「10 月 28 日」, with the year when it is not this year (docs/design-system.md). */
function dayZh(iso: string, today: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const md = `${Number(m[2])} 月 ${Number(m[3])} 日`
  return m[1] === today.slice(0, 4) ? md : `${m[1]} 年 ${md}`
}
