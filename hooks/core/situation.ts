import { tableOf, type CompactTable } from './compact.ts'
import { isDiagnosisName } from './ux/plain.ts'

export interface IndicatorRow {
  /** Mirobody's indicator name: the handle a later query must pass back verbatim. */
  name: string
  value: string
  unit: string
  loinc?: string
  /** The name as printed on the source report (白蛋白), when Mirobody kept it. */
  label?: string
  /** Local date of the value. */
  date?: string
  count?: number
  first_date?: string
  last_date?: string
  /** A measurement the person took and entered themselves (selfmeasure.ts), not a Mirobody row. */
  source?: 'self'
}

export interface MedicationRow {
  name: string
  status: string
  recorded_dose: string
  schedule?: string
  since?: string
  until?: string
  plan_id?: string
}

// A conservative screen, not an exhaustive one: name fragments of glucose-lowering medicines.
export const GLUCOSE_LOWERING = /二甲双胍|格列|列汀|列净|胰岛素|阿卡波糖|鲁肽|降糖|metformin|insulin|gliptin|gliflozin|glutide|glipizide|gliclazide|glimepiride|acarbose/i
const STOPPED = /^\s*(?:stopped|ended|inactive|completed|discontinued|停用|已停|已停用|停药|结束|已结束|已完成)\s*$/i

/** Names on the medication plan that are not marked stopped. */
export function currentMedications(rows: readonly MedicationRow[]): string[] {
  return rows.filter((row) => row.name && !STOPPED.test(row.status ?? '')).map((row) => row.name)
}

/**
 * The medicines a plan starting today has to allow for (INT062 fix 5a): the current ones, including one whose
 * start date falls inside the plan window (a prescription that begins next week counts from the draft on). A start
 * date past the window is not this plan's.
 */
export function medicationsForWindow(rows: readonly MedicationRow[], windowEnd: string): string[] {
  return currentMedications(rows.filter((row) => {
    const since = (row.since ?? '').slice(0, 10)
    return !/^\d{4}-\d{2}-\d{2}$/.test(since) || since <= windowEnd
  }))
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function firstText(rec: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const text = textOf(rec[key])
    if (text) return text
  }
  return ''
}

/** A LOINC code from a compact row. Mirobody sends `loinc` or `http://loinc.org`. */
export function loincCode(system: string | undefined, code: string | undefined): string {
  const text = (system ?? '').trim().toLowerCase()
  if (text !== 'loinc' && !text.includes('loinc.org')) return ''
  return (code ?? '').trim()
}

function loincOf(row: Record<string, string>): string {
  return loincCode(row.system, row.code)
}

/** Rows of a Mirobody catalogue or latest table as indicator rows. */
export function indicatorsFromTable(table: CompactTable): IndicatorRow[] {
  const out: IndicatorRow[] = []
  for (const row of table.rows) {
    const name = (row.indicator ?? '').trim()
    if (!name || isDiagnosisName(name)) continue
    const item: IndicatorRow = { name, value: (row.value ?? row.last ?? '').trim(), unit: (row.unit ?? '').trim() }
    const loinc = loincOf(row)
    if (loinc) item.loinc = loinc
    const label = (row.name ?? '').trim()
    if (label && label !== name) item.label = label
    const date = (row.date || row.last_date || (row.time ?? '').slice(0, 10)).trim()
    if (date && item.value) item.date = date
    if (row.count && /^\d+$/.test(row.count)) item.count = Number(row.count)
    if (row.first_date) item.first_date = row.first_date
    if (row.last_date) item.last_date = row.last_date
    out.push(item)
  }
  return out
}

export function summarizeIndicators(payload: unknown, max = 40): IndicatorRow[] {
  const table = tableOf(payload)
  const rows: IndicatorRow[] = []
  if (table) rows.push(...indicatorsFromTable(table))
  else walkIndicators(payload, rows, 0, Math.max(max * 2, 80))
  const seen = new Set<string>()
  const unique: IndicatorRow[] = []
  for (const row of rows) {
    const key = row.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(row)
    if (unique.length >= max) break
  }
  return unique
}

function walkIndicators(value: unknown, rows: IndicatorRow[], depth: number, cap: number): void {
  if (depth > 8 || rows.length >= cap) return
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string') {
        const name = item.trim()
        if (name && !isDiagnosisName(name)) rows.push({ name, value: '', unit: '' })
      } else {
        walkIndicators(item, rows, depth + 1, cap)
      }
    }
    return
  }
  const rec = asRecord(value)
  if (!rec) return
  const name = firstText(rec, ['indicator', 'indicator_name', 'name', 'title'])
  const measurement = firstText(rec, ['value', 'latest', 'result', 'last_value'])
  const unit = firstText(rec, ['unit', 'ucum'])
  const loinc = firstText(rec, ['loinc', 'loinc_code', 'loincCode'])
  if (name && !isDiagnosisName(name) && (measurement || unit)) rows.push(loinc ? { name, value: measurement, unit, loinc } : { name, value: measurement, unit })
  for (const [key, child] of Object.entries(rec)) {
    if (key === 'name' || key === 'value' || key === 'unit') continue
    if (child && typeof child === 'object') walkIndicators(child, rows, depth + 1, cap)
  }
}

export function summarizeMedications(payload: unknown): MedicationRow[] {
  const table = tableOf(payload)
  const rows: MedicationRow[] = []
  if (table) {
    for (const row of table.rows) {
      const name = (row.medication ?? '').trim()
      if (!name) continue
      const item: MedicationRow = { name, status: (row.status ?? '').trim(), recorded_dose: (row.dose ?? '').trim() }
      if (row.schedule) item.schedule = row.schedule
      if (row.since) item.since = row.since
      if (row.until) item.until = row.until
      if (row.plan_id) item.plan_id = row.plan_id
      rows.push(item)
    }
  } else {
    walkMedications(payload, rows, 0)
  }
  const seen = new Set<string>()
  const unique: MedicationRow[] = []
  for (const row of rows) {
    const key = row.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(row)
    if (unique.length >= 30) break
  }
  return unique
}

function walkMedications(value: unknown, rows: MedicationRow[], depth: number): void {
  if (depth > 8 || rows.length >= 60) return
  if (Array.isArray(value)) {
    for (const item of value) walkMedications(item, rows, depth + 1)
    return
  }
  const rec = asRecord(value)
  if (!rec) return
  const name = firstText(rec, ['drug', 'medication', 'medicine', 'name', 'title'])
  const status = firstText(rec, ['status', 'state'])
  const recorded = firstText(rec, ['dose', 'dosage', 'strength', 'recorded_dose'])
  if (name && (status || recorded || rec.dose != null || rec.status != null)) {
    rows.push({ name, status, recorded_dose: recorded })
  }
  for (const [key, child] of Object.entries(rec)) {
    if (['name', 'dose', 'status', 'drug'].includes(key)) continue
    if (child && typeof child === 'object') walkMedications(child, rows, depth + 1)
  }
}
