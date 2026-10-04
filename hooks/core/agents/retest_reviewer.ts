// retest_reviewer (M4): one-shot wording over grades that are already fixed.
// The fallback is the template headline. A model reply that changes the grade,
// adds "younger", or says 10 年死亡风险 is rejected.

import { existsSync, readFileSync } from '../../sys/fs.ts'
import { dirname, join } from '../../sys/path.ts'
import { fileURLToPath, libFile } from '../../sys/url.ts'
import type { AgentProfile } from '../contracts/agents.ts'
import type { FactPack } from '../contracts/factpack.ts'
import type { FeedbackMessage } from '../contracts/feedback.ts'
import { announcesYounger, mentionsDeathRisk } from '../feedback/grade.ts'

const FALLBACK_PROMPT = '你只改写已经定好等级的反馈句，不改 grade，不新增数字。只有 allowed_claims 含 younger 才能说年轻了。不要写 10 年死亡风险。不要只说无法判断。'

function promptText(name: string): string {
  const here = dirname(libFile())
  const candidates = [
    join(here, 'prompts', name),
    join(here, '..', 'agents', 'prompts', name),
    join(here, '..', 'skills', 'longpi-feedback', name),
    join(here, '..', '..', 'skills', 'longpi-feedback', name),
  ]
  for (const path of candidates) {
    try {
      if (existsSync(path)) return readFileSync(path, 'utf8').trim()
    } catch {
      // try the next path
    }
  }
  return FALLBACK_PROMPT
}

export interface ReviewerOut {
  messages: Array<{ id: string; headline_zh: string }>
}

export function retestReviewerPrompt(): string {
  return promptText('retest_reviewer.md')
}

export function coachFeedbackPrompt(): string {
  return promptText('coach.feedback.md')
}

export const retestReviewer: AgentProfile<undefined, ReviewerOut> = {
  id: 'retest_reviewer',
  owner: 'M4',
  modes: ['one_shot'],
  prompt: ['retest_reviewer.md'],
  tools: [],
  output_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['messages'],
    properties: {
      messages: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'headline_zh'],
          properties: { id: { type: 'string' }, headline_zh: { type: 'string' } },
        },
      },
    },
  },
  route: { reasoningEffort: 'off', maxTokens: 600 },
  deadline_ms: 15000,
  input(pack: FactPack) {
    return {
      today: pack.today,
      messages: pack.feedback.map((row) => ({
        id: row.id,
        grade: row.grade,
        allowed_claims: row.allowed_claims,
        headline_zh: row.headline_zh,
        numbers: row.numbers.map((num) => ({ key: num.key, text: num.text })),
      })),
    }
  },
  validate(out: unknown, pack: FactPack) {
    const body = out as { messages?: Array<{ id?: string; headline_zh?: string }> }
    const rows = Array.isArray(body?.messages) ? body.messages : null
    if (!rows) return { ok: false, errors: ['messages missing'] }
    const byId = new Map(pack.feedback.map((row) => [row.id, row]))
    const errors: string[] = []
    const value: ReviewerOut['messages'] = []
    for (const row of rows) {
      const id = typeof row?.id === 'string' ? row.id : ''
      const headline = typeof row?.headline_zh === 'string' ? row.headline_zh.trim() : ''
      const fixed = byId.get(id)
      if (!fixed) {
        errors.push(`unknown id ${id}`)
        continue
      }
      if (!headline || /^无法判断[。！]?$/.test(headline)) errors.push(`${id} empty or bare`)
      if (mentionsDeathRisk(headline)) errors.push(`${id} death risk`)
      if (!fixed.allowed_claims.includes('younger') && announcesYounger(headline)) errors.push(`${id} younger`)
      value.push({ id, headline_zh: headline || fixed.headline_zh })
    }
    if (errors.length > 0) return { ok: false, errors }
    return { ok: true, value: { messages: value } }
  },
  fallback(pack: FactPack): ReviewerOut {
    return { messages: pack.feedback.map((row: FeedbackMessage) => ({ id: row.id, headline_zh: row.headline_zh })) }
  },
}
