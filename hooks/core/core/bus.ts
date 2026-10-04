// The HealthEvent bus (AA §2.6): every event is appended to dataDir/events.jsonl, then announced through
// cordis ('longpi/event') for other plugins and to LongPi's own subscribers. Durable subscribers keep a cursor
// in events_cursor.json and replay what they missed when they register.

import type { Context } from '../../sys/cordis.ts'
import { join } from '../../sys/path.ts'
import type { Bus, HealthEvent, HealthEventPayloads, HealthEventSource, HealthEventType } from '../contracts/events.ts'
import type { Id } from '../contracts/common.ts'
import { isoDay } from '../interventions.ts'
import { appendJsonl, newId, readJson, readJsonl, writeJsonAtomic } from './store.ts'

type Listener = { types: HealthEventType[] | '*'; fn: (e: HealthEvent) => void | Promise<void>; label: string; durable: boolean }

export interface LocalBus extends Bus {
  /** Subscribers, for tests and the dispatcher. */
  listeners(): number
}

function cursorPath(dataDir: string): string {
  return join(dataDir, 'events_cursor.json')
}

export function createBus(opts: { dataDir: () => string; ctx?: Context | null; log?: (message: string) => void }): LocalBus {
  const listeners: Listener[] = []
  const eventsPath = () => join(opts.dataDir(), 'events.jsonl')
  const readCursors = () => readJson<Record<string, string>>(cursorPath(opts.dataDir()), (raw) => (raw && typeof raw === 'object' ? raw as Record<string, string> : {}), () => ({}))
  const saveCursor = (label: string, id: Id) => {
    try {
      writeJsonAtomic(cursorPath(opts.dataDir()), { ...readCursors(), [label]: id })
    } catch {
      // an unwritable cursor replays once more next start; handlers are idempotent by event id
    }
  }
  const deliver = (listener: Listener, event: HealthEvent) => {
    if (listener.types !== '*' && !listener.types.includes(event.type)) return
    try {
      const done = listener.fn(event)
      if (done && typeof (done as Promise<void>).catch === 'function') {
        void (done as Promise<void>).then(() => { if (listener.durable) saveCursor(listener.label, event.id) }).catch((error: unknown) => opts.log?.(`${listener.label}: ${String(error)}`))
      } else if (listener.durable) saveCursor(listener.label, event.id)
    } catch (error) {
      opts.log?.(`${listener.label}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  const bus: LocalBus = {
    emit<T extends HealthEventType>(type: T, payload: HealthEventPayloads[T], source: HealthEventSource, causation_id?: Id): HealthEvent {
      const at = new Date()
      const event = { id: newId('ev'), type, at: at.toISOString(), day: isoDay(at), source, payload, ...(causation_id ? { causation_id } : {}) } as HealthEvent
      try {
        appendJsonl(eventsPath(), event)
      } catch (error) {
        opts.log?.(`events.jsonl: ${error instanceof Error ? error.message : String(error)}`)
      }
      try {
        const emit = (opts.ctx as unknown as { emit?: (name: string, ...args: unknown[]) => void } | null | undefined)?.emit
        if (typeof emit === 'function') emit.call(opts.ctx, 'longpi/event', event)
      } catch {
        // another plugin's listener failing is not LongPi's event failing
      }
      for (const listener of [...listeners]) deliver(listener, event)
      return event
    },
    on(types, fn, label, extra = {}) {
      const listener: Listener = { types, fn, label, durable: extra.durable === true }
      listeners.push(listener)
      if (listener.durable) {
        const cursor = readCursors()[label] ?? null
        for (const event of bus.since(cursor, types === '*' ? undefined : types)) deliver(listener, event)
      }
      return () => {
        const at = listeners.indexOf(listener)
        if (at >= 0) listeners.splice(at, 1)
      }
    },
    since(cursor, types) {
      const all = readJsonl<HealthEvent>(eventsPath(), (raw) => (raw && typeof raw === 'object' && typeof (raw as HealthEvent).id === 'string' ? raw as HealthEvent : null))
      const start = cursor ? all.findIndex((row) => row.id === cursor) + 1 : 0
      return all.slice(Math.max(0, start)).filter((row) => !types || types.includes(row.type))
    },
    listeners: () => listeners.length,
  }
  return bus
}

/** The process's bus once the plugin started; null in tests that build a journey directly. */
let current: LocalBus | null = null
export function setBus(bus: LocalBus | null): void {
  current = bus
}
export function currentBus(): LocalBus | null {
  return current
}
