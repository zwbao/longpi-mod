import { Buffer } from '../../sys/buffer.ts'
// Privacy routes (AA §3.4): status, the separate consent acts, export and delete.
// ?view=page is the onboarding screen, because the host onboarding slot is owned by another module.

import type { CoreDeps } from '../contracts/index.ts'
import type { ScienceMode } from '../contracts/science.ts'
import type { ConsentRecord } from '../contracts/science.ts'
import { readProfile } from '../profile.ts'
import { CHILD_AGE, isGranted, latestConsent, minorView, recordConsent, rememberAge, type MinorView } from './consents.ts'
import { confirmedDelete, deleteLocalStore } from './delete.ts'
import { bannedClaims, deletePhrase, disclosureCopy, type DisclosureCopy } from './disclosure.ts'
import { buildExport, mirobodyExportLink } from './export.ts'
import { codexAllowed, liveBlockers } from './index.ts'

const SCOPES = ['pipl_sensitive', 'data_flow_deepseek', 'session_log_upload', 'study'] as const

export interface PrivacyRuntime {
  http: CoreDeps['http']
  dataDir: () => string
  /** Where consent is kept: the holder's store, for everyone on the install. */
  consentDir: () => string
  mode: () => ScienceMode
  mcpUrl: () => string
  emit: (scope: ConsentRecord['scope'], decision: ConsentRecord['decision']) => void
  afterChange: () => void
}

export interface PrivacyStatus {
  ok: true
  version: string
  processing_allowed: boolean
  consents: Record<string, { decision: string | null; granted: boolean; at: string | null }>
  copy: DisclosureCopy
  minor: MinorView & { codex_allowed: boolean }
  session_log: { health_workspace_default: 'off'; upload: boolean }
  export: { href: string; mirobody_url: string; mirobody_note_zh: string }
  delete: { phrase: string; note: string }
  science: { live_allowed: false; genetics_in_research: false; blockers_zh: string[] }
  wording: { law_zh: string; share_card_zh: string }
}

function fail(error: string, status = 400): { ok: false; status: number; error: string } {
  return { ok: false, status, error }
}

export function privacyStatus(runtime: PrivacyRuntime): PrivacyStatus {
  const dir = runtime.consentDir()
  const copy = disclosureCopy()
  const rules = bannedClaims()
  const profile = readProfile(dir)
  const minor = minorView(profile)
  const link = mirobodyExportLink(dir, runtime.mcpUrl())
  const consents: PrivacyStatus['consents'] = {}
  for (const scope of SCOPES) {
    const row = latestConsent(dir, scope)
    consents[scope] = { decision: row?.decision ?? null, granted: row?.decision === 'granted', at: row?.at ?? null }
  }
  return {
    ok: true,
    version: copy.version,
    processing_allowed: isGranted(dir, 'pipl_sensitive') && isGranted(dir, 'data_flow_deepseek'),
    consents,
    copy,
    minor: { ...minor, codex_allowed: codexAllowed() },
    session_log: { health_workspace_default: 'off', upload: isGranted(dir, 'session_log_upload') },
    export: { href: '/api/longpi/privacy/export', mirobody_url: link.url, mirobody_note_zh: link.note_zh },
    delete: { phrase: deletePhrase(), note: copy.delete.note },
    science: { live_allowed: false, genetics_in_research: false, blockers_zh: liveBlockers() },
    wording: { law_zh: rules.law_zh, share_card_zh: rules.share_card_zh },
  }
}

function scopeOf(value: unknown): ConsentRecord['scope'] | null {
  return typeof value === 'string' && (SCOPES as readonly string[]).includes(value) ? value as ConsentRecord['scope'] : null
}

function decisionOf(value: unknown): ConsentRecord['decision'] | null {
  return value === 'granted' || value === 'declined' || value === 'withdrawn' ? value : null
}

