import { Buffer } from '../../sys/buffer.ts'
// Turn a consumer report or a matrix into typed drafts. This does not write the store.

import type { ConditionRow, MethylationRow, ProteinRow, StoreKind, TaxaRow } from '../contracts/library.ts'
import { conditionCoverage, validateCondition } from './conditions.ts'
import { IMPORT_CAP_BYTES, IMPORT_CAP_ROWS, isoDate, STORE_KINDS } from './limits.ts'
import { methylationCoverage, probeId, validateMethylation } from './methylation.ts'
import { proteinCoverage, validateProtein } from './proteins.ts'
import { cell, looksLikeHeader, tableOf } from './split.ts'
import type { StoreReject } from './summary.ts'
import { genusName, siteOf, taxaCoverage, validateTaxa } from './taxa.ts'

export interface ParsedStores {
  methylation: MethylationRow[]
  taxa: TaxaRow[]
  proteins: ProteinRow[]
  conditions: ConditionRow[]
  rejected: StoreReject[]
  detected: StoreKind[]
  capped: boolean
}

export interface ParseOpts {
  type?: StoreKind
  filename: string
  sample_date?: string
  site?: 'gut' | 'oral'
  panel?: string
}

const PROTEIN_MAPS = new Set(['protein_z', 'protein_z_complete_models', 'protein_z_brain_partial', 'ionocyte_aptamers_z', 'proteins'])
const IGNORE_MAPS = new Set([
  'organ_z', 'organ_predicted_age', 'metabolites', 'amino_umol_l', 'metbag_predicted_age',
  'required_but_absent', 'method_inputs_not_on_consumer_page', 'consumer_does_not_include',
  'weights_present', 'svm_weights_present', 'fi', 'gap_zh', 'platform',
])

export function emptyParsed(): ParsedStores {
  return { methylation: [], taxa: [], proteins: [], conditions: [], rejected: [], detected: [], capped: false }
}

export function coverageOf(kind: StoreKind, rows: ParsedStores[StoreKind]): string {
  if (kind === 'methylation') return methylationCoverage(rows as MethylationRow[])
  if (kind === 'taxa') return taxaCoverage(rows as TaxaRow[])
  if (kind === 'proteins') return proteinCoverage(rows as ProteinRow[])
  return conditionCoverage(rows as ConditionRow[])
}

export function parseReport(text: string, opts: ParseOpts): ParsedStores {
  const parsed = emptyParsed()
  if (Buffer.byteLength(text) > IMPORT_CAP_BYTES) {
    parsed.capped = true
    if (opts.type) parsed.rejected.push({ kind: opts.type, field: 'file', reason: 'cap' })
    parsed.detected = detectedOf(parsed, opts.type)
    return parsed
  }
  const fallbackDate = opts.sample_date || firstDate(text) || ''
  const fallbackSite = opts.site ?? siteFromText(text)
  const trimmed = text.replace(/^\uFEFF/, '').trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      absorbJson(JSON.parse(trimmed) as unknown, parsed, { ...opts, sample_date: fallbackDate, site: fallbackSite })
      parsed.detected = detectedOf(parsed, opts.type)
      return parsed
    } catch {
      // not JSON; try a table
    }
  }
  const table = tableOf(text)
  if (table && table.length > IMPORT_CAP_ROWS) {
    parsed.capped = true
    if (opts.type) parsed.rejected.push({ kind: opts.type, field: 'file', reason: 'cap' })
    parsed.detected = detectedOf(parsed, opts.type)
    return parsed
  }
  if (table && (looksLikeHeader(table[0] ?? []) || opts.type)) {
    absorbTable(table, parsed, { ...opts, sample_date: fallbackDate, site: fallbackSite })
    parsed.detected = detectedOf(parsed, opts.type)
    if (parsed.detected.length > 0 || opts.type) return parsed
  }
  absorbLines(text, parsed, { ...opts, sample_date: fallbackDate, site: fallbackSite })
  parsed.detected = detectedOf(parsed, opts.type)
  return parsed
}

