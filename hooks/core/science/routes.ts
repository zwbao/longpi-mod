// Science HTTP routes. Writes need confirm: true. ?view=page is the research screen until the client tab is wired.

import { join } from '../../sys/path.ts'
import type { CoreDeps } from '../contracts/index.ts'
import type { DrugClass } from '../contracts/memory.ts'
import { newId, readJson, writeJsonAtomic } from '../core/store.ts'
import { isoDay } from '../interventions.ts'
import { estimatedAge, readProfile } from '../profile.ts'
import { buildCommunity, castVote, rememberCard, writePulse } from './community.ts'
import { eligibility, grantConsent, withdrawConsent, type PersonFacts } from './consent-flow.ts'
import { declineInvite, inviteVisible, mayTransmit, readSciencePref, writeSciencePref, OUTBOX_WAITING_ZH } from './choice.ts'
import { configuredMode, effectiveMode, scienceOpen } from './index.ts'
import { loadStudies, loadStudy } from './manifest.ts'
import { armsFromOutcomes, logOutcome, readOutcomes } from './outcomes.ts'
import { communityHtml, offHtml } from './page-html.ts'
import { claimFromRelease, claimProblems, writeClaimsExport } from './claims-export.ts'
import { designNOf1, publicNOf1, seasonIdOnDisk, storeNOf1 } from './nof1.ts'
import { buildRegistry, registryHtml, transparencyExport } from './registry-page.ts'
import { gateRun, runLocal, type LocalSeries } from './runner.ts'
import { appendLog, readLog, verifyChain } from './translog.ts'
import { LIVE_REFUSED_ZH } from './verify.ts'

function personOf(dataDir: string, memory: CoreDeps['memory']): PersonFacts {
  const saved = readProfile(dataDir)
  const flags = memory.safetyFlags()
  return {
    age: saved.age ?? estimatedAge(saved.birthYear, new Date().getFullYear()),
    sex: saved.sex,
    conditions: flags.conditions,
    drug_classes: flags.drug_classes.filter((row): row is DrugClass => row !== 'other'),
  }
}

function answersOf(body: Record<string, unknown>): Array<{ id: string; choice: number }> {
  if (!Array.isArray(body.answers)) return []
  return body.answers.flatMap((row) => {
    const item = row as { id?: unknown; choice?: unknown }
    return typeof item.id === 'string' && typeof item.choice === 'number' ? [{ id: item.id, choice: item.choice }] : []
  })
}

function seriesFromDisk(dataDir: string, studyId: string): LocalSeries {
  const outcomes = readOutcomes(dataDir).filter((row) => row.study_id == null || row.study_id === studyId)
  const markers: LocalSeries['markers'] = {}
  for (const row of outcomes) {
    if (!row.marker || row.value == null) continue
    const list = markers[row.marker] ?? []
    list.push({ day: row.day, value: row.value })
    markers[row.marker] = list
  }
  return { markers, arms: armsFromOutcomes(outcomes), armOrder: ['morning', 'after_dinner'] }
}

function noteLiveOnce(dataDir: string): void {
  if (configuredMode() !== 'live') return
  if (readLog(dataDir).some((row) => row.kind === 'mode_changed')) return
  appendLog(dataDir, 'mode_changed', LIVE_REFUSED_ZH)
}

