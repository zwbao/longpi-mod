// M12 entry: deep analysis with the longevity-analyst skill (tools and routes).

import type { Context } from '../../sys/cordis.ts'
import type { CoreDeps } from '../contracts/index.ts'
import { registerAnalysisRoutes } from './routes.ts'
import { registerAnalysisTools } from './tools.ts'

export function register(ctx: Context, deps: CoreDeps): void {
  registerAnalysisTools(ctx, deps)
  registerAnalysisRoutes(deps)
}
