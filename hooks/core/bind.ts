// The model proposes which record row fills which input. This module checks
// the manifest key, the unit, the range, and the provenance. It does not
// choose the skill. Optional failures are dropped. A required failure stops
// the run. Labels: verified, unverified-binding, evidence-only.

import { loadCatalog, type InputSpec, type SkillCard } from './catalog.ts'
import type { BindingInput, BindingIssue, BindingProposal, BindingValidation, ConditionRow, MethodInputUsed, MethodResult, ProvenanceKind, ProteinRow, ResultLabel, StoreKind, TaxaRow } from './contracts/library.ts'
import { readStore } from './contracts/library.ts'
import { conditionMatches } from './stores/conditions.ts'
import { applyVersionPin } from './pin.ts'
import type { OutputValue } from './history.ts'
import { aliasIndex, candidatesFor, resolveInput, stageMeasurements, unitFactor, type MeasurementIn, type RecordIndicator } from './measurements.ts'
import { libraryHome } from './skills-provider.ts'
import { recordIsLocal } from './mcp.ts'
import { speciesZh } from './skills-provider.ts'
import { foldName, parseNumber } from './units.ts'

/** Abdominal CT calcium. A bare Agatston score is coronary and is refused. */
export const ABDOMINAL_CT_SKILL = 'biological-age-ct-cardiometabolic'

/** Device series the installed manifests do not name yet. */
const DEVICE_BINDS: Record<string, Record<string, readonly string[]>> = {
  'sleep-chart-biological-ageing': { sleep_hours: ['dailyTotalSleepTime'] },
}

/** Male China-PAR equation needs these; the manifest marks them optional because women do not. */
const MEN_REQUIRED = new Set(['urban', 'family_history'])

const CORONARY_NAMES = new Set([
  'agatston',
  'agatston_score',
  'coronary_agatston',
  'coronary_calcium',
  'coronary_artery_calcium',
  'cac',
  'cac_score',
  'total_agatston',
])

export interface BindingRow extends RecordIndicator {
  kind?: ProvenanceKind
  code?: string
  report_type?: string
}

export interface BindingProfile {
  age: number | null
  sex: string
  risk?: Partial<Record<string, boolean | null>>
  waist_cm?: number | null
}

export interface BindingOutput {
  value: number | string | null
  unit?: string
  skill?: string
}

/** What the server can see. Omit it and a proposal is checked against the manifest only. */
export interface RecordView {
  home?: string
  indicators?: readonly BindingRow[]
  profile?: BindingProfile
  outputs?: Record<string, BindingOutput>
  /** Empty means no pin is configured. A non-empty pin must equal the catalog version to label verified. */
  pinnedVersion?: string
}

export interface BindingReport {
  ok: boolean
  issues: BindingIssue[]
  label: ResultLabel
  measurements: MeasurementIn[]
  args: string[]
  inputs_used: MethodInputUsed[]
  limits_zh: string
  catalog_version: string
  /** Set when this must not be shown as a personal number. */
  blockReason: string | null
}

type Backing = 'loinc' | 'device' | 'profile' | 'output' | 'store' | 'name'

interface Accepted {
  spec: InputSpec
  input: BindingInput
  measurement?: MeasurementIn
  arg?: string
  backing: Backing
}

let viewSlot: RecordView | null = null

export function useBindingView<T>(view: RecordView | null, fn: () => T): T {
  const prev = viewSlot
  viewSlot = view
  try {
    return fn()
  } finally {
    viewSlot = prev
  }
}

export function currentBindingView(): RecordView | null {
  return viewSlot
}

