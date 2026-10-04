import { Buffer } from '../../sys/buffer.ts'
// Offline root key signs key certificates. The root private key is not an argument the server stores.
// Rotation adds a new certificate. Manifests and the feed name the key id they were signed with.
// The simulated dev key is refused whenever the caller says this is not a simulated build.

import { createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from '../../sys/crypto.ts'
import { stableStringify } from './canonical.ts'
import { SIM_KEY_ID } from './verify.ts'

const ED_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

export interface KeyCertFields {
  key_id: string
  public_b64: string
  not_before: string
  not_after: string
}

export interface KeyCert extends KeyCertFields {
  root_sig: string
}

export function generateEd25519(): { publicRaw: Buffer; public_b64: string; privateKey: KeyObject } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const der = publicKey.export({ format: 'der', type: 'spki' }) as Buffer
  const publicRaw = der.subarray(der.length - 32)
  return { publicRaw, public_b64: publicRaw.toString('base64'), privateKey }
}

export function publicFromRaw(raw: Buffer): KeyObject {
  return createPublicKey({ key: Buffer.concat([ED_SPKI_PREFIX, raw]), format: 'der', type: 'spki' })
}

export function publicFromB64(b64: string): KeyObject {
  return publicFromRaw(Buffer.from(b64, 'base64'))
}

export function signBytes(privateKey: KeyObject, bytes: Buffer): string {
  return sign(null, bytes, privateKey).toString('base64')
}

export function verifyBytes(publicKey: KeyObject, bytes: Buffer, sigB64: string): boolean {
  return verify(null, bytes, publicKey, Buffer.from(sigB64, 'base64'))
}

export function signKeyCert(rootPrivate: KeyObject, fields: KeyCertFields): KeyCert {
  const root_sig = signBytes(rootPrivate, Buffer.from(stableStringify(fields), 'utf8'))
  return { ...fields, root_sig }
}

export function keyCertOk(rootPublic: KeyObject, cert: KeyCert, today: string): { ok: true } | { ok: false; reason: string } {
  const fields: KeyCertFields = {
    key_id: cert.key_id,
    public_b64: cert.public_b64,
    not_before: cert.not_before,
    not_after: cert.not_after,
  }
  if (!verifyBytes(rootPublic, Buffer.from(stableStringify(fields), 'utf8'), cert.root_sig)) {
    return { ok: false, reason: '根密钥的签名对不上' }
  }
  if (today < cert.not_before || today > cert.not_after) return { ok: false, reason: '签名密钥不在有效期内' }
  if (cert.key_id === SIM_KEY_ID) return { ok: false, reason: '开发签名不能写进正式密钥环' }
  return { ok: true }
}

/** Live never accepts the dev key. A production process with acceptDevKey false does not either. */
export function devKeyAllowed(mode: 'off' | 'local' | 'simulated' | 'live', acceptDevKey = mode === 'simulated'): boolean {
  if (mode !== 'simulated') return false
  return acceptDevKey && mode === 'simulated'
}

export function signingKeyAllowed(keyId: string, opts: { mode: 'off' | 'local' | 'simulated' | 'live'; acceptDevKey: boolean }): { ok: true } | { ok: false; reason: string } {
  if (keyId === SIM_KEY_ID && !devKeyAllowed(opts.mode, opts.acceptDevKey)) {
    return { ok: false, reason: '开发签名不能用于 live，也不能用于正式汇总' }
  }
  return { ok: true }
}
