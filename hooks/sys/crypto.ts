// node:crypto for the core: SHA-256 and SHA-1 digests, HMAC, random bytes and UUIDs, all synchronous.
// Ed25519 and X25519 keys (the research module's signed feeds and simulated secure aggregation) come from
// curve.ts.

import { Buffer } from './buffer.ts'
import { edPublic, edSign, edVerify, x25519, x25519Public } from './curve.ts'

function utf8(data: string | Uint8Array): Uint8Array {
  return typeof data === 'string' ? new TextEncoder().encode(data) : data
}

const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

function pad(bytes: Uint8Array): Uint8Array {
  const bitLen = bytes.length * 8
  const total = Math.ceil((bytes.length + 9) / 64) * 64
  const out = new Uint8Array(total)
  out.set(bytes)
  out[bytes.length] = 0x80
  const view = new DataView(out.buffer)
  view.setUint32(total - 8, Math.floor(bitLen / 0x100000000))
  view.setUint32(total - 4, bitLen >>> 0)
  return out
}

export function sha256(data: string | Uint8Array): Uint8Array {
  const msg = pad(utf8(data))
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])
  const w = new Uint32Array(64)
  const view = new DataView(msg.buffer)
  for (let off = 0; off < msg.length; off += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(off + i * 4)
    for (let i = 16; i < 64; i += 1) {
      const a = w[i - 15]!
      const b = w[i - 2]!
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3)
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10)
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, hh] = [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!]
    for (let i = 0; i < 64; i += 1) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + S1 + ch + K256[i]! + w[i]!) >>> 0
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      hh = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    h[0] = (h[0]! + a) >>> 0
    h[1] = (h[1]! + b) >>> 0
    h[2] = (h[2]! + c) >>> 0
    h[3] = (h[3]! + d) >>> 0
    h[4] = (h[4]! + e) >>> 0
    h[5] = (h[5]! + f) >>> 0
    h[6] = (h[6]! + g) >>> 0
    h[7] = (h[7]! + hh) >>> 0
  }
  const out = new Uint8Array(32)
  const ov = new DataView(out.buffer)
  for (let i = 0; i < 8; i += 1) ov.setUint32(i * 4, h[i]!)
  return out
}

export function sha1(data: string | Uint8Array): Uint8Array {
  const msg = pad(utf8(data))
  const h = new Uint32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0])
  const w = new Uint32Array(80)
  const view = new DataView(msg.buffer)
  for (let off = 0; off < msg.length; off += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(off + i * 4)
    for (let i = 16; i < 80; i += 1) {
      const x = w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!
      w[i] = (x << 1) | (x >>> 31)
    }
    let [a, b, c, d, e] = [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!]
    for (let i = 0; i < 80; i += 1) {
      const [f, k] = i < 20 ? [(b & c) | (~b & d), 0x5a827999] : i < 40 ? [b ^ c ^ d, 0x6ed9eba1] : i < 60 ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc] : [b ^ c ^ d, 0xca62c1d6]
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]!) >>> 0
      e = d
      d = c
      c = (b << 30) | (b >>> 2)
      b = a
      a = t
    }
    h[0] = (h[0]! + a) >>> 0
    h[1] = (h[1]! + b) >>> 0
    h[2] = (h[2]! + c) >>> 0
    h[3] = (h[3]! + d) >>> 0
    h[4] = (h[4]! + e) >>> 0
  }
  const out = new Uint8Array(20)
  const ov = new DataView(out.buffer)
  for (let i = 0; i < 5; i += 1) ov.setUint32(i * 4, h[i]!)
  return out
}

type Algo = 'sha256' | 'sha1'

function digestOf(algo: string, data: Uint8Array): Uint8Array {
  if (algo === 'sha1') return sha1(data)
  return sha256(data)
}

function blockOf(_algo: string): number {
  return 64
}

class Hash {
  private parts: Uint8Array[] = []
  constructor(private readonly algo: Algo | string) {}
  update(data: string | Uint8Array, _encoding?: string): this {
    this.parts.push(utf8(data))
    return this
  }
  digest(): Buffer
  digest(encoding: 'hex' | 'base64' | 'base64url'): string
  digest(encoding?: 'hex' | 'base64' | 'base64url'): Buffer | string {
    const out = Buffer.fromBytes(digestOf(this.algo, Buffer.concat(this.parts)))
    return encoding ? out.toString(encoding) : out
  }
}

export function createHash(algo: string): Hash {
  return new Hash(algo)
}

class Hmac {
  private parts: Uint8Array[] = []
  private readonly key: Uint8Array
  constructor(private readonly algo: string, key: string | Uint8Array) {
    let k = utf8(key)
    const block = blockOf(algo)
    if (k.length > block) k = digestOf(algo, k)
    const padded = new Uint8Array(block)
    padded.set(k)
    this.key = padded
  }
  update(data: string | Uint8Array, _encoding?: string): this {
    this.parts.push(utf8(data))
    return this
  }
  digest(): Buffer
  digest(encoding: 'hex' | 'base64' | 'base64url'): string
  digest(encoding?: 'hex' | 'base64' | 'base64url'): Buffer | string {
    const inner = this.key.map((b) => b ^ 0x36)
    const outer = this.key.map((b) => b ^ 0x5c)
    const ih = digestOf(this.algo, Buffer.concat([inner, ...this.parts]))
    const out = Buffer.fromBytes(digestOf(this.algo, Buffer.concat([outer, ih])))
    return encoding ? out.toString(encoding) : out
  }
}

