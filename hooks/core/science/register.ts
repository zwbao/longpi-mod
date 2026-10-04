// Module entry. Routes always answer (off and live explain themselves). Tools and the skill run only in simulated mode.

import { existsSync, readFileSync } from '../../sys/fs.ts'
import { dirname, join } from '../../sys/path.ts'
import { fileURLToPath, libFile } from '../../sys/url.ts'
import type { Context } from '../../sys/cordis.ts'
import type { CoreDeps } from '../contracts/index.ts'
import { activeStudyIds } from './consent-flow.ts'
import { scienceCandidates } from './community.ts'
import { resolveRunningMode } from './choice.ts'
import { effectiveMode, scienceOpen, startScience } from './index.ts'
import { registerScienceRoutes } from './routes.ts'
import { registerScienceTools } from './tools.ts'

function skillFile(): string | null {
  const here = dirname(libFile())
  const candidates = [join(here, '../../skills/longpi-science/SKILL.md'), join(here, '../skills/longpi-science/SKILL.md')]
  return candidates.find((path) => existsSync(path)) ?? null
}

export function register(ctx: Context, deps: CoreDeps): void {
  startScience({
    configured: () => resolveRunningMode(deps.config().scienceMode, deps.config().scienceModeSet === true, deps.dataDir()),
    dataDir: () => deps.dataDir(),
  })
  registerScienceRoutes(deps)
  if (!scienceOpen()) return
  const mode = effectiveMode()
  deps.nba.register('M8', () => scienceCandidates(mode === 'simulated' ? 'simulated' : 'local', activeStudyIds(deps.dataDir()).length))
  registerScienceTools(ctx, deps)
  ctx.on('tools/pre-execute', async (exec, next) => {
    const decision = await next()
    if (!decision || decision.kind !== 'allow') return decision
    if (exec.name !== 'record_study_consent') return decision
    return { kind: 'ask', reason: '记录参加这项研究的同意。原始化验、姓名和基因不会离开这台电脑。请确认已阅读说明，且理解测验由本人作答。' }
  })
  const path = skillFile()
  if (!path) return
  ctx.inject(['skills'], (scoped) => {
    const raw = readFileSync(path, 'utf8')
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!match) return
    const name = match[1]?.match(/^name:\s*(.+)$/m)?.[1]?.trim()
    const description = match[1]?.match(/^description:\s*(.+)$/m)?.[1]?.trim()
    if (!name || !description) return
    scoped.skills.register({ name, description, content: (match[2] ?? '').trim(), source: 'runtime', invocation: { modelInvocable: true, userInvocable: false } })
  })
}
