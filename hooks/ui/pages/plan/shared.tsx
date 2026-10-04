// Small pieces the 方案 page's sections share: the verdict tag, the coloured day strip, a fold toggle, the
// check-in state with the answer just given, and the check-in post itself.

import type { RenderElement } from 'claude-code'

import type { Ctx, Els } from '../../types.ts'
import { C, cells, fit } from '../../kit.tsx'
import type { CheckState, Journey } from './types.ts'

// --- verdicts --------------------------------------------------------------------------------------

const VERDICT: Record<string, { mark: string; color: string }> = {
  有效: { mark: '✓', color: C.good },
  波动内: { mark: '≈', color: C.silver },
  反向: { mark: '!', color: C.warn },
  无法判断: { mark: '?', color: C.dim },
}

/** Verdicts always travel with a mark and a label, never colour alone. */
export function VerdictTag(E: Els, verdict: string, key: string): RenderElement {
  const { Text } = E
  const label = VERDICT[verdict] ? verdict : '无法判断'
  const style = VERDICT[label] as { mark: string; color: string }
  return <Text key={key} color={style.color}>{`[${style.mark}${label}]`}</Text>
}

export function verdictColor(verdict: string): string {
  return VERDICT[verdict]?.color ?? C.dim
}

// --- the day strip ---------------------------------------------------------------------------------

export type DayCell = 'done' | 'missed' | 'unknown' | 'today'

const GLYPH: Record<DayCell, { glyph: string; color: string }> = {
  done: { glyph: '■', color: C.good },
  missed: { glyph: '□', color: C.warn },
  unknown: { glyph: '·', color: C.dim },
  today: { glyph: '▣', color: C.accent },
}

/** The last `days` cells of a calendar from `from` on, today's cell taken from the answer just given. */
export function cellsOf(calendar: ReadonlyArray<{ date: string; status: string }>, days: number, today: string, todayState?: CheckState, from = ''): DayCell[] {
  const tail = calendar.filter((day) => day.date >= from).slice(-days)
  return tail.map((day) => {
    if (day.date === today && todayState !== undefined) return todayState === true ? 'done' : todayState === false ? 'missed' : 'today'
    if (day.status === 'done') return 'done'
    if (day.status === 'missed') return 'missed'
    return day.date === today ? 'today' : 'unknown'
  })
}

/** Days as coloured cells (■ done, □ missed, · no record, ▣ today), one Text per run of a kind. */
export function Strip(E: Els, days: readonly DayCell[], key: string): RenderElement {
  const { Box, Text } = E
  const runs: Array<{ kind: DayCell; n: number }> = []
  for (const day of days) {
    const last = runs[runs.length - 1]
    if (last && last.kind === day) last.n += 1
    else runs.push({ kind: day, n: 1 })
  }
  return (
    <Box key={key} flexDirection="row">
      {runs.map((run, i) => <Text key={`r${i}`} color={GLYPH[run.kind].color}>{GLYPH[run.kind].glyph.repeat(run.n)}</Text>)}
    </Box>
  )
}

// --- folds -----------------------------------------------------------------------------------------

/** A sub value read as on/off. */
export function isOn(ctx: Ctx, key: string): boolean {
  return ctx.view.sub[key] === '1'
}

/** A plain ▸/▾ toggle for a fold kept in the page's sub values. */
export function Fold(ctx: Ctx, subKey: string, label: string, key: string, note = ''): RenderElement {
  const { Button } = ctx.E
  const open = isOn(ctx, subKey)
  return <Button key={key} plain dimColor={!open} label={`${open ? '▾' : '▸'} ${label}${note ? `  ${note}` : ''}`} onPress={() => ctx.act.setSub(subKey, open ? '' : '1')} />
}

// --- check-ins -------------------------------------------------------------------------------------

/**
 * The item's state today: the answer just given while the journey read after it has not come back yet,
 * else what the journey says. A mark is `state|at|day`, kept in the page's sub values.
 */
export function checkStateOf(ctx: Ctx, journey: Journey, id: string): CheckState {
  const mark = ctx.view.sub[`plan.ck.${id}`]
  if (mark) {
    const [state, at, day] = mark.split('|')
    const held = ctx.route('journey')
    const fresh = Number(at) >= (held?.at ?? 0) || Boolean(held?.loading)
    if (day === journey.today && fresh) return state === 'true' ? true : state === 'false' ? false : null
  }
  return journey.plan.checkin_items.find((row) => row.id === id)?.done_today ?? null
}

/** How many of today's items have an answer, and how many are done. */
export function todayCounts(ctx: Ctx, journey: Journey): { done: number; answered: number; total: number } {
  let done = 0
  let answered = 0
  for (const row of journey.plan.checkin_items) {
    const state = checkStateOf(ctx, journey, row.id)
    if (state === true) done += 1
    if (state !== null) answered += 1
  }
  return { done, answered, total: journey.plan.checkin_items.length }
}

const SAID: Record<'true' | 'false' | 'null', string> = { true: '今天完成', false: '今天未完成', null: '已撤销今天的记录' }

export function saidText(title: string, state: CheckState): string {
  const short = fit(title, 24)
  return state === null ? `「${short}」${SAID.null}。` : `已记录：${short}，${SAID[String(state) as 'true' | 'false']}。`
}

/** Post one answer for today: shown at once, saved, then the plan's data read again. */
export async function answerCheckIn(ctx: Ctx, journey: Journey, id: string, title: string, state: CheckState): Promise<void> {
  ctx.act.setSub(`plan.ck.${id}`, `${String(state)}|${Date.now()}|${journey.today}`)
  ctx.act.setSub('plan.busy', id)
  const out = await ctx.act.post('checkin', { item: id, done: state }, { reload: ['tracking'], done: saidText(title, state), quiet: true })
  if (!out.ok) {
    ctx.act.setSub(`plan.ck.${id}`, '')
    const problems = Array.isArray(out.json.problems) ? (out.json.problems as unknown[]).map(String).join(' ') : ''
    ctx.act.toast(`未能记录「${fit(title, 20)}」：${problems || (typeof out.json.error === 'string' ? out.json.error : '请稍后再试')}`)
  }
  ctx.act.setSub('plan.busy', '')
}

/** Text cut to a width, for one-line rows. */
export function line(text: string, width: number): string {
  return cells(text) <= width ? text : fit(text, width)
}
