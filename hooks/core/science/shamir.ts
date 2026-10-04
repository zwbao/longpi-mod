// Shamir secret sharing over the Mersenne prime 2^61 − 1.
// Shares are exact. Reconstruction at zero uses Lagrange interpolation in the field.
// A secret is one mask seed. The aggregator is given shares of a sum, not each seed.

export const MASK_PRIME = (1n << 61n) - 1n

export interface ShamirShare {
  /** Public evaluation point, 1-based, unique inside one dealing. */
  x: number
  /** Field element, decimal, so it survives JSON. */
  y: string
}

export interface RawShare {
  x: number
  y: bigint
}

export function modP(value: bigint): bigint {
  const prime = MASK_PRIME
  let rest = value % prime
  if (rest < 0n) rest += prime
  return rest
}

export function modInverse(value: bigint): bigint {
  let t = 0n
  let newT = 1n
  let r = MASK_PRIME
  let newR = modP(value)
  while (newR !== 0n) {
    const q = r / newR
    ;[t, newT] = [newT, t - q * newT]
    ;[r, newR] = [newR, r - q * newR]
  }
  if (r !== 1n) throw new Error('mask seed share has no inverse')
  return modP(t)
}

const PRIME = MASK_PRIME

function modPrime(value: bigint): bigint {
  let rest = value % PRIME
  if (rest < 0n) rest += PRIME
  return rest
}

/**
 * Split `secret` into shares at `xs` with reconstruction threshold `t` (any t of those shares).
 * `xs` are the public points. Pass `1..n` to deal to every participant.
 */
export function shamirSplitRaw(secret: bigint, xs: readonly number[], t: number, random: () => bigint): RawShare[] {
  if (!Number.isInteger(t) || t < 1 || xs.length < t || xs.length > 4000) throw new Error('bad shamir parameters')
  const coeff: bigint[] = new Array(t)
  coeff[0] = modPrime(secret)
  for (let i = 1; i < t; i += 1) coeff[i] = modPrime(random())
  const shares: RawShare[] = new Array(xs.length)
  for (let k = 0; k < xs.length; k += 1) {
    const x = xs[k] ?? 0
    if (!Number.isInteger(x) || x <= 0) throw new Error('share point must be a positive integer')
    let y = 0n
    let xp = 1n
    const bx = BigInt(x)
    for (let i = 0; i < t; i += 1) {
      const c = coeff[i] ?? 0n
      y += c * xp
      if (y >= PRIME || y < 0n) y = modPrime(y)
      xp *= bx
      if (xp >= PRIME) xp %= PRIME
    }
    shares[k] = { x, y: y >= PRIME || y < 0n ? modPrime(y) : y }
  }
  return shares
}

export function shamirSplitAt(secret: bigint, xs: readonly number[], t: number, random: () => bigint): ShamirShare[] {
  return shamirSplitRaw(secret, xs, t, random).map((share) => ({ x: share.x, y: share.y.toString(10) }))
}

/** Split `secret` into `n` shares at points 1..n. Any `t` of them reconstruct it. */
export function shamirSplit(secret: bigint, n: number, t: number, random: () => bigint): ShamirShare[] {
  if (!Number.isInteger(n) || t > n) throw new Error('bad shamir parameters')
  const xs = Array.from({ length: n }, (_, index) => index + 1)
  return shamirSplitAt(secret, xs, t, random)
}

/** Reconstruct the secret from any `t` shares of a degree-(t−1) polynomial. Extra consistent shares are ignored. */
export function shamirReconstruct(shares: readonly ShamirShare[], t = shares.length): bigint {
  if (shares.length < t || t < 1) throw new Error('not enough shares')
  const used = uniqueShares(shares).slice(0, t)
  if (used.length < t) throw new Error('duplicate share points')
  let secret = 0n
  for (let i = 0; i < used.length; i += 1) {
    let numerator = 1n
    let denominator = 1n
    const xi = BigInt(used[i]!.x)
    for (let j = 0; j < used.length; j += 1) {
      if (i === j) continue
      const xj = BigInt(used[j]!.x)
      numerator = modP(numerator * modP(-xj))
      denominator = modP(denominator * modP(xi - xj))
    }
    const y = BigInt(used[i]!.y)
    secret = modP(secret + y * numerator * modInverse(denominator))
  }
  return secret
}

function uniqueShares(shares: readonly ShamirShare[]): ShamirShare[] {
  const seen = new Set<number>()
  const out: ShamirShare[] = []
  for (const share of shares) {
    if (seen.has(share.x)) continue
    seen.add(share.x)
    out.push(share)
  }
  return out
}

/** Add share values that sit on the same x. Shamir is linear, so this is a share of the sum of the secrets. */
export function sumShares(shares: readonly ShamirShare[]): ShamirShare {
  if (shares.length === 0) throw new Error('no shares to add')
  const x = shares[0]!.x
  let y = 0n
  for (const share of shares) {
    if (share.x !== x) throw new Error('shares of a sum must use the same x')
    y = modP(y + BigInt(share.y))
  }
  return { x, y: y.toString(10) }
}
