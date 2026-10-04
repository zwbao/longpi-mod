// The route JSON these pages read, read defensively (client/normalize.ts in spirit): indicators, an
// indicator's detail, the person's own measurements, and the bits of journey and tracking the pages use.

import type { Ctx } from '../../types.ts'
import { lifeAreaOf, type IndicatorSource, type LifeArea } from './plain.ts'

export type Point = { date: string; value: number }

export type IndicatorChange = {
  verdict: 'better' | 'worse' | 'unclear'
  ask_doctor: boolean
  pct: number
  band_pct: { up: number; down: number }
  text_zh: string
}

export type IndicatorRow = {
  id: string
  label_zh: string
  unit: string
  source: IndicatorSource
  latest: { date: string; value: number | null; text?: string } | null
  points: Point[]
  change: IndicatorChange | null
  judged: 'changed' | 'within' | 'unjudged'
  plan_marker: boolean
  read_error?: string
  gate?: 'too_early' | 'not_comparable'
  reason_zh?: string
  range_flag?: 'low' | 'high'
  range_zh?: string
}

export type IndicatorGroup = { key: string; label_zh: string; indicators: IndicatorRow[] }

export type Indicators = {
  record: { status: 'ok' | 'partial' | 'error' | 'none'; error: string }
  updated_at: string
  groups: IndicatorGroup[]
}

export type Biovar = { cvi_pct: number; band_pct: { up: number; down: number }; source: { title: string; url: string; doi?: string }; caveat_zh?: string }

export type DetailPoint = { date: string; value: number | null; text?: string; file?: string; unit: string }

export type IndicatorDetail = { row: IndicatorRow; all_points: DetailPoint[]; biovar: Biovar | null }

export type SelfKey = 'waist' | 'sbp' | 'dbp' | 'weight'
export type SelfLatest = { key: SelfKey; label_zh: string; value: number; unit: string; date: string; n: number }
export type SelfKeySpec = { key: SelfKey; label_zh: string; unit: string; units: string[] }
export type SelfRow = { id: string; key: SelfKey; value: number; unit: string; date: string; saved_at: string; given?: { value: number; unit: string } }

type Raw = Record<string, unknown>

const obj = (value: unknown): Raw => (value && typeof value === 'object' && !Array.isArray(value) ? value as Raw : {})
const str = (value: unknown): string => (typeof value === 'string' ? value : '')
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

function pointsOf(value: unknown): Point[] {
  return list(value).map(obj).flatMap((row) => {
    const date = str(row.date)
    const v = num(row.value)
    return date && v != null ? [{ date, value: v }] : []
  })
}

function changeOf(value: unknown): IndicatorChange | null {
  const raw = obj(value)
  const band = obj(raw.band_pct)
  const pct = num(raw.pct)
  const up = num(band.up)
  const down = num(band.down)
  if (pct == null || up == null || down == null) return null
  const verdict = raw.verdict === 'better' || raw.verdict === 'worse' ? raw.verdict : 'unclear'
  return { verdict, ask_doctor: raw.ask_doctor === true || verdict === 'worse', pct, band_pct: { up, down }, text_zh: str(raw.text_zh) }
}

export function rowOf(value: unknown): IndicatorRow | null {
  const raw = obj(value)
  const id = str(raw.id)
  const label = str(raw.label_zh)
  if (!id || !label) return null
  const latestRaw = raw.latest == null ? null : obj(raw.latest)
  const latestText = latestRaw ? str(latestRaw.text) : ''
  const latestValue = latestRaw ? num(latestRaw.value) : null
  const latest = latestRaw && str(latestRaw.date) && (latestValue != null || latestText)
    ? { date: str(latestRaw.date), value: latestValue, ...(latestText ? { text: latestText } : {}) }
    : null
  const change = changeOf(raw.change)
  const readError = str(raw.read_error)
  const judgedRaw = raw.judged === 'changed' || raw.judged === 'within' ? raw.judged : 'unjudged'
  const judged = readError ? 'unjudged' : judgedRaw === 'changed' && !change ? 'unjudged' : judgedRaw
  const source: IndicatorSource = raw.source === 'device' || raw.source === 'self' ? raw.source : 'checkup'
  return {
    id,
    label_zh: label,
    unit: str(raw.unit),
    source,
    latest,
    points: pointsOf(raw.points),
    change: judged === 'changed' ? change : null,
    judged,
    plan_marker: raw.plan_marker === true,
    ...(readError ? { read_error: readError } : {}),
    ...(raw.gate === 'too_early' || raw.gate === 'not_comparable' ? { gate: raw.gate } : {}),
    ...(str(raw.reason_zh) ? { reason_zh: str(raw.reason_zh) } : {}),
    ...(raw.range_flag === 'low' || raw.range_flag === 'high' ? { range_flag: raw.range_flag } : {}),
    ...(str(raw.range_zh) ? { range_zh: str(raw.range_zh) } : {}),
  }
}

export function indicatorsOf(value: unknown): Indicators | null {
  const raw = obj(value)
  if (!Array.isArray(raw.groups)) return null
  const record = obj(raw.record)
  const status = record.status === 'partial' || record.status === 'error' || record.status === 'none' ? record.status : 'ok'
  return {
    record: { status, error: str(record.error) },
    updated_at: str(raw.updated_at),
    groups: list(raw.groups).map(obj).map((group) => ({
      key: str(group.key),
      label_zh: str(group.label_zh),
      indicators: list(group.indicators).map(rowOf).filter((row): row is IndicatorRow => row !== null),
    })).filter((group) => group.key && group.indicators.length > 0),
  }
}

