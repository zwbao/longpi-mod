// The health record kept on this computer, answering the same MCP tools Mirobody answers
// (query_health_indicators, query_medications) in Mirobody 1.5's compact text, so records.ts reads it
// exactly as it reads a Mirobody server. Ported from the plugin's test stand-in (test/fake-mirobody.mjs).
//
// In Claude Code the record fills from what the person hands Claude: Claude reads a checkup PDF or photo
// itself and saves each value with record_measurements; wearable exports and CSVs go through the same
// door. The file is <person's LongPi home>/record.json:
//   { tz, observations: [{ indicator, name, system, code, unit, date, time, value, file }],
//     medications: { plans: [...], log: [...], history: [...] } }

import { existsSync, mkdirSync, readFileSync, writeFileSync } from '../sys/fs.ts'
import { dirname } from '../sys/path.ts'

export interface Observation {
  indicator: string
  name: string
  system: string
  code: string
  unit: string
  date: string
  time: string
  value: string
  file: string
  /** checkup | lab | device | self | import */
  source?: string
  ref_low?: string
  ref_high?: string
  flag?: string
  added_at?: string
}

export interface MedicationPlan { medication: string; status: string; schedule: string; today: string; since: string; until: string; source: string; plan_id: string }
export interface MedicationLog { date: string; time: string; medication: string; status: string; slot: string; dose: string; recorded_by: string; plan_id: string }
export interface MedicationHistory { medication: string; start: string; end: string; closed_by: string; plan_id: string }

export interface LocalRecord {
  tz: string
  today?: string
  observations: Observation[]
  medications: { plans: MedicationPlan[]; log: MedicationLog[]; history: MedicationHistory[] }
}

const COLUMNS = {
  catalog: ['indicator', 'system', 'code', 'count', 'first_date', 'last_date', 'reason'],
  readings: ['indicator', 'name', 'time', 'value', 'unit', 'system', 'code', 'file'],
  buckets: ['indicator', 'period', 'avg', 'min', 'max', 'n', 'unit', 'system', 'code'],
  stats: ['indicator', 'count', 'min', 'max', 'avg', 'first', 'first_date', 'last', 'last_date', 'change', 'unit', 'mixed_units', 'system', 'code'],
  latest: ['indicator', 'name', 'date', 'time', 'value', 'unit', 'system', 'code'],
}
const VIEW_COLUMNS = {
  plan: ['medication', 'status', 'schedule', 'today', 'since', 'until', 'source', 'plan_id'],
  log: ['date', 'time', 'medication', 'status', 'slot', 'dose', 'recorded_by', 'plan_id'],
  history: ['medication', 'start', 'end', 'closed_by', 'plan_id'],
}
const PLAN_NOTE = 'a plan is what the person intends to take; it is not a record of doses taken'
const LOG_NOTE = 'a dose missing from the log is not evidence it was not taken'

/** A Python float, printed the way str() prints it. */
class PyFloat {
  constructor(readonly value: number) {}
  toString(): string {
    const v = this.value
    if (Number.isInteger(v)) return v.toFixed(1)
    return String(v)
  }
}

type Row = Record<string, unknown>

function pyRound(value: number, digits: number): number {
  return Number(`${Math.round(Number(`${value}e${digits}`))}e-${digits}`)
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && !(typeof value === 'string' && !value.trim())
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  return String(value)
}

function compact(rows: Row[], columns: readonly string[]): string {
  if (rows.length === 0) return ''
  const present = columns.filter((column) => rows.some((row) => hasValue(row[column])))
  if (present.length === 0) return ''
  const rendered: Record<string, string[]> = Object.fromEntries(present.map((column) => [column, rows.map((row) => cell(row[column]))]))
  const constants = present.filter((column) => new Set(rendered[column]).size === 1)
  const varying = present.filter((column) => !constants.includes(column))
  const out: string[] = []
  if (constants.length > 0) out.push(`(constants: ${constants.map((column) => `${column}=${rendered[column]?.[0] ?? ''}`).join(', ')})`)
  if (varying.length === 0) return out.join('\n')
  out.push(varying.join('|'))
  for (let i = 0; i < rows.length; i += 1) out.push(varying.map((column) => rendered[column]?.[i] ?? '').join('|'))
  return out.join('\n')
}

