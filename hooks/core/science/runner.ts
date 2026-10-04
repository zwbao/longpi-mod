import { Buffer } from '../../sys/buffer.ts'
// The local study runner. Raw series stay in this process. A release is a masked fixed-point share,
// and the transparency log line is written before that share is offered to the aggregator.

import { join } from '../../sys/path.ts'
import type { IsoTime } from '../contracts/common.ts'
import type { LocalStatResult, StudyManifest } from '../contracts/science.ts'
import { newId, readJson, writeJsonAtomic } from '../core/store.ts'
import { eligibility, latestConsent, type PersonFacts } from './consent-flow.ts'
import { tryRelease, RELEASE_STAYS_ZH } from './budget.ts'
import { addNoise, seedFor } from './dp.ts'
import { ethicsLine } from './manifest.ts'
import { isLocalAggregator, LIVE_REFUSED_ZH, verifyManifest } from './verify.ts'
import { encodeShare, fromFixed, generateMaskKey, maskFor, maskValue, publicFromRaw, rawOf, sumMasked, type Peer } from './secagg.ts'
import { markerByKey } from './series.ts'
import { computeStat, round, type Point } from './stats.ts'
import { appendLog } from './translog.ts'

export interface LocalSeries {
  markers: Record<string, Point[]>
  arms?: Record<string, number[]>
  armOrder?: string[]
}

export interface PreparedStat {
  stat: string
  key: string
  unnoisy: number
  n: number
  detail_zh: string
  noised: number
  clipped: boolean
  epsilon_spent: number
  delta: number
  mechanism: string
  noise_commitment: string
  seed_hex: string
}

export function prepareStats(manifest: StudyManifest, series: LocalSeries, epsilon: number, seedParts: readonly string[]): PreparedStat[] {
  const dp = manifest.analysis.release.dp
  const armOrder = series.armOrder ?? manifest.protocol?.arms?.map((arm) => arm.id) ?? []
  const out: PreparedStat[] = []
  for (const spec of manifest.analysis.local) {
    if (spec.stat === 'hist' || spec.stat === 'paired_t') {
      // Histogram and the t statistic stay on this machine. The share carries the clipped mean or difference.
      continue
    }
    const values = (series.markers[spec.key] ?? []).map((point) => point.value)
    const reference = markerByKey(spec.key)?.cvi_pct
    const computed = computeStat(spec.stat, spec.key, values, { arms: series.arms, armOrder, reference_cvi: reference })
    if (!computed || !Number.isFinite(computed.value)) continue
    const seed = seedFor([...seedParts, spec.stat, spec.key, String(epsilon)])
    const noised = addNoise(computed.value, { mechanism: dp.mechanism, epsilon, delta: dp.delta, clip: dp.clip, seed })
    out.push({
      stat: spec.stat,
      key: spec.key,
      unnoisy: computed.value,
      n: computed.n,
      detail_zh: computed.detail_zh,
      noised: noised.value,
      clipped: noised.clipped,
      epsilon_spent: noised.epsilon_spent,
      delta: noised.delta,
      mechanism: noised.mechanism,
      noise_commitment: noised.noise_commitment,
      seed_hex: noised.seed_hex,
    })
  }
  return out
}

export interface ShareDraft {
  client_id: string
  stat_key: string
  public_b64: string
  masked_b64: string
  commitment: string
  secret: ReturnType<typeof generateMaskKey>['secret']
  noised: number
}

/** One masked share for one statistic. `peers` includes this client. */
export function shareFor(stat: PreparedStat, clientId: string, peers: readonly Peer[], round: string, secret = generateMaskKey()): ShareDraft {
  const mask = maskFor(secret.secret, clientId, peers, round, `${stat.stat}:${stat.key}`)
  const encoded = encodeShare(maskValue(stat.noised, mask))
  return {
    client_id: clientId,
    stat_key: `${stat.stat}:${stat.key}`,
    public_b64: secret.publicRaw.toString('base64'),
    masked_b64: encoded.masked_b64,
    commitment: encoded.commitment,
    secret: secret.secret,
    noised: stat.noised,
  }
}

export function peersFromPublic(rows: readonly { id?: string; client_id?: string; public_b64: string }[]): Peer[] {
  return rows.flatMap((row) => {
    const id = row.id ?? row.client_id ?? ''
    if (!id || !row.public_b64) return []
    return [{ id, publicKey: publicFromRaw(Buffer.from(row.public_b64, 'base64')) }]
  })
}

