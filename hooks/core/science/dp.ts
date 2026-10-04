import { Buffer } from '../../sys/buffer.ts'
// Local differential privacy. Noise is added on this machine, before anything is masked.
// The seed stays here; only sha256(seed) is written down as a commitment.

import { createHash } from '../../sys/crypto.ts'
import { sha256Hex } from './verify.ts'

export type Mechanism = 'laplace' | 'gaussian'

export function sensitivityOf(clip: [number, number]): number {
  return clip[1] - clip[0]
}

/** Laplace scale b = Δ / ε. */
export function laplaceScale(sensitivity: number, epsilon: number): number {
  return sensitivity / epsilon
}

/** Gaussian σ = Δ · sqrt(2 ln(1.25/δ)) / ε. */
export function gaussianSigma(sensitivity: number, epsilon: number, delta: number): number {
  const safeDelta = Math.min(Math.max(delta, 1e-12), 0.1)
  return sensitivity * Math.sqrt(2 * Math.log(1.25 / safeDelta)) / epsilon
}

/** Deterministic uniform (0, 1) from a seed and a counter. */
export function rngFromSeed(seed: Buffer): () => number {
  let counter = 0
  return () => {
    const hash = createHash('sha256').update(seed).update(Buffer.from(String(counter++))).digest()
    return (hash.readUIntBE(0, 6) + 1) / 281474976710656
  }
}

export function seedFor(parts: readonly string[]): Buffer {
  return createHash('sha256').update(parts.join('|'), 'utf8').digest()
}

export function noiseCommitment(seed: Buffer): string {
  return sha256Hex(seed)
}

function laplace(rng: () => number, scale: number): number {
  let u = rng() - 0.5
  if (u === 0) u = 1e-12
  return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u))
}

export function gaussianDraw(rng: () => number, sigma: number): number {
  const u1 = Math.max(rng(), 1e-12)
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma
}

/** σ each of `t` people adds so that t independent shares meet the calibrated Gaussian σ on the sum. */
export function distributedSigma(sensitivity: number, epsilon: number, delta: number, t: number): number {
  if (!(t >= 1)) throw new Error('t must be at least 1')
  return gaussianSigma(sensitivity, epsilon, delta) / Math.sqrt(t)
}

export function clipValue(value: number, clip: [number, number]): { value: number; clipped: boolean } {
  if (value < clip[0]) return { value: clip[0], clipped: true }
  if (value > clip[1]) return { value: clip[1], clipped: true }
  return { value, clipped: false }
}

export interface Noised {
  value: number
  clipped: boolean
  epsilon_spent: number
  delta: number
  mechanism: Mechanism
  noise_commitment: string
  /** Local only. Never put this on a request that leaves the process. */
  seed_hex: string
}

/**
 * Clip, then add noise calibrated to the full clip width (one person's contribution).
 * `epsilon` is the privacy budget for this one number.
 */
export function addNoise(value: number, opts: { mechanism: Mechanism; epsilon: number; delta: number; clip: [number, number]; seed: Buffer }): Noised {
  const clipped = clipValue(value, opts.clip)
  const rng = rngFromSeed(opts.seed)
  const delta = opts.mechanism === 'gaussian' ? opts.delta : 0
  const noise = opts.mechanism === 'gaussian'
    ? gaussianDraw(rng, gaussianSigma(sensitivityOf(opts.clip), opts.epsilon, opts.delta > 0 ? opts.delta : 1e-6))
    : laplace(rng, laplaceScale(sensitivityOf(opts.clip), opts.epsilon))
  return {
    value: clipped.value + noise,
    clipped: clipped.clipped,
    epsilon_spent: opts.epsilon,
    delta,
    mechanism: opts.mechanism,
    noise_commitment: noiseCommitment(opts.seed),
    seed_hex: opts.seed.toString('hex'),
  }
}
