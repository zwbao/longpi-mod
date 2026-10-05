// LongPi in Claude Code. This file holds the engine ($): it boots the ported LongPi core (app/runtime.ts),
// serves the core's tools to Claude, opens the LongPi pane, keeps the pane's data, and runs what a press asks.
// Everything it draws comes from the pure modules under ui/.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderSurface } from 'claude-code'

import type { Celebration, CodexOverlay, LongPiView, PrivacyState, RouteCache, Tab } from '../types'
import type { Io } from './sys/host.ts'
import { boot, flushPending, op, reloadLibrary, route, runtime, runTool, toolSpecs, TOOL_PREFIX } from './app/runtime.ts'
import { ensurePython, hasPackages, updateLibrary } from './app/setup.ts'
import { isoWeek, scoutLiterature } from './app/literature.ts'
import { fullBrief, SHORT_BRIEF } from './app/brief.ts'
import { snapshotText } from './core/agents/orchestrator.ts'
import { isoDay } from './core/interventions.ts'
import { WRITE_TOOLS } from './core/agents/orchestrator.ts'
import { recordChanged } from './core/engage/engine.ts'
import { pageOf, PAGES } from './ui/pages/index.ts'
import { pageWidth, paneTree } from './ui/pane.tsx'
import type { Actions, CodexActions, Ctx, PostResult } from './ui/types.ts'
import { isAnimated, stageAt, stageCols } from './ui/codex/stage.ts'
import { cardTree, type CardState } from './ui/cards.tsx'
import type { GameView } from './app/game.ts'
import { markdownToHtml } from './ui/printable.ts'
import { CELEBRATE_MS, celebrateFrame, IDLE_MS, moodAt, piFrame } from './ui/journey/anim.ts'
import type { PiForm } from './ui/journey/sprites.ts'
import { bandTree, nextBand, noteInput, sittingMinutes, STANDUP_VISIBLE_MS, type Activity, type BandPrompt, type SlotView } from './ui/band.tsx'

type Engine = EngineInterface

const PANE = 'longpi'
const FRESH_MS = 90_000
const NO_OVERLAY: CodexOverlay = { kind: 'none', id: '', phase: '', since: 0, flipped: [], chosen: '', payload: null, note: '' }

// The session's values, held by the host so a hot reload keeps them; drawing subscribes to them.
const view = atom({ plugin: 'longpi', key: 'view' } as const, { tab: 'overview', sub: {}, detail: null } as LongPiView)
const data = atom({ plugin: 'longpi', key: 'data' } as const, {} as Record<string, RouteCache>)
const privacy = atom({ plugin: 'longpi', key: 'privacy' } as const, { showUntil: 0, presentation: false } as PrivacyState)
const overlay = atom({ plugin: 'longpi', key: 'overlay' } as const, NO_OVERLAY)
const notice = atom({ plugin: 'longpi', key: 'notice' } as const, null as { text: string; tone: 'info' | 'good' | 'warn'; at: number } | null)
const tick = atom({ plugin: 'longpi', key: 'tick' } as const, 0)
const booted = atom({ plugin: 'longpi', key: 'booted' } as const, false)
const coach = atom({ plugin: 'longpi', key: 'coach' } as const, false)
const healthTurn = atom({ plugin: 'longpi', key: 'healthTurn' } as const, false)
const band = atom({ plugin: 'longpi', key: 'band' } as const, null as BandPrompt | null)
const cards = atom({ plugin: 'longpi', key: 'cards' } as const, {} as Record<string, CardState>)
const celebrate = atom({ plugin: 'longpi', key: 'celebrate' } as const, null as Celebration)

// --- the engine as the core's I/O -------------------------------------------------------------------

function ioOf($: Engine): Io {
  return {
    read: (path) => $.fs.read(path),
    readBase64: async (path) => (await $.fs.read(path, { as: 'bytes' })).base64,
    write: (path, text) => $.fs.write(path, text),
    list: async (path) => (await $.fs.list(path)).map((entry) => ({ name: entry.name, kind: entry.kind === 'dir' ? 'directory' as const : entry.kind === 'file' ? 'file' as const : 'other' as const, size: entry.size, mtimeMs: entry.mtimeMs })),
    stat: async (path) => {
      try {
        const stat = await $.fs.stat(path)
        return { kind: stat.kind === 'dir' ? 'directory' as const : stat.kind === 'file' ? 'file' as const : 'other' as const, size: stat.size, mtimeMs: stat.mtimeMs }
      } catch {
        return null
      }
    },
    run: async (argv, init) => {
      const out = await $.process.run(argv, { ...(init?.cwd ? { cwd: init.cwd } : {}), ...(init?.env ? { env: init.env } : {}), ...(init?.stdin !== undefined ? { stdin: init.stdin } : {}), timeoutMs: init?.timeoutMs ?? 30_000 })
      return { exitCode: out.exitCode, stdout: out.stdout, stderr: out.stderr }
    },
    fetch: async (url, init) => {
      const out = await $.http.fetch(url, { method: init?.method ?? 'GET', ...(init?.headers ? { headers: init.headers } : {}), ...(init?.body !== undefined ? { body: init.body } : {}) })
      return { status: out.status, ok: out.ok, text: out.text, headers: out.headers }
    },
    complete: async (prompt, options) => {
      const out = await $.model.complete({ model: options?.model && options.model !== 'session' ? options.model : 'haiku', prompt, ...(options?.system ? { system: options.system } : {}), maxTokens: options?.maxTokens ?? 1500 })
      return out.isAnswered ? { ok: true as const, text: out.text } : { ok: false as const, reason: out.reason }
    },
    now: () => $.clock.now(),
    log: (line) => $.ui.log(`longpi: ${line}`, { to: 'debug' }),
  }
}

async function envOf($: Engine): Promise<Record<string, string>> {
  const pairs: Array<[string, string | undefined]> = [
    ['HOME', await $.env.get('HOME')],
    ['PATH', await $.env.get('PATH')],
    ['LANG', await $.env.get('LANG')],
    ['LC_ALL', await $.env.get('LC_ALL')],
    ['LC_MESSAGES', await $.env.get('LC_MESSAGES')],
    ['TMPDIR', await $.env.get('TMPDIR')],
    ['USER', await $.env.get('USER')],
    ['SHELL', await $.env.get('SHELL')],
    ['LONGPI_HOME', await $.env.get('LONGPI_HOME')],
    ['LONGEVITY_SKILLS_HOME', await $.env.get('LONGEVITY_SKILLS_HOME')],
    ['LONGPI_COACH_SKILL', await $.env.get('LONGPI_COACH_SKILL')],
    ['LONGPI_ANALYST_SKILL', await $.env.get('LONGPI_ANALYST_SKILL')],
    ['LONGPI_ANALYSES_HOME', await $.env.get('LONGPI_ANALYSES_HOME')],
  ]
  const out: Record<string, string> = {}
  for (const [key, value] of pairs) if (typeof value === 'string' && value !== '') out[key] = value
  return out
}

async function startCore($: Engine): Promise<void> {
  if (runtime()) return
  const env = await envOf($)
  const uname = await $.process.run(['uname', '-s']).catch(() => null)
  const platform = uname?.stdout.trim() === 'Linux' ? 'linux' : 'darwin'
  const own = ((await $.store.get('config')) ?? {}) as Record<string, unknown>
  await boot({
    io: ioOf($),
    pluginRoot: $.plugin.root,
    home: env.HOME ?? '/',
    env,
    platform,
    schedule: (ms, fn) => {
      const timer = $.clock.after(ms, fn)
      return () => timer.cancel()
    },
    config: { ...(env.LONGPI_HOME ? { dataDir: env.LONGPI_HOME } : {}), ...own },
  })
}

