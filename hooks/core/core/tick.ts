// The M0 tick (AA §1.2 row 3): once a minute, a new China civil day emits day.rolled (the last day is
// kept in dataDir so a restart does not emit it twice).

import type { Context } from '../../sys/cordis.ts'
import { join } from '../../sys/path.ts'
import type { Bus } from '../contracts/events.ts'
import { isoDay } from '../interventions.ts'
import { readJson, writeJsonAtomic } from './store.ts'

export function checkDay(bus: Bus, dataDir: string, now: Date = new Date()): boolean {
  const path = join(dataDir, 'tick.json')
  const day = isoDay(now)
  const last = readJson<{ day: string }>(path, (raw) => ({ day: typeof (raw as { day?: unknown })?.day === 'string' ? (raw as { day: string }).day : '' }), () => ({ day: '' }))
  if (last.day === day) return false
  writeJsonAtomic(path, { day })
  if (last.day) bus.emit('day.rolled', { day }, { module: 'M0', via: 'timer' })
  return Boolean(last.day)
}

export function startTick(ctx: Context, bus: Bus, dataDir: () => string): void {
  const run = () => {
    try {
      checkDay(bus, dataDir())
    } catch {
      // next minute
    }
  }
  // DSH mounts the timer service; without it (tests) there is no tick and day.rolled is not emitted.
  try {
    const interval = (ctx as unknown as { interval?: (fn: () => void, ms: number) => unknown }).interval
    if (typeof interval === 'function') interval.call(ctx, run, 60_000)
  } catch {
    // no timer service (reading an unregistered service can throw under Cordis): no tick
  }
}
