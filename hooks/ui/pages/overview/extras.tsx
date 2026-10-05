// The smaller cards of 总览: the note when some reads failed, 今日洞察 (life.ts InsightCard), 下一步 (overview.ts
// NextCard), 一起研究 (life.ts ScienceIntro) and the questions to put to Pi (the home's suggestion chips, and the
// ranked surfaces that point at the chat).

import type { Ctx, Node } from '../../types.ts'
import { C } from '../../kit.tsx'
import { insightSentence, isDiagnosisName, OUTBOX_ZH, SCIENCE_INTRO, scrubVisible } from '../../../core/ux/plain.ts'
import { obj, objects, recordConnected, str, numOf, type Journey, type NextAction } from './journey.ts'
import { nb, Callout, Caption, Card, Para, setSub, sub } from './ui.tsx'
import { inPane, isCovered, type Covered } from './words.ts'
import { REPORT_PROMPT } from './onboarding.tsx'

/** Some reads failed: the missing values are unknown, not "not measured". */
export function PartialNote(ctx: Ctx, journey: Journey): Node {
  const records = journey.records
  if (records.status !== 'partial') return null
  const missing = records.missing_reads.filter((name) => name && !isDiagnosisName(name)).map((name) => scrubVisible(name)).filter(Boolean)
  const errors = records.read_errors.map((line) => scrubVisible(line)).filter(Boolean)
  const text = `部分记录本次未读取到${errors.length > 0 ? `（${errors.slice(0, 2).join('；')}）` : ''}。`
    + (missing.length > 0 ? `未读取到的指标：${missing.slice(0, 6).join('、')}${missing.length > 6 ? ` 等 ${missing.length} 项` : ''}。` : '')
    + '这些指标并非未检测，请稍后点击上方「刷新」重试。'
  return Callout(ctx.E, text, 'warn', 'partial', ctx.width)
}

function shiftDay(day: string, by: number): string {
  const at = new Date(`${day.slice(0, 10)}T12:00:00Z`)
  at.setUTCDate(at.getUTCDate() + by)
  return at.toISOString().slice(0, 10)
}

/** Setup steps still open (onboarding.ts stepsLeft): none once there is a first record. */
export function stepsLeft(ctx: Ctx, journey: Journey): number {
  if (!journey.consent.accepted) return 3
  if (!journey.profile.complete) return 2
  if (recordConnected(journey.records.status) && journey.records.indicator_count > 0) return 0
  return sub(ctx, 'noReport') === '1' ? 0 : 1
}

/** 今日洞察: the wearable's last night and today next to the record, while the season is on. */
export function InsightCard(ctx: Ctx, journey: Journey, covered: Covered): Node {
  const slot = ctx.json<{ enabled?: boolean }>('codex/slot')
  if (slot?.enabled !== true) return null
  const indicators = ctx.json('indicators')
  let sleep: number | null = null
  let steps: number | null = null
  let sleepDay = ''
  let stepsDay = ''
  for (const group of objects(indicators?.groups)) {
    for (const row of objects(group.indicators)) {
      const value = numOf(obj(row.latest).value)
      if (str(row.source) !== 'device' || value == null) continue
      // By id, not by words: 心率变异性（睡眠） also says 睡眠.
      const id = str(row.id)
      const day = str(obj(row.latest).date).slice(0, 10)
      if (id === 'device:sleepDuration' || (!id.startsWith('device:') && /^每晚睡眠|^睡眠时长/.test(str(row.label_zh)))) { sleep = value; sleepDay = day }
      if (id === 'device:dailySteps' || (!id.startsWith('device:') && /步数/.test(str(row.label_zh)))) { steps = value; stepsDay = day }
    }
  }
  const concern = /不一定是好事/.test(journey.results.bioage.headline_zh ?? '')
  const lab = concern ? undefined : journey.changes.find((row) => row.ask_doctor && !isCovered(covered, row))
  const labNote = lab ? `${lab.label_zh}近期变化大于平常。睡眠或步数无法解释这项化验结果，建议复查时再关注。` : null
  // Name the day each value is from: an export that ended yesterday is not 今天.
  const today = journey.today || ctx.today
  const when = (day: string, todayWord: string, yesterdayWord: string) => !day || day === today ? todayWord : day === shiftDay(today, -1) ? yesterdayWord : `${Number(day.slice(5, 7))} 月 ${Number(day.slice(8, 10))} 日`
  const text = insightSentence({ sleepHours: sleep, steps, labNote, sleepWhen: when(sleepDay, '昨晚', '前一晚'), stepsWhen: when(stepsDay, '今天', '昨天') })
  if (!text) return null
  const { Text } = ctx.E
  return Card(ctx, { key: 'insight', title: '今日洞察', width: ctx.width, tone: C.teal, titleColor: C.teal, children: Para(ctx.E, text, ctx.width - 4, { key: 't' }) })
}

