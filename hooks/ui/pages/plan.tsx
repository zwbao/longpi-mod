// The 方案 page: the person's own plan next to their record (client/plan.ts PlanTab). Today's check-ins first,
// one key each; how well the plan is followed and when to retest; the changes beyond normal fluctuation; the
// timeline; one card per item with its verdicts; each target marker against its band; the goals; the next
// steps. With no plan yet, or when the person asks for one, the draft to edit and adopt.

import type { Ctx, Node, Page } from '../types.ts'
import { C, Loading, routeState, zh } from '../kit.tsx'
import { DraftCard, PlanStart } from './plan/draft.tsx'
import { ItemsSection, TimelineCard } from './plan/items.tsx'
import { Goals, Markers, NextSteps } from './plan/markers.tsx'
import { Tiles, TodayBlock, Wins } from './plan/today.tsx'
import type { Journey, Tracking } from './plan/types.ts'

function draw(ctx: Ctx): Node {
  const { Box, Text, Button } = ctx.E
  const journey = ctx.json<Journey>('journey')
  if (!journey) return Loading(ctx.E)
  const state = routeState(ctx, 'tracking')
  const tracking = state.kind === 'ok' ? (state.json as unknown as Tracking) : null
  const hasPlan = journey.plan.exists || Boolean(tracking?.plan)

  // No plan yet: the draft, and the way to bring one's own.
  if (!hasPlan) {
    return (
      <Box flexDirection="column">
        {DraftCard(ctx, journey, false)}
        {PlanStart(ctx, journey)}
      </Box>
    )
  }
  // A new draft, asked for while a plan runs: adopting it saves the next version.
  if (ctx.view.sub['plan.draft'] === '1') {
    return <Box flexDirection="column">{DraftCard(ctx, journey, true)}</Box>
  }

  const failed = state.kind === 'error'
  return (
    <Box flexDirection="column">
      {TodayBlock(ctx, journey, tracking)}
      {failed
        ? (
            <Box key="failed" flexDirection="row" gap={1} marginBottom={1}>
              <Text color={C.warn} wrap="wrap">{zh(`未能读取方案的执行记录和评判：${state.error}`)}</Text>
              <Button key="retry-tracking" plain label="重试" onPress={() => ctx.act.load(['tracking'], true)} />
            </Box>
          )
        : null}
      {state.kind === 'loading' ? <Text key="wait" dimColor>正在读取方案的执行记录和评判…</Text> : null}
      {state.kind === 'loading' ? null : Tiles(ctx, journey, tracking, failed)}
      {Wins(ctx, tracking)}
      {state.kind === 'loading' ? null : TimelineCard(ctx, journey, tracking, failed)}
      {ItemsSection(ctx, journey, tracking)}
      {Markers(ctx, tracking, journey.today)}
      {Goals(ctx, tracking, journey.today)}
      {NextSteps(ctx, tracking, journey.today)}
      <Box key="plan-actions" flexDirection="row" gap={1} flexWrap="wrap">
        <Button key="plan-adjust" label="让 Pi 帮我调整方案" onPress={() => ctx.act.say('我想调整一下现在的方案')} />
        <Button key="plan-new-draft" label="起草新方案" onPress={() => ctx.act.setSub('plan.draft', '1')} />
      </Box>
    </Box>
  )
}

export const page: Page = {
  tab: 'plan',
  label: '方案',
  // The draft (and the reminder offer that goes with adopting it) only without a plan or when one is asked for:
  // it reads the longest. Before the journey has answered, the draft waits for the second pass.
  routes: (view, json) => {
    const journey = json?.<Journey>('journey') ?? null
    const tracking = json?.<Tracking>('tracking') ?? null
    const drafting = view.sub['plan.draft'] === '1' || (journey != null && !journey.plan.exists && !tracking?.plan)
    return drafting ? ['journey', 'tracking', 'plan-draft', 'followup'] : ['journey', 'tracking']
  },
  draw,
}
