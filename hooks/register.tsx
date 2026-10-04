import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { LongPiView } from '../types'
import type { Io } from './sys/host.ts'
import { boot, flushPending, runtime, runTool, toolSpecs, TOOL_PREFIX } from './app/runtime.ts'

type Engine = EngineInterface

const view = atom({ plugin: 'longpi', key: 'view' } as const, { tab: 'home' } as LongPiView)

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
    config: own,
  })
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await startCore($)
    const rt = runtime()
    if (rt) for (const spec of toolSpecs(rt)) await $.tool.register(spec)
    await $.command.register({ name: 'longpi', description: 'LongPi 长寿教练：健康页、长寿图鉴、方案与打卡', argumentHint: '[概览|指标|方案|图鉴|档案|setup|status]' })
    $.clock.every(3_000, () => {
      void flushPending()
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
    return { result: out.text }
  })

  on('command.run', { command: 'longpi' }, async ($, e) => {
    const rt = runtime()
    const arg = e.args.trim()
    if (arg === 'status' || !rt) {
      return { text: rt ? `LongPi ready: ${rt.ctx.toolDefs.size} tools, ${rt.ctx.routes.size} routes, library ${rt.skillsHome || 'not found'}, python ${rt.python || 'not found'}` : 'LongPi is starting.' }
    }
    await update($, view, (v) => ({ ...v, tab: arg || 'home' }))
    await $.ui.open({ id: 'longpi', title: 'LongPi', focus: true })
    return { text: 'LongPi' }
  })

  on('ui.render', { component: 'Pane', requestId: 'longpi' }, async ($, e) => {
    const v = await read($, view)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Text>LongPi · {v.tab}</Text>
      </Box>
    )
  })
}
