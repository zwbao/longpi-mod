// 今天 on 总览 (overview.ts TodayCard, checkin.ts, plan.ts TodayList): today's check-ins with 完成 / 未完成 while
// unanswered and the answer with 撤销 once given, then the week at a glance and the next retest date.

import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from '../../types.ts'
import { C, fit } from '../../kit.tsx'
import type { CheckState, Journey, Tracking } from './journey.ts'
import { nb, Card, Chip, Para, setSub, sub } from './ui.tsx'
import { chineseDate } from './words.ts'

const WEEK_ZH = ['日', '一', '二', '三', '四', '五', '六']

type DayState = 'done' | 'part' | 'missed' | 'unknown'

const DAY_ZH: Record<DayState, string> = { done: '都完成', part: '部分完成', missed: '未完成', unknown: '没有记录' }

function addDays(iso: string, days: number): string {
  const at = new Date(`${iso.slice(0, 10)}T12:00:00Z`)
  at.setUTCDate(at.getUTCDate() + days)
  return at.toISOString().slice(0, 10)
}

function weekOf(tracking: Tracking | null, today: string): Array<{ date: string; state: DayState }> {
  const days = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6))
  return days.map((date) => {
    const statuses = (tracking?.items ?? []).flatMap((item) => (item.adherence?.calendar ?? []).filter((day) => day.date === date).map((day) => day.status))
    const done = statuses.filter((status) => status === 'done').length
    const missed = statuses.filter((status) => status === 'missed').length
    const state: DayState = done > 0 && done === statuses.length ? 'done' : done > 0 ? 'part' : missed > 0 ? 'missed' : 'unknown'
    return { date, state }
  })
}

/** plan.ts retestDates: the earliest retest per marker. */
export function retestDates(tracking: Tracking | null): Array<{ marker: string; date: string }> {
  const earliest = new Map<string, string>()
  for (const item of tracking?.items ?? []) {
    for (const row of item.verdicts ?? []) {
      if (!row.next_retest) continue
      const seen = earliest.get(row.marker)
      if (!seen || row.next_retest < seen) earliest.set(row.marker, row.next_retest)
    }
  }
  if (earliest.size === 0) {
    for (const row of tracking?.suggestions ?? []) if (row.kind === 'retest' && row.date && row.marker && !earliest.has(row.marker)) earliest.set(row.marker, row.date)
  }
  return [...earliest.entries()].map(([marker, date]) => ({ marker, date })).sort((a, b) => a.date.localeCompare(b.date))
}

const SAID: Record<'true' | 'false' | 'null', string> = { true: '今天完成', false: '今天未完成', null: '已撤销今天的记录' }

function saidText(title: string, state: CheckState): string {
  const short = fit(title, 24)
  return state === null ? `「${short}」${SAID.null}。` : `已记录：${short}，${SAID[String(state) as 'true' | 'false']}。`
}

/** checkin.ts: what was just answered shows at once, until a journey read after the answer says otherwise. */
function answer(ctx: Ctx, id: string, title: string, state: CheckState): void {
  setSub(ctx, `ci.${id}`, `${String(state)}|${Date.now()}`)
  void ctx.act.post('checkin', { item: id, done: state }, { reload: ['tracking'], done: saidText(title, state) }).then((out) => {
    if (!out.ok) setSub(ctx, `ci.${id}`, '')
  })
}

export function checkStateOf(ctx: Ctx, row: { id: string; done_today: CheckState }): CheckState {
  const [said = '', at = '0'] = sub(ctx, `ci.${row.id}`).split('|')
  if (!said) return row.done_today
  const held = ctx.route('journey')
  const fresh = held != null && !held.loading && held.at > Number(at)
  if (fresh) return row.done_today
  return said === 'true' ? true : said === 'false' ? false : null
}

