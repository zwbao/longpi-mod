// Whether two results of one marker may be compared, and the one body-age
// sentence the page and the chat are both supposed to use.
//
// A retest shorter than the marker's minimum interval is 太早. Two draws from
// different institutions are 不可比. PhenoAge may use inputs spread over at
// most PHENOAGE_WINDOW_DAYS, and that window is named, never presented as one draw.

import type { RecordChange, UnjudgedChange } from '../changes.ts'
import { factorFor, rangeFlag } from '../changes.ts'
import type { Biovar, BiovarMarker } from '../reference.ts'
import { markerFor, checkupMarkerFor, rcvBand } from '../reference.ts'
import type { IndicatorRow } from '../situation.ts'
import type { SeriesPoint } from '../records.ts'
import { daysBetween } from '../interventions.ts'
import { formatNumber } from './format.ts'

/** Default wait when the variation table has no minimum for the marker (evaluate.ts). */
export const DEFAULT_RETEST_DAYS = 28
/**
 * PhenoAge inputs may come from different days inside this many days.
 * Levine 2018 fits a panel; real checkups rarely draw all nine on one morning.
 * 30 days is the window used here and it is always labelled.
 */
export const PHENOAGE_WINDOW_DAYS = 30

export interface CompareGate {
  gate: 'too_early' | 'not_comparable'
  reason_zh: string
}

/** An institution named in a report file or a provision source, or null when the text does not name one. */
export function labToken(file: string | undefined): string | null {
  const text = (file ?? '').trim()
  if (!text) return null
  const parts = text.split(':').map((part) => part.trim()).filter(Boolean)
  const named = parts.find((part) => /医院|体检中心|检验所|实验室|诊所/.test(part))
  if (named) return named
  const match = text.match(/[\u4e00-\u9fffA-Za-z0-9]{2,40}(?:医院|体检中心|检验所|实验室|诊所)/)
  return match ? match[0] : null
}

/**
 * The last two plotted days are not a fair comparison.
 * Different institutions win over a short interval: both are named.
 * `min_retest_days` null uses DEFAULT_RETEST_DAYS, the same fallback as plan verdicts.
 */
export function compareGate(
  days: ReadonlyArray<{ date: string }>,
  readings: ReadonlyArray<Pick<SeriesPoint, 'date' | 'file'>>,
  marker: Pick<BiovarMarker, 'min_retest_days' | 'label_zh'>,
): CompareGate | null {
  if (days.length < 2) return null
  const last = days.at(-1) as { date: string }
  const prev = days.at(-2) as { date: string }
  const fileOn = (date: string) => readings.filter((point) => point.date === date && point.file).at(-1)?.file
  const fromLab = labToken(fileOn(prev.date))
  const toLab = labToken(fileOn(last.date))
  if (fromLab && toLab && fromLab !== toLab) {
    return {
      gate: 'not_comparable',
      reason_zh: `不可比：${prev.date} 的${marker.label_zh}来自${fromLab}，${last.date} 来自${toLab}，不同机构的结果不能直接比较。`,
    }
  }
  const min = marker.min_retest_days ?? DEFAULT_RETEST_DAYS
  const gap = daysBetween(prev.date, last.date)
  if (gap < min) {
    return {
      gate: 'too_early',
      reason_zh: `太早：两次相隔 ${gap} 天，${marker.label_zh}至少隔 ${min} 天才能比较。`,
    }
  }
  return null
}

/** Record rows that measure the same biological-variation marker, other than `primary`. */
export function siblingNames(
  indicators: ReadonlyArray<Pick<IndicatorRow, 'name' | 'label' | 'loinc' | 'source'>>,
  biovar: Biovar,
  marker: BiovarMarker | null,
  primary: string | null,
): string[] {
  if (!marker) return []
  const names: string[] = []
  for (const row of indicators) {
    if (!row.name || row.source === 'self' || row.name === primary || names.includes(row.name)) continue
    if (/尿/.test(`${row.name} ${row.label ?? ''}`)) continue
    const hit = row.loinc ? checkupMarkerFor(biovar, row) : markerFor(biovar, row)
    if (hit?.key === marker.key) names.push(row.name)
  }
  return names
}

