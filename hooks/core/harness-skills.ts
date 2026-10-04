import { readFileSync } from '../sys/fs.ts'
import { dirname, join } from '../sys/path.ts'
import { fileURLToPath, libFile } from '../sys/url.ts'
import type { Context } from '../sys/cordis.ts'
import { HARNESS_SKILLS } from './version.ts'

function parseSkill(raw: string): { name: string; description: string; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) throw new Error('harness SKILL.md missing frontmatter')
  const fm = match[1] ?? ''
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim()
  const description = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim()
  if (!name || !description) throw new Error('harness SKILL.md missing name or description')
  return { name, description, content: (match[2] ?? '').trim() }
}

export function registerHarnessSkills(ctx: Context): void {
  ctx.inject(['skills'], (scoped) => {
    const root = join(dirname(libFile()), '..', 'skills')
    for (const dir of HARNESS_SKILLS) {
      const skill = parseSkill(readFileSync(join(root, dir, 'SKILL.md'), 'utf8'))
      scoped.skills.register({
        name: skill.name,
        description: skill.description,
        content: skill.content,
        source: 'runtime',
        invocation: { modelInvocable: true, userInvocable: false },
      })
    }
  })
}
