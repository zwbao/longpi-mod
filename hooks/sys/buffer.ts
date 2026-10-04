// A small Buffer for the core: utf8, hex and base64 text, concat, alloc and the little-endian writes the
// zip export uses. A Uint8Array underneath, so it passes wherever bytes are expected.

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const B64_INDEX = new Map<string, number>([...B64].map((c, i) => [c, i]))

export type BufferEncoding = 'utf8' | 'utf-8' | 'hex' | 'base64' | 'base64url' | 'latin1' | 'binary' | 'ascii'

function encodeBase64(bytes: Uint8Array, url: boolean): string {
  let out = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + B64[n & 63]!
  }
  const rest = bytes.length - i
  if (rest === 1) {
    const n = (bytes[i] ?? 0) << 16
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (url ? '' : '==')
  } else if (rest === 2) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8)
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + (url ? '' : '=')
  }
  return url ? out.replace(/\+/g, '-').replace(/\//g, '_') : out
}

function decodeBase64(text: string): Uint8Array {
  const clean = text.replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '')
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let o = 0
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_INDEX.get(clean[i] ?? 'A') ?? 0
    const b = B64_INDEX.get(clean[i + 1] ?? 'A') ?? 0
    const c = B64_INDEX.get(clean[i + 2] ?? 'A') ?? 0
    const d = B64_INDEX.get(clean[i + 3] ?? 'A') ?? 0
    const n = (a << 18) | (b << 12) | (c << 6) | d
    if (o < out.length) out[o++] = (n >> 16) & 255
    if (i + 2 < clean.length && o < out.length) out[o++] = (n >> 8) & 255
    if (i + 3 < clean.length && o < out.length) out[o++] = n & 255
  }
  return out.subarray(0, o)
}

export function toBase64(bytes: Uint8Array): string {
  return encodeBase64(bytes, false)
}

export function fromBase64(text: string): Uint8Array {
  return decodeBase64(text)
}

// @ts-ignore: Node's Buffer.from has its own overloads, as here
export class Buffer extends Uint8Array {
  static from(value: string | ArrayLike<number> | ArrayBuffer | Uint8Array, encoding: BufferEncoding = 'utf8'): Buffer {
    if (typeof value === 'string') {
      if (encoding === 'hex') {
        const out = new Buffer(Math.floor(value.length / 2))
        for (let i = 0; i < out.length; i += 1) out[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16)
        return out
      }
      if (encoding === 'base64' || encoding === 'base64url') return Buffer.fromBytes(decodeBase64(value))
      if (encoding === 'latin1' || encoding === 'binary' || encoding === 'ascii') {
        const out = new Buffer(value.length)
        for (let i = 0; i < value.length; i += 1) out[i] = value.charCodeAt(i) & 255
        return out
      }
      return Buffer.fromBytes(new TextEncoder().encode(value))
    }
    if (value instanceof ArrayBuffer) return Buffer.fromBytes(new Uint8Array(value))
    return Buffer.fromBytes(Uint8Array.from(value as ArrayLike<number>))
  }

  static fromBytes(bytes: Uint8Array): Buffer {
    const out = new Buffer(bytes.length)
    out.set(bytes)
    return out
  }

  static alloc(size: number, fill = 0): Buffer {
    const out = new Buffer(size)
    if (fill) out.fill(fill)
    return out
  }

  static concat(list: readonly Uint8Array[], total?: number): Buffer {
    const size = total ?? list.reduce((sum, part) => sum + part.length, 0)
    const out = new Buffer(size)
    let at = 0
    for (const part of list) {
      if (at >= size) break
      out.set(part.subarray(0, size - at), at)
      at += part.length
    }
    return out
  }

  static byteLength(text: string, _encoding: BufferEncoding = 'utf8'): number {
    return new TextEncoder().encode(text).length
  }

  static isBuffer(value: unknown): value is Buffer {
    return value instanceof Buffer
  }

  override toString(encoding: BufferEncoding = 'utf8'): string {
    if (encoding === 'hex') return [...this].map((b) => b.toString(16).padStart(2, '0')).join('')
    if (encoding === 'base64') return encodeBase64(this, false)
    if (encoding === 'base64url') return encodeBase64(this, true)
    if (encoding === 'latin1' || encoding === 'binary' || encoding === 'ascii') return String.fromCharCode(...this)
    return new TextDecoder().decode(this)
  }

  override subarray(begin?: number, end?: number): Buffer {
    const view = new Uint8Array(this.buffer, this.byteOffset, this.length).subarray(begin, end)
    return new Buffer(view.buffer as ArrayBuffer, view.byteOffset, view.length)
  }

  override slice(begin?: number, end?: number): Buffer {
    return this.subarray(begin, end)
  }

  equals(other: Uint8Array): boolean {
    if (other.length !== this.length) return false
    for (let i = 0; i < this.length; i += 1) if (this[i] !== other[i]) return false
    return true
  }

  writeUInt32LE(value: number, offset = 0): number {
    this[offset] = value & 255
    this[offset + 1] = (value >>> 8) & 255
    this[offset + 2] = (value >>> 16) & 255
    this[offset + 3] = (value >>> 24) & 255
    return offset + 4
  }

  writeUInt16LE(value: number, offset = 0): number {
    this[offset] = value & 255
    this[offset + 1] = (value >>> 8) & 255
    return offset + 2
  }

  writeInt32LE(value: number, offset = 0): number {
    return this.writeUInt32LE(value >>> 0, offset)
  }

  readUInt32LE(offset = 0): number {
    return ((this[offset] ?? 0) | ((this[offset + 1] ?? 0) << 8) | ((this[offset + 2] ?? 0) << 16)) + (this[offset + 3] ?? 0) * 0x1000000
  }

  readUInt16LE(offset = 0): number {
    return (this[offset] ?? 0) | ((this[offset + 1] ?? 0) << 8)
  }

  readUInt32BE(offset = 0): number {
    return ((this[offset] ?? 0) * 0x1000000) + (((this[offset + 1] ?? 0) << 16) | ((this[offset + 2] ?? 0) << 8) | (this[offset + 3] ?? 0))
  }

  readUIntBE(offset: number, byteLength: number): number {
    let out = 0
    for (let i = 0; i < byteLength; i += 1) out = out * 256 + (this[offset + i] ?? 0)
    return out
  }

  readBigUInt64BE(offset = 0): bigint {
    let out = 0n
    for (let i = 0; i < 8; i += 1) out = (out << 8n) | BigInt(this[offset + i] ?? 0)
    return out
  }

  writeBigUInt64BE(value: bigint, offset = 0): number {
    let rest = BigInt.asUintN(64, value)
    for (let i = 7; i >= 0; i -= 1) {
      this[offset + i] = Number(rest & 255n)
      rest >>= 8n
    }
    return offset + 8
  }

  copy(target: Uint8Array, targetStart = 0, sourceStart = 0, sourceEnd = this.length): number {
    const part = this.subarray(sourceStart, sourceEnd)
    target.set(part, targetStart)
    return part.length
  }
}