/**
 * Give an uncoded catalogue row the LOINC of the marker its printed name is,
 * so the changes card joins a baseline stored under the Chinese name with a
 * follow-up stored under the code. Rows that already have a code are unchanged.
 * Urine names are left uncoded: a name match must not pool them into serum.
 */
export function codedRecords<T extends { indicators: IndicatorRow[] }>(records: T, biovar: Biovar): T {
  let changed = false
  const indicators = records.indicators.map((row) => {
    if (row.source === 'self' || row.loinc || !row.name) return row
    if (/尿/.test(`${row.name} ${row.label ?? ''}`)) return row
    const marker = markerFor(biovar, row)
    const code = marker?.loinc[0]
    if (!marker || marker.average_days || !code) return row
    changed = true
    return { ...row, loinc: code }
  })
  return changed ? { ...records, indicators } : records
}

export interface BodyAgeWording {
  /** The sentence the chip and the chat both use. */
  headline_zh: string
  /** True only for a repeat panel whose move is larger than the noise band, toward a younger phenotypic age. */
  allows_younger: boolean
}

/**
 * One sentence for the latest phenotypic age.
 * A single panel, or a move inside the noise band, never says 年轻了.
 * A move beyond the band toward a lower phenotypic age does, and says it is a model estimate.
 */
export function bodyAgeWording(input: {
  phenoage: number
  advance: number | null
  bandYears: number | null
  dates: readonly string[]
  advances: ReadonlyArray<number | null>
  spanDays: number
  date: string
}): BodyAgeWording {
  const pheno = formatNumber({ value: input.phenoage, unit: '岁' })
  const window = input.spanDays > 0
    ? `九项血检在 ${input.spanDays} 天内测齐（截至 ${input.date}，不超过 ${PHENOAGE_WINDOW_DAYS} 天），不是同一天抽血。`
    : `按 ${input.date} 同一天的九项血检。`
  const previous = input.advances.length >= 2 ? input.advances.at(-2) : null
  const current = input.advance
  if (input.dates.length < 2 || previous == null || current == null) {
    const versus = current == null ? '' : `比实足年龄${current < 0 ? '低' : current > 0 ? '高' : '持平'} ${formatNumber({ value: Math.abs(current), unit: '岁' })}，`
    return {
      allows_younger: false,
      headline_zh: `身体年龄 ${pheno}（模型估计）。${window}${versus}这是一次读数，不能据此说年轻了。`,
    }
  }
  const delta = current - previous
  const band = input.bandYears
  if (band == null || Math.abs(delta) <= band) {
    const way = delta < -0.05 ? '读数比上次更靠近实足年龄' : delta > 0.05 ? '读数比上次离实足年龄更远' : '读数和上次几乎一样'
    const bandText = band == null ? '' : `，差距 ${formatNumber({ value: Math.abs(delta), unit: '岁' })}在正常波动 ±${formatNumber({ value: band, unit: '岁' })}以内`
    return {
      allows_younger: false,
      headline_zh: `身体年龄 ${pheno}（模型估计）。${window}${way}${bandText}。这是进展记录，还不能说年轻了。`,
    }
  }
  if (delta < -band) {
    return {
      allows_younger: true,
      headline_zh: `身体年龄 ${pheno}（模型估计）。${window}你年轻了 ${formatNumber({ value: -delta, unit: '岁' })}，超出正常波动。`,
    }
  }
  return {
    allows_younger: false,
    headline_zh: `身体年龄 ${pheno}（模型估计）。${window}比上次大了 ${formatNumber({ value: delta, unit: '岁' })}，超出正常波动。`,
  }
}

const SERIES_KEEP = 6
/** Same cap as changes.ts: the card shows the changes that clear it, ask-doctor and plan markers first. */
const SERIES_MAX = 6
const GLUCOSE_KEYS = ['glucose', 'hba1c']
const WORSE_ZH = '建议带着这几次体检报告咨询医生，看看是否需要进一步检查。'
const RANGE_ZH = '变化超出了正常波动；是否需要处理要结合参考范围判断，建议带着这几次体检报告咨询医生。'
const BETTER_ZH = '变化超出了正常波动，方向是好的。'
const NEUTRAL_ZH = '变化超出了正常波动。'
const GLUCOSE_FALL_ZH = '变化超出了正常波动。你有糖尿病或在用降糖药，血糖类指标明显下降也需要留意，建议带着这几次体检报告咨询医生。'

