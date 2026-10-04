// Mirobody answers MCP calls with a compact pipe table, not JSON rows
// (mirobody/agent/tools/_render.py, render_compact):
//
//   (constants: unit=mmol/L, system=loinc)   columns equal on every row, hoisted
//   indicator|time|value|code                 header of the columns that vary
//   hs-CRP|2026-08-26 08:30:00|1.5|30522-7    one line per row
//
//   (window=…, tz=…, rows=N[, of M][, truncated])
//   notes: …
//
// A table whose every column is constant has no header at all: the constants
// line is the one row. "(no rows)" is an empty answer and "error (kind): …" a
// refusal. Cells are never quoted, so a "|" inside a free-text cell spills into
// the next column; the overflow is folded back into the last column.

export interface CompactMeta {
  window: string
  tz: string
  resolution: string
  aggregate: string
  rows: number | null
  total: number | null
  truncated: boolean
}

export interface CompactTable {
  rows: Array<Record<string, string>>
  meta: CompactMeta
  notes: string[]
  error?: { kind: string; message: string }
  /**
   * Later tables after a blank line, e.g. the catalogue's "reported by the person" section
   * (constants kind=condition): diagnoses the person reported. They are not rows of the first table.
   */
  sections?: Array<{ title: string; constants: Record<string, string>; rows: Array<Record<string, string>> }>
}

