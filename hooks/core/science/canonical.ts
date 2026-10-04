import { Buffer } from '../../sys/buffer.ts'
// Canonical JSON for manifest signatures and the transparency log. Key order is sorted; undefined is dropped.

export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item))
  if (!value || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const item = (value as Record<string, unknown>)[key]
    if (item !== undefined) out[key] = canonicalize(item)
  }
  return out
}

/** The signed bytes: the manifest without its signature object. */
export function manifestBytes(manifest: unknown): Buffer {
  const copy = manifest && typeof manifest === 'object' ? { ...(manifest as Record<string, unknown>) } : {}
  delete copy.signature
  return Buffer.from(stableStringify(copy), 'utf8')
}
