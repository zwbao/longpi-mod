// M1 routes: GET /api/longpi/triage, GET and POST /api/longpi/brief, POST /api/longpi/care-visit.

import type { CoreDeps } from '../contracts/index.ts'
import { NO_STOP } from '../doctor-first.ts'
import { buildTracking } from '../tracking.ts'
import { careItems, careState, logCareVisit, type CareStatus } from './care.ts'
import { buildBrief, readBrief } from './brief.ts'

export function registerTriageRoutes(deps: CoreDeps): void {
  const stateNow = async () => {
    const context = await deps.context()
    const tracking = await buildTracking(context)
    return { context, care: careState(context.dataDir, tracking.doctor_first ?? NO_STOP, context.today) }
  }

  deps.http.route('GET', '/api/longpi/triage', async () => {
    const { care } = await stateNow()
    const latest = readBrief(deps.dataDir())
    return {
      findings: care.findings,
      care: careItems(deps.dataDir()),
      stop_zh: care.stop.stop ? care.stop.sentence_zh : '',
      seen: care.seen.map(({ finding, care: item }) => ({ finding_id: finding.id, visit_date: item.visit_date ?? null, outcome_zh: item.outcome_zh ?? null })),
      brief: latest ? { id: latest.brief.id, created: latest.brief.created } : null,
    }
  })

  deps.http.route('GET', '/api/longpi/brief', async (req) => {
    const id = req.query.get('id') ?? ''
    const found = readBrief(deps.dataDir(), id)
    if (!found) return { ok: false, status: 404, error: 'no brief yet' }
    if (req.query.get('format') === 'md') {
      const download = req.query.get('download') === '1'
      return { __raw: { type: 'text/markdown; charset=utf-8', body: found.markdown, headers: download ? { 'Content-Disposition': `attachment; filename="longpi-doctor-brief-${found.brief.created}.md"` } : {} } }
    }
    return { ok: true, brief: found.brief, markdown: found.markdown }
  })

  deps.http.route('POST', '/api/longpi/brief', async () => {
    const { context, care } = await stateNow()
    const made = await buildBrief({ config: context.config, dataDir: context.dataDir, records: context.records, today: context.today, care })
    if (!made) return { ok: false, status: 409, error: '记录里现在没有需要先给医生看的结果。' }
    return { ok: true, brief: made.brief, markdown: made.markdown }
  })

  deps.http.route('POST', '/api/longpi/care-visit', async (_req, body) => {
    const value = body && typeof body === 'object' ? body as Record<string, unknown> : {}
    const status = String(value.status ?? '') as CareStatus
    const { care } = await stateNow()
    const result = logCareVisit(deps.dataDir(), {
      status,
      ...(typeof value.visit_date === 'string' ? { visit_date: value.visit_date.slice(0, 10) } : {}),
      ...(typeof value.outcome_zh === 'string' && value.outcome_zh.trim() ? { outcome_zh: value.outcome_zh } : {}),
      ...(typeof value.finding_id === 'string' ? { finding_id: value.finding_id } : {}),
      via: 'page',
    }, care.findings)
    if (!result.ok) return { ok: false, status: 400, error: result.error }
    deps.invalidate()
    return { ok: true, item: result.item }
  })
}
