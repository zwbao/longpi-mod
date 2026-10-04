import { Buffer } from '../../sys/buffer.ts'
// A checkup file dropped in chat, or chosen on the page, goes to Mirobody's upload socket
// (the same frames as reports/ingest.py upload_pdf). Narrative sentences are kept here.
// A WeGene narrative PDF is not sent: it is summarised locally. A raw WeGene export is sent as text/plain.

import { createHash, randomUUID } from '../../sys/crypto.ts'
import { spawnSync } from '../../sys/child_process.ts'
import { readFileSync, statSync } from '../../sys/fs.ts'
import { extname, join } from '../../sys/path.ts'
import type { CoreDeps } from '../contracts/index.ts'
import { readConnection } from '../connection.ts'
import { resolveRootDir } from '../paths.ts'
import { activePerson } from '../people/store.ts'
import { appendJsonl, newId, readJsonl } from '../core/store.ts'
import type { StoreKind } from '../contracts/library.ts'
import { confirmMessage, parseReport, saveReportText, storeLabel, storeReadBack } from '../stores/index.ts'
import type { StoreSummary } from '../stores/summary.ts'
import { judgeIdentity } from './identity.ts'
import { extractGeneticsPdf, extractGeneticsText, isWeGeneNarrative, isWeGeneRaw, RAW_MARKER, storeGenetics, type GeneticsSummary } from './genetics.ts'
import { listFindings, parseNarrative, storeFindings, textFingerprint, type NarrativeFinding } from './narrative.ts'
import { parseLabMethod, rememberLabMethod } from '../science/labmeta.ts'

const LAB_CAP_BYTES = 32 * 1024 * 1024
const PAGE_CAP = 40
const CHUNK = 256 * 1024

export interface IngestResult {
  ok: boolean
  forwarded: boolean
  duplicate: boolean
  wrong_person: boolean
  checkup_day: string | null
  indicators: number | null
  findings: Array<Pick<NarrativeFinding, 'id' | 'kind' | 'text_zh' | 'date' | 'grade'>>
  read_back_zh: string
  progress: string[]
  genetics_stored: boolean
  /** Set when a typed store was offered or written. Counts only: the raw matrix stays on disk. */
  stores?: StoreSummary[]
  needs_confirm?: boolean
  error?: string
}

interface UploadLog {
  id: string
  at: string
  filename: string
  sha256: string
  fingerprint: string
  bytes: number
  checkup_day: string | null
  forwarded: boolean
  /** True only after Mirobody accepted the file, or a local-only success (WeGene narrative, pasted findings). A failed push is not written. */
  accepted?: boolean
  duplicate_of?: string
  wrong_person?: boolean
  /** How many lab values the service read from it (absent in logs written before 0.7.1). */
  indicators?: number | null
}

function keptUpload(row: UploadLog): boolean {
  if (row.wrong_person) return false
  // A file the service received but could not read (or read as nothing) can be sent again: not a duplicate.
  if (row.forwarded === true && !((row.indicators ?? 0) > 0)) return false
  return row.forwarded === true || row.accepted === true
}

function logPath(dataDir: string): string {
  return join(dataDir, 'datain', 'uploads.jsonl')
}

function readLog(dataDir: string): UploadLog[] {
  return readJsonl(logPath(dataDir), (raw) => {
    if (!raw || typeof raw !== 'object') return null
    const row = raw as Partial<UploadLog>
    if (typeof row.id !== 'string') return null
    return row as UploadLog
  })
}

function publicFinding(row: NarrativeFinding): IngestResult['findings'][number] {
  return { id: row.id, kind: row.kind, text_zh: row.text_zh, date: row.date, ...(row.grade ? { grade: row.grade } : {}) }
}

export function contentTypeOf(filename: string): string {
  const ext = extname(filename).toLowerCase()
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.txt' || ext === '.csv' || ext === '.tsv' || ext === '.json') return 'text/plain'
  return 'application/octet-stream'
}

export function pdfPageCount(path: string): number | null {
  const run = spawnSync('pdfinfo', [path], { encoding: 'utf8', timeout: 15_000 })
  const match = /Pages:\s+(\d+)/.exec(run.stdout || '')
  return match ? Number(match[1]) : null
}

