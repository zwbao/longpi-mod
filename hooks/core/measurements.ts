// Turn a person's measurements into the CSV a skill script reads, with the
// same rules as skillkit.py in the skill: units convert only with the factors
// skill.json declares, and ranges are checked after conversion. An input with
// unit_required refuses a missing unit even when the row is passed under the
// input's own key (the record path does that). A missing unit used to be read
// as the key's unit, so a unitless CRP became mg/dL.
// Also decides which skills this person's record can already run, and which
// are ready (or one or two tests short) from the record itself.

import type { InputSpec, SkillCard } from './catalog.ts'
import { foldName, nameVariants, normalizeUnit, parseNumber } from './units.ts'

export interface MeasurementIn {
  key: string
  value: number | string
  unit?: string
}

export interface Problem {
  key: string
  label: string
  kind: 'missing' | 'unit' | 'unit_missing' | 'range' | 'parse' | 'duplicate' | 'unknown'
  message_zh: string
}

export interface Staged {
  values: Record<string, number>
  csv: string
  problems: Problem[]
  /** Each accepted value: which input it filled, and the unit conversion applied. */
  used: Array<{ key: string; from: string; unit: string; factor: number; given_unit: string; raw: number; value: number }>
}

export interface RecordIndicator {
  name: string
  value: string
  unit: string
  loinc?: string
  label?: string
  date?: string
  last_date?: string
  source?: 'self'
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(12)))
}

export function measurementInputs(card: SkillCard): InputSpec[] {
  return card.inputs.filter((spec) => (spec.from ?? 'measurements') === 'measurements')
}

export function aliasIndex(specs: readonly InputSpec[]): Map<string, { spec: InputSpec; byKey: boolean }> {
  const index = new Map<string, { spec: InputSpec; byKey: boolean }>()
  for (const spec of specs) index.set(foldName(spec.key), { spec, byKey: true })
  for (const spec of specs) {
    for (const name of [spec.label_zh, ...(spec.aliases ?? [])]) {
      const folded = foldName(name ?? '')
      if (folded && !index.has(folded)) index.set(folded, { spec, byKey: false })
    }
  }
  return index
}

export function unitFactor(spec: InputSpec, unit: string): number | null {
  const canonical = normalizeUnit(spec.unit ?? '')
  const given = normalizeUnit(unit)
  if (given === canonical) return 1
  for (const [name, factor] of Object.entries(spec.accept ?? {})) {
    if (normalizeUnit(name) === given) return factor
  }
  return null
}

function unitLabel(spec: InputSpec): string {
  return spec.unit && spec.unit !== '1' ? spec.unit : ''
}

function withUnit(text: string, unit: string): string {
  return unit ? `${text} ${unit}` : text
}

function rangeProblem(spec: InputSpec, value: number, shown: string, raw: number | null): Problem | null {
  if (!spec.range) return null
  const [low, high] = spec.range
  if (value >= low && value <= high) return null
  const unit = unitLabel(spec)
  let message = `${spec.label_zh} 读成 ${withUnit(fmt(value), unit)}（${shown}），不在合理范围 ${withUnit(`${fmt(low)}–${fmt(high)}`, unit)} 内。`
  if (raw != null) {
    const hints = Object.entries(spec.accept ?? {})
      .filter(([name, factor]) => normalizeUnit(name) !== normalizeUnit(spec.unit ?? '') && raw * factor >= low && raw * factor <= high)
      .map(([name]) => name)
    if (hints.length > 0) message += `如果化验单上的单位是 ${hints.join('、')}，请写明单位。`
  }
  if (spec.note_zh) message += spec.note_zh
  return { key: spec.key, label: spec.label_zh, kind: 'range', message_zh: message }
}

export function resolveInput(index: Map<string, { spec: InputSpec; byKey: boolean }>, name: string): { spec: InputSpec; byKey: boolean } | null {
  for (const variant of nameVariants(name)) {
    const hit = index.get(variant)
    if (hit) return hit
  }
  return null
}

