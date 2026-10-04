// Measurements the person takes themselves and states: waist, home blood
// pressure, weight. They unlock a risk equation between checkups and let a plan
// aimed at them be judged. Kept in dataDir next to the plan; never uploaded and
// never written to Mirobody. Every value is one the person entered.

import { randomBytes } from '../sys/crypto.ts'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from '../sys/fs.ts'
import { join } from '../sys/path.ts'
import { addDays } from './interventions.ts'
import type { SeriesPoint } from './records.ts'
import type { IndicatorRow } from './situation.ts'

export const SELF_KEYS = ['waist', 'sbp', 'dbp', 'weight'] as const
export type SelfKey = (typeof SELF_KEYS)[number]
export const SELF_SPEC: Record<SelfKey, { label_zh: string; unit: string; loinc: string; min: number; max: number; units: Record<string, number> }> = {
  waist: { label_zh: '腰围', unit: 'cm', loinc: '8280-0', min: 40, max: 200, units: { cm: 1, 厘米: 1, in: 2.54, inch: 2.54, 英寸: 2.54, 尺: 100 / 3, 市尺: 100 / 3, 寸: 10 / 3 } },
  sbp: { label_zh: '收缩压', unit: 'mmHg', loinc: '8480-6', min: 70, max: 260, units: { mmHg: 1, mmhg: 1 } },
  dbp: { label_zh: '舒张压', unit: 'mmHg', loinc: '8462-4', min: 40, max: 150, units: { mmHg: 1, mmhg: 1 } },
  weight: { label_zh: '体重', unit: 'kg', loinc: '29463-7', min: 20, max: 300, units: { kg: 1, 公斤: 1, 千克: 1, 斤: 0.5, jin: 0.5, lb: 0.45359237, lbs: 0.45359237 } },
}

/** Mirobody device rows that measure the same thing as a self key and carry no LOINC code. */
export const SELF_DEVICE_NAMES: Partial<Record<SelfKey, string[]>> = {
  sbp: ['systolicPressures'],
  dbp: ['diastolicPressures'],
  weight: ['bodyMasss', 'bodyMass'],
}

/**
 * Other ways a record names the same measure: a checkup row with no LOINC code
 * (腰围), a different LOINC code for it (3141-9 is a measured body weight), or
 * an English report name. mergeSelf counts all of them as the same thing.
 */
export const SELF_ALIASES: Record<SelfKey, { names: string[]; loinc: string[] }> = {
  waist: { names: ['腰围', 'waist', 'waist circumference', 'WC'], loinc: ['8280-0'] },
  sbp: { names: ['收缩压', '高压', 'sbp', 'systolic', 'systolic blood pressure', 'systolicPressure'], loinc: ['8480-6'] },
  dbp: { names: ['舒张压', '低压', 'dbp', 'diastolic', 'diastolic blood pressure', 'diastolicPressure'], loinc: ['8462-4'] },
  weight: { names: ['体重', 'weight', 'body weight', 'bodyMass'], loinc: ['29463-7', '3141-9'] },
}

export const SELF_SUFFIX = '（自测）'

export interface SelfRow {
  id: string
  key: SelfKey
  value: number
  unit: string
  date: string
  saved_at: string
  given?: { value: number; unit: string }
}

const FILE = 'self_measurements.jsonl'
const DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_ENTRIES = 50
const EARLIEST = '1990-01-01'
// Home blood pressure is judged on the mean of a week of readings (ESH), not one reading.
const BP_WINDOW_DAYS = 7

function path(dataDir: string): string {
  return join(dataDir, FILE)
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function isSelfKey(value: unknown): value is SelfKey {
  return typeof value === 'string' && (SELF_KEYS as readonly string[]).includes(value)
}

function realDate(value: string): boolean {
  if (!DATE.test(value)) return false
  const at = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === value
}

function validRow(row: unknown): row is SelfRow {
  const rec = row as Partial<SelfRow> | null
  return Boolean(rec) && typeof rec?.id === 'string' && isSelfKey(rec?.key) && typeof rec?.value === 'number'
    && Number.isFinite(rec.value) && typeof rec?.date === 'string' && DATE.test(rec.date)
}

function byDate(a: SelfRow, b: SelfRow): number {
  return a.date.localeCompare(b.date) || (a.saved_at ?? '').localeCompare(b.saved_at ?? '')
}

export function readSelf(dataDir: string): SelfRow[] {
  const file = path(dataDir)
  if (!existsSync(file)) return []
  const rows: SelfRow[] = []
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const row = JSON.parse(line) as unknown
      if (validRow(row)) rows.push({ ...row, unit: SELF_SPEC[row.key].unit })
    } catch {
      /* skip a torn line */
    }
  }
  return rows.sort(byDate)
}

