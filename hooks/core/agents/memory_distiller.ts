// The memory distiller (M0, AA §4.3 PR 2a): after a health turn whose words hint at something worth keeping
// (a rule prefilter), a one-shot call proposes memory items. Only items whose quote is really in the
// person's message, about themselves, of an allowed kind, are kept — unconfirmed, so they can only add
// caution until confirmed; the next snapshot says 「我记下了：…（说"撤销"即可取消）」.

import type { AgentProfile } from '../contracts/agents.ts'
import type { FactPack } from '../contracts/factpack.ts'
import type { MemoryOp } from '../contracts/memory.ts'
import { itemFrom } from '../core/memory-tools.ts'
import { quoteIn } from '../core/turn-text.ts'
import { DISTILLER_PROMPT } from './prompts/memory_distiller.ts'

export const DISTILL_PREFILTER = /不要|别再|别给|不想|目标|出差|旅行|旅游|生病|感冒|发烧|医生说|医生让|开了|换药|在吃|吃了|停了|停药|怀孕|备孕|确诊|诊断|手术|喝酒|不喝|戒酒|过敏|我妈|我爸|母亲|父亲|家里人|减到|瘦到|体重.{0,4}(?:斤|公斤|kg)/i

export interface DistillExtra { message: string; session_id: string; today: string }

const TAKING = /在吃|在用|吃着|用着|正在服|服用|每天吃|每天一|每日|一天[一两三1-3]次|开了|停了|停药|不吃了|吃了\s*\d/
const KINDS = ['goal', 'exclusion', 'condition', 'medication', 'supplement', 'family_history', 'life_event', 'preference', 'note']

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export const DISTILL_SCHEMA = {
  type: 'object' as const,
  properties: {
    ops: {
      type: 'array', maxItems: 6,
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: KINDS }, text_zh: { type: 'string' }, quote_zh: { type: 'string' }, subject: { type: 'string', enum: ['self', 'other'] },
          name: { type: 'string' }, regimen: { type: 'string' }, phrases: { type: 'array', items: { type: 'string' } },
          event: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, state: { type: 'string' }, stopped: { type: 'boolean' },
        },
        required: ['kind', 'text_zh', 'quote_zh', 'subject'],
      },
    },
  },
  required: ['ops'],
}

export function validateDistilled(out: unknown, _pack: FactPack, extra: DistillExtra): { ok: true; value: MemoryOp[] } | { ok: false; errors: string[] } {
  const raw = obj(out)
  if (!Array.isArray(raw.ops)) return { ok: false, errors: ['ops must be an array'] }
  const ops: MemoryOp[] = []
  for (const value of raw.ops.slice(0, 6)) {
    const row = obj(value)
    const quote = typeof row.quote_zh === 'string' ? row.quote_zh.trim() : ''
    // Dropped, never repaired: not their words, about someone else, or a kind we do not keep.
    if (!quote || !quoteIn(quote, extra.message) || row.subject !== 'self' || !KINDS.includes(String(row.kind))) continue
    // A medicine or supplement is kept only when their words say they take (or stopped) it — a question or a
    // wish ("NMN 吃多少合适？我想开始吃") is not a medicine they are on.
    if ((row.kind === 'medication' || row.kind === 'supplement') && (!TAKING.test(quote) || /想|打算|能不能|可以吗|吗[？?]?$|多少合适/.test(quote))) continue
    const item = itemFrom({ ...row, text: row.text_zh }, { kind: 'model_extracted', at: new Date().toISOString(), session_id: extra.session_id, quote_zh: quote, by: 'M0' }, false, extra.today)
    if (item) ops.push({ op: 'add', item })
  }
  return { ok: true, value: ops }
}

export const distillerProfile: AgentProfile<DistillExtra, MemoryOp[]> = {
  id: 'memory_distiller',
  owner: 'M0',
  modes: ['one_shot'],
  prompt: [DISTILLER_PROMPT],
  tools: [],
  output_schema: DISTILL_SCHEMA,
  route: { reasoningEffort: 'off', maxTokens: 400 },
  deadline_ms: 10_000,
  input: (pack, extra) => ({ message: extra.message, memory_digest: pack.memory_digest_zh, today: extra.today }),
  validate: validateDistilled,
  fallback: () => [],
}
