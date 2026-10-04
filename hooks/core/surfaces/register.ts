// M5 entry: the surfaces route (the coach and the event stream are added in step 2).

import type { Context } from '../../sys/cordis.ts'
import type { CoreDeps } from '../contracts/index.ts'
import { registerSurfaceRoutes } from './routes.ts'

export function register(_ctx: Context, deps: CoreDeps): void {
  registerSurfaceRoutes(deps)
}
