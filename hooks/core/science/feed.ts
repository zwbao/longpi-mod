import { Buffer } from '../../sys/buffer.ts'
// Signed manifest feed. The plugin polls it. A feed signed by the dev key is rejected
// when the caller is not in simulated mode. Polling does not turn live on.

import type { KeyObject } from '../../sys/crypto.ts'
import { stableStringify } from './canonical.ts'
import { signBytes, signingKeyAllowed, verifyBytes } from './keyring.ts'
import { SIM_KEY_ID, simPublicKey } from './verify.ts'

export interface FeedBody {
  issued_at: string
  analysis_sha256: string
  manifests: unknown[]
}

export interface SignedFeed extends FeedBody {
  signature: { alg: 'ed25519'; key_id: string; sig: string }
}

export function signFeed(body: FeedBody, keyId: string, privateKey: KeyObject): SignedFeed {
  const sig = signBytes(privateKey, Buffer.from(stableStringify(body), 'utf8'))
  return { ...body, signature: { alg: 'ed25519', key_id: keyId, sig } }
}

export function verifyFeed(feed: SignedFeed, opts: {
  mode: 'off' | 'local' | 'simulated' | 'live'
  acceptDevKey: boolean
  publicKeys: Record<string, KeyObject>
}): { ok: true } | { ok: false; reason: string } {
  if (!feed || feed.signature?.alg !== 'ed25519' || !feed.signature.key_id || !feed.signature.sig) {
    return { ok: false, reason: 'feed 没有签名' }
  }
  const allowed = signingKeyAllowed(feed.signature.key_id, opts)
  if (!allowed.ok) return allowed
  const key = feed.signature.key_id === SIM_KEY_ID ? simPublicKey() : opts.publicKeys[feed.signature.key_id]
  if (!key) return { ok: false, reason: '没有这个 key id 的公钥' }
  const body: FeedBody = { issued_at: feed.issued_at, analysis_sha256: feed.analysis_sha256, manifests: feed.manifests }
  if (!verifyBytes(key, Buffer.from(stableStringify(body), 'utf8'), feed.signature.sig)) return { ok: false, reason: 'feed 签名对不上' }
  return { ok: true }
}

export async function pollManifestFeed(url: string, opts: {
  mode: 'off' | 'local' | 'simulated' | 'live'
  acceptDevKey: boolean
  publicKeys: Record<string, KeyObject>
  fetchImpl?: typeof fetch
}): Promise<{ ok: true; feed: SignedFeed } | { ok: false; reason: string }> {
  const fetchImpl = opts.fetchImpl ?? fetch
  let payload: unknown
  try {
    const response = await fetchImpl(url)
    if (!response.ok) return { ok: false, reason: `feed HTTP ${response.status}` }
    payload = await response.json()
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'feed 读不到' }
  }
  const feed = payload as SignedFeed
  const verified = verifyFeed(feed, opts)
  if (!verified.ok) return verified
  return { ok: true, feed }
}

/** The plugin entry. Live and off pass acceptDevKey false. Simulated mode may use the dev key. */
export async function pollReleaseManifests(url: string, opts: {
  mode: 'off' | 'local' | 'simulated' | 'live'
  publicKeys: Record<string, KeyObject>
  fetchImpl?: typeof fetch
}): Promise<{ ok: true; feed: SignedFeed } | { ok: false; reason: string }> {
  return pollManifestFeed(url, {
    mode: opts.mode,
    acceptDevKey: opts.mode === 'simulated',
    publicKeys: opts.publicKeys,
    fetchImpl: opts.fetchImpl,
  })
}