function detectedOf(parsed: ParsedStores, explicit?: StoreKind): StoreKind[] {
  if (explicit) return [explicit]
  return STORE_KINDS.filter((kind) => parsed[kind].length > 0 || parsed.rejected.some((row) => row.kind === kind))
}

function firstDate(text: string): string {
  return isoDate(/(20\d{2}-\d{2}-\d{2})/.exec(text)?.[1] ?? '') ?? ''
}

function siteFromText(text: string): 'gut' | 'oral' | undefined {
  const gut = /肠道|粪便|16S/.test(text)
  const oral = /口腔|唾液/.test(text)
  if (gut && !oral) return 'gut'
  if (oral && !gut) return 'oral'
  return undefined
}

interface Ctx extends ParseOpts {
  sample_date?: string
  site?: 'gut' | 'oral'
  sawTaxaRaw?: boolean
}

function pushMethyl(parsed: ParsedStores, draft: { probe_id: string; beta: unknown; unit?: string; sample_date?: string; source_file: string }, fallback: string): void {
  const verdict = validateMethylation(draft, fallback)
  if (verdict.ok) parsed.methylation.push(verdict.row)
  else parsed.rejected.push({ kind: 'methylation', field: verdict.field, reason: verdict.reason })
}

function pushTaxa(parsed: ParsedStores, draft: { name: string; abundance: unknown; unit?: string; site?: string; sample_date?: string; source_file: string }, ctx: Ctx): void {
  const verdict = validateTaxa(draft, ctx.sample_date, ctx.site)
  if (verdict.ok) parsed.taxa.push(verdict.row)
  else parsed.rejected.push({ kind: 'taxa', field: verdict.field, reason: verdict.reason })
}

function pushProtein(parsed: ParsedStores, draft: { id?: string; symbol?: string; value: unknown; unit_or_z?: string; panel?: string; sample_date?: string; source_file: string }, ctx: Ctx): void {
  const verdict = validateProtein(draft, ctx.sample_date, ctx.panel)
  if (verdict.ok) parsed.proteins.push(verdict.row)
  else parsed.rejected.push({ kind: 'proteins', field: verdict.field, reason: verdict.reason })
}

function pushCondition(parsed: ParsedStores, draft: { code: string; display?: string; onset?: unknown; system?: string; source_file: string }): void {
  const verdict = validateCondition(draft)
  if (verdict.ok) parsed.conditions.push(verdict.row)
  else parsed.rejected.push({ kind: 'conditions', field: verdict.field, reason: verdict.reason })
}

function allow(ctx: Ctx, kind: StoreKind): boolean {
  return !ctx.type || ctx.type === kind
}

function numberMap(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const out: Record<string, number> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === 'number' && Number.isFinite(item)) out[key] = item
    else if (typeof item === 'string' && item.trim() && Number.isFinite(Number(item))) out[key] = Number(item)
    else return null
  }
  return out
}

function absorbJson(value: unknown, parsed: ParsedStores, ctx: Ctx): void {
  if (Array.isArray(value)) {
    if (value.length > IMPORT_CAP_ROWS) {
      parsed.capped = true
      parsed.rejected.push({ kind: ctx.type ?? 'methylation', field: 'file', reason: 'cap' })
      return
    }
    for (const item of value) absorbJson(item, parsed, ctx)
    return
  }
  if (!value || typeof value !== 'object') return
  const row = value as Record<string, unknown>
  const date = isoDate(row.date) ?? isoDate(row.sample_date) ?? ctx.sample_date
  const next: Ctx = { ...ctx, sample_date: date || ctx.sample_date }
  if (row.type === 'microbiome_gut') next.site = 'gut'
  if (row.type === 'microbiome_oral') next.site = 'oral'
  if (row.raw && typeof row.raw === 'object') absorbRaw(row.raw as Record<string, unknown>, parsed, next)
  if (Array.isArray(row.items)) {
    for (const item of row.items) absorbItem(item, parsed, next)
  }
  if (Array.isArray(row.conditions)) {
    for (const item of row.conditions) absorbCondition(item, parsed, next)
  }
  if (row.icd10 || row.icd_10 || (row.code && (row.display || row.name || row.name_zh))) absorbCondition(row, parsed, next)
  const keys = Object.keys(row)
  if (keys.length > 0 && keys.every((key) => probeId(key))) {
    if (allow(next, 'methylation')) {
      for (const [probe, beta] of Object.entries(numberMap(row) ?? {})) {
        pushMethyl(parsed, { probe_id: probe, beta, sample_date: next.sample_date, source_file: next.filename }, next.sample_date ?? '')
      }
    }
  }
}