export function pdfText(path: string, lastPage = PAGE_CAP): string {
  const run = spawnSync('pdftotext', ['-f', '1', '-l', String(lastPage), '-layout', path, '-'], { encoding: 'utf8', timeout: 20_000, maxBuffer: 4_000_000 })
  return run.status === 0 ? run.stdout : ''
}

interface SocketLike {
  send(data: string): void
  close(): void
}

export interface SocketHandlers {
  onopen: () => void
  onmessage: (data: string) => void
  onerror: (error: unknown) => void
}

export type SocketOpener = (url: string, handlers: SocketHandlers) => SocketLike

function browserSocket(url: string, handlers: SocketHandlers): SocketLike {
  const ws = new WebSocket(url)
  ws.addEventListener('open', () => handlers.onopen())
  ws.addEventListener('message', (event: { data?: unknown }) => handlers.onmessage(typeof event.data === 'string' ? event.data : ''))
  ws.addEventListener('error', () => handlers.onerror(new Error('websocket failed')))
  return { send: (data) => ws.send(data), close: () => ws.close() }
}

export interface MirobodyPush {
  events: string[]
  progress: string[]
  last: Record<string, unknown>
  indicators: number | null
  checkup_day: string | null
  failed: boolean
  /** The file arrived but reading it did not: no model is configured in the service, or its call failed. */
  extraction_failed: boolean
}

/** The upload socket Mirobody's file router speaks. `open` is injectable for tests. */
export async function pushToMirobody(opts: {
  origin: string
  token: string
  filename: string
  bytes: Buffer
  contentType: string
  note?: string
  deadlineMs?: number
  open?: SocketOpener
  /** A family member's Mirobody id: the holder's token uploads into their record (Mirobody checks write access). */
  queryUserId?: string
}): Promise<MirobodyPush> {
  const messageId = randomUUID()
  const sessionId = randomUUID()
  const total = Math.max(1, Math.ceil(opts.bytes.length / CHUNK))
  const progress: string[] = []
  const events: string[] = []
  const url = `${opts.origin.replace(/^http/, 'ws')}/ws/upload-health-report?token=${encodeURIComponent(opts.token)}`
  const deadline = opts.deadlineMs ?? 90_000
  const opener = opts.open ?? browserSocket
  return new Promise((resolve) => {
    let sock: SocketLike | null = null
    let settled = false
    const finish = (last: Record<string, unknown>, failed: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearInterval(ping)
      try { sock?.close() } catch { /* already closed */ }
      const report = typeof last.report_date === 'string' ? last.report_date.slice(0, 10) : null
      const count = typeof last.indicators_count === 'number' ? last.indicators_count : null
      resolve({
        events, progress, last, failed,
        // Mirobody says so on extraction_completed (failed: true): never shown as「0 项」.
        extraction_failed: last.type === 'extraction_completed' && last.failed === true,
        indicators: count,
        checkup_day: report && /^\d{4}-\d{2}-\d{2}$/.test(report) ? report : null,
      })
    }
    const timer = setTimeout(() => finish({ type: 'timeout' }, false), deadline)
    const ping = setInterval(() => {
      try { sock?.send(JSON.stringify({ type: 'ping', messageId })) } catch { /* closed */ }
    }, 10_000)
    sock = opener(url, {
      onopen: () => {
        progress.push('开始上传')
        sock?.send(JSON.stringify({
          type: 'upload_start',
          messageId,
          sessionId,
          query: opts.note || 'LongPi checkup upload',
          isFirstMessage: false,
          files: [{ filename: opts.filename, contentType: opts.contentType, size: opts.bytes.length }],
          ...(opts.queryUserId ? { query_user_id: opts.queryUserId } : {}),
        }))
        for (let index = 0; index < total; index += 1) {
          const piece = opts.bytes.subarray(index * CHUNK, (index + 1) * CHUNK)
          sock?.send(JSON.stringify({
            type: 'upload_chunk',
            messageId,
            filename: opts.filename,
            chunk: piece.toString('base64'),
            chunkIndex: index,
            totalChunks: total,
            contentType: opts.contentType,
            fileSize: opts.bytes.length,
          }))
          progress.push(`已上传 ${index + 1}/${total}`)
        }
        progress.push('文件已上传，等待解析')
      },
      onmessage: (data) => {
        let msg: Record<string, unknown> = {}
        try { msg = JSON.parse(data) as Record<string, unknown> } catch { return }
        const type = typeof msg.type === 'string' ? msg.type : ''
        if (type) events.push(type)
        if (type === 'file_progress' && typeof msg.progress === 'number') progress.push(`上传 ${Math.round(msg.progress)}%`)
        if (type === 'extraction_completed' || type === 'upload_error' || type === 'error' || type === 'close') {
          finish(msg, type === 'upload_error' || type === 'error')
        }
      },
      onerror: () => finish({ type: 'upload_error', message: '无法连接健康数据服务' }, true),
    })
  })
}