export function createHmac(algo: string, key: string | Uint8Array): Hmac {
  return new Hmac(algo, key)
}

export function randomBytes(size: number): Buffer {
  const out = new Buffer(size)
  crypto.getRandomValues(out)
  return out
}

export function randomUUID(): string {
  return crypto.randomUUID()
}

export function randomInt(min: number, max?: number): number {
  const [lo, hi] = max === undefined ? [0, min] : [min, max]
  const span = hi - lo
  const word = new Uint32Array(1)
  crypto.getRandomValues(word)
  return lo + (word[0]! % span)
}

const ED_SPKI = Buffer.from('302a300506032b6570032100', 'hex')
const X_SPKI = Buffer.from('302a300506032b656e032100', 'hex')

type Curve = 'ed25519' | 'x25519'

/** Node's KeyObject for the two curves the research module uses, holding the raw 32-byte key. */
export class KeyObject {
  constructor(readonly type: 'public' | 'private', readonly asymmetricKeyType: Curve, readonly raw: Uint8Array) {}

  export(options: { format?: string; type?: string } = {}): any {
    const pub = this.type === 'public' ? this.raw : this.asymmetricKeyType === 'ed25519' ? edPublic(this.raw) : x25519Public(this.raw)
    if (options.format === 'jwk') {
      return {
        kty: 'OKP',
        crv: this.asymmetricKeyType === 'ed25519' ? 'Ed25519' : 'X25519',
        x: Buffer.fromBytes(pub).toString('base64url'),
        ...(this.type === 'private' ? { d: Buffer.fromBytes(this.raw).toString('base64url') } : {}),
      }
    }
    if (options.format === 'der' && this.type === 'public') return Buffer.concat([this.asymmetricKeyType === 'ed25519' ? ED_SPKI : X_SPKI, pub])
    return Buffer.fromBytes(this.raw)
  }
}

function keyFrom(input: unknown, type: 'public' | 'private'): KeyObject {
  if (input instanceof KeyObject) return type === 'public' && input.type === 'private' ? publicOf(input) : input
  const spec = input as { key?: unknown; format?: string; type?: string }
  const key = spec && typeof spec === 'object' && 'key' in spec ? spec.key : input
  if (key instanceof Uint8Array) {
    const bytes = Uint8Array.from(key)
    if (bytes.length === 44) {
      const curve: Curve = bytes[8] === 0x70 ? 'ed25519' : 'x25519'
      return new KeyObject('public', curve, bytes.slice(12))
    }
    if (bytes.length === 32) return new KeyObject(type, 'ed25519', bytes)
  }
  if (key && typeof key === 'object') {
    const jwk = key as { crv?: string; x?: string; d?: string }
    const curve: Curve = jwk.crv === 'X25519' ? 'x25519' : 'ed25519'
    if (type === 'private' && jwk.d) return new KeyObject('private', curve, Buffer.from(jwk.d, 'base64url'))
    if (jwk.x) return new KeyObject('public', curve, Buffer.from(jwk.x, 'base64url'))
  }
  throw new Error('unsupported key')
}

function publicOf(key: KeyObject): KeyObject {
  return new KeyObject('public', key.asymmetricKeyType, key.asymmetricKeyType === 'ed25519' ? edPublic(key.raw) : x25519Public(key.raw))
}

export function createPublicKey(input: unknown): KeyObject {
  return keyFrom(input, 'public')
}

export function createPrivateKey(input: unknown): KeyObject {
  return keyFrom(input, 'private')
}

export function generateKeyPairSync(type: string, _options?: unknown): { publicKey: KeyObject; privateKey: KeyObject } {
  if (type !== 'ed25519' && type !== 'x25519') throw new Error(`generateKeyPairSync(${type}) is not available in the LongPi mod`)
  const seed = randomBytes(32)
  const privateKey = new KeyObject('private', type, seed)
  return { publicKey: publicOf(privateKey), privateKey }
}

export function sign(_algo: unknown, data: Uint8Array, key: unknown): Buffer {
  const k = keyFrom(key, 'private')
  return Buffer.fromBytes(edSign(k.raw, data))
}

export function verify(_algo: unknown, data: Uint8Array, key: unknown, sig: Uint8Array): boolean {
  const k = keyFrom(key, 'public')
  return edVerify(k.raw, data, sig)
}

export function diffieHellman(options: { privateKey: KeyObject; publicKey: KeyObject }): Buffer {
  return Buffer.fromBytes(x25519(options.privateKey.raw, options.publicKey.raw))
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}