type DayPoint = { date: string; value: number }

export interface SeriesJudgement {
  /** A move past the reference change value, or null when the series is inside the band or too short. */
  change: RecordChange | null
  /** A newer reading could not be converted, so the older points are not the latest result. */
  blocked: boolean
  /** At least two convertible days and nothing blocked: the band comparison was made. */
  complete: boolean
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function shown(value: number): string {
  return String(Number(value.toPrecision(4)))
}

function withUnit(value: number, unit: string): string {
  return unit === '%' ? `${shown(value)}%` : `${shown(value)} ${unit}`.trim()
}

/** One convertible value per day, the last six. A trailing point in an unknown unit blocks the judgement. */
function dailyPoints(marker: BiovarMarker, readings: readonly SeriesPoint[]): { points: DayPoint[]; blocked: boolean } {
  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  const byDay = new Map<string, number>()
  let blocked = false
  for (const point of sorted) {
    const factor = factorFor(marker, point.unit)
    if (factor == null || !Number.isFinite(point.value)) {
      if (factor == null) blocked = true
      continue
    }
    blocked = false
    byDay.set(point.date, factor === 1 ? point.value : Number((point.value * factor).toPrecision(6)))
  }
  const points = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value })).slice(-SERIES_KEEP)
  return { points, blocked }
}

/**
 * The same comparison changes.ts makes, for a series that read already holds.
 * Used when the changes read failed or skipped a code, so a real move is not left off the card.
 */
export function judgeSeries(marker: BiovarMarker, readings: readonly SeriesPoint[], z: number, glucoseTreated: boolean, sex = 'unknown'): SeriesJudgement {
  const daily = dailyPoints(marker, readings)
  if (daily.blocked) return { change: null, blocked: true, complete: false }
  if (daily.points.length < 2) return { change: null, blocked: false, complete: false }
  const last = daily.points.at(-1) as DayPoint
  const band = rcvBand(marker, z)
  const options = [compared(daily.points.at(-2) as DayPoint, last, band)]
  if (daily.points.length >= 3) options.push(compared(daily.points[0] as DayPoint, last, band))
  const pick = options.filter((row): row is Compared => row != null).sort((a, b) => b.ratio - a.ratio)[0]
  if (!pick) return { change: null, blocked: false, complete: true }
  const direction = pick.pct > 0 ? 'up' : 'down'
  // Fasting glucose that came down from above the usual range (6.1 mmol/L) into it, with no glucose-lowering
  // treatment, is good news: the body-age story and this row then say the same thing. Any other fall stays unclear.
  const intoRange = marker.key === 'glucose' && !glucoseTreated && direction === 'down'
    && pick.from.value > 6.1 && pick.to.value >= 3.9 && pick.to.value <= 6.1
  const glucoseFall = !intoRange && direction === 'down' && GLUCOSE_KEYS.includes(marker.key) && (glucoseTreated || marker.key === 'glucose')
  const verdict = glucoseFall ? 'unclear' : verdictOf(marker.better, direction)
  const wbcInside = marker.key === 'wbc' && [pick.from.value, pick.to.value].every((value) => value >= 3.5 && value <= 9.5)
  const askDoctor = !wbcInside && (verdict === 'worse' || (verdict === 'unclear' && marker.better === 'range') || (glucoseFall && glucoseTreated))
  const up = round1(band.up * 100)
  const down = marker.log_normal ? round1(band.down * 100) : -up
  const range = marker.better === 'range' ? rangeFlag(marker.key, last.value, sex) : null
  const bandText = marker.log_normal ? `${down.toFixed(1)}% 至 +${up.toFixed(1)}%` : `±${up.toFixed(1)}%`
  return {
    blocked: false,
    complete: true,
    change: {
      key: marker.key,
      label_zh: marker.label_zh,
      unit: marker.unit,
      points: daily.points,
      compare: { from_date: pick.from.date, from: pick.from.value, to_date: pick.to.date, to: pick.to.value, pct: round1(pick.pct) },
      band_pct: { up, down },
      direction,
      verdict,
      ask_doctor: askDoctor,
      text_zh: `${marker.label_zh} ${marker.unit === '%' ? `${shown(pick.from.value)}%` : shown(pick.from.value)} → ${withUnit(pick.to.value, marker.unit)}（${pick.from.date} → ${pick.to.date}），${direction === 'down' ? '下降' : '上升'} ${Math.abs(pick.pct).toFixed(1)}%，超出正常波动（${bandText}）`,
      advice_zh: verdict === 'worse' ? WORSE_ZH : verdict === 'better' ? BETTER_ZH : glucoseFall && askDoctor ? GLUCOSE_FALL_ZH : askDoctor ? (range ? range.text_zh : RANGE_ZH) : NEUTRAL_ZH,
      ...(askDoctor && range ? { range_flag: range.flag } : {}),
      ...(marker.caveat_zh ? { caveat_zh: marker.caveat_zh } : {}),
      source: { title: marker.cvi_source.title, url: marker.cvi_source.url, ...(marker.cvi_source.doi ? { doi: marker.cvi_source.doi } : {}) },
      verified: marker.verified,
    },
  }
}

