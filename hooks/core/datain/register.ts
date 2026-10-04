// M7 entry: tools, routes, the narrative next-step, and the data-in skill.

import { readFileSync } from '../../sys/fs.ts'
import { dirname, join } from '../../sys/path.ts'
import { fileURLToPath, libFile } from '../../sys/url.ts'
import type { Context } from '../../sys/cordis.ts'
import type { CoreDeps } from '../contracts/index.ts'
import { registerLibraryHooks } from '../contracts/library.ts'
import { readStored } from '../stores/index.ts'
import { bindDataDir, datainCandidates } from './index.ts'
import { registerDatainRoutes } from './routes.ts'
import { registerDatainTools } from './tools.ts'

function skillText(): { name: string; description: string; content: string } | null {
  try {
    const raw = readFileSync(join(dirname(libFile()), '..', 'skills', 'longpi-data-in', 'SKILL.md'), 'utf8')
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!match) return null
    const name = match[1]?.match(/^name:\s*(.+)$/m)?.[1]?.trim()
    const description = match[1]?.match(/^description:\s*(.+)$/m)?.[1]?.trim()
    if (!name || !description) return null
    return { name, description, content: (match[2] ?? '').trim() }
  } catch {
    return null
  }
}

let hooked = false

export function register(ctx: Context, deps: CoreDeps): void {
  bindDataDir(deps.dataDir)
  registerLibraryHooks({
    readStore: (kind) => readStored(deps.dataDir(), kind),
  })
  if (!hooked) {
    deps.nba.register('M7', datainCandidates)
    hooked = true
  }
  registerDatainTools(ctx, deps)
  registerDatainRoutes(deps)
  const skill = skillText()
  if (!skill || typeof ctx.inject !== 'function') return
  ctx.inject(['skills'], (scoped) => {
    const skills = (scoped as { skills?: { register?: (row: unknown) => unknown } }).skills
    skills?.register?.({
      name: skill.name,
      description: skill.description,
      content: skill.content,
      source: 'runtime',
      invocation: { modelInvocable: true, userInvocable: false },
    })
  })
}
