import { process } from '../../sys/process.ts'
// The Codex's one source of truth: engage/state.json (version 2) in the account holder's LongPi home.
// A v1 file (draws, quests, streaks) is migrated once: owned method cards become 已读, unused draws become one
// opening experiment pack, the streak freeze is dropped; the seed and draws.jsonl stay for audit.

import { randomBytes } from '../../sys/crypto.ts'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from '../../sys/fs.ts'
import { dirname, join } from '../../sys/path.ts'
import type { IsoDay, IsoTime } from '../contracts/common.ts'
import type { ExperimentRun, Footprint, Pack } from '../contracts/codex.ts'
import type { Season } from '../contracts/engagement.ts'
import { DEFAULT_MY_DAY, EMPTY_NUDGE, type MyDay, type NudgeState } from './nudge.ts'

/** What the journey last saw of the holder's record, kept so the Codex view needs no Mirobody read. */
export interface CodexContext {
  at: IsoTime | null
  age: number | null
  drug_classes: string[]
  conditions: string[]
  pregnant: boolean
  open_findings: string[]
  /** Plan items, the next step and the top facts, as one text (relevance only; never shown). */
  personal_text: string
  focus: string[]
  ldl: { value: number; unit: string; date: IsoDay } | null
  retests: Array<{ marker: string; date: IsoDay }>
  latest_checkup: IsoDay | null
  results: {
    bioage: { now: number; date: IsoDay; prev: number | null; prev_date: IsoDay | null; band: number | null } | null
    risk: { pct: number | null; date: IsoDay | null; category_zh: string; applicable: boolean; reason_zh: string } | null
    changes: Array<{ key: string; label_zh: string; unit: string; from: number; to: number; from_date: IsoDay; to_date: IsoDay; beyond: boolean; verdict: 'better' | 'worse' | 'unclear'; ask_doctor: boolean }>
  }
  labs: { hscrp: boolean; waist: boolean }
  method_results: Array<{ skill: string; text_zh: string }>
}

export const EMPTY_CONTEXT: CodexContext = {
  at: null, age: null, drug_classes: [], conditions: [], pregnant: false, open_findings: [], personal_text: '', focus: [],
  ldl: null, retests: [], latest_checkup: null, results: { bioage: null, risk: null, changes: [] }, labs: { hscrp: false, waist: false }, method_results: [],
}

export interface State {
  version: 2
  /** Codex shown (on) or closed by the person (off); null follows memory and the adult default. */
  choice: 'on' | 'off' | null
  /** The first-open flow is done (我的白天, season mode, stand-up opt-in). */
  started: IsoDay | null
  /** Mirrors started for the quiet home (engage/quiet.ts reads it). */
  pressure: 'on' | 'off' | null
  season: Season | null
  seasons: Array<{ id: string; start: IsoDay; closed: IsoDay | null; runs: string[] }>
  seed_hex: string
  packs: Pack[]
  /** 待选: experiments shown in a pack and not chosen, ready to pick directly. */
  reserve: string[]
  runs: ExperimentRun[]
  read: Record<string, IsoDay>
  met: Record<string, IsoDay>
  footprints: Footprint[]
  /** Sick or travel days: never counted as experiment days, never a failure. */
  life: Array<{ day: IsoDay; reason: string }>
  prefs: { simple: boolean; presentation: boolean; my_day: MyDay; season_mode: '8w' | 'retest' }
  nudge: NudgeState
  context: CodexContext
  /** What footprints and packs have already been given for (care item ids, checkup days, member events). */
  seen: { care: string[]; checkups: IsoDay[]; member: string[]; labs: { hscrp: boolean; waist: boolean } }
  migrated_v1: IsoTime | null
}

export function emptyState(): State {
  return {
    version: 2,
    choice: null,
    started: null,
    pressure: null,
    season: null,
    seasons: [],
    seed_hex: '',
    packs: [],
    reserve: [],
    runs: [],
    read: {},
    met: {},
    footprints: [],
    life: [],
    prefs: { simple: false, presentation: false, my_day: { ...DEFAULT_MY_DAY }, season_mode: '8w' },
    nudge: JSON.parse(JSON.stringify(EMPTY_NUDGE)) as NudgeState,
    context: JSON.parse(JSON.stringify(EMPTY_CONTEXT)) as CodexContext,
    seen: { care: [], checkups: [], member: [], labs: { hscrp: false, waist: false } },
    migrated_v1: null,
  }
}

