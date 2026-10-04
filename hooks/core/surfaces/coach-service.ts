// Model-written surfaces (M5, AA §2.7 / §4.3 PR 2b): the page never waits for a model. A build serves the
// cached model set when it was made from the same fact pack (or the same hard facts, re-checked, within
// softRegenMinutes); otherwise it serves the fact-ranked floor and asks the coach in the background
// (single-flight per person). A set that passes the post-filter is written, logged and pushed on SSE.

import { join } from '../../sys/path.ts'
import type { LlmCall } from '../contracts/agents.ts'
import type { FactPack } from '../contracts/factpack.ts'
import type { SurfaceSet } from '../contracts/surfaces.ts'
import { coachProfile, validateCoach } from '../agents/coach.ts'
import { currentBus } from '../core/bus.ts'
import { readJsonl } from '../core/store.ts'
import { addDays } from '../interventions.ts'
import { recordSurfaces, storedSurfaces } from './service.ts'

export interface CoachRunner {
  llm: LlmCall
  enabled: () => boolean
  softRegenMinutes: () => number
  publish?: (type: string, data: unknown) => void
  log?: (message: string) => void
}

let runner: CoachRunner | null = null
export function setCoach(next: CoachRunner | null): void {
  runner = next
}

interface Cached { set: SurfaceSet; hardKey: string; at: number }
const models = new Map<string, Cached>()
const inflight = new Map<string, Promise<SurfaceSet | null>>()

/** What must not change for a model set to be reused: stage, the top facts, the mandatory actions, safety. */
export function hardKeyOf(pack: FactPack): string {
  return JSON.stringify([
    pack.stage, pack.today,
    pack.top_facts.slice(0, 3).map((row) => [row.id, row.priority, row.text_zh]),
    pack.candidates.filter((row) => row.mandatory).map((row) => [row.id, row.title_zh]),
    pack.safety, pack.exclusions.map((row) => row.id), pack.triage.care.map((row) => [row.finding_id, row.care_status, row.visit_date]),
  ])
}

function lastShown(dataDir: string, today: string): string[] {
  const since = addDays(today, -3)
  const rows = readJsonl<{ day?: string; suggestions?: string[] }>(join(dataDir, 'surfaces_log.jsonl')).filter((row) => (row.day ?? '') >= since)
  return [...new Set(rows.flatMap((row) => row.suggestions ?? []))].slice(-12)
}

function merge(floor: SurfaceSet, draft: ReturnType<typeof coachProfile.fallback>, pack: FactPack, run: SurfaceSet['run']): SurfaceSet {
  const modelCards = [draft.greeting, draft.status, draft.next.card, ...draft.suggestions].filter((card) => card.source === 'model').length
  return {
    ...floor,
    source: modelCards === 0 ? 'fallback' : modelCards < 3 + draft.suggestions.length ? 'mixed' : 'model',
    stale: false,
    generated_at: new Date().toISOString(),
    greeting: draft.greeting,
    status: draft.status,
    next: draft.next,
    more: floor.more.filter((row) => row.id !== draft.next.action.id).concat(floor.next.action.id !== draft.next.action.id ? [floor.next.action] : []),
    suggestions: draft.suggestions,
    ...(run ? { run } : {}),
    validation: { passed: draft.passed, failed: draft.failed },
  }
}

/** Re-check a cached model set against a newer pack with the same hard facts. */
function recheck(cached: SurfaceSet, floor: SurfaceSet, pack: FactPack): SurfaceSet | null {
  const shaped = {
    greeting: { text_zh: cached.greeting.text_zh },
    status: { text_zh: cached.status.text_zh, fact_ids: cached.status.fact_ids, tone: cached.status.tone },
    next: { action_id: cached.next.action.id, text_zh: cached.next.card.text_zh, detail_zh: cached.next.card.detail_zh ?? '' },
    suggestions: cached.suggestions.map((row) => ({ prompt_zh: row.prompt_zh ?? row.text_zh, fact_ids: row.fact_ids, ...(row.action_id ? { action_id: row.action_id } : {}) })),
  }
  const checked = validateCoach(shaped, pack, { floor, lastShown: [], now: new Date() })
  if (!checked.ok || checked.value.failed.length > 0) return null
  return { ...merge(floor, checked.value, pack, cached.run), generated_at: cached.generated_at, source: cached.source }
}

/** The set to show for this pack: a valid model set, or the floor (and the coach is asked). */
export function chooseSurfaces(dataDir: string, floor: SurfaceSet, pack: FactPack): SurfaceSet {
  if (!runner || !runner.enabled()) return floor
  let cached = models.get(dataDir)
  if (!cached) {
    const stored = storedSurfaces(dataDir)
    if (stored && stored.source !== 'fallback' && stored.day === pack.today) {
      cached = { set: stored, hardKey: '', at: Date.parse(stored.generated_at) || 0 }
      models.set(dataDir, cached)
    }
  }
  const now = Date.now()
  if (cached && cached.set.inputs_fp === pack.fp && Date.parse(cached.set.valid_until) > now) return cached.set
  const soft = cached && cached.hardKey === hardKeyOf(pack) && now - cached.at < runner.softRegenMinutes() * 60_000
  if (soft && cached) {
    const reused = recheck(cached.set, floor, pack)
    if (reused) return reused
  }
  void regenerate(dataDir, pack, floor)
  return { ...floor, stale: Boolean(cached) }
}

/** Ask the coach for this pack now (single-flight per person). Resolves to the set shown, or null. */
export function regenerate(dataDir: string, pack: FactPack, floor: SurfaceSet): Promise<SurfaceSet | null> {
  const current = runner
  if (!current) return Promise.resolve(null)
  const running = inflight.get(dataDir)
  if (running) return running
  const job = (async () => {
    const started = Date.now()
    const { value, run } = await current.llm.structured({ profile: coachProfile, pack, extra: { floor, lastShown: lastShown(dataDir, pack.today), now: new Date() } })
    if (run.source !== 'model') {
      current.log?.(`coach fell back: ${(run.errors ?? []).join('; ').slice(0, 300)}`)
      recordSurfaces(dataDir, { ...floor, run, validation: { passed: [], failed: (run.errors ?? []).map((detail) => ({ rule: run.budget_blocked ? 'budget' : 'model', card_id: 'set', detail })) } }, pack)
      return null
    }
    const set = merge(floor, value, pack, run)
    models.set(dataDir, { set, hardKey: hardKeyOf(pack), at: Date.now() })
    recordSurfaces(dataDir, set, pack)
    currentBus()?.emit('surface.generated', { inputs_fp: pack.fp, source: set.source, latency_ms: Date.now() - started }, { module: 'M5', via: 'hook' })
    current.publish?.('surfaces', { fp: pack.fp })
    return set
  })().catch((error: unknown) => {
    current.log?.(`coach failed: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }).finally(() => inflight.delete(dataDir))
  inflight.set(dataDir, job)
  return job
}

/** For tests: forget cached model sets. */
export function resetCoachCache(): void {
  models.clear()
  inflight.clear()
}

export function coachInflight(dataDir: string): Promise<SurfaceSet | null> | null {
  return inflight.get(dataDir) ?? null
}