const SETUP_ACTIONS: readonly NextAction[] = ['consent', 'profile', 'records']

function openOnboarding(ctx: Ctx): void {
  setSub(ctx, 'step', '')
  setSub(ctx, 'onboarding', '1')
}

function ctaOf(ctx: Ctx, action: NextAction): { label: string; run: () => void } | null {
  switch (action) {
    case 'consent':
    case 'profile':
      return { label: '继续', run: () => openOnboarding(ctx) }
    case 'records':
      return { label: '请 Claude 读取我的报告', run: () => ctx.act.fill(REPORT_PROMPT) }
    case 'addons':
      return { label: '查看加测清单', run: () => setSub(ctx, 'addons', '1') }
    case 'plan':
      return { label: '起草方案', run: () => ctx.act.go('plan') }
    case 'review':
      return { label: '查看方案效果', run: () => ctx.act.go('plan') }
    case 'doctor':
      return { label: '查看这些指标', run: () => ctx.act.go('labs', { 'labs.filter': 'changed' }) }
    default:
      return null
  }
}

export function NextCard(ctx: Ctx, journey: Journey): Node {
  const next = journey.next
  if (!next.title_zh && !next.detail_zh) return null
  if (SETUP_ACTIONS.includes(next.action) && stepsLeft(ctx, journey) > 0) return null
  // 记录今天 is the 今天 card above: said once.
  if (next.action === 'checkin' && journey.plan.exists) return null
  const { Box, Text, Button } = ctx.E
  const cta = ctaOf(ctx, next.action)
  return Card(ctx, {
    key: 'next', title: '下一步', width: ctx.width, tone: C.accent,
    children: [
      Para(ctx.E, inPane(next.title_zh), ctx.width - 4, { key: 't', bold: true }),
      next.detail_zh && next.detail_zh !== next.title_zh ? Para(ctx.E, inPane(next.detail_zh), ctx.width - 4, { key: 'd', dim: true }) : null,
      cta ? <Box key="a" marginTop={1}><Button key="next-cta" variant="primary" label={cta.label} onPress={() => cta.run()} /></Box> : null,
    ],
  })
}

/** 一起研究: the research invitation, under the person's own results. */
export function ScienceIntro(ctx: Ctx): Node {
  const invite = ctx.json<{ show?: boolean; waiting_zh?: string }>('science/invite')
  if (invite?.show !== true) return null
  const { Box, Text, Button } = ctx.E
  return Card(ctx, {
    key: 'science', title: '一起研究', width: ctx.width, tone: C.violet, titleColor: C.violet,
    children: [
      Para(ctx.E, SCIENCE_INTRO, ctx.width - 4, { key: 't' }),
      Caption(ctx.E, invite.waiting_zh || OUTBOX_ZH, 'w', ctx.width - 4),
      <Box key="a" flexDirection="row" gap={1} marginTop={1}>
        <Button key="sci-join" label="加入" onPress={() => ctx.act.go('science')} />
        <Button key="sci-later" plain dimColor label="以后再说" onPress={() => { void ctx.act.post('science/invite', { decision: 'later' }, { reload: ['science/invite'], quiet: true }) }} />
      </Box>,
    ],
  })
}