export function newId(prefix: string): string {
  return `${prefix}${randomBytes(8).toString('hex')}`
}

function engageDir(dataDir: string): string {
  return join(dataDir, 'engage')
}

function hydrate(raw: Partial<State>): State {
  const base = emptyState()
  const arr = <T>(value: unknown, fallback: T[]): T[] => Array.isArray(value) ? value as T[] : fallback
  return {
    ...base,
    ...raw,
    version: 2,
    seasons: arr(raw.seasons, []),
    packs: arr(raw.packs, []),
    reserve: arr(raw.reserve, []),
    runs: arr<ExperimentRun>(raw.runs, []).map((run) => ({ ...run, done: Array.isArray(run.done) ? run.done : [] })),
    footprints: arr(raw.footprints, []),
    life: arr(raw.life, []),
    read: raw.read && typeof raw.read === 'object' ? raw.read : {},
    met: raw.met && typeof raw.met === 'object' ? raw.met : {},
    prefs: { ...base.prefs, ...(raw.prefs ?? {}), my_day: { ...base.prefs.my_day, ...(raw.prefs?.my_day ?? {}) } },
    nudge: { ...base.nudge, ...(raw.nudge ?? {}), shown: arr(raw.nudge?.shown, []), acks: arr(raw.nudge?.acks, []), reveal: raw.nudge?.reveal ?? {} },
    context: { ...base.context, ...(raw.context ?? {}), results: { ...base.context.results, ...(raw.context?.results ?? {}) } },
    seen: { ...base.seen, ...(raw.seen ?? {}), labs: { ...base.seen.labs, ...(raw.seen?.labs ?? {}) } },
  }
}

interface V1State {
  version: 1
  season?: { id?: string; start?: string } | null
  codex?: { seed_hex?: string; owned?: string[]; grants?: Array<{ used_by?: string }>; choice?: 'on' | 'off' | null }
  pressure?: 'on' | 'off' | null
  nudge?: { choice?: 'on' | 'off' | null }
}

/** v1 → v2, once. */
export function migrateV1(raw: V1State, today: IsoDay, now: Date): State {
  const state = emptyState()
  state.choice = raw.codex?.choice ?? null
  state.seed_hex = raw.codex?.seed_hex ?? ''
  for (const id of raw.codex?.owned ?? []) {
    const skill = id.startsWith('m-') ? id.slice(2) : null
    if (skill) state.read[`s-${skill}`] = today
  }
  const unused = (raw.codex?.grants ?? []).filter((row) => !row.used_by).length
  const hadSeason = Boolean(raw.season)
  if (unused > 0 || hadSeason) {
    state.started = today
    state.pressure = raw.pressure === 'off' ? 'off' : 'on'
    // The season that starts on the next sync brings the one opening experiment pack.
  }
  if (raw.nudge?.choice === 'on') state.nudge.standup = 'on'
  state.migrated_v1 = now.toISOString() as IsoTime
  return state
}

export function readState(dataDir: string, now: Date, today: IsoDay): State {
  const path = join(engageDir(dataDir), 'state.json')
  if (!existsSync(path)) return emptyState()
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<State> | V1State
    if (raw && (raw as V1State).version === 1) {
      try { copyFileSync(path, join(engageDir(dataDir), 'state.v1.json')) } catch { /* the migration still runs */ }
      const migrated = migrateV1(raw as V1State, today, now)
      saveState(dataDir, migrated)
      return migrated
    }
    if (!raw || (raw as State).version !== 2) throw new Error('version')
    return hydrate(raw as State)
  } catch {
    try { renameSync(path, `${path}.damaged-${Date.now()}`) } catch { /* leave it */ }
    return emptyState()
  }
}

export function saveState(dataDir: string, state: State): void {
  const path = join(engageDir(dataDir), 'state.json')
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const tmp = `${path}.${process.pid}.${randomBytes(3).toString('hex')}.tmp`
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
  chmodSync(tmp, 0o600)
  renameSync(tmp, path)
}
