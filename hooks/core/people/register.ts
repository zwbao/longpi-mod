// M13 entry: several people on one install (the holder and family members).

import type { Context } from '../../sys/cordis.ts'
import type { CoreDeps } from '../contracts/index.ts'
import { registerPeopleRoutes } from './routes.ts'

export function register(_ctx: Context, deps: CoreDeps): void {
  registerPeopleRoutes(deps)
}
