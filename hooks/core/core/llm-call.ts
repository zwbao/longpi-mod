// One-shot structured model calls for every out-of-turn agent profile (AA §4.3 PR 2a). dsh has no JSON mode,
// so the answer comes through a forced `emit` tool (or the first {...} in the text); one repair when it
// fails its checks and time is left; otherwise the profile's deterministic fallback. Never throws.

import { randomUUID } from '../../sys/crypto.ts'
import type { Context } from '../../sys/cordis.ts'
import type { AgentProfile, AgentRoute, AgentRunRecord, LlmCall } from '../contracts/agents.ts'
import type { FactPack } from '../contracts/factpack.ts'
import type { TokenUsage } from '../contracts/common.ts'
import { agentConfig, type Config } from '../config.ts'
import type { Budget } from './budget.ts'

interface Chunk { type: string; text?: unknown; block?: { type?: string; name?: string; arguments?: string; text?: string }; usage?: Partial<TokenUsage>; reason?: { kind?: string; failure?: { message?: string } } }
export interface LlmService {
  stream(options: Record<string, unknown>): AsyncIterable<Chunk>
  resolveModelInfo?: (provider: string, model: string, signal?: AbortSignal) => Promise<{ reasoning?: { efforts?: Array<{ id: string }> } } | undefined>
}

function serviceOf<T>(ctx: Context | null | undefined, name: string): T | undefined {
  try {
    const get = (ctx as unknown as { get?: (name: string) => unknown } | null)?.get
    return typeof get === 'function' ? get.call(ctx, name) as T | undefined : undefined
  } catch {
    return undefined
  }
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const inner of Object.values(value as Record<string, unknown>)) freeze(inner)
    Object.freeze(value)
  }
  return value
}