function methodColumns(rows: Row[]): readonly string[] {
  const first = rows[0]
  if (!first) return []
  if ('period' in first) return COLUMNS.buckets
  if ('avg' in first && 'count' in first) return COLUMNS.stats
  if ('first_date' in first) return COLUMNS.catalog
  if ('time' in first && 'total' in first) return COLUMNS.readings
  if ('value' in first) return COLUMNS.latest
  return Object.keys(first)
}

interface Meta { window: [string, string]; tz: string; resolution: string; aggregate: string; basis: string; rows: number; truncated: boolean; catalogTotal: number; semantics?: string }

function metaLine(meta: Meta): string {
  const bits: string[] = []
  if (meta.tz || meta.window[0] || meta.window[1]) {
    const span = meta.window[0] || meta.window[1] ? `${meta.window[0]}..${meta.window[1]}` : 'all recorded data'
    bits.push(`window=${span}`, `tz=${meta.tz}`, `dates=${meta.semantics ?? 'tz_exact'}`)
  }
  if (meta.resolution) bits.push(`resolution=${meta.resolution}`)
  if (meta.aggregate && meta.aggregate !== 'none') bits.push(`aggregate=${meta.aggregate}/${meta.basis}`)
  bits.push(`rows=${meta.rows}`)
  if (meta.catalogTotal) bits.push(`of ${meta.catalogTotal}`)
  if (meta.truncated) bits.push('truncated')
  return `(${bits.join(', ')})`
}

interface Envelope { status: 'ok' | 'error'; rows?: Row[]; errorKind?: string; assumptions?: string[]; meta: Meta }

function renderCompact(envelope: Envelope, columns?: readonly string[]): string {
  if (envelope.status === 'error') {
    const reason = envelope.assumptions?.join('; ') || 'this lookup could not complete'
    return `error (${envelope.errorKind}): ${reason}. Fix the arguments and try once more.`
  }
  const rows = envelope.rows ?? []
  const table = rows.length ? compact(rows, columns ?? methodColumns(rows)) : ''
  const lines = [table || '(no rows)', '', metaLine(envelope.meta)]
  if (envelope.assumptions?.length) lines.push(`notes: ${envelope.assumptions.join('; ')}`)
  return lines.join('\n')
}

function payload(envelope: Envelope, columns?: readonly string[]): Record<string, unknown> {
  return {
    result: renderCompact(envelope, columns),
    status: envelope.status,
    row_count: envelope.meta?.rows ?? 0,
    truncated: Boolean(envelope.meta?.truncated),
    ...(envelope.errorKind ? { error_kind: envelope.errorKind } : {}),
  }
}

function meta(record: LocalRecord, extra: Partial<Meta> = {}): Meta {
  return { window: ['', ''], tz: record.tz, resolution: '', aggregate: '', basis: '', rows: 0, truncated: false, catalogTotal: 0, ...extra }
}

function byCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function shiftDays(iso: string, days: number): string {
  const at = new Date(`${iso}T00:00:00Z`)
  at.setUTCDate(at.getUTCDate() + days)
  return at.toISOString().slice(0, 10)
}

function numeric(value: string): boolean {
  return value.trim() !== '' && Number.isFinite(Number(value))
}

function byIndicator(record: LocalRecord): Map<string, Observation[]> {
  const out = new Map<string, Observation[]>()
  for (const row of record.observations) {
    const list = out.get(row.indicator) ?? []
    list.push(row)
    out.set(row.indicator, list)
  }
  for (const rows of out.values()) rows.sort((a, b) => byCodePoint(a.time, b.time))
  return out
}

function resolveIndicator(groups: Map<string, Observation[]>, wanted: string): string {
  if (groups.has(wanted)) return wanted
  for (const [name, items] of groups) {
    if (items.some((item) => item.code === wanted || item.name === wanted)) return name
  }
  return ''
}

function pickNames(record: LocalRecord, args: Record<string, unknown>): string[] | null {
  const groups = byIndicator(record)
  if (Array.isArray(args.indicators) && args.indicators.length > 0) {
    const resolved = [...new Set(args.indicators.map((wanted) => resolveIndicator(groups, String(wanted))).filter(Boolean))]
    return resolved.length > 0 ? resolved : args.indicators.map(String)
  }
  if (Array.isArray(args.keywords) && args.keywords.length > 0) {
    const words = args.keywords.map((word) => String(word).toLowerCase())
    return [...groups.keys()].filter((name) => words.some((word) => name.toLowerCase().includes(word)))
  }
  return null
}

