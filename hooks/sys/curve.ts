// SHA-512, Ed25519 (RFC 8032) and X25519 (RFC 7748) in BigInt arithmetic, for the research module's signed
// study feeds and its simulated secure aggregation. Plain and slow next to native code, which is fine for a
// few manifests and masks; nothing here protects a production key.

const MASK64 = (1n << 64n) - 1n

const K512 = [
  '428a2f98d728ae22', '7137449123ef65cd', 'b5c0fbcfec4d3b2f', 'e9b5dba58189dbbc', '3956c25bf348b538', '59f111f1b605d019', '923f82a4af194f9b', 'ab1c5ed5da6d8118',
  'd807aa98a3030242', '12835b0145706fbe', '243185be4ee4b28c', '550c7dc3d5ffb4e2', '72be5d74f27b896f', '80deb1fe3b1696b1', '9bdc06a725c71235', 'c19bf174cf692694',
  'e49b69c19ef14ad2', 'efbe4786384f25e3', '0fc19dc68b8cd5b5', '240ca1cc77ac9c65', '2de92c6f592b0275', '4a7484aa6ea6e483', '5cb0a9dcbd41fbd4', '76f988da831153b5',
  '983e5152ee66dfab', 'a831c66d2db43210', 'b00327c898fb213f', 'bf597fc7beef0ee4', 'c6e00bf33da88fc2', 'd5a79147930aa725', '06ca6351e003826f', '142929670a0e6e70',
  '27b70a8546d22ffc', '2e1b21385c26c926', '4d2c6dfc5ac42aed', '53380d139d95b3df', '650a73548baf63de', '766a0abb3c77b2a8', '81c2c92e47edaee6', '92722c851482353b',
  'a2bfe8a14cf10364', 'a81a664bbc423001', 'c24b8b70d0f89791', 'c76c51a30654be30', 'd192e819d6ef5218', 'd69906245565a910', 'f40e35855771202a', '106aa07032bbd1b8',
  '19a4c116b8d2d0c8', '1e376c085141ab53', '2748774cdf8eeb99', '34b0bcb5e19b48a8', '391c0cb3c5c95a63', '4ed8aa4ae3418acb', '5b9cca4f7763e373', '682e6ff3d6b2b8a3',
  '748f82ee5defb2fc', '78a5636f43172f60', '84c87814a1f0ab72', '8cc702081a6439ec', '90befffa23631e28', 'a4506cebde82bde9', 'bef9a3f7b2c67915', 'c67178f2e372532b',
  'ca273eceea26619c', 'd186b8c721c0c207', 'eada7dd6cde0eb1e', 'f57d4f7fee6ed178', '06f067aa72176fba', '0a637dc5a2c898a6', '113f9804bef90dae', '1b710b35131c471b',
  '28db77f523047d84', '32caab7b40c72493', '3c9ebe0a15c9bebc', '431d67c49c100d4c', '4cc5d4becb3e42b6', '597f299cfc657e2a', '5fcb6fab3ad6faec', '6c44198c4a475817',
].map((hex) => BigInt(`0x${hex}`))

const rotr = (x: bigint, n: bigint): bigint => ((x >> n) | (x << (64n - n))) & MASK64

