import { Buffer } from '../../sys/buffer.ts'
// HTTP for the Codex (长寿图鉴) and the prompt slot. guardRoute is applied by boot, so these handlers assume the
// request is already allowed.

import type { IncomingMessage, ServerResponse } from '../../sys/http.ts'
import { calendarEvents, confirmEvent, listEvents, saveEvent, suggestEvent } from '../ux/schedule.ts'
import { loadLibrary, setExtraStudies } from './data.ts'
import { literatureChapter, readLiterature } from './literature.ts'
import { actCodex, boundRootDir, kickRefresh, syncCodex, type CodexAction } from './engine.ts'
import { readState } from './state.ts'
import { isoDay } from '../interventions.ts'

type Handler = (req: IncomingMessage, res: ServerResponse) => void

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.writableEnded) return
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage, limit = 8000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw.trim()) { resolve({}); return }
      try { resolve(JSON.parse(raw) as unknown) } catch { reject(new Error('json')) }
    })
    req.on('error', reject)
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const str = (value: unknown): string => typeof value === 'string' ? value.slice(0, 80) : ''
const bool = (value: unknown): boolean | undefined => typeof value === 'boolean' ? value : undefined
const clock = (value: unknown): { start?: string; end?: string } | undefined => isRecord(value) ? { start: str(value.start), end: str(value.end) } : undefined
const mode = (value: unknown): '8w' | 'retest' | undefined => value === '8w' || value === 'retest' ? value : undefined

/** The request body as one Codex action, or null. */
export function parseAction(body: unknown): CodexAction | null {
  const row = isRecord(body) ? body : {}
  switch (row.action) {
    case 'start': return { action: 'start', my_day: clock(row.my_day), season_mode: mode(row.season_mode), standup: bool(row.standup) }
    case 'prefs': return { action: 'prefs', simple: bool(row.simple), presentation: bool(row.presentation), my_day: clock(row.my_day), season_mode: mode(row.season_mode), standup: bool(row.standup), codex: bool(row.codex) }
    case 'open_pack': return { action: 'open_pack', pack_id: str(row.pack_id) }
    case 'begin': {
      const answers: Record<string, boolean> = {}
      if (isRecord(row.answers)) for (const [key, value] of Object.entries(row.answers)) if (typeof value === 'boolean') answers[key.slice(0, 40)] = value
      return { action: 'begin', experiment_id: str(row.experiment_id), pack_id: str(row.pack_id) || undefined, answers, randomized: row.randomized === true }
    }
    case 'checkin': return { action: 'checkin', run_id: str(row.run_id), done: row.done !== false }
    case 'reveal': return { action: 'reveal', run_id: str(row.run_id) }
    case 'stop': return { action: 'stop', run_id: str(row.run_id) }
    case 'read': return { action: 'read', card_id: str(row.card_id) }
    case 'next_season': return { action: 'next_season' }
    case 'nudge': {
      const event = row.event
      if (event !== 'shown' && event !== 'ok' && event !== 'dismiss_today' && event !== 'reveal_shown' && event !== 'reveal_later' && event !== 'reveal_open') return null
      return { action: 'nudge', event, ref: str(row.ref) || undefined }
    }
    default: return null
  }
}

/** The library with what this person has read, the species met, and 「和你的关系」 where there is something real to say. */
setExtraStudies(() => readLiterature(boundRootDir()))

export function libraryView(now: Date = new Date()) {
  const shipped = loadLibrary()
  const root = boundRootDir()
  const fresh = readLiterature(root)
  const chapter = literatureChapter(fresh)
  const lib = { ...shipped, chapters: chapter ? [chapter, ...shipped.chapters] : shipped.chapters, studies: [...fresh, ...shipped.studies] }
  const state = root ? readState(root, now, isoDay(now)) : null
  const results = new Map((state?.context.method_results ?? []).map((row) => [row.skill, row.text_zh]))
  return {
    ok: true,
    revision: lib.library.revision,
    note_zh: '颜色表示研究是怎么做的，不表示和你多相关。长寿领域的人体随机试验本来就少。',
    chapters: lib.chapters,
    species: lib.species.map((row) => ({ ...row, met: Boolean(state?.met[row.key]) })),
    pending: lib.pending.length,
    studies: lib.studies.map((card) => {
      const risk = state?.context.results.risk
      // A model that does not apply to this person says so instead of claiming a link (China-PAR outside 35–74).
      const unfit = card.skill.startsWith('china-par') && risk && !risk.applicable ? risk.reason_zh : null
      const relation = card.research_assay ? null : (unfit ?? results.get(card.skill) ?? card.feature_zh ?? null)
      return { ...card, read: Boolean(state?.read[card.id]), relation_zh: relation }
    }),
  }
}