export function registerScienceRoutes(deps: CoreDeps): void {
  const dir = () => deps.dataDir()

  deps.http.route('GET', '/api/longpi/science/studies', async (req) => {
    const configured = configuredMode()
    if (!scienceOpen()) {
      const reason = configured === 'live' ? LIVE_REFUSED_ZH : '研究没有打开。'
      if (configured === 'live') noteLiveOnce(dir())
      if (req.query.get('view') === 'page') return { __raw: { type: 'text/html; charset=utf-8', body: offHtml(reason) } }
      return { ok: true, mode: 'off', configured, live_refused: configured === 'live', reason_zh: reason, studies: [] }
    }
    const studies = loadStudies().map((row) => ({
      id: row.manifest.id,
      title_zh: row.manifest.title_zh,
      summary_zh: row.manifest.summary_zh,
      kind: row.manifest.kind,
      verified: row.verify.ok,
      consent_text_ok: row.consent_hash_ok,
      reason: row.verify.ok ? '' : ('reason' in row.verify ? row.verify.reason : ''),
    }))
    return { ok: true, mode: effectiveMode(), studies, page: '/api/longpi/science/community?view=page', waiting_zh: OUTBOX_WAITING_ZH }
  })

  deps.http.route('GET', '/api/longpi/science/community', async (req) => {
    if (configuredMode() === 'live') noteLiveOnce(dir())
    const view = buildCommunity({ dataDir: dir(), configured: configuredMode() })
    if (req.query.get('view') === 'page') return { __raw: { type: 'text/html; charset=utf-8', body: communityHtml(view) } }
    return { ok: true, ...view }
  })

  deps.http.route('POST', '/api/longpi/science/community', async (_req, body) => {
    if (!scienceOpen()) return { ok: false, status: 403, error: configuredMode() === 'live' ? LIVE_REFUSED_ZH : '研究没有打开' }
    const topic = typeof (body as { topic_id?: unknown })?.topic_id === 'string' ? (body as { topic_id: string }).topic_id : ''
    const cast = castVote(dir(), topic)
    if (!cast.ok) return { ok: false, status: 400, error: cast.reason_zh }
    return { ok: true, voting: buildCommunity({ dataDir: dir(), configured: 'simulated' }).voting }
  })

  deps.http.route('POST', '/api/longpi/science/consent', async (_req, body) => {
    if (!scienceOpen()) return { ok: false, status: 403, error: configuredMode() === 'live' ? LIVE_REFUSED_ZH : '研究没有打开' }
    const record = (body ?? {}) as Record<string, unknown>
    const study = loadStudy(typeof record.study_id === 'string' ? record.study_id : '')
    if (!study || !study.verify.ok || !study.consent_hash_ok) {
      return { ok: false, status: 400, error: study && !study.verify.ok ? study.verify.reason : '研究说明不可用' }
    }
    if (record.bundled_with_product === true) return { ok: false, status: 400, error: '参加研究不能与开始使用捆绑。' }
    const fit = eligibility(study.manifest, personOf(dir(), deps.memory))
    if (!fit.ok) return { ok: false, status: 403, error: fit.reason_zh }
    const manifest = record.plain === true
      ? { ...study.manifest, consent: { ...study.manifest.consent, comprehension: study.manifest.consent.comprehension.slice(0, 2) } }
      : study.manifest
    const granted = grantConsent({
      dataDir: dir(),
      manifest,
      manifest_sha256: study.sha256,
      answers: answersOf(record),
      confirm: record.confirm === true,
      explained_by: record.explained_by === 'agent' ? 'agent' : 'page',
      mode: effectiveMode() === 'local' ? 'local' : 'simulated',
    })
    if (!granted.ok) return { ok: false, status: 400, error: granted.reason_zh, comprehension: granted.comprehension }
    deps.bus.emit('study.consented', { study_id: study.manifest.id, consent_id: granted.consent.id }, { module: 'M8', via: 'route' })
    deps.invalidate()
    return { ok: true, consent_id: granted.consent.id, comprehension: granted.consent.comprehension }
  })

  deps.http.route('POST', '/api/longpi/science/withdraw', async (_req, body) => {
    if (!scienceOpen()) return { ok: false, status: 403, error: '研究没有打开' }
    const record = (body ?? {}) as { study_id?: string; confirm?: boolean }
    if (record.confirm !== true) return { ok: false, status: 400, error: '退出需要 confirm: true' }
    const study = loadStudy(record.study_id ?? '')
    if (!study) return { ok: false, status: 404, error: '没有这项研究' }
    const done = withdrawConsent(dir(), study.manifest)
    if (!done.ok) return { ok: false, status: 400, error: done.reason_zh }
    deps.bus.emit('study.withdrawn', { study_id: study.manifest.id, consent_id: done.consent.id }, { module: 'M8', via: 'route' })
    deps.invalidate()
    return { ok: true, deleted_unreleased: done.deleted, released_stays: done.released_stays, statement_zh: done.statement_zh }
  })

  deps.http.route('POST', '/api/longpi/science/run', async (_req, body) => {
    if (!scienceOpen()) return { ok: false, status: 403, error: configuredMode() === 'live' ? LIVE_REFUSED_ZH : '研究没有打开' }
    const record = (body ?? {}) as { study_id?: string; confirm?: boolean; note_zh?: string }
    if (record.confirm !== true) return { ok: false, status: 400, error: '计算需要 confirm: true' }
    const study = loadStudy(record.study_id ?? '')
    if (!study || !study.verify.ok) return { ok: false, status: 400, error: '研究不可用' }
    if (typeof record.note_zh === 'string' && record.note_zh.trim()) {
      logOutcome(dir(), record.note_zh, isoDay(), study.manifest.id, newId('outcme'), new Date().toISOString())
    }
    const gate = gateRun({ configured: effectiveMode() === 'local' ? 'local' : 'simulated', manifest: study.manifest, person: personOf(dir(), deps.memory), dataDir: dir() })
    if (!gate.ok) return { ok: false, status: 403, error: gate.reason_zh }
    const ran = runLocal({ dataDir: dir(), manifest: study.manifest, series: seriesFromDisk(dir(), study.manifest.id), clientId: 'local' })
    if (!ran.ok) return { ok: false, status: 400, error: ran.reason_zh }
    rememberCard(dir(), study.manifest.title_zh, ran.give_back_zh.slice(0, 180), study.manifest.id)
    writePulse(dir(), { headline_zh: '本机结果', detail_zh: ran.give_back_zh })
    deps.bus.emit('study.run_completed', { study_id: study.manifest.id, run_id: ran.result.run_id, released: ran.result.released }, { module: 'M8', via: 'route' })
    const transmit = mayTransmit({ published: false, keyId: null })
    return {
      ok: true,
      result: ran.result,
      give_back_zh: ran.give_back_zh,
      sent: transmit.ok,
      waiting_zh: transmit.ok ? '' : transmit.reason_zh,
      local: ran.local_only.map(({ key, stat, unnoisy, n, detail_zh }) => ({ key, stat, unnoisy, n, detail_zh })),
    }
  })

  deps.http.route('GET', '/api/longpi/science/translog', async () => {
    if (!scienceOpen()) return { ok: true, mode: 'off', entries: [] }
    const entries = readLog(dir())
    return { ok: true, chain: verifyChain(entries), entries }
  })

  deps.http.route('GET', '/api/longpi/science/transparency', async (req) => {
    const entries = scienceOpen() ? readLog(dir()) : []
    const text = transparencyExport(entries)
    if (req.query.get('download') === '1') return { __raw: { type: 'application/x-ndjson; charset=utf-8', body: text } }
    return { ok: true, chain: verifyChain(entries), export_zh: '透明记录可以导出。里面没有化验数值。', text }
  })

  deps.http.route('GET', '/api/longpi/science/registry', async (req) => {
    const configured = configuredMode()
    const mode = configured === 'simulated' ? 'simulated' : configured === 'local' ? 'local' : configured === 'live' ? 'live' : 'off'
    const cohort = mode === 'simulated'
      ? readJson<{ studies?: Record<string, { enrolled?: number }> }>(join(dir(), 'science', 'cohort.json'), (raw) => raw as { studies?: Record<string, { enrolled?: number }> }, () => ({}))
      : {}
    const enrolled = Object.fromEntries(Object.entries(cohort.studies ?? {}).map(([id, row]) => [id, row.enrolled ?? 0]))
    const view = buildRegistry({ mode, enrolled })
    if (req.query.get('view') === 'page') return { __raw: { type: 'text/html; charset=utf-8', body: registryHtml(view) } }
    return { ok: true, ...view }
  })

  deps.http.route('POST', '/api/longpi/science/n-of-1', async (_req, body) => {
    if (!scienceOpen()) return { ok: false, status: 403, error: configuredMode() === 'live' ? LIVE_REFUSED_ZH : '研究没有打开' }
    const record = (body ?? {}) as { confirm?: boolean; design?: string }
    if (record.confirm !== true) return { ok: false, status: 400, error: '个人对照需要 confirm: true' }
    const seasonId = seasonIdOnDisk(dir())
    const designed = designNOf1({
      today: isoDay(),
      design: record.design === 'crossover' ? 'crossover' : 'abab',
      season_id: seasonId,
    })
    const stored = storeNOf1(dir(), designed)
    if (stored.completed) {
      deps.bus.emit('study.n_of_1_completed', { study_id: 'n-of-1', season_id: seasonId }, { module: 'M8', via: 'route' })
    }
    return { ok: true, ...publicNOf1(designed) }
  })

  deps.http.route('POST', '/api/longpi/science/export', async (_req, body) => {
    if (effectiveMode() !== 'simulated') return { ok: false, status: 403, error: '研究没有打开' }
    const record = (body ?? {}) as Record<string, unknown>
    if (record.confirm !== true) return { ok: false, status: 400, error: '导出需要 confirm: true' }
    if (typeof record.study_id !== 'string' || typeof record.marker !== 'string') return { ok: false, status: 400, error: '缺少研究或指标' }
    const estimate = typeof record.estimate === 'number' ? record.estimate : Number.NaN
    const n = typeof record.n === 'number' ? record.n : Number.NaN
    const epsilon = typeof record.epsilon === 'number' ? record.epsilon : Number.NaN
    if (!Number.isFinite(estimate) || !Number.isFinite(n) || !Number.isFinite(epsilon)) return { ok: false, status: 400, error: '估计、人数和 ε 要是数字' }
    const claim = claimFromRelease({
      study_id: record.study_id,
      marker: record.marker,
      marker_zh: typeof record.marker_zh === 'string' ? record.marker_zh : record.marker,
      estimate,
      n,
      epsilon,
      unit: typeof record.unit === 'string' ? record.unit : '',
    })
    const problems = claimProblems(claim)
    if (problems.length > 0) return { ok: false, status: 400, error: problems.join(',') }
    const written = writeClaimsExport(dir(), [claim])
    return { ok: true, submitted: written.submitted, rows: written.rows }
  })

  deps.http.route('GET', '/api/longpi/science/invite', async () => {
    const mode = effectiveMode()
    const show = inviteVisible({ dataDir: dir(), mode: effectiveMode() === 'off' ? 'off' : effectiveMode() })
    const pref = readSciencePref(dir())
    return {
      ok: true,
      show,
      mode,
      intro_zh: 'LongPi 的用户在一起研究怎样延缓衰老。你可以用自己的数据做个人小试验，也可以加入大家的研究。',
      waiting_zh: OUTBOX_WAITING_ZH,
      prechecked: false,
      bundled_with_product: false,
      user_set: pref?.user_set === true,
      preference: pref?.mode ?? mode,
    }
  })

  deps.http.route('POST', '/api/longpi/science/invite', async (_req, body) => {
    const record = (body ?? {}) as { decision?: string }
    if (record.decision === 'later') {
      declineInvite(dir())
      return { ok: true, show: false }
    }
    if (record.decision === 'join') {
      return { ok: true, show: false, next: 'questions' }
    }
    return { ok: false, status: 400, error: '请选择加入或以后再说。' }
  })

  deps.http.route('POST', '/api/longpi/science/preference', async (_req, body) => {
    const record = (body ?? {}) as { mode?: string }
    const mode = record.mode === 'off' || record.mode === 'local' || record.mode === 'simulated' ? record.mode : null
    if (!mode) return { ok: false, status: 400, error: '只能选择打开或关闭。' }
    const saved = writeSciencePref(dir(), mode)
    return { ok: true, preference: saved }
  })
}
