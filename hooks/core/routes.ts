import { Buffer } from '../sys/buffer.ts'
import { ensureLocalPairing, pairingProblem } from './mirobody-account.ts'
import type { IncomingMessage, ServerResponse } from '../sys/http.ts'
import type { Context } from '../sys/cordis.ts'
import { buildBoard } from './board.ts'
import { loadCatalog } from './catalog.ts'
import type { Config } from './config.ts'
import { matchSkills } from './match.ts'
import type { MountState } from './mirobody.ts'
import { clampMatches, resolveDataDir, resolveRootDir, resolveSkillsHome } from './paths.ts'
import { renewActiveMember } from './people/mirobody.ts'
import { mergeProfile, normalizeProfile, readProfile, setConsent, writeProfile } from './profile.ts'
import { loadRecords } from './records.ts'
import { readReceipts } from './runner.ts'
import { latestOutputs } from './history.ts'
import { loadEvidenceLexicon } from './intents.ts'
import { buildStats } from './stats.ts'
import { MOD_VERSION, PRODUCT_NAME, PRODUCT_VERSION } from './version.ts'
import { addCheckIns, currentPlan, isoDay, normalizePlan, savePlan } from './interventions.ts'
import { readPlanPrefs, setPlanExclusion } from './plan-prefs.ts'
import { acceptedPlan, briefOptionsOf, buildPlanBrief, settleDraft } from './planner.ts'
import { buildReport, readiness, runReady } from './overview.ts'
import { invalidateRecords } from './records.ts'
import { buildTracking, invalidateTracking } from './tracking.ts'
import { buildJourney, buildJourneyFull, followupStateOf, within } from './journey.ts'
import { followupResponse, sendNow, writeFollowup, FOLLOWUP_TEST_TEXT } from './followup.ts'
import { buildCalendar } from './calendar.ts'
import { addSelf, deleteSelf, readSelf } from './selfmeasure.ts'
import { clearConnection, connectionSource, connectionTokenProblem, connectionUrlProblem, maskMcpUrl, saveConnection, testConnection, type ConnectionSource } from './connection.ts'
import { buildIndicators, indicatorDetail, recordsSummary, type RecordsSummary } from './indicators.ts'
import { minorView } from './privacy/consents.ts'
import { stripWeightLoss } from './privacy/disclosure.ts'

/** Under 18, the page draft drops weight-loss items the same way chat drafts do. */
function pageDraftPayload<T>(dataDir: string, body: T): T {
  if (!minorView(readProfile(dataDir)).minor) return body
  return stripWeightLoss(body) as T
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.writableEnded) return
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function sendText(res: ServerResponse, status: number, text: string): void {
  if (res.writableEnded) return
  res.statusCode = status
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(text)
}

type Handler = (req: IncomingMessage, res: ServerResponse) => void

/**
 * The part of DSH's `connection` service (dsh-client-connection, HostConnectionHandle) the routes use:
 * the Host/Origin/Sec-Fetch-Site fence, then the signed `dsh-auth` cookie. 401 or 403 rejects.
 */
export interface ConnectionGuard {
  requestRejection(request: { headers: IncomingMessage['headers'] }): 401 | 403 | undefined
}

export const CONNECTION_UNAVAILABLE = 'longpi: DeepSeek Harness connection service unavailable'
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** application/json, with or without a charset or other parameters. */
export function isJsonRequest(req: Pick<IncomingMessage, 'headers'>): boolean {
  const type = req.headers['content-type']
  return typeof type === 'string' && (type.split(';', 1)[0] ?? '').trim().toLowerCase() === 'application/json'
}

/**
 * DSH's exact routes skip the /api prefix route and its checks, so every LongPi handler runs them itself,
 * before anything else: no connection service, no route (503); then DSH's own rejection; then a write
 * that is not JSON (415), which a page on another site could otherwise send without a preflight.
 */
