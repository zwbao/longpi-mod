// setTimeout and friends on the engine's clock: the mod environment has no timers of its own. The host
// installs `schedule` (backed by $.clock.after) at session start; until then a timer simply never fires.

type Cancel = () => void
type Scheduler = (ms: number, fn: () => void) => Cancel

let schedule: Scheduler | null = null
let nextId = 1
const live = new Map<number, Cancel>()

export function installScheduler(fn: Scheduler): void {
  schedule = fn
}

export function setTimeout(fn: (...args: unknown[]) => void, ms = 0, ...args: unknown[]): number {
  const id = nextId++
  if (!schedule) return id
  const cancel = schedule(Math.max(0, ms), () => {
    live.delete(id)
    fn(...args)
  })
  live.set(id, cancel)
  return id
}

export function clearTimeout(id: unknown): void {
  if (typeof id !== 'number') return
  live.get(id)?.()
  live.delete(id)
}

export function setInterval(fn: (...args: unknown[]) => void, ms = 0, ...args: unknown[]): number {
  const id = nextId++
  const tick = (): void => {
    if (!live.has(id)) return
    fn(...args)
    if (live.has(id) && schedule) live.set(id, schedule(Math.max(1, ms), tick))
  }
  if (schedule) live.set(id, schedule(Math.max(1, ms), tick))
  return id
}

export function clearInterval(id: unknown): void {
  clearTimeout(id)
}

/** Make the Node globals the core calls exist. */
export function installTimerGlobals(): void {
  const g = globalThis as Record<string, unknown>
  // Only where the environment has none (the mod's); a Node dev host keeps its own.
  if (typeof g.setTimeout !== 'function') {
    g.setTimeout = setTimeout
    g.clearTimeout = clearTimeout
    g.setInterval = setInterval
    g.clearInterval = clearInterval
  }
  if (typeof g.setImmediate !== 'function') g.setImmediate = (fn: () => void) => setTimeout(fn, 0)
  const signal = AbortSignal as unknown as Record<string, unknown>
  if (typeof signal.timeout !== 'function') {
    signal.timeout = (ms: number) => {
      const controller = new AbortController()
      setTimeout(() => controller.abort(Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' })), ms)
      return controller.signal
    }
  }
  if (typeof signal.any !== 'function') {
    signal.any = (signals: AbortSignal[]) => {
      const controller = new AbortController()
      for (const one of signals) {
        if (one.aborted) {
          controller.abort((one as unknown as { reason?: unknown }).reason)
          break
        }
        one.addEventListener('abort', () => controller.abort((one as unknown as { reason?: unknown }).reason))
      }
      return controller.signal
    }
  }
}