interface Compared {
  from: DayPoint
  to: DayPoint
  pct: number
  ratio: number
}

function compared(from: DayPoint, to: DayPoint, band: { up: number; down: number }): Compared | null {
  if (from.value === 0) return null
  const pct = ((to.value - from.value) / from.value) * 100
  if (!(pct > band.up * 100 || pct < band.down * 100)) return null
  const side = Math.abs((pct > 0 ? band.up : band.down) * 100)
  return side > 0 ? { from, to, pct, ratio: Math.abs(pct) / side } : null
}

function verdictOf(better: BiovarMarker['better'], direction: RecordChange['direction']): RecordChange['verdict'] {
  if (better === 'lower') return direction === 'down' ? 'better' : 'worse'
  if (better === 'higher') return direction === 'up' ? 'better' : 'worse'
  return 'unclear'
}

export interface MissedPlanInput {
  changes: RecordChange[]
  unjudged: UnjudgedChange[]
  resolved: ReadonlyArray<{ indicator: string | null; also?: readonly string[]; biovar: BiovarMarker | null }>
  series: Record<string, readonly SeriesPoint[]>
  /** Names whose own read failed or was cut. Their marker is left unjudged. */
  unread: ReadonlySet<string>
  z: number
  glucoseTreated: boolean
  /** Used for the usual adult range on haemoglobin, MCV and the other range markers. */
  sex?: string
}

/**
 * Plan markers the changes read missed (a code it does not list, or 「不是指标表」).
 * The series the verdicts already loaded is judged with the same band. A marker
 * that read here, inside the band or past it, leaves the unjudged list.
 */
export function missedPlanChanges(input: MissedPlanInput): { changes: RecordChange[]; unjudged: UnjudgedChange[] } {
  const have = new Set(input.changes.map((row) => row.key))
  const extra: RecordChange[] = []
  const drop = new Set<string>()
  for (const row of input.resolved) {
    const marker = row.biovar
    if (!marker || marker.average_days || have.has(marker.key)) continue
    const names = [row.indicator, ...(row.also ?? [])].filter((name): name is string => Boolean(name))
    if (names.length === 0 || names.some((name) => input.unread.has(name))) continue
    const readings = names.flatMap((name) => input.series[name] ?? [])
    if (readings.length === 0) continue
    const judged = judgeSeries(marker, readings, input.z, input.glucoseTreated, input.sex ?? 'unknown')
    if (judged.blocked || !judged.complete) continue
    if (judged.change) {
      const text = judged.change.verdict === 'worse' && !judged.change.text_zh.includes('反向')
        ? `${judged.change.text_zh}（反向）`
        : judged.change.text_zh
      extra.push({ ...judged.change, text_zh: text })
      have.add(marker.key)
    }
    drop.add(marker.label_zh)
  }
  const unjudged = input.unjudged.filter((row) => !drop.has(row.label_zh))
  if (extra.length === 0) return { changes: input.changes, unjudged }
  const planKeys = new Set(extra.map((row) => row.key))
  const merged = [...input.changes, ...extra].sort((a, b) => {
    const rank = (row: RecordChange) => (planKeys.has(row.key) ? 2 : 0) + (row.ask_doctor ? 1 : 0)
    const byRank = rank(b) - rank(a)
    return byRank !== 0 ? byRank : Math.abs(b.compare.pct) - Math.abs(a.compare.pct)
  })
  return { changes: merged.slice(0, SERIES_MAX), unjudged }
}
