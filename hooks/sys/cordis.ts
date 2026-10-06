// A stand-in for the slice of DeepSeek Harness's plugin context (cordis) the LongPi core registers with:
// tools, tool approval hooks, routes, commands, prompt sections, skills, agent events and the model
// service. register.tsx owns one HostContext and serves each piece through Claude Code: tools become
// mcp__longpi__* tools, routes are called in process by the panes, an 'ask' decision becomes a dialog.

import { host } from './host.ts'
import { vfs } from './vfs.ts'
import { IncomingMessage, ServerResponse } from './http.ts'

export type ToolParams = Record<string, ParamSpec>
export type ParamSpec = {
  type?: string | string[]
  description?: string
  required?: boolean
  enum?: readonly unknown[]
  items?: ParamSpec
  properties?: Record<string, ParamSpec>
  additionalProperties?: boolean | ParamSpec
  minimum?: number
  maximum?: number
  default?: unknown
  [key: string]: unknown
}

export type ToolDef = {
  name: string
  description: string
  parameters: ToolParams
  output?: { schema?: unknown; render?: (args: unknown, value: unknown) => Array<{ type: 'text'; text: string }> }
  timeoutMs?: number
  isConcurrencySafe?: (args?: unknown) => boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (args: any, exec?: any) => Promise<unknown> | unknown
}

export type Decision = { kind: 'allow' } | { kind: 'ask'; reason: string } | { kind: 'deny'; reason: string }
export type ExecInfo = { name: string; arguments: unknown; agent: { id: string; sessionId: string }; id: string }
export type PreHook = (exec: ExecInfo, next: () => Promise<Decision>) => Promise<Decision> | Decision
export type PostHook = (exec: ExecInfo, result: { isError: boolean; value: unknown }, next: () => Promise<unknown>) => Promise<unknown> | unknown

export type RouteHandler = (req: IncomingMessage, res: ServerResponse) => void

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any

/** What the core's registrars see as `ctx`. */
export class HostContext {
  readonly toolDefs = new Map<string, ToolDef>()
  readonly routes = new Map<string, { kind: 'exact' | 'prefix'; handler: RouteHandler }>()
  readonly commandDefs = new Map<string, { name: string; description: string; handler: (invocation: { rawInput: string }) => unknown }>()
  readonly sections = new Map<string, { name: string; order: number; text: string | (() => string) }>()
  readonly skillDefs = new Map<string, { name: string; description: string; content: string }>()
  readonly events = new Map<string, AnyFn[]>()

  readonly tools = {
    register: (def: ToolDef) => {
      this.toolDefs.set(def.name, def)
      return () => this.toolDefs.delete(def.name)
    },
  }

  readonly webServer = {
    register: (route: { kind: 'exact' | 'prefix'; path: string; handler: RouteHandler }) => {
      this.routes.set(route.path, { kind: route.kind, handler: route.handler })
      return () => this.routes.delete(route.path)
    },
  }

  readonly commands = {
    register: (def: { name: string; description: string; handler: (invocation: { rawInput: string }) => unknown }) => {
      this.commandDefs.set(def.name, def)
      return () => this.commandDefs.delete(def.name)
    },
  }

  readonly systemPrompt = {
    section: (section: { name: string; order: number; text: string | (() => string) }) => {
      this.sections.set(section.name, section)
      return () => this.sections.delete(section.name)
    },
  }

  readonly skills = {
    register: (skill: { name: string; description: string; content: string }) => {
      this.skillDefs.set(skill.name, skill)
      return () => this.skillDefs.delete(skill.name)
    },
    registerProvider: (_create: unknown) => () => undefined,
  }

  /** DSH's login fence: here every caller is the person at this terminal. */
  readonly connection = { requestRejection: (_req?: unknown): number | undefined => undefined }

  readonly slots = { inject: () => undefined, register: () => undefined }

  private readonly services: Record<string, unknown> = {}

  constructor() {
    this.services.tools = this.tools
    this.services.webServer = this.webServer
    this.services.commands = this.commands
    this.services.systemPrompt = this.systemPrompt
    this.services.skills = this.skills
    this.services.connection = this.connection
    this.services.llm = {
      stream: (options: Record<string, unknown>) => streamFromComplete(options),
    }
    this.services.agentDefaultModel = { currentSelection: () => ({ provider: 'claude-code', model: 'session' }) }
  }

  on(event: string, handler: AnyFn, _options?: { prepend?: boolean }): () => void {
    this.events.set(event, [...(this.events.get(event) ?? []), handler])
    return () => this.events.set(event, (this.events.get(event) ?? []).filter((item) => item !== handler))
  }

  inject(names: readonly string[], callback: (scoped: any) => void): void {
    if (names.every((name) => name in this.services)) callback(this)
  }

  /** cordis ctx.effect: run now; the disposer runs when the mod unloads (never, within a session). */
  effect(fn: () => unknown, _label?: string): void {
    try {
      fn()
    } catch {
      // the effect's own failure
    }
  }

