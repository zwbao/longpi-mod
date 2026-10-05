// The 指标 tab: every indicator on record, by group, each with its latest
// value, a short trend, and whether its last change is larger than normal
// fluctuation. Checkup rows (Mirobody rows with a LOINC code) show their
// checkup days; the wearable's series show weekly means of daily values; the
// person's own measurements show their days. A series whose read failed or
// timed out says so and is never shown as "no data". Nothing is judged here
// that changes.ts would judge differently: a row is 波动内 only when its last
// change, and the change since the first of its last six checkups, stay
// inside the reference change value of its biological-variation row; a
// change beyond it is shown with the row changes.ts gives, or not judged.
// The same reads give the record summary the onboarding shows.

import { createHash } from '../sys/crypto.ts'
import { absoluteLevel, buildChanges, type RecordChange } from './changes.ts'
import type { Config } from './config.ts'
import { connectionKey } from './connection.ts'
import { resolveMarkers } from './evaluate.ts'
import { GROUP_KEYS, GROUP_ZH, groupOf, type GroupKey } from './groups.ts'
import { addDays, currentPlan } from './interventions.ts'
import { codedRecords, compareGate, judgeSeries } from './honesty/comparability.ts'
import { loadSeries, type RecordSnapshot, type SeriesPoint, type SeriesResult } from './records.ts'
import { checkupMarkerFor, expandMarkerNames, loadReference, markerFor, rcvBand, type BiovarMarker } from './reference.ts'
import { readSelf, selfSeries, SELF_DEVICE_NAMES, SELF_KEYS, SELF_SPEC, SELF_SUFFIX, type SelfKey, type SelfRow } from './selfmeasure.ts'
import { currentMedications, GLUCOSE_LOWERING, type IndicatorRow } from './situation.ts'
import { trackingGeneration } from './tracking.ts'
import { foldName, canonicalName, normalizeUnit, parseNumber } from './units.ts'
import { localRecordNow, isLocalMcp } from './mcp.ts'
import { printedLevels } from './local-record.ts'

export type { GroupKey } from './groups.ts'
export type IndicatorSource = 'checkup' | 'device' | 'self'

export interface IndicatorChange {
  verdict: 'better' | 'worse' | 'unclear'
  ask_doctor: boolean
  pct: number
  band_pct: { up: number; down: number }
  text_zh: string
}

/** One row of the 指标 tab (the client's IndicatorRow). */
export interface IndicatorEntry {
  /** Stable: 'loinc:<code>' | 'device:<name>' | 'self:<key>' | 'name:<folded name>'. */
  id: string
  label_zh: string
  unit: string
  source: IndicatorSource
  /** text for a result that is not a number ("阴性", "<3.0"). */
  latest: { date: string; value: number | null; text?: string } | null
  /** Oldest first. Checkups: one per day, the 12 most recent; device: weekly means, 26 weeks; self: daily, 30. */
  points: Array<{ date: string; value: number }>
  /** From changes.ts, when it lists this indicator. */
  change: IndicatorChange | null
  /** within: two or more checkup days and the last change inside the band; unjudged: no band, too few days, or a failed read. */
  judged: 'changed' | 'within' | 'unjudged'
  plan_marker: boolean
  /** The series read failed or timed out: show this, never "no data". */
  read_error?: string
  /** Set when the last two draws are too close, or from different institutions. Not 波动内. */
  gate?: 'too_early' | 'not_comparable'
  /** The 太早 or 不可比 sentence. The indicators page shows it next to the chip. */
  reason_zh?: string
  /** A single value outside the usual adult range. Shown even when the change itself is unjudged. */
  range_flag?: 'low' | 'high'
  range_zh?: string
}

export interface IndicatorsResponse {
  /** partial: some series could not be read; their rows carry read_error. */
  record: { status: 'ok' | 'partial' | 'error' | 'none'; error?: string }
  updated_at: string
  groups: Array<{ key: GroupKey; label_zh: string; indicators: IndicatorEntry[] }>
}

export interface IndicatorDetail {
  row: IndicatorEntry
  /** Every reading, oldest first, the 200 most recent, each in the unit it was recorded in. */
  all_points: Array<{ date: string; value: number | null; text?: string; file?: string; unit: string }>
  /** The biological-variation row a checkup row is judged against. */
  biovar?: { cvi_pct: number; band_pct: { up: number; down: number }; source: { title: string; url: string; doi?: string }; caveat_zh?: string }
}

/**
 * What the record holds, for onboarding: checkup days (distinct dates of LOINC rows), their span, the checkup
 * groups present (most rows first; 其他 left out), wearable days in the last year.
 */
