// Wires the Codex routes, tools and the seasons skill. Called from the follow-up tools (already
// started by the plugin) and from register() once M0 calls the module.

import { readFileSync } from '../../sys/fs.ts'
import { dirname, join } from '../../sys/path.ts'
import { fileURLToPath, libFile } from '../../sys/url.ts'
import type { Context } from '../../sys/cordis.ts'
import { registerCandidates } from '../core/nba-registry.ts'
import { guardRoute, type ConnectionGuard } from '../routes.ts'
import type { Bus } from '../contracts/events.ts'
import { bindRuntime } from './engine.ts'
import { engageCandidates } from './index.ts'
import { mountEngageRoutes } from './routes.ts'
import { registerEngageTools } from './tools.ts'

export interface EngageRuntime {
  dataDir: () => string
  /** The account holder's LongPi home, where the Codex lives. */
  rootDir?: () => string
  skillsHome?: () => string
  codexOn?: () => boolean
  bus?: Bus | null
  refresh?: (force?: boolean) => Promise<void>
}

let booted = false

function packageRoot(): string {
  // The mod's own folder: libFile() is <mod>/lib/index.js, as the npm package's bundle sat in lib/.
  return dirname(dirname(libFile()))
}

function skillText(): { name: string; description: string; content: string } | null {
  try {
    const path = join(packageRoot(), 'skills', 'longpi-seasons', 'SKILL.md')
    const raw = readFileSync(path, 'utf8')
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!match) return null
    const fm = match[1] ?? ''
    const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim()
    const description = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim()
    if (!name || !description) return null
    return { name, description, content: (match[2] ?? '').trim() }
  } catch {
    return null
  }
}

export function bootEngage(ctx: Context, runtime: EngageRuntime): void {
  bindRuntime({
    dataDir: runtime.dataDir,
    ...(runtime.rootDir ? { rootDir: runtime.rootDir } : {}),
    ...(runtime.skillsHome ? { skillsHome: runtime.skillsHome } : {}),
    ...(runtime.refresh ? { refresh: runtime.refresh } : {}),
    ...(runtime.codexOn ? { codexOn: runtime.codexOn } : {}),
    ...(runtime.bus !== undefined ? { bus: runtime.bus } : {}),
  })
  if (booted) return
  if (!ctx || typeof ctx.inject !== 'function') return
  booted = true
  try { registerCandidates('M6', engageCandidates) } catch { /* registry missing in a bare host */ }
  try { registerEngageTools(ctx, runtime.dataDir) } catch { /* tools service missing */ }
  try {
    ctx.inject(['webServer'], (scoped) => {
      const lookup = scoped as { webServer?: { register: (route: { kind: 'exact'; path: string; handler: (req: unknown, res: unknown) => void }) => void }; connection?: ConnectionGuard }
      let connectionLookup: (() => unknown) | null = () => (scoped as { connection?: unknown }).connection
      try {
        ctx.inject(['connection'], (inner) => {
          connectionLookup = () => (inner as { connection?: unknown }).connection
        })
      } catch { /* the outer inject already passed connection on this host */ }
      const connection = (): ConnectionGuard | null => {
        try {
          const service = connectionLookup?.() as Partial<ConnectionGuard> | undefined
          return service && typeof service.requestRejection === 'function' ? service as ConnectionGuard : null
        } catch {
          return null
        }
      }
      const web = lookup.webServer
      if (!web || typeof web.register !== 'function') return
      mountEngageRoutes((path, handler) => {
        const guarded = guardRoute(connection, handler as Parameters<typeof guardRoute>[1]) as (req: unknown, res: unknown) => void
        web.register({ kind: 'exact', path, handler: guarded })
      }, runtime.dataDir)
    })
  } catch { /* no web server */ }
  try {
    ctx.inject(['skills'], (scoped) => {
      const skills = (scoped as { skills?: { register: (skill: { name: string; description: string; content: string; source: string; invocation: { modelInvocable: boolean; userInvocable: boolean } }) => void } }).skills
      const skill = skillText()
      if (!skills || !skill) return
      skills.register({ name: skill.name, description: skill.description, content: skill.content, source: 'runtime', invocation: { modelInvocable: true, userInvocable: false } })
    })
  } catch { /* skills service missing */ }
}
