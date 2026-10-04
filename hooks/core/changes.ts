// Changes in the record larger than normal fluctuation. For every checkup
// marker with a biological-variation row, the latest result is set against the
// one before it and against the first of the last six, and a change counts only
// when it is larger than the reference change value (RCV): the same, sourced
// criterion the plan verdicts use. Nothing else is invented: no reference
// ranges, no thresholds of our own. A change in the wrong direction, or in
// either direction on a marker judged by its reference range (haemoglobin,
// MCV), is one to show a doctor; a marker with no good direction (weight) is
// shown neutrally. A fall in blood glucose is not called good news: for
// someone with diabetes or on a glucose-lowering medicine it goes to a doctor
// too. This module never names a cause.

import type { Config } from './config.ts'
import { dateZh, minusZh } from './ux/plain.ts'
import { addDays } from './interventions.ts'
import { loadSeries, recordReadable, type RecordSnapshot, type SeriesPoint } from './records.ts'
import { checkupMarkerFor, loadReference, rcvBand, type BiovarMarker } from './reference.ts'
import { currentMedications, GLUCOSE_LOWERING } from './situation.ts'
import { normalizeUnit } from './units.ts'

export interface RecordChange {
  /** Biological-variation key, e.g. 'mcv'. */
  key: string
  label_zh: string
  /** The biological-variation row's unit; every point is converted to it. */
  unit: string
  points: Array<{ date: string; value: number }>
  /** pct is rounded to 1 decimal. */
  compare: { from_date: string; from: number; to_date: string; to: number; pct: number }
  /** The reference change value in percent, 1 decimal, e.g. { up: 8.4, down: -8.4 }. */
  band_pct: { up: number; down: number }
  direction: 'up' | 'down'
  verdict: 'better' | 'worse' | 'unclear'
  ask_doctor: boolean
  text_zh: string
  advice_zh: string
  /** The row's own caveat, when it has one. */
  caveat_zh?: string
  /** 0.5.3 (M1): the latest value is outside the usual adult range: named low or high, never "cannot judge". */
  range_flag?: 'low' | 'high'
  /** Where the within-person variation comes from (the row's cvi_source). */
  source: { title: string; url: string; doi?: string }
  verified: boolean
}

/** A marker the changes could not judge: its readings did not come back whole. Unknown, never "no change". */
export interface UnjudgedChange {
  label_zh: string
  reason_zh: string
}

export interface ChangesContext {
  config: Config
  skillsHome: string
  records: RecordSnapshot
  today: string
}

export const CHANGES_NOTE_ZH = '判断依据：两次结果之差需大于同一个人平时的波动，才视为值得注意的变化。不同医院、不同仪器之间的差异未计入；如果两次不在同一家机构，请先复查确认。这不是诊断。'
const WORSE_ZH = '建议带着这几次体检报告咨询医生，评估是否需要进一步检查。'
// A 'range' marker (haemoglobin, MCV, white cells) can be fine or not either way; only the lab's reference range tells.
const RANGE_ZH = '变化超出了正常波动；是否需要处理要结合参考范围判断，建议带着这几次体检报告咨询医生。'
const BETTER_ZH = '变化超出了正常波动，方向是好的。'
/**
 * Usual adult ranges for the markers judged by a range (the report's own range is not in the record).
 * When sex is unknown and the limits differ, only a value outside both ranges is flagged.
 * A value between them waits for sex instead of using the men's limit.
 */
const RANGES: Record<string, { male: [number, number]; female: [number, number] }> = {
  hb: { male: [130, 175], female: [115, 150] },
  hct: { male: [0.40, 0.50], female: [0.35, 0.45] },
  rbc: { male: [4.3, 5.8], female: [3.8, 5.1] },
  mcv: { male: [82, 100], female: [82, 100] },
  mch: { male: [27, 34], female: [27, 34] },
  mchc: { male: [316, 354], female: [316, 354] },
  wbc: { male: [3.5, 9.5], female: [3.5, 9.5] },
}

