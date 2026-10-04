// LongPi in Claude Code. This file holds the engine ($): it boots the ported LongPi core (app/runtime.ts),
// serves the core's tools to Claude, opens the LongPi pane, keeps the pane's data, and runs what a press asks.
// Everything it draws comes from the pure modules under ui/.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderSurface } from 'claude-code'

import type { CodexOverlay, LongPiView, PrivacyState, RouteCache, Tab } from '../types'
import type { Io } from './sys/host.ts'
import { boot, flushPending, route, runtime, runTool, toolSpecs, TOOL_PREFIX } from './app/runtime.ts'
import { isoDay } from './core/interventions.ts'
import { WRITE_TOOLS } from './core/agents/orchestrator.ts'
import { pageOf, PAGES } from './ui/pages/index.ts'
import { pageWidth, paneTree } from './ui/pane.tsx'
import type { Actions, CodexActions, Ctx, PostResult } from './ui/types.ts'
import { isAnimated, stageAt, stageCols } from './ui/codex/stage.ts'

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

/** Read one route into the cache. `fetchPath` may carry ?refresh=1 while the cache key stays the bare path. */
async function loadRoute($: Engine, path: string, force = false, fetchPath = path): Promise<void> {
  const rt = runtime()
  if (!rt) return
  const now = await $.clock.now()
  const held = (await read($, data))[path]
  // A load caught by a reload (the state outlives the module) is stale after 30 s, never stuck.
  const inFlight = Boolean(held?.loading) && now - (held?.at ?? 0) < 30_000
  if (held && !force && (inFlight || (held.status === 200 && now - held.at < FRESH_MS))) return
  if (held && force && inFlight) return
  await update($, data, (all) => ({ ...all, [path]: { ...(all[path] ?? EMPTY), loading: true, at: now } }))
  let next: RouteCache
  try {
    const out = await route(rt, 'GET', `/api/longpi/${fetchPath}`)
    const json = out.json as { error?: unknown } | null
    next = { at: await $.clock.now(), status: out.status, json: out.json, loading: false, error: out.status === 200 ? '' : typeof json?.error === 'string' ? json.error : `HTTP ${out.status}` }
  } catch (error) {
    next = { at: await $.clock.now(), status: 0, json: null, loading: false, error: error instanceof Error ? error.message : String(error) }
  }
  await update($, data, (all) => ({ ...all, [path]: next }))
}

async function loadRoutes($: Engine, paths: readonly string[], force = false): Promise<void> {
  for (const path of paths) await loadRoute($, path, force)
}

async function routesOfView($: Engine): Promise<string[]> {
  const v = await read($, view)
  return ['journey', 'people', ...pageOf(v.tab).routes(v)]
}

/** The 刷新 button: journey and tracking rebuilt from the record, every route of the page read again. */
async function refreshAll($: Engine): Promise<void> {
  await loadRoute($, 'journey', true, 'journey?refresh=1')
  const paths = (await routesOfView($)).filter((path) => path !== 'journey')
  for (const path of paths) await loadRoute($, path, true, path === 'tracking' ? 'tracking?refresh=1' : path)
}

/** After a write: what the page named, and the journey (every page's header reads it). */
async function reloadAfter($: Engine, paths: readonly string[]): Promise<void> {
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
  // The page's data is read again behind the answer: a press never waits on a journey rebuild.
  void reloadAfter($, options.reload ?? [])
  return { ok, status: out.status, json }
}

// --- talking to Pi ----------------------------------------------------------------------------------

const PERSON_FRAME = '[LongPi] The person opened this from LongPi. Speak as Pi, their longevity coach; the LongPi snapshot below is from the plugin, not their words.'

function sayAsPerson($: Engine, text: string): void {
  void $.prompt.submit({ text, asUser: true })
}

// --- the actions a page's press runs ------------------------------------------------------------------