function absorbRaw(raw: Record<string, unknown>, parsed: ParsedStores, ctx: Ctx): void {
  for (const [key, value] of Object.entries(raw)) {
    if (IGNORE_MAPS.has(key)) continue
    const map = numberMap(value)
    if (!map) continue
    if ((key === 'cpg_beta' || key === 'partial_cpg_beta') && allow(ctx, 'methylation')) {
      for (const [probe, beta] of Object.entries(map)) {
        pushMethyl(parsed, { probe_id: probe, beta, unit: '1', sample_date: ctx.sample_date, source_file: ctx.filename }, ctx.sample_date ?? '')
      }
      continue
    }
    if (key === 'cpg_percent' && allow(ctx, 'methylation')) {
      for (const [probe, beta] of Object.entries(map)) {
        pushMethyl(parsed, { probe_id: probe, beta, unit: '%', sample_date: ctx.sample_date, source_file: ctx.filename }, ctx.sample_date ?? '')
      }
      continue
    }
    if ((key === 'taxa_rel_abundance' || key === 'taxa') && allow(ctx, 'taxa')) {
      ctx.sawTaxaRaw = true
      for (const [name, abundance] of Object.entries(map)) {
        pushTaxa(parsed, { name, abundance, unit: '1', sample_date: ctx.sample_date, source_file: ctx.filename }, ctx)
      }
      continue
    }
    if (PROTEIN_MAPS.has(key) && allow(ctx, 'proteins')) {
      for (const [id, amount] of Object.entries(map)) {
        pushProtein(parsed, { id, value: amount, unit_or_z: 'z', panel: key, sample_date: ctx.sample_date, source_file: ctx.filename }, ctx)
      }
    }
  }
}

function absorbItem(value: unknown, parsed: ParsedStores, ctx: Ctx): void {
  if (!value || typeof value !== 'object') return
  const item = value as Record<string, unknown>
  const unit = String(item.unit ?? '')
  const code = String(item.code ?? '')
  const name = String(item.name_en ?? item.name_zh ?? '')
  if (/岁|生物年/.test(unit)) return
  if (allow(ctx, 'methylation') && (probeId(code) || probeId(name))) {
    pushMethyl(parsed, { probe_id: probeId(code) ? code : name, beta: item.value, unit, sample_date: ctx.sample_date, source_file: ctx.filename }, ctx.sample_date ?? '')
    return
  }
  if (allow(ctx, 'taxa') && !ctx.sawTaxaRaw && (/^[gs]__/i.test(code) || genusName(name) || genusName(code))) {
    const taxon = /^[gs]__/i.test(code) ? code : (genusName(name) ? name : code)
    pushTaxa(parsed, { name: taxon, abundance: item.value, unit, sample_date: ctx.sample_date, source_file: ctx.filename }, ctx)
    return
  }
  if (allow(ctx, 'proteins') && (code || name) && unit) {
    pushProtein(parsed, { id: code, symbol: name, value: item.value, unit_or_z: unit, panel: ctx.panel ?? 'items', sample_date: ctx.sample_date, source_file: ctx.filename }, ctx)
  }
}

