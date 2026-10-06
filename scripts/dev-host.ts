// A Node stand-in for the Claude Code engine, for development and tests: the same runtime the mod boots,
// with Node's own file system, processes and network as its Io. Run with
//   node --experimental-transform-types scripts/dev-host.ts <command> [args]
// HOME defaults to a scratch home (LONGPI_DEV_HOME) so a run never touches the real ~/.longpi.

import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { boot, route, runTool, runtime, flushPending } from '../hooks/app/runtime.ts'
import type { Io } from '../hooks/sys/host.ts'

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const home = process.env.LONGPI_DEV_HOME ?? '/tmp/longpi-dev-home'
const timers = new Set<NodeJS.Timeout>()

const io: Io = {
  read: (path) => readFile(path, 'utf8'),
  readBase64: async (path) => (await readFile(path)).toString('base64'),
  write: async (path, text) => {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, text)
  },
  list: async (path) => {
    const entries = await readdir(path, { withFileTypes: true })
    const out = []
    for (const entry of entries) {
      const full = `${path}/${entry.name}`
      const s = await stat(full).catch(() => null)
      out.push({ name: entry.name, kind: entry.isDirectory() ? 'directory' as const : entry.isFile() ? 'file' as const : 'other' as const, size: entry.isFile() ? s?.size ?? 0 : 0, mtimeMs: entry.isFile() ? s?.mtimeMs ?? 0 : 0 })
    }
    return out
  },
  stat: async (path) => {
    const s = await stat(path).catch(() => null)
    return s ? { kind: s.isDirectory() ? 'directory' as const : s.isFile() ? 'file' as const : 'other' as const, size: s.size, mtimeMs: s.mtimeMs } : null
  },
  run: (argv, init) => new Promise((done) => {
    const child = execFile(argv[0] as string, argv.slice(1), { cwd: init?.cwd, env: init?.env ? { ...process.env, ...init.env } : process.env, timeout: init?.timeoutMs ?? 30_000, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      const code = error && typeof (error as { code?: unknown }).code === 'number' ? (error as { code: number }).code : error ? 1 : 0
      done({ exitCode: code, stdout: String(stdout), stderr: String(stderr) })
    })
    if (init?.stdin !== undefined) {
      child.stdin?.write(init.stdin)
      child.stdin?.end()
    }
  }),
  fetch: async (url, init) => {
    const res = await fetch(url, { method: init?.method ?? 'GET', headers: init?.headers, body: init?.body })
    const headers: Record<string, string> = {}
    res.headers.forEach((value, key) => { headers[key] = value })
    return { status: res.status, ok: res.ok, text: await res.text(), headers }
  },
  // The model, when a dev run asks for one (LONGPI_DEV_MODEL=1): claude -p with no plugins.
  complete: async (prompt, options) => {
    if (!process.env.LONGPI_DEV_MODEL) return { ok: false, reason: 'no model in the dev host' }
    const text = `${options?.system ? `${options.system}\n\n` : ''}${prompt}`
    return new Promise((done) => {
      const child = execFile('claude', ['-p', '--model', options?.model ?? 'sonnet', '--output-format', 'text'], { maxBuffer: 16 * 1024 * 1024, timeout: 600_000, env: { ...process.env, CLAUDE_CODE_PLUGIN_DIRS: '' } }, (error, stdout) => {
        done(error ? { ok: false, reason: String(error.message).slice(0, 200) } : { ok: true, text: String(stdout) })
      })
      child.stdin?.write(text)
      child.stdin?.end()
    })
  },
  now: async () => Date.now(),
  log: (line) => { if (process.env.LONGPI_DEV_LOG) console.error(`[log] ${line}`) },
}