/** Validate and convert measurements; build the CSV in the input's own units. */
export function stageMeasurements(card: SkillCard, items: readonly MeasurementIn[]): Staged {
  const specs = measurementInputs(card)
  const index = aliasIndex(specs)
  const values: Record<string, number> = {}
  const problems: Problem[] = []
  const used: Staged['used'] = []
  for (const item of items) {
    const hit = resolveInput(index, String(item.key ?? ''))
    if (!hit) {
      problems.push({ key: String(item.key), label: String(item.key), kind: 'unknown', message_zh: `${item.key} 不是这个技能要的输入。` })
      continue
    }
    const { spec } = hit
    const number = parseNumber(item.value)
    if (number == null) {
      problems.push({ key: spec.key, label: spec.label_zh, kind: 'parse', message_zh: `${spec.label_zh} 的值「${String(item.value)}」不是一个可以计算的数。` })
      continue
    }
    const unit = String(item.unit ?? '')
    let factor: number | null = 1
    let shown = unitLabel(spec) ? `按 ${unitLabel(spec)} 读` : '没有单位'
    if (!normalizeUnit(unit)) {
      // The record path passes spec.key. The key name is not a unit: a unitless
      // or unlabelled CRP must not be read as mg/dL.
      if (spec.unit_required) {
        const accepted = [spec.unit ?? '', ...Object.keys(spec.accept ?? {}).filter((name) => normalizeUnit(name) !== normalizeUnit(spec.unit ?? ''))]
        problems.push({ key: spec.key, label: spec.label_zh, kind: 'unit_missing', message_zh: `${spec.label_zh} 没有写单位。这一项常见 ${accepted.join('、')}，请写明单位。` })
        continue
      }
    } else {
      factor = unitFactor(spec, unit)
      if (factor == null) {
        const accepted = [...new Set([spec.unit ?? '', ...Object.keys(spec.accept ?? {})])]
        problems.push({ key: spec.key, label: spec.label_zh, kind: 'unit', message_zh: `${spec.label_zh} 的单位 ${unit} 不能换算成 ${unitLabel(spec) || '无单位的数'}。可以接受：${accepted.filter(Boolean).join('、') || '无单位'}。${spec.note_zh ?? ''}` })
        continue
      }
      shown = factor === 1 ? `单位 ${unit}` : `原值 ${fmt(number)} ${unit}`
    }
    const value = number * factor
    if (spec.key in values && Math.abs((values[spec.key] ?? 0) - value) > 1e-9 * Math.max(1, Math.abs(value))) {
      problems.push({ key: spec.key, label: spec.label_zh, kind: 'duplicate', message_zh: `${spec.label_zh} 出现了两次，数值不同。请只保留一次。` })
      continue
    }
    const problem = rangeProblem(spec, value, shown, factor === 1 ? number : null)
    if (problem) {
      problems.push(problem)
      continue
    }
    values[spec.key] = value
    used.push({ key: spec.key, from: String(item.key), unit: spec.unit ?? '', factor, given_unit: unit, raw: number, value })
  }
  for (const spec of specs) {
    if (spec.required && !(spec.key in values) && !problems.some((problem) => problem.key === spec.key)) {
      problems.push({ key: spec.key, label: spec.label_zh, kind: 'missing', message_zh: `缺少${spec.label_zh}。` })
    }
  }
  const header = card.entry?.measurements_header?.length ? card.entry.measurements_header : ['marker', 'value', 'unit']
  const rows = [header.join(',')]
  for (const spec of specs) {
    if (!(spec.key in values)) continue
    const cells = [spec.key, fmt(values[spec.key] ?? 0)]
    if (header.length > 2) cells.push(spec.unit ?? '')
    rows.push(cells.join(','))
  }
  return { values, csv: `${rows.join('\n')}\n`, problems, used }
}

export interface Runnable {
  /** Whether the required inputs are all there (ready), one or two short (partial), or not; from any source. */
  status: 'ready' | 'partial' | 'none' | 'unknown'
  have: string[]
  missing: string[]
  from_record: MeasurementIn[]
  /**
   * The same question asked of the record alone. ready: every required input is there and at least one
   * record-backed input (a LOINC or device code) came from the record. near: only record-backed inputs are
   * missing, one or two of them. A method with no record-backed input is never ready or near from the record.
   */
  record: 'ready' | 'near' | 'none'
  /** Missing required inputs a checkup or a device could supply. */
  missing_from_record: string[]
  /** Required inputs on file whose value was not read (a failed read, or a catalogue cut short): in missing, never in missing_from_record. */
  unread: string[]
}

