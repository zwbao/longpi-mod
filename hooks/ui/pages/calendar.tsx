// The 日程 page (client/life.ts CalendarTab and Timeline): what is on the calendar (confirmed visits and the
// plan's retest dates), what LongPi suggests adding (added only once the person confirms), the reminders
// coming up (today's check-ins, the next retest reminder, the weekly summary), the timeline of checkups,
// wearable days and life events, and the calendar file.

import type { RenderElement } from 'claude-code'

import type { Ctx, Node, Page } from '../types.ts'
import { C, Loading, pad, routeState, Section, zh } from '../kit.tsx'
import { chineseDate, fmtAuto, plainUnits, whenText } from './plan/format.ts'
import { todayCounts } from './plan/shared.tsx'
import type { FollowupResponse, Journey, ScheduleResponse, ScheduleRow } from './plan/types.ts'

const DATE_COLS = 16

/** The questions the web suggested for a visit (ux/plain.ts suggestedQuestions). */
function suggestedQuestions(visit: string | null, today: string): string[] {
  const visitText = visit ? `下次 ${chineseDate(visit, today)}就诊时，我应该询问哪些问题？` : '下次就诊时，我应该询问哪些问题？'
  return ['与上次相比，哪些项目有变化？', visitText, '我现在应优先做哪一件？']
}

function confirmRow(ctx: Ctx, row: { date: string; title_zh: string; brief_zh: string; questions_zh: string[]; kind: string; id?: string }): void {
  void ctx.act.post('schedule', { ...row, confirm: true }, { reload: ['schedule'], done: '已加入日程。' })
}

/** A date column that writes each day once, then the row. */
function DatedRow(ctx: Ctx, key: string, date: string, showDate: boolean, body: Node[]): RenderElement {
  const { Box, Text } = ctx.E
  return (
    <Box key={key} flexDirection="row">
      <Text color={C.accent}>{pad(showDate ? chineseDate(date, ctx.today) || date : '', DATE_COLS)}</Text>
      <Box flexDirection="column" width={Math.max(10, ctx.width - 4 - DATE_COLS)}>
        {body.filter((kid): kid is RenderElement => kid !== null)}
      </Box>
    </Box>
  )
}

/** 已安排的日程: confirmed events and the plan's retest dates; the empty state says what will go here. */
function Scheduled(ctx: Ctx, journey: Journey, events: ScheduleRow[], note: string): RenderElement {
  const { Text } = ctx.E
  // A retest already put on the calendar shows once, as the event.
  const retests = journey.reminders.filter((row) => row.kind === 'retest' && row.date && !events.some((event) => event.date === row.date && event.title_zh === row.text_zh))
  if (events.length === 0 && retests.length === 0) {
    return Section(ctx.E, {
      key: 'scheduled', title: '暂无已安排的日程', width: ctx.width,
      children: [
        <Text key="t" dimColor wrap="wrap">{zh('复查、就诊和待办事项。LongPi 的建议需经你确认后才会加入日程。')}</Text>,
        note ? <Text key="note" dimColor>{note}</Text> : null,
      ],
    })
  }
  const rows = [
    ...events.map((row) => ({ date: row.date, key: `ev-${row.id}`, body: [
      <Text key="t" bold wrap="wrap">{zh(row.title_zh)}</Text>,
      row.brief_zh ? <Text key="b" wrap="wrap">{zh(row.brief_zh)}</Text> : null,
      row.questions_zh.length > 0 ? <Text key="q" dimColor wrap="wrap">{zh(`可以问：${row.questions_zh.join('；')}`)}</Text> : null,
    ] })),
    ...retests.map((row, i) => ({ date: row.date as string, key: `rt-${i}`, body: [<Text key="t" bold wrap="wrap">{zh(row.text_zh)}</Text>] })),
  ].sort((a, b) => a.date.localeCompare(b.date))
  const upcoming = rows.filter((row) => row.date >= journey.today).length
  return Section(ctx.E, {
    key: 'scheduled', title: '已安排的日程', note: upcoming > 0 ? `接下来 ${upcoming} 件` : '', width: ctx.width,
    children: [
      ...rows.map((row, i) => DatedRow(ctx, row.key, row.date, i === 0 || rows[i - 1]?.date !== row.date, row.body)),
      note ? <Text key="note" dimColor>{note}</Text> : null,
    ],
  })
}

