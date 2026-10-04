// Shared types for LongPi 0.6.0 library-first. Lanes implement these.
// The plugin does not select, rank, hide, or gate a method. It checks a
// binding and labels the result. Bodies throw until a lane registers.

import type { IsoTime } from './common.ts'

export interface SkillIndexEntry {
  name: string
  blurb: string
  tier: string
  species: string
  whenToUse: string
  /** Directory of the skill. Full SKILL.md loads only when the model opens it. */
  locator: string
}

export type ResultLabel = 'verified' | 'unverified-binding' | 'evidence-only'

/** What kind of row an input accepts. Alias text is not a kind. */
export type ProvenanceKind =
  | 'blood_clock'
  | 'methylation_clock'
  | 'abdominal_ct'
  | 'coronary_ct'
  | 'routine_lab'
  | 'wearable'
  | 'questionnaire'
  | 'profile'
  | 'output_of'

export interface BindingInput {
  source_row_id: string
  value: number | string
  unit: string
  provenance: ProvenanceKind
  /** The row text the model pointed at, unchanged. */
  quote: string
}

export interface BindingProposal {
  skill: string
  /** Manifest input key → the row the model named. The model does not convert units. */
  inputs: Record<string, BindingInput>
}

export type BindingIssueKind = 'unit' | 'range' | 'provenance' | 'missing'

export interface BindingIssue {
  input: string
  kind: BindingIssueKind
  detail?: string
}

/**
 * ok is false when a required input failed. A dropped optional is an issue
 * and leaves ok true.
 */
export interface BindingValidation {
  ok: boolean
  issues: BindingIssue[]
}

export interface MethodOutput {
  key: string
  value: number | string | null
  unit: string
}

export interface MethodInputUsed {
  input: string
  source_row_id: string
  value: number | string
  unit: string
  provenance: ProvenanceKind
  quote: string
}

export interface MethodResult {
  skill: string
  label: ResultLabel
  outputs: MethodOutput[]
  inputs_used: MethodInputUsed[]
  catalog_version: string
  ran_at: IsoTime
  limits_zh: string
  /** Chinese name for the card. Absent on older rows. */
  title_zh?: string
}

export type StoreKind = 'methylation' | 'taxa' | 'proteins' | 'conditions'

export interface MethylationRow {
  sample_date: string
  probe_id: string
  beta: number
  source_file: string
}

export interface TaxaRow {
  sample_date: string
  site: 'gut' | 'oral'
  genus: string
  relative_abundance: number
  source_file: string
}

export interface ProteinRow {
  sample_date: string
  panel: string
  id: string
  symbol: string
  value: number
  unit_or_z: string
  source_file: string
}

export interface ConditionRow {
  code: string
  system: 'ICD-10'
  display: string
  onset: string | null
  source: string
}

export interface StoreRows {
  methylation: MethylationRow
  taxa: TaxaRow
  proteins: ProteinRow
  conditions: ConditionRow
}

export interface LibraryHooks {
  /** L2. Every catalog entry. Does not drop a tier or a name. */
  listSkillIndex?: () => SkillIndexEntry[]
  /** L2. Unit, range, and provenance only. */
  validateBinding?: (proposal: BindingProposal) => BindingValidation
  /** L3. */
  readStore?: (kind: StoreKind) => StoreRows[StoreKind][]
  /** L4. Labeled results for this generation. */
  methodResults?: () => MethodResult[]
}

const NOT_IMPLEMENTED = 'not implemented in C1'
const hooks: LibraryHooks = {}
const mounts: Array<(ctx: unknown) => void> = []

function notImplemented(): never {
  throw new Error(NOT_IMPLEMENTED)
}

/** A lane registers the functions it owns. Other lanes' hooks stay. */
export function registerLibraryHooks(next: LibraryHooks): () => void {
  const prevList = hooks.listSkillIndex
  const prevValidate = hooks.validateBinding
  const prevRead = hooks.readStore
  const prevResults = hooks.methodResults
  if (next.listSkillIndex) hooks.listSkillIndex = next.listSkillIndex
  if (next.validateBinding) hooks.validateBinding = next.validateBinding
  if (next.readStore) hooks.readStore = next.readStore
  if (next.methodResults) hooks.methodResults = next.methodResults
  return () => {
    if (next.listSkillIndex) hooks.listSkillIndex = prevList
    if (next.validateBinding) hooks.validateBinding = prevValidate
    if (next.readStore) hooks.readStore = prevRead
    if (next.methodResults) hooks.methodResults = prevResults
  }
}

/** Called from the lane module with the host context, once apply() runs. */
export function registerLibraryMount(mount: (ctx: unknown) => void): () => void {
  mounts.push(mount)
  return () => {
    const at = mounts.indexOf(mount)
    if (at >= 0) mounts.splice(at, 1)
  }
}

export function mountLibraryLanes(ctx: unknown): void {
  for (const mount of [...mounts]) mount(ctx)
}

export function listSkillIndex(): SkillIndexEntry[] {
  if (!hooks.listSkillIndex) notImplemented()
  return hooks.listSkillIndex()
}

export function validateBinding(proposal: BindingProposal): BindingValidation {
  if (!hooks.validateBinding) notImplemented()
  return hooks.validateBinding(proposal)
}

export function readStore<K extends StoreKind>(kind: K): StoreRows[K][] {
  if (!hooks.readStore) notImplemented()
  return hooks.readStore(kind) as StoreRows[K][]
}

export function methodResults(): MethodResult[] {
  if (!hooks.methodResults) notImplemented()
  return hooks.methodResults()
}

/** What the fact pack stores. Empty until L4 registers methodResults. */
export function registeredMethodResults(): MethodResult[] {
  return hooks.methodResults ? hooks.methodResults() : []
}
