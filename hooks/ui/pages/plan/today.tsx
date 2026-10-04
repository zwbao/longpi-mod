// The top of the 方案 page: today's check-ins with one key each, how well the plan is followed, when to
// retest, and the changes that moved toward the goal beyond normal fluctuation (client/plan.ts TodayTile,
// AdherenceTile, RetestTile, Wins).

import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from '../../types.ts'
import { bar, C, daysBetween, fit, pad, Section, zh } from '../../kit.tsx'
import { chineseDate, fmtAuto, minus, pct } from './format.ts'
import { answerCheckIn, cellsOf, checkStateOf, Strip, todayCounts } from './shared.tsx'
import type { Journey, Tracking } from './types.ts'

/** A bar on a dim track: the share filled in colour, the rest as ░. */
function Meter(ctx: Ctx, share: number, width: number, color: string, key: string): RenderElement {
  const { Box, Text } = ctx.E
  const filled = bar(share, width).trimEnd()
  const rest = Math.max(0, width - filled.length)
  return (
    <Box key={key} flexDirection="row">
      {filled ? <Text color={color}>{filled}</Text> : null}
      {rest > 0 ? <Text dimColor>{'░'.repeat(rest)}</Text> : null}
    </Box>
  )
}

/** Letters for the 完成 of today's rows: none the pane takes (g m r s u, the digits). */
const LETTERS = 'abcdefhijklnopqtvwxyz'.split('')

const EMPTY_TODAY = '今天没有需要手动记录的项目。手环数据和已记录的服药情况会自动计入。'

/** Today's items with their answers: 完成 by one key, 未完成, and 撤销 once answered. */
export function TodayBlock(ctx: Ctx, journey: Journey, tracking: Tracking | null): RenderElement {
  const { Box, Text, Button } = ctx.E
  const items = journey.plan.checkin_items
  const counts = todayCounts(ctx, journey)
  const inner = ctx.width - 4
  if (items.length === 0) {
    return Section(ctx.E, { key: 'today', title: '今天', width: ctx.width, tone: C.accent, children: <Text key="empty" dimColor wrap="wrap">{zh(EMPTY_TODAY)}</Text> })
  }
  const share = counts.total > 0 ? counts.done / counts.total : 0
  const busy = ctx.view.sub['plan.busy'] ?? ''
  const tracked = new Map((tracking?.items ?? []).map((item) => [item.id, item]))
  const stripDays = inner >= 70 && tracking ? 7 : 0
  const buttonsWidth = 16
  const titleWidth = Math.max(10, inner - buttonsWidth - (stripDays ? stripDays + 2 : 0) - 1)
  const allDone = counts.total > 0 && counts.done === counts.total
  const rows = items.map((row, index) => {
    const state = checkStateOf(ctx, journey, row.id)
    const calendar = tracked.get(row.id)?.adherence?.calendar ?? []
    const letter = LETTERS[index]
    const isBusy = busy === row.id
    const answer = (next: boolean | null) => void answerCheckIn(ctx, journey, row.id, row.title, next)
    const controls = state === null
      ? [
          <Button key={`ci-${row.id}-done`} plain label={isBusy ? '记录中' : '完成'} {...(letter ? { hotkey: letter } : {})} onPress={() => answer(true)} />,
          <Button key={`ci-${row.id}-miss`} plain dimColor label="未完成" onPress={() => answer(false)} />,
        ]
      : [
          <Text key={`ci-${row.id}-state`} color={state ? C.good : C.warn}>{state ? '✓ 已完成' : '✗ 未完成'}</Text>,
          <Button key={`ci-${row.id}-undo`} plain dimColor label={isBusy ? '撤销中' : '撤销'} {...(letter ? { hotkey: letter } : {})} onPress={() => answer(null)} />,
        ]
    return (
      <Box key={`today-${row.id}`} flexDirection="row" justifyContent="space-between">
        <Box flexDirection="row" gap={1}>
          {stripDays && calendar.length > 0 ? Strip(ctx.E, cellsOf(calendar, stripDays, journey.today, state), `strip-${row.id}`) : null}
          {stripDays && calendar.length === 0 ? <Text key={`nostrip-${row.id}`}>{' '.repeat(stripDays)}</Text> : null}
          <Text key={`t-${row.id}`} color={state === true ? C.good : undefined} dimColor={state === false}>{pad(row.title, titleWidth)}</Text>
        </Box>
        <Box flexDirection="row" gap={1}>{controls}</Box>
      </Box>
    )
  })
  return Section(ctx.E, {
    key: 'today',
    title: '今天',
    note: `${counts.done}/${counts.total} 已完成`,
    width: ctx.width,
    tone: allDone ? C.good : C.accent,
    children: [
      <Box key="progress" flexDirection="row" gap={1}>
        {Meter(ctx, share, Math.min(24, Math.max(8, inner - 40)), C.good, 'meter')}
        <Text dimColor>{allDone ? '今天的都完成了。' : '在此记录完成或未完成，误操作可撤销'}</Text>
      </Box>,
      stripDays ? <Text key="cols" dimColor>{`${pad('近 7 天', stripDays + 1)}项目`}</Text> : null,
      ...rows,
    ],
  })
}