function coronaryKey(name: string): string {
  return name.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

/** Same refusal as the library branch: a bare Agatston score is coronary calcium. */
export function isCoronaryName(name: string): boolean {
  const key = coronaryKey(name)
  if (!key) return false
  if (CORONARY_NAMES.has(key) || key.startsWith('coronary_')) return true
  return name.includes('冠脉') || name.includes('冠状动脉')
}

function deviceCodes(card: SkillCard, spec: InputSpec): string[] {
  const extra = DEVICE_BINDS[card.name]?.[spec.key] ?? []
  return [...new Set([...(spec.device_codes ?? []), ...extra])]
}

function withDevices(card: SkillCard, spec: InputSpec): InputSpec {
  const device_codes = deviceCodes(card, spec)
  return device_codes.length === (spec.device_codes ?? []).length ? spec : { ...spec, device_codes }
}

/** What kind of row this input accepts. Alias text is not enough. */
export function specKind(spec: InputSpec): ProvenanceKind | 'probe' | 'any' {
  if (/^cg\d+$/i.test(spec.key)) return 'probe'
  const note = spec.note_zh ?? ''
  const label = `${spec.label_zh} ${spec.key}`
  const blob = `${label} ${(spec.aliases ?? []).join(' ')}`.toLowerCase()
  if (/腹主动脉|abdominal aortic|aortic_calcium/.test(`${blob} ${note}`) && !/冠脉|冠状动脉/.test(spec.label_zh)) return 'abdominal_ct'
  if (/冠脉|冠状动脉|coronary/.test(spec.label_zh)) return 'coronary_ct'
  const deniesMethyl = /不是甲基化/.test(note)
  const labelMethyl = /甲基化|dnam|grimage|horvath|dunedin/i.test(label)
  const labelBlood = /血检表型|血液表型|临床表型|blood phenoage/i.test(label)
  if (labelBlood || (deniesMethyl && /表型年龄|phenoage/i.test(label))) return 'blood_clock'
  if (labelMethyl && !deniesMethyl) return 'methylation_clock'
  if (spec.from === 'profile') return 'profile'
  if (spec.from === 'argument') return 'questionnaire'
  if ((spec.device_codes ?? []).length > 0) return 'wearable'
  if ((spec.loinc ?? []).length > 0) return 'routine_lab'
  if ((spec.output_of ?? []).length > 0) return 'output_of'
  return 'any'
}

function barePhenoAge(text: string): boolean {
  const folded = foldName(text)
  return folded === 'phenoage' || folded === 'phenotypicage'
}

/** The row the model pointed at, from its quote and provenance, not from an alias list. */
export function proposedRowKind(input: BindingInput, key = ''): ProvenanceKind | 'any' {
  const hay = `${input.quote} ${input.source_row_id} ${key}`
  if (isCoronaryName(input.quote) || isCoronaryName(input.source_row_id) || isCoronaryName(key)) return 'coronary_ct'
  if (input.provenance === 'coronary_ct' && !/腹主动脉/.test(hay)) return 'coronary_ct'
  if (/accelerated-biological-aging-risk/.test(input.source_row_id)) return 'blood_clock'
  // The quote wins over a provenance tag. A bare PhenoAge code is the methylation clock.
  if (/血检表型|血液表型|临床表型|九项常规|blood phenoage|levine phenotypic/i.test(hay)) return 'blood_clock'
  if (/甲基化|dnam|methylation/i.test(hay)) return 'methylation_clock'
  if (barePhenoAge(input.quote) || barePhenoAge(input.source_row_id) || barePhenoAge(key)) return 'methylation_clock'
  if (input.provenance === 'methylation_clock') return 'methylation_clock'
  if (input.provenance === 'blood_clock') return 'blood_clock'
  if (input.provenance === 'abdominal_ct') return 'abdominal_ct'
  return input.provenance
}

function contradiction(spec: InputSpec, input: BindingInput, key: string, skill: string): string | null {
  const want = specKind(spec)
  const got = proposedRowKind(input, key)
  if ((want === 'blood_clock' || (want === 'any' && /表型年龄/.test(spec.label_zh) && /不是甲基化/.test(spec.note_zh ?? ''))) && got === 'methylation_clock') {
    return '甲基化 PhenoAge 不能当作血检表型年龄。'
  }
  if (want === 'methylation_clock' && got === 'blood_clock') return '血检表型年龄不能当作甲基化 PhenoAge。'
  if ((want === 'abdominal_ct' || skill === ABDOMINAL_CT_SKILL) && got === 'coronary_ct') return '冠脉 Agatston 不是腹主动脉钙化。'
  if (want === 'blood_clock' && got === 'methylation_clock') return '单独的 PhenoAge 不能当作血检表型年龄。'
  return null
}

function rowKind(row: BindingRow): ProvenanceKind | 'any' {
  if (row.kind) return row.kind
  if (row.report_type === 'methylation') return 'methylation_clock'
  if (isCoronaryName(row.name) || isCoronaryName(row.label ?? '') || isCoronaryName(row.code ?? '')) return 'coronary_ct'
  if (row.loinc) return 'routine_lab'
  return 'any'
}

function rowContradicts(spec: InputSpec, row: BindingRow, skill: string): boolean {
  const want = specKind(spec)
  const got = rowKind(row)
  if (want === 'blood_clock' && got === 'methylation_clock') return true
  if (want === 'methylation_clock' && got === 'blood_clock') return true
  if ((want === 'abdominal_ct' || skill === ABDOMINAL_CT_SKILL) && got === 'coronary_ct') return true
  return false
}

function requiredNow(spec: InputSpec, sex: string): boolean {
  if (MEN_REQUIRED.has(spec.key)) return sex === 'male'
  return spec.required
}

function yesNo(value: number | string): 'yes' | 'no' | null {
  const text = String(value).trim().toLowerCase()
  if (['yes', 'true', '1', '是', '有'].includes(text)) return 'yes'
  if (['no', 'false', '0', '否', '无'].includes(text)) return 'no'
  return null
}

function sexWord(value: number | string): string | null {
  const text = String(value).trim().toLowerCase()
  if (['male', 'm', '男', '男性'].includes(text)) return 'male'
  if (['female', 'f', '女', '女性'].includes(text)) return 'female'
  return null
}

function close(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-6 * Math.max(1, Math.abs(left), Math.abs(right))
}

function rowsOf<K extends StoreKind>(kind: K) {
  try {
    return readStore(kind)
  } catch (error) {
    if (error instanceof Error && error.message.includes('not implemented')) return []
    throw error
  }
}

function storeProbe(key: string): number | null {
  if (!/^cg\d+$/i.test(key)) return null
  const hit = [...rowsOf('methylation')].reverse().find((row) => row.probe_id.toLowerCase() === key.toLowerCase())
  return hit ? hit.beta : null
}

function storeCondition(key: string): ConditionRow | null {
  return [...rowsOf('conditions')].reverse().find((row) => conditionMatches(row.code, key)) ?? null
}

function storeGenus(key: string): TaxaRow | null {
  const name = key.trim().toLowerCase()
  if (!name || name.length < 4) return null
  return [...rowsOf('taxa')].reverse().find((row) => row.genus.toLowerCase() === name) ?? null
}

function storeProtein(key: string): ProteinRow | null {
  const name = key.trim().toLowerCase()
  if (!name) return null
  return [...rowsOf('proteins')].reverse().find((row) => row.symbol.toLowerCase() === name || row.id.toLowerCase() === name) ?? null
}

/** A store row for this manifest key, or null when the store is off or has no match. */
function storeBinding(spec: InputSpec): BindingInput | null {
  if (/^cg\d+$/i.test(spec.key)) {
    const beta = storeProbe(spec.key)
    if (beta == null) return null
    return { source_row_id: `store:methylation:${spec.key}`, value: beta, unit: '1', provenance: 'methylation_clock', quote: spec.key }
  }
  const condition = storeCondition(spec.key)
  if (condition) {
    return {
      source_row_id: `store:conditions:${condition.code}`,
      value: 1,
      unit: spec.unit || 'score',
      provenance: 'questionnaire',
      quote: `${condition.code} ${condition.display}`.trim(),
    }
  }
  const genus = storeGenus(spec.key)
  if (genus && !spec.loinc?.length) {
    return {
      source_row_id: `store:taxa:${genus.site}:${genus.genus}`,
      value: genus.relative_abundance,
      unit: spec.unit || '1',
      provenance: 'routine_lab',
      quote: `${genus.site} ${genus.genus} ${genus.relative_abundance}`,
    }
  }
  const protein = storeProtein(spec.key)
  if (protein && !spec.loinc?.length) {
    return {
      source_row_id: `store:proteins:${protein.symbol || protein.id}`,
      value: protein.value,
      unit: protein.unit_or_z || spec.unit || '',
      provenance: 'routine_lab',
      quote: `${protein.symbol || protein.id} ${protein.value} ${protein.unit_or_z}`.trim(),
    }
  }
  return null
}

function numberFromStore(source: string, key: string): number | null {
  const parts = source.split(':')
  const kind = parts[1]
  if (kind === 'methylation') return storeProbe(parts[2] || key)
  if (kind === 'conditions') return storeCondition(parts[2] || key) ? 1 : null
  if (kind === 'taxa') {
    const site = parts[2]
    const genus = parts.slice(3).join(':') || key
    const row = rowsOf('taxa').find((item) => item.genus.toLowerCase() === genus.toLowerCase() && (!site || item.site === site))
    return row ? row.relative_abundance : null
  }
  if (kind === 'proteins') {
    const row = storeProtein(parts.slice(2).join(':') || key)
    return row ? row.value : null
  }
  return null
}

function findSpec(card: SkillCard, key: string): InputSpec | undefined {
  const direct = card.inputs.find((spec) => spec.key === key)
  if (direct) return direct
  const index = aliasIndex(card.inputs.filter((spec) => (spec.from ?? 'measurements') === 'measurements' || spec.from === 'output'))
  return resolveInput(index, key)?.spec
}

function backingOf(card: SkillCard, spec: InputSpec, input: BindingInput, row: BindingRow | null): Backing {
  if (input.provenance === 'output_of' || spec.from === 'output') return 'output'
  if (input.provenance === 'profile' || spec.from === 'profile' || spec.from === 'argument') return 'profile'
  if (row?.source === 'self' && (spec.key === 'waist_cm' || spec.key === 'sbp_mmhg' || spec.key === 'weight_kg')) return 'profile'
  if (row?.loinc && (spec.loinc ?? []).includes(row.loinc)) return 'loinc'
  if (row && deviceCodes(card, spec).includes(row.name)) return 'device'
  if (row?.code && row.code.toLowerCase() === spec.key.toLowerCase()) return 'store'
  return 'name'
}

function witnessRow(card: SkillCard, spec: InputSpec, input: BindingInput, view: RecordView): BindingRow | null {
  const specRow = withDevices(card, spec)
  const rows = candidatesFor(specRow, view.indicators ?? [])
  const proposed = parseNumber(input.value)
  for (const item of rows) {
    const row = item.row as BindingRow
    if (rowContradicts(spec, row, card.name)) continue
    if (proposed == null) continue
    const factor = unitFactor(spec, input.unit || row.unit || spec.unit || '') ?? (input.unit ? null : 1)
    const rowFactor = unitFactor(spec, row.unit || spec.unit || '') ?? (row.unit ? null : 1)
    if (factor == null || rowFactor == null) continue
    const rowNumber = parseNumber(row.value)
    if (rowNumber == null) continue
    if (close(proposed * factor, rowNumber * rowFactor)) return row
  }
  return null
}

function limitsFor(card: SkillCard, label: ResultLabel): string {
  if (card.tier === 'C') {
    const species = speciesZh(card.species) || '非人类'
    return `${species}研究，不是这个人的数字。`
  }
  if (label === 'evidence-only') return '这个方法没有可核对的个人公式，只作证据。'
  if (label === 'unverified-binding') return '单位和范围已核对，来源是点名的记录行，还不是清单上的代码直接对上。不要说比实足年龄年轻。'
  return '清单已核对单位、范围和来源。这是模型估计。只有核对通过、而且变化超出正常波动，才可以说比实足年龄年轻。'
}

function labelFor(card: SkillCard, used: readonly Accepted[], version: string, pinned: string | undefined): ResultLabel {
  if (card.tier === 'C' || card.tier === 'tool' || !card.script || card.inputsStatus === 'none') return 'evidence-only'
  // On the record kept on this computer, a row matched by its printed name has passed the unit and range checks
  // like a coded one: Chinese reports rarely print LOINC, and the name is the report's own.
  const backed = used.length > 0 && used.every((item) => item.backing !== 'name' || recordIsLocal())
  const proposed: ResultLabel = card.inputsStatus === 'verified' && backed ? 'verified' : 'unverified-binding'
  return applyVersionPin(version, pinned ?? '', proposed).label ?? proposed
}

function blockReason(card: SkillCard, ok: boolean, issues: readonly BindingIssue[], label: ResultLabel): string | null {
  if (card.tier === 'C') return 'evidence-only'
  if (!card.script) return 'no_script'
  if (!ok) {
    const first = issues[0]
    if (!first) return 'invalid'
    return `${first.kind}:${first.input}`
  }
  if (label === 'evidence-only') return 'evidence-only'
  return null
}

function profileInput(spec: InputSpec, profile: BindingProfile): BindingInput | null {
  if (spec.key === 'age' && profile.age != null) {
    return { source_row_id: 'profile:age', value: profile.age, unit: '岁', provenance: 'profile', quote: `实足年龄 ${profile.age}` }
  }
  if (spec.key === 'sex' && (profile.sex === 'male' || profile.sex === 'female')) {
    return { source_row_id: 'profile:sex', value: profile.sex, unit: '', provenance: 'profile', quote: profile.sex === 'male' ? '男' : '女' }
  }
  if (spec.key === 'waist_cm' && profile.waist_cm != null) {
    return { source_row_id: 'profile:waist_cm', value: profile.waist_cm, unit: 'cm', provenance: 'profile', quote: '腰围' }
  }
  const riskKey = spec.key === 'treated' ? 'bp_treated' : spec.key
  const risk = profile.risk?.[riskKey]
  if (typeof risk === 'boolean' && (spec.from === 'argument' || MEN_REQUIRED.has(spec.key) || spec.key === 'treated' || spec.key === 'smoker' || spec.key === 'diabetes' || spec.key === 'north')) {
    return { source_row_id: `profile:${spec.key}`, value: risk ? 'yes' : 'no', unit: '', provenance: 'profile', quote: `${spec.label_zh} ${risk ? '是' : '否'}` }
  }
  return null
}

function outputInput(spec: InputSpec, outputs: Record<string, BindingOutput>): BindingInput | null {
  for (const key of spec.output_of ?? []) {
    const item = outputs[key]
    if (!item || item.value == null) continue
    const skill = item.skill ?? ''
    if (specKind(spec) === 'blood_clock' && /methyl|dnam|grimage|horvath/i.test(skill)) continue
    const provenance: ProvenanceKind = specKind(spec) === 'blood_clock' ? 'blood_clock' : 'output_of'
    return {
      source_row_id: `output:${skill || 'skill'}:${key}`,
      value: item.value,
      unit: item.unit || spec.unit || '',
      provenance: specKind(spec) === 'blood_clock' ? 'blood_clock' : provenance,
      quote: specKind(spec) === 'blood_clock' ? `血检表型年龄 ${item.value}` : `${spec.label_zh} ${item.value}`,
    }
  }
  return null
}

function rowInput(card: SkillCard, spec: InputSpec, view: RecordView): BindingInput | null {
  const row = candidatesFor(withDevices(card, spec), view.indicators ?? [])
    .map((item) => item.row as BindingRow)
    .find((item) => !rowContradicts(spec, item, card.name) && parseNumber(item.value) != null)
  if (!row) return null
  const kind = rowKind(row)
  const provenance: ProvenanceKind = kind === 'any'
    ? (specKind(spec) === 'any' ? 'routine_lab' : (specKind(spec) === 'probe' ? 'methylation_clock' : specKind(spec) as ProvenanceKind))
    : kind
  return {
    source_row_id: row.loinc || row.code || row.name,
    value: parseNumber(row.value) ?? row.value,
    unit: row.unit,
    provenance,
    quote: `${row.name} ${row.value} ${row.unit}`.trim(),
  }
}

/** A proposal the record itself supports. Incompatible rows (methylation PhenoAge, bare Agatston) are left out. */
export function proposeFromRecord(card: SkillCard, view: RecordView): BindingProposal {
  const inputs: Record<string, BindingInput> = {}
  const profile = view.profile
  const claimedOutputs = new Set<string>()
  for (const spec of card.inputs) {
    const fromProfile = profile ? profileInput(spec, profile) : null
    if (fromProfile && (spec.from === 'profile' || spec.from === 'argument' || spec.key === 'waist_cm')) {
      inputs[spec.key] = fromProfile
      continue
    }
    const outputKey = spec.output_of?.[0] ?? ''
    const fromOutput = outputKey && claimedOutputs.has(outputKey) ? null : outputInput(spec, view.outputs ?? {})
    if (fromOutput) {
      if (outputKey) claimedOutputs.add(outputKey)
      inputs[spec.key] = fromOutput
      continue
    }
    const stored = storeBinding(spec)
    if (stored) {
      inputs[spec.key] = stored
      continue
    }
    const fromRow = rowInput(card, spec, view)
    if (fromRow) inputs[spec.key] = fromRow
  }
  return { skill: card.name, inputs }
}

export function bindRecord(card: SkillCard, view: RecordView): BindingReport {
  return assessBinding(proposeFromRecord(card, view), view)
}

export function assessBinding(proposal: BindingProposal, view: RecordView | null = currentBindingView()): BindingReport {
  const home = view?.home || libraryHome()
  const catalog = loadCatalog(home)
  const empty = (issues: BindingIssue[], reason: string): BindingReport => ({
    ok: false,
    issues,
    label: 'evidence-only',
    measurements: [],
    args: [],
    inputs_used: [],
    limits_zh: '没有可核对的结果。',
    catalog_version: catalog.version,
    blockReason: reason,
  })
  if (catalog.error && catalog.cards.length === 0) return empty([{ input: proposal.skill, kind: 'missing', detail: catalog.error }], 'no_catalog')
  const card = catalog.cards.find((item) => item.name === proposal.skill)
  if (!card) return empty([{ input: proposal.skill, kind: 'missing', detail: `没有这个方法：${proposal.skill}` }], 'unknown_skill')

  const issues: BindingIssue[] = []
  const accepted = new Map<string, Accepted>()
  const profile = view?.profile
  const sex = profile?.sex ?? 'unknown'

  for (const [rawKey, input] of Object.entries(proposal.inputs ?? {})) {
    if (!input || typeof input !== 'object') {
      issues.push({ input: rawKey, kind: 'missing', detail: '这一项没有值。' })
      continue
    }
    const spec = findSpec(card, rawKey)
    if (!spec) {
      const coronary = card.name === ABDOMINAL_CT_SKILL && (isCoronaryName(rawKey) || isCoronaryName(input.quote ?? '') || input.provenance === 'coronary_ct' || isCoronaryName(input.source_row_id ?? ''))
      issues.push({
        input: rawKey,
        kind: 'provenance',
        detail: coronary ? '冠脉 Agatston 不是腹主动脉钙化。' : `${rawKey} 不是这个方法的输入。`,
      })
      continue
    }
    if (accepted.has(spec.key)) {
      issues.push({ input: spec.key, kind: 'provenance', detail: `${spec.label_zh} 出现了两次。` })
      continue
    }
    const problem = contradiction(spec, input, rawKey, card.name)
    if (problem) {
      issues.push({ input: spec.key, kind: 'provenance', detail: problem })
      continue
    }
    const filled = acceptOne(card, spec, input, view, sex)
    if ('skip' in filled) continue
    if ('issue' in filled) {
      issues.push(filled.issue)
      continue
    }
    accepted.set(spec.key, filled.accepted)
  }

  if (profile) {
    for (const spec of card.inputs) {
      if (accepted.has(spec.key)) continue
      const synthesized = profileInput(spec, profile)
      if (!synthesized) continue
      if (spec.from !== 'profile' && spec.from !== 'argument' && spec.key !== 'waist_cm' && spec.key !== 'age') continue
      const filled = acceptOne(card, spec, synthesized, view, sex)
      if ('issue' in filled || 'skip' in filled) continue
      accepted.set(spec.key, filled.accepted)
    }
  }
  for (const spec of card.inputs) {
    if (accepted.has(spec.key)) continue
    const synthesized = storeBinding(spec)
    if (!synthesized) continue
    const filled = acceptOne(card, spec, synthesized, view, sex)
    if ('issue' in filled || 'skip' in filled) continue
    accepted.set(spec.key, filled.accepted)
  }

  for (const spec of card.inputs) {
    if (!requiredNow(spec, sex) || accepted.has(spec.key)) continue
    if (issues.some((issue) => issue.input === spec.key)) continue
    issues.push({ input: spec.key, kind: 'missing', detail: `缺少${spec.label_zh}。` })
  }

  const blocking = new Set(card.inputs.filter((spec) => requiredNow(spec, sex)).map((spec) => spec.key))
  const coronaryBlock = card.name === ABDOMINAL_CT_SKILL && issues.some((issue) => issue.kind === 'provenance' && (issue.detail ?? '').includes('Agatston'))
  const failedRequired = issues.some((issue) => blocking.has(issue.input)) || coronaryBlock
  const ok = !failedRequired
  const used = [...accepted.values()]
  const proposedLabel = labelFor(card, used, catalog.version, view?.pinnedVersion)
  // A required failure is not a verified result, even when the rows that did bind were code-backed.
  const label = ok || proposedLabel !== 'verified' ? proposedLabel : 'unverified-binding'
  const keptIssues = ok ? issues.filter((issue) => !blocking.has(issue.input) || issue.kind !== 'missing') : issues
  return {
    ok,
    issues: keptIssues,
    label,
    measurements: used.flatMap((item) => (item.measurement ? [item.measurement] : [])),
    args: used.flatMap((item) => (item.arg ? item.arg.split(' ') : [])),
    inputs_used: used.map((item) => ({
      input: item.spec.key,
      source_row_id: item.input.source_row_id,
      value: item.input.value,
      unit: item.input.unit,
      provenance: item.input.provenance,
      quote: item.input.quote,
    })),
    limits_zh: limitsFor(card, label),
    catalog_version: catalog.version,
    blockReason: blockReason(card, ok, keptIssues, label),
  }
}

function acceptOne(
  card: SkillCard,
  spec: InputSpec,
  input: BindingInput,
  view: RecordView | null,
  sex: string,
): { accepted: Accepted } | { issue: BindingIssue } | { skip: true } {
  if (MEN_REQUIRED.has(spec.key) && sex !== 'male') return { skip: true }
  if (spec.from === 'profile' || spec.from === 'argument') return acceptProfile(spec, input, view)
  if (spec.key === 'waist_cm' && input.provenance === 'profile') return acceptWaist(card, spec, input, view)
  return acceptMeasurement(card, spec, input, view)
}

function acceptWaist(card: SkillCard, spec: InputSpec, input: BindingInput, view: RecordView | null): { accepted: Accepted } | { issue: BindingIssue } {
  const number = parseNumber(input.value)
  if (number == null) return { issue: { input: spec.key, kind: 'range', detail: `${spec.label_zh} 不是一个数。` } }
  if (view?.profile?.waist_cm != null && !close(number, view.profile.waist_cm)) {
    return { issue: { input: spec.key, kind: 'provenance', detail: '腰围和档案里保存的不一样。' } }
  }
  const staged = stageMeasurements(card, [{ key: spec.key, value: number, unit: input.unit || 'cm' }])
  const problem = staged.problems.find((item) => item.key === spec.key && item.kind !== 'missing')
  if (problem) return { issue: { input: spec.key, kind: problem.kind === 'range' ? 'range' : 'unit', detail: problem.message_zh } }
  return {
    accepted: {
      spec,
      input,
      measurement: { key: spec.key, value: number, unit: input.unit || 'cm' },
      backing: view?.profile?.waist_cm != null ? 'profile' : 'name',
    },
  }
}

function acceptProfile(spec: InputSpec, input: BindingInput, view: RecordView | null): { accepted: Accepted } | { issue: BindingIssue } {
  if (spec.key === 'age') {
    const number = parseNumber(input.value)
    if (number == null) return { issue: { input: spec.key, kind: 'range', detail: '实足年龄不是一个数。' } }
    if (view?.profile?.age != null && !close(number, view.profile.age)) {
      return { issue: { input: spec.key, kind: 'provenance', detail: '年龄和档案里保存的不一样。' } }
    }
    if (spec.range && (number < spec.range[0] || number > spec.range[1])) {
      return { issue: { input: spec.key, kind: 'range', detail: `${spec.label_zh}不在 ${spec.range[0]}–${spec.range[1]}。` } }
    }
    const flag = spec.flag ? `${spec.flag} ${number}` : ''
    return { accepted: { spec, input, ...(flag ? { arg: flag } : {}), backing: 'profile' } }
  }
  if (spec.key === 'sex') {
    const word = sexWord(input.value)
    if (!word) return { issue: { input: spec.key, kind: 'provenance', detail: '性别要是男或女。' } }
    if (view?.profile && (view.profile.sex === 'male' || view.profile.sex === 'female') && word !== view.profile.sex) {
      return { issue: { input: spec.key, kind: 'provenance', detail: '性别和档案里保存的不一样。' } }
    }
    const flag = spec.flag ? `${spec.flag} ${word}` : ''
    return { accepted: { spec, input, ...(flag ? { arg: flag } : {}), backing: 'profile' } }
  }
  const answer = yesNo(input.value)
  if (answer == null) return { issue: { input: spec.key, kind: 'provenance', detail: `${spec.label_zh}要是或否。` } }
  const riskKey = spec.key === 'treated' ? 'bp_treated' : spec.key
  const saved = view?.profile?.risk?.[riskKey]
  if (typeof saved === 'boolean' && (saved ? 'yes' : 'no') !== answer) {
    return { issue: { input: spec.key, kind: 'provenance', detail: `${spec.label_zh}和档案里保存的不一样。` } }
  }
  const flag = spec.flag ? `${spec.flag} ${answer}` : ''
  return { accepted: { spec, input, ...(flag ? { arg: flag } : {}), backing: 'profile' } }
}

function acceptMeasurement(card: SkillCard, spec: InputSpec, input: BindingInput, view: RecordView | null): { accepted: Accepted } | { issue: BindingIssue } {
  const number = parseNumber(input.value)
  if (number == null && spec.from !== 'argument') {
    return { issue: { input: spec.key, kind: 'unit', detail: `${spec.label_zh} 的值「${String(input.value)}」不是一个可以计算的数。` } }
  }
  const staged = stageMeasurements(card, [{ key: spec.key, value: input.value, unit: input.unit ?? '' }])
  const problem = staged.problems.find((item) => item.key === spec.key && item.kind !== 'missing')
  if (problem) {
    const kind: BindingIssue['kind'] = problem.kind === 'range' ? 'range' : problem.kind === 'missing' ? 'missing' : 'unit'
    return { issue: { input: spec.key, kind, detail: problem.message_zh } }
  }
  let backing = backingOf(card, spec, input, null)
  if (view) {
    if (input.provenance === 'output_of' || input.source_row_id.startsWith('output:')) {
      const key = (spec.output_of ?? []).find((item) => input.source_row_id.endsWith(`:${item}`) || input.source_row_id.endsWith(item))
      const output = key ? view.outputs?.[key] : undefined
      const outputNumber = output ? parseNumber(output.value) : null
      if (outputNumber == null || !close(number ?? NaN, outputNumber)) {
        return { issue: { input: spec.key, kind: 'provenance', detail: `${spec.label_zh}和已经算过的读出对不上。` } }
      }
      backing = 'output'
    } else if (input.source_row_id.startsWith('store:')) {
      const stored = numberFromStore(input.source_row_id, spec.key)
      if (stored == null || !close(number ?? NaN, stored)) {
        return { issue: { input: spec.key, kind: 'provenance', detail: `${spec.label_zh}不在已保存的数据里。` } }
      }
      backing = 'store'
    } else if (input.provenance !== 'profile' && view.indicators) {
      const row = witnessRow(card, spec, input, view)
      if (!row) return { issue: { input: spec.key, kind: 'provenance', detail: `记录里没有对得上的${spec.label_zh}。` } }
      backing = backingOf(card, spec, input, row)
    }
  }
  return {
    accepted: {
      spec,
      input,
      measurement: { key: spec.key, value: input.value, unit: input.unit ?? '' },
      backing,
    },
  }
}

const receipts = new Map<string, BindingProposal>()
let receiptSeq = 0

export function saveReceipt(proposal: BindingProposal): string {
  const id = `b${Date.now().toString(36)}${(receiptSeq += 1).toString(36)}`
  receipts.set(id, proposal)
  while (receipts.size > 40) {
    const oldest = receipts.keys().next().value
    if (!oldest) break
    receipts.delete(oldest)
  }
  return id
}

export function lookupReceipt(id: string): BindingProposal | null {
  return receipts.get(id) ?? null
}

/** Hook surface: unit, range, provenance. Optional failures stay in issues and leave ok true. */
export function validateBindingProposal(proposal: BindingProposal): BindingValidation {
  const report = assessBinding(proposal, currentBindingView())
  return { ok: report.ok, issues: report.issues }
}

export function methodFromReport(skill: string, report: BindingReport, outputs: Record<string, OutputValue> | undefined, limits?: string): MethodResult {
  const rows = Object.entries(outputs ?? {}).map(([key, item]) => ({
    key,
    value: item?.value ?? null,
    unit: item?.unit ?? '',
  }))
  return {
    skill,
    label: report.label,
    outputs: report.label === 'evidence-only' ? [] : rows,
    inputs_used: report.inputs_used,
    catalog_version: report.catalog_version,
    ran_at: new Date().toISOString(),
    limits_zh: limits || report.limits_zh,
  }
}