/** 建议日程（未添加）: suggestions to confirm; with none, the first retest date as one. */
function Suggested(ctx: Ctx, journey: Journey, suggestions: ScheduleRow[], events: ScheduleRow[], note: string): Node {
  const { Box, Text, Button } = ctx.E
  const retests = journey.reminders.filter((row) => row.kind === 'retest' && row.date && !events.some((event) => event.date === row.date))
  const fallback = suggestions.length === 0 ? retests[0] : undefined
  if (suggestions.length === 0 && !fallback) return null
  const skipped = fallback ? ctx.view.sub['calendar.skip'] === fallback.date : false
  const rows = suggestions.length > 0
    ? suggestions.map((row) => DatedRow(ctx, `sg-${row.id}`, row.date, true, [
        <Box key="r" flexDirection="row" justifyContent="space-between">
          <Text wrap="wrap">{zh(row.title_zh)}</Text>
          <Button key={`sched-add-${row.id}`} label="加入日程" onPress={() => confirmRow(ctx, row)} />
        </Box>,
      ]))
    : fallback
      ? [DatedRow(ctx, 'sg-retest', fallback.date as string, true, [
          <Text key="t" wrap="wrap">{zh(fallback.text_zh)}</Text>,
          <Text key="c" dimColor wrap="wrap">请携带上次的简报和想咨询的问题。</Text>,
          skipped
            ? <Text key="skip" dimColor>暂不添加。</Text>
            : (
                <Box key="b" flexDirection="row" gap={1}>
                  <Button key="sched-add-retest" label="加入日程" onPress={() => confirmRow(ctx, {
                    date: fallback.date as string, title_zh: fallback.text_zh, brief_zh: '携带简报和问题。',
                    questions_zh: suggestedQuestions(fallback.date, journey.today).slice(0, 2), kind: 'retest',
                  })} />
                  <Button key="sched-skip-retest" plain dimColor label="暂不添加" onPress={() => ctx.act.setSub('calendar.skip', fallback.date as string)} />
                </Box>
              ),
        ])]
      : []
  return Section(ctx.E, {
    key: 'suggested', title: '建议日程（未添加）', width: ctx.width, tone: C.accent,
    children: [...rows, note ? <Text key="note" dimColor>{note}</Text> : null],
  })
}

const WEEKDAYS = ['', '每周一', '每周二', '每周三', '每周四', '每周五', '每周六', '每周日']

