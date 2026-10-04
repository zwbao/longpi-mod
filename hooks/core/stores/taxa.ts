// Genus (or a species binomial reduced to its genus) plus a relative abundance in 0–1.

import type { TaxaRow } from '../contracts/library.ts'
import { finite, isoDate, sourceName, type Verdict } from './limits.ts'

const GENUS = /^[A-Z][a-z]{2,30}(?:-[A-Z][a-z]{2,30})?(?:_[0-9]{1,4})?$/
const DENY = new Set([
  'shannon', 'simpson', 'chao', 'chao1', 'observed', 'firmicutes', 'bacteroidetes',
  'enterotype', 'total', 'sample', 'date', 'unknown', 'bacteria', 'archaea', 'note',
])

export interface TaxaDraft {
  name: string
  abundance: unknown
  unit?: string
  site?: string
  sample_date?: string
  source_file: string
}

export function genusName(value: string): string | null {
  let text = value.trim().replace(/^[gs]__/i, '')
  const species = /^([A-Z][a-z]{2,30})\s+([a-z]{2,30})$/.exec(text)
  if (species?.[1]) text = species[1]
  const underscored = /^([A-Z][a-z]{2,30})_([a-z]{2,30})$/.exec(text)
  if (underscored?.[1]) text = underscored[1]
  if (DENY.has(text.toLowerCase())) return null
  return GENUS.test(text) ? text : null
}

export function siteOf(value: unknown): 'gut' | 'oral' | null {
  const text = String(value ?? '').trim().toLowerCase()
  if (['gut', 'stool', 'fecal', 'faecal', '肠道', '粪便'].includes(text)) return 'gut'
  if (['oral', 'saliva', '口腔', '唾液'].includes(text)) return 'oral'
  return null
}

export function validateTaxa(draft: TaxaDraft, fallbackDate = '', fallbackSite?: 'gut' | 'oral'): Verdict<TaxaRow> {
  const genus = genusName(draft.name)
  if (!genus) return { ok: false, field: 'genus', reason: 'genus' }
  const site = siteOf(draft.site) ?? fallbackSite ?? null
  if (!site) return { ok: false, field: 'site', reason: 'site' }
  const sample = isoDate(draft.sample_date) ?? isoDate(fallbackDate)
  if (!sample) return { ok: false, field: 'sample_date', reason: 'date' }
  const parsed = finite(draft.abundance)
  if (parsed == null) return { ok: false, field: 'relative_abundance', reason: 'abundance' }
  const unit = (draft.unit ?? '').trim().toLowerCase()
  let abundance = parsed
  if (unit === '%' || unit === 'percent' || unit === '％' || unit === '百分比') {
    if (parsed < 0 || parsed > 100) return { ok: false, field: 'relative_abundance', reason: 'abundance' }
    abundance = parsed / 100
  } else if (unit && unit !== '1' && unit !== 'fraction') {
    return { ok: false, field: 'unit', reason: 'unit' }
  } else if (parsed < 0 || parsed > 1) {
    return { ok: false, field: 'relative_abundance', reason: 'abundance' }
  }
  const source = sourceName(draft.source_file)
  if (!source) return { ok: false, field: 'source_file', reason: 'source' }
  return { ok: true, row: { sample_date: sample, site, genus, relative_abundance: abundance, source_file: source } }
}

export function taxaCoverage(rows: TaxaRow[]): string {
  const sites = [...new Set(rows.map((row) => (row.site === 'gut' ? '肠道' : '口腔')))].join('、')
  return `共 ${rows.length} 行${sites ? `，部位 ${sites}` : ''}。`
}