// --- the pane's data --------------------------------------------------------------------------------

const EMPTY: RouteCache = { at: 0, status: 0, json: null, loading: false, error: '' }

/** Tools that put values into the record. */
const RECORD_TOOLS: readonly string[] = ['record_measurements', 'import_measurements_csv', 'import_apple_health', 'save_self_measurement']
/** Tools that store health information: the consent is asked before the first of them. */
const CONSENT_TOOLS: readonly string[] = [...RECORD_TOOLS, 'read_narrative_findings', 'record_condition', 'record_medication_statement', 'forward_report', 'save_personal_profile', 'import_genetic_report']

/** Routes asked to reload while a read of them was in flight, with the path to fetch. */
const reloadWanted = new Map<string, string>()

/** Read one route into the cache. `fetchPath` may carry ?refresh=1 while the cache key stays the bare path. */
async function loadRoute($: Engine, path: string, force = false, fetchPath = path): Promise<void> {
  try {
    await loadRouteNow($, path, force, fetchPath)
  } catch {
    // the module unloaded under a background read: nothing to keep
  }
}

async function loadRouteNow($: Engine, path: string, force: boolean, fetchPath: string): Promise<void> {
  const rt = runtime()
  if (!rt) return
  const now = await $.clock.now()
  const held = (await read($, data))[path]
  // A load caught by a reload (the state outlives the module) is stale after 30 s, never stuck.
  const inFlight = Boolean(held?.loading) && now - (held?.at ?? 0) < 30_000
  if (held && !force && (inFlight || (held.status === 200 && now - held.at < FRESH_MS))) return
  // A forced read while another is in flight: that one may predate the write; read again once it lands.
  if (held && force && inFlight) {
    reloadWanted.set(path, fetchPath)
    return
  }
  await update($, data, (all) => ({ ...all, [path]: { ...(all[path] ?? EMPTY), loading: true, at: now } }))
  let next: RouteCache
  try {
    const out = await route(rt, 'GET', `/api/longpi/${fetchPath}`)
    const json = out.json as { error?: unknown } | null
    next = {
      at: await $.clock.now(), status: out.status, json: out.json, loading: false,
      error: out.status === 200 ? '' : typeof json?.error === 'string' ? json.error : `HTTP ${out.status}`,
      ...(out.text ? { text: out.text.slice(0, 600_000) } : {}),
    }
  } catch (error) {
    next = { at: await $.clock.now(), status: 0, json: null, loading: false, error: error instanceof Error ? error.message : String(error) }
  }
  await update($, data, (all) => ({ ...all, [path]: next }))
  const again = reloadWanted.get(path)
  if (again !== undefined) {
    reloadWanted.delete(path)
    void loadRoute($, path, true, again)
  }
  if (path === 'game' && next.status === 200) void onGame($, next.json as GameView).catch(() => undefined)
}

async function loadRoutes($: Engine, paths: readonly string[], force = false): Promise<void> {
  for (const path of paths) await loadRoute($, path, force)
}

async function routesOfView($: Engine): Promise<string[]> {
  const v = await read($, view)
  const cache = await read($, data)
  const json = <T,>(path: string) => {
    const held = cache[path]
    return (held && held.status === 200 ? held.json : null) as T | null
  }
  return ['journey', 'people', 'game', ...pageOf(v.tab).routes(v, json)]
}

/** Read what the page shows now; a second pass picks up routes the first answers named. */
async function loadView($: Engine): Promise<void> {
  await loadRoutes($, await routesOfView($))
  await loadRoutes($, await routesOfView($))
}

/** The 刷新 button: journey and tracking rebuilt from the record, every route of the page read again. */
async function refreshAll($: Engine): Promise<void> {
  await loadRoute($, 'journey', true, 'journey?refresh=1')
  const paths = (await routesOfView($)).filter((path) => path !== 'journey')
  for (const path of paths) await loadRoute($, path, true, path === 'tracking' ? 'tracking?refresh=1' : path)
}

/** After a write: what the page named, and the journey (every page's header reads it). */
async function reloadAfter($: Engine, paths: readonly string[]): Promise<void> {
  try {
    await reloadNow($, paths)
  } catch {
    // the module unloaded under a background read
  }
}

async function reloadNow($: Engine, paths: readonly string[]): Promise<void> {
  const all = [...new Set(['journey', ...paths])]
  await update($, data, (cache) => {
    const out = { ...cache }
    for (const key of Object.keys(out)) if (all.some((path) => key === path || key.startsWith(`${path}?`))) out[key] = { ...(out[key] as RouteCache), at: 0 }
    return out
  })
  for (const path of all) await loadRoute($, path, true)
}

async function toastNotice($: Engine, text: string, tone: 'info' | 'good' | 'warn' = 'info'): Promise<void> {
  $.ui.toast(text)
  await update($, notice, () => ({ text, tone, at: Date.now() }))
}

async function post($: Engine, path: string, body: unknown, options: { reload?: readonly string[]; done?: string; quiet?: boolean; method?: 'POST' | 'PUT' | 'DELETE' } = {}): Promise<PostResult> {
  const rt = runtime()
  if (!rt) return { ok: false, status: 503, json: { error: 'LongPi 还在启动' } }
  let out: { status: number; json: unknown }
  try {
    out = await route(rt, options.method ?? 'POST', `/api/longpi/${path}`, body)
  } catch (error) {
    out = { status: 500, json: { ok: false, error: error instanceof Error ? error.message : String(error) } }
  }
  const json = (out.json && typeof out.json === 'object' ? out.json : {}) as Record<string, unknown>
  const ok = out.status === 200 && json.ok !== false
  if (ok && options.done) await toastNotice($, options.done, 'good')
  if (!ok && !options.quiet) await toastNotice($, typeof json.error === 'string' ? json.error : `没有保存（${out.status}）`, 'warn')
  // Another person is shown now: nothing read for the last one may stay on any page.
  if (ok && path.startsWith('people')) await update($, data, () => ({}))
  // The page's data is read again behind the answer: a press never waits on a journey rebuild.
  void reloadAfter($, options.reload ?? [])
  return { ok, status: out.status, json }
}

// --- talking to Pi ----------------------------------------------------------------------------------

/** The LongPi snapshot (what the pane shows now, the top fact, what the person told LongPi), or ''. */
async function snapshotNow(): Promise<string> {
  const rt = runtime()
  if (!rt) return ''
  try {
    const input = await op(() => rt.app.snapshot(4_000))
    return input ? snapshotText(input) : ''
  } catch {
    return ''
  }
}

/** Coach mode from here on: Pi's rules join the system prompt; the first time, they ride this message too. */
async function enterCoach($: Engine): Promise<string[]> {
  const rt = runtime()
  const was = await read($, coach)
  if (!was) await update($, coach, () => true)
  const extra: string[] = []
  if (!was && rt) extra.push(fullBrief(rt.app.mount))
  const snapshot = await snapshotNow()
  if (snapshot) extra.push(snapshot)
  return extra
}

const PERSON_FRAME = '[LongPi] The person opened this from LongPi. Speak as Pi, their longevity coach; the LongPi snapshot below is from the plugin, not their words.'