/** 方案执行: the 12-week rate and the cumulative count, which a missed day never lowers. */
export function AdherenceTile(ctx: Ctx, journey: Journey, tracking: Tracking | null, width: number): RenderElement {
  const { Text, Box } = ctx.E
  const items = tracking?.items ?? []
  const known = items.filter((item) => item.adherence && item.adherence.level !== 'unknown' && item.adherence.rate != null)
  const fallback = known.length > 0 ? known.reduce((sum, item) => sum + (item.adherence?.rate ?? 0), 0) / known.length : null
  const rate = journey.plan.adherence_pct != null ? journey.plan.adherence_pct / 100 : fallback
  const total = journey.plan.done_total
  if (rate == null || !Number.isFinite(rate)) {
    return Section(ctx.E, {
      key: 'adherence', title: '方案执行', width,
      children: [
        <Text key="t" bold dimColor>暂无执行记录</Text>,
        <Text key="x" dimColor wrap="wrap">{zh('在下面的项目里打卡后，这里显示近 12 周的执行率。')}</Text>,
      ],
    })
  }
  return Section(ctx.E, {
    key: 'adherence', title: '方案执行', width,
    children: [
      <Box key="rate" flexDirection="row" gap={1}>
        <Text bold color={rate >= 0.8 ? C.good : rate >= 0.5 ? C.warn : C.bad}>{`${Math.round(rate * 100)}%`}</Text>
        {Meter(ctx, rate, Math.max(6, Math.min(20, width - 12)), rate >= 0.8 ? C.good : C.warn, 'meter')}
      </Box>,
      <Text key="cap" dimColor>近 12 周平均</Text>,
      total > 0
        ? <Text key="total" color={C.gold} bold>{`累计打卡 ${total} 次`}</Text>
        : <Text key="total" dimColor wrap="wrap">打卡后，这里会显示累计次数；没做到的日子不会让它减少</Text>,
    ],
  })
}

/** Retest dates as the reminders see them: the earliest date each verdict gives per marker. */
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