function absorbCondition(value: unknown, parsed: ParsedStores, ctx: Ctx): void {
  if (!allow(ctx, 'conditions') || !value || typeof value !== 'object') return
  const row = value as Record<string, unknown>
  const code = String(row.icd10 ?? row.icd_10 ?? row.code ?? '')
  if (!code) return
  pushCondition(parsed, {
    code,
    display: String(row.display ?? row.name_zh ?? row.name ?? ''),
    onset: row.onset ?? row.since ?? null,
    system: String(row.system ?? 'ICD-10'),
    source_file: ctx.filename,
  })
}

function kindFromHeader(headers: string[], explicit?: StoreKind): StoreKind | null {
  if (explicit) return explicit
  if (cell(headers, ['probe_id', 'probe', 'cpg', 'ilmnid', 'beta']) >= 0) return 'methylation'
  if (cell(headers, ['genus', 'taxon', 'relative_abundance']) >= 0) return 'taxa'
  if (cell(headers, ['uniprot', 'accession', 'symbol', 'gene', 'aptamer', 'seqid', 'unit_or_z', 'panel']) >= 0) return 'proteins'
  if (cell(headers, ['icd10', 'icd_10']) >= 0) return 'conditions'
  if (cell(headers, ['code']) >= 0 && cell(headers, ['display', 'name', 'name_zh', 'system', 'onset']) >= 0) return 'conditions'
  return null
}

function absorbTable(table: string[][], parsed: ParsedStores, ctx: Ctx): void {
  const header = table[0] ?? []
  const headed = looksLikeHeader(header)
  const kind = kindFromHeader(headed ? header : [], ctx.type)
  const rows = headed ? table.slice(1) : table
  const resolved = kind ?? sniffKind(rows[0]?.[0] ?? '', ctx.type)
  if (!resolved) return
  if (!allow(ctx, resolved)) return
  const at = (names: string[], fallback: number) => (headed ? cell(header, names) : fallback)
  for (const row of rows) {
    if (resolved === 'methylation') {
      const id = row[at(['probe_id', 'probe', 'cpg', 'ilmnid', 'marker', 'id'], 0)] ?? ''
      const beta = row[at(['beta', 'value', 'methylation'], 1)] ?? ''
      const unit = row[at(['unit', 'units'], 2)] ?? ''
      const date = row[at(['sample_date', 'date'], -1)] ?? ''
      pushMethyl(parsed, { probe_id: id, beta, unit, sample_date: date || ctx.sample_date, source_file: ctx.filename }, ctx.sample_date ?? '')
    } else if (resolved === 'taxa') {
      const name = row[at(['genus', 'taxon', 'name', 'marker'], 0)] ?? ''
      const abundance = row[at(['relative_abundance', 'abundance', 'rel_abundance', 'value'], 1)] ?? ''
      const unit = row[at(['unit', 'units'], -1)] ?? ''
      const site = row[at(['site'], -1)] ?? ''
      const date = row[at(['sample_date', 'date'], -1)] ?? ''
      pushTaxa(parsed, { name, abundance, unit, site, sample_date: date || ctx.sample_date, source_file: ctx.filename }, ctx)
    } else if (resolved === 'proteins') {
      const id = row[at(['uniprot', 'accession', 'aptamer', 'seqid', 'assay', 'id', 'marker'], 0)] ?? ''
      const symbol = row[at(['symbol', 'gene'], -1)] ?? ''
      const value = row[at(['value', 'z', 'npx', 'abundance'], 1)] ?? ''
      const unit = row[at(['unit_or_z', 'unit', 'units'], 2)] ?? ''
      const panel = row[at(['panel'], -1)] ?? ''
      const date = row[at(['sample_date', 'date'], -1)] ?? ''
      const idCell = id || (symbol && cell(header, ['symbol', 'gene']) === 0 ? '' : id)
      pushProtein(parsed, {
        id: idCell || (headed && cell(header, ['symbol', 'gene']) >= 0 && cell(header, ['uniprot', 'accession', 'id', 'aptamer', 'seqid']) < 0 ? '' : id),
        symbol: symbol || (headed && cell(header, ['symbol', 'gene']) === 0 ? row[0] ?? '' : ''),
        value,
        unit_or_z: unit,
        panel,
        sample_date: date || ctx.sample_date,
        source_file: ctx.filename,
      }, ctx)
    } else {
      const code = row[at(['code', 'icd10', 'icd_10', 'marker'], 0)] ?? ''
      const display = row[at(['display', 'name', 'name_zh', 'diagnosis'], 1)] ?? ''
      const onset = row[at(['onset', 'since', 'date'], 2)] ?? ''
      const system = row[at(['system'], -1)] ?? ''
      pushCondition(parsed, { code, display, onset, system, source_file: ctx.filename })
    }
  }
}

