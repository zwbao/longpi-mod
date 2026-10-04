// The LongPi core inside Claude Code: boots the ported plugin against the engine's I/O (sys/host.ts),
// keeps its file copy in step with the disk (sys/vfs.ts), and serves its tools and routes to register.tsx.
// Nothing here touches the engine directly: register.tsx hands in an Io and the callbacks it needs.

import { installHost, host, type Io } from '../sys/host.ts'
import { installGlobals } from '../sys/globals.ts'
import { installScheduler } from '../sys/timers.ts'
import { vfs } from '../sys/vfs.ts'
import { join } from '../sys/path.ts'
import { setCwd } from '../sys/path.ts'
import { HostContext, type ParamSpec, type ToolDef } from '../sys/cordis.ts'
import { apply, configFrom, type Config, type LongPiApp } from '../core/index.ts'
import { resolveDataDir, resolveRootDir, skillsHomeCandidates } from '../core/paths.ts'
import { setRecordDir } from '../core/mcp.ts'
import { setRevision } from '../core/catalog.ts'
import { registerRecordTools } from './record-tool.ts'
import { newer } from './setup.ts'
import { registerGame } from './game.ts'

function localDay(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`
}

export type Runtime = {
  ctx: HostContext
  app: LongPiApp
  config: Config
  rootDir: string
  skillsHome: string
  python: string
  booted: number
}

let current: Runtime | null = null

export function runtime(): Runtime | null {
  return current
}

/** One core operation at a time, on a copy freshly read from disk, written back when it ends. */
export function op<T>(fn: () => Promise<T> | T): Promise<T> {
  return vfs.exclusive(async () => {
    const io = host().io
    await vfs.sync(io)
    try {
      return await fn()
    } finally {
      await vfs.flush(io)
    }
  })
}

/** Write out what background work (timers, a model call finishing late) left in the copy. */
export async function flushPending(): Promise<void> {
  if (!vfs.hasPending()) return
  await vfs.exclusive(async () => vfs.flush(host().io))
}

async function firstFile(io: Io, paths: readonly string[]): Promise<string> {
  for (const path of paths) {
    if (!path) continue
    const stat = await io.stat(path).catch(() => null)
    if (stat && stat.kind === 'file') return path
  }
  return ''
}

/** The Python the method scripts run with: LongPi's own environment first, else one of the system's (3.9+). */
export async function findPython(io: Io, home: string, configured: string): Promise<string> {
  const venvs = [configured, join(home, '.longpi', '.venv', 'bin', 'python')]
  const found = await firstFile(io, venvs)
  if (found) return found
  for (const name of ['python3.13', 'python3.12', 'python3.11', 'python3.10', 'python3']) {
    const probe = await io.run([name, '-c', 'import sys;print(sys.version_info[:2] >= (3, 9))'], { timeoutMs: 10_000 }).catch(() => null)
    if (probe && probe.exitCode === 0 && probe.stdout.trim() === 'True') return name
  }
  return ''
}

async function versionAt(io: Io, dir: string): Promise<string | null> {
  const stat = await io.stat(join(dir, 'catalog.json')).catch(() => null)
  if (!stat || stat.kind !== 'file') return null
  return (await io.read(join(dir, 'VERSION')).catch(() => '0')).trim() || '0'
}

/**
 * The method library: one the person named (config, LONGEVITY_SKILLS_HOME) as they named it; otherwise the copy that
 * ships in the mod, or the weekly update in ~/.longpi when that one is newer.
 */
export async function findSkillsHome(io: Io, configured: string, pluginRoot = '', home = ''): Promise<string> {
  const explicit = [configured, host().env.LONGEVITY_SKILLS_HOME ?? ''].map((dir) => dir.trim()).filter(Boolean)
  for (const dir of explicit) if (await versionAt(io, dir)) return dir
  const bundled = pluginRoot ? join(pluginRoot, 'library') : ''
  const updated = home ? join(home, '.longpi', 'longevity-skills') : ''
  const vb = bundled ? await versionAt(io, bundled) : null
  const vu = updated ? await versionAt(io, updated) : null
  if (vu && (!vb || newer(vu, vb))) return updated
  if (vb) return bundled
  for (const dir of skillsHomeCandidates(configured)) if (await versionAt(io, dir)) return dir
  return ''
}

/** Load the method library's tables and every method's instructions into the copy, once. */
async function loadLibrary(io: Io, home: string, python: string): Promise<void> {
  for (const file of ['catalog.json', 'intents.json', 'README.md', 'VERSION', '.git/HEAD']) {
    vfs.addRoot({ path: join(home, file), once: true })
  }
  vfs.addRoot({ path: join(home, 'data'), once: true })
  vfs.addRoot({ path: join(home, 'skills', 'longevity-evidence', 'data', 'claims.jsonl'), once: true, maxBytes: 4 * 1024 * 1024 })
  const bulk = python ? await vfs.bulkLoad(io, python, join(home, 'skills'), '^(SKILL\\.md|skill\\.json)$') : false
  if (!bulk) vfs.addRoot({ path: join(home, 'skills'), once: true, maxBytes: 512 * 1024 })
  const rev = await io.run(['git', '-C', home, 'rev-parse', '--short', 'HEAD'], { timeoutMs: 10_000 }).catch(() => null)
  setRevision(home, rev && rev.exitCode === 0 ? rev.stdout.trim() : '')
}

export type BootOptions = {
  io: Io
  pluginRoot: string
  home: string
  env: Record<string, string>
  platform: string
  /** The engine's clock, for the core's timers. */
  schedule: (ms: number, fn: () => void) => () => void
  /** The person's own settings over the defaults. */
  config: Partial<Config>
}

export async function boot(options: BootOptions): Promise<Runtime> {
  installHost({ io: options.io, pluginRoot: options.pluginRoot, home: options.home, env: options.env, platform: options.platform, nowMs: Date.now() })
  installGlobals()
  // A timer that fires while an operation holds the copy runs inside it (the operation writes its changes
  // back when it ends); otherwise it gets an operation of its own. Never queued behind the one running,
  // which may be waiting for this very timer.
  installScheduler((ms, fn) => options.schedule(ms, () => {
    if (vfs.busy) {
      try {
        fn()
      } catch (error) {
        options.io.log(`timer: ${error instanceof Error ? error.message : String(error)}`)
      }
      return
    }
    void op(async () => {
      const out = fn() as unknown
      if (out && typeof (out as Promise<unknown>).then === 'function') await out
    }).catch((error: unknown) => options.io.log(`timer: ${error instanceof Error ? error.message : String(error)}`))
  }))
  setCwd(() => options.home)

  const config = configFrom(options.config)
  const rootDir = resolveRootDir(config.dataDir)
  setRecordDir(() => resolveDataDir(config.dataDir))
  const skillsHome = await findSkillsHome(options.io, config.skillsHome, options.pluginRoot, options.home)
  const python = await findPython(options.io, options.home, config.skillPython)
  if (python && !config.skillPython) config.skillPython = python
  if (skillsHome && !config.skillsHome) config.skillsHome = skillsHome

  vfs.addRoot({ path: rootDir })
  vfs.addRoot({ path: join(options.pluginRoot, 'data'), once: true })
  vfs.addRoot({ path: join(options.pluginRoot, 'skills'), once: true })
  vfs.addRoot({ path: join(options.home, 'longpi', 'analyses'), skipDirs: [] })
  if (skillsHome) await loadLibrary(options.io, skillsHome, python)

  const ctx = new HostContext()
  const app = await op(() => apply(ctx, config))
  registerRecordTools(ctx, () => config.dataDir, () => app.invalidate())
  registerGame(ctx, () => rootDir, () => localDay(new Date()))
  current = { ctx, app, config, rootDir, skillsHome, python, booted: Date.now() }
  if (options.platform === 'darwin') void ensureNotifier(options.io, rootDir)
  return current
}

/**
 * macOS names a notification's sender after the app that posts it: a tiny LongPi.app, compiled once from the
 * script the core writes, makes reminders read 「LongPi」 rather than 「脚本编辑器」.
 */
async function ensureNotifier(io: Io, rootDir: string): Promise<void> {
  const dir = join(rootDir, 'notifier')
  const app = join(dir, 'LongPi.app')
  if (await io.stat(join(app, 'Contents', 'MacOS', 'applet')).catch(() => null)) return
  if (!(await io.stat(join(dir, 'notify.applescript')).catch(() => null))) return
  await io.run(['osacompile', '-o', app, join(dir, 'notify.applescript')], { timeoutMs: 30_000 }).catch(() => undefined)
}

/** Re-read the method library after setup installed or updated it. */
export async function reloadLibrary(): Promise<Runtime | null> {
  const rt = current
  if (!rt) return null
  const io = host().io
  const skillsHome = await findSkillsHome(io, '', host().pluginRoot, host().home)
  const python = await findPython(io, host().home, '')
  if (skillsHome) {
    await loadLibrary(io, skillsHome, python)
    await op(async () => undefined)
    rt.config.skillsHome = skillsHome
  }
  if (python) rt.config.skillPython = python
  rt.skillsHome = skillsHome
  rt.python = python
  rt.app.invalidate()
  return rt
}

// --- tools ---------------------------------------------------------------------------------------------

function schemaOf(spec: ParamSpec): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(spec)) {
    if (key === 'required' && typeof value === 'boolean') continue
    if (key === 'properties' && value && typeof value === 'object') {
      const props = value as Record<string, ParamSpec>
      out.properties = Object.fromEntries(Object.entries(props).map(([name, child]) => [name, schemaOf(child)]))
      const required = Object.entries(props).filter(([, child]) => child.required === true).map(([name]) => name)
      if (required.length > 0) out.required = required
      continue
    }
    if (key === 'items' && value && typeof value === 'object') {
      out.items = schemaOf(value as ParamSpec)
      continue
    }
    out[key] = value
  }
  return out
}

export function inputSchemaOf(def: ToolDef): Record<string, unknown> {
  return schemaOf({ type: 'object', properties: def.parameters ?? {} })
}

export const TOOL_PREFIX = 'mcp__longpi__'

export function toolSpecs(rt: Runtime): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
  return [...rt.ctx.toolDefs.values()].map((def) => ({ name: def.name, description: def.description, inputSchema: inputSchemaOf(def) }))
}

export type ToolOutcome = { text: string; value: unknown; isError: boolean; denied?: string }

function textOf(def: ToolDef, args: unknown, value: unknown): string {
  try {
    const rendered = def.output?.render?.(args, value)
    if (Array.isArray(rendered)) return rendered.map((part) => part.text).join('\n')
  } catch {
    // fall through to JSON
  }
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

/**
 * Run one core tool as the model asked: the core's own approval hooks decide first ('ask' becomes the
 * person's yes or no in a Claude Code dialog), then the tool, then the core's after-hooks (events, read-backs).
 */
export async function runTool(rt: Runtime, name: string, args: Record<string, unknown>, ask: (reason: string) => Promise<boolean>, session: string, callId: string): Promise<ToolOutcome> {
  const def = rt.ctx.toolDefs.get(name)
  if (!def) return { text: `LongPi has no tool ${name}.`, value: null, isError: true }
  const exec = { name, arguments: args, agent: { id: session, sessionId: session, session: { id: session } }, id: callId }
  // A tool given a file outside LongPi's own folders (a CSV, a member file, an analysis export) reads it
  // from the copy: load it first.
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string' && /(^|_)(path|dir|file)$/.test(key) && value.startsWith('/')) {
      await vfs.ensure(host().io, value, { recursive: true, maxBytes: 4 * 1024 * 1024 }).catch(() => undefined)
    }
  }
  const decision = await op(() => rt.ctx.decide(exec))
  if (decision.kind === 'deny') return { text: decision.reason, value: null, isError: true, denied: decision.reason }
  if (decision.kind === 'ask') {
    const yes = await ask(decision.reason)
    if (!yes) return { text: '用户没有同意。', value: null, isError: true, denied: '用户没有同意。' }
  }
  try {
    const value = await op(async () => {
      const out = await def.execute(args, exec)
      await rt.ctx.afterExecute(exec, { isError: false, value: out })
      return out
    })
    return { text: textOf(def, args, value), value, isError: false }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { text: `LongPi tool ${name} failed: ${message}`, value: null, isError: true }
  }
}

/** Call one of the core's routes the way the health page did, inside an operation. */
export async function route<T = unknown>(rt: Runtime, method: string, path: string, body?: unknown): Promise<{ status: number; json: T; text: string }> {
  const answer = await op(() => rt.ctx.call(method, path, body))
  return { status: answer.status, json: answer.json as T, text: answer.json === null ? answer.text : '' }
}

/** A route answer that does not need the copy refreshed first (a second read in the same pass). */
export function rootDirOf(rt: Runtime): string {
  return rt.rootDir
}
