// M5 route: GET /api/longpi/surfaces[?refresh=1] — the set the page and the chat read now.

import type { CoreDeps } from '../contracts/index.ts'
import { buildJourneyFull } from '../journey.ts'
import { currentSurfaces, pageStateOf } from './service.ts'

export function registerSurfaceRoutes(deps: CoreDeps): void {
  deps.http.route('GET', '/api/longpi/surfaces', async (req) => {
    if (req.query.get('refresh')) deps.invalidate()
    const context = await deps.context()
    await buildJourneyFull(context)
    const row = currentSurfaces(context.dataDir)
    if (!row) return { ok: false, status: 503, error: 'not ready' }
    return { ok: true, surfaces: row.set, page: pageStateOf(row.set, row.pack), top_facts: row.pack.top_facts }
  })
}