/** 提醒: today's check-ins, then the next reminders the follow-up will send, and the one switch. */
function Reminders(ctx: Ctx, journey: Journey, followup: FollowupResponse | null): RenderElement {
  const { Box, Text, Button } = ctx.E
  const kids: Node[] = []
  if (journey.plan.exists && journey.plan.checkin_items.length > 0) {
    const counts = todayCounts(ctx, journey)
    const left = counts.total - counts.answered
    kids.push(
      <Box key="today" flexDirection="row" justifyContent="space-between">
        <Text color={left === 0 ? C.good : undefined}>{left > 0 ? `今天还有 ${left} 项待打卡` : counts.done === counts.total ? `今天的 ${counts.total} 项都完成了。` : `今天的 ${counts.total} 项都记下了，完成 ${counts.done} 项。`}</Text>
        <Button key="go-checkin" plain label={left === 0 ? '看方案' : '去打卡'} onPress={() => ctx.act.go('plan')} />
      </Box>,
    )
  }
  if (!followup) {
    kids.push(<Text key="fu-wait" dimColor>正在读取提醒设置…</Text>)
  } else {
    const settings = followup.settings
    const hasChannel = (settings.desktop && followup.platform_desktop) || settings.webhook != null
    const parts: Array<[string, string]> = ([['下次打卡', followup.next.checkin], ['下次复测', followup.next.retest], ['下次小结', followup.next.weekly]] as Array<[string, string | null]>)
      .filter((row): row is [string, string] => Boolean(row[1]))
      .map(([label, iso]) => [label, whenText(iso, journey.today)])
    if (settings.enabled) {
      if (parts.length === 0) kids.push(<Text key="fu-none" dimColor>近期没有要发的提醒。</Text>)
      for (const [label, when] of parts) {
        kids.push(
          <Box key={`fu-${label}`} flexDirection="row">
            <Text dimColor>{pad(label, DATE_COLS)}</Text>
            <Text>{when}</Text>
          </Box>,
        )
      }
      const channels = [settings.desktop && followup.platform_desktop ? '桌面通知' : '', settings.webhook ? '手机（Webhook）' : ''].filter(Boolean)
      const weekly = settings.weekly ? `；${WEEKDAYS[settings.weekly.day] ?? ''} ${settings.weekly.time} 发每周小结` : ''
      kids.push(<Text key="fu-cap" dimColor wrap="wrap">{hasChannel
        ? `当天有未完成的打卡时，${settings.checkin_time} 通过${channels.join('和')}提醒；复测到期当天 ${settings.retest_time} 提醒${weekly}；${settings.detail === 'minimal' ? '不含健康数值' : '含方案项目名称和执行率'}。`
        : '已开启，但暂无可用渠道：请开启桌面通知或填写 Webhook。'}</Text>)
    } else {
      kids.push(<Text key="fu-off" dimColor wrap="wrap">{zh(followup.silence_zh || '关闭时不会发送任何提醒。开启后按下面的时间提醒打卡、到期复测和每周小结。')}</Text>)
    }
    kids.push(
      <Box key="fu-actions" flexDirection="row" gap={1} flexWrap="wrap">
        <Button key="fu-toggle" variant={settings.enabled ? undefined : 'primary'} label={settings.enabled ? '关闭提醒' : `每晚 ${settings.checkin_time} 提醒我打卡`} onPress={() => {
          const body = settings.enabled ? { enabled: false } : { enabled: true, ...(hasChannel ? {} : { desktop: true }) }
          void ctx.act.post('followup', body, { reload: ['followup'], done: settings.enabled ? '提醒已关闭。' : '打卡提醒已开启。' })
        }} />
        <Button key="fu-settings" plain dimColor label="更多提醒设置" onPress={() => ctx.act.go('settings')} />
      </Box>,
    )
  }
  return Section(ctx.E, { key: 'reminders', title: '提醒', note: followup?.settings.enabled ? '已开启' : '未开启', width: ctx.width, children: kids })
}

type TimelineRow = { date: string; kind: 'lab' | 'wearable' | 'life'; title_zh: string; detail_zh: string }

/** The retest visits, one row a day: five markers due the same day are one visit. */
function visits(journey: Journey): TimelineRow[] {
  const byDay = new Map<string, string[]>()
  for (const row of journey.reminders) {
    if (row.kind !== 'retest' || !row.date) continue
    byDay.set(row.date, [...(byDay.get(row.date) ?? []), row.text_zh.replace(/^复测\s*/, '')])
  }
  return [...byDay.entries()].map(([date, names]) => ({
    date, kind: 'life' as const, title_zh: '看医生',
    detail_zh: `复测${names.slice(0, 3).join('、')}${names.length > 3 ? `等 ${names.length} 项` : ''}`,
  }))
}