  get(name: string): unknown {
    return this.services[name]
  }

  logger(name: string) {
    const log = (level: string) => (...parts: unknown[]) => {
      try {
        host().io.log(`[${name}] ${level}: ${parts.map(String).join(' ')}`)
      } catch {
        // no host yet
      }
    }
    return { info: log('info'), warn: log('warn'), error: log('error'), debug: log('debug') }
  }

  /** tools/pre-execute listeners, outermost first (the last registered runs first, as in cordis). */
  async decide(exec: ExecInfo): Promise<Decision> {
    const hooks = [...(this.events.get('tools/pre-execute') ?? [])] as PreHook[]
    const run = async (index: number): Promise<Decision> => {
      if (index < 0) return { kind: 'allow' }
      const hook = hooks[index] as PreHook
      return hook(exec, () => run(index - 1))
    }
    return run(hooks.length - 1)
  }

  async afterExecute(exec: ExecInfo, result: { isError: boolean; value: unknown }): Promise<void> {
    const hooks = [...(this.events.get('tools/post-execute') ?? [])] as PostHook[]
    const run = async (index: number): Promise<unknown> => {
      if (index < 0) return undefined
      const hook = hooks[index] as PostHook
      return hook(exec, result, () => run(index - 1))
    }
    await run(hooks.length - 1)
  }

  emit(event: string, ...args: unknown[]): void {
    for (const handler of this.events.get(event) ?? []) {
      try {
        const out = handler(...args, async () => undefined)
        if (out && typeof (out as Promise<unknown>).catch === 'function') (out as Promise<unknown>).catch(() => undefined)
      } catch {
        // a listener's failure stays its own
      }
    }
  }

  /** Call a registered route the way the web page did, and read its JSON answer. */
  async call(method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown; text: string; headers: Record<string, string> }> {
    const bare = path.split('?')[0] ?? path
    let route = this.routes.get(bare)
    if (!route) {
      for (const [prefix, candidate] of this.routes) {
        if (candidate.kind === 'prefix' && bare.startsWith(prefix)) {
          route = candidate
          break
        }
      }
    }
    if (!route) return { status: 404, json: { ok: false, error: `no route ${bare}` }, text: '', headers: {} }
    const req = new IncomingMessage()
    req.method = method.toUpperCase()
    req.url = path
    req.headers = { host: '127.0.0.1', 'content-type': 'application/json', origin: 'http://127.0.0.1' }
    const res = new ServerResponse()
    const done = new Promise<{ status: number; headers: Record<string, string>; body: string }>((resolve) => res.setDone(resolve))
    route.handler(req, res)
    const text = body === undefined ? '' : JSON.stringify(body)
    req.emit('data', new TextEncoder().encode(text))
    req.emit('end')
    const out = await done
    let json: unknown = null
    try {
      json = out.body ? JSON.parse(out.body) : null
    } catch {
      json = null
    }
    return { status: out.status, json, text: out.body, headers: out.headers }
  }
}

/** The model service the core's one-shot calls stream from, answered by Claude through the engine. */
async function* streamFromComplete(options: Record<string, unknown>): AsyncIterable<{ type: string; text?: unknown; usage?: Record<string, number>; reason?: { kind: string } }> {
  const messages = Array.isArray(options.messages) ? options.messages as Array<{ role?: string; content?: unknown }> : []
  const system = typeof options.system === 'string' ? options.system
    : Array.isArray(options.system) ? (options.system as Array<{ text?: string }>).map((part) => part.text ?? '').join('\n') : ''
  const text = messages.map((message) => {
    const content = typeof message.content === 'string' ? message.content
      : Array.isArray(message.content) ? (message.content as Array<{ text?: string }>).map((part) => part.text ?? '').join('\n') : ''
    return `${message.role ?? 'user'}: ${content}`
  }).join('\n\n')
  const tools = Array.isArray(options.tools) ? options.tools as Array<{ name?: string; parameters?: unknown; input_schema?: unknown }> : []
  const emit = tools.find((tool) => tool.name === 'emit')
  const ask = emit
    ? `${text}\n\nAnswer with one JSON object only, matching this schema (no prose, no code fence):\n${JSON.stringify(emit.parameters ?? emit.input_schema ?? {})}`
    : text
  // A model call takes seconds to minutes: the copy is let go meanwhile, so nothing else waits behind it.
  const token = vfs.current()
  const answer = await vfs.outside(token, () => host().io.complete(ask, { system, maxTokens: typeof options.maxTokens === 'number' ? options.maxTokens : 2000 }))
  if (!answer.ok) {
    yield { type: 'finish', reason: { kind: 'error' } }
    return
  }
  yield { type: 'text-delta', text: answer.text }
  yield { type: 'finish', reason: { kind: 'stop' } }
}

export type Context = HostContext

/** The cordis Schema the core never needs at run time in the mod (config.ts has plain defaults). */
export default HostContext
