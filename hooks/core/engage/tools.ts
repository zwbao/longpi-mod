// Chat tools for the Codex. read_season is read-only; log_life_event records sick and travel days, which are
// never counted as experiment days. Neither sends the person's name anywhere.

import type { Context } from '../../sys/cordis.ts'
import { defineTool } from '../../sys/dsh-tools.ts'
import { asJson } from '../json.ts'
import { logLifeCodex, syncCodex } from './engine.ts'

const EVENTS = ['sick', 'travel', 'injury', 'surgery', 'pregnancy', 'bereavement', 'shift_work', 'other'] as const

function jsonText(value: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

const jsonOut = { schema: { type: 'json' as const }, render: (_args: unknown, value: unknown) => jsonText(value) }

/** What chat may know of the Codex: no values except a revealed result the person has already seen. */
export function seasonForChat() {
  const view = syncCodex()
  if (!view.enabled) return { ok: true, enabled: false, reason_zh: view.reason_zh }
  return {
    ok: true,
    enabled: true,
    started: view.started,
    season: view.season,
    running: view.running.map((run) => ({ title_zh: run.title_zh, do_zh: run.do_zh, day: run.day, days: run.days, done_days: run.done_count, randomized: run.randomized, today_zh: run.today_zh, threshold_zh: run.threshold_zh, status: run.status })),
    ready_to_turn: view.ready.map((run) => run.title_zh),
    packs_waiting: view.packs.map((pack) => ({ kind: pack.kind, source_zh: pack.source_zh, opened: Boolean(pack.opened), options: pack.options.map((row) => row.title_zh) })),
    reserve: view.reserve.map((row) => row.title_zh),
    deck: view.deck.slice(0, 6).map((run) => ({ title_zh: run.title_zh, outcome_zh: run.result?.primary.text_zh ?? null, praise_zh: run.result?.praise_zh ?? null, how_zh: run.result?.how_zh ?? null })),
    library: view.library,
    footprints: view.footprints.slice(0, 6).map((row) => row.title_zh),
    devices: view.devices,
    rules_zh: view.rules_zh,
  }
}

export function registerEngageTools(ctx: Context, _dataDir: () => string): void {
  ctx.tools.register(defineTool({
    name: 'read_season',
    description: 'Read this person\'s 长寿图鉴 (Codex): the season (8 weeks or until the next retest), the two-week experiments running (day, done days, today\'s assignment in the randomized version, the public threshold), experiments ready to turn over, packs waiting, the 待选 list, revealed results, the library reading count and footprints. Results use only 超出平时波动 / 在平时波动内 / 数据不够; never say 真实变化, 有效, or that the experiment caused it. Do not reveal a result the person has not turned over yet. There are no draws, streaks or prices. Hidden for anyone under 18. Call this when they ask what to do this season, about an experiment, a pack, or a sick or travel day.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 30000,
    isConcurrencySafe: () => true,
    async execute() {
      return asJson(seasonForChat())
    },
  }))

  ctx.tools.register(defineTool({
    name: 'log_life_event',
    description: 'Log a sick day, a trip, or another life event the person just stated, in their words, so those days are left out of a running experiment (never counted as failure) and plans go easy on them. from and to are YYYY-MM-DD; to may be omitted for a single day. Do not invent dates. One call covers at most 14 days.',
    parameters: {
      event: { type: 'string', enum: [...EVENTS], required: true, description: 'sick, travel, injury, surgery, pregnancy, bereavement, shift_work, or other.' },
      from: { type: 'string', required: true, description: 'First civil day, YYYY-MM-DD.' },
      to: { type: 'string', description: 'Last civil day, YYYY-MM-DD. Omit for a single day.' },
      note_zh: { type: 'string', description: 'The person\'s own short note. Do not add a medical conclusion.' },
    },
    output: jsonOut,
    timeoutMs: 30000,
    isConcurrencySafe: () => false,
    async execute(args) {
      const event = EVENTS.find((item) => item === args.event)
      const from = typeof args.from === 'string' ? args.from.trim() : ''
      if (!event || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return asJson({ ok: false, error: '需要 event，以及 YYYY-MM-DD 的 from。' })
      const to = typeof args.to === 'string' && args.to.trim() ? args.to.trim() : null
      const result = logLifeCodex({ event, from, to })
      return asJson({ ok: result.ok, error: result.error, days: result.days, note_zh: result.ok ? '这几天不计入实验天数，也不算失败。' : undefined })
    },
  }))
}
