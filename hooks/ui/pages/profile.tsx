// The 档案 page (client/profile-tab.ts): what LongPi knows about the person and where it comes from. The profile
// answers, the measurements taken at home, the record and how to add to it, the exports and the member file, what
// reports said in words, medicines, conditions, genetics, the next checkup's add-ons, family, and privacy.
// One section is open at a time; a closed one shows a one-line summary.

import type { Ctx, Node, Page } from '../types.ts'
import { Failed, Loading, routeState } from '../kit.tsx'
import { Basics, basicsSummary } from './more/basics.tsx'
import { RecordSection, recordLine } from './more/connection.tsx'
import { ConditionsSection, FindingsSection, GeneticsSection, MedsSection, conditionsSummary, findingsSummary, geneticsSummary, medsSummary } from './more/datain.tsx'
import { ExportSection, MemberSection, memberSummary } from './more/exports.tsx'
import { PeopleSection, peopleSummary } from './more/people.tsx'
import { PrivacySection, privacySummary } from './more/privacy.tsx'
import { SelfSection, selfField, selfSummary } from './more/self.tsx'
import { Body, Err, Fold, Note, Ok } from './more/ui.tsx'
import type { Addon, Journey } from './more/types.ts'
import { openSection, sub } from './more/util.ts'

const PAGE = 'profile'

function addonCommon(journey: Journey): string | null {
  const unlocks = [...new Set(journey.addons.map((row) => row.unlocks_zh))]
  return unlocks.length === 1 && unlocks[0] ? unlocks[0] : null
}

/** 下次体检加测: the one full add-on list; what can be measured at home has its field right in the row. */
function Addons(ctx: Ctx, journey: Journey): Node[] {
  const E = ctx.E
  const { Box, Text } = E
  const common = addonCommon(journey)
  const row = (addon: Addon, i: number) => {
    const note = [common ? '' : `解锁：${addon.unlocks_zh}`, addon.self_measurable ? '可在家自行测量' : ''].filter(Boolean).join(' · ')
    const key = addon.self_key === 'waist' || addon.self_key === 'weight' ? addon.self_key : addon.self_key === 'sbp' || addon.self_key === 'dbp' ? 'bp' : null
    return (
      <Box key={`addon-${i}`} flexDirection="column">
        <Box flexDirection="row" gap={2}>
          <Text bold>{addon.item_zh}</Text>
          {note ? <Text dimColor>{note}</Text> : null}
        </Box>
        {addon.self_measurable && key ? selfField(ctx, journey, key, `addon${i}`) : null}
        {Err(ctx, sub(ctx, `addon${i}.error`), `addon-${i}-err`)}
        {Ok(ctx, sub(ctx, `addon${i}.msg`), `addon-${i}-msg`)}
      </Box>
    )
  }
  return journey.addons.map(row)
}

function draw(ctx: Ctx): Node {
  const { Box } = ctx.E
  const state = routeState(ctx, 'journey')
  if (state.kind === 'loading') return Loading(ctx.E)
  if (state.kind === 'error') return Failed(ctx.E, state.error, () => ctx.act.load(['journey'], true))
  const journey = state.json as unknown as Journey
  const common = addonCommon(journey)

  const sections: Array<{ id: string; title: string; summary: string; body: () => Node[]; show?: boolean }> = [
    { id: 'basics', title: '基本情况', summary: basicsSummary(journey), body: () => Basics(ctx, journey) },
    { id: 'self', title: '自测', summary: selfSummary(journey), body: () => SelfSection(ctx, journey) },
    { id: 'record', title: '健康记录', summary: recordLine(journey), body: () => RecordSection(ctx, journey, 'profile') },
    { id: 'export', title: '导出', summary: '报告 · 会员档案 · 日历 · 完整档案', body: () => ExportSection(ctx, { openPrivacy: () => openSection(ctx, PAGE, 'privacy') }) },
    { id: 'member', title: '会员档案', summary: memberSummary(ctx), body: () => MemberSection(ctx) },
    { id: 'findings', title: '报告里的叙述', summary: findingsSummary(ctx), body: () => FindingsSection(ctx) },
    { id: 'meds', title: '用药', summary: medsSummary(ctx), body: () => MedsSection(ctx) },
    { id: 'conditions', title: '病情', summary: conditionsSummary(ctx), body: () => ConditionsSection(ctx) },
    { id: 'genetics', title: '基因', summary: geneticsSummary(ctx), body: () => GeneticsSection(ctx) },
    {
      id: 'addons', title: '下次体检加测', show: journey.addons.length > 0,
      summary: common ? `${journey.addons.length} 项 · 解锁${common}` : `${journey.addons.length} 项，加测后可计算更多结果`,
      body: () => Addons(ctx, journey),
    },
    { id: 'people', title: '家人', summary: peopleSummary(ctx), body: () => PeopleSection(ctx) },
    { id: 'privacy', title: '隐私与数据', summary: privacySummary(ctx), body: () => PrivacySection(ctx, { withExport: false }) },
  ]

  return (
    <Box flexDirection="column">
      {Note(ctx, '档案只保存在这台电脑上。按 ▸ 一行展开，再按一次收起。', 'profile-lead')}
      {sections.filter((section) => section.show !== false).flatMap((section) => {
        const fold = Fold(ctx, { page: PAGE, id: section.id, title: section.title, summary: section.summary, fallback: 'basics' })
        return [fold.head, fold.open ? Body(ctx, section.id, section.body()) : null]
      })}
    </Box>
  )
}

export const page: Page = {
  tab: 'profile',
  label: '档案',
  routes: () => ['journey', 'self', 'people', 'memory', 'privacy', 'meds', 'conditions', 'findings', 'stores'],
  draw,
}
