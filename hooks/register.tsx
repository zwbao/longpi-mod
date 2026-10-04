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
  await reloadAfter($, options.reload ?? [])
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

function codexActions($: Engine): CodexActions {
  const act = (body: Record<string, unknown>) => post($, 'codex', body, { reload: ['codex', 'codex/slot'] })
  return {
    openPack: (packId) => void update($, overlay, () => ({ ...NO_OVERLAY, kind: 'pack', id: packId, phase: 'idle', since: Date.now() })),
    flip: (index) => void update($, overlay, (o) => ({ ...o, flipped: o.flipped.map((value, i) => (i === index ? true : value)) })),
    pick: (optionId) => void update($, overlay, (o) => ({ ...o, chosen: optionId })),
    start: (optionId, answers, randomized) => void act({ action: 'start', option: optionId, answers, randomized }).then(() => update($, overlay, () => NO_OVERLAY)),
    reveal: (runId) => void update($, overlay, () => ({ ...NO_OVERLAY, kind: 'reveal', id: runId, phase: 'back', since: Date.now() })),
    showRun: (runId) => void update($, overlay, () => ({ ...NO_OVERLAY, kind: 'result', id: runId, phase: 'front', since: Date.now() })),
    showStudy: (cardId) => void update($, overlay, () => ({ ...NO_OVERLAY, kind: 'study', id: cardId, phase: 'front', since: Date.now() })),
    showSpecies: (key) => void update($, overlay, () => ({ ...NO_OVERLAY, kind: 'species', id: key, phase: 'front', since: Date.now() })),
    closeOverlay: () => void update($, overlay, () => NO_OVERLAY),
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
    const now = Date.now()
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
      act: actionsFor($, e.surface),
      now,
      today: isoDay(new Date(now)),
    }
    return paneTree(ctx, n && now - n.at < 8_000 ? n.text : null)
  })

  void PAGES
  void PERSON_FRAME
  void overlay
}
