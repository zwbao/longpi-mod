// M0 memory tools and routes (AA §3.4): read_person_memory, remember_for_me, note_page_issue;
// GET/POST /api/longpi/memory. A quote that is really in the person's message makes the item confirmed;
// anything else is stored unconfirmed and may only add caution (AA §2.1 rule 5).

import type { Context } from '../../sys/cordis.ts'
import { defineTool } from '../../sys/dsh-tools.ts'
import { join } from '../../sys/path.ts'
import type { CoreDeps } from '../contracts/index.ts'
import type { MemoryItem, MemoryKind, NewMemoryItem } from '../contracts/memory.ts'
import type { Provenance } from '../contracts/common.ts'
import { asJson } from '../json.ts'
import { isoDay } from '../interventions.ts'
import { exclusionsFromText } from '../plan-safety.ts'
import { forgetExclusion } from '../plan-prefs.ts'
import { memoryFor } from './memory.ts'
import { appendJsonl } from './store.ts'
import { jsonOut, sessionOfExec } from './tool-kit.ts'
import { lastPersonText, quoteIn } from './turn-text.ts'

const KINDS: MemoryKind[] = ['goal', 'exclusion', 'condition', 'medication', 'supplement', 'family_history', 'life_event', 'preference', 'note',
  'vision', 'motivation', 'win', 'style', 'commitment']
const TONES = ['upbeat', 'gentle', 'direct'] as const

function isDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** One memory item from what the model passed, typed by kind; null when it cannot be stored. */
export function itemFrom(args: Record<string, unknown>, provenance: Provenance, confirmed: boolean, today: string): NewMemoryItem | null {
  const kind = String(args.kind ?? '') as MemoryKind
  const text = typeof args.text === 'string' ? args.text.trim().slice(0, 200) : ''
  if (!KINDS.includes(kind) || !text) return null
  const base = { text_zh: text, confirmed, provenance }
  const name = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : text
  switch (kind) {
    case 'exclusion': {
      const given = Array.isArray(args.phrases) ? args.phrases.filter((row): row is string => typeof row === 'string' && row.trim() !== '').map((row) => row.trim()) : []
      const phrases = [...new Set([...given, ...exclusionsFromText(text), ...exclusionsFromText(String(provenance.quote_zh ?? ''))])]
      const fallback = text.replace(/^(?:不要|别再|别|不想|不再)/, '').trim()
      return { ...base, kind, scope: 'plan_item', match: { phrases_zh: phrases.length > 0 ? phrases : [fallback] } } as NewMemoryItem
    }
    case 'condition':
      return { ...base, kind, name_zh: name, flags: [], state: args.state === 'past' ? 'past' : 'current' } as NewMemoryItem
    case 'medication':
    case 'supplement':
      return { ...base, kind, name_zh: name, drug_class: [], source_rx: kind === 'medication' ? 'doctor' : 'self', ...(typeof args.regimen === 'string' ? { regimen_text: args.regimen.slice(0, 120) } : {}), ...(args.stopped === true ? { stopped: today } : {}) } as NewMemoryItem
    case 'life_event': {
      const event = ['sick', 'travel', 'injury', 'surgery', 'pregnancy', 'bereavement', 'shift_work', 'other'].includes(String(args.event)) ? String(args.event) : 'other'
      return { ...base, kind, event, from: isDay(args.from) ? args.from : today, to: isDay(args.to) ? args.to : null, freezes_streak: event === 'sick' || event === 'travel' } as NewMemoryItem
    }
    case 'family_history':
      return { ...base, kind, relative: 'other', condition_zh: name, flags: [] } as NewMemoryItem
    case 'goal':
      return { ...base, kind } as NewMemoryItem
    case 'preference':
      return { ...base, kind, key: 'detail', value: text } as NewMemoryItem
    case 'vision':
    case 'motivation':
      return { ...base, kind } as NewMemoryItem
    case 'win':
      return { ...base, kind, day: isDay(args.day) ? args.day : today } as NewMemoryItem
    case 'style': {
      const tone = TONES.find((row) => row === args.tone)
      const address = args.address === '您' || args.address === '你' ? args.address : undefined
      return { ...base, kind, ...(tone ? { tone } : {}), ...(address ? { address } : {}) } as NewMemoryItem
    }
    case 'commitment': {
      const raw = typeof args.confidence === 'number' ? args.confidence : Number.parseFloat(String(args.confidence ?? ''))
      const confidence = Number.isFinite(raw) ? Math.max(0, Math.min(10, Math.round(raw))) : null
      const planItem = typeof args.plan_item === 'string' && args.plan_item.trim() ? args.plan_item.trim().slice(0, 80) : undefined
      return { ...base, kind, confidence, started: today, ...(planItem ? { plan_item: planItem } : {}) } as NewMemoryItem
    }
    default:
      return { ...base, kind: 'note' } as NewMemoryItem
  }
}