function bucketOf(date: string, resolution: string): string {
  if (resolution === 'month') return date.slice(0, 7)
  if (resolution === 'week') {
    const at = new Date(`${date}T00:00:00Z`)
    const day = (at.getUTCDay() + 6) % 7
    at.setUTCDate(at.getUTCDate() - day)
    return at.toISOString().slice(0, 10)
  }
  return date
}

/** Mirobody 1.5.3 asks with one `view` word; older servers with resolution × aggregate. Both are answered. */
function fromView(args: Record<string, unknown>): Record<string, unknown> {
  const view = typeof args.view === 'string' ? args.view : ''
  if (!view) return args
  const { view: _view, ...rest } = args
  if (view === 'latest' || view === 'stats') return { ...rest, aggregate: view }
  if (view === 'raw') return { ...rest, resolution: 'raw' }
  return { ...rest, resolution: view, aggregate: 'none' }
}

export function queryIndicators(record: LocalRecord, rawArgs: Record<string, unknown> = {}): Record<string, unknown> {
  const args = fromView(rawArgs)
  const groups = byIndicator(record)
  const names = pickNames(record, args)
  if (names === null) {
    const rows = [...groups.keys()].sort(byCodePoint).map((name) => {
      const items = groups.get(name) ?? []
      const first = items[0] as Observation
      const last = items[items.length - 1] as Observation
      return {
        indicator: name, series: name, system: first.system, code: first.code, standard: true, name, kind: '',
        count: items.length, unit: first.unit, latest_value: last.value, first_date: first.date,
        last_date: last.date, total: groups.size, reason: '', day_known: true,
      }
    })
    return payload({ status: 'ok', rows, meta: meta(record, { rows: rows.length, catalogTotal: rows.length }) })
  }
  const unknown = names.filter((name) => !groups.has(name))
  if (unknown.length === names.length) {
    return payload({ status: 'error', errorKind: 'invalid_arguments', assumptions: [`indicator '${unknown[0] ?? ''}' is not in this record`], meta: meta(record) })
  }
  const start = String(args.start || '0000-01-01')
  const end = String(args.end || '9999-12-31')
  const aggregate = String(args.aggregate || 'none')
  const resolution = String(args.resolution || 'raw')
  const window: [string, string] = args.start || args.end ? [String(args.start || ''), String(args.end || '')] : ['', '']
  if (aggregate === 'latest') {
    const rows = names.filter((name) => groups.has(name)).map((name) => {
      const r = (groups.get(name) ?? []).filter((item) => item.date >= start && item.date <= end).at(-1)
      if (!r) return null
      return {
        indicator: name, series: name, system: r.system, code: r.code, name: r.name, time: r.time, date: r.date,
        value: r.value, unit: r.unit, value_canonical: null, unit_canonical: '', modality: '', basis: 'readings',
        day_known: true, provenance: 'measured',
      }
    }).filter((row): row is NonNullable<typeof row> => row !== null)
    return payload({ status: 'ok', rows, meta: meta(record, { window, aggregate: 'latest', basis: 'readings', rows: rows.length }) })
  }
  if (aggregate === 'stats') {
    const rows: Row[] = []
    for (const name of names) {
      const items = (groups.get(name) ?? []).filter((item) => item.date >= start && item.date <= end && numeric(item.value))
      if (items.length === 0) continue
      const nums = items.map((item) => Number(item.value))
      const first = items[0] as Observation
      const last = items[items.length - 1] as Observation
      rows.push({
        indicator: name, series: name, system: first.system, code: first.code, count: items.length,
        numeric_count: nums.length, min: new PyFloat(Math.min(...nums)), max: new PyFloat(Math.max(...nums)),
        avg: new PyFloat(pyRound(nums.reduce((a, b) => a + b, 0) / nums.length, 4)), first: first.value,
        first_date: first.date, last: last.value, last_date: last.date, unit: first.unit,
        mixed_units: new Set(items.map((item) => item.unit)).size > 1, basis: 'readings', day_known: true, provenance: 'computed',
        change: new PyFloat(pyRound((nums[nums.length - 1] ?? 0) - (nums[0] ?? 0), 4)),
      })
    }
    return payload({ status: 'ok', rows, meta: meta(record, { window, aggregate: 'stats', basis: 'readings', rows: rows.length }) })
  }
  if (resolution === 'raw') {
    const limit = Number(args.limit) || 50
    const rows: Row[] = []
    let truncated = false
    for (const name of names) {
      const items = (groups.get(name) ?? []).filter((item) => item.date >= start && item.date <= end).sort((a, b) => byCodePoint(b.time, a.time))
      if (items.length > limit) truncated = true
      for (const r of items.slice(0, limit)) {
        rows.push({
          indicator: name, series: name, system: r.system, code: r.code, name: r.name, time: r.time, date: r.date,
          value: r.value, unit: r.unit, value_canonical: null, unit_canonical: '', file: r.file, file_key: '',
          row_id: null, modality: '', total: items.length, day_known: true, provenance: 'measured',
        })
      }
    }
    return payload({ status: 'ok', rows, meta: meta(record, { window, resolution: 'raw', aggregate: 'none', rows: rows.length, truncated }) })
  }
  const rows: Row[] = []
  for (const name of names) {
    const perPeriod = new Map<string, number[]>()
    let last: Observation | null = null
    for (const r of groups.get(name) ?? []) {
      if (r.date < start || r.date > end || !numeric(r.value)) continue
      const period = bucketOf(r.date, resolution)
      perPeriod.set(period, [...(perPeriod.get(period) ?? []), Number(r.value)])
      last = r
    }
    if (!last) continue
    for (const period of [...perPeriod.keys()].sort()) {
      const values = perPeriod.get(period) ?? []
      rows.push({
        indicator: name, series: name, system: last.system, code: last.code, period,
        avg: new PyFloat(pyRound(values.reduce((a, b) => a + b, 0) / values.length, 4)),
        min: new PyFloat(Math.min(...values)), max: new PyFloat(Math.max(...values)), n: values.length,
        unit: last.unit, day_known: true, provenance: 'measured',
      })
    }
  }
  return payload({ status: 'ok', rows, meta: meta(record, { window, resolution, aggregate: 'none', basis: 'buckets', rows: rows.length }) })
}