/** Low or high against the usual range, with the words for it; null inside it or for other markers. */
export function rangeFlag(key: string, value: number, sex: string): { flag: 'low' | 'high'; text_zh: string } | null {
  const range = RANGES[key]
  if (!range) return null
  const differs = range.male[0] !== range.female[0] || range.male[1] !== range.female[1]
  if (differs && sex !== 'male' && sex !== 'female') {
    const lowLine = Math.min(range.male[0], range.female[0])
    const highLine = Math.max(range.male[1], range.female[1])
    if (value < lowLine) return { flag: 'low', text_zh: `最近一次 ${shown(value)} 低于男女通用的偏低下限 ${lowLine}，偏低。建议带着这几次体检报告咨询医生。` }
    if (value > highLine) return { flag: 'high', text_zh: `最近一次 ${shown(value)} 高于男女通用的偏高上限 ${highLine}，偏高。建议带着这几次体检报告咨询医生。` }
    return null
  }
  const [low, high] = sex === 'female' ? range.female : range.male
  const who = differs ? (sex === 'female' ? '女性' : '男性') : ''
  if (value < low) return { flag: 'low', text_zh: `最近一次 ${shown(value)} 低于${who}常用参考下限 ${low}，偏低。建议带着这几次体检报告咨询医生。` }
  if (value > high) return { flag: 'high', text_zh: `最近一次 ${shown(value)} 高于${who}常用参考上限 ${high}，偏高。建议带着这几次体检报告咨询医生。` }
  return null
}

interface LevelRow {
  low: number
  high: number
  unit: string
  sexed: boolean
}

/** Usual adult limits for a single value. The report's own range is not stored on the series, so these are the printed limits the page can apply. */
const LEVELS: Array<{ test: (label: string) => boolean; male: LevelRow; female: LevelRow }> = [
  { test: (label) => /铁蛋白|ferritin/i.test(label), male: { low: 30, high: 400, unit: 'ng/mL', sexed: true }, female: { low: 15, high: 400, unit: 'ng/mL', sexed: true } },
  { test: (label) => /血红蛋白/.test(label) && !/平均|糖化|浓度|含量/.test(label), male: { low: 130, high: 175, unit: 'g/L', sexed: true }, female: { low: 115, high: 150, unit: 'g/L', sexed: true } },
  { test: (label) => /平均红细胞体积|^MCV\b/i.test(label), male: { low: 82, high: 100, unit: 'fL', sexed: false }, female: { low: 82, high: 100, unit: 'fL', sexed: false } },
  { test: (label) => /红细胞分布宽度/.test(label) && !/标准差/.test(label), male: { low: 11, high: 15, unit: '%', sexed: false }, female: { low: 11, high: 15, unit: '%', sexed: false } },
]

/**
 * A single result against the usual adult range. Null when this marker has no row here, or the value sits inside it.
 * Sex unknown uses the male (higher) lower bound and says so, so a low value is not missed.
 */
export function absoluteLevel(label: string, value: number, unit: string, sex: string): { flag: 'low' | 'high'; text_zh: string } | null {
  const row = LEVELS.find((item) => item.test(label))
  if (!row || !Number.isFinite(value)) return null
  const band = sex === 'female' ? row.female : row.male
  const given = unit.replace(/\s/g, '')
  const expected = band.unit.replace(/\s/g, '')
  if (given && expected && given.toLowerCase() !== expected.toLowerCase() && !(expected === 'ng/mL' && /μg\/L|ug\/L/i.test(given))) return null
  const who = band.sexed ? (sex === 'female' ? '女性' : '男性') : ''
  const unknown = sex !== 'female' && sex !== 'male' && band.sexed ? `（档案中尚无性别，暂按男性下限 ${band.low}；女性下限为 ${row.female.low}）` : ''
  if (value < band.low) return { flag: 'low', text_zh: `最近一次 ${shown(value)} ${band.unit} 低于${who}常用参考下限 ${band.low}，偏低。${unknown}建议带着报告咨询医生。` }
  if (value > band.high) return { flag: 'high', text_zh: `最近一次 ${shown(value)} ${band.unit} 高于${who}常用参考上限 ${band.high}，偏高。${unknown}建议带着报告咨询医生。` }
  return null
}
// Weight and other rows without a better direction: a real change, nothing more to say.
const NEUTRAL_ZH = '变化超出了正常波动。'
// A fall in these can go too far (low blood glucose), above all on a glucose-lowering medicine.
const GLUCOSE_KEYS = ['glucose', 'hba1c']
const GLUCOSE_FALL_ZH = '变化超出了正常波动。你有糖尿病或在用降糖药，血糖类指标明显下降也需要留意，建议带着这几次体检报告咨询医生。'
/** Checkup days kept per marker, the most recent. */
const KEEP_POINTS = 6
const MAX_CHANGES = 6
/** Far enough back for any checkup history; only the most recent days are kept. */
const LOOKBACK_DAYS = 10 * 365
/** Indicators per Mirobody read. The reads run in parallel. */
const READ_CHUNK = 6