/** An input a checkup or a device records: a measurement with a LOINC or device code. */
export function recordBacked(spec: InputSpec): boolean {
  return (spec.from ?? 'measurements') === 'measurements' && ((spec.loinc ?? []).length > 0 || (spec.device_codes ?? []).length > 0)
}

/** Which of this skill's required inputs the record, the profile and past outputs already supply. */
export function runnableFrom(
  card: SkillCard,
  indicators: readonly RecordIndicator[],
  profile: { age: number | null; sex: string },
  outputs: Record<string, unknown> = {},
  reads: { failed?: readonly string[]; catalog_truncated?: boolean; probed?: readonly string[] } = {},
): Runnable {
  if (card.inputsStatus === 'none' || card.inputs.length === 0 || !card.script) {
    return { status: 'unknown', have: [], missing: [], from_record: [], record: 'none', missing_from_record: [], unread: [] }
  }
  const unread: string[] = []
  const have: string[] = []
  const missing: string[] = []
  const fromRecord: MeasurementIn[] = []
  // Optional inputs count too: a method that reads routine labs when present is ready from the record once one is.
  const recordHas = card.inputs.some((spec) => recordBacked(spec) && indicatorFor(spec, indicators) != null)
  const missingFromRecord: string[] = []
  for (const spec of card.inputs) {
    if (!spec.required) continue
    const source = spec.from ?? 'measurements'
    if (source === 'profile') {
      const ok = spec.key === 'age' ? profile.age != null : (profile.sex && profile.sex !== 'unknown')
      if (ok) have.push(spec.label_zh)
      else missing.push(spec.label_zh)
      continue
    }
    if (source === 'measurements') {
      const found = indicatorFor(spec, indicators)
      if (found) {
        have.push(spec.label_zh)
        fromRecord.push({ key: spec.key, value: found.value, unit: found.unit })
        continue
      }
      if (spec.output_of?.some((key) => key in outputs)) {
        have.push(spec.label_zh)
        continue
      }
      missing.push(spec.label_zh)
      if (!recordBacked(spec)) continue
      // Not read is not "not measured": never a test to add.
      if (notRead(spec, indicators, reads)) unread.push(spec.label_zh)
      else missingFromRecord.push(spec.label_zh)
      continue
    }
    if (source === 'output' && spec.output_of?.some((key) => key in outputs)) {
      have.push(spec.label_zh)
      continue
    }
    missing.push(spec.label_zh)
  }
  const status = missing.length === 0 ? 'ready' : (have.length > 0 && missing.length <= 2 ? 'partial' : 'none')
  const record = missing.length === 0 ? (recordHas ? 'ready' : 'none')
    : status === 'partial' && missingFromRecord.length === missing.length ? 'near' : 'none'
  return { status, have, missing, from_record: fromRecord, record, missing_from_record: missingFromRecord, unread }
}

/** A record row that could hold one declared input, and its place: the order of the input's codes in skill.json. */
export interface Candidate {
  row: RecordIndicator
  /** 0… for its LOINC codes in skill.json order, then its device codes; name matches come after every code. */
  rank: number
  by: 'code' | 'name'
}

/**
 * Every record row that could hold one input, numeric or not: rows carrying one of its LOINC or device codes,
 * best code first; or, only when no row carries a code, rows named like it (its key, label or aliases, a self
 * measurement first).
 */
export function candidatesFor(spec: InputSpec, indicators: readonly RecordIndicator[]): Candidate[] {
  const codes = [...(spec.loinc ?? [])]
  const devices = spec.device_codes ?? []
  const out: Candidate[] = []
  for (const row of indicators) {
    const loinc = row.loinc ? codes.indexOf(row.loinc) : -1
    if (loinc >= 0) {
      out.push({ row, rank: loinc, by: 'code' })
      continue
    }
    const device = row.source !== 'self' ? devices.indexOf(row.name) : -1
    if (device >= 0) out.push({ row, rank: codes.length + device, by: 'code' })
  }
  if (out.length > 0) return out.sort((a, b) => a.rank - b.rank)
  // A self row is in the list only when it is newer than the record's own row, so it is tried first.
  return preferSelf(indicators).filter((row) => matchesInputName(spec, row.name) || matchesInputName(spec, row.label)).map((row) => ({ row, rank: codes.length + devices.length, by: 'name' as const }))
}