export function queryMedications(record: LocalRecord, args: Record<string, unknown> = {}): Record<string, unknown> {
  const view = String(args.view || 'plan')
  const meds = record.medications
  const words = (Array.isArray(args.keywords) ? args.keywords : []).map((word) => String(word).toLowerCase())
  const matches = (name: string) => words.length === 0 || words.some((word) => name.toLowerCase().includes(word))
  const today = record.today || new Date().toISOString().slice(0, 10)
  if (view === 'log') {
    const end = String(args.end || today)
    const start = String(args.start || shiftDays(end, -29))
    const rows = (meds.log.filter((row) => row.date >= start && row.date <= end && matches(row.medication))
      .sort((a, b) => byCodePoint(b.date + b.medication, a.date + a.medication)).slice(0, 200) as unknown as Row[])
    return payload({ status: 'ok', rows, assumptions: [LOG_NOTE], meta: meta(record, { window: [start, end], rows: rows.length }) }, VIEW_COLUMNS.log)
  }
  if (view === 'history') {
    const rows = meds.history.filter((row) => matches(row.medication)) as unknown as Row[]
    return payload({ status: 'ok', rows, meta: meta(record, { rows: rows.length }) }, VIEW_COLUMNS.history)
  }
  const rows = meds.plans.filter((row) => matches(row.medication)) as unknown as Row[]
  return payload({ status: 'ok', rows, assumptions: [PLAN_NOTE], meta: meta(record, { rows: rows.length }) }, VIEW_COLUMNS.plan)
}

// --- the file -----------------------------------------------------------------------------------------

export const RECORD_FILE = 'record.json'

export function emptyRecord(): LocalRecord {
  return { tz: 'Asia/Shanghai', observations: [], medications: { plans: [], log: [], history: [] } }
}

