// ICD-10 condition rows. The code is the shape check. A display is the name on the list, not a diagnosis we add.

import type { ConditionRow } from '../contracts/library.ts'
import { onsetOf, sourceName, type Verdict } from './limits.ts'

const ICD = /^[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?$/

export interface ConditionDraft {
  code: string
  display?: string
  onset?: unknown
  system?: string
  source_file: string
}

export function icdCode(value: string): string | null {
  const code = value.trim().toUpperCase()
  return ICD.test(code) ? code : null
}

function systemOf(value: unknown): 'ICD-10' | 'other' {
  const text = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '')
  if (!text || text === 'ICD-10' || text === 'ICD10') return 'ICD-10'
  return 'other'
}

export function validateCondition(draft: ConditionDraft): Verdict<ConditionRow> {
  const code = icdCode(draft.code)
  if (!code) return { ok: false, field: 'code', reason: 'icd' }
  if (systemOf(draft.system) !== 'ICD-10') return { ok: false, field: 'system', reason: 'system' }
  const display = (draft.display ?? '').trim().replace(/\s+/g, ' ') || code
  if (display.length > 80) return { ok: false, field: 'display', reason: 'display' }
  const onset = onsetOf(draft.onset)
  if (onset === undefined) return { ok: false, field: 'onset', reason: 'date' }
  const source = sourceName(draft.source_file)
  if (!source) return { ok: false, field: 'source_file', reason: 'source' }
  return { ok: true, row: { code, system: 'ICD-10', display, onset, source } }
}

export function conditionMatches(code: string, key: string): boolean {
  const left = code.toUpperCase()
  const right = key.trim().toUpperCase()
  if (!right) return false
  if (left === right) return true
  return left.startsWith(right) && left[right.length] === '.'
}

export function conditionCoverage(rows: ConditionRow[]): string {
  return `共 ${rows.length} 个 ICD-10 编码。`
}