export function acceptConsent(runtime: PrivacyRuntime, body: unknown): PrivacyStatus | ReturnType<typeof fail> {
  if (!body || typeof body !== 'object') return fail('需要 JSON：scope 和 decision')
  const raw = body as Record<string, unknown>
  const scope = scopeOf(raw.scope)
  const decision = decisionOf(raw.decision)
  if (!scope || !decision) return fail('scope 或 decision 不正确')
  const dir = runtime.consentDir()
  if (raw.age != null && raw.age !== '') {
    const age = typeof raw.age === 'number' ? raw.age : Number(raw.age)
    if (!Number.isInteger(age) || age < 0 || age > 130) return fail('年龄须为 0 到 130 之间的整数')
    rememberAge(dir, age)
  }
  const view = minorView(readProfile(dir))
  if (scope === 'pipl_sensitive' && decision === 'granted' && view.child && raw.guardian !== true) {
    return fail(`未满 ${CHILD_AGE} 岁需要家长（监护人）在这一页同意`)
  }
  const row = recordConsent(dir, {
    scope,
    decision,
    textVersion: disclosureCopy().version,
    mode: runtime.mode(),
    guardian: raw.guardian === true,
    ...(typeof raw.session_id === 'string' ? { sessionId: raw.session_id } : {}),
  })
  try {
    runtime.emit(row.scope, row.decision)
  } catch {
    // the act is already on disk
  }
  try {
    runtime.afterChange()
  } catch {
    // preference sync is best effort
  }
  return privacyStatus(runtime)
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch))
}

function paragraphs(lines: string[]): string {
  return lines.map((line) => `<p>${esc(line)}</p>`).join('')
}

function decisionLabel(decision: string | null, grantedLabel: string): string {
  if (decision === 'granted') return grantedLabel
  if (decision === 'declined') return '已记录：暂不同意'
  if (decision === 'withdrawn') return '已撤回'
  return '尚未单独同意'
}