export function mountEngageRoutes(register: (path: string, handler: Handler) => void, _dataDir: () => string): void {
  const fail = (res: ServerResponse, error: unknown) => {
    const json = error instanceof Error && error.message === 'json'
    sendJson(res, json ? 400 : 500, { ok: false, error: json ? '请求不是 JSON。' : '暂时无法读取长寿图鉴，请重试。' })
  }

  register('/api/longpi/codex', (req, res) => {
    const method = (req.method ?? 'GET').toUpperCase()
    if (method === 'GET') {
      try { sendJson(res, 200, syncCodex()) } catch (error) { fail(res, error) }
      return
    }
    if (method !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 GET 或 POST。' }); return }
    void readBody(req).then((body) => {
      const action = parseAction(body)
      if (!action) { sendJson(res, 400, { ok: false, error: 'action 不能识别。' }); return }
      const result = actCodex(action)
      sendJson(res, result.ok ? 200 : 400, result)
    }).catch((error) => fail(res, error))
  })

  register('/api/longpi/codex/library', (req, res) => {
    if ((req.method ?? '').toUpperCase() !== 'GET') { sendJson(res, 405, { ok: false, error: '只接受 GET。' }); return }
    try { sendJson(res, 200, libraryView()) } catch (error) { fail(res, error) }
  })

  /** What the prompt slot and the right pane may show now: cheap, polled by the client. */
  register('/api/longpi/codex/slot', (req, res) => {
    if ((req.method ?? '').toUpperCase() !== 'GET') { sendJson(res, 405, { ok: false, error: '只接受 GET。' }); return }
    try {
      const view = syncCodex()
      if (view.enabled && view.started) kickRefresh()
      sendJson(res, 200, { ok: true, enabled: view.enabled && view.started, slot: view.slot, pane_zh: view.pane_zh, pane_neutral_zh: view.pane_neutral_zh, presentation: view.prefs.presentation, ready: view.ready.length + view.packs.filter((pack) => pack.kind === 'retest').length })
    } catch (error) { fail(res, error) }
  })

  register('/api/longpi/schedule', (req, res) => {
    const method = (req.method ?? 'GET').toUpperCase()
    if (method === 'GET') {
      try {
        const rows = listEvents(_dataDir())
        sendJson(res, 200, { ok: true, suggestions: rows.filter((row) => !row.confirmed), events: rows.filter((row) => row.confirmed) })
      } catch (error) { fail(res, error) }
      return
    }
    if (method !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 GET 或 POST。' }); return }
    void readBody(req).then((body) => {
      const row = isRecord(body) ? body : {}
      const kind = row.kind === 'visit' || row.kind === 'retest' || row.kind === 'followup' ? row.kind : 'visit'
      const date = typeof row.date === 'string' ? row.date.slice(0, 10) : ''
      const title = typeof row.title_zh === 'string' ? row.title_zh : ''
      if (!date || !title) { sendJson(res, 400, { ok: false, error: '需要日期和标题。' }); return }
      const draft = suggestEvent({
        date,
        kind,
        title_zh: title,
        brief_zh: typeof row.brief_zh === 'string' ? row.brief_zh : '',
        questions_zh: Array.isArray(row.questions_zh) ? row.questions_zh.filter((item) => typeof item === 'string') : [],
        ...(typeof row.id === 'string' ? { id: row.id } : {}),
      })
      const saved = row.confirm === true ? saveEvent(_dataDir(), confirmEvent(draft)) : saveEvent(_dataDir(), draft)
      sendJson(res, 200, { ok: true, event: saved, events: calendarEvents(_dataDir()) })
    }).catch((error) => fail(res, error))
  })
}