export function sha512(data: Uint8Array): Uint8Array {
  const bitLen = BigInt(data.length) * 8n
  const total = Math.ceil((data.length + 17) / 128) * 128
  const msg = new Uint8Array(total)
  msg.set(data)
  msg[data.length] = 0x80
  for (let i = 0; i < 16; i += 1) msg[total - 1 - i] = Number((bitLen >> BigInt(8 * i)) & 0xffn)
  const h = [
    0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
    0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n,
  ]
  const w = new Array<bigint>(80).fill(0n)
  for (let off = 0; off < total; off += 128) {
    for (let i = 0; i < 16; i += 1) {
      let v = 0n
      for (let j = 0; j < 8; j += 1) v = (v << 8n) | BigInt(msg[off + i * 8 + j] ?? 0)
      w[i] = v
    }
    for (let i = 16; i < 80; i += 1) {
      const a = w[i - 15] as bigint
      const b = w[i - 2] as bigint
      const s0 = rotr(a, 1n) ^ rotr(a, 8n) ^ (a >> 7n)
      const s1 = rotr(b, 19n) ^ rotr(b, 61n) ^ (b >> 6n)
      w[i] = ((w[i - 16] as bigint) + s0 + (w[i - 7] as bigint) + s1) & MASK64
    }
    let [a, b, c, d, e, f, g, hh] = h as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]
    for (let i = 0; i < 80; i += 1) {
      const S1 = rotr(e, 14n) ^ rotr(e, 18n) ^ rotr(e, 41n)
      const ch = (e & f) ^ (~e & MASK64 & g)
      const t1 = (hh + S1 + ch + (K512[i] as bigint) + (w[i] as bigint)) & MASK64
      const S0 = rotr(a, 28n) ^ rotr(a, 34n) ^ rotr(a, 39n)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) & MASK64
      hh = g
      g = f
      f = e
      e = (d + t1) & MASK64
      d = c
      c = b
      b = a
      a = (t1 + t2) & MASK64
    }
    const next = [a, b, c, d, e, f, g, hh]
    for (let i = 0; i < 8; i += 1) h[i] = ((h[i] as bigint) + (next[i] as bigint)) & MASK64
  }
  const out = new Uint8Array(64)
  for (let i = 0; i < 8; i += 1) for (let j = 0; j < 8; j += 1) out[i * 8 + j] = Number(((h[i] as bigint) >> BigInt(56 - j * 8)) & 0xffn)
  return out
}

// --- field and group ----------------------------------------------------------------------------------

const P = (1n << 255n) - 19n
const L = (1n << 252n) + 27742317777372353535851937790883648493n

const mod = (a: bigint, m = P): bigint => {
  const r = a % m
  return r >= 0n ? r : r + m
}

function pow(base: bigint, exp: bigint, m = P): bigint {
  let result = 1n
  let b = mod(base, m)
  let e = exp
  while (e > 0n) {
    if (e & 1n) result = (result * b) % m
    b = (b * b) % m
    e >>= 1n
  }
  return result
}

const inv = (a: bigint): bigint => pow(a, P - 2n)
const D = mod(-121665n * inv(121666n))
const SQRT_M1 = pow(2n, (P - 1n) / 4n)

type Point = { x: bigint; y: bigint; z: bigint; t: bigint }

function add(p: Point, q: Point): Point {
  const a = mod((p.y - p.x) * (q.y - q.x))
  const b = mod((p.y + p.x) * (q.y + q.x))
  const c = mod(p.t * 2n * D * q.t)
  const d = mod(p.z * 2n * q.z)
  const e = b - a
  const f = d - c
  const g = d + c
  const h = b + a
  return { x: mod(e * f), y: mod(g * h), z: mod(f * g), t: mod(e * h) }
}

const ZERO: Point = { x: 0n, y: 1n, z: 1n, t: 0n }

function mul(k: bigint, p: Point): Point {
  let result = ZERO
  let addend = p
  let n = k
  while (n > 0n) {
    if (n & 1n) result = add(result, addend)
    addend = add(addend, addend)
    n >>= 1n
  }
  return result
}

function recoverX(y: bigint, sign: bigint): bigint | null {
  const y2 = mod(y * y)
  const x2 = mod((y2 - 1n) * inv(mod(D * y2 + 1n)))
  if (x2 === 0n) return sign ? null : 0n
  let x = pow(x2, (P + 3n) / 8n)
  if (mod(x * x - x2) !== 0n) x = mod(x * SQRT_M1)
  if (mod(x * x - x2) !== 0n) return null
  if ((x & 1n) !== sign) x = P - x
  return x
}

const BY = mod(4n * inv(5n))
const BX = recoverX(BY, 0n) as bigint
const BASE: Point = { x: BX, y: BY, z: 1n, t: mod(BX * BY) }

function leToBig(bytes: Uint8Array): bigint {
  let out = 0n
  for (let i = bytes.length - 1; i >= 0; i -= 1) out = (out << 8n) | BigInt(bytes[i] ?? 0)
  return out
}

