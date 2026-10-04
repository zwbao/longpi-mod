// M12 routes: GET /api/longpi/analysis, GET /api/longpi/analysis/report, POST import / plan-accept / abandon.
// There is no start route: whether and when to run a deep analysis is the AI's decision (run_deep_analysis).

import type { CoreDeps } from '../contracts/index.ts'
import { currentReportHtml } from './store.ts'
import { abandon, acceptPlan, COST_ZH, importLatest, planReadBack, setAutoEnabled, statusNow } from './service.ts'
import { resolveRootDir } from '../paths.ts'

/** The report is written by an LLM-driven pipeline: shown in a sandboxed frame with no script and no network. */
export const REPORT_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; sandbox; frame-ancestors 'self'"

export function registerAnalysisRoutes(deps: CoreDeps): void {
  deps.http.route('GET', '/api/longpi/analysis', async () => {
    const status = await statusNow(deps)
    return { ok: true, ...status, cost_zh: COST_ZH, plan_read_back: status.current ? await planReadBack(deps) : null }
  })

  deps.http.route('GET', '/api/longpi/analysis/report', async () => {
    const html = currentReportHtml(deps.dataDir())
    if (!html) return { ok: false, status: 404, error: 'no imported analysis' }
    return { __raw: { type: 'text/html; charset=utf-8', body: html, headers: { 'Content-Security-Policy': REPORT_CSP, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } } }
  })

  deps.http.route('POST', '/api/longpi/analysis/import', async (_req, body) => {
    const value = body && typeof body === 'object' ? body as Record<string, unknown> : {}
    const res = await importLatest(deps, typeof value.run_id === 'string' ? value.run_id : null)
    return res.ok ? res : { ok: false, status: 400, error: res.error_zh, problems: res.problems }
  })

  deps.http.route('POST', '/api/longpi/analysis/plan-accept', async (_req, body) => {
    const value = body && typeof body === 'object' ? body as Record<string, unknown> : {}
    const res = await acceptPlan(deps, { run_id: value.run_id, plan_key: value.plan_key })
    return res.ok ? res : { ok: false, status: res.stale ? 409 : 400, error: res.error_zh, problems: res.problems }
  })

  // The switch: on lets the AI start a deep analysis by itself when there is new data; off (default) it only asks.
  deps.http.route('POST', '/api/longpi/analysis/settings', async (_req, body) => {
    const value = body && typeof body === 'object' ? body as Record<string, unknown> : {}
    if (typeof value.auto !== 'boolean') return { ok: false, status: 400, error: 'body must be {"auto": true|false}' }
    setAutoEnabled(resolveRootDir(deps.config().dataDir), value.auto)
    return { ok: true, auto: value.auto }
  })

  deps.http.route('POST', '/api/longpi/analysis/abandon', async (_req, body) => {
    const value = body && typeof body === 'object' ? body as Record<string, unknown> : {}
    const ok = typeof value.run_id === 'string' && abandon(deps, value.run_id)
    return ok ? { ok: true } : { ok: false, status: 404, error: '未找到该次分析。' }
  })
}
