// The community season (client/science/community.ts): progress, 大家的结果, the topic vote, contribution
// cards; and the invitation card the web page carried (life.ts ScienceIntro).
import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from '../../types.ts'
import { C, Section } from '../../kit.tsx'
import { meter, P, Radio, setSub, sub, Fold, isOpen, wrapTo } from './bits.tsx'
import { localText, OUTBOX_ZH, SCIENCE_INTRO } from './copy.ts'
import { SCIENCE_ROUTES, type Community, type Invite, type StudyRow } from './science-data.ts'

export function ProgressCard(ctx: Ctx, data: Community): Node {
  const progress = data.progress
  if (!progress) return null
  const { Text } = ctx.E
  const recruiting = (data.thresholds ?? []).some((row) => row.line_zh.includes('招募中'))
  const frac = progress.min_cohort > 0 ? Math.min(1, progress.contributed / progress.min_cohort) : 0
  const barWidth = Math.max(10, Math.min(40, ctx.width - 24))
  return Section(ctx.E, {
    key: 'progress', title: '研究进度', note: `第 ${progress.week} 周 / 共 ${progress.weeks} 周`, width: ctx.width,
    children: [
      <Text key="bar"><Text color={C.accent}>{meter(frac, barWidth)}</Text><Text dimColor>{`  ${progress.label_zh}`}</Text></Text>,
      P(ctx, recruiting
        ? '每项研究下方标注的是目标人数，目前正在招募。暂不显示已加入人数，人数也不代表你的结果。'
        : `这台电脑已参加 ${progress.studies} 项研究。发布的汇总数据至少包含 ${progress.min_cohort} 人。`, 'note', { dim: true }),
    ],
  })
}

export function PulseCard(ctx: Ctx, data: Community): RenderElement {
  const pulse = data.pulse ?? null
  return Section(ctx.E, {
    key: 'pulse', title: '大家的结果', width: ctx.width,
    children: pulse
      ? [P(ctx, pulse.headline_zh, 'head', { bold: true }), P(ctx, localText(pulse.detail_zh), 'detail', { dim: true })]
      : [P(ctx, localText(data.give_back_zh) || '暂无返回的群体结果。', 'empty', { dim: true })],
  })
}

export function VoteCard(ctx: Ctx, data: Community): Node {
  const voting = data.voting
  if (!voting || voting.topics.length === 0) return null
  const { Box, Text, Button } = ctx.E
  // In this build the vote stays on this computer; the page keeps what was sent so it does not look forgotten.
  const sent = voting.mine ?? (sub(ctx, 'voted') || null)
  const topic = sub(ctx, 'topic') || sent || ''
  const sentTitle = sent ? voting.topics.find((row) => row.id === sent)?.title_zh : ''
  const vote = () => {
    if (!topic) {
      ctx.act.toast('请先选一个问题。')
      return
    }
    void ctx.act.post('science/community', { topic_id: topic }, { reload: ['science/community'], done: '投票已保存。' }).then((res) => {
      if (res.ok) setSub(ctx, 'voted', topic)
    })
  }
  return Section(ctx.E, {
    key: 'vote', title: '下个赛季希望优先研究哪个问题', width: ctx.width,
    children: [
      ...voting.topics.map((item) => Radio(ctx.E, {
        key: `topic-${item.id}`,
        label: item.title_zh,
        note: `${item.votes} 票`,
        on: topic === item.id,
        onPress: () => setSub(ctx, 'topic', item.id),
      })),
      <Box key="acts" flexDirection="row" gap={1} flexWrap="wrap" marginTop={1}>
        <Button key="vote" label="提交投票" {...(topic ? {} : { dimColor: true })} onPress={vote} />
        {sentTitle ? <Text color={C.good}>{`已投：${sentTitle.replace(/^下个赛季：/, '')}`}</Text> : null}
      </Box>,
      voting.note_zh ? P(ctx, localText(voting.note_zh), 'vnote', { dim: true }) : null,
    ],
  })
}