export function RetestTile(ctx: Ctx, tracking: Tracking | null, today: string, failed: boolean, width: number): RenderElement {
  const { Text } = ctx.E
  const retests = retestDates(tracking)
  const upcoming = retests.filter((row) => row.date > today)
  const now = retests.filter((row) => row.date <= today)
  const first = upcoming[0]
  const sameDay = first ? upcoming.filter((row) => row.date === first.date).map((row) => row.marker) : []
  const body: Node[] = now.length > 0
    ? [<Text key="v" bold color={C.accent}>现在</Text>, <Text key="c" dimColor wrap="wrap">{zh(`可以复测${now.map((row) => row.marker).slice(0, 3).join('、')}`)}</Text>]
    : first
      ? [
          <Text key="v" bold>{`${daysBetween(today, first.date)} 天后`}</Text>,
          <Text key="c" dimColor wrap="wrap">{zh(`${chineseDate(first.date, today)}之后`)}</Text>,
          <Text key="m" dimColor wrap="wrap">{zh(sameDay.length > 1 ? `${sameDay[0]}等 ${sameDay.length} 项` : first.marker)}</Text>,
        ]
      : [<Text key="v" bold dimColor>—</Text>, <Text key="c" dimColor wrap="wrap">{zh(failed ? '未读取到复测日期' : '方案中的指标尚未安排复测日期')}</Text>]
  return Section(ctx.E, {
    key: 'retest', title: '下次复测', width,
    children: [...body, <Text key="foot" dimColor wrap="wrap">复测过早，变化多半只是正常波动。</Text>],
  })
}

/** The two tiles: side by side on a wide pane, stacked on a narrow one. */
export function Tiles(ctx: Ctx, journey: Journey, tracking: Tracking | null, failed: boolean): RenderElement {
  const { Box } = ctx.E
  if (ctx.width >= 90) {
    const half = Math.floor((ctx.width - 1) / 2)
    return (
      <Box key="tiles" flexDirection="row" gap={1}>
        {AdherenceTile(ctx, journey, tracking, half)}
        {RetestTile(ctx, tracking, journey.today, failed, ctx.width - half - 1)}
      </Box>
    )
  }
  return (
    <Box key="tiles" flexDirection="column">
      {AdherenceTile(ctx, journey, tracking, ctx.width)}
      {RetestTile(ctx, tracking, journey.today, failed, ctx.width)}
    </Box>
  )
}

/**
 * Markers that moved toward the goal beyond normal fluctuation. The words never credit an item with the
 * change: several items may run at once, and a change in step with a plan is not proof the plan caused it.
 */
export function Wins(ctx: Ctx, tracking: Tracking | null): Node {
  const { Box, Text } = ctx.E
  if (!tracking?.plan) return null
  const items = tracking.items ?? []
  const wins = items.flatMap((item) => (item.verdicts ?? []).filter((row) => row.verdict === '有效').map((row) => ({ item, row })))
  if (wins.length === 0) {
    return Section(ctx.E, {
      key: 'wins', title: '方案相关指标尚未超出正常波动', width: ctx.width,
      children: <Text key="t" dimColor wrap="wrap">{zh('血脂、血糖、炎症指标通常需要 1–3 个月才会变化。坚持执行、按时复测，就是在积累证据。')}</Text>,
    })
  }
  const inner = ctx.width - 4
  return Section(ctx.E, {
    key: 'wins', title: '朝目标方向、超出正常波动的变化', width: ctx.width, tone: C.good,
    children: wins.map(({ item, row }, index) => (
      <Box key={`win-${index}`} flexDirection="column" marginBottom={index < wins.length - 1 ? 1 : 0}>
        <Box flexDirection="row" gap={1}>
          <Text color={C.good}>✓</Text>
          <Text bold>{minus(`${row.marker} ${fmtAuto(row.baseline?.value)} → ${fmtAuto(row.followup?.value)} ${row.unit ?? ''}`)}</Text>
        </Box>
        <Text dimColor wrap="wrap">{fit(minus([`执行「${item.title}」期间`, row.change ? pct(row.change.pct) : '', '超出个体正常波动'].filter(Boolean).join(' · ')), inner * 3)
          + ((row.combined_with ?? []).length > 0 ? `；同期还在执行${(row.combined_with ?? []).map((name) => `「${name}」`).join('')}，无法区分各自的作用` : '')}</Text>
      </Box>
    )),
  })
}

