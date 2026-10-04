// What the Codex stage shows for the overlay the person has open, at a given moment: the frame, whether the
// phase is over, and which phase follows. The page draws the frame once; register.tsx keeps blitting frames
// from here while a phase animates, then moves the overlay on.

import type { CodexOverlay } from '../../../types'
import type { ExperimentOption, RunView } from '../../core/engage/engine.ts'
import type { ResultCard, SpeciesInfo, StudyCard } from '../../core/contracts/codex.ts'
import { experimentFace, footprintFace, resultFace, speciesFace, studyFace, type Raster } from './art.ts'
import { DURATION, flipDuration, packFrame, revealFrame, showFrame, type PackPhase, type RevealPhase } from './anim.ts'
import type { Frame } from './pixels.ts'

/** What an overlay carries, copied from the answers that opened it. */
export type StagePayload = {
  packKind?: 'experiment' | 'retest'
  sourceZh?: string
  options?: ExperimentOption[]
  results?: ResultCard[]
  run?: RunView
  answers?: Record<string, boolean>
  randomized?: boolean
  met?: string[]
  option?: ExperimentOption
  study?: StudyCard
  species?: SpeciesInfo & { met?: boolean }
  footprint?: { kind: string; title_zh: string; day: string; text_zh: string }
  busy?: boolean
}

export function payloadOf(overlay: CodexOverlay): StagePayload {
  return (overlay.payload && typeof overlay.payload === 'object' ? overlay.payload : {}) as StagePayload
}

/** A good primary result: the one that earns foil, shards and the gold stamp (decision 15). */
export function goodRun(run: RunView | undefined | null): boolean {
  return run?.result?.outcome === 'outside' && run.result.primary.direction === 'better'
}

export function runFace(run: RunView): Raster {
  return experimentFace({ id: run.experiment_id, icon: run.icon }, run.cells)
}

export function optionFace(option: ExperimentOption): Raster {
  return experimentFace({ id: option.id, icon: option.icon }, [])
}

const ANIMATED: Record<string, boolean> = { idle: true, shake: true, burst: true, deal: true, flip: true, back: true, turning: true, foil: true }

export function isAnimated(overlay: CodexOverlay): boolean {
  return (overlay.kind === 'pack' || overlay.kind === 'reveal') && Boolean(ANIMATED[overlay.phase])
}

/** The phase after this one when it ends (loops end only when the person acts). */
function nextPhase(overlay: CodexOverlay, payload: StagePayload): string | null {
  if (overlay.kind === 'pack') {
    if (overlay.phase === 'burst') return 'deal'
    if (overlay.phase === 'deal') return 'flip'
    if (overlay.phase === 'flip') return 'cards'
    return null
  }
  if (overlay.kind === 'reveal') {
    if (overlay.phase === 'turning') return goodRun(payload.run) ? 'foil' : 'front'
    if (overlay.phase === 'foil') return 'front'
    return null
  }
  return null
}

function durationOf(overlay: CodexOverlay, payload: StagePayload): number {
  if (overlay.phase === 'flip') return flipDuration((payload.options ?? payload.results ?? []).length)
  return DURATION[overlay.phase] ?? Number.POSITIVE_INFINITY
}

export type StageNow = { frame: Frame; done: boolean; next: string | null }

/** The frame for the overlay at `now`, in a stage `cols` wide. Null when the overlay has no picture. */
export function stageAt(overlay: CodexOverlay, cols: number, now: number, still: boolean): StageNow | null {
  const payload = payloadOf(overlay)
  const t = Math.max(0, now - overlay.since)
  const duration = durationOf(overlay, payload)
  const done = t >= duration
  const next = done ? nextPhase(overlay, payload) : null
  if (overlay.kind === 'pack' && overlay.phase === 'cards' && overlay.chosen) {
    const chosen = (payload.options ?? []).find((row) => row.id === overlay.chosen)
    if (chosen) return { frame: showFrame(cols, optionFace(chosen)), done: true, next: null }
  }
  if (overlay.kind === 'pack') {
    const faces = payload.packKind === 'retest'
      ? (payload.results ?? []).map((card) => resultFace(card))
      : (payload.options ?? []).map(optionFace)
    const frame = packFrame({
      kind: payload.packKind ?? 'experiment',
      phase: overlay.phase as PackPhase,
      t: Math.min(t, duration === Number.POSITIVE_INFINITY ? t : duration),
      cols,
      faces,
      gilded: (payload.results ?? []).map((card) => !card.plain),
      still,
      seed: overlay.since % 997,
    })
    return { frame, done, next }
  }
  if (overlay.kind === 'reveal' && payload.run) {
    const frame = revealFrame({
      phase: overlay.phase as RevealPhase,
      t: Math.min(t, duration === Number.POSITIVE_INFINITY ? t : duration),
      cols,
      face: runFace(payload.run),
      good: goodRun(payload.run),
      still,
      seed: overlay.since % 991,
    })
    return { frame, done, next }
  }
  if (overlay.kind === 'result' && payload.run) {
    return { frame: showFrame(cols, runFace(payload.run), { good: goodRun(payload.run), calmStamp: Boolean(payload.run.result) && !goodRun(payload.run) }), done: true, next: null }
  }
  if (overlay.kind === 'study' && payload.study) {
    return { frame: showFrame(cols, studyFace(payload.study)), done: true, next: null }
  }
  if (overlay.kind === 'species' && payload.species) {
    return { frame: showFrame(cols, speciesFace(payload.species, !payload.species.met)), done: true, next: null }
  }
  if (overlay.kind === 'reveal') return null
  if (payload.footprint) return { frame: showFrame(cols, footprintFace(payload.footprint.kind)), done: true, next: null }
  if (payload.option) return { frame: showFrame(cols, optionFace(payload.option)), done: true, next: null }
  return null
}

/** The stage's width for a page `width` wide. */
export function stageCols(width: number): number {
  return Math.max(52, Math.min(width, 96))
}