/** Qualifiers a report may append to an analyte (红细胞分布宽度-变异系数). 标准差 is RDW-SD, not RDW-CV. */
const NAME_QUALIFIERS = new Set(['变异系数', 'cv', '百分比'])

/**
 * Whether a report or series name is this input. Exact folded names, the same name with 血 inserted
 * (空腹血葡萄糖 and 空腹葡萄糖), or the label plus a CV/percent qualifier.
 */
export function matchesInputName(spec: InputSpec, text: string | undefined): boolean {
  if (!text) return false
  const aliases = [spec.key, spec.label_zh, ...(spec.aliases ?? [])].map((name) => foldName(name)).filter(Boolean)
  const exact = new Set(aliases)
  const variants = nameVariants(text)
  if (variants.some((variant) => exact.has(variant))) return true
  const stripped = new Set(aliases.map((alias) => alias.replace(/血/g, '')).filter((alias) => alias.length >= 2))
  if (variants.some((variant) => stripped.has(variant.replace(/血/g, '')))) return true
  for (const variant of variants) {
    for (const alias of aliases) {
      if (alias.length < 4 || variant.length <= alias.length || !variant.startsWith(alias)) continue
      if (NAME_QUALIFIERS.has(variant.slice(alias.length))) return true
    }
  }
  return false
}

/**
 * Whether an input the record shows no value for may simply not have been read: a row that could hold it is
 * among the reads that failed; or none is listed, and the catalogue was cut, or the input is known only by
 * name while some rows went unread (their report names come with the value, so they cannot be matched).
 */
export function notRead(spec: InputSpec, indicators: readonly RecordIndicator[], reads: { failed?: readonly string[]; catalog_truncated?: boolean; probed?: readonly string[] }): boolean {
  const failed = new Set(reads.failed ?? [])
  const names = candidatesFor(spec, indicators).map((item) => item.row.name)
  if (names.some((name) => failed.has(name))) return true
  if (names.length > 0) return false
  // An explicit lookup answered: the series is not on file, even if the catalogue was cut.
  if ((reads.probed ?? []).includes(spec.key)) return false
  const coded = (spec.loinc ?? []).length > 0 || (spec.device_codes ?? []).length > 0
  return Boolean(reads.catalog_truncated) || (!coded && failed.size > 0)
}

function dateOf(row: RecordIndicator): string {
  return row.date || row.last_date || ''
}

/** A row whose unit converts, or whose missing unit is allowed. A wrong label (Nightingale unit, empty CRP) does not. */
function unitAccepted(spec: InputSpec, row: RecordIndicator): boolean {
  const unit = String(row.unit ?? '')
  if (!normalizeUnit(unit)) return !spec.unit_required
  return unitFactor(spec, unit) != null
}

function preferCandidate(spec: InputSpec, item: Candidate, best: Candidate): boolean {
  const itemDate = dateOf(item.row)
  const bestDate = dateOf(best.row)
  if (itemDate !== bestDate) return itemDate > bestDate
  // Same day, same code: a convertible unit beats a missing or wrong one, then the earlier code in skill.json.
  const itemOk = unitAccepted(spec, item.row)
  const bestOk = unitAccepted(spec, best.row)
  if (itemOk !== bestOk) return itemOk
  return item.rank < best.rank
}

/**
 * The record indicator that holds one declared input: of the rows with a number, the newest across all of the
 * input's codes; on the same date a unit that converts beats a missing or wrong label, then the earlier code
 * in skill.json order. Rows matched only by name are the fallback when no row carries a code.
 */
export function indicatorFor(spec: InputSpec, indicators: readonly RecordIndicator[]): RecordIndicator | null {
  let best: Candidate | null = null
  for (const item of candidatesFor(spec, indicators)) {
    if (parseNumber(item.row.value) == null) continue
    if (!best || preferCandidate(spec, item, best)) best = item
  }
  return best?.row ?? null
}

/** Self measurements first: records.ts merges one only when it is the newest reading of its kind. */
export function preferSelf<T extends { source?: string }>(rows: readonly T[]): T[] {
  return [...rows.filter((row) => row.source === 'self'), ...rows.filter((row) => row.source !== 'self')]
}