/** Whose record the server is on now (M13); set once by the plugin. */
let activePersonNow: () => string = () => 'self'
export function setActivePersonResolver(fn: () => string): void {
  activePersonNow = fn
}

export function guardRoute(connection: () => ConnectionGuard | null, handler: Handler): Handler {
  return (req, res) => {
    const service = connection()
    if (!service) {
      sendText(res, 503, CONNECTION_UNAVAILABLE)
      return
    }
    let rejection: number | undefined
    try {
      rejection = service.requestRejection(req)
    } catch {
      rejection = 403
    }
    if (rejection !== undefined) {
      // Anything but 401 is refused as 403: an unknown answer never lets a request through.
      sendText(res, rejection === 401 ? 401 : 403, rejection === 401 ? 'unauthorized' : 'forbidden')
      return
    }
    if (WRITE_METHODS.has((req.method ?? '').toUpperCase()) && !isJsonRequest(req)) {
      sendText(res, 415, 'content type must be application/json')
      return
    }
    // A page shows one person; a write from a tab that still shows someone else (another tab switched) is refused,
    // never saved into the person the server is on now.
    const shown = req.headers['x-longpi-person']
    if (WRITE_METHODS.has((req.method ?? '').toUpperCase()) && typeof shown === 'string' && shown && !(req.url ?? '').startsWith('/api/longpi/people')) {
      let now = 'self'
      try { now = activePersonNow() } catch { now = 'self' }
      if (shown !== now) {
        sendJson(res, 409, { ok: false, error: '当前页面显示的是另一位成员的记录（已在其他页面切换）。请刷新后再操作。', person_mismatch: true })
        return
      }
    }
    handler(req, res)
  }
}

function readBody(req: IncomingMessage, limit = 8000): Promise<string> {
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
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function questionOf(url: string | undefined): string {
  return paramOf(url, 'q')
}

function paramOf(url: string | undefined, name: string): string {
  if (!url) return ''
  return new URL(url, 'http://127.0.0.1').searchParams.get(name)?.trim() ?? ''
}

/** GET /api/longpi/connection, and the answer of every connection write. */
export interface ConnectionStatus {
  source: ConnectionSource
  url_masked: string
  token_set: boolean
  status: 'ok' | 'error' | 'none'
  error?: string
  /** Why pairing with the health data service on this computer failed, when it did. */
  pairing_error?: string
  summary?: RecordsSummary
}

/** How long a connection answer waits for the record summary before leaving it out. */
const CONNECTION_SUMMARY_MS = 10_000

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

async function readJson(req: IncomingMessage, limit?: number): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const raw = await readBody(req, limit)
  try {
    return { ok: true, value: JSON.parse(raw) as unknown }
  } catch {
    return { ok: false }
  }
}

