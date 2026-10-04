import { Buffer } from '../../sys/buffer.ts'
// Secure aggregation client: X25519 pairwise masks that cancel when the server sums them.
// The server learns the sum of the fixed-point values, not any one value.

import { createHash, createPublicKey, diffieHellman, generateKeyPairSync, type KeyObject } from '../../sys/crypto.ts'
import { sha256Hex } from './verify.ts'

export const FIELD = 1n << 64n
export const SCALE = 1_000_000

export interface Peer { id: string; publicKey: KeyObject }

export function generateMaskKey(): { secret: KeyObject; publicRaw: Buffer } {
  const { publicKey, privateKey } = generateKeyPairSync('x25519')
  return { secret: privateKey, publicRaw: rawOf(publicKey) }
}

export function rawOf(key: KeyObject): Buffer {
  const jwk = key.export({ format: 'jwk' }) as { x?: string }
  if (!jwk.x) throw new Error('x25519 public key has no x')
  return Buffer.from(jwk.x, 'base64url')
}

export function publicFromRaw(raw: Buffer): KeyObject {
  return createPublicKey({ key: { kty: 'OKP', crv: 'X25519', x: raw.toString('base64url') }, format: 'jwk' })
}

export function mod(value: bigint): bigint {
  const rest = value % FIELD
  return rest >= 0n ? rest : rest + FIELD
}

/** Interpret a field element as a signed integer (sums fit well below 2^63). */
export function toSigned(value: bigint): bigint {
  const wrapped = mod(value)
  return wrapped >= (1n << 63n) ? wrapped - FIELD : wrapped
}

export function toFixed(value: number): bigint {
  if (!Number.isFinite(value)) return 0n
  return BigInt(Math.round(value * SCALE))
}

export function fromFixed(value: bigint): number {
  return Number(value) / SCALE
}

function pairMask(shared: Buffer, round: string, statKey: string): bigint {
  return createHash('sha256').update(shared).update(round, 'utf8').update(Buffer.from([0])).update(statKey, 'utf8').digest().readBigUInt64BE(0)
}

/** Sum of pairwise masks for this client. Masks cancel across the whole participant set. */
export function maskFor(secret: KeyObject, selfId: string, peers: readonly Peer[], round: string, statKey: string): bigint {
  let mask = 0n
  for (const peer of peers) {
    if (peer.id === selfId) continue
    const shared = diffieHellman({ privateKey: secret, publicKey: peer.publicKey })
    const part = pairMask(shared, round, statKey)
    mask += selfId < peer.id ? part : -part
  }
  return mask
}

export function maskValue(value: number, mask: bigint): bigint {
  return mod(toFixed(value) + mask)
}

export function sumMasked(masked: readonly bigint[]): bigint {
  return toSigned(masked.reduce((sum, value) => sum + value, 0n))
}

export function encodeShare(masked: bigint): { masked_b64: string; commitment: string } {
  const bytes = Buffer.alloc(8)
  bytes.writeBigUInt64BE(mod(masked))
  return { masked_b64: bytes.toString('base64'), commitment: sha256Hex(bytes) }
}

export function decodeShare(masked_b64: string): bigint {
  const bytes = Buffer.from(masked_b64, 'base64')
  if (bytes.length !== 8) throw new Error('share must be 8 bytes')
  return bytes.readBigUInt64BE(0)
}
