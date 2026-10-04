import { process } from '../../sys/process.ts'
import { Buffer } from '../../sys/buffer.ts'
// M12 deep analysis: runs of the longevity-analyst skill and the one imported result.
//
// A run is a folder under ~/longpi/analyses/<id> (data/ + ws/). The skill runs in a dsh session (it asks for
// approvals and dispatches its own subagents there); LongPi only prepares the run, shows its stage progress read
// from the workspace, and imports deliver/la-export.json when the report is done.
// The export is written by an LLM-driven pipeline, so it is checked like any outside file: the workspace is the
// run's own real folder, every file is a regular file read once, every element has the expected shape, and the
// report is stripped of every link before it is stored.

import { createHash, randomBytes } from '../../sys/crypto.ts'
import {
  existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, symlinkSync,
  writeFileSync, chmodSync,
} from '../../sys/fs.ts'
import { homedir } from '../../sys/os.ts'
import { join } from '../../sys/path.ts'
import { appendJsonl, readJsonl, writeJsonAtomic } from '../core/store.ts'

export const EXPORT_SCHEMA = 'la-export/1'
const EXPORT_CAP = 8 * 1024 * 1024
const REPORT_CAP = 24 * 1024 * 1024
/** A run with no progress for this long is shown as stopped, not as running, so it never locks the page. */
export const STALE_MS = 6 * 60 * 60 * 1000
export const STAGES = ['intake', 'preflight', 'pipelines', 'methods', 'integrate', 'organs', 'insights', 'intervene', 'twin', 'review', 'report'] as const
export const STAGE_ZH: Record<string, string> = {
  intake: '整理数据', preflight: '检查电脑', pipelines: '测序流程', methods: '计算读数', integrate: '分系统解读',
  organs: '器官体检表', insights: '洞见与问题看板', intervene: '干预方案', twin: '数字孪生', review: '独立审查', report: '生成报告',
}

export interface AnalysisRun {
  id: string
  started_at: string
  root: string
  data_dir: string
  workspace: string
  mirobody: boolean
  member_folder?: string | null
  /** Who decided to run: the AI on its own reading of the facts, or the member asking. */
  trigger?: 'ai' | 'member'
  reason_zh?: string
}

export interface ImportedMeta {
  run_id: string
  imported_at: string
  generation: string
  report_sha256: string
  plan_accepted_version: number | null
}

export function analysesRoot(): string {
  return process.env.LONGPI_ANALYSES_HOME || join(homedir(), 'longpi', 'analyses')
}

function dirOf(dataDir: string): string {
  const d = join(dataDir, 'analysis')
  mkdirSync(d, { recursive: true, mode: 0o700 })
  return d
}

function abandonedIds(dataDir: string): Set<string> {
  return new Set(readJsonl<{ id: string }>(join(dirOf(dataDir), 'abandoned.jsonl'), (raw) => {
    const r = raw as { id?: unknown }
    return r && typeof r.id === 'string' ? { id: r.id } : null
  }).map((r) => r.id))
}

export function listRuns(dataDir: string): AnalysisRun[] {
  const gone = abandonedIds(dataDir)
  return readJsonl<AnalysisRun>(join(dirOf(dataDir), 'runs.jsonl'), (raw) => {
    const r = raw as Partial<AnalysisRun>
    return r && typeof r.id === 'string' && typeof r.workspace === 'string' && typeof r.root === 'string' ? r as AnalysisRun : null
  }).filter((r) => !gone.has(r.id))
}

/** Every run folder this store knows, abandoned ones too (for deletion). */
export function allRunRoots(dataDir: string): string[] {
  return readJsonl<{ root?: unknown }>(join(dataDir, 'analysis', 'runs.jsonl')).map((r) => r && typeof r.root === 'string' ? r.root : '').filter(Boolean)
}

export function abandonRun(dataDir: string, runId: string): boolean {
  if (!listRuns(dataDir).some((r) => r.id === runId)) return false
  appendJsonl(join(dirOf(dataDir), 'abandoned.jsonl'), { id: runId, at: new Date().toISOString() })
  return true
}