/**
 * A turn in the person's words, with Pi's rules and the LongPi snapshot ahead of it as a message only the model
 * reads (the engine runs no plugin's own prompt.submit hook on the prompts it submits). Never from inside the
 * hook that holds the current dispatch: a moment later.
 */
function sayAsPerson($: Engine, text: string): void {
  $.clock.after(0, () => {
    void (async () => {
      const extra = await enterCoach($).catch(() => [] as string[])
      await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: [PERSON_FRAME, ...extra].join('\n\n') }] } })
        .catch((error: unknown) => $.ui.log(`longpi: snapshot not attached: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' }))
      await $.prompt.submit({ text, asUser: true })
    })().catch(() => undefined)
  })
}

// --- the actions a page's press runs ------------------------------------------------------------------

async function go($: Engine, tab: Tab, sub?: Record<string, string>): Promise<void> {
  await update($, view, (v) => ({ tab, sub: { ...v.sub, ...(sub ?? {}) }, detail: null }))
  await loadView($)
}

// --- the Codex stage -------------------------------------------------------------------------------

/** The stage's width as last drawn (the driver must blit frames of the size the page drew). */
let stageColsNow = 80
let stageTimer: { cancel: () => void } | null = null

function stopStage(): void {
  stageTimer?.cancel()
  stageTimer = null
}

async function codexStill($: Engine): Promise<boolean> {
  const p = await read($, privacy)
  const view = (await read($, data)).codex?.json as { prefs?: { simple?: boolean; presentation?: boolean } } | null | undefined
  return p.presentation || Boolean(view?.prefs?.simple) || Boolean(view?.prefs?.presentation)
}

/** Blit the stage's frames while its phase moves, then move the overlay on to the next phase. */
function playStage($: Engine): void {
  stopStage()
  let busy = false
  let denied = 0
  let lastBlit = 0
  const timer = $.clock.every(45, async () => {
    if (busy) return
    busy = true
    try {
      const o = await read($, overlay)
      if (!isAnimated(o)) {
        timer.cancel()
        return
      }
      const still = await codexStill($)
      const now = Date.now()
      const looping = o.phase === 'idle' || o.phase === 'back'
      if (still) {
        // No motion: jump to the end of each phase.
        const at = stageAt(o, stageColsNow, now + 60_000, true)
        if (at?.next) await update($, overlay, (cur) => (cur.since === o.since && cur.phase === o.phase ? { ...cur, phase: at.next as string, since: Date.now() } : cur))
        else timer.cancel()
        return
      }
      if (looping && now - lastBlit < 110) return
      const at = stageAt(o, stageColsNow, now, false)
      if (!at) {
        timer.cancel()
        return
      }
      const c = at.frame.cells()
      const res = await $.ui.blit({ requestId: PANE, key: 'codex-stage', cells: c.cells, columns: c.columns, rows: c.rows })
      lastBlit = now
      if (res && 'deny' in res && res.deny) {
        denied += 1
        if (denied > 60) timer.cancel()
      } else denied = 0
      if (at.done && at.next) {
        await update($, overlay, (cur) => (cur.since === o.since && cur.phase === o.phase ? { ...cur, phase: at.next as string, since: Date.now() } : cur))
      } else if (at.done) timer.cancel()
    } finally {
      busy = false
    }
  })
  stageTimer = timer
}

async function setOverlay($: Engine, fn: (o: CodexOverlay) => CodexOverlay): Promise<void> {
  await update($, overlay, fn)
  if (isAnimated(await read($, overlay))) playStage($)
}

function speciesNames($: Engine, keys: readonly string[], cache: Record<string, RouteCache>): string {
  const lib = cache['codex/library']?.json as { species?: Array<{ key: string; name_zh: string }> } | null | undefined
  return keys.map((key) => lib?.species?.find((row) => row.key === key)?.name_zh ?? key).join('、')
}

function codexActions($: Engine): CodexActions {
  const act = (body: Record<string, unknown>) => post($, 'codex', body, { reload: ['codex', 'codex/slot', 'codex/library', 'game'] })
  const payloadPatch = (patch: Record<string, unknown>) => setOverlay($, (o) => ({ ...o, payload: { ...((o.payload as Record<string, unknown> | null) ?? {}), ...patch } }))
  return {
    open: (kind, id, payload, phase = 'front') => {
      void setOverlay($, () => ({ ...NO_OVERLAY, kind, id, phase, since: Date.now(), payload }))
      if (kind === 'study') {
        void post($, 'codex', { action: 'read', card_id: id }, { quiet: true, reload: ['codex/library', 'game'] }).then(async (res) => {
          const met = Array.isArray(res.json.met) ? (res.json.met as string[]) : []
          if (met.length === 0) return
          await update($, overlay, (o) => (o.kind === 'study' && o.id === id ? { ...o, payload: { ...((o.payload as Record<string, unknown> | null) ?? {}), met } } : o))
          await toastNotice($, `遇见了 ${speciesNames($, met, await read($, data))}，已放进物种志。`, 'good')
        })
      }
    },
    tear: () => {
      void (async () => {
        const o = await read($, overlay)
        if (o.kind !== 'pack' || o.phase !== 'idle') return
        const started = Date.now()
        await setOverlay($, (cur) => ({ ...cur, phase: 'shake', since: started }))
        const res = await post($, 'codex', { action: 'open_pack', pack_id: o.id }, { quiet: true, reload: ['codex', 'codex/slot'] })
        const wait = 560 - (Date.now() - started)
        if (wait > 0 && !(await codexStill($))) await $.clock.sleep(wait)
        if (!res.ok) {
          await setOverlay($, (cur) => ({ ...cur, phase: 'idle', since: Date.now() }))
          await toastNotice($, typeof res.json.error === 'string' ? res.json.error : '没有拆开，请再试一次。', 'warn')
          return
        }
        const view = res.json.view as { packs?: Array<{ id: string; options?: unknown[] }> } | undefined
        const payload = (o.payload ?? {}) as { packKind?: string }
        if (payload.packKind === 'retest') {
          const results = ((res.json.pack as { results?: unknown[] } | undefined)?.results ?? []) as unknown[]
          await setOverlay($, (cur) => ({ ...cur, phase: 'burst', since: Date.now(), payload: { ...(cur.payload as object), results } }))
          return
        }
        const options = view?.packs?.find((row) => row.id === o.id)?.options ?? []
        if (options.length === 0) {
          await setOverlay($, (cur) => ({ ...cur, phase: 'empty', since: Date.now(), note: typeof res.json.note_zh === 'string' ? res.json.note_zh : '现在没有适合你的实验。包会一直留着。' }))
          return
        }
        await setOverlay($, (cur) => ({ ...cur, phase: 'burst', since: Date.now(), payload: { ...(cur.payload as object), options } }))
      })()
    },
    turn: () => {
      void (async () => {
        const o = await read($, overlay)
        if (o.kind !== 'reveal' || o.phase !== 'back') return
        await payloadPatch({ busy: true })
        const res = await post($, 'codex', { action: 'reveal', run_id: o.id }, { quiet: true, reload: ['codex', 'codex/slot'] })
        if (!res.ok) {
          await payloadPatch({ busy: false })
          await toastNotice($, typeof res.json.error === 'string' ? res.json.error : '没有翻开，请再试一次。', 'warn')
          return
        }
        const view = res.json.view as { deck?: unknown[] } | undefined
        const run = res.json.run ?? view?.deck?.[0] ?? (o.payload as { run?: unknown } | null)?.run
        await setOverlay($, (cur) => ({ ...cur, phase: 'turning', since: Date.now(), payload: { ...(cur.payload as object), run, busy: false } }))
      })()
    },
    pick: (optionId) => void setOverlay($, (o) => ({ ...o, chosen: optionId ?? '', payload: { ...((o.payload as Record<string, unknown> | null) ?? {}), answers: {}, randomized: false } })),
    answer: (questionId, yes) => void setOverlay($, (o) => {
      const payload = ((o.payload as Record<string, unknown> | null) ?? {}) as { answers?: Record<string, boolean> }
      return { ...o, payload: { ...payload, answers: { ...(payload.answers ?? {}), [questionId]: yes } } }
    }),
    randomize: (on) => void payloadPatch({ randomized: on }),
    begin: () => {
      void (async () => {
        const o = await read($, overlay)
        const payload = (o.payload ?? {}) as { options?: Array<{ id: string; title_zh: string }>; option?: { id: string; title_zh: string }; answers?: Record<string, boolean>; randomized?: boolean }
        const option = o.kind === 'pack' ? payload.options?.find((row) => row.id === o.chosen) : payload.option
        if (!option) return
        const res = await act({ action: 'begin', experiment_id: option.id, ...(o.kind === 'pack' ? { pack_id: o.id } : {}), answers: payload.answers ?? {}, randomized: payload.randomized === true })
        if (!res.ok) return
        const run = res.json.run as { title_zh?: string } | undefined
        await toastNotice($, typeof res.json.note_zh === 'string' && res.json.note_zh ? res.json.note_zh : `开始了「${run?.title_zh ?? option.title_zh}」。从今天算第 1 天。`, 'good')
        stopStage()
        await update($, overlay, () => NO_OVERLAY)
        await update($, view, (v) => ({ ...v, sub: { ...v.sub, 'codex.tab': 'exp' } }))
      })()
    },
    close: () => {
      stopStage()
      void update($, overlay, () => NO_OVERLAY).then(() => loadRoutes($, ['codex', 'codex/library'], true))
    },
    act,
  }
}

function actionsFor($: Engine, surface: RenderSurface): Actions {
  return {
    go: (tab, sub) => void go($, tab, sub),
    setSub: (key, value) => void update($, view, (v) => ({ ...v, sub: { ...v.sub, [key]: value } })).then(() => loadView($)),
    detail: (id) => void update($, view, (v) => ({ ...v, detail: id })).then(() => loadView($)),
    load: (paths, force) => void loadRoutes($, paths, force),
    refresh: () => void refreshAll($),
    post: (path, body, options) => post($, path, body, options),
    ask: async (question, options, header) => {
      try {
        return await $.ui.ask(question, { options, ...(header ? { header: header.slice(0, 12) } : {}) })
      } catch {
        return null
      }
    },
    say: (text) => sayAsPerson($, text),
    fill: (text) => void $.prompt.fill({ text, mode: 'replace' }),
    toast: (text) => void toastNotice($, text),
    copy: (text) => void $.ui.copy({ text, surface }).then((res) => { if (res.isCopied) $.ui.toast('已复制') }),
    reveal: () => void $.clock.now().then((now) => update($, privacy, (p) => ({ ...p, showUntil: now + 60_000 }))),
    setPresentation: (on) => void setPresentation($, on),
    codex: codexActions($),
    celebrated: (toRoad) => void celebrated($, toRoad),
    save: async (path, fileName) => {
      await loadRoute($, path, true)
      const held = (await read($, data))[path]
      const text = held?.text ?? (held?.json !== undefined && held?.json !== null ? JSON.stringify(held.json, null, 2) : '')
      if (!text) {
        await toastNotice($, '没有可以保存的内容。', 'warn')
        return null
      }
      const home = (await $.env.get('HOME')) ?? ''
      const target = `${home}/Downloads/${fileName.replace(/[\\/]/g, '-')}`
      try {
        await $.fs.write(target, text)
      } catch {
        await toastNotice($, '没能写入下载文件夹。', 'warn')
        return null
      }
      await toastNotice($, `已保存到 ${target}`, 'good')
      return target
    },
    saveText: async (text, fileName, open) => {
      const home = (await $.env.get('HOME')) ?? ''
      const target = `${home}/Downloads/${fileName.replace(/[\\/]/g, '-')}`
      try {
        await $.fs.write(target, text)
      } catch {
        await toastNotice($, '没能写入下载文件夹。', 'warn')
        return null
      }
      if (open) await $.process.run(['open', target]).catch(() => null)
      await toastNotice($, open ? `已保存并打开：${target}` : `已保存到 ${target}`, 'good')
      return target
    },
    saveFile: async (path, fileName) => {
      const saved = await actionsFor($, surface).save(path, fileName)
      return saved ? { ok: true, path: saved } : { ok: false, error: '没有可以保存的内容' }
    },
    close: () => void $.ui.close({ id: PANE }),
  }
}

// --- the prompt slot above the prompt -------------------------------------------------------------------

/** When the main conversation's current turn began (a Claude turn running ≥60 s is when a stand-up fits). */
let turnSince: number | null = null

async function noteActivity($: Engine): Promise<void> {
  const now = await $.clock.now()
  const prev = ((await $.store.get('activity')) ?? null) as Activity | null
  await $.store.set('activity', noteInput(now, prev))
}

/** 演示模式: LongPi's own switch and the Codex's, together. */
async function setPresentation($: Engine, on: boolean): Promise<void> {
  await update($, privacy, (p) => ({ ...p, presentation: on, showUntil: 0 }))
  await update($, band, () => null)
  $.ui.status(undefined)
  void post($, 'codex', { action: 'prefs', presentation: on }, { quiet: true, reload: ['codex', 'codex/slot'] })
}

/** Every few seconds: whether the slot should show something now, and the neutral line in the status bar. */
async function decideBand($: Engine): Promise<void> {
  const rt = runtime()
  if (!rt) return
  const now = await $.clock.now()
  const p = await read($, privacy)
  const current = await read($, band)
  if (current) {
    const filed = current.kind === 'welcome' && Boolean(await $.fs.stat(`${rt.rootDir}/record.json`).catch(() => null))
    if (p.presentation || (current.kind === 'standup' && now - current.at > STANDUP_VISIBLE_MS) || (current.kind === 'today' && now - current.at > 10 * 60_000) || filed) await update($, band, () => null)
    return
  }
  const slotJson = (await read($, data))['codex/slot']?.json as { enabled?: boolean; presentation?: boolean; slot?: SlotView; pane_neutral_zh?: string | null } | null | undefined
  const presentation = p.presentation || Boolean(slotJson?.presentation)
  // No standing status line: the engine draws a plugin's status as a warning (⚠), which a calm line is not.
  // A record on disk (an upgrade, or values filed from the chat): the person found their way in already.
  const welcomed = Boolean(await $.store.get(perHome('welcomed')))
  const onDisk = welcomed ? true : Boolean(await $.fs.stat(`${rt.rootDir}/record.json`).catch(() => null))
  if (!welcomed && onDisk) await $.store.set(perHome('welcomed'), true)
  if (!presentation && !onDisk) {
    await update($, band, () => ({ kind: 'welcome', ref: '', text: 'LongPi 长寿教练已装好 · 把体检报告拖进对话，或输入 /longpi 打开健康页', at: now }))
    return
  }
  const news = ((await $.store.get(perHome('news'))) ?? null) as { week?: string; cards?: number; shown?: boolean } | null
  if (!presentation && news && !news.shown && news.cards) {
    await $.store.set(perHome('news'), { ...news, shown: true })
    await update($, band, () => ({ kind: 'news', ref: news.week ?? '', text: `长寿图鉴 · 本周上架了 ${news.cards} 张新研究卡`, at: now }))
    return
  }
  const activity = ((await $.store.get('activity')) ?? null) as Activity | null
  const next = nextBand({
    enabled: Boolean(slotJson?.enabled),
    presentation,
    slot: slotJson?.slot ?? null,
    sitting: sittingMinutes(activity, now),
    turnMs: turnSince === null ? 0 : now - turnSince,
    now,
  })
  if (!next) {
    // Once a day, on a quiet slot: the first open thing of today's three, in one line.
    if (presentation) return
    const dayKey = perHome(`today:${isoDay(new Date(now))}`)
    if (await $.store.get(dayKey)) return
    if (!(await read($, data)).game) await loadRoute($, 'game')
    const game = (await read($, data)).game?.json as GameView | null | undefined
    const open = game && !game.demo && !game.member ? game.things.find((row) => !row.done && row.id !== 'ask') : undefined
    if (!open) return
    await $.store.set(dayKey, true)
    await update($, band, () => ({ kind: 'today', ref: open.id, text: `LongPi · 今天：${open.text_zh}`, at: now }))
    return
  }
  await update($, band, () => next)
  void post($, 'codex', next.kind === 'standup' ? { action: 'nudge', event: 'shown' } : { action: 'nudge', event: 'reveal_shown', ref: next.ref }, { quiet: true, reload: ['codex/slot'] })
}

async function revealFromBand($: Engine, ref: string): Promise<void> {
  await update($, band, () => null)
  void post($, 'codex', { action: 'nudge', event: 'reveal_open', ref }, { quiet: true, reload: ['codex/slot'] })
  await update($, view, (v) => ({ ...v, tab: 'codex' as const, detail: null, sub: { ...v.sub, 'codex.tab': 'exp' } }))
  await $.ui.open({ id: PANE, title: 'LongPi', focus: true, columns: 92 })
  await loadRoutes($, ['codex', 'codex/library'], true)
  const codexView = (await read($, data)).codex?.json as { ready?: Array<{ id: string }>; packs?: Array<{ id: string; kind: string; source_zh: string; options: unknown[]; opened: string | null }> } | null | undefined
  const run = codexView?.ready?.find((row) => row.id === ref)
  if (run) {
    await setOverlay($, () => ({ ...NO_OVERLAY, kind: 'reveal', id: run.id, phase: 'back', since: Date.now(), payload: { run } }))
    return
  }
  const pack = codexView?.packs?.find((row) => row.id === ref)
  if (pack) await setOverlay($, () => ({ ...NO_OVERLAY, kind: 'pack', id: pack.id, phase: 'idle', since: Date.now(), payload: { packKind: pack.kind, sourceZh: pack.source_zh, options: [], results: [] } }))
}

// --- what LongPi sets up by itself ---------------------------------------------------------------------

let settingUp = false

/** A store key for this LongPi home: the weekly run and its notice belong to one data folder, not the mod. */
function perHome(key: string): string {
  return `${key}:${runtime()?.rootDir ?? ''}`
}
const WEEK_MS = 7 * 24 * 3_600_000

/**
 * The full calculation environment, built quietly in the background the first time (and checked weekly);
 * `manual` (/longpi setup) also updates the method library and says what it did.
 */
async function setupLongPi($: Engine, manual: boolean): Promise<void> {
  const rt = runtime()
  if (!rt || settingUp) return
  settingUp = true
  const say = (line: string) => $.ui.status(`LongPi · ${line}`)
  try {
    const home = (await $.env.get('HOME')) ?? '/'
    const io = ioOf($)
    const lines: string[] = []
    if (manual) {
      const lib = await updateLibrary(io, home, say)
      lines.push(lib.line)
    }
    const env = await ensurePython(io, home, rt.python, say)
    lines.push(...env.lines)
    await $.store.set('env', { ok: env.ok, python: env.python, at: await $.clock.now() })
    await reloadLibrary()
    rt.app.invalidate()
    $.ui.status(undefined)
    const done = runtime()
    if (manual) {
      $.ui.log(`LongPi：${lines.join(' ')}${done ? ` 方法库 ${done.skillsHome || '未找到'}；Python ${done.python || '未找到'}` : ''}`)
      await toastNotice($, env.ok ? 'LongPi 已就绪：方法库和计算环境都准备好了。' : '大多数方法已经能算；完整的计算环境这次没准备好，详情见上面的记录。', env.ok ? 'good' : 'warn')
    } else if (env.ok && lines.length > 0) {
      await toastNotice($, 'LongPi 的计算环境准备好了：所有方法都能算了。', 'good')
    }
  } catch (error) {
    $.ui.status(undefined)
    if (manual) await toastNotice($, `没有完成：${error instanceof Error ? error.message : String(error)}`, 'warn')
  } finally {
    settingUp = false
  }
}

/**
 * Once a week, in the background: a fresh copy of the method library, and the literature scout's new research
 * cards for the Codex. The first session of the week that finds new cards says so once, above the prompt.
 */
async function weekly($: Engine, force = false): Promise<{ cards: number; reason: string } | null> {
  const rt = runtime()
  if (!rt) return null
  const now = await $.clock.now()
  const last = ((await $.store.get(perHome('weekly'))) ?? null) as { at?: number; week?: string } | null
  if (!force && last?.at && now - last.at < WEEK_MS) return null
  // Held for an hour while it runs (another window starting meanwhile does not run it twice); a run that found
  // nothing to read (no network, PubMed down, no model) is tried again the next day, not in a week.
  await $.store.set(perHome('weekly'), { at: now - WEEK_MS + 3_600_000, week: last?.week ?? '' })
  const home = (await $.env.get('HOME')) ?? '/'
  const io = ioOf($)
  const lib = await updateLibrary(io, home, () => undefined).catch(() => null)
  if (lib?.changed) {
    await reloadLibrary()
    rt.app.invalidate()
  }
  const found = await scoutLiterature(io, rt.rootDir, new Date(now)).catch(() => null)
  $.ui.log(`longpi: weekly — ${lib?.line ?? 'library unchanged'}; literature ${found ? `${found.cards} cards from ${found.candidates} papers${found.reason ? ` (${found.reason})` : ''}` : 'not run'}`, { to: 'debug' })
  const ran = Boolean(found?.finished)
  await $.store.set(perHome('weekly'), ran ? { at: now, week: isoWeek(new Date(now)) } : { at: now - WEEK_MS + 24 * 3_600_000, week: last?.week ?? '' })
  if (found && found.cards > 0) await $.store.set(perHome('news'), { week: found.week, cards: found.cards, shown: false })
  await update($, data, (all) => {
    const out = { ...all }
    delete out['codex/library']
    delete out.game
    return out
  })
  return found ? { cards: found.cards, reason: found.reason } : { cards: 0, reason: '没有运行' }
}

/** At session start: build the environment once in the background if it is missing, re-check weekly. */
async function maintain($: Engine): Promise<void> {
  const rt = runtime()
  if (!rt) return
  await weekly($).catch(() => undefined)
  const env = ((await $.store.get('env')) ?? null) as { ok?: boolean; python?: string; at?: number } | null
  const now = await $.clock.now()
  if (env?.ok && env.at && now - env.at < WEEK_MS) return
  if (env && !env.ok && env.at && now - env.at < WEEK_MS) return
  if (await hasPackages(ioOf($), rt.python)) {
    await $.store.set('env', { ok: true, python: rt.python, at: now })
    return
  }
  await setupLongPi($, false)
}

/** The product notice and the health-information consent, for the person shown now. */
async function consentGiven(rt: NonNullable<ReturnType<typeof runtime>>): Promise<boolean> {
  const journey = (await route<{ consent?: { accepted?: boolean } }>(rt, 'GET', '/api/longpi/journey').catch(() => null))?.json
  return journey?.consent?.accepted === true
}

/** The family member shown now ('' for the holder). */
async function activeLabel(rt: NonNullable<ReturnType<typeof runtime>>): Promise<string> {
  const people = (await route<{ active?: string; people?: Array<{ id: string; label_zh: string; demo?: boolean }> }>(rt, 'GET', '/api/longpi/people').catch(() => null))?.json
  return people?.people?.find((row) => row.id === people.active && row.id !== 'self' && !row.demo)?.label_zh ?? ''
}

/** A brief the model prepared, also saved as a page to print in ~/Downloads; the answer says where. */
async function printableBrief($: Engine, text: string): Promise<string> {
  try {
    const answer = JSON.parse(text) as { ok?: boolean; markdown?: string; where_zh?: string }
    if (!answer.ok || typeof answer.markdown !== 'string' || !answer.markdown) return text
    const rt = runtime()
    const people = rt ? (await route<{ active?: string; people?: Array<{ id: string; label_zh: string }> }>(rt, 'GET', '/api/longpi/people').catch(() => null))?.json : null
    const who = people?.people?.find((row) => row.id === people.active && row.id !== 'self')?.label_zh ?? ''
    const day = isoDay(new Date(await $.clock.now()))
    const home = (await $.env.get('HOME')) ?? ''
    const target = `${home}/Downloads/LongPi 医生简报${who ? ` ${who}` : ''} ${day}.html`
    await $.fs.write(target, markdownToHtml(answer.markdown, `LongPi 医生简报${who ? ` · ${who}` : ''}`))
    return JSON.stringify({ ...answer, file: target, where_zh: `已存成可打印的网页：${target}。双击用浏览器打开，按 ⌘P 打印；健康页「总览」最上面的「最重要的一步」里也能打开。` })
  } catch {
    return text
  }
}

// --- Pi and the road to 120 --------------------------------------------------------------------------

/** When the pane last drew, and how wide its body was: a celebration plays only on a pane that is showing. */
let paneDrawnAt = 0
let paneWidthNow = 88
let celebrateTimer: { cancel: () => void } | null = null
let idleTimer: { cancel: () => void } | null = null
/** Fresh milestones already toasted this session while the pane was closed (celebrated when it opens). */
const toasted = new Set<string>()

async function stillPictures($: Engine): Promise<boolean> {
  return (await read($, privacy)).presentation || (await codexStill($))
}

function celebrationLines(game: GameView): string[] {
  const lines: string[] = []
  const stations = game.stations.filter((row) => game.fresh.stations.includes(row.id))
  const medals = game.medals.filter((row) => game.fresh.medals.includes(row.id))
  const last = stations[stations.length - 1]
  if (last) lines.push(stations.length > 1 ? `走过了 ${stations.length} 站，最新一站：${last.title_zh}` : `新的一站：${last.title_zh}`)
  if (game.fresh.form != null) lines.push(`Pi 长成了「${game.form.zh}」。${game.form.line_zh}`)
  for (const row of medals) lines.push(`新奖章：${row.title_zh}`)
  if (lines.length > 0 && game.form.next_at != null && game.form.next_zh) lines.push(`通往 120 · 第 ${game.reached}/12 站`)
  return lines
}

/** A game reading with something fresh: celebrate on a showing pane, otherwise one toast and wait for the pane. */
async function onGame($: Engine, game: GameView): Promise<void> {
  if (!game?.fresh || game.demo || game.member) return
  const fresh = [...game.fresh.stations, ...game.fresh.medals, ...(game.fresh.form != null ? [`form${game.fresh.form}`] : [])]
  if (fresh.length === 0) return
  const lines = celebrationLines(game)
  // One showing already: what is new joins it rather than queuing a second one.
  const showingNow = await read($, celebrate)
  if (showingNow) {
    const sameSet = game.fresh.stations.every((id) => showingNow.stations.includes(id)) && game.fresh.medals.every((id) => showingNow.medals.includes(id)) && (game.fresh.form == null || showingNow.form === game.fresh.form)
    if (sameSet) return
    await update($, celebrate, (c) => c ? { ...c, stations: [...new Set([...c.stations, ...game.fresh.stations])], medals: [...new Set([...c.medals, ...game.fresh.medals])], form: game.fresh.form ?? c.form, from: c.from ?? (game.fresh.form != null ? Math.max(0, game.fresh.form - 1) : null), lines } : c)
    return
  }
  const showing = Date.now() - paneDrawnAt < 4_000
  if (!showing) {
    const key = fresh.join(',')
    if (toasted.has(key)) return
    toasted.add(key)
    $.ui.toast(`Pi：${lines[0] ?? '有新的进展'}。输入 /longpi 看看。`)
    return
  }
  const from = game.fresh.form != null ? Math.max(0, game.fresh.form - 1) : null
  await update($, celebrate, () => ({ since: Date.now(), stations: game.fresh.stations, medals: game.fresh.medals, form: game.fresh.form, from, lines }))
  playCelebration($, game.form.no as PiForm, from as PiForm | null)
}

function playCelebration($: Engine, form: PiForm, from: PiForm | null): void {
  celebrateTimer?.cancel()
  let busy = false
  const timer = $.clock.every(60, async () => {
    if (busy) return
    busy = true
    try {
      const c = await read($, celebrate)
      if (!c || (await stillPictures($))) {
        timer.cancel()
        if (c) await update($, tick, (n) => n + 1)
        return
      }
      const t = Date.now() - c.since
      const f = celebrateFrame(Math.min(paneWidthNow, 72), t, form, from)
      const cells = f.cells()
      await $.ui.blit({ requestId: PANE, key: 'pi-celebrate', cells: cells.cells, columns: cells.columns, rows: cells.rows })
      if (t > CELEBRATE_MS) {
        timer.cancel()
        await update($, tick, (n) => n + 1)
      }
    } finally {
      busy = false
    }
  })
  celebrateTimer = timer
}

/** 好 / 看看这条路: each milestone is celebrated once, across sessions. */
async function celebrated($: Engine, toRoad: boolean): Promise<void> {
  const c = await read($, celebrate)
  celebrateTimer?.cancel()
  celebrateTimer = null
  await update($, celebrate, () => null)
  if (c) await post($, 'game/seen', { stations: c.stations, medals: c.medals, form: c.form ?? 0 }, { quiet: true, reload: ['game'] })
  if (toRoad) await go($, 'journey')
}

/** Pi breathing on 总览: a frame every IDLE_MS while the card is on screen; stops once it is not. */
function startIdle($: Engine): void {
  if (idleTimer) return
  let n = 0
  let denied = 0
  let busy = false
  const timer = $.clock.every(IDLE_MS, async () => {
    if (busy) return
    busy = true
    try {
      const v = await read($, view)
      const game = (await read($, data)).game?.json as GameView | null | undefined
      if (v.tab !== 'overview' || !game || (await read($, celebrate)) || (await read($, overlay)).kind !== 'none' || (await stillPictures($))) {
        denied += 1
      } else {
        n += 1
        const f = piFrame(game.form.no as PiForm, moodAt(Date.now()), n)
        const cells = f.cells()
        const res = await $.ui.blit({ requestId: PANE, key: 'pi-card', cells: cells.cells, columns: cells.columns, rows: cells.rows })
        denied = res && 'deny' in res && res.deny ? denied + 1 : 0
      }
      if (denied > 6) {
        timer.cancel()
        if (idleTimer === timer) idleTimer = null
      }
    } catch {
      timer.cancel()
      if (idleTimer === timer) idleTimer = null
    } finally {
      busy = false
    }
  })
  idleTimer = timer
}

// --- /longpi --------------------------------------------------------------------------------------

const TAB_WORDS: Record<string, Tab> = {
  总览: 'overview', 概览: 'overview', overview: 'overview', home: 'overview', 首页: 'overview',
  化验: 'labs', 指标: 'labs', labs: 'labs', indicators: 'labs',
  睡眠: 'sleep', sleep: 'sleep',
  运动: 'training', training: 'training',
  日程: 'calendar', calendar: 'calendar',
  方案: 'plan', plan: 'plan',
  图鉴: 'codex', 长寿图鉴: 'codex', codex: 'codex', 卡片: 'codex',
  深度分析: 'analysis', analysis: 'analysis',
  问: 'ask', ask: 'ask',
  档案: 'profile', profile: 'profile', 家人: 'profile',
  研究: 'science', science: 'science',
  设置: 'settings', settings: 'settings', 提醒: 'settings',
  pi: 'journey', Pi: 'journey', 旅程: 'journey', 通往120: 'journey', '120': 'journey', 路线: 'journey', 奖章: 'journey', journey: 'journey',
}

async function openPane($: Engine, tab?: Tab): Promise<void> {
  if (tab) await update($, view, (v) => ({ ...v, tab, detail: null }))
  // Opened once: the welcome line above the prompt has done its job.
  void $.store.set(perHome('welcomed'), true).catch(() => undefined)
  const shownBand = await read($, band)
  if (shownBand?.kind === 'welcome') await update($, band, () => null)
  await $.ui.open({ id: PANE, title: 'LongPi', focus: true, columns: 92 })
  void loadView($)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await startCore($)
    const rt = runtime()
    if (rt) for (const spec of toolSpecs(rt)) await $.tool.register(spec)
    await $.command.register({ name: 'longpi', description: 'LongPi 长寿教练：健康页、长寿图鉴、方案与打卡', argumentHint: '[总览|图鉴|通往120|方案|档案|设置|新研究|setup|演示模式|你想问的话]' })
    await update($, booted, () => true)
    // The environment builds itself in the background a minute in, never in the way of the first prompt.
    $.clock.after(60_000, () => {
      void maintain($).catch(() => undefined)
    })
    // Background work: a failure (the module unloading under it) is never an unhandled rejection.
    const quietly = (work: Promise<unknown>) => void work.catch(() => undefined)
    $.clock.every(3_000, () => {
      quietly(flushPending())
    })
    $.clock.every(60_000, () => {
      quietly(update($, tick, (t) => t + 1))
      quietly(loadRoute($, 'codex/slot', true))
      if (turnSince !== null) quietly(noteActivity($))
    })
    $.clock.every(15_000, () => {
      quietly(decideBand($))
    })
    $.clock.after(3_000, () => {
      quietly(decideBand($))
    })
    void loadRoute($, 'codex/slot')
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    const rt = runtime()
    const sections = [{ id: 'longpi:brief', text: SHORT_BRIEF, scope: 'session' as const }]
    if (rt && (await read($, coach))) sections.push({ id: 'longpi:coach', text: fullBrief(rt.app.mount), scope: 'session' as const })
    return { sections: [...composed.sections, ...sections] }
  })

  on('prompt.submit', async ($, e, next) => {
    const isOwn = e.origin.kind === 'plugin' && e.origin.name === 'longpi'
    if (e.origin.kind !== 'composer' && !isOwn) return next(e)
    await noteActivity($)
    // A prompt from /longpi, or the next one after a turn that used LongPi: the snapshot rides along.
    if (!isOwn && !(await read($, healthTurn))) return next(e)
    await update($, healthTurn, () => false)
    let extra: string[] = []
    try {
      extra = isOwn ? await enterCoach($) : [await snapshotNow()].filter(Boolean)
    } catch (error) {
      $.ui.log(`longpi: snapshot failed: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })
    }
    if (extra.length === 0 && !isOwn) return next(e)
    return next({ ...e, context: [...(e.context ?? []), ...(isOwn ? [PERSON_FRAME] : []), ...extra] })
  })

  on('turn.start', async ($, e, next) => {
    turnSince = await $.clock.now()
    await noteActivity($)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (!e.agentId) {
      turnSince = null
      await noteActivity($)
    }
    return done
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.view.agentId) return next(e)
    const prompt = await read($, band)
    if (!prompt || (await read($, privacy)).presentation) return next(e)
    return bandTree($.ui.resolve(e), prompt, {
      standupOk: () => {
        void update($, band, () => null)
        void post($, 'codex', { action: 'nudge', event: 'ok' }, { quiet: true, reload: ['codex/slot'] })
      },
      standupOff: () => {
        void update($, band, () => null)
        void post($, 'codex', { action: 'nudge', event: 'dismiss_today' }, { quiet: true, reload: ['codex/slot'] })
      },
      revealOpen: (ref) => void revealFromBand($, ref),
      newsOpen: () => {
        void (async () => {
          await update($, band, () => null)
          await update($, view, (v) => ({ ...v, tab: 'codex' as const, detail: null, sub: { ...v.sub, 'codex.tab': 'library', 'codex.chapter': 'new', 'codex.tier': '' } }))
          await openPane($)
        })().catch(() => undefined)
      },
      newsLater: () => void update($, band, () => null),
      welcomeOpen: () => {
        void (async () => {
          await $.store.set(perHome('welcomed'), true)
          await update($, band, () => null)
          await openPane($, 'overview')
        })().catch(() => undefined)
      },
      todayOpen: () => {
        void (async () => {
          await update($, band, () => null)
          await openPane($, 'overview')
        })().catch(() => undefined)
      },
      todayLater: () => void update($, band, () => null),
      welcomeLater: () => {
        void $.store.set(perHome('welcomed'), true).then(() => update($, band, () => null)).catch(() => undefined)
      },
      revealLater: (ref) => {
        void update($, band, () => null)
        void post($, 'codex', { action: 'nudge', event: 'reveal_later', ref }, { quiet: true, reload: ['codex/slot'] })
      },
    })
  })

  on('ui.render', { component: 'ToolUse', props: { tool: /^mcp__longpi__/ } }, async ($, e, next) => {
    const id = e.props.tool_use_id
    const state = (await read($, cards))[id] ?? {}
    const setCard = (patch: CardState) => update($, cards, (all) => ({ ...all, [id]: { ...(all[id] ?? {}), ...patch } }))
    const tree = cardTree($.ui.resolve(e), {
      tool: e.props.tool,
      input: (e.props.input && typeof e.props.input === 'object' ? e.props.input : {}) as Record<string, unknown>,
      output: e.props.output,
      isRunning: e.props.isRunning,
      isErrored: e.props.isErrored,
    }, state, {
      adoptDraft: (draft, source) => {
        void (async () => {
          await setCard({ busy: true, error: '' })
          const res = await post($, 'plan-draft/accept', { draft, ...(source.focus.length ? { focus: source.focus } : {}), ...(source.markers.length ? { markers: source.markers } : {}) }, { quiet: true, reload: ['tracking', 'plan-draft'] })
          const plan = res.json.plan as { version?: number } | undefined
          if (res.ok && plan?.version) await setCard({ busy: false, adopted: plan.version })
          else await setCard({ busy: false, error: Array.isArray(res.json.problems) ? (res.json.problems as string[]).join(' ') : typeof res.json.error === 'string' ? res.json.error : '没有采用，请稍后再试' })
        })()
      },
      undoCheckins: (items) => {
        void (async () => {
          await setCard({ busy: true })
          for (const item of items) await post($, 'checkin', { item, done: null }, { quiet: true, reload: ['tracking'] })
          await setCard({ busy: false, undone: true })
        })()
      },
      fill: (text) => void $.prompt.fill({ text, mode: 'replace' }),
      open: (tab) => void openPane($, (TAB_WORDS[tab] ?? tab) as Tab),
    }, Math.max(40, (e.viewport?.columns ?? 100) - 4))
    return tree ?? next(e)
  })

  // The card above says what the call did; the raw JSON under it stays out of the transcript (ctrl+o shows it).
  on('ui.render', { component: 'ToolResult', props: { tool: /^mcp__longpi__/ } }, async ($, e, next) => {
    if (e.props.isErrored) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  on('tool.call', { tool: /^mcp__longpi__/ }, async ($, e) => {
    const rt = runtime()
    if (!rt) return { deny: 'LongPi is still starting.' }
    const name = String(e.tool).slice(TOOL_PREFIX.length)
    const { tool: _tool, tool_use_id: callId, ...args } = e as unknown as Record<string, unknown> & { tool: string; tool_use_id: string }
    const session = await $.session.id()
    // Values go into the record only with the person's consent: the first time, ask in a dialog.
    if (CONSENT_TOOLS.includes(name) && !(await consentGiven(rt))) {
      const who = await activeLabel(rt)
      let answer: string | null = null
      try {
        answer = await $.ui.ask(who
          ? `LongPi 要把${who}的检查数值存进这台电脑上的健康档案，用来算结果、定方案。你已经告诉${who}，${who}也同意了吗？`
          : 'LongPi 要把报告里的数值存进这台电脑上的健康档案，用来算身体年龄、心血管风险和方案。同意 LongPi 这样使用你的体检、化验、血压、体重和用药等健康信息吗？可以随时在「设置」里撤回。', { options: ['同意', '不同意'], header: 'LongPi' })
      } catch {
        answer = null
      }
      if (answer !== '同意') return { deny: 'The person did not agree to LongPi keeping their health information. Nothing was saved. Say so in one line; they can agree later in /longpi.' }
      await post($, 'consent', { accept: true }, { quiet: true })
      await post($, 'privacy/consent', { scope: 'pipl_sensitive', decision: 'granted' }, { quiet: true })
      await post($, 'privacy/consent', { scope: 'data_flow_deepseek', decision: 'granted' }, { quiet: true, reload: ['privacy', 'journey'] })
    }
    const out = await runTool(rt, name, args, async (reason) => {
      try {
        return (await $.ui.ask(reason, { options: ['同意', '不同意'], header: 'LongPi' })) === '同意'
      } catch {
        return false
      }
    }, session, String(callId ?? ''))
    if (out.denied) return { deny: out.denied }
    if (name === 'prepare_doctor_brief') out.text = await printableBrief($, out.text)
    await update($, healthTurn, () => true)
    const firstTime = !(await read($, coach))
    const context = firstTime ? await enterCoach($) : []
    // A write the pane shows: read its data again.
    if ((WRITE_TOOLS as readonly string[]).includes(name) || RECORD_TOOLS.includes(name)) {
      // The Codex series are rebuilt from the new values first, so a pack opened next can use them.
      void (RECORD_TOOLS.includes(name) ? op(() => recordChanged()) : Promise.resolve())
        .catch(() => undefined)
        .then(() => reloadAfter($, ['tracking', 'codex', 'codex/slot', 'indicators?area=labs', 'game']))
    }
    return context.length > 0 ? { result: out.text, context } : { result: out.text }
  })

  on('command.run', { command: 'longpi' }, async ($, e) => {
    const rt = runtime()
    const arg = e.args.trim()
    const [first = '', ...rest] = arg.split(/\s+/)
    if (!rt) return { text: 'LongPi 还在启动，请稍等几秒再试。' }
    if (first === 'status') {
      return { text: `LongPi：${rt.ctx.toolDefs.size} 个工具，方法库 ${rt.skillsHome || '未安装'}，Python ${rt.python || '未找到'}` }
    }
    if (first === 'setup' || first === '安装' || first === '更新') {
      void setupLongPi($, true)
      return { text: '正在安装或更新 LongPi 的方法库和计算环境，进度在状态栏，完成后会提示。' }
    }
    if (first === '新研究' || first === '文献' || first === 'research') {
      void (async () => {
        $.ui.status('LongPi · 正在找本周的新研究…')
        const out = await weekly($, true).catch(() => null)
        $.ui.status(undefined)
        if (out && out.cards > 0) {
          await update($, view, (v) => ({ ...v, tab: 'codex' as const, detail: null, sub: { ...v.sub, 'codex.tab': 'library', 'codex.chapter': 'new', 'codex.tier': '' } }))
          await toastNotice($, `长寿图鉴 · 上架了 ${out.cards} 张新研究卡`, 'good')
          await openPane($)
        } else await toastNotice($, `这次没有新研究卡上架：${out?.reason || '请稍后再试'}`, 'warn')
      })().catch(() => undefined)
      return { text: '正在从 PubMed 找过去一周的高质量衰老研究，写成图鉴卡，一两分钟。' }
    }
    if (first === '演示模式' || first === 'present') {
      const turnOn = !(await read($, privacy)).presentation
      await setPresentation($, turnOn)
      return { text: turnOn ? '演示模式已打开：LongPi 不再显示个人数字和提醒。再输入一次 /longpi 演示模式 关闭。' : '演示模式已关闭。' }
    }
    const tab = TAB_WORDS[first]
    if (arg === '') {
      await openPane($)
      return {}
    }
    if (tab) {
      await openPane($, tab)
      if (rest.length > 0) sayAsPerson($, rest.join(' '))
      return {}
    }
    sayAsPerson($, arg)
    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    await read($, tick)
    const v = await read($, view)
    const cache = await read($, data)
    const p = await read($, privacy)
    const n = await read($, notice)
    const o = await read($, overlay)
    const now = Date.now()
    stageColsNow = stageCols(pageWidth(e.props.bodyColumns))
    paneDrawnAt = now
    paneWidthNow = pageWidth(e.props.bodyColumns)
    const party = await read($, celebrate)
    if (v.tab === 'overview' && !idleTimer && !party && o.kind === 'none') $.clock.after(IDLE_MS, () => startIdle($))
    const ctx: Ctx = {
      E: $.ui.resolve(e),
      surface: e.surface,
      width: pageWidth(e.props.bodyColumns),
      view: v,
      route: (path) => cache[path],
      json: <T,>(path: string) => {
        const held = cache[path]
        return (held && held.status === 200 ? held.json : null) as T | null
      },
      privacy: { ...p, shown: !p.presentation && p.showUntil > now },
      overlay: o,
      celebrate: party,
      act: actionsFor($, e.surface),
      now,
      today: isoDay(new Date(now)),
    }
    return paneTree(ctx, n && now - n.at < 8_000 ? n.text : null)
  })

  void PAGES
}