export interface RecordsSummary {
  checkups: number
  first_date: string | null
  last_date: string | null
  categories_zh: string[]
  wearable_days: number
}

export interface IndicatorsContext {
  config: Config
  dataDir: string
  skillsHome: string
  records: RecordSnapshot
  today: string
  /** How long the reads may take before the rows not read yet say so. Default 20 s. */
  budgetMs?: number
}

const BUDGET_MS = 20_000
const CACHE_TTL_MS = 60_000
/** Far enough back for any checkup history. */
const CHECKUP_LOOKBACK_DAYS = 10 * 365
const WEARABLE_LOOKBACK_DAYS = 365
const CHECKUP_POINTS = 12
const JUDGE_POINTS = 6
const DEVICE_WEEKS = 26
const SELF_POINTS = 30
const DETAIL_POINTS = 200
/** Indicators per Mirobody read; the reads run in parallel. A year of daily values is ~365 rows per name. */
const CHECKUP_CHUNK = 6
const DEVICE_CHUNK = 4
const TIMEOUT_ZH = '读取超时，请稍后刷新。'

// Wearable series Mirobody names in camelCase; the ones LongPi knows get a Chinese label and unit.
const DEVICE_ZH: Record<string, { label: string; unit?: string }> = {
  dailySteps: { label: '每日步数', unit: '步' },
  steps: { label: '步数', unit: '步' },
  sleepDuration: { label: '每晚睡眠', unit: '小时' },
  deepSleepDuration: { label: '深睡时长', unit: '小时' },
  restingHeartRate: { label: '静息心率（手环）', unit: '次/分' },
  heartRates: { label: '心率', unit: '次/分' },
  hrvRmssd: { label: '心率变异性（睡眠）', unit: '毫秒' },
  hrv: { label: '心率变异性（睡眠）', unit: '毫秒' },
  spo2Min: { label: '夜间最低血氧', unit: '%' },
  spo2: { label: '血氧', unit: '%' },
  activeEnergy: { label: '活动消耗', unit: '千卡' },
  vo2Max: { label: '最大摄氧量', unit: 'mL/kg/min' },
  dailyTotalSleepTime: { label: '每晚睡眠', unit: '小时' },
  dailyRestingHeartRates: { label: '静息心率', unit: '次/分' },
  systolicPressures: { label: '收缩压' },
  diastolicPressures: { label: '舒张压' },
  bodyMasss: { label: '体重' },
  bodyMass: { label: '体重' },
}
const UNIT_ZH: Record<string, string> = { hours: '小时', h: '小时', 'count/min': '次/分', bpm: '次/分', ms: '毫秒', count: '次', kcal: '千卡' }

interface Spec {
  id: string
  source: IndicatorSource
  group: GroupKey
  label: string
  unit: string
  /** Mirobody names holding its values. */
  names: string[]
  loinc?: string
  snapshot: IndicatorRow | null
  selfKey?: SelfKey
  marker: BiovarMarker | null
}

type Read = { names: string[]; resolution: 'raw' | 'day'; result?: SeriesResult }

interface Built {
  response: IndicatorsResponse
  details: Map<string, Omit<IndicatorDetail, 'row'>>
  summary: RecordsSummary | null
}

