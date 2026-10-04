// Synthetic cohort through the threshold aggregator.
// Participants are generated here. Nothing in this file is a real person.

import { clipValue, distributedSigma, gaussianDraw, rngFromSeed, seedFor } from './dp.ts'
import { applyValues, dealRound, dropoutCount, fieldRng, finishRound, thresholdFor } from './threshold.ts'

const CLIP: [number, number] = [0, 40]
const DELTA = 1e-6

export interface SimRow {
  dropout: number
  epsilon: number
  survivors: number
  mae_vs_truth: number
  max_abs_vs_noisy: number
  reaches_400: boolean
  reaches_3000: boolean
}

export interface SimReport {
  n: number
  synthetic: true
  t: number
  mechanism: 'gaussian'
  delta: number
  clip: [number, number]
  noise_zh: string
  deal_ms: number
  rows: SimRow[]
  sample: {
    dropout: number
    epsilon: number
    survivors: number
    noisy_mean: number
    truth_mean: number
    recovered_mean: number
    abs_vs_noisy: number
    reaches_400: boolean
    reaches_3000: boolean
    masked: Array<{ client_id: string; masked: string }>
    summed: Array<{ client_id: string; x: number; y: string }>
  }
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gauss(rng: () => number): number {
  return gaussianDraw(rng, 1)
}

function shuffle(ids: readonly string[], seed: number): string[] {
  const copy = ids.slice()
  const rng = mulberry32(seed)
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const swap = copy[i]!
    copy[i] = copy[j]!
    copy[j] = swap
  }
  return copy
}

function fixedSum(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + Math.round(value * 1_000_000), 0) / 1_000_000
}

export function simulateCohort(opts: { n?: number; seeds?: number } = {}): SimReport {
  const n = opts.n ?? 500
  const seeds = opts.seeds ?? 8
  const t = thresholdFor(n, 0.3)
  const pop = mulberry32(20260928)
  const people = Array.from({ length: n }, (_, index) => ({
    id: `syn-${String(index + 1).padStart(4, '0')}`,
    truth: clipValue(4.7 + 1.2 * gauss(pop), CLIP).value,
  }))
  const started = Date.now()
  const dealt = dealRound(people.map((row) => ({ id: row.id, value: 0 })), t, fieldRng(20260928))
  const dealMs = Date.now() - started
  const rates = [0.1, 0.2, 0.3]
  const epsilons = [1, 2, 4]
  const rows: SimRow[] = []
  let sample: SimReport['sample'] | null = null
  for (const dropout of rates) {
    const dropped = new Set(shuffle(people.map((row) => row.id), Math.round(dropout * 1000)).slice(0, dropoutCount(n, dropout)))
    const survivors = people.filter((row) => !dropped.has(row.id))
    const truthMean = survivors.reduce((sum, row) => sum + row.truth, 0) / survivors.length
    for (const epsilon of epsilons) {
      const errors: number[] = []
      let maxAbs = 0
      const sigma = distributedSigma(CLIP[1] - CLIP[0], epsilon, DELTA, t)
      for (let seedIndex = 0; seedIndex < seeds; seedIndex += 1) {
        const rng = rngFromSeed(seedFor(['s2', String(dropout), String(epsilon), String(seedIndex)]))
        const noised = people.map((row) => ({ id: row.id, value: row.truth + gaussianDraw(rng, sigma) }))
        const finished = finishRound(applyValues(dealt, noised), [...dropped])
        if (!finished.ok) throw new Error(`round failed at dropout ${dropout}`)
        const survivorNoised = noised.filter((row) => !dropped.has(row.id)).map((row) => row.value)
        const noisySum = fixedSum(survivorNoised)
        maxAbs = Math.max(maxAbs, Math.abs(finished.sum - noisySum))
        errors.push(finished.mean - truthMean)
        if (!sample && dropout === 0.2 && epsilon === 2 && seedIndex === 0) {
          sample = {
            dropout,
            epsilon,
            survivors: finished.n,
            noisy_mean: noisySum / finished.n,
            truth_mean: truthMean,
            recovered_mean: finished.mean,
            abs_vs_noisy: Math.abs(finished.sum - noisySum),
            reaches_400: finished.n >= 400,
            reaches_3000: finished.n >= 3000,
            masked: finished.server.masked,
            summed: finished.server.summed,
          }
        }
      }
      const mae = errors.reduce((sum, value) => sum + Math.abs(value), 0) / errors.length
      rows.push({
        dropout,
        epsilon,
        survivors: survivors.length,
        mae_vs_truth: mae,
        max_abs_vs_noisy: maxAbs,
        reaches_400: survivors.length >= 400,
        reaches_3000: survivors.length >= 3000,
      })
    }
  }
  if (!sample) throw new Error('sample round missing')
  return {
    n,
    synthetic: true,
    t,
    mechanism: 'gaussian',
    delta: DELTA,
    clip: CLIP,
    noise_zh: '每个人加的是合计噪声的一份。阈值 t 按最多掉 30% 来定，所以剩下的人仍至少达到标定的 σ；人比 t 多时噪声更大。',
    deal_ms: dealMs,
    rows,
    sample,
  }
}
