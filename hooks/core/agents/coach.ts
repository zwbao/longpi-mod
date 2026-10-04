// The coach profile (M5, AA §2.3): one-shot, writes the greeting, status, next-step wording and 2–4
// suggestions for one person from the fact pack. It only chooses and phrases; the post-filter holds it to
// the pack's facts, numbers, the mandatory action, exclusions and safety flags.

import type { AgentProfile } from '../contracts/agents.ts'
import { FACT_PRIORITY_RANK, type FactPack } from '../contracts/factpack.ts'
import type { SurfaceCard, SurfaceSet } from '../contracts/surfaces.ts'
import { runValidators } from '../core/validate.ts'
import { rankActions } from '../surfaces/nba.ts'
import { numberKeysIn } from '../surfaces/fallback.ts'
import { COACH_PROMPT } from './prompts/coach.ts'

export interface CoachExtra {
  /** The deterministic floor for this pack; failing cards fall back to it. */
  floor: SurfaceSet
  /** Suggestions shown in the last 3 days (surfaces_log). */
  lastShown: string[]
  now: Date
}

export interface CoachDraft {
  greeting: SurfaceCard
  status: SurfaceCard
  next: SurfaceSet['next']
  suggestions: SurfaceCard[]
  failed: Array<{ rule: string; card_id: string; detail: string }>
  passed: string[]
}

const WEEKDAY = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((row): row is string => typeof row === 'string') : []
}
function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export const COACH_SCHEMA = {
  type: 'object' as const,
  properties: {
    greeting: { type: 'object', properties: { text_zh: { type: 'string' } }, required: ['text_zh'] },
    status: { type: 'object', properties: { text_zh: { type: 'string' }, fact_ids: { type: 'array', items: { type: 'string' } }, tone: { type: 'string', enum: ['neutral', 'encourage', 'celebrate', 'care'] } }, required: ['text_zh', 'fact_ids'] },
    next: { type: 'object', properties: { action_id: { type: 'string' }, text_zh: { type: 'string' }, detail_zh: { type: 'string' } }, required: ['action_id', 'text_zh'] },
    suggestions: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'object', properties: { action_id: { type: 'string' }, text_zh: { type: 'string' }, prompt_zh: { type: 'string' }, fact_ids: { type: 'array', items: { type: 'string' } } }, required: ['prompt_zh'] } },
  },
  required: ['greeting', 'status', 'next', 'suggestions'],
  additionalProperties: false,
}

function timeOfDay(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', hour: 'numeric', hourCycle: 'h23' }).format(now))
  return hour < 5 ? '深夜' : hour < 11 ? '早上' : hour < 13 ? '中午' : hour < 18 ? '下午' : '晚上'
}

/** The slice the coach sees: no display name (D10), no raw record. */
export function coachInput(pack: FactPack, extra: CoachExtra): unknown {
  const ranked = rankActions(pack.candidates, pack).slice(0, 6)
  return {
    today: pack.today,
    weekday: WEEKDAY[new Date(`${pack.today}T12:00:00Z`).getUTCDay()],
    time_of_day: timeOfDay(extra.now),
    person: { age: pack.person.age, sex: pack.person.sex },
    stage: pack.stage,
    top_facts: pack.top_facts.slice(0, 5).map(({ id, kind, priority, text_zh }) => ({ id, kind, priority, text_zh })),
    candidates: ranked.map((row) => ({ id: row.id, kind: row.kind, mandatory: row.mandatory, title_zh: row.title_zh, detail_zh: row.detail_zh.slice(0, 200), prompt_zh: row.target.prompt_zh ?? '' })),
    feedback: pack.feedback.map((row) => ({ id: row.id, headline_zh: row.headline_zh, grade: row.grade, allowed_claims: row.allowed_claims })),
    plan: { ...pack.plan, adherence_pct: null },
    memory_digest: pack.memory_digest_zh,
    asked_recent: pack.asked_recent,
    last_shown_suggestions: extra.lastShown.slice(0, 12),
    numbers: pack.numbers.filter((row) => !/adherence|执行率/.test(row.key)).slice(0, 40).map((row) => ({ key: row.key, label: row.label_zh, text: row.text, date: row.date })),
  }
}