const memo = new Map<string, { settled: number | null; value: Promise<Built> }>()

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** The value of a promise, or null when it has not settled within ms. */
async function deadline<T>(promise: Promise<T>, ms: number): Promise<{ value: T } | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms)
    timer.unref?.()
  })
  try {
    return await Promise.race([promise.then((value) => ({ value })), late])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function isDeviceName(name: string, biovar: readonly BiovarMarker[]): boolean {
  if (name in DEVICE_ZH) return true
  if (Object.values(SELF_DEVICE_NAMES).some((names) => names?.includes(name))) return true
  if (biovar.some((row) => (row.device_codes ?? []).includes(name))) return true
  // Mirobody's device series are camelCase (dailySteps, heartRates); report names never are.
  return /^[a-z]+[0-9]*(?:[A-Z][a-z0-9]*)+$/.test(name)
}

/** A wearable series with no Chinese name of its own: never the raw field name on the page. */
function deviceLabel(label: string | undefined, name: string): string {
  if (label && /[\u4e00-\u9fff]/.test(label)) return label
  return `手环数据（${name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()}）`
}

function newer(a: IndicatorRow | null, b: IndicatorRow): IndicatorRow {
  if (!a) return b
  return (b.date ?? b.last_date ?? '') > (a.date ?? a.last_date ?? '') ? b : a
}

/** The rows to show, one per LOINC code, device series, self key or uncoded report name. */
export function specsOf(records: RecordSnapshot, selfRows: readonly SelfRow[], markers: readonly BiovarMarker[]): Spec[] {
  const biovar = { z: 1.96, default_cva_rule_zh: '', markers: [...markers] }
  const byId = new Map<string, Spec>()
  for (const row of records.indicators) {
    if (row.source === 'self' || !row.name) continue
    let spec: Spec
    // A wearable series is a wearable series even when the service attached a LOINC code to it, and its field
    // name may arrive as the label instead of the name (dailySteps under LOINC 41950-7).
    const deviceKey = isDeviceName(row.name, markers) ? row.name : row.label && isDeviceName(row.label, markers) ? row.label : ''
    if (row.loinc && !deviceKey) {
      const marker = checkupMarkerFor(biovar, row)
      spec = byId.get(`loinc:${row.loinc}`) ?? {
        id: `loinc:${row.loinc}`, source: 'checkup', group: groupOf(row), label: '', unit: '', names: [], loinc: row.loinc, snapshot: null, marker,
      }
    } else if (deviceKey) {
      const known = DEVICE_ZH[deviceKey]
      spec = byId.get(`device:${deviceKey}`) ?? {
        id: `device:${deviceKey}`, source: 'device', group: 'wearable', label: known?.label ?? deviceLabel(row.label, deviceKey), unit: known?.unit ?? '', names: [], snapshot: null,
        marker: markers.find((item) => (item.device_codes ?? []).includes(deviceKey)) ?? null,
      }
    } else {
      const id = `name:${canonicalName(row.label || row.name)}`
      spec = byId.get(id) ?? { id, source: 'checkup', group: groupOf(row), label: '', unit: '', names: [], snapshot: null, marker: markerFor(biovar, row) }
    }
    if (!spec.names.includes(row.name)) spec.names.push(row.name)
    spec.snapshot = newer(spec.snapshot, row)
    byId.set(spec.id, spec)
  }
  for (const spec of byId.values()) {
    const snapshot = spec.snapshot
    if (spec.source === 'device') {
      const raw = snapshot?.unit ?? ''
      spec.unit = spec.unit || (DEVICE_ZH[spec.names[0] ?? '']?.unit ?? UNIT_ZH[raw] ?? raw)
    } else {
      // No space hugging a full-width bracket: 「尿微量白蛋白/肌酐比（尿） UACR」→「尿微量白蛋白/肌酐比（尿）UACR」
      spec.label = (snapshot?.label || spec.marker?.label_zh || snapshot?.name || spec.id).replace(/\s*([（）【】])\s*/g, '$1')
      spec.unit = snapshot?.unit || spec.marker?.unit || ''
    }
  }
  const out = mergeFastingGlucose([...byId.values()])
  for (const key of SELF_KEYS) {
    if (!selfRows.some((row) => row.key === key)) continue
    const spec = SELF_SPEC[key]
    out.push({
      id: `self:${key}`, source: 'self', group: 'body', label: spec.label_zh, unit: spec.unit, names: [`${spec.label_zh}${SELF_SUFFIX}`], snapshot: null, selfKey: key,
      marker: markers.find((item) => item.loinc.includes(spec.loinc)) ?? null,
    })
  }
  return out
}

const FASTING_LOINC = new Set(['14771-0', '1558-6'])

function isFastingGlucoseName(text: string): boolean {
  const folded = foldName(text)
  if (/餐后|随机|负荷|糖化|尿|指尖|瞬感/.test(folded)) return false
  const bare = folded.replace(/血/g, '')
  return bare === '空腹葡萄糖' || bare === '空腹血糖' || bare === '葡萄糖' || folded === '血糖'
}

/** 空腹血糖 and 葡萄糖 from the same venous draws are one series. Finger-stick and CGM stay out of it. */
function mergeFastingGlucose(specs: Spec[]): Spec[] {
  const fasting = specs.filter((spec) => spec.source === 'checkup' && (FASTING_LOINC.has(spec.loinc ?? '') || isFastingGlucoseName(spec.label) || spec.names.some((name) => isFastingGlucoseName(name))))
  if (fasting.length < 2) return specs
  const keep = fasting[0]
  if (!keep) return specs
  keep.id = 'analyte:fpg'
  keep.label = '空腹血糖'
  for (const other of fasting.slice(1)) {
    for (const name of other.names) if (!keep.names.includes(name)) keep.names.push(name)
    if (other.snapshot) keep.snapshot = newer(keep.snapshot, other.snapshot)
    if (!keep.loinc && other.loinc) keep.loinc = other.loinc
    if (!keep.marker && other.marker) keep.marker = other.marker
  }
  const drop = new Set(fasting.slice(1).map((spec) => spec.id))
  return specs.filter((spec) => !drop.has(spec.id))
}

/** A diabetes-relevant value the indicator row should not leave as 未判断. */
function attentionLevel(label: string, value: number | null, text: string, treated: boolean): { flag: 'low' | 'high'; text_zh: string } | null {
  if (!treated) return null
  const blob = `${label} ${text}`
  if (/血清|总蛋白|白蛋白电泳/.test(blob) && !/尿/.test(blob)) return null
  if (value != null && /尿白蛋白.?肌酐|尿微量白蛋白|UACR|\bACR\b/i.test(blob) && value >= 30) {
    return { flag: 'high', text_zh: `尿白蛋白/肌酐比 ${value} 高于常用分界 30 mg/g。如有糖尿病，请带给医生查看；「未判断」不代表正常。` }
  }
  if (/尿蛋白/.test(blob) && !/肌酐|UACR/i.test(blob) && ((value != null && value >= 30) || /阳性|\+|↑|偏高/.test(text || String(value ?? '')))) {
    return { flag: 'high', text_zh: `尿蛋白 ${text || value}。如有糖尿病，请带给医生查看；「未判断」不代表正常。` }
  }
  if (value != null && value > 5 && value < 60 && /egfr|肾小球滤过/i.test(blob)) {
    return { flag: 'low', text_zh: `eGFR ${value} 低于 60。如有糖尿病，请与医生一起评估肾功能；「未判断」不代表正常。` }
  }
  if (/眼底|视网膜/.test(blob) && /微动脉瘤|视网膜病变|新生血管|出血/.test(blob)) {
    return { flag: 'high', text_zh: '眼底记录里有需要医生看的描述。如有糖尿病，请带给眼科或内分泌科医生查看；「未判断」不代表正常。' }
  }
  return null
}

function glucoseKind(file: string | undefined): 'cgm' | 'finger' | 'other' {
  const text = file ?? ''
  if (/^lp:cgm|cgm|瞬感|传感器/i.test(text)) return 'cgm'
  if (/home:glucose|finger|指尖|指血/i.test(text)) return 'finger'
  return 'other'
}

const GLUCOSE_LABEL: Record<'cgm' | 'finger' | 'other', string> = {
  cgm: '瞬感血糖',
  finger: '指尖血糖',
  other: '血糖记录',
}

/** The factor that brings a unit to the row's unit, from the row's convert table; null when it cannot. */
function factorFor(marker: BiovarMarker, unit: string): number | null {
  const given = normalizeUnit(unit)
  if (!given) return null
  if (given === normalizeUnit(marker.unit)) return 1
  for (const [name, factor] of Object.entries(marker.convert ?? {})) if (normalizeUnit(name) === given) return factor
  return null
}

/**
 * A reading in another unit, or null when the two cannot be converted through the marker's table. A reading
 * without a unit is taken as it is for the trend, and left out (strict) where it is judged, as changes.ts does.
 */
function converted(value: number, from: string, to: string, marker: BiovarMarker | null, strict = false): number | null {
  if (!from) return strict ? null : value
  if (!to || normalizeUnit(from) === normalizeUnit(to)) return value
  if (!marker) return null
  const a = factorFor(marker, from)
  const b = factorFor(marker, to)
  if (a == null || b == null || b === 0) return null
  return Number(((value * a) / b).toPrecision(6))
}

/** One value per day, the last reading of that day, converted to a unit; unconvertible readings are left out. */
function daily(readings: readonly SeriesPoint[], unit: string, marker: BiovarMarker | null, strict = false): Array<{ date: string; value: number }> {
  const byDay = new Map<string, number>()
  for (const point of [...readings].sort((a, b) => a.time.localeCompare(b.time))) {
    const value = converted(point.value, point.unit, unit, marker, strict)
    if (value != null && Number.isFinite(value)) byDay.set(point.date, value)
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }))
}

