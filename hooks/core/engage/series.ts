import { process } from '../../sys/process.ts'
// Daily values the experiments are judged on, cached in engage/series.json so the Codex view stays synchronous.
// Refreshed from the journey build (the account holder only); a family member's record never feeds the Codex.
// Units are read off each series, never assumed (Mirobody's sleep total is ms; some exports give hours).

import { awaitShared } from '../../sys/vfs.ts'
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from '../../sys/fs.ts'
import { dirname, join } from '../../sys/path.ts'
import type { IsoDay } from '../contracts/common.ts'
import type { MetricKey } from '../contracts/codex.ts'
import type { Config } from '../config.ts'
import { addDays, isoDay } from '../interventions.ts'
import { loadSeries, type SeriesPoint } from '../records.ts'
import { readSelf } from '../selfmeasure.ts'
import { loadCatalog } from './data.ts'

/** Metric keys plus the wake time used to check 「起床时间固定」. */
export type SeriesKey = MetricKey | 'wake'

export interface SeriesCache {
  at: string | null
  /** Per key, civil day → value in the metric's unit. Onset and wake are minutes after 18:00 and after midnight. */
  days: Partial<Record<SeriesKey, Record<IsoDay, number>>>
  /** Device names that answered, for the record. */
  sources: Partial<Record<SeriesKey, string>>
  /** The newest civil day any wristband series has a value for. */
  device_latest: IsoDay | null
}

const EMPTY: SeriesCache = { at: null, days: {}, sources: {}, device_latest: null }
const WINDOW_DAYS = 120

function path(dataDir: string): string {
  return join(dataDir, 'engage', 'series.json')
}

export function readSeriesCache(dataDir: string): SeriesCache {
  if (!dataDir) return EMPTY
  try {
    const raw = JSON.parse(readFileSync(path(dataDir), 'utf8')) as SeriesCache
    return raw && typeof raw.days === 'object' ? { ...EMPTY, ...raw } : EMPTY
  } catch {
    return EMPTY
  }
}

