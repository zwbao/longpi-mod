// The deterministic floor (AA §2.7): fact-ranked, not stage-ranked. With the model off or down, the first
// screen already leads with the person's most important fact and the mandatory next step.

import { FACT_PRIORITY_RANK, type FactPack } from '../contracts/factpack.ts'
import type { NextBestAction, SurfaceCard, SurfaceSet } from '../contracts/surfaces.ts'
import { verifiedMention } from '../core/method-view.ts'
import { rankActions } from './nba.ts'

export interface StageHints {
  /** The stage's own suggestions (journey.ts), in order. */
  suggestions: Array<{ id: string; text_zh: string }>
  /** The stage's status sentence, used when no fact must surface. */
  status_zh: string
}

const SOFT_TTL_MS = 30 * 60_000

export function greetingZh(now: Date = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', hour: 'numeric', hourCycle: 'h23' }).format(now))
  if (hour < 5) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 13) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

function card(id: string, kind: SurfaceCard['kind'], text: string, extra: Partial<SurfaceCard> = {}): SurfaceCard {
  return { id, kind, text_zh: text, fact_ids: [], number_keys: [], tone: 'neutral', source: 'fallback', ...extra }
}

/** Number keys whose canonical text appears in the text. */
export function numberKeysIn(text: string, pack: Pick<FactPack, 'numbers'>): string[] {
  return pack.numbers.filter((ref) => text.includes(ref.text) || text.includes(String(ref.value))).map((ref) => ref.key)
}

export function fallbackSurfaces(pack: FactPack, hints: StageHints = { suggestions: [], status_zh: '' }, now: Date = new Date()): SurfaceSet {
  const ranked = rankActions(pack.candidates, pack)
  const top = pack.top_facts[0]
  const urgent = top && FACT_PRIORITY_RANK[top.priority] <= FACT_PRIORITY_RANK.must_surface
  // A verified result is named when the model is down. It does not replace an
  // emergency, a critical pattern, or a safety fact that already leads.
  const mention = verifiedMention(pack.method_results)
  const statusText = urgent ? top.text_zh : [hints.status_zh, mention].filter(Boolean).join(' ')
  const status = urgent
    ? card('status', 'status', statusText, {
      fact_ids: [top.id],
      number_keys: numberKeysIn(statusText, pack),
      tone: top.kind === 'triage' ? 'care' : 'neutral',
      ...(mention ? { detail_zh: mention } : {}),
    })
    : card('status', 'status', statusText, mention ? { detail_zh: mention, number_keys: numberKeysIn(statusText, pack) } : {})
  const lead: NextBestAction = ranked[0] ?? {
    id: 'open-page', kind: 'read_result', provider: 'M5', priority: 0, mandatory: false, reason_codes: [], fact_ids: [], target: { surface: 'page' }, title_zh: '打开健康页看看', detail_zh: '',
  }
  const next = { action: lead, card: card('next', 'next_step', lead.title_zh, { detail_zh: lead.detail_zh, action_id: lead.id, fact_ids: lead.fact_ids, number_keys: numberKeysIn(`${lead.title_zh}${lead.detail_zh}`, pack), tone: lead.mandatory ? 'care' : 'neutral' }) }
  // The top actions' own prompts first, then the stage's suggestions; a blocked kind (draft a plan while a
  // doctor comes first) is not suggested.
  const blocked = new Set(ranked.filter((row) => row.mandatory).flatMap((row) => row.blocks ?? []))
  // Only strong actions (mandatory, or priority 60 and up) put their prompt ahead of the stage's own chips.
  const prompts = ranked.filter((row) => row.target.prompt_zh && (row.mandatory || row.priority >= 60)).slice(0, 2).map((row) => ({ id: row.id, text_zh: row.target.prompt_zh as string, action_id: row.id, fact_ids: row.fact_ids }))
  const stage = hints.suggestions
    .filter((row) => !(blocked.has('draft_plan') && (row.id === 'draft-plan' || row.id === 'save-plan')))
    .map((row) => ({ ...row, action_id: undefined as string | undefined, fact_ids: [] as string[] }))
  const seen = new Set<string>()
  const suggestions = [...prompts, ...stage].filter((row) => !seen.has(row.text_zh) && seen.add(row.text_zh)).slice(0, 4)
    .map((row) => card(row.id, 'suggestion', row.text_zh, { prompt_zh: row.text_zh, fact_ids: row.fact_ids, ...(row.action_id ? { action_id: row.action_id } : {}) }))
  return {
    version: 1,
    inputs_fp: pack.fp,
    day: pack.today,
    generated_at: now.toISOString(),
    valid_until: new Date(now.getTime() + SOFT_TTL_MS).toISOString(),
    source: 'fallback',
    stale: false,
    greeting: card('greeting', 'greeting', greetingZh(now)),
    status,
    next,
    more: ranked.slice(1),
    suggestions,
    validation: { passed: [], failed: [] },
  }
}
