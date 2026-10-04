import type { JsonValue } from '../sys/dsh-util-values.ts'

/**
 * A tool result as DeepSeek Harness accepts it. DSH refuses a whole tool call whose value does not survive a JSON
 * round trip unchanged (dsh-util-values walkJsonValue): one undefined property, a -0, a NaN or Infinity, a hole in
 * an array or an object that is not plain is enough. JSON.stringify hides all of these, so tests never saw them; a
 * device indicator without a LOINC code (loinc: undefined) broke read_personal_situation in a real chat. Here
 * undefined properties are dropped, undefined array items and non-finite numbers become null, -0 becomes 0, and an
 * object with toJSON (a Date) becomes its JSON form.
 */
export function asJson(value: unknown): JsonValue {
  return clean(value, new Set()) ?? null
}

function clean(value: unknown, path: Set<object>): JsonValue | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? (Object.is(value, -0) ? 0 : value) : null
  if (typeof value === 'bigint') return value.toString()
  if (typeof value !== 'object') return undefined
  if (path.has(value)) return null
  const withJson = value as { toJSON?: () => unknown }
  if (!Array.isArray(value) && typeof withJson.toJSON === 'function') return clean(withJson.toJSON(), path)
  path.add(value)
  try {
    if (Array.isArray(value)) return Array.from(value, (item) => clean(item, path) ?? null)
    const out: Record<string, JsonValue> = {}
    for (const [key, item] of Object.entries(value)) {
      const kept = clean(item, path)
      if (kept !== undefined) out[key] = kept
    }
    return out
  } finally {
    path.delete(value)
  }
}