function bigToLe(value: bigint, length = 32): Uint8Array {
  const out = new Uint8Array(length)
  let v = value
  for (let i = 0; i < length; i += 1) {
    out[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return out
}

function encode(p: Point): Uint8Array {
  const zi = inv(p.z)
  const x = mod(p.x * zi)
  const y = mod(p.y * zi)
  const out = bigToLe(y)
  out[31] = (out[31] ?? 0) | (Number(x & 1n) << 7)
  return out
}

function decode(bytes: Uint8Array): Point | null {
  if (bytes.length !== 32) return null
  const copy = Uint8Array.from(bytes)
  const sign = BigInt((copy[31] ?? 0) >> 7)
  copy[31] = (copy[31] ?? 0) & 0x7f
  const y = leToBig(copy)
  if (y >= P) return null
  const x = recoverX(y, sign)
  if (x === null) return null
  return { x, y, z: 1n, t: mod(x * y) }
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

function expand(seed: Uint8Array): { a: bigint; prefix: Uint8Array } {
  const h = sha512(seed)
  const head = h.slice(0, 32)
  head[0] = (head[0] ?? 0) & 248
  head[31] = ((head[31] ?? 0) & 127) | 64
  return { a: leToBig(head), prefix: h.slice(32) }
}

export function edPublic(seed: Uint8Array): Uint8Array {
  return encode(mul(expand(seed).a, BASE))
}

export function edSign(seed: Uint8Array, message: Uint8Array): Uint8Array {
  const { a, prefix } = expand(seed)
  const pub = encode(mul(a, BASE))
  const r = mod(leToBig(sha512(concat(prefix, message))), L)
  const R = encode(mul(r, BASE))
  const k = mod(leToBig(sha512(concat(R, pub, message))), L)
  const S = mod(r + k * a, L)
  return concat(R, bigToLe(S))
}

export function edVerify(pub: Uint8Array, message: Uint8Array, sig: Uint8Array): boolean {
  if (sig.length !== 64 || pub.length !== 32) return false
  const A = decode(pub)
  const R = decode(sig.slice(0, 32))
  if (!A || !R) return false
  const S = leToBig(sig.slice(32))
  if (S >= L) return false
  const k = mod(leToBig(sha512(concat(sig.slice(0, 32), pub, message))), L)
  const left = encode(mul(S, BASE))
  const right = encode(add(R, mul(k, A)))
  return left.every((byte, i) => byte === right[i])
}

// --- X25519 -------------------------------------------------------------------------------------------

export function x25519(scalar: Uint8Array, u: Uint8Array): Uint8Array {
  const k = Uint8Array.from(scalar)
  k[0] = (k[0] ?? 0) & 248
  k[31] = ((k[31] ?? 0) & 127) | 64
  const kn = leToBig(k)
  const uc = Uint8Array.from(u)
  uc[31] = (uc[31] ?? 0) & 127
  const x1 = mod(leToBig(uc))
  let x2 = 1n
  let z2 = 0n
  let x3 = x1
  let z3 = 1n
  let swap = 0n
  for (let t = 254n; t >= 0n; t -= 1n) {
    const kt = (kn >> t) & 1n
    swap ^= kt
    if (swap) {
      ;[x2, x3] = [x3, x2]
      ;[z2, z3] = [z3, z2]
    }
    swap = kt
    const A = mod(x2 + z2)
    const AA = mod(A * A)
    const B = mod(x2 - z2)
    const BB = mod(B * B)
    const E = mod(AA - BB)
    const C = mod(x3 + z3)
    const Dd = mod(x3 - z3)
    const DA = mod(Dd * A)
    const CB = mod(C * B)
    x3 = mod((DA + CB) * (DA + CB))
    z3 = mod(x1 * mod((DA - CB) * (DA - CB)))
    x2 = mod(AA * BB)
    z2 = mod(E * (AA + 121665n * E))
  }
  if (swap) {
    ;[x2, x3] = [x3, x2]
    ;[z2, z3] = [z3, z2]
  }
  return bigToLe(mod(x2 * inv(z2)))
}

const NINE = (() => {
  const out = new Uint8Array(32)
  out[0] = 9
  return out
})()

export function x25519Public(scalar: Uint8Array): Uint8Array {
  return x25519(scalar, NINE)
}