function WeekStrip(ctx: Ctx, tracking: Tracking | null, today: string): Node {
  if (!tracking) return null
  const { Box, Text } = ctx.E
  const week = weekOf(tracking, today)
  const retest = retestDates(tracking)[0]
  const retestText = retest ? (retest.date <= today ? `现在可以复测${retest.marker}` : `${chineseDate(retest.date, today)}可复测${retest.marker}`) : ''
  const counts = (['done', 'part', 'missed'] as const).map((state) => [state, week.filter((day) => day.state === state).length] as const).filter(([, n]) => n > 0)
  const tone: Record<DayState, string> = { done: C.good, part: C.warn, missed: C.bad, unknown: C.dim }
  return (
    <Box key="week" flexDirection="column" marginTop={1}>
      <Text key="cells">
        <Text key="l" dimColor>本周 </Text>
        {week.map((day, i) => {
          const wd = WEEK_ZH[new Date(`${day.date}T12:00:00Z`).getUTCDay()] ?? ''
          return day.state === 'unknown' || day.state === 'missed'
            ? <Text key={`d${i}`} color={tone[day.state]} dimColor={day.state === 'unknown'}>{` ${wd} `}</Text>
            : <Text key={`d${i}`} backgroundColor={tone[day.state]} color="black">{` ${wd} `}</Text>
        })}
        <Text key="sum" dimColor>{counts.length > 0 ? `  ${counts.map(([state, n]) => `${DAY_ZH[state]} ${n} 天`).join(' · ')}` : '  近 7 天没有记录'}</Text>
      </Text>
      {retestText ? <Text key="retest" dimColor>{retestText}</Text> : null}
    </Box>
  )
}

/** One item: its title, then the answer controls (every state in words, never colour alone). */
function ItemRow(ctx: Ctx, row: { id: string; title: string; done_today: CheckState }, width: number, index: number): RenderElement {
  const { Box, Text, Button } = ctx.E
  const state = checkStateOf(ctx, row)
  const controls = state === null
    ? [
      <Button key={`ci-${row.id}-done`} label="完成" onPress={() => answer(ctx, row.id, row.title, true)} />,
      <Button key={`ci-${row.id}-miss`} plain dimColor label="未完成" onPress={() => answer(ctx, row.id, row.title, false)} />,
    ]
    : [
      state ? Chip(ctx.E, '✓ 已完成', 'good', `ci-${row.id}-state`) : <Text key={`ci-${row.id}-state`} color={C.silver}>✗ 未完成</Text>,
      <Button key={`ci-${row.id}-undo`} plain dimColor label="撤销" onPress={() => answer(ctx, row.id, row.title, null)} />,
    ]
  const controlsW = 18
  return (
    <Box key={`item-${index}`} flexDirection="row" justifyContent="space-between" width={width}>
      <Box key="t" width={Math.max(10, width - controlsW - 1)}>
        {Para(ctx.E, `${index + 1}. ${row.title}`, Math.max(10, width - controlsW - 1), { key: 't', ...(state === true ? { color: C.silver } : {}) })}
      </Box>
      <Box key="c" flexDirection="row" gap={1} width={controlsW} justifyContent="flex-end">{controls}</Box>
    </Box>
  )
}

export function TodayCard(ctx: Ctx, journey: Journey, tracking: Tracking | null): RenderElement {
  const { Box, Text } = ctx.E
  const today = journey.today || ctx.today
  const items = journey.plan.checkin_items
  const done = items.filter((row) => checkStateOf(ctx, row) === true).length
  const all = items.length > 0 && done === items.length
  return Card(ctx, {
    key: 'today', title: '今天', width: ctx.width, tone: all ? C.good : C.dim,
    aside: items.length > 0 ? <Text key="count" bold color={all ? C.good : C.accent}>{`${done}/${items.length}`}</Text> : null,
    children: [
      items.length === 0
        ? <Text key="empty" dimColor wrap="wrap">{nb('今天没有需要手动记录的项目。手环数据和已记录的服药情况会自动计入。')}</Text>
        : <Box key="items" flexDirection="column">{items.map((row, i) => ItemRow(ctx, row, ctx.width - 4, i))}</Box>,
      WeekStrip(ctx, tracking, today),
    ],
  })
}