function brief(item: MemoryItem) {
  return { id: item.id, kind: item.kind, text_zh: item.text_zh, confirmed: item.confirmed, safety_relevant: item.safety_relevant, since: item.provenance.at.slice(0, 10), from: item.provenance.kind }
}

export function registerMemoryTools(ctx: Context, deps: CoreDeps): void {
  ctx.tools.register(defineTool({
    name: 'read_person_memory',
    description: 'What this person told LongPi before and it keeps across sessions: goals, what they do not want (exclusions), conditions, medicines and supplements, family history, life events (sick, travel), doctor visits, preferences; and the coach\'s file: why they care, their vision, wins, style and small commitments with their cumulative counts. Each item has an id (to retract, confirm or graduate with remember_for_me) and whether they confirmed it. Read-only.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 20000,
    isConcurrencySafe: () => true,
    async execute() {
      const memory = memoryFor(deps.dataDir())
      const items = memory.read().items.filter((item) => item.status === 'active' && item.kind !== 'asked_topic')
      return asJson({ digest_zh: memory.digest({ purpose: 'chat' }), items: items.map(brief), how_to_read: 'Use these instead of asking again. An item marked confirmed false was noted from the chat without their exact words: treat it only as a reason for more caution, and confirm it with them when it matters.' })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'remember_for_me',
    description: 'Keep something the person just told you for every later session: a goal (目标 75 公斤), an exclusion (不要限时进食), a condition (脂肪肝、怀孕), a medicine or supplement they take or stopped, family history, a life event (感冒了、出差到 25 号), a preference; and the coach\'s file: why they care (motivation), the picture of what they want to still do at 70 or 80 (vision), a win (something they did), how to speak to them (style), a small commitment written as 当…时，我就… (commitment, with confidence 0–10 and the plan item it carries out). Or retract / confirm an item by id (from read_person_memory), or graduate a commitment that has become a habit. Pass quote = their exact words from this message. Never store what they did not say, and never something about another person as theirs.',
    parameters: {
      op: { type: 'string', enum: ['add', 'retract', 'confirm', 'graduate'], required: true },
      kind: { type: 'string', enum: KINDS, description: 'For add.' },
      confidence: { type: 'number', description: 'For a commitment: how sure they are, 0–10, in their words.' },
      plan_item: { type: 'string', description: 'For a commitment: the id of the plan item it carries out (read_intervention_plan); its check-ins are the cumulative count.' },
      replaces: { type: 'string', description: 'For a commitment made smaller or rewritten: the id of the commitment it replaces.' },
      tone: { type: 'string', enum: [...TONES], description: 'For style.' },
      address: { type: 'string', enum: ['你', '您'], description: 'For style: how to address them. Never a name.' },
      day: { type: 'string', description: 'For a win: YYYY-MM-DD, default today.' },
      text: { type: 'string', description: 'For add: one short line they would recognise (不要限时进食; 目标体重 75 公斤).' },
      quote: { type: 'string', description: 'Their exact words from this message.' },
      id: { type: 'string', description: 'For retract or confirm.' },
      name: { type: 'string', description: 'Medicine, supplement or condition name.' },
      regimen: { type: 'string', description: 'For a medicine: the dose and schedule exactly as they said it. Never invent one.' },
      stopped: { type: 'boolean', description: 'For a medicine they stopped.' },
      phrases: { type: 'array', items: { type: 'string' }, description: 'For an exclusion: what to keep out, as a short phrase (限时进食, 低碳).' },
      event: { type: 'string', enum: ['sick', 'travel', 'injury', 'surgery', 'pregnancy', 'bereavement', 'shift_work', 'other'] },
      from: { type: 'string', description: 'YYYY-MM-DD' },
      to: { type: 'string', description: 'YYYY-MM-DD' },
      state: { type: 'string', enum: ['current', 'past'] },
    },
    output: jsonOut,
    timeoutMs: 20000,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const dataDir = deps.dataDir()
      const memory = memoryFor(dataDir)
      const session = sessionOfExec(exec)
      const now = new Date().toISOString()
      const today = isoDay()
      const op = String(args.op ?? '')
      if (op === 'graduate') {
        const id = typeof args.id === 'string' ? args.id : ''
        const result = memory.apply([{ op: 'graduate', id, day: today, provenance: { kind: 'chat', at: now, session_id: session, by: 'M0' } }], 'M0')
        if (result.applied.length === 0) return asJson({ ok: false, error: 'no active commitment with that id; call read_person_memory' })
        deps.invalidate()
        const item = memory.read().items.find((row) => row.id === id)
        return asJson({ ok: true, done_zh: `已成习惯：${item?.text_zh ?? ''}` })
      }
      if (op === 'retract' || op === 'confirm') {
        const id = typeof args.id === 'string' ? args.id : ''
        const item = memory.read().items.find((row) => row.id === id)
        if (!item) return asJson({ ok: false, error: 'no item with that id; call read_person_memory' })
        const result = memory.apply([{ op, id, provenance: { kind: 'chat', at: now, session_id: session, by: 'M0' } }], 'M0')
        if (op === 'retract' && item.kind === 'exclusion') forgetExclusion(dataDir, [...item.match.phrases_zh, ...(item.match.item_ids ?? [])])
        deps.invalidate()
        return asJson({ ok: result.applied.length > 0, done_zh: op === 'retract' ? `已撤销：${item.text_zh}` : `已确认：${item.text_zh}` })
      }
      const quote = typeof args.quote === 'string' ? args.quote.trim().slice(0, 200) : ''
      const said = lastPersonText(session)
      // No words of theirs to check against (a scheduled or restarted turn): never confirmed on the model's say-so.
      const confirmed = Boolean(quote) && Boolean(said) && quoteIn(quote, said)
      const provenance: Provenance = { kind: confirmed ? 'chat' : 'model_extracted', at: now, session_id: session, by: 'M0', ...(quote ? { quote_zh: quote } : {}) }
      const item = itemFrom(args as Record<string, unknown>, provenance, confirmed, today)
      if (!item) return asJson({ ok: false, error: 'kind and text are required' })
      const replaces = item.kind === 'commitment' && typeof args.replaces === 'string'
        ? memory.read().items.find((row) => row.id === args.replaces && row.status === 'active' && row.kind === 'commitment') : undefined
      const result = memory.apply([replaces ? { op: 'supersede', id: replaces.id, item } : { op: 'add', item }], 'M0')
      deps.invalidate()
      const saved = memory.read().items.find((row) => row.id === result.applied[0])
      return asJson({
        ok: Boolean(saved),
        saved: saved ? brief(saved) : null,
        read_back_zh: saved ? `已记录：${saved.text_zh}${confirmed ? '' : '（与你的原话未完全对应，暂作为提醒；说「撤销」即可取消）'}` : '',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'note_page_issue',
    description: 'When the LongPi page (the snapshot at the start of the turn) says something the person or you find wrong, note it here with why, so it is checked and the page is rebuilt. Say to the person what is wrong; never contradict the page silently.',
    parameters: { issue: { type: 'string', required: true, description: 'What on the page is wrong and why, in one or two sentences.' } },
    output: jsonOut,
    timeoutMs: 10000,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      try {
        appendJsonl(join(deps.dataDir(), 'page_issues.jsonl'), { at: new Date().toISOString(), session: sessionOfExec(exec), issue: String(args.issue ?? '').slice(0, 500) })
      } catch {
        // noted in the chat anyway
      }
      deps.invalidate()
      return asJson({ ok: true, note: 'Noted; the page will be rebuilt.' })
    },
  }))
}

export function registerMemoryRoutes(deps: CoreDeps): void {
  deps.http.route('GET', '/api/longpi/memory', async () => {
    const memory = memoryFor(deps.dataDir())
    const items = memory.read().items.filter((item) => item.status === 'active' && item.kind !== 'asked_topic')
    return { ok: true, rev: memory.read().rev, digest_zh: memory.digest({ purpose: 'chat' }), items: items.map(brief) }
  })
  deps.http.route('POST', '/api/longpi/memory', async (_req, body) => {
    const value = body && typeof body === 'object' ? body as Record<string, unknown> : {}
    const dataDir = deps.dataDir()
    const memory = memoryFor(dataDir)
    const now = new Date().toISOString()
    const op = String(value.op ?? '')
    if (op === 'retract' || op === 'confirm') {
      const id = String(value.id ?? '')
      const item = memory.read().items.find((row) => row.id === id)
      if (!item) return { ok: false, status: 404, error: 'no item with that id' }
      memory.apply([{ op, id, provenance: { kind: 'page', at: now, by: 'M0' } }], 'M0')
      if (op === 'retract' && item.kind === 'exclusion') forgetExclusion(dataDir, [...item.match.phrases_zh, ...(item.match.item_ids ?? [])])
      deps.invalidate()
      return { ok: true }
    }
    const item = itemFrom(value, { kind: 'page', at: now, by: 'M0' }, true, now.slice(0, 10))
    if (!item) return { ok: false, status: 400, error: 'kind and text are required' }
    const result = memory.apply([{ op: 'add', item }], 'M0')
    deps.invalidate()
    return { ok: result.applied.length > 0, id: result.applied[0] ?? null }
  })
}