/** Whether both comparisons changes.ts makes stay inside the band; null when one cannot be made (a zero baseline). */
function insideBand(points: ReadonlyArray<{ value: number }>, band: { up: number; down: number }): boolean | null {
  const last = points.at(-1)
  const pairs = [points.at(-2), points.length >= 3 ? points[0] : undefined].filter((row): row is { value: number } => row != null)
  if (!last || pairs.length === 0) return null
  for (const from of pairs) {
    if (from.value === 0) return null
    const pct = (last.value - from.value) / from.value
    if (pct > band.up || pct < band.down) return false
  }
  return true
}

function mondayOf(date: string): string {
  const day = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
  return addDays(date, -day)
}

function weeklyMeans(days: ReadonlyArray<{ date: string; value: number }>, today: string): Array<{ date: string; value: number }> {
  const from = mondayOf(addDays(today, -7 * (DEVICE_WEEKS - 1)))
  const weeks = new Map<string, number[]>()
  for (const point of days) {
    if (point.date < from) continue
    const week = mondayOf(point.date)
    weeks.set(week, [...(weeks.get(week) ?? []), point.value])
  }
  return [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, value: round2(values.reduce((sum, value) => sum + value, 0) / values.length) }))
}

function latestOf(snapshot: IndicatorRow | null, last: { date: string; value: number } | undefined): IndicatorEntry['latest'] {
  const date = snapshot?.date || snapshot?.last_date || ''
  if (snapshot && snapshot.value && date && (!last || date >= last.date)) {
    const value = parseNumber(snapshot.value)
    return value == null ? { date, value: null, text: snapshot.value } : { date, value }
  }
  return last ? { date: last.date, value: last.value } : null
}