function numberOf(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) return Number(value.trim())
  return Number.NaN
}

function fmt(value: number): string {
  return String(round1(value))
}

function unitFactor(key: SelfKey, unit: string): { unit: string; factor: number } | null {
  const units = SELF_SPEC[key].units
  if (Object.hasOwn(units, unit)) return { unit, factor: units[unit] as number }
  const lower = unit.toLowerCase()
  const hit = Object.entries(units).find(([name]) => name.toLowerCase() === lower)
  return hit ? { unit: hit[0], factor: hit[1] } : null
}

/** Check each entry the person stated, convert it to the canonical unit, and append the ones that pass. */
export function addSelf(dataDir: string, entries: unknown[], opts: { today: string; now?: Date }): { saved: SelfRow[]; problems: string[] } {
  const saved: SelfRow[] = []
  const problems: string[] = []
  if (entries.length > MAX_ENTRIES) problems.push(`一次最多保存 ${MAX_ENTRIES} 条自测记录，其余没有保存。`)
  const savedAt = (opts.now ?? new Date()).toISOString()
  for (const value of entries.slice(0, MAX_ENTRIES)) {
    const entry = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
    if (!isSelfKey(entry.key)) {
      problems.push(`「${String(entry.key ?? '')}」不是可以自测记录的项目（腰围、收缩压、舒张压、体重）。`)
      continue
    }
    const key = entry.key
    const spec = SELF_SPEC[key]
    const number = numberOf(entry.value)
    if (!Number.isFinite(number)) {
      problems.push(`${spec.label_zh}的数值「${String(entry.value ?? '')}」不是一个数。`)
      continue
    }
    const unitText = typeof entry.unit === 'string' ? entry.unit.trim() : ''
    const unit = unitText ? unitFactor(key, unitText) : { unit: spec.unit, factor: 1 }
    if (!unit) {
      problems.push(`${spec.label_zh}的单位「${unitText}」不认识。可以用：${Object.keys(spec.units).join('、')}。`)
      continue
    }
    const dateText = typeof entry.date === 'string' ? entry.date.trim() : ''
    const date = dateText || opts.today
    if (!realDate(date)) {
      problems.push(`${spec.label_zh}的日期「${date}」不是 YYYY-MM-DD。`)
      continue
    }
    if (date > opts.today) {
      problems.push(`${spec.label_zh}的日期 ${date} 在未来，没有保存。`)
      continue
    }
    if (date < EARLIEST) {
      problems.push(`${spec.label_zh}的日期 ${date} 早于 1990 年，没有保存。`)
      continue
    }
    const converted = round1(number * unit.factor)
    const shown = unit.factor === 1 ? `${fmt(converted)} ${spec.unit}` : `${fmt(number)} ${unit.unit}（折合 ${fmt(converted)} ${spec.unit}）`
    if (converted < spec.min || converted > spec.max) {
      problems.push(`${spec.label_zh} ${shown} 不在合理范围 ${spec.min}–${spec.max} ${spec.unit} 内，没有保存。请核对数值和单位。`)
      continue
    }
    const row: SelfRow = {
      id: randomBytes(6).toString('hex'),
      key,
      value: converted,
      unit: spec.unit,
      date,
      saved_at: savedAt,
      ...(unit.factor !== 1 ? { given: { value: number, unit: unit.unit } } : {}),
    }
    saved.push(row)
  }
  refuseSwappedPressure(saved, problems)
  if (saved.length > 0) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 })
    appendFileSync(path(dataDir), saved.map((row) => `${JSON.stringify(row)}\n`).join(''), { mode: 0o600 })
  }
  return { saved, problems }
}