function originOf(mcpUrl: string): string | null {
  try {
    const url = new URL(mcpUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}

/** 「9 月 10 日」, with the year when it is not this year. */
function dayZhU(iso: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return iso ?? ''
  const md = `${Number(m[2])} 月 ${Number(m[3])} 日`
  return Number(m[1]) === new Date().getFullYear() ? md : `${m[1]} 年 ${md}`
}

function readBack(parts: { forwarded: boolean; connected: boolean; indicators: number | null; day: string | null; findings: NarrativeFinding[]; duplicate: boolean; wrong: string; genetics: 'narrative' | 'raw' | null }): string {
  if (parts.wrong) return parts.wrong
  if (parts.duplicate) return `该报告此前已上传${parts.day ? `（检查日期：${dayZhU(parts.day)}）` : ''}，未重复保存。`
  const lines: string[] = []
  if (parts.genetics === 'raw' && parts.forwarded) lines.push('基因原始数据已上传，位点以健康数据服务中保存的数据为准，无需再上传叙述版 PDF。')
  else if (parts.genetics) lines.push('基因叙述报告未进入体检解析；关键位点已保存在本机，并标注了消费级检测的局限。如需完整位点，请上传基因原始数据文件。')
  else if (!parts.connected) lines.push('报告中的文字内容已保存。健康数据服务尚未连接，文件本身未上传。')
  else if (parts.forwarded) lines.push(parts.indicators == null
    ? '报告已上传，正在识别指标。'
    : parts.indicators === 0
      ? '报告已上传，但未识别出化验指标。请确认上传的是体检或化验报告；如为照片，请确保清晰、完整后重新上传。'
      : `报告已上传，识别出 ${parts.indicators} 项指标${parts.day ? `（检查日期：${dayZhU(parts.day)}）` : ''}。`)
  else lines.push('文件未上传。')
  const narrative = parts.findings.filter((row) => row.kind !== 'wrong_person').slice(0, 4).map((row) => row.text_zh)
  if (narrative.length > 0) lines.push(`报告摘要：${narrative.join(' ')}`)
  return lines.join('')
}

export interface IngestInput {
  filename: string
  bytes?: Buffer
  text?: string
  path?: string
  note?: string
  /** When false, keep the narrative locally and do not open the upload socket (pasted text). */
  upload?: boolean
  /** Tests inject a socket. Production uses the platform WebSocket. */
  open?: SocketOpener
  /** methylation, taxa, proteins, or conditions. Omitted for a checkup. */
  type?: StoreKind
  /** Page uploads send true. A chat attachment is already the person's confirmation. */
  confirm?: boolean
  sample_date?: string
  site?: 'gut' | 'oral'
  panel?: string
  lab_name?: string
  method?: string
  analyser?: string
}

export async function ingestDocument(deps: Pick<CoreDeps, 'config' | 'dataDir' | 'bus' | 'invalidate'>, input: IngestInput): Promise<IngestResult> {
  const dataDir = deps.dataDir()
  const filename = input.filename || 'report'
  let bytes = input.bytes
  let text = input.text ?? ''
  const filePath = input.path
  if (filePath && !bytes) {
    const stat = statSync(filePath)
    const pages = extname(filePath).toLowerCase() === '.pdf' ? pdfPageCount(filePath) : null
    const huge = stat.size > LAB_CAP_BYTES || (pages != null && pages > 80)
    if (huge && extname(filePath).toLowerCase() === '.pdf') {
      const summary = extractGeneticsPdf(filePath)
      const stored = storeGenetics(dataDir, summary)
      const finding = storeFindings(dataDir, [{
        id: newId('find'), date: stored.generated, kind: 'genetics',
        text_zh: stored.headlines_zh[0] || '已记录基因报告的局限及原始数据导出方法。',
      }])
      return {
        ok: true, forwarded: false, duplicate: false, wrong_person: false,
        checkup_day: stored.generated || null, indicators: null,
        findings: finding.map(publicFinding),
        read_back_zh: readBack({ forwarded: false, connected: false, indicators: null, day: stored.generated || null, findings: finding, duplicate: false, wrong: '', genetics: 'narrative' }),
        progress: [`仅读取目录附近 ${stored.pages_read} 页的文字，未上传整份报告`],
        genetics_stored: true,
      }
    }
    bytes = readFileSync(filePath)
    if (!text && extname(filePath).toLowerCase() === '.pdf') text = pdfText(filePath)
    if (!text && contentTypeOf(filePath) === 'text/plain') text = bytes.toString('utf8')
  }
  bytes = bytes ?? Buffer.from(text, 'utf8')
  if (!text && contentTypeOf(filename) === 'text/plain') text = bytes.toString('utf8')
  const sha = createHash('sha256').update(bytes).digest('hex')
  const fingerprint = textFingerprint(text)
  const prior = readLog(dataDir).find((row) => keptUpload(row) && ((sha && row.sha256 === sha) || (fingerprint && row.fingerprint === fingerprint)))
  if (prior) {
    const existing = listFindings(dataDir).filter((row) => row.upload_id === prior.id)
    return {
      ok: true, forwarded: false, duplicate: true, wrong_person: false,
      checkup_day: prior.checkup_day, indicators: null,
      findings: existing.map(publicFinding),
      read_back_zh: readBack({ forwarded: false, connected: true, indicators: null, day: prior.checkup_day, findings: existing, duplicate: true, wrong: '', genetics: null }),
      progress: ['重复文件，未再次上传'],
      genetics_stored: false,
    }
  }
  if (isWeGeneRaw(text)) {
    const summary = extractGeneticsText(text, 'raw')
    return finishForward(deps, { filename, bytes, text, sha, fingerprint, contentType: 'text/plain', note: input.note, open: input.open, upload: input.upload !== false, genetics: summary, findings: [] })
  }
  if (isWeGeneNarrative(text)) {
    const summary = storeGenetics(dataDir, extractGeneticsText(text, 'text'))
    const uploadId = newId('up')
    const finding = storeFindings(dataDir, [{ id: newId('find'), date: summary.generated, kind: 'genetics', text_zh: summary.headlines_zh[0] || '已记录基因报告。' }], uploadId)
    appendJsonl(logPath(dataDir), { id: uploadId, at: new Date().toISOString(), filename, sha256: sha, fingerprint, bytes: bytes.length, checkup_day: summary.generated || null, forwarded: false, accepted: true } satisfies UploadLog)
    return {
      ok: true, forwarded: false, duplicate: false, wrong_person: false, checkup_day: summary.generated || null, indicators: null,
      findings: finding.map(publicFinding),
      read_back_zh: readBack({ forwarded: false, connected: false, indicators: null, day: summary.generated || null, findings: finding, duplicate: false, wrong: '', genetics: 'narrative' }),
      progress: ['叙述版基因报告未上传整份文件'], genetics_stored: true,
    }
  }
  const identity = text ? judgeIdentity(text, dataDir) : { wrong_person: false, reason_zh: '', page_note_zh: '', names: [] }
  if (identity.wrong_person) {
    const row = storeFindings(dataDir, [{
      id: newId('find'), date: '', kind: 'wrong_person', text_zh: identity.reason_zh, page_note_zh: identity.page_note_zh,
    }])
    appendJsonl(logPath(dataDir), { id: newId('up'), at: new Date().toISOString(), filename, sha256: sha, fingerprint, bytes: bytes.length, checkup_day: null, forwarded: false, wrong_person: true } satisfies UploadLog)
    return {
      ok: true, forwarded: false, duplicate: false, wrong_person: true, checkup_day: null, indicators: null,
      findings: row.map((item) => ({ id: item.id, kind: item.kind, text_zh: item.text_zh, date: item.date })),
      read_back_zh: identity.reason_zh, progress: ['姓名核对未通过，未写入'], genetics_stored: false,
    }
  }
  const omics = takeOmics(deps, { filename, bytes, text, sha, fingerprint, input })
  if (omics.stop) return omics.stop
  const lab = parseLabMethod(input)
  if (lab) rememberLabMethod(dataDir, { sha256: sha, ...lab })
  const dayGuess = /(20\d{2}-\d{2}-\d{2})/.exec(text)?.[1] ?? ''
  const findings = text ? parseNarrative(text, dayGuess) : []
  const forwarded = await finishForward(deps, { filename, bytes, text, sha, fingerprint, contentType: contentTypeOf(filename), note: input.note, open: input.open, upload: input.upload !== false, genetics: null, findings })
  if (omics.note) forwarded.read_back_zh += omics.note
  if (omics.stores) forwarded.stores = omics.stores
  return forwarded
}

const MATRIX_EXT = new Set(['.csv', '.tsv', '.txt', '.json', ''])
const BINARY_EXT = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp'])

function takeOmics(deps: Pick<CoreDeps, 'dataDir'>, bag: {
  filename: string
  bytes: Buffer
  text: string
  sha: string
  fingerprint: string
  input: IngestInput
}): { stop?: IngestResult; stores?: StoreSummary[]; note?: string } {
  const { filename, text, input } = bag
  const ext = extname(filename).toLowerCase()
  const binary = BINARY_EXT.has(ext)
  const parsed = parseReport(text, {
    type: input.type,
    filename,
    sample_date: input.sample_date,
    site: input.site,
    panel: input.panel,
  })
  if (parsed.capped && input.type) {
    return { stop: localOmics(false, '文件超过 32 MB，未写入。', [], '文件超过可保存的大小上限。') }
  }
  const detected = input.type ? [input.type] : parsed.detected
  if (detected.length === 0) return {}
  const localOnly = input.type ? !binary : MATRIX_EXT.has(ext)
  if (!input.confirm) {
    if (localOnly || input.type) return { stop: localOmics(false, confirmMessage(input.type ?? detected[0]), [], confirmMessage(input.type ?? detected[0]), true) }
    const name = storeLabel(detected[0] ?? 'methylation')
    return { note: `报告中含有${name}表格，确认后才会保存在这台电脑上。` }
  }
  const saved = saveReportText(deps.dataDir(), text, {
    type: input.type,
    filename,
    sample_date: input.sample_date,
    site: input.site,
    panel: input.panel,
  })
  const stored = saved.summaries.some((row) => row.stored > 0)
  const read = storeReadBack(saved.summaries)
  if (!localOnly) return { stores: saved.summaries }
  if (stored) {
    appendJsonl(logPath(deps.dataDir()), {
      id: newId('up'), at: new Date().toISOString(), filename, sha256: bag.sha, fingerprint: bag.fingerprint,
      bytes: bag.bytes.length, checkup_day: input.sample_date ?? null, forwarded: false, accepted: true,
    } satisfies UploadLog)
  }
  return { stop: localOmics(stored, read, saved.summaries, stored ? undefined : read) }
}

function localOmics(ok: boolean, readBack: string, stores: StoreSummary[], error?: string, needsConfirm = false): IngestResult {
  return {
    ok, forwarded: false, duplicate: false, wrong_person: false, checkup_day: null, indicators: null,
    findings: [], read_back_zh: readBack, progress: [needsConfirm ? '等待确认' : '已在这台电脑上核对'],
    genetics_stored: false, stores, needs_confirm: needsConfirm, ...(error ? { error } : {}),
  }
}

async function finishForward(deps: Pick<CoreDeps, 'config' | 'dataDir' | 'bus' | 'invalidate'>, input: {
  filename: string
  bytes: Buffer
  text: string
  sha: string
  fingerprint: string
  contentType: string
  note?: string
  open?: SocketOpener
  upload: boolean
  genetics: GeneticsSummary | null
  findings: NarrativeFinding[]
}): Promise<IngestResult> {
  const dataDir = deps.dataDir()
  const config = deps.config()
  const root = resolveRootDir(config.dataDir)
  let mcpUrl = ''
  let token = ''
  let queryUserId: string | undefined
  if (dataDir === root) {
    const saved = readConnection(dataDir)
    mcpUrl = saved?.mcp_url || config.mcpUrl
    token = saved?.mcp_token || config.mcpToken
  } else {
    // A family member: never the holder's own address. The holder's token uploads into the member's record, named
    // explicitly; a member LongPi did not create in Mirobody gets no upload rather than the wrong record.
    const member = activePerson(root).person
    const holder = readConnection(root)
    if (member?.mirobody_user_id && holder?.mcp_token && holder.mcp_url) {
      mcpUrl = holder.mcp_url
      token = holder.mcp_token
      queryUserId = member.mirobody_user_id
    }
  }
  const origin = mcpUrl ? originOf(mcpUrl) : null
  const connected = Boolean(origin && token)
  let push: MirobodyPush | null = null
  if (input.upload && connected && origin && token && input.bytes.length > 0 && input.bytes.length <= LAB_CAP_BYTES) {
    push = await pushToMirobody({
      origin, token, filename: input.filename, bytes: input.bytes, contentType: input.contentType,
      note: 'LongPi checkup upload', open: input.open, ...(queryUserId ? { queryUserId } : {}),
    })
  }
  const day = push?.checkup_day || /(20\d{2}-\d{2}-\d{2})/.exec(input.text)?.[1] || null
  const uploadId = newId('up')
  const stored = storeFindings(dataDir, input.findings.map((row) => ({ ...row, date: row.date || day || '' })), uploadId)
  if (input.genetics) storeGenetics(dataDir, input.genetics)
  const extractionFailed = Boolean(push && !push.failed && push.extraction_failed)
  const forwarded = Boolean(push && !push.failed)
  // A failed push, or Mirobody not connected, must not mark the file seen. The next send is a retry, not a duplicate.
  const accepted = forwarded || Boolean(input.genetics) || (!input.upload && stored.length > 0)
  if (accepted) {
    appendJsonl(logPath(dataDir), {
      id: uploadId, at: new Date().toISOString(), filename: input.filename, sha256: input.sha, fingerprint: input.fingerprint,
      bytes: input.bytes.length, checkup_day: day, forwarded, accepted: true, indicators: extractionFailed ? 0 : push?.indicators ?? null,
    } satisfies UploadLog)
  }
  if (push && !push.failed) {
    try { deps.invalidate() } catch { /* the file is already in Mirobody */ }
  }
  if (stored.length > 0 || (push && !push.failed)) {
    try {
      deps.bus.emit('report.arrived', {
        checkup_day: day || new Date().toISOString().slice(0, 10),
        indicators: push?.indicators ?? 0,
        narrative_findings: stored.length,
        source: 'upload',
      }, { module: 'M7', via: 'tool' })
    } catch { /* the upload still stands */ }
  }
  const shown = stored.length > 0 ? stored : input.findings
  if (extractionFailed) {
    // The service has the file but no reading of it: an error the person can act on, not「识别出 0 项」.
    return {
      ok: false, forwarded: true, duplicate: false, wrong_person: false, checkup_day: day, indicators: null,
      findings: shown.map(publicFinding),
      read_back_zh: '',
      progress: push?.progress ?? [],
      genetics_stored: Boolean(input.genetics),
      error: '报告已上传，但未能识别其中的指标：健康数据服务尚未配置可用的解析模型，或模型调用失败。请在健康数据服务中配置模型 API Key（例如 DeepSeek）后，重新上传这份报告。',
    }
  }
  return {
    ok: push ? !push.failed : true,
    forwarded: Boolean(push && !push.failed),
    duplicate: false,
    wrong_person: false,
    checkup_day: day,
    indicators: push?.indicators ?? null,
    findings: shown.map(publicFinding),
    read_back_zh: readBack({
      forwarded: Boolean(push && !push.failed), connected, indicators: push?.indicators ?? null, day,
      findings: shown, duplicate: false, wrong: '', genetics: input.genetics ? (input.genetics.source === 'raw' ? 'raw' : 'narrative') : null,
    }),
    progress: push?.progress ?? (connected ? [] : ['健康数据服务尚未连接']),
    genetics_stored: Boolean(input.genetics),
    ...(push?.failed ? { error: '健康数据服务未接收该文件。' } : {}),
  }
}

export { RAW_MARKER }
