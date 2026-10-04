// Validate again at the write. A batch with no valid row does not erase what is already stored.
// Rows from the same source file are replaced. A damaged file is not overwritten.

import type { ConditionRow, MethylationRow, ProteinRow, StoreKind, StoreRows, TaxaRow } from '../contracts/library.ts'
import { validateCondition } from './conditions.ts'
import { DamagedStoreError, readStoreDocument, storeIsOn, writeStoreDocument } from './disk.ts'
import { countReasons, sourceName } from './limits.ts'
import { validateMethylation } from './methylation.ts'
import { validateProtein } from './proteins.ts'
import { validateTaxa } from './taxa.ts'
import type { StoreReject, StoreSummary } from './summary.ts'

function keep(kind: StoreKind, raw: unknown): StoreRows[StoreKind] | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (kind === 'methylation') {
    const verdict = validateMethylation({
      probe_id: String(row.probe_id ?? ''),
      beta: row.beta,
      sample_date: String(row.sample_date ?? ''),
      source_file: String(row.source_file ?? ''),
    })
    return verdict.ok ? verdict.row : null
  }
  if (kind === 'taxa') {
    const verdict = validateTaxa({
      name: String(row.genus ?? ''),
      abundance: row.relative_abundance,
      site: String(row.site ?? ''),
      sample_date: String(row.sample_date ?? ''),
      source_file: String(row.source_file ?? ''),
    })
    return verdict.ok ? verdict.row : null
  }
  if (kind === 'proteins') {
    const verdict = validateProtein({
      id: String(row.id ?? ''),
      symbol: String(row.symbol ?? ''),
      value: row.value,
      unit_or_z: String(row.unit_or_z ?? ''),
      panel: String(row.panel ?? ''),
      sample_date: String(row.sample_date ?? ''),
      source_file: String(row.source_file ?? ''),
    })
    return verdict.ok ? verdict.row : null
  }
  const verdict = validateCondition({
    code: String(row.code ?? ''),
    display: String(row.display ?? ''),
    onset: row.onset,
    system: String(row.system ?? ''),
    source_file: String(row.source ?? ''),
  })
  return verdict.ok ? verdict.row : null
}

function rowKey(kind: StoreKind, row: StoreRows[StoreKind]): string {
  if (kind === 'methylation') {
    const item = row as MethylationRow
    return `${item.sample_date}|${item.probe_id}`
  }
  if (kind === 'taxa') {
    const item = row as TaxaRow
    return `${item.sample_date}|${item.site}|${item.genus}`
  }
  if (kind === 'proteins') {
    const item = row as ProteinRow
    return `${item.sample_date}|${item.panel}|${item.id}`
  }
  return (row as ConditionRow).code
}

function rowSource(kind: StoreKind, row: StoreRows[StoreKind]): string {
  if (kind === 'conditions') return (row as ConditionRow).source
  return (row as MethylationRow).source_file
}

function sameValue(kind: StoreKind, left: StoreRows[StoreKind], right: StoreRows[StoreKind]): boolean {
  if (kind === 'methylation') return (left as MethylationRow).beta === (right as MethylationRow).beta
  if (kind === 'taxa') return (left as TaxaRow).relative_abundance === (right as TaxaRow).relative_abundance
  if (kind === 'proteins') return (left as ProteinRow).value === (right as ProteinRow).value
  const a = left as ConditionRow
  const b = right as ConditionRow
  return a.display === b.display && a.onset === b.onset
}

function dedupe(kind: StoreKind, rows: StoreRows[StoreKind][], rejected: StoreReject[]): StoreRows[StoreKind][] {
  const seen = new Map<string, StoreRows[StoreKind]>()
  const out: StoreRows[StoreKind][] = []
  for (const row of rows) {
    const key = rowKey(kind, row)
    const prior = seen.get(key)
    if (!prior) {
      seen.set(key, row)
      out.push(row)
      continue
    }
    if (!sameValue(kind, prior, row)) rejected.push({ kind, field: key, reason: 'duplicate' })
  }
  return out
}

function emptySummary(kind: StoreKind, rejected: StoreReject[], on: boolean, coverage: string, error?: string): StoreSummary {
  return { ok: false, kind, stored: 0, rejected: rejected.length, on, created: false, coverage_zh: coverage, reasons: countReasons(rejected), ...(error ? { error } : {}) }
}

export function commitRows(
  dataDir: string,
  kind: StoreKind,
  incoming: StoreRows[StoreKind][],
  filename: string,
  rejectedIn: StoreReject[],
  coverage: (rows: StoreRows[StoreKind][]) => string,
): StoreSummary {
  const rejected = rejectedIn.filter((row) => row.kind === kind)
  let existing: { on: boolean; rows: unknown[] }
  try {
    existing = readStoreDocument(dataDir, kind)
  } catch (error) {
    const message = error instanceof DamagedStoreError ? error.message : `${kind} store is damaged`
    return emptySummary(kind, rejected, storeIsOn(dataDir, kind), '', message)
  }
  const priorAll = existing.rows.map((row) => keep(kind, row)).filter((row): row is StoreRows[StoreKind] => row !== null)
  const fresh = dedupe(kind, incoming, rejected)
  if (fresh.length === 0) return emptySummary(kind, rejected, existing.on, coverage(priorAll))
  const source = rowSource(kind, fresh[0] as StoreRows[StoreKind]) || sourceName(filename) || filename
  const prior = priorAll.filter((row) => rowSource(kind, row) !== source)
  let accepted = fresh
  if (kind === 'conditions') {
    const taken = new Set(prior.map((row) => (row as ConditionRow).code))
    accepted = []
    for (const row of fresh) {
      const code = (row as ConditionRow).code
      if (taken.has(code)) rejected.push({ kind, field: code, reason: 'duplicate' })
      else {
        taken.add(code)
        accepted.push(row)
      }
    }
  }
  if (accepted.length === 0) return emptySummary(kind, rejected, existing.on, coverage(priorAll))
  const next = [...prior, ...accepted]
  writeStoreDocument(dataDir, kind, next)
  return {
    ok: true,
    kind,
    stored: accepted.length,
    rejected: rejected.length,
    on: true,
    created: !existing.on,
    coverage_zh: coverage(next),
    reasons: countReasons(rejected),
  }
}

export function keptRows<K extends StoreKind>(dataDir: string, kind: K): StoreRows[K][] {
  const doc = readStoreDocument(dataDir, kind)
  return doc.rows.map((row) => keep(kind, row)).filter((row): row is StoreRows[K] => row !== null)
}
