// The 总览 page (client/overview.ts and the page's header pieces): whose record is shown, the doctor-first card when
// there is one, today's insight, today's check-ins with the week, the two results side by side with every other
// result, the plan's graded sentences, the next step, the changes beyond normal fluctuation, the research invitation
// and the questions to put to Pi. While setup is not finished (or the banner's 开始 was pressed) the page draws
// the four setup steps instead; 先看看总览 shows the dashboard meanwhile.

import type { Ctx, Node, Page } from '../types.ts'
import { Failed, Loading, routeState } from '../kit.tsx'
import { briefRoute, CareCard } from './overview/care.tsx'
import { NotableChanges } from './overview/changes.tsx'
import { AskPi, FlaggedCard, InsightCard, NextCard, PartialNote, ScienceIntro } from './overview/extras.tsx'
import { journeyOf, trackingOf, type Stage } from './overview/journey.ts'
import { Onboarding } from './overview/onboarding.tsx'
import { AddPerson, DemoInvite, PeopleRow, PersonNotice } from './overview/people.tsx'
import { ResultsRow } from './overview/results.tsx'
import { TodayCard } from './overview/today.tsx'
import { coveredByCare } from './overview/words.ts'
import { PiCard } from '../journey/view.tsx'

const EARLY: readonly Stage[] = ['consent', 'profile', 'records']

/** Onboarding shows when the banner asked for it, or by itself before the first result unless put off. */
function onboardingShown(ctx: Ctx, stage: Stage): boolean {
  const asked = ctx.view.sub['overview.onboarding'] ?? ''
  if (asked === '1') return true
  if (asked === '0') return false
  return EARLY.includes(stage)
}

function draw(ctx: Ctx): Node {
  const { Box } = ctx.E
  const state = routeState(ctx, 'journey')
  if (state.kind === 'loading') return Loading(ctx.E)
  if (state.kind === 'error') return Failed(ctx.E, state.error, () => ctx.act.refresh())
  const journey = journeyOf(state.json)
  if (!journey) return Failed(ctx.E, '返回的不是 LongPi 的进度数据', () => ctx.act.refresh())
  const tracking = trackingOf(ctx.json('tracking'))
  const head: Node[] = [PeopleRow(ctx), AddPerson(ctx), PersonNotice(ctx), DemoInvite(ctx, journey.records.indicator_count === 0)]
  // A value that needs a doctor is shown before anything else, setup steps included.
  const urgent = journey.next.action !== 'doctor'
    ? journey.triage.findings.find((row) => (row.priority === 'emergency' || row.priority === 'must_surface') && row.status !== 'resolved')
    : undefined
  const urgentCard = urgent ? CareCard(ctx, { ...journey, next: { ...journey.next, action: 'doctor', title_zh: urgent.title_zh, detail_zh: urgent.text_zh } }) : null
  if (onboardingShown(ctx, journey.stage)) {
    return <Box flexDirection="column" gap={0}>{head}{urgentCard}{Onboarding(ctx, journey)}</Box>
  }
  const doctor = journey.next.action === 'doctor'
  const covered = coveredByCare(journey)
  return (
    <Box flexDirection="column">
      {head}
      <Box key="gap" height={1} />
      {PiCard(ctx)}
      {PartialNote(ctx, journey)}
      {doctor ? CareCard(ctx, journey) : urgentCard}
      {InsightCard(ctx, journey, covered)}
      {journey.plan.exists ? TodayCard(ctx, journey, tracking) : null}
      {FlaggedCard(ctx)}
      {ResultsRow(ctx, { journey, tracking, covered })}
      {doctor ? null : NextCard(ctx, journey)}
      {NotableChanges(ctx, journey, covered)}
      {doctor ? null : ScienceIntro(ctx)}
      {AskPi(ctx, journey)}
    </Box>
  )
}

/** What 总览 reads: the dashboard's routes, the setup's (privacy copy, reminder) only while it shows, the
 * wearable values only while 今日洞察 can show, and an open doctor brief. */
export const page: Page = {
  tab: 'overview',
  label: '总览',
  routes: (view, json) => {
    const brief = briefRoute(view.sub)
    const journey = json?.('journey') ?? null
    const stage = typeof journey?.stage === 'string' ? journey.stage as Stage : 'consent'
    const asked = view.sub['overview.onboarding'] ?? ''
    const setup = asked === '1' || (asked !== '0' && EARLY.includes(stage)) || journey == null
    const insight = json?.<{ enabled?: boolean }>('codex/slot')?.enabled === true
    return [
      'journey', 'game', 'tracking', 'people', 'surfaces', 'triage', 'codex/slot', 'science/invite', 'indicators?area=labs',
      ...(setup ? ['privacy', 'followup'] : []),
      ...(insight ? ['indicators'] : []),
      ...(brief ? [brief] : []),
    ]
  },
  draw,
}
