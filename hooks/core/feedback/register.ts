// Module entry (AA §3.1). Tools, the feedback route, the skill, the claim rules.

import { readFileSync } from '../../sys/fs.ts'
import { dirname, join } from '../../sys/path.ts'
import { fileURLToPath, libFile } from '../../sys/url.ts'
import type { Context } from '../../sys/cordis.ts'
import type { CoreDeps } from '../contracts/index.ts'
import type { FactPack } from '../contracts/factpack.ts'
import { announcesYounger, mentionsDeathRisk } from './grade.ts'
import { registerFeedbackRoutes } from './routes.ts'
import { registerFeedbackTools } from './tools.ts'

function skillFile(): string {
  const here = dirname(libFile())
  const candidates = [
    join(here, '..', '..', 'skills', 'longpi-feedback', 'SKILL.md'),
    join(here, '..', 'skills', 'longpi-feedback', 'SKILL.md'),
  ]
  for (const path of candidates) {
    try {
      return readFileSync(path, 'utf8')
    } catch {
      // the next candidate
    }
  }
  return ''
}

function parseSkill(raw: string): { name: string; description: string; content: string } | null {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return null
  const name = match[1]?.match(/^name:\s*(.+)$/m)?.[1]?.trim()
  const description = match[1]?.match(/^description:\s*(.+)$/m)?.[1]?.trim()
  if (!name || !description) return null
  return { name, description, content: (match[2] ?? '').trim() }
}

export function register(ctx: Context, deps: CoreDeps): void {
  registerFeedbackTools(ctx, deps)
  registerFeedbackRoutes(deps)
  const raw = skillFile()
  const skill = raw ? parseSkill(raw) : null
  if (skill) {
    ctx.inject(['skills'], (scoped) => {
      scoped.skills.register({
        name: skill.name,
        description: skill.description,
        content: skill.content,
        source: 'runtime',
        invocation: { modelInvocable: true, userInvocable: false },
      })
    })
  }
  deps.validators.register({
    id: 'feedback.wording',
    owner: 'M4',
    applies: ['feedback', 'status', 'suggestion', 'next_step'],
    check(text, _card, pack) {
      if (mentionsDeathRisk(text)) return '不要写「10 年死亡风险」'
      if (/^无法判断[。！]?$/.test(text.trim())) return '不要只说无法判断'
      const allowed = (pack as FactPack).feedback?.some((row) => row.allowed_claims.includes('younger')) === true
      if (!allowed && announcesYounger(text)) return '没有达到「年轻了」的证据等级'
      return null
    },
  })
  deps.nba.register('M4', (pack) => {
    const lead = pack.feedback?.[0]
    if (!lead) return []
    return [{
      id: 'fb-open-progress',
      kind: 'read_result' as const,
      provider: 'M4' as const,
      priority: 46,
      mandatory: false,
      reason_codes: ['feedback'],
      fact_ids: [],
      target: { surface: 'page' as const, section: 'lp-feedback', prompt_zh: '我这次的变化是否为真实变化？' },
      title_zh: lead.headline_zh.slice(0, 42),
      detail_zh: '已按测量波动评估',
    }]
  })
}