/** The onboarding sheet: two separate acts, then age, session log, export and delete. */
export function privacyPage(status: PrivacyStatus): string {
  const copy = status.copy
  const pipl = decisionLabel(status.consents.pipl_sensitive?.decision ?? null, '已单独同意处理健康信息')
  const flow = decisionLabel(status.consents.data_flow_deepseek?.decision ?? null, '已同意把健康对话发给 DeepSeek')
  const session = status.session_log.upload ? '已单独开启' : '关闭（默认）'
  const ageValue = status.minor.age == null ? '' : String(status.minor.age)
  const minorNote = !status.minor.known ? copy.minor.ask : status.minor.child ? copy.minor.under_14 : status.minor.minor ? copy.minor.under_18 : '已满 18 岁。长寿图鉴可以打开，也可以随时关闭。'
  const rulesLine = !status.minor.known
    ? '长寿图鉴：填写年龄前保持关闭。减肥项目待填写年龄后再判断。'
    : `长寿图鉴：${status.minor.codex_allowed ? '可以打开' : '关闭'}。减肥项目：${status.minor.weight_loss ? '可以出现在方案里' : '不安排'}。`
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>单独同意 · LongPi</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f4f5f7; color: rgb(15, 17, 21); font: 16px/1.55 ui-sans-serif, -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; }
  main { width: min(640px, calc(100% - 32px)); margin: 32px auto 48px; }
  .card { background: #fff; border-radius: 16px; padding: 28px 28px 24px; box-shadow: 0 12px 40px rgba(15, 17, 21, .08); }
  .kicker { color: rgb(97, 102, 107); font-size: 13px; letter-spacing: .04em; }
  h1 { font-size: 22px; line-height: 1.35; font-weight: 600; margin: 8px 0 0; }
  h2 { font-size: 18px; margin: 0 0 8px; font-weight: 600; }
  .step { margin-top: 28px; padding-top: 22px; border-top: 1px solid rgba(0,0,0,.08); }
  .step:first-of-type { border-top: 0; padding-top: 8px; }
  p { margin: 10px 0; color: rgb(32, 35, 40); }
  .lead { color: rgb(97, 102, 107); }
  .state { display: inline-block; margin: 4px 0 12px; padding: 4px 10px; border-radius: 999px; background: rgba(42, 120, 214, .1); color: #1d4f86; font-size: 13px; }
  .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
  button, .link { appearance: none; border: 0; border-radius: 10px; padding: 10px 16px; font: inherit; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
  .primary { background: rgb(15, 17, 21); color: #fff; }
  .quiet { background: #fff; color: rgb(15, 17, 21); box-shadow: inset 0 0 0 1px rgba(0,0,0,.14); }
  button:disabled { opacity: .55; cursor: default; }
  label { display: block; margin-top: 12px; font-size: 14px; color: rgb(97, 102, 107); }
  input[type="number"], input[type="text"] { width: 100%; margin-top: 6px; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(0,0,0,.14); font: inherit; }
  .check { display: flex; gap: 8px; align-items: flex-start; margin-top: 12px; color: rgb(15, 17, 21); font-size: 15px; }
  .check input { margin-top: 4px; }
  ul { margin: 8px 0 0; padding-left: 1.2em; }
  li { margin: 6px 0; }
  .note { font-size: 13px; color: rgb(97, 102, 107); }
  #privacy-status { min-height: 1.4em; margin: 12px 0 0; font-size: 14px; }
  details { margin-top: 22px; color: rgb(97, 102, 107); font-size: 14px; }
  @media (max-width: 560px) { .card { padding: 20px; } main { margin-top: 16px; } }
</style>
</head>
<body>
<main>
  <article class="card lp-onb" id="privacy-onboarding">
    <div class="kicker">LongPi · 第 1 步和第 2 步是两次分开的同意</div>
    <h1>处理健康信息，需要你单独同意</h1>
    <p class="lead">${esc(copy.pipl.lead)}</p>
    <section class="step" id="step-pipl" aria-labelledby="pipl-title">
      <div class="kicker">第 1 步，共 2 步</div>
      <h2 id="pipl-title">${esc(copy.pipl.title)}</h2>
      <div class="state" id="pipl-state">${esc(pipl)}</div>
      ${paragraphs(copy.pipl.paragraphs)}
      <div class="actions">
        <button class="primary" type="button" id="pipl-grant">${esc(copy.buttons.pipl_grant)}</button>
        <button class="quiet" type="button" id="pipl-decline">${esc(copy.buttons.pipl_decline)}</button>
      </div>
      <label class="check" id="guardian-row"><input type="checkbox" id="guardian"> 我是家长（监护人），同意为未满 ${CHILD_AGE} 岁的人处理这些健康信息</label>
    </section>
    <section class="step" id="step-flow" aria-labelledby="flow-title">
      <div class="kicker">第 2 步，共 2 步</div>
      <h2 id="flow-title">${esc(copy.data_flow.title)}</h2>
      <div class="state" id="flow-state">${esc(flow)}</div>
      <p><strong>会发给 DeepSeek 的</strong></p>
      <ul>${copy.data_flow.to_deepseek.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
      <p><strong>留在这台电脑的</strong></p>
      <ul>${copy.data_flow.stays_local.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
      <p><strong>体检原件保存在健康数据服务中</strong></p>
      <ul>${copy.data_flow.mirobody.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
      <p>${esc(copy.data_flow.name)}</p>
      <div class="actions">
        <button class="primary" type="button" id="flow-grant">${esc(copy.buttons.flow_grant)}</button>
        <button class="quiet" type="button" id="flow-decline">${esc(copy.buttons.flow_decline)}</button>
      </div>
    </section>
    <section class="step" id="step-age">
      <h2>年龄</h2>
      <p id="minor-note">${esc(minorNote)}</p>
      <p class="note">${esc(rulesLine)}</p>
      <label>周岁<input id="age" type="number" min="0" max="130" inputmode="numeric" value="${esc(ageValue)}"></label>
    </section>
    <section class="step" id="step-session">
      <h2>会话日志</h2>
      <p>${esc(copy.data_flow.session_log)}</p>
      <div class="state" id="session-state">会话日志：${esc(session)}</div>
      <div class="actions">
        <button class="quiet" type="button" id="session-off">${esc(copy.buttons.session_off)}</button>
        <button class="quiet" type="button" id="session-on">${esc(copy.buttons.session_on)}</button>
      </div>
    </section>
    <section class="step" id="step-data">
      <h2>导出和删除</h2>
      <p>${esc(status.export.mirobody_note_zh)}</p>
      <div class="actions">
        <a class="link primary" id="export-link" href="${esc(status.export.href)}">下载这台电脑上的 LongPi 档案</a>
      </div>
      <p class="note">${esc(copy.delete.note)}</p>
      <label>输入「${esc(copy.delete.phrase)}」再删除<input id="delete-phrase" type="text" autocomplete="off" placeholder="${esc(copy.delete.phrase)}"></label>
      <div class="actions"><button class="quiet" type="button" id="delete-go">删除这台电脑上的 LongPi 数据</button></div>
    </section>
    <p id="privacy-status" role="status"></p>
    <details>
      <summary>加入社区研究需另行单独同意。研究正式开始前，数据仅保存在这台电脑上。</summary>
      <ul>${status.science.blockers_zh.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
      <p>基因数据不进入研究。</p>
    </details>
  </article>
</main>
<script>
const status = document.getElementById('privacy-status')
function ageBody() {
  const raw = document.getElementById('age').value.trim()
  const guardian = document.getElementById('guardian').checked
  const extra = {}
  if (raw !== '') extra.age = Number(raw)
  if (guardian) extra.guardian = true
  return extra
}
async function post(body) {
  status.textContent = '正在保存…'
  const res = await fetch('/api/longpi/privacy/consent', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...ageBody(), ...body }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.ok === false) {
    status.textContent = json.error || '保存失败'
    return
  }
  status.textContent = '已保存。这是一次单独同意。'
  location.reload()
}
document.getElementById('pipl-grant').onclick = () => post({ scope: 'pipl_sensitive', decision: 'granted' })
document.getElementById('pipl-decline').onclick = () => post({ scope: 'pipl_sensitive', decision: 'declined' })
document.getElementById('flow-grant').onclick = () => post({ scope: 'data_flow_deepseek', decision: 'granted' })
document.getElementById('flow-decline').onclick = () => post({ scope: 'data_flow_deepseek', decision: 'declined' })
document.getElementById('session-on').onclick = () => post({ scope: 'session_log_upload', decision: 'granted' })
document.getElementById('session-off').onclick = () => post({ scope: 'session_log_upload', decision: 'declined' })
document.getElementById('delete-go').onclick = async () => {
  const confirmText = document.getElementById('delete-phrase').value
  status.textContent = '正在删除…'
  const res = await fetch('/api/longpi/privacy/delete', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ confirm: confirmText }),
  })
  const json = await res.json().catch(() => ({}))
  status.textContent = res.ok && json.ok ? '这台电脑上的 LongPi 档案已删除。' : (json.error || '删除失败')
}
</script>
</body>
</html>`
}

export function registerPrivacyRoutes(runtime: PrivacyRuntime): void {
  runtime.http.route('GET', '/api/longpi/privacy', async (req) => {
    const status = privacyStatus(runtime)
    if (req.query.get('view') === 'page') {
      return { __raw: { type: 'text/html; charset=utf-8', body: privacyPage(status) } }
    }
    return status
  })
  runtime.http.route('POST', '/api/longpi/privacy/consent', async (_req, body) => acceptConsent(runtime, body))
  runtime.http.route('POST', '/api/longpi/privacy/delete', async (_req, body) => {
    if (!confirmedDelete(body)) return fail(`请输入「${deletePhrase()}」以确认。本次未删除任何内容。`)
    const result = deleteLocalStore(runtime.dataDir(), runtime.mcpUrl())
    try {
      runtime.emit('pipl_sensitive', 'withdrawn')
    } catch {
      // the files are already gone
    }
    return result
  })
}

/** Bytes of the zip. Used by the raw route so the archive is not re-encoded as text. */
export function exportZip(runtime: PrivacyRuntime): { zip: Buffer; filename: string } {
  const built = buildExport(runtime.dataDir(), runtime.mcpUrl())
  return { zip: built.zip, filename: built.filename }
}