function sniffKind(first: string, explicit?: StoreKind): StoreKind | null {
  if (explicit) return explicit
  if (probeId(first)) return 'methylation'
  if (/^[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?$/.test(first.trim().toUpperCase())) return 'conditions'
  if (genusName(first.replace(/^[gs]__/i, '')) || /^[gs]__/i.test(first)) return 'taxa'
  return null
}

function absorbLines(text: string, parsed: ParsedStores, ctx: Ctx): void {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))
  const taxaContext = ctx.type === 'taxa' || Boolean(ctx.site) || /肠道|口腔|相对丰度|16S|g__/.test(text)
  const conditionContext = ctx.type === 'conditions' || /ICD-10|ICD10|诊断编码/.test(text)
  for (const line of lines) {
    if (allow(ctx, 'methylation') && (ctx.type === 'methylation' || /cg\d{8}|ch\d{8}/i.test(line))) {
      const matched = /(cg\d{8}|ch\d{8})\s*[,:;：=\t ]+\s*(-?\d+(?:\.\d+)?)\s*(%|％)?/i.exec(line)
      if (matched?.[1] && matched[2]) {
        pushMethyl(parsed, { probe_id: matched[1], beta: matched[2], unit: matched[3] ?? '', sample_date: ctx.sample_date, source_file: ctx.filename }, ctx.sample_date ?? '')
        continue
      }
    }
    if (allow(ctx, 'taxa') && taxaContext) {
      const found = taxonOnLine(line)
      if (found) {
        pushTaxa(parsed, { name: found.name, abundance: found.value, unit: found.unit, sample_date: ctx.sample_date, source_file: ctx.filename }, ctx)
        continue
      }
    }
    if (allow(ctx, 'conditions') && conditionContext) {
      const matched = /^([A-Za-z][0-9]{2}(?:\.[0-9A-Za-z]{1,4})?)\b(?:\s+|[,，\t]+)(.*)$/.exec(line)
      if (matched?.[1]) {
        const rest = (matched[2] ?? '').trim()
        const onset = /((?:19|20)\d{2}(?:-\d{2}(?:-\d{2})?)?)$/.exec(rest)
        const display = onset ? rest.slice(0, onset.index).trim() : rest
        pushCondition(parsed, { code: matched[1], display, onset: onset?.[1] ?? null, system: 'ICD-10', source_file: ctx.filename })
      }
    }
  }
}

function taxonOnLine(line: string): { name: string; value: string; unit: string } | null {
  const ranked = /[gs]__([A-Za-z][A-Za-z-]{2,}(?:_[A-Za-z0-9]+)?)/i.exec(line)
  const paren = /[（(]([A-Z][a-z]+(?:-[A-Z][a-z]+)?)[)）]/.exec(line)
  const species = /\b([A-Z][a-z]{2,})\s+([a-z]{2,})\b/.exec(line)
  const plain = /\b([A-Z][a-z]{2,}(?:-[A-Z][a-z]{2,})?)\b/.exec(line)
  const name = ranked?.[1] || paren?.[1] || (species ? `${species[1]} ${species[2]}` : plain?.[1])
  if (!name) return null
  const num = /(-?\d+(?:\.\d+)?)\s*(%|％)?/.exec(line)
  if (!num?.[1]) return null
  if (/^\d{4}$/.test(num[1]) && line.includes(`${num[1]}-`)) return null
  return { name, value: num[1], unit: num[2] ? '%' : '' }
}
