// Size limits for typed stores. The runner still refuses a model-supplied file over 256KB.

export const STORE_SCHEMA = 'longpi-store/1'
/** A chip export is larger than a model file. The store holds it; the narrow writer does not. */
export const IMPORT_CAP_BYTES = 32 * 1024 * 1024
export const IMPORT_CAP_ROWS = 1_000_000
/** Same cutoff as runner.ts: a staged file with text.length above this is refused. */
export const MODEL_FILE_CAP = 256_000

export const STORE_KINDS = ['methylation', 'taxa', 'proteins', 'conditions'] as const

export type Verdict<T> = { ok: true; row: T } | { ok: false; field: string; reason: string }

export function sourceName(name: string): string | null {
  const base = name.split(/[/\\]/).pop()?.trim() ?? ''
  if (!base || base === '.' || base === '..' || base.includes('..') || base.includes('\0')) return null
  const clean = [...base].filter((ch) => /[\w.\-+]/.test(ch) || /[\u4e00-\u9fff]/.test(ch)).join('').slice(0, 80)
  return clean || null
}

export function isoDate(value: unknown): string | null {
  const text = String(value ?? '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
}

export function onsetOf(value: unknown): string | null | undefined {
  if (value == null) return null
  const text = String(value).trim()
  if (!text) return null
  if (/^\d{4}$/.test(text) || /^\d{4}-\d{2}$/.test(text) || /^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  return undefined
}

export function finite(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const text = value.trim().replace(/%$/, '')
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

export function countReasons(rows: Array<{ reason: string }>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const row of rows) out[row.reason] = (out[row.reason] ?? 0) + 1
  return out
}