export function writeSeriesCache(dataDir: string, cache: SeriesCache): void {
  const file = path(dataDir)
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(cache)}\n`, { mode: 0o600 })
  chmodSync(tmp, 0o600)
  renameSync(tmp, file)
}

const SHANGHAI_OFFSET_MIN = 8 * 60

/** Minutes after local midnight for an epoch-ms value, or a value already in minutes/hours of the day. */
function clockMinutes(value: number): number | null {
  if (!Number.isFinite(value)) return null
  if (value > 1e11) {
    const minutes = Math.floor(value / 60000) + SHANGHAI_OFFSET_MIN
    return ((minutes % 1440) + 1440) % 1440
  }
  if (value >= 0 && value < 24) return Math.round(value * 60)
  if (value >= 0 && value < 1440) return Math.round(value)
  return null
}

/** Value in the metric's own unit, from the unit the series carries. */
export function toMetricUnit(key: SeriesKey, value: number, unit: string): number | null {
  if (!Number.isFinite(value)) return null
  const u = (unit ?? '').trim().toLowerCase()
  if (key === 'sleep') {
    if (u === 'ms') return value / 3_600_000
    if (u === 's' || u === 'sec' || u === 'seconds') return value / 3600
    if (u === 'min' || u === 'minutes') return value / 60
    if (value > 1000) return value / 3_600_000
    return value > 24 ? value / 60 : value
  }
  if (key === 'onset') {
    const minutes = clockMinutes(value)
    return minutes == null ? null : (minutes - 18 * 60 + 1440) % 1440
  }
  if (key === 'wake') return clockMinutes(value)
  if (key === 'weight') return u === 'g' ? value / 1000 : u === 'lb' || u === 'lbs' ? value * 0.45359237 : value
  if (key === 'glucose') return u.includes('mg') ? value / 18.016 : value
  return value
}

function dayValues(points: readonly SeriesPoint[], key: SeriesKey): Record<IsoDay, number> {
  const sums = new Map<IsoDay, { total: number; n: number }>()
  for (const point of points) {
    const day = String(point.date ?? '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
    const value = toMetricUnit(key, point.value, point.unit)
    if (value == null) continue
    const row = sums.get(day) ?? { total: 0, n: 0 }
    row.total += value
    row.n += 1
    sums.set(day, row)
  }
  return Object.fromEntries([...sums].map(([day, row]) => [day, row.total / row.n]))
}

/** The device names to ask for: the catalogue's names that this record actually carries, first match per metric. */
export function wantedNames(present: ReadonlySet<string>): Partial<Record<SeriesKey, string>> {
  const { metrics } = loadCatalog()
  const out: Partial<Record<SeriesKey, string>> = {}
  for (const spec of Object.values(metrics)) {
    const name = spec.names.find((candidate) => present.has(candidate))
    if (name) out[spec.key] = name
  }
  if (present.has('sleepEndTime')) out.wake = 'sleepEndTime'
  return out
}

let inflight: Promise<SeriesCache> | null = null

/**
 * Re-read the daily series for the Codex. present = indicator names on the record (device series included).
 * One call per name (Mirobody's day buckets need it); at most once every ten minutes unless forced.
 */
export function refreshSeries(input: { config: Config; dataDir: string; present: Iterable<string>; now?: Date; force?: boolean }): Promise<SeriesCache> {
  const now = input.now ?? new Date()
  const cached = readSeriesCache(input.dataDir)
  if (!input.force && cached.at && now.getTime() - Date.parse(cached.at) < 10 * 60_000) return Promise.resolve(cached)
  if (inflight) return awaitShared(inflight)
  inflight = (async () => {
    const today = isoDay(now)
    const start = addDays(today, -WINDOW_DAYS)
    const names = wantedNames(new Set(input.present))
    const days: SeriesCache['days'] = {}
    const sources: SeriesCache['sources'] = {}
    let latest: IsoDay | null = null
    for (const [key, name] of Object.entries(names) as Array<[SeriesKey, string]>) {
      try {
        const result = await loadSeries(input.config, [name], { start, end: today, resolution: 'day' })
        const points = result.series[name]?.points ?? []
        if (points.length === 0) continue
        days[key] = dayValues(points, key)
        sources[key] = name
        if (key === 'rhr' || key === 'steps' || key === 'sleep' || key === 'hrv') {
          const last = points.at(-1)?.date?.slice(0, 10) ?? null
          if (last && (!latest || last > latest)) latest = last
        }
      } catch { /* one missing series leaves the others */ }
    }
    mergeSelf(input.dataDir, days)
    const next: SeriesCache = { at: now.toISOString(), days, sources, device_latest: latest }
    try { writeSeriesCache(input.dataDir, next) } catch { /* the view falls back to the last cache */ }
    return next
  })().finally(() => { inflight = null })
  return inflight
}

/** Typed home readings (blood pressure, weight, waist) join the device's, one mean per day. */
export function mergeSelf(dataDir: string, days: SeriesCache['days']): void {
  let rows: ReturnType<typeof readSelf> = []
  try { rows = readSelf(dataDir) } catch { rows = [] }
  const pairs: Array<[SeriesKey, 'sbp' | 'weight' | 'waist']> = [['sbp', 'sbp'], ['weight', 'weight'], ['waist', 'waist']]
  for (const [key, self] of pairs) {
    const typed = rows.filter((row) => row.key === self)
    if (typed.length === 0) continue
    const merged = new Map<IsoDay, { total: number; n: number }>()
    for (const [day, value] of Object.entries(days[key] ?? {})) merged.set(day, { total: value, n: 1 })
    for (const row of typed) {
      const day = row.date.slice(0, 10)
      const cell = merged.get(day) ?? { total: 0, n: 0 }
      cell.total += row.value
      cell.n += 1
      merged.set(day, cell)
    }
    days[key] = Object.fromEntries([...merged].map(([day, cell]) => [day, cell.total / cell.n]))
  }
}

/** Days with a value in [from, to]. */
export function valuesIn(series: Record<IsoDay, number> | undefined, from: IsoDay, to: IsoDay, keep: (day: IsoDay) => boolean = () => true): Array<{ day: IsoDay; value: number }> {
  if (!series) return []
  return Object.entries(series)
    .filter(([day]) => day >= from && day <= to && keep(day))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value]) => ({ day, value }))
}

/** Raw step samples of one civil day, for the stand-up confirmation (10 minutes after 好). */
export async function stepsOnDay(config: Config, day: IsoDay): Promise<Array<{ at: number; value: number }> | null> {
  try {
    const result = await loadSeries(config, ['steps'], { start: day, end: day, resolution: 'raw' })
    if (result.failed.includes('steps')) return null
    return (result.series.steps?.points ?? []).flatMap((point) => {
      const stamp = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(point.time) ? Date.parse(`${point.time.replace(' ', 'T').slice(0, 19)}+08:00`) : Number.NaN
      return Number.isFinite(stamp) ? [{ at: stamp, value: point.value }] : []
    })
  } catch {
    return null
  }
}