export function createRun(dataDir: string, opts: { mcpUrl: string; memberFolder: string | null; now?: Date; trigger?: 'ai' | 'member'; reasonZh?: string }): AnalysisRun & { mcp_url_file: string | null } {
  const at = opts.now ?? new Date()
  const base = analysesRoot()
  mkdirSync(base, { recursive: true, mode: 0o700 })
  let id = ''
  let root = ''
  for (let tries = 0; ; tries += 1) {
    id = `a${at.toISOString().replace(/[-:TZ.]/g, '').slice(0, 17)}${randomBytes(3).toString('hex')}`
    root = join(base, id)
    try {
      mkdirSync(root, { mode: 0o700 })              // not recursive: a folder that exists is another run's
      break
    } catch (error) {
      if ((error as Error & { code?: string }).code !== 'EEXIST' || tries > 5) throw error
    }
  }
  const data = join(root, 'data')
  mkdirSync(data, { mode: 0o700 })
  if (opts.memberFolder) {
    // The member's own folder is only read: its files are linked into the run's data folder, and anything the
    // skill writes (the Mirobody pull) lands in the run folder, never in theirs.
    for (const name of readdirSync(opts.memberFolder)) {
      if (name.startsWith('.')) continue
      symlinkSync(join(opts.memberFolder, name), join(data, name))
    }
  }
  let urlFile: string | null = null
  if (opts.mcpUrl.trim()) {
    // The member's MCP URL is their secret: a 0600 file the skill reads, never a command-line argument.
    urlFile = join(root, 'mirobody_mcp_url')
    writeFileSync(urlFile, opts.mcpUrl.trim() + '\n', { mode: 0o600 })
    chmodSync(urlFile, 0o600)
  }
  const run: AnalysisRun = { id, started_at: at.toISOString(), root, data_dir: data, workspace: join(root, 'ws'), mirobody: Boolean(urlFile),
    member_folder: opts.memberFolder, trigger: opts.trigger ?? 'member', reason_zh: (opts.reasonZh ?? '').slice(0, 300) }
  appendJsonl(join(dirOf(dataDir), 'runs.jsonl'), run)
  return { ...run, mcp_url_file: urlFile }
}

export interface RunStatus {
  id: string
  started_at: string
  workspace: string
  stages: Array<{ key: string; label_zh: string; done: boolean }>
  done: number
  report_ready: boolean
  /** Still going: not finished and progress within STALE_MS. */
  active: boolean
  state_error: string | null
}

function regularFile(path: string): boolean {
  try {
    return lstatSync(path).isFile()
  } catch {
    return false
  }
}

