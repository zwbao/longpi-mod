// Dropout-tolerant secure aggregation.
// Each participant masks their clipped value with a seed. Seeds are shared with Shamir.
// Holders add the shares they were dealt (Shamir is linear) and the server reconstructs
// only the sum of the seeds of people who submitted. One seed is not opened.
// A round with threshold t still finishes when at least t participants submit.
// Fewer than t submissions fail closed: there is no partial release.

import { fromFixed, toFixed } from './secagg.ts'
import { MASK_PRIME, modP, shamirReconstruct, type RawShare, type ShamirShare } from './shamir.ts'

export { MASK_PRIME }

export function fieldRng(seed: number): () => bigint {
  let state = BigInt(seed >>> 0) || 1n
  return () => {
    state = modP(state * 6364136223846793005n + 1442695040888963407n)
    return state
  }
}

/** Largest t that still reconstructs after dropping `rate` of n people. */
export function thresholdFor(n: number, dropoutRate: number): number {
  if (n < 2) throw new Error('need at least two participants')
  const drop = Math.round(n * dropoutRate)
  const t = n - drop
  if (t < 2) throw new Error('dropout rate leaves fewer than two participants')
  return t
}

export function dropoutCount(n: number, rate: number): number {
  return Math.round(n * rate)
}

/** Same seeds and shares, new masked values. Noise draws do not need another dealing. */
export function applyValues(round: ThresholdRound, values: readonly { id: string; value: number }[]): ThresholdRound {
  const byId = new Map(values.map((row) => [row.id, row.value]))
  return {
    t: round.t,
    participants: round.participants,
    prepared: round.prepared.map((row) => ({
      ...row,
      masked: modP(toFixed(byId.get(row.id) ?? 0) + row.secret),
      shares: row.shares,
    })),
  }
}

interface Prepared {
  id: string
  x: number
  secret: bigint
  masked: bigint
  /** Shares of this secret, indexed by the holder's x (1-based) minus 1. One entry per participant. */
  shares: RawShare[]
}

export interface ThresholdRound {
  t: number
  participants: Array<{ id: string; x: number }>
  prepared: Prepared[]
}

/**
 * Deal a mask seed to every participant, then mask `value`.
 * Dropouts are applied later by `finishRound`, which uses only the shares the survivors still hold.
 */
export function dealRound(rows: readonly { id: string; value: number }[], t: number, random: () => bigint = fieldRng(20260928)): ThresholdRound {
  const n = rows.length
  if (t < 2 || t > n) throw new Error('threshold must sit between 2 and n')
  const xs = Array.from({ length: n }, (_, index) => index + 1)
  const powers = xs.map((x) => powersOf(x, t))
  const prepared: Prepared[] = []
  for (let index = 0; index < n; index += 1) {
    const row = rows[index]!
    const secret = random()
    const shares = shareWithPowers(secret, xs, powers, t, random)
    prepared.push({
      id: row.id,
      x: index + 1,
      secret,
      masked: modP(toFixed(row.value) + secret),
      shares,
    })
  }
  return { t, participants: prepared.map(({ id, x }) => ({ id, x })), prepared }
}

function powersOf(x: number, t: number): bigint[] {
  const powers = new Array<bigint>(t)
  let xp = 1n
  const bx = BigInt(x)
  for (let i = 0; i < t; i += 1) {
    powers[i] = xp
    xp = modP(xp * bx)
  }
  return powers
}

function shareWithPowers(secret: bigint, xs: readonly number[], powers: readonly bigint[][], t: number, random: () => bigint): RawShare[] {
  const coeff: bigint[] = new Array(t)
  coeff[0] = modP(secret)
  for (let i = 1; i < t; i += 1) coeff[i] = random()
  const shares: RawShare[] = new Array(xs.length)
  for (let k = 0; k < xs.length; k += 1) {
    const row = powers[k] ?? []
    let y = 0n
    for (let i = 0; i < t; i += 1) y = modP(y + (coeff[i] ?? 0n) * (row[i] ?? 0n))
    shares[k] = { x: xs[k] ?? 0, y }
  }
  return shares
}

export interface FinishedRound {
  ok: true
  n: number
  t: number
  dropped: string[]
  sum: number
  mean: number
  /** What the server is allowed to see. */
  server: {
    masked: Array<{ client_id: string; masked: string }>
    summed: Array<{ client_id: string; x: number; y: string }>
  }
}

export interface FailedRound {
  ok: false
  reason: 'threshold'
  n: number
  t: number
  dropped: string[]
}

/** Survivors sum the shares they hold and the server reconstructs the seed sum. */
export function finishRound(round: ThresholdRound, dropIds: readonly string[]): FinishedRound | FailedRound {
  const dropped = new Set(dropIds)
  const survivors = round.prepared.filter((row) => !dropped.has(row.id))
  const gone = round.prepared.filter((row) => dropped.has(row.id)).map((row) => row.id)
  if (survivors.length < round.t) return { ok: false, reason: 'threshold', n: survivors.length, t: round.t, dropped: gone }
  const holders = survivors.slice(0, round.t)
  const summed = holders.map((holder) => {
    const index = holder.x - 1
    let y = 0n
    for (const owner of survivors) y = modP(y + (owner.shares[index]?.y ?? 0n))
    return { client_id: holder.id, x: holder.x, y: y.toString(10) }
  })
  const masked = survivors.map((row) => ({ client_id: row.id, masked: row.masked.toString(10) }))
  const recovered = recoverServerSum(masked, summed, round.t)
  return {
    ok: true,
    n: survivors.length,
    t: round.t,
    dropped: gone,
    sum: recovered.sum,
    mean: recovered.mean,
    server: { masked, summed },
  }
}

/** Server-side: masked submissions plus t summed seed-shares. No single seed is an input. */
export function recoverServerSum(
  masked: readonly { client_id: string; masked: string }[],
  summed: readonly { x: number; y: string }[],
  t: number,
): { sum: number; mean: number; n: number } {
  if (summed.length < t) throw new Error('not enough summed shares')
  const shares: ShamirShare[] = summed.slice(0, t).map((row) => ({ x: row.x, y: row.y }))
  const secretSum = reconstructSecret(shares, t)
  let maskedSum = 0n
  for (const row of masked) maskedSum = modP(maskedSum + BigInt(row.masked))
  const total = fromField(modP(maskedSum - secretSum))
  const n = masked.length
  return { sum: fromFixed(total), mean: n > 0 ? fromFixed(total) / n : 0, n }
}

function reconstructSecret(shares: readonly ShamirShare[], t: number): bigint {
  return shamirReconstruct(shares, t)
}

function fromField(value: bigint): bigint {
  return value > MASK_PRIME / 2n ? value - MASK_PRIME : value
}

/** True when the masked field element is not the fixed-point value. */
export function isMasked(value: number, masked: bigint): boolean {
  return masked !== modP(toFixed(value))
}