/** Progress wording needs an M4 grade. An adherence percent is not that grade. */
function ungradedClaim(text: string, pack: FactPack): string | null {
  if (/执行率/.test(text)) {
    const backed = pack.feedback.some((row) => row.grade === 'behaviour_done')
    if (!backed) return '执行率 is not a graded result'
  }
  if (/稳住|有效果|改善了/.test(text)) {
    const backed = pack.feedback.some((row) => row.allowed_claims.some((claim) => claim === 'improved' || claim === 'celebrate' || claim === 'progress_story'))
    if (!backed) return 'progress claim without a graded feedback row'
  }
  return null
}

function card(kind: SurfaceCard['kind'], id: string, text: string, pack: FactPack, extra: Partial<SurfaceCard> = {}): SurfaceCard {
  return { id, kind, text_zh: text, fact_ids: [], number_keys: numberKeysIn(text, pack), tone: 'neutral', source: 'model', ...extra }
}

/** The label a status must name for the top fact (血红蛋白, 达格列净 …): the first word of its text. */
export function anchorOf(text: string): string {
  const head = (text.split(/[ ，,：:（(—]/)[0] ?? '').replace(/^(?:你在用|你说过|你在|你有|家里有人得过|按你的年龄)/, '')
  return [...head].slice(0, 4).join('')
}

export function validateCoach(out: unknown, pack: FactPack, extra: CoachExtra): { ok: true; value: CoachDraft } | { ok: false; errors: string[] } {
  const raw = obj(out)
  const errors: string[] = []
  const failed: CoachDraft['failed'] = []
  const passed: string[] = []
  const ranked = rankActions(pack.candidates, pack)
  const floor = extra.floor
  const top = pack.top_facts[0]
  const urgent = top && FACT_PRIORITY_RANK[top.priority] <= FACT_PRIORITY_RANK.must_surface
  const check = (kind: Parameters<typeof runValidators>[0], c: SurfaceCard, text = c.text_zh) => {
    const bad = runValidators(kind, text, { fact_ids: c.fact_ids, number_keys: c.number_keys }, pack)
    for (const row of bad) failed.push({ ...row, card_id: c.id })
    if (bad.length === 0) passed.push(c.id)
    return bad.length === 0
  }

  // greeting: no numbers, no name
  const gText = str(obj(raw.greeting).text_zh)
  let greeting = card('greeting', 'greeting', gText, pack)
  if (!gText || /\d/.test(gText) || !check('greeting', greeting)) {
    if (gText && /\d/.test(gText)) failed.push({ rule: 'greeting.no_numbers', card_id: 'greeting', detail: 'a number in the greeting' })
    greeting = { ...floor.greeting, override: { rule: 'fallback', reason: 'greeting failed' } }
  }

  // status: must carry the top fact when one must surface
  const sRaw = obj(raw.status)
  const sText = str(sRaw.text_zh)
  let status = card('status', 'status', sText, pack, { fact_ids: strings(sRaw.fact_ids).filter((id) => pack.top_facts.some((row) => row.id === id)), tone: (['neutral', 'encourage', 'celebrate', 'care'].includes(str(sRaw.tone)) ? str(sRaw.tone) : 'neutral') as SurfaceCard['tone'] })
  let statusOk = Boolean(sText) && check('status', status)
  const statusClaim = ungradedClaim(sText, pack)
  if (statusOk && statusClaim) {
    failed.push({ rule: 'feedback.graded', card_id: 'status', detail: statusClaim })
    statusOk = false
  }
  if (statusOk && urgent && (!status.fact_ids.includes(top.id) || !sText.includes(anchorOf(top.text_zh)))) {
    failed.push({ rule: 'topfact.referenced', card_id: 'status', detail: `the status must be about ${top.id} (${anchorOf(top.text_zh)})` })
    statusOk = false
  }
  if (!statusOk) {
    if (urgent) errors.push('status must name the top fact with its numbers')
    status = { ...floor.status, override: { rule: 'fallback', reason: 'status failed' } }
  }

  // next: one of the candidates; the mandatory one when there is one
  const nRaw = obj(raw.next)
  const actionId = str(nRaw.action_id)
  const mandatory = ranked.find((row) => row.mandatory)
  let action = ranked.find((row) => row.id === actionId) ?? null
  if (!action) {
    failed.push({ rule: 'next.candidate', card_id: 'next', detail: `action ${actionId || '(none)'} is not a candidate` })
    if (mandatory) errors.push(`next.action_id must be ${mandatory.id}`)
  }
  if (mandatory && action && action.id !== mandatory.id) {
    failed.push({ rule: 'mandatory.first', card_id: 'next', detail: `${mandatory.id} is mandatory` })
    errors.push(`next.action_id must be ${mandatory.id}`)
    action = null
  }
  let next = floor.next
  if (action) {
    const text = str(nRaw.text_zh)
    const detail = str(nRaw.detail_zh)
    const c = card('next_step', 'next', text, pack, { detail_zh: detail || action.detail_zh, action_id: action.id, fact_ids: action.fact_ids, tone: action.mandatory ? 'care' : 'neutral' })
    const detailOk = !detail || ([...detail].length <= 80 && runValidators('status', detail, { fact_ids: c.fact_ids, number_keys: c.number_keys }, pack).filter((row) => row.rule !== 'length').length === 0)
    if (!detailOk) failed.push({ rule: 'next.detail', card_id: 'next', detail: 'the detail failed its checks' })
    const nextClaim = ungradedClaim(`${text} ${detail}`, pack)
    if (nextClaim) failed.push({ rule: 'feedback.graded', card_id: 'next', detail: nextClaim })
    if (text && !nextClaim && check('next_step', c) && detailOk) next = { action, card: c }
    else if (action.mandatory) errors.push('the mandatory next step failed its checks')
  }
  if (next === floor.next) next = { ...floor.next, card: { ...floor.next.card, override: { rule: 'fallback', reason: 'next failed' } } }

  // suggestions: 2–4, distinct, each checked; failing ones are dropped, the floor tops them up
  const seen = new Set<string>()
  const suggestions: SurfaceCard[] = []
  const blocked = new Set(ranked.filter((row) => row.mandatory).flatMap((row) => row.blocks ?? []))
  for (const [index, value] of (Array.isArray(raw.suggestions) ? raw.suggestions : []).entries()) {
    const row = obj(value)
    const prompt = str(row.prompt_zh) || str(row.text_zh)
    if (!prompt || seen.has(prompt)) continue
    const linked = ranked.find((item) => item.id === str(row.action_id))
    if (linked && blocked.has(linked.kind) && !linked.mandatory) {
      failed.push({ rule: 'suggestion.blocked', card_id: `s${index}`, detail: `${linked.kind} is blocked while a doctor comes first` })
      continue
    }
    if (blocked.has('draft_plan') && /制定|起草|方案/.test(prompt) && !/医生/.test(prompt)) {
      failed.push({ rule: 'suggestion.blocked', card_id: `s${index}`, detail: 'a plan prompt while a doctor comes first' })
      continue
    }
    const claim = ungradedClaim(prompt, pack)
    if (claim) {
      failed.push({ rule: 'feedback.graded', card_id: `s${index}`, detail: claim })
      continue
    }
    const c = card('suggestion', `s-${index}`, prompt, pack, { prompt_zh: prompt, fact_ids: strings(row.fact_ids), ...(linked ? { action_id: linked.id } : {}) })
    if (!check('suggestion', c)) continue
    seen.add(prompt)
    suggestions.push(c)
    if (suggestions.length === 4) break
  }
  for (const row of floor.suggestions) {
    if (suggestions.length >= 2) break
    if (!seen.has(row.prompt_zh ?? row.text_zh)) suggestions.push(row)
  }
  if (!Array.isArray(raw.suggestions)) errors.push('suggestions missing')
  if (!raw.greeting || !raw.status || !raw.next) errors.push('greeting, status and next are required')
  if (errors.length > 0) return { ok: false, errors: [...errors, ...failed.map((row) => `${row.card_id} ${row.rule}: ${row.detail}`)] }
  return { ok: true, value: { greeting, status, next, suggestions, failed, passed } }
}

export function coachFallback(_pack: FactPack, extra: CoachExtra): CoachDraft {
  const floor = extra.floor
  return { greeting: floor.greeting, status: floor.status, next: floor.next, suggestions: floor.suggestions, failed: [], passed: [] }
}

export const coachProfile: AgentProfile<CoachExtra, CoachDraft> = {
  id: 'coach',
  owner: 'M5',
  modes: ['one_shot'],
  prompt: [COACH_PROMPT],
  tools: [],
  output_schema: COACH_SCHEMA,
  route: { reasoningEffort: 'off', maxTokens: 900 },
  deadline_ms: 15_000,
  input: coachInput,
  validate: validateCoach,
  fallback: coachFallback,
}