/**
 * A systolic reading at or below the diastolic one of the same day, in the same
 * call, is almost always a swapped pair ('120/80' saved as 80/120). Both rows of
 * such a pair are dropped from `saved` so the risk model never sees them. Pairs
 * are matched in the order given, per date.
 */
function refuseSwappedPressure(saved: SelfRow[], problems: string[]): void {
  const dates = new Set(saved.filter((row) => row.key === 'sbp').map((row) => row.date))
  const drop = new Set<SelfRow>()
  for (const date of dates) {
    const sbp = saved.filter((row) => row.key === 'sbp' && row.date === date)
    const dbp = saved.filter((row) => row.key === 'dbp' && row.date === date)
    for (let i = 0; i < Math.min(sbp.length, dbp.length); i += 1) {
      const high = sbp[i] as SelfRow
      const low = dbp[i] as SelfRow
      if (high.value > low.value) continue
      drop.add(high).add(low)
      problems.push(`收缩压 ${fmt(high.value)} ${high.value === low.value ? '等于' : '低于'}舒张压 ${fmt(low.value)}，请核对是否填反。这一对（${date}）没有保存。`)
    }
  }
  if (drop.size === 0) return
  const kept = saved.filter((row) => !drop.has(row))
  saved.length = 0
  saved.push(...kept)
}

export function deleteSelf(dataDir: string, id: string): boolean {
  const file = path(dataDir)
  if (!id || !existsSync(file)) return false
  let removed = false
  const kept = readFileSync(file, 'utf8').split(/\r?\n/).filter((line) => {
    if (!line.trim()) return false
    try {
      if ((JSON.parse(line) as { id?: unknown }).id === id) {
        removed = true
        return false
      }
    } catch {
      /* keep a line we cannot read rather than lose it */
    }
    return true
  })
  if (removed) writeFileSync(file, kept.map((line) => `${line}\n`).join(''), { mode: 0o600 })
  return removed
}

export type SelfLatest = Partial<Record<SelfKey, { value: number; unit: string; date: string; n: number }>>

export function latestSelf(rows: readonly SelfRow[]): SelfLatest {
  const out: SelfLatest = {}
  for (const key of SELF_KEYS) {
    const mine = rows.filter((row) => row.key === key).slice().sort(byDate)
    const last = mine.at(-1)
    if (!last) continue
    if (key === 'sbp' || key === 'dbp') {
      const from = addDays(last.date, -(BP_WINDOW_DAYS - 1))
      const week = mine.filter((row) => row.date >= from && row.date <= last.date)
      out[key] = { value: round1(week.reduce((sum, row) => sum + row.value, 0) / week.length), unit: SELF_SPEC[key].unit, date: last.date, n: week.length }
    } else {
      out[key] = { value: last.value, unit: SELF_SPEC[key].unit, date: last.date, n: 1 }
    }
  }
  return out
}

/** The latest self measurements as record rows, so the skills and markers can read them like any other. */
export function selfIndicators(rows: readonly SelfRow[]): IndicatorRow[] {
  const latest = latestSelf(rows)
  return SELF_KEYS.flatMap((key) => {
    const row = latest[key]
    if (!row) return []
    const spec = SELF_SPEC[key]
    return [{
      name: `${spec.label_zh}${SELF_SUFFIX}`, label: spec.label_zh, value: String(row.value), unit: spec.unit,
      loinc: spec.loinc, date: row.date, count: row.n, source: 'self' as const,
    }]
  })
}

/** The self key behind an indicator name such as 腰围（自测）, or null for a record row. */
export function selfKeyOf(name: string): SelfKey | null {
  if (!name.endsWith(SELF_SUFFIX)) return null
  const label = name.slice(0, -SELF_SUFFIX.length)
  return SELF_KEYS.find((key) => SELF_SPEC[key].label_zh === label) ?? null
}

/** One point per date (the mean of that day's readings), oldest first, for charts and verdicts. */
export function selfSeries(rows: readonly SelfRow[], key: SelfKey): SeriesPoint[] {
  const days = new Map<string, number[]>()
  for (const row of rows) {
    if (row.key !== key) continue
    days.set(row.date, [...(days.get(row.date) ?? []), row.value])
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => ({
    date, time: date, value: round1(values.reduce((sum, value) => sum + value, 0) / values.length), unit: SELF_SPEC[key].unit,
  }))
}
