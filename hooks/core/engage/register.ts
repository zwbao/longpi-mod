// Module entry (AA §3.1). Also started from the follow-up tools so it runs before M0 calls register().

import type { Context } from '../../sys/cordis.ts'
import type { CoreDeps } from '../contracts/index.ts'
import { resolveDataDir, resolveRootDir, resolveSkillsHome } from '../paths.ts'
import { bootEngage } from './boot.ts'
import { refreshCodex } from './engine.ts'

export function register(ctx: Context, deps: CoreDeps): void {
  bootEngage(ctx, {
    dataDir: () => resolveDataDir(deps.config().dataDir),
    rootDir: () => resolveRootDir(deps.config().dataDir),
    skillsHome: () => resolveSkillsHome(deps.config().skillsHome),
    refresh: async () => {
      const context = await deps.context()
      await refreshCodex({ config: context.config, dataDir: context.dataDir, present: context.records.indicators.map((row) => row.name) })
    },
    codexOn: () => deps.config().engage?.codex !== false,
    bus: deps.bus,
  })
}