const META_LINE = /^\((?:window|resolution|aggregate|rows)=/
const CONSTANTS = '(constants: '

function emptyMeta(): CompactMeta {
  return { window: '', tz: '', resolution: '', aggregate: '', rows: null, total: null, truncated: false }
}

/** Split "k=v, k=v" where a value may itself contain ", " — a pair only starts at ", name=". */
function parsePairs(body: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  const starts: Array<{ at: number; key: string; value: number }> = []
  const pattern = /(?:^|, )([a-z_][a-z0-9_]*)=/g
  for (let match = pattern.exec(body); match; match = pattern.exec(body)) {
    starts.push({ at: match.index, key: match[1] ?? '', value: match.index + match[0].length })
  }
  for (let i = 0; i < starts.length; i += 1) {
    const here = starts[i]
    if (!here) continue
    const end = starts[i + 1]?.at ?? body.length
    pairs.push([here.key, body.slice(here.value, end)])
  }
  return pairs
}

function parseMeta(line: string): CompactMeta {
  const meta = emptyMeta()
  const inner = line.slice(1, line.endsWith(')') ? -1 : undefined)
  for (const part of inner.split(', ')) {
    const eq = part.indexOf('=')
    if (eq < 0) {
      if (part === 'truncated') meta.truncated = true
      const of = /^of (\d+)$/.exec(part)
      if (of) meta.total = Number(of[1])
      continue
    }
    const key = part.slice(0, eq)
    const value = part.slice(eq + 1)
    if (key === 'window') meta.window = value
    else if (key === 'tz') meta.tz = value
    else if (key === 'resolution') meta.resolution = value
    else if (key === 'aggregate') meta.aggregate = value
    else if (key === 'rows') meta.rows = Number(value)
  }
  return meta
}

export function parseCompact(text: string): CompactTable {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const first = (lines.find((line) => line.trim()) ?? '').trim()
  const refusal = /^error \(([a-z_]+)\): ?(.*)$/.exec(first)
  if (refusal) return { rows: [], meta: emptyMeta(), notes: [], error: { kind: refusal[1] ?? 'internal', message: refusal[2] ?? '' } }

  // The body ends at the blank line before the meta line; search from the end so a
  // row that happens to start with "(" is never taken for the meta line.
  let metaAt = -1
  for (let i = lines.length - 1; i > 0; i -= 1) {
    if (lines[i - 1] === '' && META_LINE.test(lines[i] ?? '')) {
      metaAt = i
      break
    }
  }
  const body = metaAt >= 0 ? lines.slice(0, metaAt - 1) : lines.filter((line) => line.trim())
  const meta = metaAt >= 0 ? parseMeta(lines[metaAt] ?? '') : emptyMeta()
  const notes = metaAt >= 0 ? lines.slice(metaAt + 1).filter((line) => line.trim()) : []

  let at = 0
  const constants: Record<string, string> = {}
  const head = body[0] ?? ''
  if (head.startsWith(CONSTANTS) && head.endsWith(')')) {
    for (const [key, value] of parsePairs(head.slice(CONSTANTS.length, -1))) constants[key] = value
    at = 1
  }
  const all = body.slice(at).filter((line) => !line.startsWith('… cut at'))
  // A blank line ends the first table. What follows is another section with its own title, constants and header.
  const blank = all.indexOf('')
  const rest = blank >= 0 ? all.slice(0, blank) : all
  const sections = blank >= 0 ? parseSections(all.slice(blank + 1)) : []
  const extra = sections.length > 0 ? { sections } : {}
  if (rest[0] === '(no rows)' || (rest.length === 0 && Object.keys(constants).length === 0)) {
    return { rows: [], meta, notes, ...extra }
  }
  if (rest.length === 0) return { rows: [{ ...constants }], meta, notes, ...extra }
  return { rows: rowsOf(rest[0] ?? '', rest.slice(1), constants), meta, notes, ...extra }
}

function rowsOf(headLine: string, lines: readonly string[], constants: Record<string, string>): Array<Record<string, string>> {
  const header = headLine.split('|')
  const rows: Array<Record<string, string>> = []
  for (const line of lines) {
    const cells = line.split('|')
    if (cells.length > header.length) {
      const keep = cells.slice(0, header.length - 1)
      keep.push(cells.slice(header.length - 1).join('|'))
      cells.splice(0, cells.length, ...keep)
    }
    const row: Record<string, string> = { ...constants }
    header.forEach((column, i) => { row[column] = cells[i] ?? '' })
    rows.push(row)
  }
  return rows
}

/** Sections after the first table: an optional title line, an optional constants line, a header, rows. */
function parseSections(lines: readonly string[]): NonNullable<CompactTable['sections']> {
  const out: NonNullable<CompactTable['sections']> = []
  let at = 0
  while (at < lines.length) {
    while (at < lines.length && !(lines[at] ?? '').trim()) at += 1
    if (at >= lines.length) break
    let title = ''
    const constants: Record<string, string> = {}
    if (!(lines[at] ?? '').includes('|') && !(lines[at] ?? '').startsWith(CONSTANTS)) title = (lines[at++] ?? '').trim()
    const head = lines[at] ?? ''
    if (head.startsWith(CONSTANTS) && head.endsWith(')')) {
      for (const [key, value] of parsePairs(head.slice(CONSTANTS.length, -1))) constants[key] = value
      at += 1
    }
    const end = lines.indexOf('', at)
    const chunk = lines.slice(at, end >= 0 ? end : lines.length)
    at = end >= 0 ? end + 1 : lines.length
    if (chunk.length === 0 || !(chunk[0] ?? '').includes('|')) {
      if (title || Object.keys(constants).length > 0) out.push({ title, constants, rows: [] })
      continue
    }
    out.push({ title, constants, rows: rowsOf(chunk[0] ?? '', chunk.slice(1), constants) })
  }
  return out
}

/**
 * The table inside one MCP tool payload. Mirobody wraps it as {result: "<table>",
 * status, row_count, truncated}; a transport may hand over the bare text, or the
 * REST shape {rows, count, total, truncated}. Returns null when the payload is
 * neither (an OAuth blob, a warmup sentence, a JSON object with no rows).
 */
export function tableOf(payload: unknown): CompactTable | null {
  if (typeof payload === 'string') {
    if (looksCompact(payload)) return parseCompact(payload)
    const parsed = jsonObject(payload)
    return parsed ? tableOf(parsed) : null
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const record = payload as { result?: unknown }
  const result = record.result
  if (typeof result === 'string') {
    if (looksCompact(result)) return parseCompact(result)
    const parsed = jsonObject(result)
    if (parsed) {
      const inner = tableOf(parsed)
      if (inner) return inner
    }
  } else if (result && typeof result === 'object') {
    const inner = restTable(result)
    if (inner) return inner
  }
  return restTable(payload)
}

function jsonObject(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return null
  }
}

/** Mirobody's browser shape: rows as objects, the same meta the compact table carries. */
function restTable(payload: unknown): CompactTable | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const record = payload as Record<string, unknown>
  if (!Array.isArray(record.rows)) return null
  const rows: Array<Record<string, string>> = []
  for (const item of record.rows) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const row: Record<string, string> = {}
    for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') row[key] = String(value)
    }
    rows.push(row)
  }
  const meta = emptyMeta()
  meta.rows = typeof record.count === 'number' ? record.count : rows.length
  if (typeof record.total === 'number') meta.total = record.total
  if (record.truncated === true) meta.truncated = true
  const window = record.window
  if (window && typeof window === 'object') {
    const zone = (window as { tz?: unknown }).tz
    if (typeof zone === 'string') meta.tz = zone
  }
  if (typeof record.resolution === 'string') meta.resolution = record.resolution
  if (typeof record.aggregate === 'string') meta.aggregate = record.aggregate
  return { rows, meta, notes: [] }
}