function bandPct(marker: BiovarMarker, z: number): { up: number; down: number } {
  const band = rcvBand(marker, z)
  const up = round1(band.up * 100)
  return { up, down: marker.log_normal ? round1(band.down * 100) : -up }
}

function changeOf(change: RecordChange): IndicatorChange {
  const text = change.verdict === 'worse' && !change.text_zh.includes('反向') ? `${change.text_zh}（反向）` : change.text_zh
  return { verdict: change.verdict, ask_doctor: change.ask_doctor, pct: change.compare.pct, band_pct: { ...change.band_pct }, text_zh: text }
}

/** Plan markers, goals and wearable targets of the current plan, as the rows they point at. */
function planMatcher(context: IndicatorsContext, markers: readonly BiovarMarker[]): (spec: Spec) => boolean {
  const plan = currentPlan(context.dataDir)
  if (!plan) return () => false
  const biovar = { z: 1.96, default_cva_rule_zh: '', markers: [...markers] }
  const names = expandMarkerNames(biovar, [...plan.items.flatMap((item) => item.markers), ...plan.goals.map((goal) => goal.marker)])
  const resolved = resolveMarkers(names, context.records.indicators, biovar)
  const metrics = new Set(plan.items.map((item) => item.target?.metric).filter((name): name is string => Boolean(name)))
  return (spec) => resolved.some((row) => {
    if (row.indicator && spec.names.includes(row.indicator)) return true
    const marker = row.biovar
    if (!marker) return false
    if (spec.loinc && marker.loinc.includes(spec.loinc)) return true
    if (spec.source === 'device' && spec.names.some((name) => (marker.device_codes ?? []).includes(name))) return true
    return spec.selfKey != null && marker.loinc.includes(SELF_SPEC[spec.selfKey].loinc)
  }) || (spec.source === 'device' && spec.names.some((name) => metrics.has(name)))
}

function readErrorOf(reads: readonly Read[], name: string): string | undefined {
  const read = reads.find((row) => row.names.includes(name))
  if (!read) return undefined
  if (!read.result) return TIMEOUT_ZH
  if (read.result.series[name]) return undefined
  return read.result.error ? `读取失败：${read.result.error}` : undefined
}

function chunked(names: readonly string[], size: number): string[][] {
  const out: string[][] = []
  for (let at = 0; at < names.length; at += size) out.push(names.slice(at, at + size))
  return out
}