export function recoverSum(masked_b64: readonly string[]): number {
  return fromFixed(sumMasked(masked_b64.map((row) => {
    const bytes = Buffer.from(row, 'base64')
    return bytes.readBigUInt64BE(0)
  })))
}

export type RunGate =
  | { ok: true; manifest: StudyManifest }
  | { ok: false; reason_zh: string; live_refused?: boolean }

export function gateRun(opts: {
  configured: 'off' | 'local' | 'simulated' | 'live'
  manifest: StudyManifest | null
  person: PersonFacts
  dataDir: string
}): RunGate {
  if (opts.configured === 'live') return { ok: false, reason_zh: LIVE_REFUSED_ZH, live_refused: true }
  if (opts.configured === 'off') return { ok: false, reason_zh: '研究没有打开。' }
  if (!opts.manifest) return { ok: false, reason_zh: '没有这项研究' }
  const verified = verifyManifest(opts.manifest)
  if (!verified.ok) return { ok: false, reason_zh: verified.reason }
  if (!isLocalAggregator(opts.manifest.endpoints.aggregator)) return { ok: false, reason_zh: '汇总地址不是本机' }
  const allowed = eligibility(opts.manifest, opts.person)
  if (!allowed.ok) return { ok: false, reason_zh: allowed.reason_zh }
  const consent = latestConsent(opts.dataDir, opts.manifest.id)
  if (!consent || consent.decision !== 'granted' || !consent.comprehension?.passed) {
    return { ok: false, reason_zh: '还没有通过理解测验的同意' }
  }
  return { ok: true, manifest: opts.manifest }
}

export type RunOutput =
  | {
    ok: true
    result: LocalStatResult
    local_only: PreparedStat[]
    give_back_zh: string
    share: { round: string; masked_b64: string; commitment: string; public_b64: string; stat_key: string } | null
  }
  | { ok: false; reason_zh: string }

/**
 * Compute, noise, log, and write the local result. Posting to the aggregator is the caller's job:
 * pass `round` and `peers` (everyone in the round, including this client) to build the share.
 * With no peers, the result stays local and `released` is false.
 */
export function runLocal(opts: {
  dataDir: string
  manifest: StudyManifest
  series: LocalSeries
  clientId: string
  epsilon?: number
  seedParts?: readonly string[]
  peers?: readonly Peer[]
  round?: string
  at?: IsoTime
}): RunOutput {
  const epsilon = opts.epsilon ?? opts.manifest.analysis.release.dp.epsilon
  const prepared = prepareStats(opts.manifest, opts.series, epsilon, opts.seedParts ?? [opts.clientId, opts.manifest.id])
  const at = opts.at ?? new Date().toISOString()
  const runId = newId('runsci')
  const primary = prepared[0]
  let share: { round: string; masked_b64: string; commitment: string; public_b64: string; stat_key: string } | null = null
  let budgetNote = ''
  const cohortReady = Boolean(primary && opts.peers && opts.peers.length >= opts.manifest.analysis.release.min_cohort && opts.round)
  const charged = cohortReady && primary
    ? tryRelease(opts.dataDir, { study_id: opts.manifest.id, query: `${primary.stat}:${primary.key}`, epsilon, delta: primary.delta, at, peek: true })
    : null
  if (charged && !charged.ok) budgetNote = charged.reason_zh
  if (primary && cohortReady && charged?.ok && opts.peers && opts.round) {
    const built = shareFor(primary, opts.clientId, opts.peers, opts.round)
    share = { round: opts.round, masked_b64: built.masked_b64, commitment: built.commitment, public_b64: built.public_b64, stat_key: built.stat_key }
    const logged = appendLog(opts.dataDir, 'release', `准备发布「${opts.manifest.title_zh}」的加噪合计（ε=${epsilon}，${primary.key}）。原始读数不出这台电脑。`, opts.manifest.id, at)
    const outbox = { study_id: opts.manifest.id, run_id: runId, released: false, share, at }
    writeJsonAtomic(join(opts.dataDir, 'science', 'outbox', `${runId}.json`), outbox)
    const result = resultOf(opts.manifest, prepared, runId, at, logged.seq, share, false)
    writeJsonAtomic(join(opts.dataDir, 'science', 'results', `${opts.manifest.id}.json`), { ...result, local_only: prepared.map(publicLocal) })
    return { ok: true, result, local_only: prepared, give_back_zh: giveBack(opts.manifest, prepared, null), share }
  }
  const logged = appendLog(opts.dataDir, 'run', budgetNote
    ? budgetNote
    : prepared.length > 0
    ? `已在本机完成「${opts.manifest.title_zh}」的计算（${prepared.length} 项）。人数不足或尚未进入汇总轮次，未发布。`
    : `「${opts.manifest.title_zh}」在本机尚无足够的数据序列，未发布。`, opts.manifest.id, at)
  const result = resultOf(opts.manifest, prepared, runId, at, logged.seq, null, false)
  writeJsonAtomic(join(opts.dataDir, 'science', 'results', `${opts.manifest.id}.json`), { ...result, local_only: prepared.map(publicLocal) })
  const give = giveBack(opts.manifest, prepared, null)
  return { ok: true, result, local_only: prepared, give_back_zh: budgetNote ? `${budgetNote}${give}` : give, share: null }
}