async function go($: Engine, tab: Tab, sub?: Record<string, string>): Promise<void> {
  await update($, view, (v) => ({ tab, sub: { ...v.sub, ...(sub ?? {}) }, detail: null }))
  await loadRoutes($, await routesOfView($))
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
  const act = (body: Record<string, unknown>) => post($, 'codex', body, { reload: ['codex', 'codex/slot', 'codex/library'] })
  const payloadPatch = (patch: Record<string, unknown>) => setOverlay($, (o) => ({ ...o, payload: { ...((o.payload as Record<string, unknown> | null) ?? {}), ...patch } }))
  return {
    open: (kind, id, payload, phase = 'front') => {
      void setOverlay($, () => ({ ...NO_OVERLAY, kind, id, phase, since: Date.now(), payload }))
      if (kind === 'study') {
        void post($, 'codex', { action: 'read', card_id: id }, { quiet: true, reload: ['codex/library'] }).then(async (res) => {
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
    setSub: (key, value) => void update($, view, (v) => ({ ...v, sub: { ...v.sub, [key]: value } })),
    detail: (id) => void update($, view, (v) => ({ ...v, detail: id })),
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
    setPresentation: (on) => void update($, privacy, (p) => ({ ...p, presentation: on, showUntil: 0 })),
    codex: codexActions($),
    close: () => void $.ui.close({ id: PANE }),
  }
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
}

async function openPane($: Engine, tab?: Tab): Promise<void> {
  if (tab) await update($, view, (v) => ({ ...v, tab, detail: null }))
  await $.ui.open({ id: PANE, title: 'LongPi', focus: true, columns: 92 })
  void loadRoutes($, await routesOfView($))
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await startCore($)
    const rt = runtime()
    if (rt) for (const spec of toolSpecs(rt)) await $.tool.register(spec)
    await $.command.register({ name: 'longpi', description: 'LongPi 长寿教练：健康页、长寿图鉴、方案与打卡', argumentHint: '[总览|化验|方案|图鉴|档案|设置|setup|演示模式|你想问的话]' })
    await update($, booted, () => true)
    $.clock.every(3_000, () => {
      void flushPending()
    })
    $.clock.every(60_000, () => {
      void update($, tick, (t) => t + 1)
    })
    return next(e)
  })

  on('tool.call', { tool: /^mcp__longpi__/ }, async ($, e) => {
    const rt = runtime()
    if (!rt) return { deny: 'LongPi is still starting.' }
    const name = String(e.tool).slice(TOOL_PREFIX.length)
    const { tool: _tool, tool_use_id: callId, ...args } = e as unknown as Record<string, unknown> & { tool: string; tool_use_id: string }
    const session = await $.session.id()
    const out = await runTool(rt, name, args, async (reason) => {
      try {
        return (await $.ui.ask(reason, { options: ['同意', '不同意'], header: 'LongPi' })) === '同意'
      } catch {
        return false
      }
    }, session, String(callId ?? ''))
    if (out.denied) return { deny: out.denied }
    // A write the pane shows: read its data again.
    if ((WRITE_TOOLS as readonly string[]).includes(name) || name === 'record_measurements') void reloadAfter($, ['tracking', 'codex', 'codex/slot', 'indicators?area=labs'])
    return { result: out.text }
  })

  on('command.run', { command: 'longpi' }, async ($, e) => {
    const rt = runtime()
    const arg = e.args.trim()
    const [first = '', ...rest] = arg.split(/\s+/)
    if (!rt) return { text: 'LongPi 还在启动，请稍等几秒再试。' }
    if (first === 'status') {
      return { text: `LongPi：${rt.ctx.toolDefs.size} 个工具，方法库 ${rt.skillsHome || '未安装'}，Python ${rt.python || '未找到'}` }
    }
    if (first === '演示模式' || first === 'present') {
      const turnOn = !(await read($, privacy)).presentation
      await update($, privacy, (p) => ({ ...p, presentation: turnOn, showUntil: 0 }))
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
      act: actionsFor($, e.surface),
      now,
      today: isoDay(new Date(now)),
    }
    return paneTree(ctx, n && now - n.at < 8_000 ? n.text : null)
  })

  void PAGES
  void PERSON_FRAME
}