async function build(context: IndicatorsContext): Promise<Built> {
  const { records, today } = context
  const reference = loadReference(context.skillsHome)
  const markers = reference.biovar.markers
  const selfRows = readSelf(context.dataDir)
  const specs = specsOf(records, selfRows, markers)
  const status = records.record_status as string
  const readable = status === 'ok' || status === 'partial'
  const checkupNames = [...new Set(specs.filter((spec) => spec.source === 'checkup').flatMap((spec) => spec.names))]
  const deviceNames = [...new Set(specs.filter((spec) => spec.source === 'device').flatMap((spec) => spec.names).filter((name) => name !== 'bloodGlucoses'))]
  const splitGlucose = specs.some((spec) => spec.names.includes('bloodGlucoses'))
  const reads: Read[] = readable
    ? [
      ...chunked(checkupNames, CHECKUP_CHUNK).map((names) => ({ names, resolution: 'raw' as const })),
      ...chunked(deviceNames, DEVICE_CHUNK).map((names) => ({ names, resolution: 'day' as const })),
      // Finger-stick and CGM share the name bloodGlucoses. A day bucket drops the file, so the split needs the raw points.
      ...(splitGlucose ? [{ names: ['bloodGlucoses'], resolution: 'raw' as const }] : []),
    ]
    : []
  const rawWindow = { start: addDays(today, -CHECKUP_LOOKBACK_DAYS), end: today, resolution: 'raw' as const }
  const dayWindow = { start: addDays(today, -(WEARABLE_LOOKBACK_DAYS - 1)), end: today, resolution: 'day' as const }
  let changes: RecordChange[] = []
  const work = [
    ...reads.map((read) => loadSeries(context.config, read.names, read.resolution === 'raw' ? rawWindow : dayWindow)
      .catch((error: unknown) => ({ series: {}, truncated: false, error: error instanceof Error ? error.message : 'series read failed' }) as SeriesResult)
      .then((result) => { read.result = result })),
    readable
      ? buildChanges({ config: context.config, skillsHome: context.skillsHome, records: codedRecords(records, reference.biovar), today }).then((result) => { changes = result.changes }, () => undefined)
      : Promise.resolve(),
  ]
  await deadline(Promise.all(work), context.budgetMs ?? BUDGET_MS)
  const glucoseTreated = records.profile.risk.diabetes === true || currentMedications(records.medications).some((name) => GLUCOSE_LOWERING.test(name))
  const isPlanMarker = planMatcher(context, markers)
  const details = new Map<string, Omit<IndicatorDetail, 'row'>>()
  const rows: Array<IndicatorEntry & { group: GroupKey }> = []
  const localRecord = isLocalMcp(context.config.mcpUrl) ? localRecordNow() : null
  const printed = localRecord ? printedLevels(localRecord) : new Map<string, { flag: 'low' | 'high'; text_zh: string }>()
  const checkupDays = new Set<string>()
  const wearableDays = new Set<string>()
  let failed = 0
  let firstError = ''

  for (const spec of specs) {
    const errors = spec.source === 'self' ? [] : spec.names.map((name) => readErrorOf(reads, name)).filter((text): text is string => Boolean(text))
    const readings = spec.names.flatMap((name) => reads.find((read) => read.names.includes(name))?.result?.series[name]?.points ?? [])
    const truncated = spec.names.some((name) => reads.find((read) => read.names.includes(name))?.result?.truncated === true)
    const readError = errors.length > 0 && readings.length === 0 ? errors[0] : undefined
    if (readError) {
      failed += 1
      firstError ||= readError
    }
    let points: Array<{ date: string; value: number }> = []
    let latest: IndicatorEntry['latest'] = null
    let judged: IndicatorEntry['judged'] = 'unjudged'
    let change: IndicatorChange | null = null
    let gate: IndicatorEntry['gate']
    let reason: string | undefined
    let allPoints: IndicatorDetail['all_points'] = []
    let biovar: IndicatorDetail['biovar']

    if (spec.source === 'device' && spec.names.includes('bloodGlucoses')) {
      const raw = reads.find((read) => read.resolution === 'raw' && read.names.includes('bloodGlucoses'))
      const series = raw?.result?.series.bloodGlucoses?.points ?? []
      const buckets = new Map<'cgm' | 'finger' | 'other', SeriesPoint[]>()
      for (const point of series) {
        const kind = glucoseKind(point.file)
        buckets.set(kind, [...(buckets.get(kind) ?? []), point])
      }
      if (buckets.size > 0) {
        for (const [kind, group] of buckets) {
          const unit = group.at(-1)?.unit || spec.unit
          const days = daily(group, unit, null)
          for (const point of days) wearableDays.add(point.date)
          const last = days.at(-1)
          const latest = last ? { date: last.date, value: last.value } : null
          const label = GLUCOSE_LABEL[kind]
          const level = latest?.value != null ? absoluteLevel(label, latest.value, unit, records.profile.sex) : null
          const id = `device:bloodGlucoses:${kind}`
          rows.push({
            id, label_zh: label, unit, source: 'device', latest, points: weeklyMeans(days, today), change: null, judged: 'unjudged',
            plan_marker: isPlanMarker(spec), ...(readError ? { read_error: readError } : {}),
            ...(level ? { range_flag: level.flag, range_zh: level.text_zh } : {}),
            group: 'glucose',
          })
          details.set(id, { all_points: days.slice(-DETAIL_POINTS).map((point) => ({ ...point, unit })) })
        }
        continue
      }
    }

    if (spec.source === 'checkup') {
      spec.unit ||= readings.at(-1)?.unit ?? ''
      const days = daily(readings, spec.unit, spec.marker)
      points = days.slice(-CHECKUP_POINTS)
      latest = latestOf(spec.snapshot, days.at(-1))
      if (spec.loinc) for (const point of readings) checkupDays.add(point.date)
      allPoints = [...readings].sort((a, b) => a.time.localeCompare(b.time))
        .map((point) => ({ date: point.date, value: point.value, unit: point.unit || spec.unit, ...(point.file ? { file: point.file } : {}) }))
      if (latest?.text && !allPoints.some((point) => point.date === latest?.date && point.value == null)) {
        allPoints.push({ date: latest.date, value: null, text: latest.text, unit: spec.unit })
        allPoints.sort((a, b) => a.date.localeCompare(b.date))
      }
      const marker = spec.marker
      if (marker && !marker.average_days && !readError) {
        biovar = {
          cvi_pct: marker.cvi_pct, band_pct: bandPct(marker, reference.biovar.z),
          source: { title: marker.cvi_source.title, url: marker.cvi_source.url, ...(marker.cvi_source.doi ? { doi: marker.cvi_source.doi } : {}) },
          ...(marker.caveat_zh ? { caveat_zh: marker.caveat_zh } : {}),
        }
        const judgedDays = daily(readings, marker.unit, marker, true).slice(-JUDGE_POINTS)
        const blocked = compareGate(judgedDays, readings, marker)
        if (blocked) {
          // A short interval or a different lab is not 波动内 and not a real change.
          gate = blocked.gate
          reason = blocked.reason_zh
          biovar = { ...biovar, caveat_zh: [blocked.reason_zh, biovar.caveat_zh].filter(Boolean).join(' ') }
        } else {
          const listed = changes.find((row) => row.key === marker.key && judgedDays.some((point) => point.date === row.compare.to_date))
          const bandHit = judgedDays.length >= 2 && !truncated ? insideBand(judgedDays, rcvBand(marker, reference.biovar.z)) : null
          if (listed) {
            judged = 'changed'
            change = changeOf(listed)
          } else if (bandHit === true) {
            judged = 'within'
          } else if (bandHit === false) {
            // The changes read missed this row. The series on the page is already past the band, so it is still a change.
            const built = judgeSeries(marker, readings, reference.biovar.z, glucoseTreated, records.profile.sex)
            if (built.change) {
              judged = 'changed'
              change = changeOf(built.change)
            }
          }
        }
      }
    } else if (spec.source === 'device') {
      const days = daily(readings, readings.at(-1)?.unit ?? '', null)
      for (const point of days) wearableDays.add(point.date)
      points = weeklyMeans(days, today)
      latest = latestOf(spec.snapshot, days.at(-1))
      allPoints = days.slice(-DETAIL_POINTS).map((point) => ({ ...point, unit: spec.unit }))
    } else if (spec.selfKey) {
      const key = spec.selfKey
      points = selfSeries(selfRows, key).slice(-SELF_POINTS).map((point) => ({ date: point.date, value: point.value }))
      const last = points.at(-1)
      latest = last ? { date: last.date, value: last.value } : null
      allPoints = selfRows.filter((row) => row.key === key).sort((a, b) => a.date.localeCompare(b.date) || a.saved_at.localeCompare(b.saved_at))
        .map((row) => ({ date: row.date, value: row.value, unit: SELF_SPEC[key].unit }))
    }

    const level = (latest?.value != null ? absoluteLevel(spec.label, latest.value, spec.unit, records.profile.sex) : null)
      ?? attentionLevel(spec.label, latest?.value ?? null, latest?.text ?? '', glucoseTreated)
      // The range the report printed, for every lab the fixed bands above do not cover.
      ?? (spec.source === 'checkup' && latest ? printed.get(`${spec.label}|${latest.date}`) ?? spec.names.map((name) => printed.get(`${name}|${latest.date}`)).find(Boolean) ?? null : null)
    const entry: IndicatorEntry & { group: GroupKey } = {
      id: spec.id, label_zh: spec.label, unit: spec.unit, source: spec.source, latest, points, change, judged,
      plan_marker: isPlanMarker(spec), ...(readError ? { read_error: readError } : {}),
      ...(gate ? { gate, reason_zh: reason } : {}),
      ...(level ? { range_flag: level.flag, range_zh: level.text_zh } : {}),
      group: spec.group,
    }
    rows.push(entry)
    details.set(spec.id, { all_points: allPoints.slice(-DETAIL_POINTS), ...(biovar ? { biovar } : {}) })
  }

  const rank = (row: IndicatorEntry) => (row.plan_marker ? 0 : 2) + (row.judged === 'changed' ? 0 : 1)
  const groups = GROUP_KEYS.map((key) => ({
    key,
    label_zh: GROUP_ZH[key],
    indicators: rows.filter((row) => row.group === key)
      .sort((a, b) => rank(a) - rank(b) || a.label_zh.localeCompare(b.label_zh, 'zh-Hans-CN'))
      .map(({ group: _group, ...row }) => row),
  })).filter((group) => group.indicators.length > 0)

  const record: IndicatorsResponse['record'] = status === 'unconfigured' ? { status: 'none' }
    : status === 'error' ? { status: 'error', error: records.record_error || '记录读取失败。' }
      : failed > 0 || status === 'partial'
        ? { status: 'partial', error: failed > 0 ? `${failed} 项指标的历史数据未读取到：${firstError}` : records.record_error || '部分记录未读取到。' }
        : { status: 'ok' }

  // The summary counts days, so a read that failed or ran out of time would undercount them: then there is
  // no summary rather than a smaller number (the record status and the rows say what failed).
  const incomplete = reads.some((read) => !read.result || Boolean(read.result.error))
  let summary: RecordsSummary | null = null
  if (readable && !incomplete) {
    const counts = new Map<GroupKey, number>()
    for (const row of rows) if (row.source === 'checkup' && row.group !== 'other') counts.set(row.group, (counts.get(row.group) ?? 0) + 1)
    const dates = [...checkupDays].sort()
    summary = {
      checkups: dates.length,
      first_date: dates[0] ?? null,
      last_date: dates.at(-1) ?? null,
      categories_zh: [...counts.entries()].sort((a, b) => b[1] - a[1] || GROUP_KEYS.indexOf(a[0]) - GROUP_KEYS.indexOf(b[0])).map(([key]) => GROUP_ZH[key]),
      wearable_days: [...wearableDays].filter((date) => date > addDays(today, -WEARABLE_LOOKBACK_DAYS) && date <= today).length,
    }
  }
  return { response: { record, updated_at: new Date().toISOString(), groups }, details, summary }
}

