// The plan's head and timeline, and one card per item: its category, its verdict, the 12-week strip, every
// marker's verdict with the reason, and (opened) what to do, how often, the target, the markers it aims to
// move, the retest date and the trial evidence (client/plan.ts PlanSection, ItemRow; charts.ts Timeline).

import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from '../../types.ts'
import { C, cells, fit, pad, Section, Tag, zh } from '../../kit.tsx'
import { chineseDate, datesZh, dayNumber, fmtAuto, isoOfDay, minus, monthLabel, pct, plainUnits } from './format.ts'
import { cellsOf, checkStateOf, Fold, isOn, Strip, VerdictTag } from './shared.tsx'
import { retestDates } from './today.tsx'
import type { Item, Journey, PlanItemRaw, Tracking } from './types.ts'

/** Under 28 days nothing can be judged yet: the list says so once, so the rows carry no per-item 记录不足. */
export const YOUNG_DAYS = 28

const SOURCE_ZH: Record<string, string> = { chat: '在对话中制定', file: '来自你提供的方案', board: '在方案页采用', analysis: '来自深度分析' }

const COMPARISON_ZH: Record<string, string> = { consistent: '与试验平均一致', smaller: '小于试验平均', larger: '大于试验平均', opposite: '方向与试验相反' }

const METRIC_ZH: Record<string, string> = { dailySteps: '每日步数', dailyTotalSleepTime: '每晚睡眠' }
const UNIT_ZH: Record<string, string> = { count: '步', hours: '小时' }

export function planDays(journey: Journey, tracking: Tracking | null): number | null {
  const items = tracking?.items ?? []
  return journey.plan.days ?? (items.length > 0 ? Math.max(...items.map((item) => item.days ?? 0)) : null)
}

// --- the timeline -------------------------------------------------------------------------------------

/** The plan's name and version, where it came from, and when each item runs. */
export function TimelineCard(ctx: Ctx, journey: Journey, tracking: Tracking | null, failed: boolean): RenderElement {
  const { Text } = ctx.E
  const plan = tracking?.plan
  const items = tracking?.items ?? []
  const days = planDays(journey, tracking)
  const source = plan?.source ? SOURCE_ZH[plan.source] ?? '' : ''
  const started = journey.plan.started ?? items[0]?.start ?? null
  const facts = [source, started ? `${chineseDate(started, journey.today)}开始` : '', days != null ? (days === 0 ? '今天开始' : `今天是第 ${days} 天`) : '', `${items.length || journey.plan.items} 项`].filter(Boolean).join(' · ')
  const versions = (tracking?.versions ?? []).filter((row) => row.version !== plan?.version)
  return Section(ctx.E, {
    key: 'timeline',
    title: datesZh(plan?.title || journey.plan.title || '时间线', journey.today),
    note: `第 ${plan?.version ?? journey.plan.version ?? 1} 版`,
    width: ctx.width,
    children: [
      <Text key="facts" dimColor wrap="wrap">{zh(facts)}</Text>,
      items.length > 0
        ? Timeline(ctx, items, [...new Set((tracking?.bioage?.points ?? []).map((row) => row.date))], journey.today)
        : <Text key="none" dimColor>{failed ? '未读取到方案项目。' : '方案中暂无项目。'}</Text>,
      versions.length > 0 ? Fold(ctx, 'plan.versions', '以前的版本', 'fold-versions', `${versions.length} 个`) : null,
      ...(versions.length > 0 && isOn(ctx, 'plan.versions')
        ? versions.map((row) => <Text key={`ver-${row.version}`} dimColor>{`  第 ${row.version} 版 · ${row.title} · ${row.items} 项 · ${chineseDate(row.saved_at.slice(0, 10), journey.today)}保存`}</Text>)
        : []),
    ],
  })
}