type Point = { date: string; value: number }

/** The factor that brings a point's unit to the row's unit, from the row's own convert table; null when it cannot. The plan verdicts (evaluate.ts) use it too. */
export function factorFor(marker: BiovarMarker, unit: string): number | null {
  const given = normalizeUnit(unit)
  // A point without a unit cannot be checked against the row's unit, so it is left out.
  if (!given) return null
  if (given === normalizeUnit(marker.unit)) return 1
  for (const [name, factor] of Object.entries(marker.convert ?? {})) {
    if (normalizeUnit(name) === given) return factor
  }
  return null
}

/**
 * One point per day (the last reading of that day that converts), oldest first, the most recent
 * KEEP_POINTS days. blocked: a newer reading could not be converted, so the older points are not the
 * latest result and must not be reported as the change.
 */
function dailyPoints(marker: BiovarMarker, readings: readonly SeriesPoint[]): { points: Point[]; blocked: boolean } {
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
  const points = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value })).slice(-KEEP_POINTS)
  return { points, blocked }
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

interface Candidate {
  from: Point
  to: Point
  pct: number
  /** How far past the band, as |pct| over the band on that side. */
  ratio: number
}

function compared(from: Point, to: Point, band: { up: number; down: number }): Candidate | null {
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

function changeOf(marker: BiovarMarker, points: Point[], z: number, glucoseTreated: boolean, sex = 'unknown'): (RecordChange & { ratio: number }) | null {
  if (points.length < 2) return null
  const last = points.at(-1) as Point
  const band = rcvBand(marker, z)
  const options = [compared(points.at(-2) as Point, last, band)]
  if (points.length >= 3) options.push(compared(points[0] as Point, last, band))
  const pick = options.filter((row): row is Candidate => row != null).sort((a, b) => b.ratio - a.ratio)[0]
  if (!pick) return null
  const direction = pick.pct > 0 ? 'up' : 'down'
  // Fasting glucose falling is never called good news; HbA1c falling is, unless the person is treated for diabetes.
  // Fasting glucose that came down from above the usual range (6.1 mmol/L) into it, with no glucose-lowering
  // treatment, is good news: the body-age story and this row then say the same thing. Any other fall stays unclear.
  const intoRange = marker.key === 'glucose' && !glucoseTreated && direction === 'down'
    && pick.from.value > 6.1 && pick.to.value >= 3.9 && pick.to.value <= 6.1
  const glucoseFall = !intoRange && direction === 'down' && GLUCOSE_KEYS.includes(marker.key) && (glucoseTreated || marker.key === 'glucose')
  const verdict = glucoseFall ? 'unclear' : verdictOf(marker.better, direction)
  // A white-cell count that stays inside the usual adult range is not a reason to send someone to a doctor
  // just because it cleared a tight desirable-CVA band (about ±31%).
  const wbcInside = marker.key === 'wbc' && [pick.from.value, pick.to.value].every((value) => value >= 3.5 && value <= 9.5)
  const askDoctor = !wbcInside && (verdict === 'worse' || (verdict === 'unclear' && marker.better === 'range') || (glucoseFall && glucoseTreated))
  const up = round1(band.up * 100)
  const down = marker.log_normal ? round1(band.down * 100) : -up
  const range = marker.better === 'range' ? rangeFlag(marker.key, last.value, sex) : null
  // Log-normal rows (CRP, triglycerides) have an asymmetric band: both sides are shown.
  const bandText = marker.log_normal ? `${minusZh(down.toFixed(1))}% 至 +${up.toFixed(1)}%` : `±${up.toFixed(1)}%`
  return {
    key: marker.key,
    label_zh: marker.label_zh,
    unit: marker.unit,
    points,
    compare: { from_date: pick.from.date, from: pick.from.value, to_date: pick.to.date, to: pick.to.value, pct: round1(pick.pct) },
    band_pct: { up, down },
    direction,
    verdict,
    ask_doctor: askDoctor,
    text_zh: `${marker.label_zh} ${marker.unit === '%' ? `${shown(pick.from.value)}%` : shown(pick.from.value)} → ${withUnit(pick.to.value, marker.unit)}（${dateZh(pick.from.date)} → ${dateZh(pick.to.date)}），${direction === 'down' ? '下降' : '上升'} ${Math.abs(pick.pct).toFixed(1)}%，超出正常波动（${bandText}）`,
    advice_zh: verdict === 'worse' ? WORSE_ZH : verdict === 'better' ? BETTER_ZH : glucoseFall && askDoctor ? GLUCOSE_FALL_ZH : askDoctor ? (range ? range.text_zh : RANGE_ZH) : NEUTRAL_ZH,
    ...(askDoctor && range ? { range_flag: range.flag } : {}),
    ...(marker.caveat_zh ? { caveat_zh: marker.caveat_zh } : {}),
    source: { title: marker.cvi_source.title, url: marker.cvi_source.url, ...(marker.cvi_source.doi ? { doi: marker.cvi_source.doi } : {}) },
    verified: marker.verified,
    ratio: pick.ratio,
  }
}

/**
 * Changes between checkups larger than the reference change value, ask_doctor
 * first, then the furthest past its band; at most six. Checkup rows only
 * (Mirobody rows with a LOINC code): wearable series and the person's own
 * measurements are left out. An unread record gives no changes. A marker whose
 * readings failed to read, or came back cut, is not judged at all: it is listed
 * in unjudged with the reason, so a failed read never reads as "no change".
 */
export async function buildChanges(context: ChangesContext): Promise<{ changes: RecordChange[]; note_zh: string; unjudged: UnjudgedChange[] }> {
  const empty = { changes: [], note_zh: CHANGES_NOTE_ZH, unjudged: [] }
  if (!recordReadable(context.records)) return empty
  const { biovar } = loadReference(context.skillsHome)
  // Rows measuring the same thing under different codes (two glucose LOINCs) are one marker.
  const byKey = new Map<string, { marker: BiovarMarker; names: string[] }>()
  for (const row of context.records.indicators) {
    if (row.source === 'self' || !row.loinc) continue
    // By LOINC: a name alone would pool urine creatinine or urine glucose into the blood marker.
    const marker = checkupMarkerFor(biovar, row)
    // A marker compared on multi-day means (home blood pressure) has no band for a single reading.
    if (!marker || marker.average_days) continue
    const entry = byKey.get(marker.key) ?? { marker, names: [] }
    if (!entry.names.includes(row.name)) entry.names.push(row.name)
    byKey.set(marker.key, entry)
  }
  const names = [...new Set([...byKey.values()].flatMap((entry) => entry.names))]
  const glucoseTreatedEarly = context.records.profile.risk.diabetes === true || currentMedications(context.records.medications).some((name) => GLUCOSE_LOWERING.test(name))
  const watchEarly = glucoseTreatedEarly ? diabetesWatch(context.records.indicators) : []
  if (names.length === 0) {
    return { changes: watchEarly.map(({ ratio: _ratio, ...row }) => row), note_zh: CHANGES_NOTE_ZH, unjudged: [] }
  }
  const window = { start: addDays(context.today, -LOOKBACK_DAYS), end: context.today, resolution: 'raw' as const }
  const chunks: string[][] = []
  for (let start = 0; start < names.length; start += READ_CHUNK) chunks.push(names.slice(start, start + READ_CHUNK))
  const reads = await Promise.all(chunks.map((chunk) => loadSeries(context.config, chunk, window)))
  const series: Record<string, SeriesPoint[]> = {}
  const failed = new Map<string, string>()
  const cut = new Set<string>()
  for (const read of reads) {
    for (const [name, row] of Object.entries(read.series)) series[name] = row.points
    for (const name of read.failed) failed.set(name, read.error ?? '')
    for (const name of read.cut) cut.add(name)
  }
  const { profile, medications } = context.records
  const glucoseTreated = profile.risk.diabetes === true || currentMedications(medications).some((name) => GLUCOSE_LOWERING.test(name))
  const found: Array<RecordChange & { ratio: number }> = []
  const unjudged: UnjudgedChange[] = []
  for (const { marker, names: rows } of byKey.values()) {
    const broken = rows.find((name) => failed.has(name))
    if (broken != null) {
      const error = failed.get(broken)
      unjudged.push({ label_zh: marker.label_zh, reason_zh: `历次结果读取失败${error ? `：${error}` : ''}，这次没有判断它的变化。` })
      continue
    }
    if (rows.some((name) => cut.has(name))) {
      unjudged.push({ label_zh: marker.label_zh, reason_zh: '历次结果过多，读取时被截断，未完整读取，本次未判断其变化。' })
      continue
    }
    const daily = dailyPoints(marker, rows.flatMap((name) => series[name] ?? []))
    if (daily.blocked) {
      unjudged.push({ label_zh: marker.label_zh, reason_zh: `有一次较新的结果单位无法换算成 ${marker.unit}，这次没有判断它的变化。` })
      continue
    }
    const change = changeOf(marker, daily.points, biovar.z, glucoseTreated, profile.sex)
    if (change) found.push(change)
  }
  found.sort((a, b) => Number(b.ask_doctor) - Number(a.ask_doctor) || b.ratio - a.ratio)
  const watch = glucoseTreated ? diabetesWatch(context.records.indicators) : []
  const seen = new Set(watch.map((row) => row.key))
  const merged = [...watch, ...found.filter((row) => !seen.has(row.key))]
  return { changes: merged.slice(0, MAX_CHANGES + watch.length).map(({ ratio: _ratio, ...row }) => row), note_zh: CHANGES_NOTE_ZH, unjudged }
}

const WATCH_SOURCE = { title: 'KDIGO 慢性肾病评估（白蛋白尿与 eGFR 分界）', url: 'https://kdigo.org/guidelines/ckd-evaluation-and-management/' }

/** One current value a person with diabetes should see on 值得注意, even with a single draw. */
function diabetesWatch(indicators: RecordSnapshot['indicators']): Array<RecordChange & { ratio: number }> {
  const out: Array<RecordChange & { ratio: number }> = []
  const textOf = (row: RecordSnapshot['indicators'][number]) => `${row.label ?? ''} ${row.name} ${row.value}`
  const numberOf = (row: RecordSnapshot['indicators'][number]) => {
    const value = Number(String(row.value).replace(/,/g, ''))
    return Number.isFinite(value) ? value : null
  }
  const push = (key: string, label: string, value: number, unit: string, date: string, advice: string) => {
    out.push({
      key, label_zh: label, unit,
      points: [{ date, value }],
      compare: { from_date: date, from: value, to_date: date, to: value, pct: 0 },
      band_pct: { up: 0, down: 0 },
      direction: 'up',
      verdict: 'unclear',
      ask_doctor: true,
      text_zh: advice,
      advice_zh: advice,
      source: WATCH_SOURCE,
      verified: true,
      ratio: 100,
    })
  }
  for (const row of indicators) {
    const text = textOf(row)
    const date = (row.date || row.last_date || '').slice(0, 10)
    const value = numberOf(row)
    if (/血清|总蛋白|白蛋白电泳/.test(text) && !/尿/.test(text)) continue
    if (value != null && /尿白蛋白.?肌酐|尿微量白蛋白|UACR|\bACR\b/i.test(text) && value >= 30) {
      push('uacr', '尿白蛋白/肌酐比', value, row.unit || 'mg/g', date || '未知日期', `尿白蛋白/肌酐比 ${value} ${row.unit || 'mg/g'}（${date}）高于常用分界 30 mg/g。如有糖尿病，请将此项带给医生查看；「未判断」不代表正常。`)
    } else if (/尿蛋白/.test(text) && !/肌酐|白蛋白.?肌酐|UACR/i.test(text) && /阳性|\+|↑|偏高/.test(String(row.value))) {
      push('urine-protein', '尿蛋白', value ?? 1, row.unit || '', date || '未知日期', `尿蛋白 ${row.value}（${date}）。如有糖尿病，请将尿蛋白结果带给医生查看；「未判断」不代表正常。`)
    } else if (value != null && value < 60 && value > 5 && /egfr|肾小球滤过/i.test(text)) {
      push('egfr', 'eGFR', value, row.unit || 'mL/min/1.73m²', date || '未知日期', `eGFR ${value} ${row.unit || ''}（${date}）低于 60。如有糖尿病，请与医生一起评估肾功能；「未判断」不代表正常。`)
    } else if (/眼底|视网膜/.test(text) && /微动脉瘤|视网膜病变|新生血管|出血/.test(text)) {
      push('retina', '眼底', value ?? 1, '', date || '未知日期', `眼底记录（${date}）：${String(row.value).slice(0, 80)}。如有糖尿病，请将此项带给眼科或内分泌科医生查看；「未判断」不代表正常。`)
    }
  }
  return out
}