function keyOf(context: IndicatorsContext): string {
  const { config, records } = context
  const self = readSelf(context.dataDir)
  return [
    context.dataDir, context.skillsHome, context.today, trackingGeneration(), config.mcpUrl.trim(), config.member.trim(), connectionKey(config), records.record_status,
    createHash('sha1').update(records.indicators.map((row) => `${row.name}=${row.value}@${row.date ?? ''}#${row.loinc ?? ''}`).join('\n')).digest('hex'),
    `${self.length}:${self.at(-1)?.id ?? ''}`,
  ].join('\u0000')
}

/**
 * The built indicators, memoised like tracking: the same key for a minute, and a fresh build after any
 * change that invalidates tracking (a check-in, a self measurement, a plan, profile or connection change).
 * A build whose reads ran out of time is not kept; the reads go on and are picked up by the next one.
 */
async function built(context: IndicatorsContext): Promise<Built> {
  const key = keyOf(context)
  const now = Date.now()
  const hit = memo.get(key)
  if (hit && (hit.settled == null || now - hit.settled < CACHE_TTL_MS)) return hit.value
  for (const [name, entry] of memo) if (entry.settled != null && now - entry.settled >= CACHE_TTL_MS) memo.delete(name)
  const value = build(context)
  const entry = { settled: null as number | null, value }
  memo.set(key, entry)
  value.then((result) => {
    entry.settled = Date.now()
    const timedOut = result.response.groups.some((group) => group.indicators.some((row) => row.read_error === TIMEOUT_ZH))
    if (timedOut && memo.get(key) === entry) memo.delete(key)
  }, () => {
    if (memo.get(key) === entry) memo.delete(key)
  })
  return value
}

/** GET /api/longpi/indicators. */
export async function buildIndicators(context: IndicatorsContext): Promise<IndicatorsResponse> {
  return (await built(context)).response
}

/** GET /api/longpi/indicators/detail: the row, every reading (200 at most) and its band; null for an unknown id. */
export async function indicatorDetail(context: IndicatorsContext, id: string): Promise<IndicatorDetail | null> {
  const result = await built(context)
  const row = result.response.groups.flatMap((group) => group.indicators).find((item) => item.id === id)
  const detail = result.details.get(id)
  return row && detail ? { row, ...detail } : null
}

/** The record summary for onboarding; null when the record is not connected, or a read failed or timed out. */
export async function recordsSummary(context: IndicatorsContext): Promise<RecordsSummary | null> {
  return (await built(context)).summary
}

/** Forget built indicators (tests; the tracking generation already covers every change the routes make). */
export function invalidateIndicators(): void {
  memo.clear()
}