export function readLocalRecord(path: string): LocalRecord {
  if (!existsSync(path)) return emptyRecord()
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<LocalRecord>
    return {
      tz: typeof raw.tz === 'string' && raw.tz ? raw.tz : 'Asia/Shanghai',
      ...(typeof raw.today === 'string' ? { today: raw.today } : {}),
      observations: Array.isArray(raw.observations) ? raw.observations.filter((row) => row && typeof row === 'object') as Observation[] : [],
      medications: {
        plans: Array.isArray(raw.medications?.plans) ? raw.medications.plans : [],
        log: Array.isArray(raw.medications?.log) ? raw.medications.log : [],
        history: Array.isArray(raw.medications?.history) ? raw.medications.history : [],
      },
    }
  } catch {
    return emptyRecord()
  }
}

export function writeLocalRecord(path: string, record: LocalRecord): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const { today: _today, ...kept } = record
  writeFileSync(path, `${JSON.stringify(kept, null, 1)}\n`, { mode: 0o600 })
}

/** The MCP tools the record answers, by name. */
export function callLocalTool(record: LocalRecord, name: string, args: Record<string, unknown>): { ok: true; result: unknown } | { ok: false; error: string } {
  if (name === 'query_health_indicators') return { ok: true, result: queryIndicators(record, args) }
  if (name === 'query_medications') return { ok: true, result: queryMedications(record, args) }
  if (name === 'list_members' || name === 'get_member') return { ok: true, result: { members: [] } }
  return { ok: false, error: `the record on this computer has no tool ${name}` }
}

// --- for the deep analysis ---------------------------------------------------------------------------

/** A series measured on most days (a wearable): at least 14 readings on at least half the days it spans. */
function isDaily(rows: readonly Observation[]): boolean {
  if (rows.length < 14) return false
  const days = [...new Set(rows.map((row) => row.date))].sort()
  const span = (Date.parse(`${days[days.length - 1]}T00:00:00Z`) - Date.parse(`${days[0]}T00:00:00Z`)) / 86_400_000 + 1
  return rows.length * 2 >= span
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * The record as the longevity-analyst intake reads it (what its own `la.py mirobody pull` writes): one lab CSV per
 * checkup date and one CSV of daily wearable values. Returns what was written.
 */
export function exportForAnalyst(record: LocalRecord, outDir: string, days = 120): { lab_files: string[]; wearable_file: string | null; lab_rows: number } {
  mkdirSync(outDir, { recursive: true, mode: 0o700 })
  const groups = byIndicator(record)
  const labs: Observation[] = []
  const daily: Array<[string, Observation[]]> = []
  for (const [name, rows] of groups) (isDaily(rows) ? daily.push([name, rows]) : labs.push(...rows))
  const byDate = new Map<string, Observation[]>()
  for (const row of labs) byDate.set(row.date, [...(byDate.get(row.date) ?? []), row])
  const labFiles: string[] = []
  for (const [date, rows] of [...byDate].sort(([a], [b]) => byCodePoint(a, b))) {
    const lines = ['marker,value,unit,ref_range,date,loinc,source']
    for (const row of rows) {
      const range = row.ref_low || row.ref_high ? `${row.ref_low ?? ''}-${row.ref_high ?? ''}` : ''
      lines.push([row.name || row.indicator, row.value, row.unit, range, row.date, row.system === 'loinc' ? row.code : '', 'longpi'].map(csvCell).join(','))
    }
    const path = `${outDir}/longpi_labs_${date}.csv`
    writeFileSync(path, `${lines.join('\n')}\n`, { mode: 0o600 })
    labFiles.push(path)
  }
  let wearable: string | null = null
  if (daily.length > 0) {
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
    const table = new Map<string, Record<string, string>>()
    const cols = daily.map(([name, rows]) => [name, rows[0]?.unit ? `${name} (${rows[0].unit})` : name] as const)
    for (const [name, rows] of daily) {
      const col = cols.find(([n]) => n === name)?.[1] ?? name
      for (const row of rows) if (row.date >= since) table.set(row.date, { ...(table.get(row.date) ?? {}), [col]: row.value })
    }
    const header = ['date', ...cols.map(([, col]) => col)]
    const lines = [header.map(csvCell).join(',')]
    for (const date of [...table.keys()].sort().reverse()) lines.push([date, ...cols.map(([, col]) => table.get(date)?.[col] ?? '')].map(csvCell).join(','))
    wearable = `${outDir}/longpi_wearable_daily.csv`
    writeFileSync(wearable, `${lines.join('\n')}\n`, { mode: 0o600 })
  }
  return { lab_files: labFiles, wearable_file: wearable, lab_rows: labs.length }
}