export function registerRoutes(ctx: Context, config: () => Config, mount: MountState): void {
  // DSH's connection service, read through the context that injected it: once that service goes away the
  // context is inactive and reading it throws, so every route answers 503. It never falls open.
  let lookup: (() => unknown) | null = null
  ctx.inject(['connection'], (scoped) => {
    lookup = () => (scoped as unknown as { connection?: unknown }).connection
  })
  const connection = (): ConnectionGuard | null => {
    try {
      const service = lookup?.() as Partial<ConnectionGuard> | undefined
      return service && typeof service.requestRejection === 'function' ? service as ConnectionGuard : null
    } catch {
      return null
    }
  }

  ctx.inject(['webServer'], (scoped) => {
    const web = {
      register: (route: { kind: 'exact'; path: string; handler: Handler }) => scoped.webServer.register({ ...route, handler: guardRoute(connection, route.handler) }),
    }

    web.register({
      kind: 'exact',
      path: '/api/longpi/version',
      handler: (_req, res) => sendJson(res, 200, { product: PRODUCT_NAME, version: MOD_VERSION, core: PRODUCT_VERSION }),
    })

    const context = async () => {
      const current = config()
      const dataDir = resolveDataDir(current.dataDir)
      const skillsHome = resolveSkillsHome(current.skillsHome)
      const catalog = loadCatalog(skillsHome)
      const records = await loadRecords(current, dataDir, mount.pluginHome)
      return { current, dataDir, skillsHome, catalog, records }
    }

    const journeyContext = async () => {
      const { current, dataDir, skillsHome, catalog, records } = await context()
      return { config: current, dataDir, skillsHome, catalog, records, today: isoDay(), mount }
    }

    web.register({
      kind: 'exact',
      path: '/api/longpi/journey',
      handler: (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        void (async () => {
          if (paramOf(req.url, 'refresh')) {
            invalidateRecords()
            invalidateTracking()
          }
          sendJson(res, 200, await buildJourney(await journeyContext()))
        })().catch(() => sendJson(res, 500, { ok: false, error: 'journey failed' }))
      },
    })

    const indicatorsContext = async (budgetMs?: number) => {
      const { current, dataDir, skillsHome, records } = await context()
      return { config: current, dataDir, skillsHome, records, today: isoDay(), ...(budgetMs ? { budgetMs } : {}) }
    }

    web.register({
      kind: 'exact',
      path: '/api/longpi/indicators',
      handler: (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        void (async () => {
          if (paramOf(req.url, 'refresh')) {
            invalidateRecords()
            invalidateTracking()
          }
          sendJson(res, 200, await buildIndicators(await indicatorsContext()))
        })().catch(() => sendJson(res, 500, { ok: false, error: 'indicators failed' }))
      },
    })

    web.register({
      kind: 'exact',
      path: '/api/longpi/indicators/detail',
      handler: (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        const id = paramOf(req.url, 'id')
        if (!id) {
          sendJson(res, 400, { ok: false, error: 'id is required' })
          return
        }
        void (async () => {
          const detail = await indicatorDetail(await indicatorsContext(), id)
          if (!detail) {
            sendJson(res, 404, { ok: false, error: '没有这项指标。' })
            return
          }
          sendJson(res, 200, detail)
        })().catch(() => sendJson(res, 500, { ok: false, error: 'indicator failed' }))
      },
    })

    // The Mirobody connection as the settings page shows it: where the address comes from (saved here, the
    // configuration, or none), the address with its secret part hidden, whether a token is set, whether the
    // record reads, and what it holds. The token itself is never sent back.
    const connectionBase = () => {
      const current = config()
      return { source: connectionSource(current), url_masked: maskMcpUrl(current.mcpUrl), token_set: Boolean(current.mcpToken.trim()) }
    }
    const connectionStatus = async (): Promise<ConnectionStatus> => {
      const problem = pairingProblem(resolveRootDir(config().dataDir))
      const base = { ...connectionBase(), ...(problem ? { pairing_error: problem } : {}) }
      if (base.source === 'none') return { ...base, status: 'none' }
      const input = await indicatorsContext(CONNECTION_SUMMARY_MS)
      const status = input.records.record_status as string
      if (status === 'unconfigured') return { ...base, status: 'none' }
      if (status === 'error') return { ...base, status: 'error', error: `记录读取失败：${input.records.record_error || '原因不明'}` }
      const summary = await within(recordsSummary(input), CONNECTION_SUMMARY_MS).catch(() => null)
      return { ...base, status: 'ok', ...(summary && 'value' in summary && summary.value ? { summary: summary.value } : {}) }
    }
    const connectionChanged = () => {
      invalidateRecords()
      invalidateTracking()
    }

    // 重新连接: no address, email or password from the person. LongPi pairs its own account with the health data
    // service on this computer and uses that link, replacing a link set by hand (an installer's demo account, an
    // expired link). The holder's connection only; a family member's link is renewed by people/.
    web.register({
      kind: 'exact',
      path: '/api/longpi/connection/reconnect',
      handler: (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'POST' })
          return
        }
        void (async () => {
          const current = config()
          const root = resolveRootDir(current.dataDir)
          const result = await ensureLocalPairing(root, { base: current.mirobodyUrl ?? '', configuredUrl: current.mcpUrl, force: true, reclaim: true })
          // The family member the page shows reads through a link minted with the holder's token: renew it too.
          if (result.status === 'paired' || result.status === 'renewed') await renewActiveMember(root, true).catch(() => '')
          connectionChanged()
          const status = await connectionStatus()
          if (result.status === 'error') {
            sendJson(res, 200, { ok: false, error: result.error_zh, ...status })
            return
          }
          if (result.status === 'skipped') {
            const why = result.why === 'own_login'
              ? '当前连接使用你自己登录的账号，LongPi 不会替换。如需更换，请联系安装人员。'
              : '当前连接指向其他位置的健康数据服务，由安装人员设置，LongPi 不会替换。'
            sendJson(res, 200, { ok: false, error: why, ...status })
            return
          }
          sendJson(res, 200, { ok: true, ...status })
        })().catch(() => sendJson(res, 500, { ok: false, error: '重新连接失败，请稍后重试。' }))
      },
    })

    web.register({
      kind: 'exact',
      path: '/api/longpi/connection',
      handler: (req, res) => {
        if (req.method === 'GET') {
          void (async () => {
            sendJson(res, 200, await connectionStatus())
          })().catch(() => sendJson(res, 500, { ok: false, error: 'connection failed' }))
          return
        }
        if (req.method === 'DELETE') {
          void (async () => {
            const removed = clearConnection(resolveRootDir(config().dataDir))   // the settings page edits the holder's connection only
            if (removed) connectionChanged()
            sendJson(res, 200, { ok: true, removed, ...(await connectionStatus()) })
          })().catch(() => sendJson(res, 500, { ok: false, error: 'connection failed' }))
          return
        }
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'GET, POST or DELETE' })
          return
        }
        void (async () => {
          const body = await readJson(req, 16_000)
          const value = body.ok && isObject(body.value) ? body.value : null
          const problem = !value ? '请求格式有误：应为 {"mcp_url": "…", "mcp_token": "…"}。' : connectionUrlProblem(value.mcp_url) || connectionTokenProblem(value.mcp_token)
          if (!value || problem) {
            sendJson(res, 400, { ok: false, error: problem, ...connectionBase() })
            return
          }
          const current = config()
          const candidate = { mcp_url: String(value.mcp_url).trim(), mcp_token: typeof value.mcp_token === 'string' ? value.mcp_token.trim() : '' }
          // Saved only when one catalogue read through it succeeds; otherwise nothing changes.
          const tested = await testConnection({ ...candidate, member: current.member })
          if (!tested.ok) {
            sendJson(res, 400, { ok: false, error: tested.error, ...connectionBase() })
            return
          }
          // The settings page edits the holder's own connection, whoever the page is showing; a family member's link
          // is made and renewed by LongPi (people/), never pasted over with the holder's.
          saveConnection(resolveRootDir(current.dataDir), candidate)
          await renewActiveMember(resolveRootDir(current.dataDir), true)
          connectionChanged()
          sendJson(res, 200, { ok: true, ...(await connectionStatus()) })
        })().catch((error: unknown) => {
          const message = error instanceof Error && error.message === 'body too large' ? '请求太大。' : '保存连接失败。'
          sendJson(res, 400, { ok: false, error: message })
        })
      },
    })

    web.register({
      kind: 'exact',
      path: '/api/longpi/connection/test',
      handler: (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'POST only' })
          return
        }
        void (async () => {
          const body = await readJson(req, 16_000)
          const value = body.ok ? (isObject(body.value) ? body.value : body.value == null ? {} : null) : null
          if (!value) {
            sendJson(res, 400, { ok: false, error: '请求格式有误：应为 {"mcp_url": "…", "mcp_token": "…"}，都可以省略。' })
            return
          }
          // Without an address, the connection in use is tested, with its own token; a new address carries its own (or none).
          const current = config()
          const given = typeof value.mcp_url === 'string' && value.mcp_url.trim() !== ''
          const url = given ? String(value.mcp_url).trim() : current.mcpUrl.trim()
          const token = given ? (typeof value.mcp_token === 'string' ? value.mcp_token.trim() : '') : current.mcpToken.trim()
          const problem = connectionUrlProblem(url) || (given ? connectionTokenProblem(value.mcp_token) : '')
          if (problem) {
            sendJson(res, 200, { ok: false, error: problem, url_masked: maskMcpUrl(url) })
            return
          }
          const tested = await testConnection({ mcp_url: url, mcp_token: token, member: current.member })
          sendJson(res, 200, tested.ok
            ? { ok: true, indicator_count: tested.indicators, url_masked: maskMcpUrl(url) }
            : { ok: false, error: tested.error, url_masked: maskMcpUrl(url) })
        })().catch(() => sendJson(res, 400, { ok: false, error: '测试连接失败。' }))
      },
    })

    web.register({
      kind: 'exact',
      path: '/api/longpi/plan-draft',
      handler: (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        void (async () => {
          const input = await journeyContext()
          const brief = await buildPlanBrief(input)
          const draft = settleDraft(input.dataDir, brief, input.today)
          // What was taken out on the page, so 恢复 still works after a reload.
          sendJson(res, 200, pageDraftPayload(input.dataDir, { brief, draft, removed_items: readPlanPrefs(input.dataDir).removed_items }))
        })().catch(() => sendJson(res, 500, { ok: false, error: 'plan draft failed' }))
      },
    })

    web.register({
      kind: 'exact',
      path: '/api/longpi/plan-draft/exclude',
      handler: (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'POST only' })
          return
        }
        void (async () => {
          const body = await readJson(req, 8_000)
          const value = body.ok && body.value && typeof body.value === 'object' ? body.value as Record<string, unknown> : null
          if (!value || typeof value.excluded !== 'boolean') {
            sendJson(res, 400, { ok: false, error: 'body must be {"id","title","excluded":true|false}' })
            return
          }
          const input = await journeyContext()
          const prefs = setPlanExclusion(input.dataDir, {
            id: typeof value.id === 'string' ? value.id : '',
            title: typeof value.title === 'string' ? value.title : '',
            excluded: value.excluded,
          })
          const brief = await buildPlanBrief(input)
          const draft = settleDraft(input.dataDir, brief, input.today)
          sendJson(res, 200, pageDraftPayload(input.dataDir, { ok: true, excluded_ids: prefs.excluded_ids, excluded_phrases: prefs.excluded_phrases, removed_items: readPlanPrefs(input.dataDir).removed_items, brief, draft }))
        })().catch(() => sendJson(res, 400, { ok: false, error: 'exclude failed' }))
      },
    })

    web.register({
      kind: 'exact',
      path: '/api/longpi/plan-draft/accept',
      handler: (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'POST only' })
          return
        }
        void (async () => {
          const body = await readJson(req, 64_000)
          const value = body.ok && body.value && typeof body.value === 'object' ? body.value as Record<string, unknown> : {}
          const posted = value.draft
          if (!posted || typeof posted !== 'object') {
            sendJson(res, 400, { ok: false, error: 'body must be {"draft": {...}}' })
            return
          }
          const input = await journeyContext()
          // The items are rebuilt from the evidence by id, from the same brief the draft came from (a chat
          // draft may have its own focus and markers), then saved exactly like a confirmed plan.
          const postedDraft = minorView(readProfile(input.dataDir)).minor
            ? (stripWeightLoss({ draft: posted }) as { draft: typeof posted }).draft
            : posted
          const accepted = acceptedPlan(await buildPlanBrief(input, briefOptionsOf(value.focus, value.markers)), postedDraft, input.today)
          if (!accepted.ok) {
            sendJson(res, 400, { ok: false, error: accepted.error, problems: accepted.problems })
            return
          }
          const normalized = normalizePlan(accepted.plan, {
            today: input.today,
            medications: input.records.medications.map((row) => ({ name: row.name, ...(row.plan_id ? { plan_id: row.plan_id } : {}) })),
            previous: currentPlan(input.dataDir),
          })
          if (normalized.errors.length > 0) {
            sendJson(res, 400, { ok: false, error: normalized.errors[0], problems: normalized.errors })
            return
          }
          const saved = savePlan(input.dataDir, normalized.plan)
          invalidateTracking()
          sendJson(res, 200, { ok: true, plan: { version: saved.version, title: saved.title, items: saved.items.length } })
        })().catch((error: unknown) => {
          const message = error instanceof Error && error.message === 'body too large' ? error.message : 'accept failed'
          sendJson(res, 400, { ok: false, error: message })
        })
      },
    })

    // Retest dates and open check-ins for the next planned follow-up; null when the journey is slow or fails.
    const followupStateNow = async () => {
      const built = await within(buildJourneyFull(await journeyContext()), 20_000).catch(() => null)
      return built && 'value' in built ? followupStateOf(built.value.journey, built.value.tracking) : null
    }

    web.register({
      kind: 'exact',
      path: '/api/longpi/followup',
      handler: (req, res) => {
        const dataDir = resolveDataDir(config().dataDir)
        if (req.method === 'GET') {
          void (async () => {
            sendJson(res, 200, followupResponse(dataDir, await followupStateNow()))
          })().catch(() => sendJson(res, 500, { ok: false, error: 'follow-up failed' }))
          return
        }
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'GET or POST' })
          return
        }
        void (async () => {
          const body = await readJson(req, 8000)
          if (!body.ok) {
            sendJson(res, 400, { ok: false, error: 'settings must be JSON' })
            return
          }
          const written = writeFollowup(dataDir, body.value)
          if (!written.ok) {
            sendJson(res, 400, { ok: false, error: written.error })
            return
          }
          sendJson(res, 200, { ok: true, ...followupResponse(dataDir, await followupStateNow()) })
        })().catch((error: unknown) => {
          const message = error instanceof Error && error.message === 'body too large' ? error.message : 'follow-up failed'
          sendJson(res, 400, { ok: false, error: message })
        })
      },
    })

    web.register({
      kind: 'exact',
      path: '/api/longpi/followup/test',
      handler: (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'POST only' })
          return
        }
        void (async () => {
          // A test goes out even while follow-up is off (it is how the person checks a channel before turning it on);
          // it is logged and counts toward the daily limit, but never stands in for a scheduled reminder.
          const result = await sendNow(resolveDataDir(config().dataDir), FOLLOWUP_TEST_TEXT, 'test')
          sendJson(res, 200, result)
        })().catch(() => sendJson(res, 500, { ok: false, channels: {}, error: 'test failed' }))
      },
    })

    web.register({
      kind: 'exact',
      path: '/api/longpi/consent',
      handler: (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'POST only' })
          return
        }
        void (async () => {
          const body = await readJson(req)
          const accept = body.ok && body.value && typeof body.value === 'object' ? (body.value as Record<string, unknown>).accept : undefined
          if (typeof accept !== 'boolean') {
            sendJson(res, 400, { ok: false, error: 'body must be {"accept": true|false}' })
            return
          }
          const consent = setConsent(resolveDataDir(config().dataDir), accept, new Date())
          invalidateTracking()
          sendJson(res, 200, { ok: true, consent })
        })().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'consent failed'
          sendJson(res, 400, { ok: false, error: message.includes('damaged') ? message : 'consent failed' })
        })
      },
    })

    web.register({
      kind: 'exact',
      path: '/api/longpi/self',
      handler: (req, res) => {
        const dataDir = resolveDataDir(config().dataDir)
        if (req.method === 'GET') {
          sendJson(res, 200, { rows: readSelf(dataDir).reverse().slice(0, 200) })
          return
        }
        if (req.method === 'DELETE') {
          const removed = deleteSelf(dataDir, paramOf(req.url, 'id'))
          if (removed) {
            invalidateRecords()
            invalidateTracking()
          }
          sendJson(res, removed ? 200 : 404, { ok: removed, ...(removed ? {} : { error: 'no such measurement' }) })
          return
        }
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'GET, POST or DELETE' })
          return
        }
        void (async () => {
          const body = await readJson(req, 32_000)
          if (!body.ok) {
            sendJson(res, 400, { ok: false, error: 'measurements must be JSON' })
            return
          }
          const value = body.value as Record<string, unknown> | unknown[] | null
          const entries = Array.isArray(value) ? value
            : value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>).entries) ? (value as { entries: unknown[] }).entries
              : [value]
          const result = addSelf(dataDir, entries, { today: isoDay() })
          if (result.saved.length > 0) {
            invalidateRecords()
            invalidateTracking()
          }
          sendJson(res, result.saved.length > 0 ? 200 : 400, { ok: result.saved.length > 0, saved: result.saved, problems: result.problems })
        })().catch((error: unknown) => {
          const message = error instanceof Error && error.message === 'body too large' ? error.message : 'measurement failed'
          sendJson(res, 400, { ok: false, error: message })
        })
      },
    })

    web.register({
      kind: 'exact',
      path: '/api/longpi/calendar.ics',
      handler: (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        void (async () => {
          const journeyIn = await journeyContext()
          const tracking = await buildTracking(journeyIn)
          const text = buildCalendar(await buildJourney(journeyIn), tracking, { now: new Date() })
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
          res.setHeader('Content-Disposition', 'attachment; filename="longpi.ics"')
          res.setHeader('Cache-Control', 'no-store')
          res.end(text)
        })().catch(() => sendJson(res, 500, { ok: false, error: 'calendar failed' }))
      },
    })

    web.register({
      kind: 'exact',
      path: '/api/longpi/board',
      handler: (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        void (async () => {
          if (new URL(req.url ?? '/', 'http://127.0.0.1').searchParams.get('refresh')) {
            invalidateRecords()
            invalidateTracking()
          }
          const { current, dataDir, catalog, records } = await context()
          const outputs = latestOutputs(dataDir)
          sendJson(res, 200, {
            ...buildBoard({
              catalog,
              records,
              mount,
              receipts: readReceipts(dataDir, 5),
              limit: clampMatches(current.maxSkillMatches),
              outputs,
            }),
            readiness: readiness(catalog, records, outputs),
            today: isoDay(),
          })
        })().catch(() => sendJson(res, 500, { ok: false, error: 'board failed' }))
      },
    })

    web.register({
      kind: 'exact',
      path: '/api/longpi/tracking',
      handler: (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        void (async () => {
          const { current, dataDir, skillsHome, catalog, records } = await context()
          sendJson(res, 200, await buildTracking({ config: current, dataDir, skillsHome, catalog, records, today: isoDay() }))
        })().catch(() => sendJson(res, 500, { ok: false, error: 'tracking failed' }))
      },
    })

    web.register({
      kind: 'exact',
      path: '/api/longpi/checkin',
      handler: (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'POST only' })
          return
        }
        void (async () => {
          let parsed: unknown
          try {
            parsed = JSON.parse(await readBody(req)) as unknown
          } catch {
            sendJson(res, 400, { ok: false, error: 'check-in must be JSON' })
            return
          }
          const entries = Array.isArray(parsed) ? parsed : [parsed]
          const result = addCheckIns(resolveDataDir(config().dataDir), entries, { today: isoDay(), source: 'board' })
          if (result.saved.length > 0) invalidateTracking()
          sendJson(res, result.saved.length > 0 ? 200 : 400, { ok: result.saved.length > 0, saved: result.saved, problems: result.problems })
        })().catch(() => sendJson(res, 400, { ok: false, error: 'check-in failed' }))
      },
    })

    web.register({
      kind: 'exact',
      path: '/api/longpi/run-ready',
      handler: (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'POST only' })
          return
        }
        void (async () => {
          const { current, dataDir, skillsHome, catalog, records } = await context()
          const results = await runReady({ config: current, dataDir, skillsHome, catalog, records, outputs: latestOutputs(dataDir) })
          invalidateTracking()
          sendJson(res, 200, { ok: true, results })
        })().catch(() => sendJson(res, 500, { ok: false, error: 'run failed' }))
      },
    })

    web.register({
      kind: 'exact',
      path: '/api/longpi/report',
      handler: (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        void (async () => {
          const { current, dataDir, skillsHome, catalog, records } = await context()
          const today = isoDay()
          const tracking = await buildTracking({ config: current, dataDir, skillsHome, catalog, records, today }).catch(() => null)
          const text = buildReport({ name: records.profile.displayName, today, records, tracking })
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
          res.setHeader('Content-Disposition', `attachment; filename="longpi-report-${today}.md"`)
          res.setHeader('Cache-Control', 'no-store')
          res.end(text)
        })().catch(() => sendJson(res, 500, { ok: false, error: 'report failed' }))
      },
    })

    web.register({
      kind: 'exact',
      path: '/api/longpi/match',
      handler: (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        void (async () => {
          const current = config()
          const dataDir = resolveDataDir(current.dataDir)
          const home = resolveSkillsHome(current.skillsHome)
          const catalog = loadCatalog(home)
          const records = await loadRecords(current, dataDir, mount.pluginHome)
          const matched = matchSkills(
            catalog.cards,
            questionOf(req.url),
            records.indicators,
            clampMatches(current.maxSkillMatches),
            {
              intents: catalog.intents,
              profile: { age: records.profile.age, sex: records.profile.sex },
              outputs: latestOutputs(dataDir),
              lexicon: loadEvidenceLexicon(home),
            },
          )
          sendJson(res, 200, {
            revision: catalog.revision,
            count: catalog.cards.length,
            error: catalog.error,
            ...matched,
          })
        })().catch(() => sendJson(res, 500, { ok: false, error: 'match failed' }))
      },
    })

    web.register({
      kind: 'exact',
      path: '/api/longpi/stats',
      handler: (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        sendJson(res, 200, buildStats(resolveDataDir(config().dataDir)))
      },
    })

    web.register({
      kind: 'exact',
      path: '/api/longpi/intents',
      handler: (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        const catalog = loadCatalog(resolveSkillsHome(config().skillsHome))
        sendJson(res, 200, { version: catalog.version, intents: catalog.intents.map((item) => ({ id: item.id, label: item.label_zh, skills: item.skills })) })
      },
    })

    web.register({
      kind: 'exact',
      path: '/api/longpi/profile',
      handler: (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'POST only' })
          return
        }
        void (async () => {
          const raw = await readBody(req)
          let parsed: unknown
          try {
            parsed = JSON.parse(raw) as unknown
          } catch {
            sendJson(res, 400, { ok: false, error: 'profile must be JSON' })
            return
          }
          const dataDir = resolveDataDir(config().dataDir)
          const update = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
          // mergeProfile keeps the saved consent and ignores one in the body: consent has its own route.
          const normalized = update ? normalizeProfile(mergeProfile(readProfile(dataDir), update)) : normalizeProfile(parsed)
          if (!normalized.ok) {
            sendJson(res, 400, { ok: false, error: normalized.error })
            return
          }
          writeProfile(dataDir, normalized.profile)
          invalidateTracking()
          sendJson(res, 200, { ok: true, profile: normalized.profile })
        })().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'profile failed'
          sendJson(res, 400, { ok: false, error: message === 'body too large' || message.includes('damaged') ? message : 'profile failed' })
        })
      },
    })
  })
}
