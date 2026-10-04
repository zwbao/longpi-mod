// Which experiments an experiment pack may show (docs/codex-design.md §3.2): safety rules → data to measure the
// result → related to the person's plan or next step → not done last season. Chance only orders experiments
// that are equal on those terms. Only the combinations that really matter are blocked.

import { createHash } from '../../sys/crypto.ts'
import type { IsoDay } from '../contracts/common.ts'
import type { ExperimentSpec, MetricKey } from '../contracts/codex.ts'
import { addDays } from '../interventions.ts'
import { loadCatalog } from './data.ts'
import { valuesIn, type SeriesCache } from './series.ts'
import { MIN_BASELINE_DAYS } from './verdict.ts'

export interface EligibilityContext {
  today: IsoDay
  drugClasses: ReadonlySet<string>
  conditions: ReadonlySet<string>
  pregnant: boolean
  /** Open 先看医生 findings (triage ids such as finding-sbp-very-high). */
  openFindings: ReadonlySet<string>
  series: SeriesCache
  /** Latest LDL on the record, for the 8-week lab experiment. */
  ldlOnFile: boolean
  /** A retest 56–84 days from today (journey retests or the person's own date). */
  retestIn8to12Weeks: boolean
  /** Plan items, the next step and the top facts, as text. */
  personalText: string
  focus: ReadonlySet<string>
  standupOn: boolean
  /** Running or revealed this season and last. */
  recent: ReadonlySet<string>
  running: ReadonlySet<string>
}

export interface Candidate { spec: ExperimentSpec; primary: MetricKey; score: number; randomizable: boolean }

function daysOf(cache: SeriesCache, key: MetricKey, from: IsoDay, to: IsoDay): number {
  return valuesIn(cache.days[key], from, to).length
}

export function devices(cache: SeriesCache, today: IsoDay): { wristband: boolean; bp_cuff: boolean; scale: boolean } {
  const from30 = addDays(today, -30)
  const from60 = addDays(today, -60)
  const wristband = (['rhr', 'steps', 'sleep', 'hrv'] as MetricKey[]).some((key) => daysOf(cache, key, from30, today) >= MIN_BASELINE_DAYS)
  return {
    wristband,
    bp_cuff: daysOf(cache, 'sbp', from30, today) >= 3,
    scale: daysOf(cache, 'weight', from60, today) >= 3 || daysOf(cache, 'waist', from60, today) >= 3,
  }
}

/** The primary outcome this person can be measured on: the first alternative with enough baseline days. */
export function primaryFor(spec: ExperimentSpec, ctx: Pick<EligibilityContext, 'today' | 'series' | 'ldlOnFile'>): MetricKey | null {
  const { metrics } = loadCatalog()
  const from = addDays(ctx.today, -14)
  const to = addDays(ctx.today, -1)
  for (const key of spec.primary) {
    const metric = metrics[key]
    if (!metric) continue
    if (metric.method === 'lab') {
      if (key === 'ldl' && ctx.ldlOnFile) return key
      continue
    }
    const need = metric.method === 'personal' ? MIN_BASELINE_DAYS : 3
    if (daysOf(ctx.series, key, from, to) >= need) return key
  }
  return null
}

/**
 * A home cuff or scale is there, but the two weeks before have too few readings: the experiment can still start,
 * with 7 days of measuring first as its own baseline.
 */
export function leadInFor(spec: ExperimentSpec, ctx: Pick<EligibilityContext, 'today' | 'series' | 'ldlOnFile'>): MetricKey | null {
  if (primaryFor(spec, ctx)) return null
  const have = devices(ctx.series, ctx.today)
  for (const key of spec.primary) {
    if (key === 'sbp' && have.bp_cuff) return key
    if ((key === 'weight' || key === 'waist') && have.scale) return key
  }
  return null
}

/** Why an experiment is left out, or null when it may be shown. */
export function blockedBy(spec: ExperimentSpec, ctx: EligibilityContext): string | null {
  if (ctx.pregnant) return 'pregnancy'
  if (spec.exclude.drug_classes.some((name) => ctx.drugClasses.has(name))) return 'medication'
  if (spec.exclude.conditions.some((name) => ctx.conditions.has(name))) return 'condition'
  if (spec.exclude.findings.some((name) => ctx.openFindings.has(name))) return 'doctor_first'
  if (ctx.running.has(spec.id)) return 'running'
  const have = devices(ctx.series, ctx.today)
  for (const need of spec.needs) {
    if (need === 'wristband' && !have.wristband) return 'no_wristband'
    if (need === 'bp_cuff' && !have.bp_cuff) return 'no_bp_cuff'
    if (need === 'scale' && !have.scale) return 'no_scale'
    if (need === 'retest_window' && !ctx.retestIn8to12Weeks) return 'no_retest'
  }
  if (spec.adherence === 'standup' && !ctx.standupOn) return 'standup_off'
  if (!primaryFor(spec, ctx) && !leadInFor(spec, ctx)) return 'no_data'
  return null
}

function relevance(spec: ExperimentSpec, ctx: EligibilityContext): number {
  if (spec.relevance.words.some((word) => ctx.personalText.includes(word))) return 2
  if (spec.relevance.focus.some((key) => ctx.focus.has(key))) return 1
  return 0
}

/** Every experiment that may be shown, best first (relevance; not done recently). */
export function eligible(ctx: EligibilityContext): Candidate[] {
  const { experiments } = loadCatalog()
  const out: Candidate[] = []
  for (const spec of experiments) {
    if (blockedBy(spec, ctx)) continue
    const primary = primaryFor(spec, ctx) ?? leadInFor(spec, ctx)
    if (!primary) continue
    out.push({ spec, primary, score: relevance(spec, ctx) - (ctx.recent.has(spec.id) ? 10 : 0), randomizable: spec.randomizable })
  }
  return out.sort((a, b) => b.score - a.score)
}

function unit(seed: string, salt: string): number {
  return createHash('sha256').update(`${seed}:${salt}`).digest().readUInt32BE(0) / 0x1_0000_0000
}

/** Three distinct experiments, without replacement; chance orders only candidates of equal standing. */
export function pickThree(candidates: readonly Candidate[], seed: string, exclude: ReadonlySet<string> = new Set()): string[] {
  const pool = candidates.filter((row) => !exclude.has(row.spec.id))
  const fresh = pool.filter((row) => row.score > -5)
  const source = fresh.length >= 3 ? fresh : pool
  const ordered = [...source].sort((a, b) => b.score - a.score || unit(seed, a.spec.id) - unit(seed, b.spec.id))
  return ordered.slice(0, 3).map((row) => row.spec.id)
}

/** Randomized version: 7 do-days and 7 off-days in a seeded order. */
export function randomSchedule(start: IsoDay, days: number, seed: string): Record<IsoDay, boolean> {
  const list = Array.from({ length: days }, (_, i) => addDays(start, i))
  const half = Math.floor(days / 2)
  const order = [...list].sort((a, b) => unit(seed, a) - unit(seed, b))
  const on = new Set(order.slice(0, half))
  return Object.fromEntries(list.map((day) => [day, on.has(day)]))
}
