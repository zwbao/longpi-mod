import { Buffer } from '../../sys/buffer.ts'
// Manifest signature, localhost-only endpoints, genetics excluded, and the refusal to enable live (D6).

import { createHash, createPublicKey, verify as verifySig, type KeyObject } from '../../sys/crypto.ts'
import type { StudyManifest } from '../contracts/science.ts'
import { manifestBytes } from './canonical.ts'

/** Simulated builds trust only this dev key. It is not a production signing key, and live mode does not use it. */
export const SIM_KEY_ID = 'longpi-sim-dev-1'
export const SIM_PUBLIC_B64 = 'fNYMclYICOGLbWK+REJi38vibNVVCVNALviGN6Kmoy0='

const ED_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

export const LIVE_REFUSED_ZH = '这个版本不能打开 live：还没有持有签署密钥的主体、伦理委员会批件和走路研究的 ChiCTR 注册。可以在本机用模拟模式试跑，数据不出这台电脑。'

export function simPublicKey(): KeyObject {
  const raw = Buffer.from(SIM_PUBLIC_B64, 'base64')
  return createPublicKey({ key: Buffer.concat([ED_SPKI_PREFIX, raw]), format: 'der', type: 'spki' })
}

export function sha256Hex(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function isLocalAggregator(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:') return false
    if (parsed.username || parsed.password) return false
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'
  } catch {
    return false
  }
}

export function blocksLive(manifest: Pick<StudyManifest, 'ethics'>): string | null {
  if (!manifest.ethics.approval_id || !manifest.ethics.committee) return '还没有伦理委员会批件'
  if (manifest.ethics.registry.name === 'ChiCTR' && !manifest.ethics.registry.id) return '还没有 ChiCTR 注册号'
  return null
}

export type VerifyResult = { ok: true } | { ok: false; reason: string }

/** Structural and signature checks. Does not look at the person's data. */
export function verifyManifest(raw: unknown): VerifyResult {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'manifest 不是对象' }
  const manifest = raw as StudyManifest
  if (manifest.schema !== 'longpi.study/1') return { ok: false, reason: 'schema 不是 longpi.study/1' }
  if (!manifest.id || !manifest.version || !manifest.title_zh) return { ok: false, reason: '缺少 id、版本或标题' }
  if (!['n_of_1', 'observational', 'community_season'].includes(manifest.kind)) return { ok: false, reason: 'kind 不正确' }
  if (manifest.eligibility?.minors !== false) return { ok: false, reason: '研究必须写明不纳入未成年人' }
  const excluded = manifest.data?.excluded ?? []
  if (!excluded.includes('genetics')) return { ok: false, reason: '必须排除基因数据' }
  for (const input of manifest.data?.inputs ?? []) {
    if (/gene|snp|prs|基因/i.test(input.key)) return { ok: false, reason: `输入项 ${input.key} 像基因数据` }
  }
  const clip = manifest.analysis?.release?.dp?.clip
  if (!clip || !(clip[0] < clip[1])) return { ok: false, reason: '裁剪区间不正确' }
  if (!(manifest.analysis.release.dp.epsilon > 0)) return { ok: false, reason: 'epsilon 必须大于 0' }
  if (!(manifest.analysis.release.min_cohort >= 2)) return { ok: false, reason: '最少人数至少为 2' }
  if (manifest.analysis.release.aggregation !== 'secure_sum') return { ok: false, reason: '汇总方式必须是 secure_sum' }
  if (!manifest.consent?.comprehension?.length) return { ok: false, reason: '缺少理解测验' }
  if (manifest.consent.withdraw !== 'any_time') return { ok: false, reason: '必须允许随时退出' }
  if (!isLocalAggregator(manifest.endpoints?.aggregator ?? '')) return { ok: false, reason: '模拟模式的汇总地址只能是本机 http://127.0.0.1 或 localhost' }
  const signature = manifest.signature
  if (!signature || signature.alg !== 'ed25519') return { ok: false, reason: '签名算法必须是 ed25519' }
  if (signature.key_id !== SIM_KEY_ID) return { ok: false, reason: '这个构建只接受模拟用的开发签名' }
  let sig: Buffer
  try {
    sig = Buffer.from(signature.sig, 'base64')
  } catch {
    return { ok: false, reason: '签名不是 base64' }
  }
  const ok = verifySig(null, manifestBytes(manifest), simPublicKey(), sig)
  if (!ok) return { ok: false, reason: '签名对不上' }
  return { ok: true }
}
