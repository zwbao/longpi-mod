// A CSV of only the keys a manifest names. The 256KB cap is the runner's model-file cap.
// The store itself may be larger. This writer does not raise that cap.

import { mkdirSync, writeFileSync } from '../../sys/fs.ts'
import { dirname } from '../../sys/path.ts'
import type { ConditionRow, MethylationRow, ProteinRow, StoreKind, StoreRows, TaxaRow } from '../contracts/library.ts'
import { conditionMatches } from './conditions.ts'
import { keptRows } from './commit.ts'
import { DamagedStoreError } from './disk.ts'
import { MODEL_FILE_CAP } from './limits.ts'
import { probeId } from './methylation.ts'
import { csvCell, formatNum } from './split.ts'
import { genusName } from './taxa.ts'

export interface NarrowOpts {
  kind: StoreKind
  keys: string[]
  sample_date?: string
  site?: 'gut' | 'oral'
  panel?: string
  /** When set, the CSV is written only if it fits the model-file cap. */
  outPath?: string
}

export interface NarrowCsv {
  ok: boolean
  text: string
  bytes: number
  rows: number
  missing: string[]
  conflicts: string[]
  error?: string
}

function empty(error: string): NarrowCsv {
  return { ok: false, text: '', bytes: 0, rows: 0, missing: [], conflicts: [], error }
}

export function writeNarrowCsv(dataDir: string, opts: NarrowOpts): NarrowCsv {
  let rows: StoreRows[StoreKind][]
  try {
    rows = keptRows(dataDir, opts.kind)
  } catch (error) {
    return empty(error instanceof DamagedStoreError ? error.message : `${opts.kind} store is damaged`)
  }
  const filtered = rows.filter((row) => rowInScope(opts.kind, row, opts))
  const keys = [...new Set(opts.keys.map((key) => key.trim()).filter(Boolean))]
  const missing: string[] = []
  const conflicts: string[] = []
  const lines = ['marker,value,unit']
  for (const key of keys) {
    const hits = filtered.filter((row) => rowMatches(opts.kind, row, key))
    if (hits.length === 0) {
      missing.push(key)
      continue
    }
    const latest = hits.map((row) => rowDate(opts.kind, row)).sort().at(-1) ?? ''
    const at = hits.filter((row) => rowDate(opts.kind, row) === latest)
    const values = [...new Set(at.map((row) => rowValue(opts.kind, row)))]
    if (values.length !== 1) {
      conflicts.push(key)
      continue
    }
    const marker = rowMarker(opts.kind, at[0] as StoreRows[StoreKind], key)
    const unit = rowUnit(opts.kind, at[0] as StoreRows[StoreKind])
    lines.push([csvCell(marker), formatNum(values[0] ?? 0), csvCell(unit)].join(','))
  }
  const text = `${lines.join('\n')}\n`
  if (text.length > MODEL_FILE_CAP) {
    return { ok: false, text: '', bytes: text.length, rows: lines.length - 1, missing, conflicts, error: 'narrow csv is larger than 256KB' }
  }
  if (opts.outPath) {
    mkdirSync(dirname(opts.outPath), { recursive: true, mode: 0o700 })
    writeFileSync(opts.outPath, text, { mode: 0o600 })
  }
  return { ok: true, text, bytes: text.length, rows: lines.length - 1, missing, conflicts }
}

function rowInScope(kind: StoreKind, row: StoreRows[StoreKind], opts: NarrowOpts): boolean {
  if (opts.sample_date && kind !== 'conditions' && rowDate(kind, row) !== opts.sample_date) return false
  if (kind === 'taxa' && opts.site && (row as TaxaRow).site !== opts.site) return false
  if (kind === 'proteins' && opts.panel && (row as ProteinRow).panel !== opts.panel) return false
  return true
}

function rowDate(kind: StoreKind, row: StoreRows[StoreKind]): string {
  if (kind === 'conditions') return (row as ConditionRow).onset ?? ''
  return (row as MethylationRow).sample_date
}

function rowMatches(kind: StoreKind, row: StoreRows[StoreKind], key: string): boolean {
  if (kind === 'methylation') return (row as MethylationRow).probe_id === (probeId(key) ?? key.trim().toLowerCase())
  if (kind === 'taxa') {
    const genus = genusName(key) ?? key.trim()
    return (row as TaxaRow).genus.toLowerCase() === genus.toLowerCase()
  }
  if (kind === 'proteins') {
    const item = row as ProteinRow
    const folded = key.trim().toLowerCase()
    return item.id.toLowerCase() === folded || item.symbol.toLowerCase() === folded
  }
  return conditionMatches((row as ConditionRow).code, key)
}

function rowValue(kind: StoreKind, row: StoreRows[StoreKind]): number {
  if (kind === 'methylation') return (row as MethylationRow).beta
  if (kind === 'taxa') return (row as TaxaRow).relative_abundance
  if (kind === 'proteins') return (row as ProteinRow).value
  return 1
}

function rowUnit(kind: StoreKind, row: StoreRows[StoreKind]): string {
  if (kind === 'methylation' || kind === 'taxa') return '1'
  if (kind === 'proteins') return (row as ProteinRow).unit_or_z
  return 'score'
}

function rowMarker(kind: StoreKind, row: StoreRows[StoreKind], key: string): string {
  if (kind === 'methylation') return (row as MethylationRow).probe_id
  if (kind === 'taxa') return (row as TaxaRow).genus
  if (kind === 'proteins') return (row as ProteinRow).symbol || (row as ProteinRow).id
  return (row as ConditionRow).code || key
}
