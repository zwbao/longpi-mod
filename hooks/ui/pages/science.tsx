// The 研究 page (client/science/studies-tab.ts): the invitation, where research stands, the community season
// (progress, 大家的结果, the vote, contribution cards), one card per study with its own consent step, the
// personal trial, what left this computer, the transparency export, the public registry and the switch.
// Research in this build runs on this computer only (or a simulated round); the core refuses anything live
// with its own words, which are shown as they are.
import type { Ctx, Node, Page } from '../types.ts'
import { C, Section, routeState } from '../kit.tsx'
import { Callout, FailLine, P } from './research/bits.tsx'
import { CardsCard, InviteCard, ProgressCard, PulseCard, SwitchCard, VoteCard } from './research/community.tsx'
import { localText } from './research/copy.ts'
import { NOf1View, PlanCard } from './research/nof1.tsx'
import { RegistryCard, TranslogCard, TransparencyCard } from './research/records.tsx'
import { SCIENCE_ROUTES, type Community, type Invite, type Registry, type StudiesList, type Transparency, type Translog } from './research/science-data.ts'
import { ConsentView, StudyCard } from './research/studies.tsx'

function errorOf(ctx: Ctx, path: string): string {
  const state = routeState(ctx, path)
  return state.kind === 'error' ? state.error : ''
}

function draw(ctx: Ctx): Node {
  const { Box, Text } = ctx.E
  const community = ctx.json<Community>('science/community')
  const detail = ctx.view.detail ?? ''
  if (detail.startsWith('consent:')) {
    const id = detail.slice('consent:'.length)
    return ConsentView(ctx, community?.studies?.find((study) => study.id === id) ?? null, community)
  }
  if (detail === 'nof1') return NOf1View(ctx, community)

  const list = ctx.json<StudiesList>('science/studies')
  const invite = ctx.json<Invite>('science/invite')
  const translog = ctx.json<Translog>('science/translog')
  const state = routeState(ctx, 'science/community')
  const width = ctx.width
  const body: Node[] = []

  if (state.kind === 'loading') {
    body.push(<Text key="loading" dimColor>正在读取研究…</Text>)
  } else if (state.kind === 'error') {
    body.push(FailLine(ctx, 'science/community', state.error, 'community-failed', '未能读取研究信息'))
  } else if (community && community.mode === 'off') {
    // Live is refused by the core: its own sentence (science/studies) is the reason shown.
    const reason = community.live_refused && list?.reason_zh ? list.reason_zh : community.reason_zh || '可在设置中重新开启。未满 18 岁者不参加研究。'
    body.push(Section(ctx.E, {
      key: 'off', title: '研究没有打开', width,
      children: [P(ctx, localText(reason), 'reason', { dim: !community.live_refused, color: community.live_refused ? C.warn : undefined })],
    }))
  } else if (community) {
    const studies = community.studies ?? []
    body.push(InviteCard(ctx, invite, studies, community.reason_zh ?? ''))
    if (community.reason_zh) body.push(<Box key="reason" marginBottom={1}>{Callout(ctx.E, localText(community.reason_zh), 'info', 'reason-callout', width)}</Box>)
    if (community.progress && community.voting) {
      body.push(ProgressCard(ctx, community), PulseCard(ctx, community), VoteCard(ctx, community), CardsCard(ctx, community))
    }
    // The personal trial belongs to the community-season study; its note keeps only the first sentence of the server text.
    const personalId = (studies.find((study) => study.kind === 'community_season') ?? studies[0])?.id
    const personalNote = `${community.early_zh ? `${localText(community.early_zh).split('。')[0]}。` : ''}可以先在这台电脑上做个人对照。`
    for (const study of studies) {
      body.push(StudyCard(ctx, { study, data: community, list, personal: study.id === personalId ? { note: personalNote } : null }))
    }
    if (studies.length === 0) body.push(P(ctx, list?.reason_zh ? localText(list.reason_zh) : '还没有可以参加的研究。', 'nostudy', { dim: true, width: ctx.width }))
    body.push(PlanCard(ctx))
  }

  // What left this computer: the log route, else the copy the community view carries.
  const logError = errorOf(ctx, 'science/translog')
  const rows = translog?.entries ?? community?.translog ?? []
  if (community?.mode !== 'off' || rows.length > 0) body.push(TranslogCard(ctx, rows, translog?.chain))
  if (logError) body.push(FailLine(ctx, 'science/translog', logError, 'translog-failed'))
  body.push(TransparencyCard(ctx, ctx.json<Transparency>('science/transparency'), errorOf(ctx, 'science/transparency')))
  body.push(RegistryCard(ctx, ctx.json<Registry>('science/registry'), errorOf(ctx, 'science/registry'), community?.reason_zh ?? ''))
  body.push(SwitchCard(ctx, invite, community?.mode ?? invite?.mode ?? 'local'))
  return <Box flexDirection="column" width={width}>{body}</Box>
}

export const page: Page = {
  tab: 'science',
  label: '研究',
  routes: () => SCIENCE_ROUTES,
  draw,
}