export async function devBoot() {
  const env: Record<string, string> = { HOME: home, PATH: process.env.PATH ?? '', LANG: 'zh_CN.UTF-8', TMPDIR: '/tmp' }
  if (process.env.LONGEVITY_SKILLS_HOME) env.LONGEVITY_SKILLS_HOME = process.env.LONGEVITY_SKILLS_HOME
  return boot({
    io, pluginRoot, home, env, platform: process.platform,
    schedule: (ms, fn) => {
      const t = setTimeout(() => { timers.delete(t); fn() }, ms)
      t.unref()
      timers.add(t)
      return () => { clearTimeout(t); timers.delete(t) }
    },
    config: process.env.LONGPI_HOME ? { dataDir: process.env.LONGPI_HOME } : {},
  })
}

async function main() {
  const [command = 'status', ...rest] = process.argv.slice(2)
  const rt = await devBoot()
  if (command === 'status') {
    console.log(JSON.stringify({ tools: rt.ctx.toolDefs.size, routes: [...rt.ctx.routes.keys()], skillsHome: rt.skillsHome, python: rt.python }, null, 2))
  } else if (command === 'together') {
    // Several routes at once (dev: does a slow one hold the others up?)
    const t0 = Date.now()
    await Promise.all(process.argv.slice(3).map(async (path) => {
      const out = await route(rt, 'GET', path)
      console.log(`${path} ${out.status} at ${Date.now() - t0} ms`)
    }))
  } else if (command === 'repeat') {
    // GET a route several times in one process, timing each (dev: does the core cache it?)
    const times = Number(process.argv[4] ?? 3)
    for (let i = 0; i < times; i += 1) {
      const t0 = Date.now()
      const out = await route(rt, 'GET', process.argv[3] as string)
      console.log(`#${i + 1} ${out.status} ${Date.now() - t0} ms`)
      await new Promise((done) => setTimeout(done, Number(process.argv[5] ?? 0)))
    }
  } else if (command === 'get' || command === 'post') {
    const [path = '/', body] = rest
    const out = await route(rt, command.toUpperCase(), path, body ? JSON.parse(body) : undefined)
    console.log(JSON.stringify(out, null, 2))
  } else if (command === 'journey') {
    const { buildJourneyFull } = await import('../hooks/core/journey.ts')
    const { op } = await import('../hooks/app/runtime.ts')
    const out = await op(async () => buildJourneyFull(await rt.app.journeyContext()))
    console.log(JSON.stringify(out.journey, null, 2))
  } else if (command === 'dump') {
    const [dir = '/tmp/longpi-fixtures'] = rest
    const { mkdirSync, writeFileSync } = await import('node:fs')
    mkdirSync(dir, { recursive: true })
    const paths = ['journey', 'tracking', 'board', 'indicators', 'codex', 'codex/library', 'codex/slot', 'plan-draft', 'followup', 'profile', 'self',
      'memory', 'triage', 'brief', 'findings', 'meds', 'conditions', 'stores', 'feedback', 'surfaces', 'privacy', 'science/studies', 'science/community',
      'science/registry', 'science/transparency', 'science/translog', 'analysis', 'people', 'intro', 'usage', 'schedule', 'stats', 'intents', 'member-file',
      'version', 'connection', 'consent', 'workspace', 'science/invite']
    for (const path of paths) {
      const out = await route(rt, 'GET', `/api/longpi/${path}`)
      writeFileSync(`${dir}/${path.replace(/\//g, '_')}.json`, JSON.stringify(out, null, 2))
      console.log(path, out.status, JSON.stringify(out.json).length)
    }
  } else if (command === 'scout') {
    const { scoutLiterature } = await import('../hooks/app/literature.ts')
    const out = await scoutLiterature(io, rt.rootDir, new Date())
    console.log(JSON.stringify(out, null, 2))
  } else if (command === 'tool') {
    const [name = '', args = '{}'] = rest
    const out = await runTool(rt, name, JSON.parse(args), async () => true, 'dev-session', 'dev-call')
    console.log(out.text)
  }
  // Background work the command started (a series refresh after a journey build) finishes before exit.
  if (process.env.LONGPI_DEV_WAIT) await new Promise((done) => setTimeout(done, Number(process.env.LONGPI_DEV_WAIT)))
  await flushPending()
  void runtime
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1) })
}