export function CardsCard(ctx: Ctx, data: Community): RenderElement {
  const cards = data.cards ?? []
  const { Box, Text } = ctx.E
  const open = isOpen(ctx, 'cards')
  const shown = open ? cards : cards.slice(0, 2)
  return Section(ctx.E, {
    key: 'cards', title: '贡献卡', note: cards.length ? `${cards.length} 张` : '', width: ctx.width,
    children: cards.length === 0
      ? [P(ctx, '贡献卡记录你在这台电脑上参与研究的情况，与化验结果好坏无关。在这台电脑上完成计算后会显示在此处。', 'empty', { dim: true })]
      : [
        ...shown.map((card) => (
          <Box key={`card-${card.id}`} flexDirection="column" marginBottom={0}>
            <Text bold color={C.gold}>{`◆ ${card.title_zh}`}</Text>
            <Text dimColor wrap="wrap">{wrapTo(open ? localText(card.body_zh) : `${localText(card.body_zh).split('。')[0] ?? ''}。`, ctx.width - 4)}</Text>
          </Box>
        )),
        cards.length > 2 || cards.some((card) => card.body_zh.split('。').length > 2) ? Fold(ctx, 'cards', cards.length > 2 ? `全部 ${cards.length} 张，展开全文` : '展开全文') : null,
      ],
  })
}

/** The invitation (life.ts ScienceIntro): 一起研究, with 加入 leading to the studies and 以后再说. */
export function InviteCard(ctx: Ctx, invite: Invite | null, studies: readonly StudyRow[], said = ''): Node {
  if (!invite?.show) return null
  const { Box, Text, Button } = ctx.E
  const picking = sub(ctx, 'invite') === 'pick'
  const later = () => {
    void ctx.act.post('science/invite', { decision: 'later' }, { reload: ['science/invite'], quiet: true }).then(() => setSub(ctx, 'invite', ''))
  }
  const join = () => {
    void ctx.act.post('science/invite', { decision: 'join' }, { quiet: true })
    setSub(ctx, 'invite', 'pick')
  }
  const open = studies.filter((study) => study.consented !== 'granted')
  return Section(ctx.E, {
    key: 'invite', title: '一起研究', width: ctx.width, tone: C.accent,
    children: [
      P(ctx, SCIENCE_INTRO, 'intro'),
      localText(invite.waiting_zh || OUTBOX_ZH) === localText(said) ? null : P(ctx, localText(invite.waiting_zh || OUTBOX_ZH), 'waiting', { dim: true }),
      picking && open.length > 0
        ? (
          <Box key="pick" flexDirection="column" marginTop={1}>
            <Text>每项研究单独加入：先读说明，再回答两个问题。</Text>
            {open.map((study) => <Button key={`pick-${study.id}`} plain label={`→ ${study.title_zh}`} onPress={() => ctx.act.detail(`consent:${study.id}`)} />)}
          </Box>
        )
        : (
          <Box key="acts" flexDirection="row" gap={1} marginTop={1}>
            <Button key="invite-join" variant="primary" label="加入" onPress={join} />
            <Button key="invite-later" label="以后再说" onPress={later} />
          </Box>
        ),
    ],
  })
}

/** The research switch (settings-page.ts ScienceSwitch), with the simulated round this build can also run. */
export function SwitchCard(ctx: Ctx, invite: Invite | null, current: string): RenderElement {
  const { Text } = ctx.E
  const pref = invite?.preference ?? current
  const on = pref === 'local' || pref === 'simulated'
  const set = (mode: 'local' | 'off' | 'simulated') => {
    void ctx.act.post('science/preference', { mode }, { reload: SCIENCE_ROUTES, done: '已保存。' })
  }
  return Section(ctx.E, {
    key: 'switch', title: '研究开关', note: on ? '已开启' : '已关闭', width: ctx.width,
    children: [
      <Text key="label" bold>{'在这台电脑上参与研究'}</Text>,
      P(ctx, '开启后，可使用研究页、个人对照和本地统计，数据仅保存在这台电脑上。关闭后以上功能停止。未满 18 岁时始终关闭。', 'text', { dim: true }),
      Radio(ctx.E, { key: 'pref-local', label: '开启', on: pref === 'local', onPress: () => set('local') }),
      Radio(ctx.E, { key: 'pref-sim', label: '开启，并在这台电脑上模拟多人汇总（试跑，不发出任何数据）', on: pref === 'simulated', onPress: () => set('simulated') }),
      Radio(ctx.E, { key: 'pref-off', label: '关闭', on: pref === 'off', onPress: () => set('off') }),
    ],
  })
}