export function detailOf(value: unknown): IndicatorDetail | null {
  const raw = obj(value)
  const row = rowOf(raw.row)
  if (!row) return null
  const biovarRaw = raw.biovar == null ? null : obj(raw.biovar)
  const band = obj(biovarRaw?.band_pct)
  const source = obj(biovarRaw?.source)
  const up = num(band.up)
  const down = num(band.down)
  const biovar: Biovar | null = biovarRaw && up != null && down != null
    ? {
      cvi_pct: num(biovarRaw.cvi_pct) ?? 0,
      band_pct: { up, down },
      source: { title: str(source.title), url: str(source.url), ...(str(source.doi) ? { doi: str(source.doi) } : {}) },
      ...(str(biovarRaw.caveat_zh) ? { caveat_zh: str(biovarRaw.caveat_zh) } : {}),
    }
    : null
  const all = list(raw.all_points).map(obj).flatMap((point) => {
    const date = str(point.date)
    if (!date) return []
    const text = str(point.text)
    const file = str(point.file)
    return [{ date, value: num(point.value), unit: str(point.unit), ...(text ? { text } : {}), ...(file ? { file } : {}) }]
  })
  return { row, all_points: all, biovar }
}

/** The path of an indicator's detail. */
export function detailPath(id: string): string {
  return `indicators/detail?id=${encodeURIComponent(id)}`
}

/** The indicators route a page reads (the server answers the whole list; the page picks its rows). */
export function indicatorsPath(area: LifeArea): string {
  return `indicators?area=${area}`
}

/** The rows of one area, as the web picked them: by name, and on 化验 every row that is not a wearable's. */
export function rowsOfArea(data: Indicators, area: LifeArea): IndicatorRow[] {
  return data.groups.flatMap((group) => group.indicators).filter((row) => lifeAreaOf(row.label_zh) === area || (area === 'labs' && row.source !== 'device'))
}

export function selfOf(journey: unknown): { latest: SelfLatest[]; keys: SelfKeySpec[] } {
  const self = obj(obj(journey).self)
  const keys: SelfKeySpec[] = list(self.keys).map(obj).flatMap((row) => {
    const key = str(row.key) as SelfKey
    if (!['waist', 'sbp', 'dbp', 'weight'].includes(key)) return []
    return [{ key, label_zh: str(row.label_zh), unit: str(row.unit), units: list(row.units).map(str).filter(Boolean) }]
  })
  const latest: SelfLatest[] = list(self.latest).map(obj).flatMap((row) => {
    const key = str(row.key) as SelfKey
    const value = num(row.value)
    if (!['waist', 'sbp', 'dbp', 'weight'].includes(key) || value == null) return []
    return [{ key, label_zh: str(row.label_zh), value, unit: str(row.unit), date: str(row.date), n: num(row.n) ?? 1 }]
  })
  return { latest, keys }
}

export function selfRowsOf(value: unknown): SelfRow[] {
  return list(obj(value).rows).map(obj).flatMap((row) => {
    const key = str(row.key) as SelfKey
    const v = num(row.value)
    if (!str(row.id) || v == null) return []
    const given = obj(row.given)
    const gv = num(given.value)
    return [{ id: str(row.id), key, value: v, unit: str(row.unit), date: str(row.date), saved_at: str(row.saved_at), ...(gv != null ? { given: { value: gv, unit: str(given.unit) } } : {}) }]
  })
}

/** A plan item whose markers name this indicator, with what tracking says about it. */
export type PlanLink = { id: string; title: string; verdict: string; reason: string; next: string }

const fold = (text: string) => text.replace(/\s+/g, '').toLowerCase()

/** The plan items tied to an indicator (tracking: each item's verdicts name the markers it follows). */
export function planLinks(tracking: unknown, label: string): PlanLink[] {
  const name = fold(label)
  if (!name) return []
  const out: PlanLink[] = []
  for (const item of list(obj(tracking).items).map(obj)) {
    for (const verdict of list(item.verdicts).map(obj)) {
      const marker = fold(str(verdict.marker))
      const indicator = fold(str(verdict.indicator))
      const hit = (marker && (marker === name || name.startsWith(marker) || marker.startsWith(name)))
        || (indicator && (indicator === name || indicator.startsWith(name) || name.startsWith(indicator)))
      if (!hit) continue
      out.push({ id: str(item.id), title: str(item.title) || str(verdict.item_title), verdict: str(verdict.verdict), reason: str(verdict.reason_zh), next: str(verdict.next_retest) })
      break
    }
  }
  // An item listed in the plan with this marker but not judged yet still belongs here.
  for (const planItem of list(obj(obj(tracking).plan).items).map(obj)) {
    if (out.some((row) => row.id === str(planItem.id))) continue
    if (!list(planItem.markers).map(str).some((marker) => {
      const m = fold(marker)
      return m === name || m.startsWith(name) || name.startsWith(m)
    })) continue
    out.push({ id: str(planItem.id), title: str(planItem.title), verdict: '', reason: '', next: '' })
  }
  return out
}

/** The JSON of a route through the cache, or null. */
export function jsonOf<T>(ctx: Ctx, path: string, parse: (value: unknown) => T | null): T | null {
  const value = ctx.json<unknown>(path)
  return value == null ? null : parse(value)
}
