// Web globals the core calls that the mod environment lacks: fetch (through the engine's network),
// console (into the engine's debug log) and queueMicrotask.

import { host } from './host.ts'
import { installTimerGlobals } from './timers.ts'

class FetchHeaders {
  private map = new Map<string, string>()
  constructor(init?: Record<string, string>) {
    for (const [key, value] of Object.entries(init ?? {})) this.map.set(key.toLowerCase(), value)
  }
  get(name: string): string | null {
    return this.map.get(name.toLowerCase()) ?? null
  }
  has(name: string): boolean {
    return this.map.has(name.toLowerCase())
  }
  forEach(fn: (value: string, key: string) => void): void {
    for (const [key, value] of this.map) fn(value, key)
  }
}

function headersOf(init: unknown): Record<string, string> {
  if (!init) return {}
  if (Array.isArray(init)) return Object.fromEntries(init as Array<[string, string]>)
  if (typeof (init as { forEach?: unknown }).forEach === 'function' && !(init instanceof Object && Object.getPrototypeOf(init) === Object.prototype)) {
    const out: Record<string, string> = {}
    ;(init as { forEach: (fn: (value: string, key: string) => void) => void }).forEach((value, key) => { out[key] = value })
    return out
  }
  return Object.fromEntries(Object.entries(init as Record<string, unknown>).map(([key, value]) => [key, String(value)]))
}

export async function hostFetch(input: string | URL | { url: string }, init: { method?: string; headers?: unknown; body?: unknown; signal?: AbortSignal } = {}) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  if (init.signal?.aborted) throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
  const body = init.body === undefined || init.body === null ? undefined : typeof init.body === 'string' ? init.body : JSON.stringify(init.body)
  const answer = await host().io.fetch(url, { method: init.method ?? 'GET', headers: headersOf(init.headers), ...(body !== undefined ? { body } : {}) })
  const text = answer.text
  return {
    status: answer.status,
    ok: answer.ok,
    statusText: String(answer.status),
    url,
    headers: new FetchHeaders(answer.headers),
    text: async () => text,
    json: async () => JSON.parse(text) as unknown,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer,
  }
}

export function installGlobals(): void {
  installTimerGlobals()
  const g = globalThis as Record<string, unknown>
  if (typeof g.fetch !== 'function') g.fetch = hostFetch
  if (typeof g.queueMicrotask !== 'function') g.queueMicrotask = (fn: () => void) => void Promise.resolve().then(fn)
  if (typeof g.console !== 'object' || g.console === null) {
    const line = (level: string) => (...parts: unknown[]) => {
      try {
        host().io.log(`${level}: ${parts.map((part) => (typeof part === 'string' ? part : JSON.stringify(part))).join(' ')}`)
      } catch {
        // before the host is installed
      }
    }
    g.console = { log: line('log'), info: line('info'), warn: line('warn'), error: line('error'), debug: line('debug') }
  }
}