/**
 * The questions to put to Pi: the home's suggestion chips (journey.suggestions), and what the ranked surfaces
 * point at the chat (a screening to ask about). Each press starts a turn with Pi in the person's words.
 */
export function AskPi(ctx: Ctx, journey: Journey): Node {
  const chat = journey.surfaceMore.filter((row) => row.surface === 'chat' && row.prompt_zh)
  if (journey.suggestions.length === 0 && chat.length === 0) return null
  const { Box, Text, Button } = ctx.E
  return Card(ctx, {
    key: 'askpi', title: '问 LongPi', width: ctx.width, note: '按一下，就在对话里问 Pi',
    children: [
      ...chat.map((row, i) => (
        <Box key={`more${i}`} flexDirection="column" marginBottom={1}>
          <Text key="t" bold>{row.title_zh}</Text>
          {row.detail_zh ? Para(ctx.E, row.detail_zh, ctx.width - 4, { key: 'd', dim: true }) : null}
          <Button key={`more-say-${row.id}`} plain label={`› ${row.prompt_zh}`} onPress={() => ctx.act.say(row.prompt_zh)} />
        </Box>
      )),
      <Box key="chips" flexDirection="column">
        {journey.suggestions.map((row) => <Button key={`sugg-${row.id}`} plain label={`› ${row.text_zh}`} onPress={() => ctx.act.say(row.text_zh)} />)}
      </Box>,
    ],
  })
}

type FlagRow = { id: string; label_zh: string; unit: string; latest: { date: string; value: number | null; text?: string } | null; range_flag?: 'low' | 'high'; range_zh?: string; source: string }

/**
 * 报告上标了箭头的: the latest checkup's values outside the range the report printed, so the page says what the
 * report says before any model result. Opens on 化验 with the row selected.
 */
export function FlaggedCard(ctx: Ctx): Node {
  const data = ctx.json<{ groups?: Array<{ indicators?: FlagRow[] }> }>('indicators?area=labs')
  const rows = (data?.groups ?? []).flatMap((group) => group.indicators ?? []).filter((row) => row.range_flag && row.source === 'checkup' && row.latest)
  if (rows.length === 0) return null
  const { Box, Text, Button } = ctx.E
  const shown = rows.slice(0, 8)
  const lines = shown.map((row) => {
    const value = row.latest?.text ?? (row.latest?.value != null ? String(row.latest.value) : '—')
    const range = /参考范围 ([^，]+)/.exec(row.range_zh ?? '')?.[1] ?? ''
    return (
      <Box key={`flag-${row.id}`} flexDirection="row" gap={1}>
        <Text color={C.warn}>{row.range_flag === 'high' ? '偏高' : '偏低'}</Text>
        <Button key={`flag-open-${row.id}`} plain label={row.label_zh} onPress={() => { ctx.act.go('labs'); ctx.act.detail(row.id) }} />
        <Text bold>{`${value}${row.unit ? ` ${row.unit}` : ''}`}</Text>
        {range ? <Text dimColor>{`参考 ${range}`}</Text> : null}
      </Box>
    )
  })
  return Card(ctx, {
    key: 'flagged', title: `报告上超出参考范围的 ${rows.length} 项`, width: ctx.width, tone: C.warn,
    note: `${rows[0]?.latest?.date ?? ''} 的体检`,
    children: [
      ...lines,
      rows.length > shown.length ? <Text key="more" dimColor>{`还有 ${rows.length - shown.length} 项，在「化验」页。`}</Text> : null,
      <Box key="ask" flexDirection="row" gap={2} marginTop={1}>
        <Button key="flag-ask" plain label="问 Pi：先从哪一项改起？" onPress={() => ctx.act.say('我报告上超出参考范围的这几项，先从哪一项改起？')} />
        <Button key="flag-labs" plain label="在化验页看 ›" onPress={() => ctx.act.go('labs')} />
      </Box>,
    ],
  })
}