function publicLocal(row: PreparedStat) {
  return { key: row.key, stat: row.stat, unnoisy: row.unnoisy, n: row.n, detail_zh: row.detail_zh }
}

function resultOf(manifest: StudyManifest, prepared: PreparedStat[], runId: string, at: IsoTime, seq: number, share: { round: string; masked_b64: string; commitment: string } | null, released: boolean): LocalStatResult {
  const spent = prepared.reduce((sum, row) => sum + row.epsilon_spent, 0)
  return {
    id: newId('statloc'),
    study_id: manifest.id,
    manifest_version: manifest.version,
    run_id: runId,
    at,
    mode: 'simulated',
    n_local: prepared[0]?.n ?? 0,
    stats: prepared.map((row) => ({ stat: row.stat, key: row.key, value: [row.noised], clipped: row.clipped })),
    dp: {
      mechanism: manifest.analysis.release.dp.mechanism,
      epsilon_spent: spent,
      delta: manifest.analysis.release.dp.mechanism === 'gaussian' ? manifest.analysis.release.dp.delta : 0,
      noise_commitment: prepared[0]?.noise_commitment ?? '',
    },
    share: share ? { round: share.round, masked_b64: share.masked_b64, commitment: share.commitment } : null,
    released,
    translog_seq: seq,
    raw_values_left_device: false,
  }
}

export function giveBack(manifest: StudyManifest, prepared: readonly PreparedStat[], community: { n: number; mean: number; key: string } | null): string {
  const own = prepared.map((row) => row.detail_zh).join('；')
  const communityLine = community
    ? `本机汇总了 ${community.n} 人的加噪合计，平均大约 ${round(community.mean)}。噪声会让这个平均和真实平均有差别，ε 越小差别越大。`
    : `尚无达到人数要求的汇总（至少 ${manifest.analysis.release.min_cohort} 人）。你自己的数字留在这台电脑上。`
  const parts = [
    own || '本机尚无足够的重复记录，暂不计算波动。',
    communityLine,
    ethicsLine(manifest),
    '这只描述波动或两组的差别，不是诊断，也不能代替看医生。原始化验、姓名和基因都没有送出。',
    RELEASE_STAYS_ZH,
  ]
  return parts.map((text) => /[。！？]$/.test(text.trim()) ? text.trim() : `${text.trim()}。`).join('')
}

/** The aggregate has been published. Charge the budget and keep the share so withdrawal cannot pull it back. */
export function publishLocalRelease(dataDir: string, runId: string, input: { study_id: string; query: string; epsilon: number; delta?: number; at?: string }): { ok: true; statement_zh: string; spent: number } | { ok: false; reason_zh: string; statement_zh: string } {
  const path = join(dataDir, 'science', 'outbox', `${runId}.json`)
  const row = readJson<{ study_id?: string; released?: boolean; share?: unknown }>(path, (raw) => raw as { study_id?: string; released?: boolean }, () => ({}))
  if (row.study_id !== input.study_id || !row.share) return { ok: false, reason_zh: '没有这份待发布的合计', statement_zh: RELEASE_STAYS_ZH }
  const charged = tryRelease(dataDir, { study_id: input.study_id, query: input.query, epsilon: input.epsilon, delta: input.delta, at: input.at })
  if (!charged.ok) return charged
  writeJsonAtomic(path, { ...row, released: true })
  return { ok: true, statement_zh: charged.statement_zh, spent: charged.spent }
}

export { rawOf }