/** One sentence when every item runs the same days; otherwise a bar per item against the months. */
function Timeline(ctx: Ctx, items: Item[], checkups: string[], today: string): RenderElement {
  const { Box, Text } = ctx.E
  const first = items[0] as Item
  if (items.every((item) => item.start === first.start && (item.end ?? null) === (first.end ?? null))) {
    const count = items.length === 1 ? '这 1 项' : `${items.length} 项都`
    return <Text key="tl" wrap="wrap">{zh(`${count}从 ${chineseDate(first.start, today)}开始${first.end ? `，到 ${chineseDate(first.end, today)}结束` : ''}。`)}</Text>
  }
  const inner = ctx.width - 4
  const labelWidth = Math.min(24, Math.max(10, Math.floor(inner * 0.3)))
  const chart = Math.max(10, inner - labelWidth - 1)
  const t = dayNumber(today)
  const starts = items.map((item) => dayNumber(item.start))
  const ends = items.map((item) => (item.end ? dayNumber(item.end) : t))
  const d0 = Math.min(t, ...starts)
  const inWindow = checkups.map(dayNumber).filter((day) => day >= d0)
  const d1 = Math.max(t + 84, ...ends, ...inWindow) + 4
  const x = (day: number) => Math.max(0, Math.min(chart - 1, Math.round(((day - d0) / Math.max(1, d1 - d0)) * (chart - 1))))
  // The head: months, the checkup days (◆) and 今天, without one label over another.
  const head = Array.from({ length: chart }, () => ' ')
  const put = (at: number, text: string) => {
    if (at < 0 || at + cells(text) > chart) return false
    for (let i = at; i < at + cells(text); i += 1) if (head[i] !== ' ') return false
    let i = at
    for (const ch of text) {
      head[i] = ch
      if (cells(ch) === 2) head[i + 1] = ''
      i += cells(ch)
    }
    return true
  }
  put(x(t), '今天')
  for (const day of inWindow) put(x(day), '◆')
  for (let day = d0 + 1; day <= d1; day += 1) {
    const iso = isoOfDay(day)
    if (iso.endsWith('-01')) put(x(day), monthLabel(iso, today))
  }
  const anyAhead = items.some((item) => !item.end || dayNumber(item.end) > t)
  const rows = items.map((item) => {
    const s = x(dayNumber(item.start))
    const endDay = item.end ? dayNumber(item.end) : d1
    const done = endDay < t
    const nowX = x(Math.min(endDay, t))
    const aheadEnd = done ? -1 : x(endDay)
    const past = '█'.repeat(Math.max(1, nowX - s + 1))
    const ahead = aheadEnd > nowX ? '░'.repeat(aheadEnd - nowX) : ''
    return (
      <Box key={`tl-${item.id}`} flexDirection="row">
        <Text>{pad(item.title, labelWidth)}</Text>
        <Text> </Text>
        <Text>{' '.repeat(s)}</Text>
        <Text color={done ? C.dim : C.accent}>{past}</Text>
        <Text dimColor>{ahead}</Text>
      </Box>
    )
  })
  return (
    <Box key="tl" flexDirection="column">
      <Text dimColor>{`${' '.repeat(labelWidth + 1)}${head.join('')}`}</Text>
      {rows}
      <Text dimColor>{['█ 已进行', anyAhead ? '░ 接下来' : '', inWindow.length > 0 ? '◆ 体检日' : ''].filter(Boolean).join('   ')}</Text>
    </Box>
  )
}

// --- the items ----------------------------------------------------------------------------------------

/** Check-in items not running today (not started, or ended) get no answer, as the server leaves them out. */
function checkinFoot(item: Item, today: string): string | null {
  if (item.start > today) return `${chineseDate(item.start, today)}开始，届时再打卡`
  if (item.end && item.end < today) return '已结束，无需打卡'
  return null
}

function targetText(target: NonNullable<PlanItemRaw['target']>): string {
  const op = target.op === '<=' ? '≤' : '≥'
  return `手环自动记录：${METRIC_ZH[target.metric] ?? plainUnits(target.metric)}${target.value != null ? ` ${op} ${fmtAuto(target.value)} ${UNIT_ZH[target.unit ?? ''] ?? target.unit ?? ''}` : ''}`.trim()
}