export function runStatus(run: AnalysisRun, now: number = Date.now()): RunStatus {
  let stages: Record<string, unknown> = {}
  let error: string | null = null
  const statePath = join(run.workspace, 'state.json')
  let last = Date.parse(run.started_at) || 0
  if (regularFile(statePath) && statSync(statePath).size < EXPORT_CAP) {
    try {
      const parsed = JSON.parse(readFileSync(statePath, 'utf8')) as { stages?: unknown }
      stages = parsed && typeof parsed.stages === 'object' && parsed.stages ? parsed.stages as Record<string, unknown> : {}
      last = Math.max(last, statSync(statePath).mtimeMs)
    } catch {
      error = '无法读取工作区状态文件'
    }
  }
  const rows = STAGES.map((key) => ({ key, label_zh: STAGE_ZH[key] ?? key, done: stages[key] === 'done' }))
  const ready = stages.report === 'done' && regularFile(join(run.workspace, 'deliver', 'la-export.json'))
  return {
    id: run.id, started_at: run.started_at, workspace: run.workspace, stages: rows,
    done: rows.filter((row) => row.done).length,
    report_ready: ready,
    active: !ready && now - last < STALE_MS,
    state_error: error,
  }
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** The run's workspace, only when it is the real folder the run owns (no link out of the analyses root). */
function ownWorkspace(run: AnalysisRun): string | null {
  try {
    const expected = join(realpathSync(analysesRoot()), run.id, 'ws')
    if (lstatSync(run.workspace).isSymbolicLink()) return null
    return realpathSync(run.workspace) === expected ? expected : null
  } catch {
    return null
  }
}

/** Remove every link and every external load from the report: it is shown in LongPi and written by a pipeline. */
export function sanitizeReport(html: string): string {
  return html
    .replace(/<\s*(script|iframe|object|embed|form|noscript|template|svg|math)\b[\s\S]*?<\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|iframe|object|embed|form|noscript|template|svg|math|base|meta|link)\b[^>]*>/gi, '')
    .replace(/\s(?:href|xlink:href|src|srcset|action|formaction|poster|background|ping)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
      (all, value: string) => /^["']?#/.test(value) ? all : '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
}

// ---------------------------------------------------------------- the export

export interface ExportReadout { id: string; label_zh: string; value: unknown; unit?: string; kind?: string; group?: string; low?: number; high?: number; horizon_years?: number }
export interface ExportOrgan { organ: string; label_zh: string; measured: string[]; indices: string[]; ai_age: string | null; ai_risks: string[]; overrides: Array<{ disease: string; message_zh: string }> }
export interface ExportBoard { id: string; title_zh: string; hypothesis_zh: string; verdict: string | null; verdict_zh: string; confidence: string | null; summary_zh: string | null; next_step_zh: string | null; limitations_zh: string | null; skipped_reason_zh: string | null }
export type Executor = 'member' | 'nutritionist' | 'physician'
export interface ExportItem {
  category: string; title: string; detail: string; markers: string[]
  /** Who the analysis assigned the item to; null in an export written before the field existed. */
  executor: Executor | null
  /** The analysis's own category (diet, supplement, test, referral, …), finer than category. */
  kind: string
  evidence_grade: string | null
}
export interface LaExport {
  schema: string
  generated_at: string
  generation: string
  member: { id?: string; age?: number; sex?: string; sample_date?: string }
  report: { html: string; sha256: string }
  twin: { path: string; sha256: string } | null
  readouts: ExportReadout[]
  organs: ExportOrgan[]
  board: ExportBoard[]
  plan: { title: string; note: string; items: ExportItem[] }
  retests: Array<{ what: string; after_weeks: number; due: string }>
  boundary_zh: string
}

export const EXECUTORS: readonly Executor[] = ['member', 'nutritionist', 'physician']
/** Kinds a doctor decides whatever the executor says: a supplement is confirmed with a doctor, a test is ordered, a referral is made. */
const DOCTOR_KINDS = new Set(['supplement', 'test', 'referral'])

/**
 * Where an analysis item goes in LongPi. There is no nutritionist here, so the person carries out the member's and the
 * nutritionist's items (diet has no other executor); the physician's items and the doctor-only kinds go to the brief.
 */
export function itemRoute(item: Pick<ExportItem, 'executor' | 'kind'>): 'plan' | 'doctor' {
  return item.executor === 'physician' || DOCTOR_KINDS.has(item.kind) ? 'doctor' : 'plan'
}

export function doctorItems(value: LaExport): ExportItem[] {
  return value.plan.items.filter((item) => itemRoute(item) === 'doctor')
}

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const s = (v: unknown, max: number): string => typeof v === 'string' ? v.slice(0, max) : ''
const sOrNull = (v: unknown, max: number): string | null => typeof v === 'string' ? v.slice(0, max) : null
const strList = (v: unknown, max: number, each = 200): string[] | null =>
  Array.isArray(v) && v.length <= max && v.every((x) => typeof x === 'string') ? v.map((x) => (x as string).slice(0, each)) : null
const num = (v: unknown): number | undefined => typeof v === 'number' && Number.isFinite(v) ? v : undefined

/**
 * Check an export like any outside file and rebuild it from known fields only (anything else is dropped).
 * Returns the rebuilt value and the report bytes read once, or the problems.
 */
export function checkExport(raw: unknown, run: AnalysisRun): { value: LaExport | null; html: Buffer | null; twin: Buffer | null; problems: string[] } {
  const problems: string[] = []
  const x = isObj(raw) ? raw : {}
  if (x.schema !== EXPORT_SCHEMA) problems.push(`schema must be ${EXPORT_SCHEMA}`)
  const readouts: ExportReadout[] = []
  if (!Array.isArray(x.readouts) || x.readouts.length > 2000) problems.push('readouts must be a list of at most 2000')
  else x.readouts.forEach((r, i) => {
    if (!isObj(r) || typeof r.id !== 'string' || typeof r.label_zh !== 'string') { problems.push(`readouts[${i}] needs string id and label_zh`); return }
    const v = typeof r.value === 'number' || typeof r.value === 'string' ? r.value : null
    readouts.push({ id: r.id.slice(0, 120), label_zh: r.label_zh.slice(0, 120), value: typeof v === 'string' ? v.slice(0, 60) : v, unit: s(r.unit, 30), kind: s(r.kind, 40), group: s(r.group, 30),
      ...(num(r.low) !== undefined ? { low: num(r.low) } : {}), ...(num(r.high) !== undefined ? { high: num(r.high) } : {}),
      ...(num(r.horizon_years) !== undefined ? { horizon_years: num(r.horizon_years) } : {}) })
  })
  const organs: ExportOrgan[] = []
  if (!Array.isArray(x.organs) || x.organs.length > 40) problems.push('organs must be a list of at most 40')
  else x.organs.forEach((o, i) => {
    const measured = isObj(o) ? strList(o.measured, 50) : null
    const indices = isObj(o) ? strList(o.indices, 50) : null
    const risks = isObj(o) ? strList(o.ai_risks, 50) : null
    const overrides = isObj(o) && Array.isArray(o.overrides) ? o.overrides : []
    if (!isObj(o) || typeof o.organ !== 'string' || typeof o.label_zh !== 'string' || !measured || !indices || !risks
        || !(o.ai_age === null || o.ai_age === undefined || typeof o.ai_age === 'string')
        || !overrides.every((v) => isObj(v) && typeof v.disease === 'string' && typeof v.message_zh === 'string')) {
      problems.push(`organs[${i}] has the wrong shape`); return
    }
    organs.push({ organ: o.organ.slice(0, 40), label_zh: o.label_zh.slice(0, 40), measured, indices, ai_age: typeof o.ai_age === 'string' ? o.ai_age : null, ai_risks: risks,
      overrides: (overrides as Array<Record<string, string>>).slice(0, 10).map((v) => ({ disease: String(v.disease).slice(0, 60), message_zh: String(v.message_zh).slice(0, 300) })) })
  })
  const board: ExportBoard[] = []
  if (!Array.isArray(x.board) || x.board.length > 10) problems.push('the board must be a list of at most 10 questions')
  else x.board.forEach((b, i) => {
    if (!isObj(b) || typeof b.id !== 'string' || typeof b.title_zh !== 'string' || typeof b.verdict_zh !== 'string') { problems.push(`board[${i}] has the wrong shape`); return }
    board.push({ id: b.id.slice(0, 8), title_zh: b.title_zh.slice(0, 200), hypothesis_zh: s(b.hypothesis_zh, 400), verdict: sOrNull(b.verdict, 20), verdict_zh: b.verdict_zh.slice(0, 20),
      confidence: sOrNull(b.confidence, 20), summary_zh: sOrNull(b.summary_zh, 1200), next_step_zh: sOrNull(b.next_step_zh, 400),
      limitations_zh: sOrNull(b.limitations_zh, 600), skipped_reason_zh: sOrNull(b.skipped_reason_zh, 300) })
  })
  const items: ExportItem[] = []
  const plan = isObj(x.plan) ? x.plan : null
  if (!plan || !Array.isArray(plan.items) || plan.items.length > 30) problems.push('plan.items must be a list of at most 30')
  else plan.items.forEach((it, i) => {
    const markers = isObj(it) ? strList(it.markers, 12, 60) : null
    if (!isObj(it) || typeof it.title !== 'string' || !it.title.trim() || !markers) { problems.push(`plan.items[${i}] has the wrong shape`); return }
    if (it.executor !== undefined && it.executor !== null && !EXECUTORS.includes(it.executor as Executor)) { problems.push(`plan.items[${i}].executor must be one of ${EXECUTORS.join(', ')}`); return }
    items.push({ category: s(it.category, 20), title: it.title.slice(0, 60), detail: s(it.detail, 300), markers,
      executor: (it.executor as Executor | undefined) ?? null, kind: s(it.kind, 20), evidence_grade: sOrNull(it.evidence_grade, 20) })
  })
  const retests = Array.isArray(x.retests) ? x.retests.filter(isObj).slice(0, 30).map((r) => ({ what: s(r.what, 120), after_weeks: num(r.after_weeks) ?? 0, due: s(r.due, 10) })) : []
  const report = isObj(x.report) ? x.report : null
  let html: Buffer | null = null
  const ws = ownWorkspace(run)
  const path = report ? s(report.html, 4096) : ''
  if (!ws) problems.push('the run workspace is not the run\'s own folder')
  else if (path !== join(ws, 'deliver', 'report.html') && path !== join(run.workspace, 'deliver', 'report.html')) problems.push('report.html must be the run workspace\'s deliver/report.html')
  else {
    const real = join(ws, 'deliver', 'report.html')
    if (!regularFile(real)) problems.push('report.html is not a regular file')
    else if (statSync(real).size > REPORT_CAP) problems.push('report.html is too large')
    else {
      html = readFileSync(real)                                   // read once: the hash and the stored copy are the same bytes
      if (!report || sha256(html) !== report.sha256) problems.push('report.html changed after the report was written')
    }
  }
  // The twin is optional; one the export names must be the run's own work/twin/twin.json, unchanged since.
  let twin: Buffer | null = null
  const twinRef = isObj(x.twin) ? x.twin : null
  const twinPath = twinRef ? s(twinRef.path, 4096) : ''
  if (twinRef && ws) {
    const real = join(ws, 'work', 'twin', 'twin.json')
    if (twinPath !== real && twinPath !== join(run.workspace, 'work', 'twin', 'twin.json')) problems.push('twin.json must be the run workspace\'s work/twin/twin.json')
    else if (!regularFile(real)) problems.push('twin.json is not a regular file')
    else if (statSync(real).size > EXPORT_CAP) problems.push('twin.json is too large')
    else {
      twin = readFileSync(real)
      if (sha256(twin) !== twinRef.sha256) problems.push('twin.json changed after the report was written')
    }
  }
  if (problems.length) return { value: null, html: null, twin: null, problems }
  const member = isObj(x.member) ? x.member : {}
  return {
    value: {
      schema: EXPORT_SCHEMA, generated_at: s(x.generated_at, 40), generation: s(x.generation, 80),
      member: { ...(typeof member.id === 'string' ? { id: member.id.slice(0, 40) } : {}), ...(num(member.age) !== undefined ? { age: num(member.age) } : {}), sex: s(member.sex, 10), sample_date: s(member.sample_date, 10) },
      report: { html: path, sha256: s(report?.sha256, 64) },
      twin: twin && twinRef ? { path: twinPath, sha256: s(twinRef.sha256, 64) } : null,
      readouts, organs, board,
      plan: { title: s(plan?.title, 60) || '深度分析干预方案', note: s(plan?.note, 500), items }, retests, boundary_zh: s(x.boundary_zh, 300),
    },
    html, twin, problems: [],
  }
}

export function readExport(run: AnalysisRun): { value: LaExport | null; html: Buffer | null; twin: Buffer | null; problems: string[] } {
  const ws = ownWorkspace(run)
  if (!ws) return { value: null, html: null, twin: null, problems: ['the run workspace is not the run\'s own folder'] }
  const path = join(ws, 'deliver', 'la-export.json')
  if (!regularFile(path)) return { value: null, html: null, twin: null, problems: ['the report is not done yet (deliver/la-export.json is missing)'] }
  if (statSync(path).size > EXPORT_CAP) return { value: null, html: null, twin: null, problems: ['la-export.json is too large'] }
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return { value: null, html: null, twin: null, problems: ['la-export.json is not JSON'] }
  }
  return checkExport(raw, run)
}

/** What the previous imported analysis left for a comparison: its twin and when it was imported. */
export interface PreviousTwin { run_id: string; imported_at: string; sample_date: string | null }

/**
 * Replace the imported result in one step: a new folder is written whole, then swapped in.
 * The twin of the analysis being replaced is kept beside the new one (prev-twin.json), so the two can be compared;
 * importing the same run again keeps the earlier pair.
 */
export function importRun(dataDir: string, run: AnalysisRun, value: LaExport, html: Buffer, now: Date = new Date(), twin: Buffer | null = null): ImportedMeta {
  const dir = dirOf(dataDir)
  const previous = currentImport(dataDir)
  const same = previous && previous.meta.run_id === run.id && previous.meta.report_sha256 === value.report.sha256
  const meta: ImportedMeta = { run_id: run.id, imported_at: now.toISOString(), generation: value.generation, report_sha256: value.report.sha256,
    plan_accepted_version: same ? previous.meta.plan_accepted_version : null }
  const next = join(dir, `current.next-${process.pid}-${Date.now()}`)
  mkdirSync(next, { mode: 0o700 })
  writeFileSync(join(next, 'report.html'), sanitizeReport(html.toString('utf8')), { mode: 0o600 })
  writeJsonAtomic(join(next, 'la-export.json'), value)
  writeJsonAtomic(join(next, 'meta.json'), meta)
  const cur = join(dir, 'current')
  if (twin) writeFileSync(join(next, 'twin.json'), twin, { mode: 0o600 })
  if (previous && previous.meta.run_id !== run.id && regularFile(join(cur, 'twin.json'))) {
    writeFileSync(join(next, 'prev-twin.json'), readFileSync(join(cur, 'twin.json')), { mode: 0o600 })
    const prev: PreviousTwin = { run_id: previous.meta.run_id, imported_at: previous.meta.imported_at, sample_date: previous.value.member?.sample_date || null }
    writeJsonAtomic(join(next, 'prev-meta.json'), prev)
  } else if (previous && previous.meta.run_id === run.id) {
    for (const name of ['prev-twin.json', 'prev-meta.json', 'twin-compare.json']) {
      if (regularFile(join(cur, name))) writeFileSync(join(next, name), readFileSync(join(cur, name)), { mode: 0o600 })
    }
  }
  const old = join(dir, `current.old-${process.pid}-${Date.now()}`)
  if (existsSync(cur)) renameSync(cur, old)
  renameSync(next, cur)
  rmSync(old, { recursive: true, force: true })
  appendJsonl(join(dir, 'imports.jsonl'), meta)
  const urlFile = join(run.root, 'mirobody_mcp_url')              // not needed once the result is in
  if (existsSync(urlFile)) writeFileSync(urlFile, '', { mode: 0o600 })
  return meta
}

export function currentImport(dataDir: string): { meta: ImportedMeta; value: LaExport } | null {
  const dir = join(dataDir, 'analysis', 'current')
  try {
    const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as ImportedMeta
    const value = JSON.parse(readFileSync(join(dir, 'la-export.json'), 'utf8')) as LaExport
    return { meta, value }
  } catch {
    return null
  }
}

export function markPlanAccepted(dataDir: string, version: number): void {
  const cur = currentImport(dataDir)
  if (!cur) return
  writeJsonAtomic(join(dataDir, 'analysis', 'current', 'meta.json'), { ...cur.meta, plan_accepted_version: version })
}

export function currentReportHtml(dataDir: string): string | null {
  const path = join(dataDir, 'analysis', 'current', 'report.html')
  return regularFile(path) ? readFileSync(path, 'utf8') : null
}

/**
 * The plan in the shape save_intervention_plan / normalizePlan take, marked as coming from the analysis. Items carry
 * no id: normalizePlan continues an item by its title or gives it a new id, so one analysis's check-ins never land on
 * another analysis's item. Items for a doctor are left out (doctorItems).
 */
export function planInput(value: LaExport, today: string): Record<string, unknown> {
  return {
    title: value.plan.title || '深度分析干预方案',
    source: 'analysis',
    note: value.plan.note,
    items: value.plan.items.filter((item) => itemRoute(item) === 'plan')
      .map((item) => ({ category: item.category, title: item.title, detail: item.detail, start: today, markers: item.markers })),
    goals: [],
  }
}

/** The previous analysis's twin beside the current one, when there is a pair to compare. */
export function twinPair(dataDir: string): { prev: string; cur: string; previous: PreviousTwin } | null {
  const dir = join(dataDir, 'analysis', 'current')
  const prev = join(dir, 'prev-twin.json')
  const cur = join(dir, 'twin.json')
  if (!regularFile(prev) || !regularFile(cur)) return null
  try {
    const previous = JSON.parse(readFileSync(join(dir, 'prev-meta.json'), 'utf8')) as PreviousTwin
    return typeof previous?.run_id === 'string' ? { prev, cur, previous } : null
  } catch {
    return null
  }
}

export function writeTwinCompare(dataDir: string, value: unknown): void {
  writeJsonAtomic(join(dataDir, 'analysis', 'current', 'twin-compare.json'), value)
}

export function readTwinCompare(dataDir: string): unknown {
  const path = join(dataDir, 'analysis', 'current', 'twin-compare.json')
  if (!regularFile(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}


/** The member's omics folder, remembered from the first run that named it, so later runs and the readiness check use it. */
export function registeredFolder(dataDir: string): string | null {
  try {
    const v = JSON.parse(readFileSync(join(dataDir, 'analysis', 'folder.json'), 'utf8')) as { path?: unknown }
    return typeof v.path === 'string' && v.path ? v.path : null
  } catch {
    return null
  }
}

export function registerFolder(dataDir: string, path: string): void {
  writeJsonAtomic(join(dirOf(dataDir), 'folder.json'), { path, at: new Date().toISOString() })
}

/** Newest modification date (YYYY-MM-DD) of the files directly in a folder, or null. */
export function newestFileDate(folder: string | null): string | null {
  if (!folder) return null
  try {
    let newest = 0
    for (const name of readdirSync(folder)) {
      if (name.startsWith('.')) continue
      try {
        newest = Math.max(newest, statSync(join(folder, name)).mtimeMs)
      } catch {
        /* a broken link */
      }
    }
    return newest ? new Date(newest).toISOString().slice(0, 10) : null
  } catch {
    return null
  }
}