/** Checkups, the latest wearable days and life events in date order (ux/plain.ts buildTimeline). */
function Timeline(ctx: Ctx, journey: Journey): RenderElement {
  const { Text } = ctx.E
  const indicators = ctx.json<{ groups?: Array<{ indicators?: Array<{ label_zh?: string; source?: string; unit?: string; latest?: { date?: string; value?: number | null; text?: string } | null }> }> }>('indicators')
  const wearables: TimelineRow[] = []
  for (const group of indicators?.groups ?? []) {
    for (const row of group.indicators ?? []) {
      if (row.source !== 'device' || !row.latest?.date || !row.label_zh) continue
      if (!/睡眠|步数/.test(row.label_zh)) continue
      const unit = plainUnits(row.unit ?? '')
      const number = row.latest.text ?? (row.latest.value == null ? '' : fmtAuto(row.latest.value))
      const value = !number || !unit ? number : unit.startsWith('%') ? `${number}${unit}` : `${number} ${unit}`
      wearables.push({ date: row.latest.date, kind: 'wearable', title_zh: row.label_zh, detail_zh: value })
    }
  }
  const checkups = [...new Set((journey.changes ?? []).flatMap((row) => [row.compare?.from_date, row.compare?.to_date].filter((date): date is string => Boolean(date))))]
  const items: TimelineRow[] = [
    ...checkups.map((date) => ({ date, kind: 'lab' as const, title_zh: '体检', detail_zh: '化验' })),
    ...wearables.slice(0, 6),
    ...visits(journey),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const intro = '将化验、手环数据和生活事件按时间排列，便于发现关联，例如复查前曾经生病。'
  if (items.length === 0) {
    return Section(ctx.E, { key: 'timeline', title: '暂无可显示的事件', width: ctx.width, children: <Text key="t" dimColor wrap="wrap">{zh(intro)}</Text> })
  }
  const shown = items.slice(-8)
  const color = { lab: C.violet, wearable: C.teal, life: C.accent }
  return Section(ctx.E, {
    key: 'timeline', title: '时间线', width: ctx.width,
    children: [
      <Text key="intro" dimColor wrap="wrap">{zh(intro)}</Text>,
      ...shown.map((item, i) => DatedRow(ctx, `tl-${i}`, item.date, i === 0 || shown[i - 1]?.date !== item.date, [
        <Text key="t" wrap="wrap"><Text color={color[item.kind]}>{item.title_zh}</Text>{` · ${item.detail_zh.replace(/\s+([（【「])/g, '$1').replace(/([）】」])\s+/g, '$1')}`}</Text>,
      ])),
    ],
  })
}

/** 加入日历: the calendar file holds the retest dates and the daily check-in reminder. */
function CalendarFile(ctx: Ctx): RenderElement {
  const { Text, Button } = ctx.E
  return Section(ctx.E, {
    key: 'ics', title: '加入日历', width: ctx.width,
    children: [
      <Text key="t" dimColor wrap="wrap">日历文件包含复测日期和每天的打卡提醒，可以导入手机或电脑自带的日历。</Text>,
      <Text key="t2" dimColor wrap="wrap">{zh('导出的文件留在这台电脑上，LongPi 不会发给任何人。')}</Text>,
      <Button key="ics-export" plain label="导出到日历" onPress={() => void ctx.act.save('calendar.ics', 'LongPi 日程.ics')} />,
    ],
  })
}

function draw(ctx: Ctx): Node {
  const { Box } = ctx.E
  const journey = ctx.json<Journey>('journey')
  if (!journey) return Loading(ctx.E)
  const schedule = routeState(ctx, 'schedule')
  const data = schedule.kind === 'ok' ? (schedule.json as ScheduleResponse) : null
  const note = schedule.kind === 'error' ? `未能读取日程：${schedule.error}` : ''
  const followup = ctx.json<FollowupResponse>('followup')
  return (
    <Box flexDirection="column">
      {Scheduled(ctx, journey, data?.events ?? [], note)}
      {Suggested(ctx, journey, data?.suggestions ?? [], data?.events ?? [], '')}
      {Reminders(ctx, journey, followup)}
      {Timeline(ctx, journey)}
      {CalendarFile(ctx)}
    </Box>
  )
}

export const page: Page = {
  tab: 'calendar',
  label: '日程',
  routes: () => ['journey', 'schedule', 'followup', 'indicators'],
  draw,
}
