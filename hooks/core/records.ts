import { createHash } from '../sys/crypto.ts'
import type { Config } from './config.ts'
import { discoverPython, runBridgeStatus, type BridgeStatus } from './bridge.ts'
import { callMcpTool, mcpHost, redact, type McpCallResult } from './mcp.ts'
import { readProfile, estimatedAge, type Profile } from './profile.ts'
import { presentMedications, readStatements } from './meds-stated.ts'
import { loincCode, summarizeIndicators, summarizeMedications, type IndicatorRow, type MedicationRow } from './situation.ts'
import { isDiagnosisName } from './ux/plain.ts'
import { parsePrinted, tableOf, type PrintedFlag } from './compact.ts'
import { readSelf, selfIndicators, selfKeyOf, SELF_ALIASES, SELF_DEVICE_NAMES, SELF_KEYS, SELF_SPEC, SELF_SUFFIX, type SelfKey } from './selfmeasure.ts'
import { foldName, nameVariants, normalizeUnit } from './units.ts'
import { checkupMarkerFor, loadReference, type Biovar, type BiovarMarker } from './reference.ts'
import { loadCatalog, type InputSpec } from './catalog.ts'
import { indicatorFor, matchesInputName } from './measurements.ts'

const MAX_INDICATORS = 400
/** Mirobody's own cap on catalogue names (its tool description: "200 catalogue names"). */
const MIROBODY_CATALOG_CAP = 200
const LATEST_CHUNK = 50
/** One conversation turn calls several tools that each need the record; read it once. */
const CACHE_TTL_MS = 60_000
/** A read that failed, in part or whole, is kept only long enough for one turn: the next one tries again. */
const FAILED_TTL_MS = 10_000
const SERIES_CHUNK = 12
/** Raw readings per indicator asked of Mirobody; a series that fills it is read again for the older ones. */
const RAW_LIMIT = 500
/** Reads of one series before it is called cut: 20 x 500 readings (a home cuff twice a day for over 13 years). */
const RAW_PAGES = 20
const LOG_WINDOW_DAYS = 90

/**
 * How the record read went. A named type, so the declarations print it by name: an inlined union is printed in
 * the checker's order, which differs between builds and made lib/ look stale in CI.
 */
export type RecordStatus = 'unconfigured' | 'ok' | 'partial' | 'error'

export interface RecordSnapshot {
  profile: Profile
  estimated_age: number | null
  engine: BridgeStatus
  mcp: { configured: boolean; host: string; token_set: boolean }
  indicators: IndicatorRow[]
  medications: MedicationRow[]
  /** Current regimen first, older plans labelled 较早. Empty until a medication read succeeds. */
  medication_summary_zh: string[]
  /** partial: the record was read, but some reads failed or came back cut (read_errors says which). */
  record_status: RecordStatus
  record_error: string
  /** Each read that failed or was cut, in Chinese; empty when every read succeeded. */
  read_errors: string[]
  /** Catalogue names whose latest value was not read because the read failed: unknown, never "not measured". */
  missing_reads: string[]
  /** The catalogue itself was cut, so an indicator missing from it may simply not have been read. */
  catalog_truncated: boolean
  /**
   * Input keys asked for by LOINC and name after a cut catalogue, where the server answered.
   * Absence then means not on file. A failed ask is not listed here.
   */
  probed_inputs: string[]
}

/** Whether the record was read, whole or in part: the reads that worked are used, the failed ones named. */
export function recordReadable(records: Pick<RecordSnapshot, 'record_status'>): boolean {
  return records.record_status === 'ok' || records.record_status === 'partial'
}

/** What a missing input means: a failed read, a cut catalogue, or a lookup that already answered. */
export function readFlags(records: Pick<RecordSnapshot, 'missing_reads' | 'catalog_truncated' | 'probed_inputs'>): { failed: readonly string[]; catalog_truncated: boolean; probed: readonly string[] } {
  return { failed: records.missing_reads, catalog_truncated: records.catalog_truncated, probed: records.probed_inputs ?? [] }
}

function memberArgs(member: string): Record<string, unknown> {
  const trimmed = member.trim()
  return trimmed ? { member: trimmed } : {}
}

function payloadOf(result: McpCallResult): unknown {
  if (result.success === false) return null
  return result.result ?? result.text ?? null
}

type Remote = Omit<RecordSnapshot, 'profile' | 'estimated_age' | 'medication_summary_zh'>

const cache = new Map<string, { at: number; ttl: number; value: Promise<unknown> }>()

/**
 * The account a read is for, without the token itself: another token on the same address is another account.
 * connection.ts re-exports it as connectionKey.
 */
export function tokenKey(config: Pick<Config, 'mcpToken'>): string {
  const token = config.mcpToken.trim()
  return token ? createHash('sha256').update(token).digest('hex').slice(0, 16) : ''
}

function cacheKey(config: Config, kind: string, extra = ''): string {
  return [kind, config.mcpUrl.trim(), tokenKey(config), config.member.trim(), config.mirobodyHome, config.pythonBin, extra].join('\u0000')
}

async function cached<T>(key: string, load: () => Promise<T>, failed: (value: T) => boolean = () => false): Promise<T> {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && now - hit.at < hit.ttl) return hit.value as Promise<T>
  const value = load()
  const entry = { at: now, ttl: CACHE_TTL_MS, value }
  cache.set(key, entry)
  value.then((result) => {
    if (failed(result)) entry.ttl = FAILED_TTL_MS
  }, () => {
    if (cache.get(key) === entry) cache.delete(key)
  })
  for (const [name, other] of cache) if (now - other.at >= other.ttl) cache.delete(name)
  return value
}

let healthMemo: { at: number; origin: string; up: boolean | null } | null = null

/** Forget cached record reads, after a change the next read must see. */
export function invalidateRecords(): void {
  cache.clear()
  healthMemo = null
}

/**
 * How many indicator reads run at once. A page asks for every series together;
 * Mirobody then drops some of them (a non-table payload, or a database error
 * while /api/health still says the service is up). FINDINGS 56.
 */
const READ_PARALLEL = 3
const READ_ATTEMPTS = 3
let readsActive = 0
const readQueue: Array<() => void> = []

function withReadSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (readsActive >= READ_PARALLEL) {
    return new Promise<T>((resolve, reject) => {
      readQueue.push(() => { withReadSlot(fn).then(resolve, reject) })
    })
  }
  readsActive += 1
  return fn().finally(() => {
    readsActive -= 1
    const next = readQueue.shift()
    if (next) next()
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** A database fault, not a slow query. The test fixture's "database timeout" is not this. */
const DB_DOWN = /OperationalError|InterfaceError|connection refused|could not connect to server|server closed the connection unexpectedly|too many clients already|the database system is starting up|the database system is shutting down|password authentication failed|remaining connection slots|psycopg|asyncpg/i

const DB_DOWN_HEALTHY_ZH = '健康数据服务运行正常，但数据库未连接，暂时无法读取。请稍后再试。'
const DB_DOWN_ZH = '健康数据服务的数据库未连接，暂时无法读取。请稍后再试。'
const AUTH_ZH = '无法识别本次登录，请在设置中重新连接健康数据服务。'

function isDbDown(text: string): boolean {
  return DB_DOWN.test(text)
}

function isAuthBlob(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const record = payload as Record<string, unknown>
  if (typeof record.authorization_url === 'string') return true
  const message = typeof record.message === 'string' ? record.message : ''
  return /oauth/i.test(message)
}

/** /api/health does not look at the database. True means the process answered, not that reads work. */
async function serviceLooksHealthy(mcpUrl: string, timeoutMs: number): Promise<boolean | null> {
  let origin = ''
  try {
    origin = new URL(mcpUrl).origin
  } catch {
    return null
  }
  const now = Date.now()
  if (healthMemo && healthMemo.origin === origin && now - healthMemo.at < 15_000) return healthMemo.up
  let up: boolean | null = null
  try {
    const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(Math.min(timeoutMs, 4000)) })
    if (!response.ok) up = false
    else {
      const body = await response.json() as { service?: unknown; version?: unknown }
      up = Boolean(body && (typeof body.service === 'string' || typeof body.version === 'string'))
    }
  } catch {
    up = null
  }
  healthMemo = { at: now, origin, up }
  return up
}

interface ToolRead {
  payload: unknown | null
  error: string
  kind: 'ok' | 'denied' | 'db' | 'auth' | 'not_table' | 'unavailable' | 'internal'
}

/** One tool call, retried when the answer is a transient failure rather than a table. */
/**
 * Mirobody 1.5.3 publishes one query schema: keywords, indicators, start, end and `view`
 * (raw | minute | hour | day | week | month | stats | latest), and refuses any other argument.
 * Older servers took `resolution` × `aggregate` (+ `limit`, `member`). Calls are written in the
 * old words; this translates them, and falls back to the old words once for a server whose
 * refusal says it does not accept `view`.
 */
/** Per server (keyed by the MCP address): true when it only knows the old words. Switching servers never carries it over. */
const legacyQuerySchema = new Map<string, boolean>()
/** Mirobody 1.5.3 returns at most 50 raw rows per indicator (ROW_CAP); older servers took `limit`. */
const VIEW_ROW_CAP = 50
/** Mirobody 1.5.3's longest window per call is 43920 h (1830 days); pieces stay under it. */
const VIEW_MAX_DAYS = 1800

function spanDays(start: string, end: string): number {
  const a = Date.parse(`${start.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${end.slice(0, 10)}T00:00:00Z`)
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) + 1 : 0
}

function isLegacy(config: Pick<Config, 'mcpUrl'>): boolean {
  return legacyQuerySchema.get(config.mcpUrl.trim()) === true
}

function rawPageLimit(config: Pick<Config, 'mcpUrl'>): number {
  return isLegacy(config) ? RAW_LIMIT : VIEW_ROW_CAP
}

export function queryArgsForView(args: Record<string, unknown>): Record<string, unknown> {
  // `member` is kept: a server that cannot read a care-circle member must refuse, never answer
  // with the account holder's record instead.
  const { aggregate, resolution, limit: _limit, ...rest } = args
  if (rest.view !== undefined) return rest
  let view = 'raw'
  if (aggregate === 'latest') view = 'latest'
  else if (aggregate === 'stats') view = 'stats'
  else if (typeof resolution === 'string' && ['minute', 'hour', 'day', 'week', 'month'].includes(resolution)) view = resolution
  if (!rest.indicators && !rest.keywords) return rest
  return { ...rest, view }
}