function looksCompact(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) return false
  return trimmed.includes('|') || trimmed.startsWith(CONSTANTS) || trimmed.startsWith('(no rows)')
    || trimmed.startsWith('error (') || /\n\((?:window|rows)=/.test(trimmed)
}

/** A cell as a number, or null for an empty or non-numeric cell ("Positive", "<0.5", "5.48 ↑"). */
export function cellNumber(value: string | undefined): number | null {
  if (value == null) return null
  const text = value.trim()
  if (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(text)) return null
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}

export type PrintedFlag = 'high' | 'low' | 'positive' | 'negative' | 'abnormal' | 'below' | 'above'

export interface PrintedValue {
  /** The measurement, when the cell is a number plus an optional arrow or H/L flag. */
  value: number | null
  /** The bound in "<0.5" or ">100". Not a measurement. */
  bound: number | null
  comparator: '<' | '<=' | '>' | '>=' | null
  flag: PrintedFlag | null
  /** 阴性 / 阳性 / 弱阳性, with the "(−)" decoration removed. */
  qualitative: string | null
  /** The original cell when it was not a bare number. */
  printed: string | null
}

const NO_PRINT: PrintedValue = { value: null, bound: null, comparator: null, flag: null, qualitative: null, printed: null }

/**
 * A lab cell as printed on a report. "5.48 ↑" and "120↓" are the number plus a flag.
 * "<0.5" keeps the bound and is not treated as 0.5. "阴性(-)" is qualitative.
 * A bare number has no flag and no printed form.
 */
export function parsePrinted(raw: string | null | undefined): PrintedValue {
  if (raw == null) return NO_PRINT
  const text = String(raw).normalize('NFKC').trim()
  if (!text) return NO_PRINT
  const qualitative = qualitativeOf(text)
  if (qualitative) {
    return { ...NO_PRINT, qualitative: qualitative.text, flag: qualitative.flag, printed: text === qualitative.text ? null : text }
  }
  const compared = /^(<=|>=|<|>|≤|≥)\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)$/.exec(text)
  if (compared) {
    const token = compared[1] ?? ''
    const comparator = token === '≤' ? '<=' : token === '≥' ? '>=' : token as '<' | '<=' | '>' | '>='
    const bound = Number(compared[2])
    if (!Number.isFinite(bound)) return { ...NO_PRINT, printed: text }
    return { ...NO_PRINT, bound, comparator, flag: comparator.startsWith('<') ? 'below' : 'above', printed: text }
  }
  const flagged = /^([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*(↑|↓|▲|▼|\*|H|L|高|低)$/i.exec(text)
  if (flagged) {
    const value = Number(flagged[1])
    if (!Number.isFinite(value)) return { ...NO_PRINT, printed: text }
    const mark = (flagged[2] ?? '').toUpperCase()
    const flag: PrintedFlag = mark === '↓' || mark === '▼' || mark === 'L' || mark === '低' ? 'low'
      : mark === '*' ? 'abnormal' : 'high'
    return { ...NO_PRINT, value, flag, printed: text }
  }
  const bare = cellNumber(text)
  if (bare != null) return { ...NO_PRINT, value: bare }
  return { ...NO_PRINT, printed: text }
}

function qualitativeOf(text: string): { text: string; flag: PrintedFlag } | null {
  if (/弱阳性/.test(text)) return { text: '弱阳性', flag: 'abnormal' }
  const stripped = text.replace(/[（(]\s*[-+＋−–—]*\s*[)）]/g, '').replace(/\s+/g, '')
  if (/阴性|negative|^neg$/i.test(stripped) || stripped === '-' || stripped === '−' || stripped === '—') {
    return { text: '阴性', flag: 'negative' }
  }
  if (/阳性|positive|^pos$/i.test(stripped) || stripped === '+' || stripped === '＋') {
    return { text: '阳性', flag: 'positive' }
  }
  return null
}
