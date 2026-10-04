// Module entry (AA §3.1): src/modules.ts calls register(ctx, deps) once at plugin start. C0 stub.

import type { Context } from '../../sys/cordis.ts'
import type { CoreDeps } from '../contracts/index.ts'

export function register(_ctx: Context, _deps: CoreDeps): void {
  // no behaviour yet
}