function acceptedWords(error: string): string | null {
  const accepted = /Accepted:\s*([^."]*)/i.exec(error)
  return /unknown argument/i.test(error) && accepted ? accepted[1] ?? '' : null
}

/** Test hook: forget what the last server accepted. */
export function resetQuerySchema(): void {
  legacyQuerySchema.clear()
}

async function readTool(config: Config, name: string, rawArgs: Record<string, unknown>, secrets: readonly string[]): Promise<ToolRead> {
  let lastError = 'read failed'
  let lastKind: ToolRead['kind'] = 'internal'
  const translate = name === 'query_health_indicators'
  let switched = false
  for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt += 1) {
    const legacy = isLegacy(config)
    const args = translate && !legacy ? queryArgsForView(rawArgs) : rawArgs
    const call = await withReadSlot(() => callMcpTool({
      url: config.mcpUrl,
      token: config.mcpToken,
      name,
      args,
      timeoutMs: config.timeoutMs,
    }))
    const accepted = call.success === false && translate ? acceptedWords(call.error || '') : null
    if (accepted !== null && !switched) {
      const knowsView = /\bview\b/.test(accepted)
      if (legacy === knowsView) {                   // the server speaks the other schema: ask again once in its words
        legacyQuerySchema.set(config.mcpUrl.trim(), !knowsView)
        switched = true
        attempt -= 1
        continue
      }
    }
    if (call.success === false) {
      lastError = redact(call.error || 'read failed', secrets)
      lastKind = call.error_kind === 'denied' ? 'denied' : call.error_kind === 'unavailable' ? 'unavailable' : 'internal'
      if (isDbDown(lastError)) lastKind = 'db'
      if (lastKind === 'denied' || attempt === READ_ATTEMPTS) break
      await delay(25 * attempt)
      continue
    }
    const payload = payloadOf(call)
    if (tableOf(payload)) return { payload, error: '', kind: 'ok' }
    if (isAuthBlob(payload)) {
      lastError = AUTH_ZH
      lastKind = 'auth'
      if (attempt === READ_ATTEMPTS) break
      await delay(25 * attempt)
      continue
    }
    lastError = '返回的不是指标表'
    lastKind = 'not_table'
    if (attempt === READ_ATTEMPTS) break
    await delay(25 * attempt)
  }
  if (lastKind === 'db') {
    const healthy = await serviceLooksHealthy(config.mcpUrl, config.timeoutMs)
    lastError = healthy === true ? DB_DOWN_HEALTHY_ZH : DB_DOWN_ZH
  }
  return { payload: null, error: lastError, kind: lastKind }
}

function formatMeasured(value: number): string {
  if (!Number.isFinite(value)) return ''
  const text = Number(value.toPrecision(12)).toString()
  return text === '-0' ? '0' : text
}

/** Arrow flags become a number plus a flag. Inequalities and 阴性 stay text, with the flag beside them. */
function presentIndicator(row: IndicatorRow): IndicatorRow {
  const parsed = parsePrinted(row.value)
  const next: IndicatorRow = { ...row }
  if (parsed.value != null && parsed.flag) {
    next.value = formatMeasured(parsed.value)
    Object.assign(next, { flag: parsed.flag, printed: parsed.printed ?? row.value })
  } else if (parsed.qualitative) {
    next.value = parsed.qualitative
    Object.assign(next, { flag: parsed.flag, ...(parsed.printed ? { printed: parsed.printed } : {}) })
  } else if (parsed.bound != null && parsed.comparator) {
    Object.assign(next, { flag: parsed.flag, printed: parsed.printed ?? row.value, bound: parsed.bound, comparator: parsed.comparator })
  }
  return next
}

/** hs-CRP and conventional CRP share one variation row and must not become one series. */
const SPLIT_LOINC = new Set(['30522-7', '1988-5'])

/** The code whose unit is the marker's unit, when the marker lists more than one. */
const CANONICAL_LOINC: Record<string, string> = {
  creatinine: '14682-9',
  glucose: '14771-0',
  tc: '2093-3',
  ldl: '13457-7',
  hdl: '2085-9',
  tg: '2571-8',
  wbc: '6690-2',
  hb: '718-7',
  hct: '4544-3',
  mchc: '786-4',
}

/** Converted values outside this window are a wrong unit, not a different lab. Left as printed. */
const PLAUSIBLE: Record<string, [number, number]> = {
  creatinine: [15, 2000],
  glucose: [1, 40],
  tc: [0.5, 20],
  ldl: [0.2, 15],
  hdl: [0.1, 5],
  tg: [0.05, 30],
  hb: [30, 250],
  hct: [0.1, 0.75],
  mchc: [200, 450],
  wbc: [0.1, 200],
  crp: [0, 500],
  vitd: [1, 250],
}

/** Same analyte, different printed name, and Mirobody left it uncoded (or used 30385-9 for RDW-CV). */
const LOCAL_ANALYTES: ReadonlyArray<{ key: string; label_zh: string; loinc: string; names: string[] }> = [
  { key: 'rdw_cv', label_zh: '红细胞分布宽度', loinc: '788-0', names: ['rdw-cv', 'rdwcv', 'rdw', '红细胞分布宽度', '红细胞分布宽度-变异系数'] },
  { key: 'waist', label_zh: '腰围', loinc: '', names: ['腰围', '腹围'] },
]

const RDW_EQUIV = '30385-9'

function isDeviceHandle(name: string): boolean {
  return /^[a-z]+(?:[A-Z][a-z0-9]*)+$/.test(name)
}

function urineCreatinine(name: string): boolean {
  return /尿/.test(name) && /肌酐|creatinine|crea/i.test(name) && !/尿酸/.test(name)
}

function stripSpecimen(text: string): string {
  return text.replace(/血清|血浆/g, '').replace(/^血(?!红|压|糖)/, '')
}

function localFor(name: string): (typeof LOCAL_ANALYTES)[number] | null {
  if (/标准差|rdw-sd|rdwsd/i.test(name)) return null
  const folded = foldName(name)
  const stripped = foldName(name.replace(/-?变异系数/g, '').replace(/-?cv$/i, ''))
  for (const item of LOCAL_ANALYTES) {
    if (item.names.some((alias) => {
      const key = foldName(alias)
      return key === folded || key === stripped
    })) return item
  }
  return null
}

/** CRP names stay on their own code. Anything else returns null. */
function splitAssay(name: string, loinc: string | undefined): string | null {
  if (loinc && SPLIT_LOINC.has(loinc)) return loinc
  const folded = foldName(name)
  if (!folded.includes('crp') && !folded.includes('c反应蛋白')) return null
  if (folded.includes('超敏') || folded.includes('hs')) return '30522-7'
  return '1988-5'
}

/** Codes Mirobody assigns that are the same analyte as a variation-table marker but are not on its list. */
const LOINC_EQUIV_KEY: Record<string, string> = {
  '22748-8': 'ldl',
}

function markerForReading(biovar: Biovar, row: Pick<IndicatorRow, 'name' | 'label' | 'loinc'>): BiovarMarker | null {
  if (isDeviceHandle(row.name) && !row.loinc) return null
  if (urineCreatinine(row.name) || urineCreatinine(row.label ?? '')) return null
  // A code the marker does not list is a different measurement (urine glucose, urine creatinine).
  // Only an explicit equivalence, or no code at all, may join on the name.
  const equiv = row.loinc ? LOINC_EQUIV_KEY[row.loinc] : undefined
  if (equiv) {
    return biovar.markers.find((item) => item.key === equiv) ?? null
  }
  const named = [row, { name: stripSpecimen(row.name), label: stripSpecimen(row.label ?? ''), loinc: row.loinc }]
  for (const item of named) {
    const hit = checkupMarkerFor(biovar, item)
    if (hit) return hit
  }
  return null
}

function groupOfRow(row: IndicatorRow, biovar: Biovar): string {
  if (row.source === 'self' || (isDeviceHandle(row.name) && !row.loinc)) return `keep:${row.name.toLowerCase()}`
  if (urineCreatinine(row.name) || urineCreatinine(row.label ?? '')) return `keep:${foldName(row.name)}`
  const local = !row.loinc || row.loinc === RDW_EQUIV ? localFor(row.label || row.name) : null
  if (local) return local.loinc ? `loinc:${local.loinc}` : `local:${local.key}`
  const assay = splitAssay(row.label || row.name, row.loinc)
  if (assay) return `assay:${assay}`
  const marker = markerForReading(biovar, row)
  if (marker && marker.key !== 'crp') return `marker:${marker.key}`
  if (row.loinc) return `loinc:${row.loinc}`
  return `name:${foldName(row.label || row.name)}`
}

function stampLabel(row: IndicatorRow, label: string): void {
  if (!label) return
  const current = row.label ?? ''
  if (current === label) return
  Object.assign(row, { ...(current ? { label_original: current } : {}), label })
}

function convertTo(value: number, unit: string, marker: BiovarMarker): number | null {
  const given = normalizeUnit(unit)
  const target = normalizeUnit(marker.unit)
  if (!given || !target) return null
  if (given === target) return value
  for (const [name, factor] of Object.entries(marker.convert ?? {})) {
    if (normalizeUnit(name) === given && typeof factor === 'number') return value * factor
  }
  return null
}

function plausible(key: string, value: number): boolean {
  const range = PLAUSIBLE[key]
  if (!range) return true
  return value >= range[0] && value <= range[1]
}

function rememberOriginal(row: IndicatorRow, fields: { value?: boolean; unit?: boolean; loinc?: boolean }): void {
  const extra = row as IndicatorRow & { value_original?: string; unit_original?: string; loinc_original?: string }
  if (fields.value && extra.value_original == null) extra.value_original = row.value
  if (fields.unit && extra.unit_original == null) extra.unit_original = row.unit
  if (fields.loinc && row.loinc && extra.loinc_original == null) extra.loinc_original = row.loinc
}

function setCode(row: IndicatorRow, code: string): void {
  if (!code || row.loinc === code) return
  rememberOriginal(row, { loinc: true })
  row.loinc = code
}

/**
 * One catalogue row per analyte. Different Chinese names, LOINC codes and units
 * of the same marker share a code and a unit; each row keeps its Mirobody name
 * and the value as it was printed. hs-CRP is not merged with conventional CRP.
 * A conversion that lands outside a loose human range is left alone.
 */
function reconcileIndicators(rows: readonly IndicatorRow[], skillsHome: string): IndicatorRow[] {
  const presented = rows.map(presentIndicator)
  const home = skillsHome.trim()
  if (!home) return presented
  let biovar: Biovar
  try {
    const reference = loadReference(home)
    if (reference.error || reference.biovar.markers.length === 0) return presented
    biovar = reference.biovar
  } catch {
    return presented
  }
  const groups = new Map<string, IndicatorRow[]>()
  for (const row of presented) {
    const key = groupOfRow(row, biovar)
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }
  for (const [key, group] of groups) reconcileGroup(key, group, biovar)
  return presented
}

function reconcileGroup(key: string, group: IndicatorRow[], biovar: Biovar): void {
  if (key.startsWith('keep:') || group.length === 0) return
  const sample = group[0]
  if (!sample) return
  const local = localAnalyteForKey(key, sample, biovar)
  if (local) {
    for (const row of group) {
      // 30385-9 is the same RDW-CV ratio as 788-0; PhenoAge lists only 788-0.
      if (local.loinc && (!row.loinc || row.loinc === '30385-9')) setCode(row, local.loinc)
      stampLabel(row, local.label_zh)
      Object.assign(row, { series_key: local.key })
    }
    return
  }
  if (key.startsWith('assay:')) {
    const code = key.slice('assay:'.length)
    for (const row of group) {
      if (!row.loinc) setCode(row, code)
      Object.assign(row, { series_key: code === '30522-7' ? 'hscrp' : 'crp' })
    }
    return
  }
  const marker = markerForReading(biovar, sample)
  if (!marker || marker.key === 'crp') return
  for (const row of group) Object.assign(row, { series_key: marker.key })
  // A lone code stays as Mirobody stored it. Two codes, or a coded row and an
  // uncoded alias, become one code in the marker's unit.
  if (group.length < 2) return
  const codes = new Set(group.map((row) => row.loinc).filter((code): code is string => Boolean(code)))
  if (codes.size < 2 && group.every((row) => row.loinc)) return
  const listed = CANONICAL_LOINC[marker.key]
  const canonical = listed && marker.loinc.includes(listed) ? listed : (marker.loinc[0] ?? '')
  for (const row of group) {
    const numeric = parsePrinted(row.value).value
    if (numeric == null || !normalizeUnit(row.unit)) {
      if (canonical && !row.loinc) setCode(row, canonical)
      stampLabel(row, marker.label_zh)
      continue
    }
    const converted = convertTo(numeric, row.unit, marker)
    if (converted == null) continue
    if (!plausible(marker.key, converted)) {
      Object.assign(row, { unit_suspect: true })
      continue
    }
    if (normalizeUnit(row.unit) !== normalizeUnit(marker.unit)) {
      rememberOriginal(row, { value: true, unit: true })
      row.value = formatMeasured(converted)
      row.unit = marker.unit
    }
    if (canonical) setCode(row, canonical)
    stampLabel(row, marker.label_zh)
  }
}

/** A local alias group, and not a code that already belongs to a variation-table marker. */
function localAnalyteForKey(key: string, sample: IndicatorRow, biovar: Biovar): (typeof LOCAL_ANALYTES)[number] | null {
  if (!localFor(sample.label || sample.name) && !localFor(sample.name)) return null
  if (key.startsWith('local:')) return LOCAL_ANALYTES.find((item) => item.key === key.slice('local:'.length)) ?? null
  if (!key.startsWith('loinc:')) return null
  const code = key.slice('loinc:'.length)
  if (biovar.markers.some((item) => item.loinc.includes(code))) return null
  return LOCAL_ANALYTES.find((item) => item.loinc === code) ?? null
}

export async function loadRecords(config: Config, dataDir: string, pluginHome: string): Promise<RecordSnapshot> {
  const profile = readProfile(dataDir)
  const remote = await cached(cacheKey(config, 'records', pluginHome), () => loadRemote(config, pluginHome), (value) => value.record_status === 'error' || value.record_status === 'partial')
  return {
    profile,
    estimated_age: estimatedAge(profile.birthYear, new Date().getFullYear()),
    ...remote,
    indicators: mergeSelf(remote.indicators.map((row) => ({ ...row })), selfIndicators(readSelf(dataDir))),
    ...(() => {
      const presented = presentMedications(remote.medications, readStatements(dataDir))
      return { medications: presented.rows, medication_summary_zh: presented.lines }
    })(),
    read_errors: [...remote.read_errors],
    missing_reads: [...remote.missing_reads],
    probed_inputs: [...remote.probed_inputs],
  }
}

/**
 * Add the person's own measurements to the record rows. A self row joins only
 * when it is newer than every record row measuring the same thing (same LOINC,
 * the wearable's blood-pressure and weight rows, or a row named or labelled
 * like it: 腰围, waist, 体重…), so a newer checkup always wins. It goes last:
 * indicatorFor keeps the last row per LOINC code.
 */
export function mergeSelf(remote: IndicatorRow[], self: readonly IndicatorRow[]): IndicatorRow[] {
  const out = [...remote]
  for (const row of self) {
    const key = selfKeyOf(row.name) ?? SELF_KEYS.find((item) => SELF_SPEC[item].loinc === row.loinc)
    const same = remote.filter((other) => other.value && other.source !== 'self' && ((row.loinc && other.loinc === row.loinc) || (key ? sameMeasure(key, other) : false)))
    const newer = same.every((other) => (row.date ?? '') > (other.date || other.last_date || ''))
    if (newer) out.push(row)
  }
  return out
}

/** Whether a record row measures the same thing as a self key, by LOINC, device name, or report name. */
export function sameMeasure(key: SelfKey, row: Pick<IndicatorRow, 'name' | 'label' | 'loinc'>): boolean {
  if (row.loinc && SELF_ALIASES[key].loinc.includes(row.loinc)) return true
  if ((SELF_DEVICE_NAMES[key] ?? []).includes(row.name)) return true
  const names = new Set(SELF_ALIASES[key].names.map((name) => foldName(name)))
  return [row.name, row.label ?? ''].filter(Boolean).some((text) => nameVariants(text).some((variant) => names.has(variant)))
}

async function loadRemote(config: Config, pluginHome: string): Promise<Remote> {
  const python = discoverPython(config.pythonBin, pluginHome)
  const engine = runBridgeStatus(pluginHome, python, config.mirobodyHome, config.timeoutMs)
  const configured = Boolean(config.mcpUrl.trim())
  const snapshot: Remote = {
    engine,
    mcp: {
      configured,
      host: mcpHost(config.mcpUrl),
      token_set: Boolean(config.mcpToken.trim()),
    },
    indicators: [],
    medications: [],
    record_status: configured ? 'ok' : 'unconfigured',
    record_error: '',
    read_errors: [],
    missing_reads: [],
    catalog_truncated: false,
    probed_inputs: [],
  }
  if (!configured) return snapshot

  const secrets = [config.mcpToken, config.mcpUrl]
  const catalogue = await readTool(config, 'query_health_indicators', memberArgs(config.member), secrets)
  if (catalogue.kind !== 'ok') {
    snapshot.record_status = 'error'
    snapshot.record_error = catalogue.error
    return snapshot
  }
  const cataloguePayload = catalogue.payload
  const table = tableOf(cataloguePayload)
  if (table?.error) {
    snapshot.record_status = 'error'
    snapshot.record_error = redact(`${table.error.kind}: ${table.error.message}`, secrets)
    return snapshot
  }
  const listed = summarizeIndicators(cataloguePayload, MAX_INDICATORS + 1)
  snapshot.indicators = listed.slice(0, MAX_INDICATORS)
  // Mirobody cannot page its catalogue (no offset or cursor), so a cut catalogue is read as far as it goes and said so.
  const cut = catalogueCut(cataloguePayload, table, listed.length)
  if (cut) {
    snapshot.catalog_truncated = true
    snapshot.read_errors.push(cut)
  }
  const names = snapshot.indicators.filter((item) => !item.value && !isDiagnosisName(item.name)).map((item) => item.name).filter(Boolean)
  if (names.length > 0) {
    const filled = new Map<string, IndicatorRow>()
    const unread: string[] = []
    for (let start = 0; start < names.length; start += LATEST_CHUNK) {
      const chunk = names.slice(start, start + LATEST_CHUNK)
      const latest = await readTool(config, 'query_health_indicators', { ...memberArgs(config.member), indicators: chunk, aggregate: 'latest' }, secrets)
      const problem = latest.kind === 'ok' ? batchProblem(latest.payload) : latest.error
      if (problem) {
        snapshot.read_errors.push(`${chunk.length} 项指标的最新值读取失败：${problem}`)
        unread.push(...chunk)
        // Mirobody is down or refuses this account: the other batches would fail the same way, each after a timeout.
        if (latest.kind === 'unavailable' || latest.kind === 'denied' || latest.kind === 'db' || latest.kind === 'auth') {
          unread.push(...names.slice(start + LATEST_CHUNK))
          if (start + LATEST_CHUNK < names.length) snapshot.read_errors.push(`其余 ${names.length - start - LATEST_CHUNK} 项未继续读取。`)
          break
        }
        continue
      }
      const got = new Set<string>()
      for (const row of summarizeIndicators(latest.payload, MAX_INDICATORS)) {
        got.add(row.name.toLowerCase())
        if (row.value) filled.set(row.name.toLowerCase(), row)
      }
      // A name the catalogue lists but the answer left out was not read either.
      const absent = chunk.filter((name) => !got.has(name.toLowerCase()))
      if (absent.length > 0) {
        snapshot.read_errors.push(`${absent.length} 项指标没有返回最新值。`)
        unread.push(...absent)
      }
    }
    if (filled.size > 0) {
      snapshot.indicators = snapshot.indicators.map((item) => {
        const hit = filled.get(item.name.toLowerCase())
        if (!hit) return item
        // A wearable series has no LOINC code: leave the key out rather than setting it to undefined.
        const merged = { ...item, ...hit, loinc: hit.loinc ?? item.loinc }
        if (!merged.loinc) delete merged.loinc
        return merged
      })
    }
    snapshot.missing_reads = [...new Set(unread)]
  }
  if (snapshot.catalog_truncated) await supplementCutCatalog(config, snapshot, secrets)
  snapshot.indicators = reconcileIndicators(snapshot.indicators, config.skillsHome ?? '')
  const meds = await readTool(config, 'query_medications', { ...memberArgs(config.member), view: 'plan' }, secrets)
  const medsProblem = meds.kind === 'ok' ? tableOf(meds.payload)?.error?.message ?? '' : meds.error
  if (medsProblem) {
    snapshot.read_errors.push(`用药计划读取失败：${medsProblem}`)
  } else {
    snapshot.medications = summarizeMedications(meds.payload)
  }
  if (snapshot.read_errors.length > 0) {
    snapshot.record_status = 'partial'
    snapshot.record_error = snapshot.read_errors.join('；').slice(0, 500)
  }
  return snapshot
}

/**
 * Why a catalogue came back cut, or '' when it is whole.
 * Mirobody 1.5.0 sets `truncated` on every catalogue of two or more series (it compared the
 * catalogue size, copied onto each row, with 1). A page whose parsed rows equal `rows` and `of N`,
 * with no character cut, is the whole catalogue. The flag alone is not a cut.
 */
function catalogueCut(payload: unknown, table: ReturnType<typeof tableOf>, listed: number): string {
  // The row count Mirobody prints covers every section, including the person-reported conditions after the indicators.
  const parsed = table ? table.rows.length + (table.sections ?? []).reduce((sum, section) => sum + section.rows.length, 0) : listed
  const claimed = table?.meta.rows
  const total = table?.meta.total ?? null
  const charCut = textOf(payload).includes('… cut at ')
  const short = claimed != null && claimed > parsed
  if (charCut || short || (total != null && total > parsed)) {
    return `指标目录未完整读取：本次仅读取 ${table?.rows.length ?? parsed} 项${total != null ? `（共 ${total} 项）` : ''}，其余未读取。`
  }
  // No "of N" to go by: a catalogue exactly at Mirobody's cap was most likely cut there.
  if (table && total == null && parsed >= MIROBODY_CATALOG_CAP) {
    return `指标目录返回了 ${parsed} 项，已达到单次读取上限，可能仍有指标未读取。`
  }
  if (listed > MAX_INDICATORS) return `指标目录超过 ${MAX_INDICATORS} 项，只读取了前 ${MAX_INDICATORS} 项。`
  return ''
}

/** Phenotypic age and China-PAR. Their inputs are looked up by code when the catalogue is cut. */
const MODEL_SKILLS = ['accelerated-biological-aging-risk', 'china-par-ascvd-risk']

function modelInputSpecs(home: string): InputSpec[] {
  let catalog: ReturnType<typeof loadCatalog>
  try {
    catalog = loadCatalog(home)
  } catch {
    return []
  }
  const specs: InputSpec[] = []
  for (const name of MODEL_SKILLS) {
    const card = catalog.cards.find((item) => item.name === name)
    if (!card) continue
    for (const spec of card.inputs) {
      if (!spec.required || (spec.from ?? 'measurements') !== 'measurements') continue
      specs.push(spec)
    }
  }
  return specs
}

function selectorsFor(spec: InputSpec): string[] {
  const out: string[] = []
  for (const item of [...(spec.loinc ?? []), spec.label_zh, ...(spec.aliases ?? [])]) {
    const text = item.trim()
    if (!text || text.includes('_') || out.includes(text)) continue
    out.push(text)
  }
  return out
}

/** A lookup that found nothing: a refusal naming the indicator, a fallback catalogue, or an empty table. */
function lookupAbsent(payload: unknown): boolean {
  const table = tableOf(payload)
  if (!table) return false
  if (table.error) {
    const text = `${table.error.kind} ${table.error.message}`.toLowerCase()
    return text.includes('invalid_arguments') || text.includes('not in this record') || text.includes('no indicator matched')
  }
  if (table.notes.some((note) => note.includes('no indicator matched'))) return true
  if (table.rows.length === 0) return true
  if (table.rows.every((row) => !(row.value ?? '').trim() && (row.first_date || row.count))) return true
  return false
}

function rowMatchesSpec(spec: InputSpec, row: IndicatorRow): boolean {
  if (row.loinc && (spec.loinc ?? []).includes(row.loinc)) return true
  return matchesInputName(spec, row.name) || matchesInputName(spec, row.label)
}

function mergeFound(snapshot: Remote, rows: readonly IndicatorRow[]): void {
  const filled = new Map(rows.filter((row) => row.value).map((row) => [row.name.toLowerCase(), row]))
  if (filled.size === 0) return
  const seen = new Set(snapshot.indicators.map((item) => item.name.toLowerCase()))
  snapshot.indicators = snapshot.indicators.map((item) => {
    const hit = filled.get(item.name.toLowerCase())
    if (!hit) return item
    const merged = { ...item, ...hit, loinc: hit.loinc ?? item.loinc }
    if (!merged.loinc) delete merged.loinc
    return merged
  })
  for (const row of filled.values()) {
    if (seen.has(row.name.toLowerCase())) continue
    snapshot.indicators.push(row)
    seen.add(row.name.toLowerCase())
  }
}

/**
 * After a cut catalogue, ask for each model input by its LOINC codes and names. A hit is merged.
 * An answer that the series is not on file is recorded on probed_inputs, so it is "not measured"
 * rather than a failed read. A transport failure leaves the input unread.
 */
async function supplementCutCatalog(config: Config, snapshot: Remote, secrets: string[]): Promise<void> {
  const home = config.skillsHome?.trim()
  if (!home) return
  const specs = modelInputSpecs(home).filter((spec) => !indicatorFor(spec, snapshot.indicators))
  if (specs.length === 0) return
  const failed = new Set<string>()
  const selectors = specs.flatMap((spec) => selectorsFor(spec).map((selector) => ({ key: spec.key, selector })))
  for (let start = 0; start < selectors.length; start += LATEST_CHUNK) {
    const chunk = selectors.slice(start, start + LATEST_CHUNK)
    const names = [...new Set(chunk.map((item) => item.selector))]
    const latest = await readTool(config, 'query_health_indicators', { ...memberArgs(config.member), indicators: names, aggregate: 'latest' }, secrets)
    if (latest.kind !== 'ok') {
      snapshot.read_errors.push(`${names.length} 项模型指标的最新值读取失败：${latest.error}`)
      for (const item of chunk) failed.add(item.key)
      if (latest.kind === 'unavailable' || latest.kind === 'denied' || latest.kind === 'db' || latest.kind === 'auth') break
      continue
    }
    const payload = latest.payload
    if (lookupAbsent(payload)) continue
    const problem = batchProblem(payload)
    if (problem) {
      snapshot.read_errors.push(`${names.length} 项模型指标的最新值读取失败：${redact(problem, secrets)}`)
      for (const item of chunk) failed.add(item.key)
      continue
    }
    mergeFound(snapshot, summarizeIndicators(payload, MAX_INDICATORS))
  }
  const still = specs.filter((spec) => !failed.has(spec.key) && !indicatorFor(spec, snapshot.indicators))
  const labels = [...new Set(still.map((spec) => spec.label_zh).filter(Boolean))].slice(0, 20)
  if (labels.length > 0) {
    const call = await readTool(config, 'query_health_indicators', { ...memberArgs(config.member), keywords: labels, aggregate: 'latest' }, secrets)
    if (call.kind !== 'ok') {
      snapshot.read_errors.push(`模型指标按名称读取失败：${call.error}`)
      for (const spec of still) failed.add(spec.key)
    } else {
      const payload = call.payload
      if (!lookupAbsent(payload) && !batchProblem(payload)) {
        const rows = summarizeIndicators(payload, MAX_INDICATORS).filter((row) => still.some((spec) => rowMatchesSpec(spec, row)))
        mergeFound(snapshot, rows)
      }
    }
  }
  for (const spec of specs) {
    if (!failed.has(spec.key)) snapshot.probed_inputs.push(spec.key)
  }
  snapshot.probed_inputs = [...new Set(snapshot.probed_inputs)]
}

/** Why a latest-value answer is not one, or '': a refusal, or a payload that is no indicator table. */
function batchProblem(payload: unknown): string {
  const table = tableOf(payload)
  if (table?.error) return `${table.error.kind}: ${table.error.message}`
  if (!table && summarizeIndicators(payload, 1).length === 0) return '返回的不是指标表'
  return ''
}

/** Where one plotted point came from. The point's value is the number; this keeps the printed cell and the lab. */
export interface ReadingProvenance {
  indicator: string
  label?: string
  loinc?: string
  unit: string
  value: number
  printed?: string
  flag?: PrintedFlag
  file?: string
  /** Hospital or source named in the file handle (lp:checkup:date:lab). */
  lab?: string
  /** Other files that carried the same value at the same time (a page uploaded twice). */
  files?: string[]
}

export interface SeriesPoint {
  date: string
  time: string
  value: number
  unit: string
  file?: string
  flag?: PrintedFlag
  printed?: string
  provenance?: ReadingProvenance
}

/** A result that is not a measurement: "<0.5", "阴性(-)". Kept, never plotted as the bound. */
export interface OtherReading {
  date: string
  time: string
  text: string
  flag: PrintedFlag | null
  unit: string
  file?: string
  lab?: string
}

export interface Series {
  indicator: string
  label?: string
  loinc?: string
  unit: string
  points: SeriesPoint[]
  other?: OtherReading[]
}

export interface SeriesResult {
  series: Record<string, Series>
  /** The first failure, redacted; set whenever any name was not read. */
  error?: string
  truncated: boolean
  /** Names whose read failed: their series is unknown, never empty. */
  failed: string[]
  /** Names whose readings came back cut (a series that filled the row limit, or a table Mirobody marked cut). */
  cut: string[]
}

/**
 * Which series a table row belongs to. A row that names one of the asked indicators
 * (or carries that name in `code`, the device namespace) keeps it. A day call asks
 * for one indicator, and a bucket that names nothing belongs to that indicator;
 * its display, when the row has one, is kept as the label. A nameless row in a
 * batch of several indicators is dropped: those buckets cannot be split.
 */
function filedRow(row: Record<string, string>, asked: readonly string[], claimUnnamed: boolean): Record<string, string> | null {
  const stated = (row.indicator ?? '').trim()
  const code = (row.code ?? '').trim()
  const indicator = stated && asked.includes(stated) ? stated
    : code && asked.includes(code) ? code
      : claimUnnamed && asked.length === 1 ? (asked[0] ?? '')
        : ''
  if (!indicator) return null
  if (stated === indicator) return row
  return { ...row, indicator, ...(stated && !row.name ? { name: stated } : {}) }
}

/**
 * Dated values of named indicators, oldest first. resolution raw returns every
 * reading (labs); day returns one daily value per indicator (wearables; Mirobody's
 * elected day, or the newest reading of that civil day). "5.48 ↑" and "120↓"
 * are the number plus a flag. "<0.5" and "阴性(-)" are kept on `other` and are
 * not plotted as the bound. A batch that fails is tried again, then named;
 * a database or login failure stops the remaining batches.
 *
 * A day read asks for one indicator at a time. Mirobody 1.5.0 and 1.5.1 select
 * `display` for a day bucket and not the printed name, and an uncoded series
 * (dailySteps, dailyTotalSleepTime) has no display, so the compact table has
 * the day's avg and no indicator. Two such series in one table cannot be told
 * apart. The bucket's `period` is already the account's civil day (Asia/Shanghai
 * once that zone is set).
 */
export async function loadSeries(
  config: Config,
  names: readonly string[],
  options: { start: string; end: string; resolution: 'raw' | 'day' },
): Promise<SeriesResult> {
  // Self measurements live in dataDir; their names mean nothing to Mirobody.
  const wanted = [...new Set(names.map((name) => name.trim()).filter((name) => name && !name.endsWith(SELF_SUFFIX)))]
  if (wanted.length === 0) return { series: {}, truncated: false, failed: [], cut: [] }
  if (!config.mcpUrl.trim()) return { series: {}, truncated: false, error: 'mcpUrl is not set', failed: wanted, cut: [] }
  // Mirobody 1.5.3 clamps one call to five years (43920 h): a longer window is read in pieces, newest first.
  if (!isLegacy(config) && spanDays(options.start, options.end) > VIEW_MAX_DAYS) {
    const merged: SeriesResult = { series: {}, truncated: false, failed: [], cut: [] }
    let end = options.end
    while (end >= options.start) {
      const start = [addDays(end, -(VIEW_MAX_DAYS - 1)), options.start].sort().at(-1) ?? options.start
      const part = await loadSeries(config, wanted, { ...options, start, end })
      if (part.error) merged.error ??= part.error
      merged.failed.push(...part.failed)
      merged.cut.push(...part.cut)
      // A failed piece means the older pieces would fail the same way, each after a timeout: stop here.
      if (part.failed.length > 0) break
      for (const [name, series] of Object.entries(part.series)) {
        const into = merged.series[name]
        if (!into) { merged.series[name] = { ...series, points: [...series.points], ...(series.other ? { other: [...series.other] } : {}) }; continue }
        for (const point of series.points) addPoint(into, point)
        if (series.other) into.other = [...(into.other ?? []), ...series.other]
      }
      end = addDays(start, -1)
    }
    merged.failed = [...new Set(merged.failed)]
    merged.cut = [...new Set(merged.cut)].filter((name) => !merged.failed.includes(name))
    merged.truncated = merged.cut.length > 0
    for (const series of Object.values(merged.series)) series.points.sort((a, b) => a.time.localeCompare(b.time))
    return merged
  }
  const key = cacheKey(config, 'series', JSON.stringify([wanted, options]))
  return cached(key, async () => {
    const out: SeriesResult = { series: {}, truncated: false, failed: [], cut: [] }
    const secrets = [config.mcpToken, config.mcpUrl]
    const fail = (chunk: string[], problem: string) => {
      out.error ??= redact(problem, secrets)
      out.failed.push(...chunk)
    }
    // Day buckets of an uncoded series omit the name, so each day call is one indicator.
    const chunkSize = options.resolution === 'day' ? 1 : SERIES_CHUNK
    for (let start = 0; start < wanted.length; start += chunkSize) {
      const chunk = wanted.slice(start, start + chunkSize)
      const args: Record<string, unknown> = {
        ...memberArgs(config.member),
        indicators: chunk,
        start: options.start,
        end: options.end,
        resolution: options.resolution,
        aggregate: 'none',
      }
      if (options.resolution === 'raw') args.limit = RAW_LIMIT
      const call = await readTool(config, 'query_health_indicators', args, secrets)
      if (call.kind !== 'ok') {
        fail(chunk, call.error || 'series read failed')
        // Down or refused: the other batches would fail the same way, each after a timeout.
        if (call.kind === 'unavailable' || call.kind === 'denied' || call.kind === 'db' || call.kind === 'auth') {
          out.failed.push(...wanted.slice(start + chunkSize))
          break
        }
        continue
      }
      const payload = call.payload
      const table = tableOf(payload)
      if (!table) {
        fail(chunk, '返回的不是指标表')
        continue
      }
      if (table.error) {
        fail(chunk, `${table.error.kind}: ${table.error.message}`)
        continue
      }
      const rows = new Map<string, Array<Record<string, string>>>()
      for (const row of table.rows) {
        const filed = filedRow(row, chunk, options.resolution === 'day')
        if (!filed) continue
        rows.set(filed.indicator ?? '', [...(rows.get(filed.indicator ?? '') ?? []), filed])
      }
      // A series that filled the limit lost its oldest readings: read those again, a window ending earlier each time.
      const pageLimit = rawPageLimit(config)
      const full = options.resolution === 'raw' ? chunk.filter((name) => (rows.get(name)?.length ?? 0) >= pageLimit) : []
      const stillCut: string[] = []
      for (const name of full) {
        const older = await readOlder(config, name, options, rows.get(name) ?? [])
        if (older) rows.set(name, older)
        else stillCut.push(name)
      }
      for (const row of [...rows.values()].flat()) {
        const indicator = (row.indicator ?? '').trim()
        const cell = options.resolution === 'raw' ? row.value : row.avg
        const parsed = parsePrinted(cell)
        const date = options.resolution === 'raw' ? (row.date || (row.time ?? '').slice(0, 10)) : (row.period ?? '').slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
        const series = out.series[indicator] ?? (out.series[indicator] = { indicator, unit: (row.unit ?? '').trim(), points: [] })
        if (row.name && row.name !== indicator && !series.label) series.label = row.name
        const code = loincCode(row.system, row.code)
        if (code && !series.loinc) series.loinc = code
        const file = (row.file ?? '').trim()
        const lab = labOf(file)
        const unit = (row.unit ?? series.unit).trim()
        if (parsed.value != null) {
          addPoint(series, {
            date,
            time: row.time ?? date,
            value: parsed.value,
            unit,
            ...(file ? { file } : {}),
            ...(parsed.flag ? { flag: parsed.flag } : {}),
            ...(parsed.printed ? { printed: parsed.printed } : {}),
            provenance: {
              indicator,
              ...(row.name && row.name !== indicator ? { label: row.name } : {}),
              ...(code ? { loinc: code } : {}),
              unit,
              value: parsed.value,
              ...(parsed.printed ? { printed: parsed.printed } : {}),
              ...(parsed.flag ? { flag: parsed.flag } : {}),
              ...(file ? { file } : {}),
              ...(lab ? { lab } : {}),
            },
          })
          continue
        }
        if (parsed.qualitative || parsed.bound != null) {
          const list = series.other ?? (series.other = [])
          list.push({
            date,
            time: row.time ?? date,
            text: parsed.printed ?? parsed.qualitative ?? (cell ?? ''),
            flag: parsed.flag,
            unit,
            ...(file ? { file } : {}),
            ...(lab ? { lab } : {}),
          })
        }
      }
      // Cut: a series still full after its older readings were read again, or a table Mirobody marked cut.
      // A batch marked cut with no series at the row cap is usually the text cap (or a flag that cannot be
      // pinned). Read each indicator alone so a small lab series is whole, and only a series that is still
      // cut on its own stays cut. PhenoAge's history uses this path.
      const marked = table.meta.truncated || (payload && typeof payload === 'object' && (payload as { truncated?: unknown }).truncated === true)
        || textOf(payload).includes('\n… cut at ')
        // Mirobody 1.5.3 clamps a window longer than its maximum and says so in a note: older readings are missing.
        || table.notes.some((note) => /window clamped/i.test(note)) || /window clamped/i.test(textOf(payload))
      if (marked && full.length === 0 && chunk.length > 1) {
        for (const name of chunk) delete out.series[name]
        for (const name of chunk) {
          const one = await loadSeries(config, [name], options)
          for (const [key, series] of Object.entries(one.series)) out.series[key] = series
          if (one.error) out.error ??= one.error
          out.failed.push(...one.failed)
          out.cut.push(...one.cut)
        }
      } else {
        out.cut.push(...(full.length > 0 ? stillCut : marked ? chunk : []))
      }
    }
    out.failed = [...new Set(out.failed)]
    out.cut = [...new Set(out.cut)].filter((name) => !out.failed.includes(name))
    out.truncated = out.cut.length > 0
    for (const series of Object.values(out.series)) series.points.sort((a, b) => a.time.localeCompare(b.time))
    return out
  }, (value) => value.failed.length > 0)
}

function labOf(file: string): string {
  const parts = file.split(':')
  if (parts[0] === 'lp' && parts.length >= 4) return parts.slice(3).join(':')
  return ''
}

/** Same instant, same number, two uploads: one point, both files. */
function addPoint(series: Series, point: SeriesPoint): void {
  const same = series.points.find((item) => item.time === point.time && item.value === point.value && item.unit === point.unit)
  if (!same) {
    series.points.push(point)
    return
  }
  if (!point.file || !same.file || point.file === same.file) return
  const provenance = same.provenance ?? {
    indicator: series.indicator,
    unit: same.unit,
    value: same.value,
    file: same.file,
  }
  same.provenance = provenance
  const files = provenance.files ?? [same.file]
  if (!files.includes(point.file)) files.push(point.file)
  provenance.files = files
}

function rowDate(row: Record<string, string>): string {
  return row.date || (row.time ?? '').slice(0, 10)
}

/**
 * Every raw reading of one series in the window, given the first read that filled the limit. Mirobody returns the
 * newest readings first and drops the oldest, so each further read ends on the oldest day returned so far; that
 * day is taken whole from the later read. Null when the readings cannot all be read (a read failed, one day
 * alone fills the limit, or RAW_PAGES reads were not enough): the series is then cut.
 */
async function readOlder(
  config: Config,
  name: string,
  options: { start: string; end: string },
  first: Array<Record<string, string>>,
): Promise<Array<Record<string, string>> | null> {
  let page = first
  const kept: Array<Record<string, string>> = []
  // Mirobody gives each row the size of the whole series in the window; when it does, the pieces must add up to it.
  const total = Number(first[0]?.total)
  for (let reads = 1; reads < RAW_PAGES; reads += 1) {
    const dates = page.map(rowDate).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort()
    const oldest = dates[0]
    // One day alone fills the limit: no earlier end can split it.
    if (!oldest || dates.at(-1) === oldest) return null
    kept.push(...page.filter((row) => rowDate(row) > oldest))
    const args = { ...memberArgs(config.member), indicators: [name], start: options.start, end: oldest, resolution: 'raw', aggregate: 'none', limit: RAW_LIMIT }
    const call = await readTool(config, 'query_health_indicators', args, [config.mcpToken, config.mcpUrl])
    if (call.kind !== 'ok') return null
    const table = tableOf(call.payload)
    if (!table || table.error) return null
    const next = table.rows.filter((row) => (row.indicator ?? '').trim() === name && rowDate(row) <= oldest)
    if (next.length < rawPageLimit(config)) {
      const all = [...kept, ...next]
      return Number.isInteger(total) && total > 0 && all.length !== total ? null : all
    }
    page = next
  }
  return null
}

function textOf(payload: unknown): string {
  if (typeof payload === 'string') return payload
  const result = payload && typeof payload === 'object' ? (payload as { result?: unknown }).result : undefined
  return typeof result === 'string' ? result : ''
}

export interface DoseRow {
  date: string
  medication: string
  status: string
  plan_id: string
}

export interface CourseRow {
  medication: string
  start: string
  end: string
  closed_by: string
  plan_id: string
}

function addDays(iso: string, days: number): string {
  const at = new Date(`${iso}T00:00:00Z`)
  at.setUTCDate(at.getUTCDate() + days)
  return at.toISOString().slice(0, 10)
}

/** Doses recorded taken or skipped for one medication, read in windows under Mirobody's row cap. */
export async function loadDoseLog(config: Config, medication: string, start: string, end: string): Promise<{ rows: DoseRow[]; error?: string }> {
  if (!config.mcpUrl.trim()) return { rows: [], error: 'mcpUrl is not set' }
  return cached(cacheKey(config, 'doses', JSON.stringify([medication, start, end])), async () => {
    const rows: DoseRow[] = []
    let from = start
    while (from <= end) {
      const to = [addDays(from, LOG_WINDOW_DAYS - 1), end].sort()[0] ?? end
      const call = await readTool(config, 'query_medications', { ...memberArgs(config.member), view: 'log', keywords: [medication], start: from, end: to }, [config.mcpToken, config.mcpUrl])
      if (call.kind !== 'ok') return { rows, error: call.error || 'dose log read failed' }
      const table = tableOf(call.payload)
      if (table?.error) return { rows, error: `${table.error.kind}: ${table.error.message}` }
      for (const row of table?.rows ?? []) {
        if (!row.date || !row.medication) continue
        rows.push({ date: row.date, medication: row.medication, status: (row.status ?? '').trim(), plan_id: row.plan_id ?? '' })
      }
      from = addDays(to, 1)
    }
    return { rows }
  }, (value) => Boolean(value.error))
}

/** Medication courses with their start and end dates: the dates a change could confound a lab. */
export async function loadCourses(config: Config): Promise<{ rows: CourseRow[]; error?: string }> {
  if (!config.mcpUrl.trim()) return { rows: [], error: 'mcpUrl is not set' }
  return cached(cacheKey(config, 'courses'), async () => {
    const call = await readTool(config, 'query_medications', { ...memberArgs(config.member), view: 'history' }, [config.mcpToken, config.mcpUrl])
    if (call.kind !== 'ok') return { rows: [], error: call.error || 'course history read failed' }
    const table = tableOf(call.payload)
    if (table?.error) return { rows: [], error: `${table.error.kind}: ${table.error.message}` }
    return {
      rows: (table?.rows ?? []).filter((row) => row.medication).map((row) => ({
        medication: row.medication ?? '',
        start: row.start ?? '',
        end: row.end ?? '',
        closed_by: row.closed_by ?? '',
        plan_id: row.plan_id ?? '',
      })),
    }
  }, (value) => Boolean(value.error))
}