/** The first balanced {...} in a text answer, parsed; null when there is none. */
export function firstJsonObject(text: string): unknown {
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, index + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

export interface LlmCallOptions {
  config: () => Partial<Config>
  budget: Budget | null
  /** The model service; the host's by default. Tests pass a fake. */
  llm?: () => LlmService | undefined
  /** The route when a profile names none: DSH's default model. */
  defaultRoute?: () => { provider: string; model: string } | null
  log?: (message: string) => void
}

export function createLlmCall(ctx: Context | null, options: LlmCallOptions): LlmCall {
  const efforts = new Map<string, string | null>()
  const llmNow = () => options.llm?.() ?? serviceOf<LlmService>(ctx, 'llm')
  const defaultRoute = () => {
    if (options.defaultRoute) return options.defaultRoute()
    try {
      const selection = serviceOf<{ currentSelection?: () => { provider?: unknown; model?: unknown } }>(ctx, 'agentDefaultModel')?.currentSelection?.()
      return typeof selection?.provider === 'string' && typeof selection.model === 'string' ? { provider: selection.provider, model: selection.model } : null
    } catch {
      return null
    }
  }

  const effortFor = async (llm: LlmService, provider: string, model: string, wanted: AgentRoute['reasoningEffort'], signal: AbortSignal): Promise<string | null> => {
    const key = `${provider}\u0000${model}\u0000${wanted}`
    if (efforts.has(key)) return efforts.get(key) ?? null
    let effort: string | null = null
    if (typeof llm.resolveModelInfo === 'function') {
      try {
        const ids = (await llm.resolveModelInfo(provider, model, signal))?.reasoning?.efforts?.map((row) => String(row.id)) ?? []
        effort = wanted === 'off' ? ids.find((id) => /^(?:off|none|disabled)$/i.test(id)) ?? null : ids.find((id) => id === wanted) ?? null
      } catch {
        return null
      }
    }
    efforts.set(key, effort)
    return effort
  }

  const once = async (llm: LlmService, request: { provider: string; model: string; effort: string | null; system: string; user: string; schema: Record<string, unknown>; maxTokens: number; signal: AbortSignal }) => {
    const message = freeze({ id: randomUUID(), role: 'user', content: [{ type: 'text', text: request.user }], source: { kind: 'plugin', plugin: 'dsh-plugin-longpi' } })
    const call = Object.freeze({
      ...freeze({
        provider: request.provider, model: request.model, system: request.system, messages: [message],
        tools: [{ name: 'emit', description: 'Return your answer by calling emit exactly once.', parameters: request.schema }],
        temperature: 0.3, maxTokens: request.maxTokens, ...(request.effort ? { reasoningEffort: request.effort } : {}),
      }),
      signal: request.signal,
    })
    let text = ''
    let args: string | null = null
    const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 }
    let finish = ''
    for await (const chunk of llm.stream(call)) {
      if (chunk.type === 'text-delta') text += String(chunk.text ?? '')
      else if (chunk.type === 'block-end') {
        if (chunk.block?.type === 'tool-call' && chunk.block.name === 'emit' && args == null) args = String(chunk.block.arguments ?? '')
        else if (chunk.block?.type === 'text' && !text) text = String(chunk.block.text ?? '')
      } else if (chunk.type === 'usage' && chunk.usage) {
        usage.inputTokens += chunk.usage.inputTokens ?? 0
        usage.outputTokens += chunk.usage.outputTokens ?? 0
        if (chunk.usage.cacheReadTokens) usage.cacheReadTokens = (usage.cacheReadTokens ?? 0) + chunk.usage.cacheReadTokens
      } else if (chunk.type === 'finish') finish = chunk.reason?.kind ?? ''
    }
    let value: unknown = null
    if (args != null) {
      try {
        value = JSON.parse(args)
      } catch {
        value = firstJsonObject(args)
      }
    }
    if (value == null) value = firstJsonObject(text)
    return { value, usage, finish, text }
  }

  return {
    async structured(req) {
      const started = Date.now()
      const cfg = agentConfig(options.config(), req.profile.id)
      const deadline = cfg.deadlineMs || req.profile.deadline_ms
      const run: AgentRunRecord = {
        profile: req.profile.id, mode: 'one_shot', at: new Date().toISOString(), inputs_fp: req.pack.fp,
        source: 'fallback', attempts: 0, latency_ms: 0, route: { provider: '', model: '', effort: null }, usage: { inputTokens: 0, outputTokens: 0 },
      }
      const fallback = (errors: string[], extra: Partial<AgentRunRecord> = {}) => {
        Object.assign(run, { source: 'fallback', latency_ms: Date.now() - started, errors, ...extra })
        options.budget?.record(run)
        return { value: req.profile.fallback(req.pack, req.extra), run }
      }
      if (!cfg.enabled) return fallback(['disabled'])
      const over = options.budget?.blocked() ?? null
      if (over) return fallback([over], { budget_blocked: true })
      const llm = llmNow()
      const route = cfg.provider && cfg.model ? { provider: cfg.provider, model: cfg.model } : cfg.model ? { provider: defaultRoute()?.provider ?? '', model: cfg.model } : defaultRoute()
      if (!llm || typeof llm.stream !== 'function' || !route?.provider || !route.model) return fallback(['no model route'])
      const signal = AbortSignal.any([req.signal ?? new AbortController().signal, AbortSignal.timeout(deadline)])
      try {
        const effort = await effortFor(llm, route.provider, route.model, cfg.reasoningEffort, signal)
        run.route = { provider: route.provider, model: route.model, effort }
        const system = req.profile.prompt.join('\n\n')
        let user = JSON.stringify(req.profile.input(req.pack, req.extra))
        let errors: string[] = []
        for (let attempt = 1; attempt <= 2; attempt += 1) {
          run.attempts = attempt
          const answer = await once(llm, { provider: route.provider, model: route.model, effort, system, user, schema: req.profile.output_schema as unknown as Record<string, unknown>, maxTokens: cfg.maxTokens, signal })
          run.usage.inputTokens += answer.usage.inputTokens
          run.usage.outputTokens += answer.usage.outputTokens
          if (answer.usage.cacheReadTokens) run.usage.cacheReadTokens = (run.usage.cacheReadTokens ?? 0) + answer.usage.cacheReadTokens
          if (answer.value == null) errors = [`no emit call and no JSON in the answer (finish ${answer.finish || 'none'})`]
          else {
            const checked = req.profile.validate(answer.value, req.pack, req.extra)
            if (checked.ok) {
              Object.assign(run, { source: 'model', latency_ms: Date.now() - started })
              options.budget?.record(run)
              return { value: checked.value, run }
            }
            errors = checked.errors
          }
          // One repair, only while more than 40% of the deadline is left.
          if (attempt === 1 && Date.now() - started < deadline * 0.6) {
            user = `${user}\n\n上一次的输出没有通过检查：${errors.slice(0, 8).join('；')}。请只用输入里给出的事实和数字修正，然后再调用一次 emit。`
            continue
          }
          break
        }
        return fallback(errors)
      } catch (error) {
        return fallback([error instanceof Error ? error.message : String(error)])
      }
    },
    async text(req) {
      const llm = llmNow()
      const route = req.route.provider && req.route.model ? { provider: req.route.provider, model: req.route.model } : defaultRoute()
      if (!llm || !route) return ''
      const signal = AbortSignal.any([req.signal ?? new AbortController().signal, AbortSignal.timeout(req.deadlineMs)])
      try {
        const effort = await effortFor(llm, route.provider, route.model, req.route.reasoningEffort, signal)
        const message = freeze({ id: randomUUID(), role: 'user', content: [{ type: 'text', text: req.user }], source: { kind: 'plugin', plugin: 'dsh-plugin-longpi' } })
        let text = ''
        for await (const chunk of llm.stream(Object.freeze({ ...freeze({ provider: route.provider, model: route.model, system: req.system, messages: [message], temperature: 0, maxTokens: req.route.maxTokens, ...(effort ? { reasoningEffort: effort } : {}) }), signal }))) {
          if (chunk.type === 'text-delta') text += String(chunk.text ?? '')
        }
        return text
      } catch {
        return ''
      }
    },
  }
}

export type { FactPack }
