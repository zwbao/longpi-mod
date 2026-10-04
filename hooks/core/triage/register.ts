// M1 entry: tools and routes.

import type { Context } from '../../sys/cordis.ts'
import type { CoreDeps } from '../contracts/index.ts'
import { registerTriageRoutes } from './routes.ts'
import { registerTriageTools } from './tools.ts'

export function register(ctx: Context, deps: CoreDeps): void {
  registerTriageTools(ctx, deps)
  registerTriageRoutes(deps)
}
