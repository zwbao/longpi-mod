// Protein panel rows. The id is a UniProt accession, an assay id, or a gene symbol.
// An organ age (unit 岁) is not a protein row.

import type { ProteinRow } from '../contracts/library.ts'
import { finite, isoDate, sourceName, type Verdict } from './limits.ts'

const UNIPROT = /^(?:[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})$/
const APTAMER = /^[A-Za-z][A-Za-z0-9]{0,20}\.\d{2,8}\.\d{1,6}$/
const OID = /^OID\d{3,8}$/i
const SYMBOL = /^[A-Za-z][A-Za-z0-9]{1,14}$/
const AGE_UNIT = /^(岁|a|yr|year|years|生物年\/历年)$/i
const NON_PROTEIN = new Set([
  'protage', 'brain', 'immune', 'liver', 'kidney', 'artery', 'heart', 'adipose', 'pancreas',
  'eye', 'digestive', 'hepatic', 'endocrine', 'metabolic', 'cardiovascular', 'ionocyte',
  'pulmonary', 'musculoskeletal', 'shannon', 'simpson', 'age', 'sex', 'bmi', 'fi', 'omaa',
  'enterotype', 'date', 'sample', 'organ',
])

export interface ProteinDraft {
  id?: string
  symbol?: string
  value: unknown
  unit_or_z?: string
  panel?: string
  sample_date?: string
  source_file: string
}

export function proteinIdentity(idRaw: string, symbolRaw = ''): { id: string; symbol: string } | null {
  const idText = idRaw.trim()
  const symbolText = symbolRaw.trim()
  if (idText && UNIPROT.test(idText)) return { id: idText, symbol: SYMBOL.test(symbolText) ? symbolText : '' }
  if (idText && APTAMER.test(idText)) {
    const prefix = idText.split('.')[0] ?? ''
    const symbol = SYMBOL.test(symbolText) ? symbolText : (SYMBOL.test(prefix) ? prefix : '')
    return { id: idText, symbol }
  }
  if (idText && OID.test(idText)) return { id: idText.toUpperCase(), symbol: SYMBOL.test(symbolText) ? symbolText : '' }
  const token = idText || symbolText
  if (!token || /\s/.test(token)) return null
  if (!SYMBOL.test(token) || NON_PROTEIN.has(token.toLowerCase())) return null
  return { id: token, symbol: token }
}

export function validateProtein(draft: ProteinDraft, fallbackDate = '', fallbackPanel = 'consumer'): Verdict<ProteinRow> {
  const identity = proteinIdentity(draft.id ?? '', draft.symbol ?? '')
  if (!identity) return { ok: false, field: 'id', reason: 'protein_id' }
  const unit = (draft.unit_or_z ?? '').trim()
  if (!unit || unit.length > 32 || AGE_UNIT.test(unit) || /年龄/.test(unit)) return { ok: false, field: 'unit_or_z', reason: 'unit' }
  if (!/^[\w.%/^+-]+$/.test(unit)) return { ok: false, field: 'unit_or_z', reason: 'unit' }
  const sample = isoDate(draft.sample_date) ?? isoDate(fallbackDate)
  if (!sample) return { ok: false, field: 'sample_date', reason: 'date' }
  const value = finite(draft.value)
  if (value == null || Math.abs(value) > 1e6) return { ok: false, field: 'value', reason: 'value' }
  const panel = (draft.panel || fallbackPanel).trim().slice(0, 40)
  if (!panel) return { ok: false, field: 'panel', reason: 'panel' }
  const source = sourceName(draft.source_file)
  if (!source) return { ok: false, field: 'source_file', reason: 'source' }
  return { ok: true, row: { sample_date: sample, panel, id: identity.id, symbol: identity.symbol, value, unit_or_z: unit, source_file: source } }
}

export function proteinCoverage(rows: ProteinRow[]): string {
  const panels = [...new Set(rows.map((row) => row.panel))].slice(0, 4).join('、')
  return `共 ${rows.length} 行${panels ? `，面板 ${panels}` : ''}。`
}