function ItemCard(ctx: Ctx, journey: Journey, item: Item, raw: PlanItemRaw | undefined, young: boolean, index: number): RenderElement {
  const { Box, Text, Button } = ctx.E
  const today = journey.today
  const inner = ctx.width - 4
  const adherence = item.adherence ?? {}
  const source = raw?.mirobody ? 'mirobody' : raw?.target ? 'wearable' : 'checkin'
  const idle = source === 'checkin' ? checkinFoot(item, today) : null
  const checkable = journey.plan.checkin_items.some((row) => row.id === item.id)
  const state = checkStateOf(ctx, journey, item.id)
  const rate = adherence.rate
  const known = rate != null && adherence.level !== 'unknown'
  const verdicts = (item.verdicts ?? []).filter((row) => !(young && row.verdict === '无法判断' && /太早/.test(row.reason_zh ?? '')))
  const open = ctx.view.sub['plan.item'] === item.id
  const todayText = idle
    ?? (source === 'checkin'
      ? checkable ? (state === true ? '今天：✓ 已完成' : state === false ? '今天：未完成' : '今天：还没打卡') : '今天无需打卡'
      : source === 'wearable' ? '手环自动记录' : '服用情况按用药记录自动计入')
  const todayColor = state === true ? C.good : undefined
  const calendar = adherence.calendar ?? []
  const shortDays = Math.min(28, Math.floor((inner - 2) / 7) * 7)
  const fullDays = Math.min(calendar.length, 84)
  const kids: Node[] = [
    <Text key="title" bold={open} wrap="wrap">{zh(item.title)}</Text>,
    <Box key="tags" flexDirection="row" justifyContent="space-between">
      <Box flexDirection="row" gap={1} flexWrap="wrap">
        {item.category_zh ? Tag(ctx.E, item.category_zh, C.teal, 'cat') : null}
        {item.headline && !(young && item.headline === '无法判断') ? VerdictTag(ctx.E, item.headline, 'headline') : null}
        {known ? <Text key="rate" dimColor>{`近 12 周执行 ${Math.round((rate as number) * 100)}%`}</Text> : null}
        <Text key="today" color={todayColor} dimColor={!todayColor}>{todayText}</Text>
      </Box>
      <Button key={`item-more-${item.id}`} plain dimColor={!open} label={open ? '收起' : '详情'} onPress={() => ctx.act.setSub('plan.item', open ? '' : item.id)} />
    </Box>,
  ]
  if (known && calendar.length > 0 && !open) kids.push(Strip(ctx.E, cellsOf(calendar, shortDays, today, checkable ? state : undefined, item.start), 'strip'))
  if (!known && !young) kids.push(<Text key="noadh" dimColor wrap="wrap">{zh(`近 12 周执行：记录不足${adherence.note_zh ? `。${adherence.note_zh}` : ''}`)}</Text>)
  verdicts.forEach((row, i) => {
    kids.push(
      <Box key={`v${i}`} flexDirection="row" gap={1} flexWrap="wrap">
        {VerdictTag(ctx.E, row.verdict, 'tag')}
        <Text key="m" bold>{row.marker}</Text>
        {row.baseline && row.followup
          ? <Text key="n">{minus(`${fmtAuto(row.baseline.value)} → ${fmtAuto(row.followup.value)} ${plainUnits(row.unit ?? '')}${row.change ? `（${pct(row.change.pct)}）` : ''}`)}</Text>
          : null}
      </Box>,
    )
    if (row.reason_zh) kids.push(<Text key={`vr${i}`} dimColor wrap="wrap">{zh(`  ${datesZh(row.reason_zh, today)}`)}</Text>)
  })
  if (open) {
    const what: Array<[string, string]> = []
    if (raw?.detail && raw.detail !== item.title) what.push(['做什么', plainUnits(raw.detail)])
    if (raw?.frequency) what.push(['多久一次', raw.frequency])
    if (raw?.target) what.push(['目标', targetText(raw.target)])
    if ((raw?.markers ?? []).length > 0) what.push(['想改善的指标', (raw?.markers ?? []).join('、')])
    what.push(['时间', `${chineseDate(item.start, today)}起，第 ${item.days ?? 0} 天${item.end ? `，到 ${chineseDate(item.end, today)}结束` : ''}`])
    const labelWidth = 14
    for (const [label, text] of what) {
      kids.push(
        <Box key={`w-${label}`} flexDirection="row">
          <Text dimColor>{pad(label, labelWidth)}</Text>
          <Box width={Math.max(10, inner - labelWidth)}><Text wrap="wrap">{zh(text)}</Text></Box>
        </Box>,
      )
    }
    if (calendar.length > 0) {
      kids.push(<Text key="adh-h" dimColor>{`${item.start > isoOfDay(dayNumber(today) - 83) ? '开始以来' : '近 12 周'}${known ? `：执行 ${Math.round((rate as number) * 100)}%` : ''}${adherence.done_days != null ? `，完成 ${adherence.done_days} 天` : ''}`}</Text>)
      const cellsAll = cellsOf(calendar, fullDays, today, checkable ? state : undefined, item.start)
      const per = cellsAll.length <= inner ? cellsAll.length : Math.ceil(cellsAll.length / 2)
      for (let at = 0, n = 0; at < cellsAll.length; at += per, n += 1) kids.push(Strip(ctx.E, cellsAll.slice(at, at + per), `strip-full-${n}`))
      kids.push(<Text key="legend" dimColor>■ 完成  □ 未完成  · 没有记录  ▣ 今天</Text>)
      if (adherence.note_zh) kids.push(<Text key="adh-note" dimColor wrap="wrap">{zh(adherence.note_zh)}</Text>)
    }
    // Every marker this item aims to move, with the retest date and what trials found on average.
    for (const [i, row] of (item.verdicts ?? []).entries()) {
      const extra: string[] = []
      if (row.next_retest) extra.push(`下次复测：${chineseDate(row.next_retest, today)}之后`)
      if ((row.confounders ?? []).length > 0) extra.push(`同期可能的干扰：${(row.confounders ?? []).join('、')}`)
      if (young && row.verdict === '无法判断' && /太早/.test(row.reason_zh ?? '')) extra.push(datesZh(row.reason_zh ?? '', today))
      const expected = row.expected ?? []
      if (extra.length === 0 && expected.length === 0) continue
      kids.push(<Text key={`dv${i}`} bold>{row.marker}</Text>)
      for (const [j, text] of extra.entries()) kids.push(<Text key={`dv${i}-${j}`} dimColor wrap="wrap">{zh(`  ${text}`)}</Text>)
      if (expected.length > 0) {
        kids.push(<Text key={`ex${i}-h`} dimColor>  试验里平均能改变多少</Text>)
        for (const line of expected) {
          const compare = line.comparison && line.comparison !== 'not_comparable' ? `你的变化${COMPARISON_ZH[line.comparison] ?? ''}。` : ''
          kids.push(<Text key={`ex${i}-${line.id}`} dimColor wrap="wrap">{zh(`  ${line.text_zh}${compare} doi:${line.doi}`)}</Text>)
        }
      }
    }
  }
  return (
    <Box key={`item-${item.id}`} flexDirection="column" marginTop={index > 0 ? 1 : 0}>
      {kids.filter((kid): kid is RenderElement => kid !== null)}
    </Box>
  )
}

/** 方案项目: every item, the young plan's one caption, check-ins answered in 今天 above. */
export function ItemsSection(ctx: Ctx, journey: Journey, tracking: Tracking | null): Node {
  const { Text } = ctx.E
  const items = tracking?.items ?? []
  if (items.length === 0) return null
  const plan = tracking?.plan
  const days = planDays(journey, tracking)
  const young = days != null && days < YOUNG_DAYS
  const firstRetest = retestDates(tracking).find((row) => row.date > journey.today)?.date ?? null
  return Section(ctx.E, {
    key: 'items',
    title: '方案项目',
    note: fit('打卡在上方「今天」里，误操作可撤销', Math.max(8, ctx.width - 16)),
    width: ctx.width,
    children: [
      young
        ? <Text key="young" color={C.warn} wrap="wrap">{zh(`${days ? `方案开始仅 ${days} 天` : '方案今天刚开始'}。执行率和指标变化需满 ${YOUNG_DAYS} 天才能判断${firstRetest ? `，请于${chineseDate(firstRetest, journey.today)}之后查看` : ''}。`)}</Text>
        : null,
      ...items.map((item, index) => ItemCard(ctx, journey, item, plan?.items.find((raw) => raw.id === item.id), young, index)),
    ],
  })
}
