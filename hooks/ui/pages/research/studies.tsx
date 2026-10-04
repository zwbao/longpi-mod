// One card per study (client/science/consent.ts ConsentPanel) and the consent itself, which is its own step:
// read the full consent, answer the two questions, tick the box (never ticked for the person), then 加入.
import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from '../../types.ts'
import { C, Section } from '../../kit.tsx'
import { Callout, Fold, isOpen, P, Radio, setSub, sub, subJson, Tick, wrapTo } from './bits.tsx'
import { localText, scrubVisible, withoutStaysLocal } from './copy.ts'
import { SCIENCE_ROUTES, type Community, type RunAnswer, type StudiesList, type StudyRow } from './science-data.ts'

const STATE_ZH: Record<string, string> = { granted: '已参加', withdrawn: '已退出' }

function stateOf(study: StudyRow): string {
  return STATE_ZH[study.consented] ?? '未参加'
}

/** The signed study text checked out (science/studies), as a short tag. */
function verifiedTag(list: StudiesList | null, id: string): { text: string; color: string } | null {
  const row = list?.studies?.find((item) => item.id === id)
  if (!row) return null
  if (row.verified && row.consent_text_ok !== false) return { text: '说明已核对，未被改动', color: C.good }
  return { text: `说明核对没有通过${row.reason ? `：${row.reason}` : ''}`, color: C.warn }
}

const later = (ctx: Ctx, id: string) => {
  void ctx.act.post('science/invite', { decision: 'later' }, { reload: ['science/invite'], quiet: true }).then((res) => {
    setSub(ctx, `note.${id}`, res.ok ? '已暂缓。这台电脑上的功能仍可使用。' : '以后再说。')
  })
}

export function withdraw(ctx: Ctx, study: StudyRow): void {
  void ctx.act.ask(`退出「${study.title_zh}」？尚未发出的部分将被删除，已发出的合计无法收回。`, ['退出这项研究', '先不退出'], '退出研究').then(async (choice) => {
    if (choice !== '退出这项研究') return
    const res = await ctx.act.post('science/withdraw', { study_id: study.id, confirm: true }, { reload: SCIENCE_ROUTES, done: '已退出。' })
    setSub(ctx, `note.${study.id}`, res.ok ? '已退出。' : String(res.json.error ?? '退出失败'))
    if (res.ok) setSub(ctx, `run.${study.id}`, '')
  })
}

function runLocal(ctx: Ctx, study: StudyRow): void {
  void ctx.act.post('science/run', { study_id: study.id, confirm: true }, { reload: SCIENCE_ROUTES, done: '已在这台电脑上算完。' }).then((res) => {
    setSub(ctx, `note.${study.id}`, '')
    if (res.ok) setSub(ctx, `run.${study.id}`, JSON.stringify({ give_back_zh: res.json.give_back_zh, waiting_zh: res.json.waiting_zh, sent: res.json.sent, local: res.json.local, result: res.json.result }))
    else setSub(ctx, `note.${study.id}`, String(res.json.error ?? '没有算成'))
  })
}

/** A community result can be written out as an evidence line for the weekly reading, on this computer only. */
function exportClaim(ctx: Ctx, study: StudyRow, run: RunAnswer, stat: { key: string; value: number[] }): void {
  const result = run.result
  if (!result) return
  const per = result.stats.length > 0 ? result.dp.epsilon_spent / result.stats.length : result.dp.epsilon_spent
  void ctx.act.post('science/export', {
    confirm: true, study_id: study.id, marker: stat.key, marker_zh: stat.key,
    estimate: stat.value[0], n: result.n_local, epsilon: per, unit: '',
  }, { quiet: false }).then((res) => {
    setSub(ctx, `note.${study.id}`, res.ok ? `已导出 ${String(res.json.rows ?? 1)} 条，只保存在这台电脑上，没有提交。` : String(res.json.error ?? '导出失败'))
  })
}

function RunBlock(ctx: Ctx, study: StudyRow, mode: string, width: number): Node {
  const run = subJson<RunAnswer>(ctx, `run.${study.id}`)
  if (!run) return null
  const { Box, Text, Button } = ctx.E
  const stats = run.result?.stats ?? []
  return (
    <Box key={`run-${study.id}`} flexDirection="column" marginTop={1} width={width}>
      <Text bold>这台电脑上的结果</Text>
      {(run.local ?? []).map((row, i) => <Text key={`lr-${i}`} wrap="wrap">{wrapTo(scrubVisible(localText(row.detail_zh)), width)}</Text>)}
      {run.give_back_zh ? <Text key="gb" dimColor wrap="wrap">{wrapTo(scrubVisible(withoutStaysLocal(run.give_back_zh)).replace(/已发出的合计无法收回。[^。]*。/g, '').trim(), width)}</Text> : null}
      {mode === 'simulated' && stats.length > 0
        ? (
          <Box key="exports" flexDirection="column">
            {stats.map((stat, i) => (
              <Button key={`exp-${study.id}-${i}`} plain label={`导出「${stat.key}」的合计（只存在这台电脑，不提交）`} onPress={() => exportClaim(ctx, study, run, stat)} />
            ))}
          </Box>
        )
        : null}
      <Button key={`run-hide-${study.id}`} plain dimColor label="收起结果" onPress={() => setSub(ctx, `run.${study.id}`, '')} />
    </Box>
  )
}

/** One study in the list. */
export function StudyCard(ctx: Ctx, props: { study: StudyRow; data: Community; list: StudiesList | null; personal: { note: string } | null }): RenderElement {
  const { Box, Text, Button } = ctx.E
  const { study, data } = props
  const width = ctx.width
  const inner = width - 4
  const threshold = data.thresholds?.find((row) => row.study_id === study.id)?.line_zh
  const verified = verifiedTag(props.list, study.id)
  const granted = study.consented === 'granted'
  const summary = withoutStaysLocal(study.summary_zh)
  const note = sub(ctx, `note.${study.id}`)
  const full = `full.${study.id}`
  return Section(ctx.E, {
    key: `study-${study.id}`,
    title: study.title_zh,
    note: stateOf(study),
    width,
    tone: granted ? C.good : C.dim,
    children: [
      <Box key="tags" flexDirection="row" gap={1} flexWrap="wrap">
        <Text color={granted ? C.good : C.dim}>{`[${stateOf(study)}]`}</Text>
        <Text color={C.accent}>{`[${study.kind === 'community_season' ? '社区赛季' : '研究'}]`}</Text>
        {threshold ? <Text dimColor>{threshold}</Text> : null}
      </Box>,
      verified ? <Text key="verified" color={verified.color} dimColor={verified.color === C.good}>{verified.text}</Text> : null,
      P(ctx, summary, 'summary'),
      P(ctx, '基因数据和姓名不纳入研究。', 'nogene', { dim: true }),
      Fold(ctx, full, '完整同意书', '收起同意书'),
      isOpen(ctx, full) ? P(ctx, localText(study.text_zh), 'fulltext', { dim: true }) : null,
      <Box key="acts" flexDirection="row" gap={1} flexWrap="wrap" marginTop={1}>
        {granted
          ? <Button key={`runb-${study.id}`} label="在这台电脑上算一次" onPress={() => runLocal(ctx, study)} />
          : <Button key={`join-${study.id}`} variant="primary" label="阅读说明并加入" onPress={() => ctx.act.detail(`consent:${study.id}`)} />}
        {granted ? null : <Button key={`later-${study.id}`} label="以后再说" onPress={() => later(ctx, study.id)} />}
        {granted ? <Button key={`wd-${study.id}`} label="退出这项研究" onPress={() => withdraw(ctx, study)} /> : null}
      </Box>,
      RunBlock(ctx, study, data.mode, inner),
      props.personal
        ? (
          <Box key="personal" flexDirection="column" marginTop={1}>
            <Text dimColor wrap="wrap">{wrapTo(props.personal.note, inner)}</Text>
            <Button key={`nof1-${study.id}`} label="开始个人对照" onPress={() => ctx.act.detail('nof1')} />
          </Box>
        )
        : null,
      <Text key="stays" dimColor wrap="wrap">{'已发送的汇总数据无法撤回。'}</Text>,
      note ? <Text key="note" color={C.accent} wrap="wrap">{wrapTo(note, inner)}</Text> : null,
    ],
  })
}

// --- the consent step ----------------------------------------------------------------------------------

function join(ctx: Ctx, study: StudyRow): void {
  const questions = study.questions.slice(0, 2)
  const picked = questions.map((q) => sub(ctx, `ans.${study.id}.${q.id}`))
  if (picked.some((value) => value === '')) {
    ctx.act.toast('请先回答上面两个问题。')
    return
  }
  if (sub(ctx, `tick.${study.id}`) !== '1') {
    ctx.act.toast('请先勾选「我看过说明，同意在这台电脑上参加」。')
    return
  }
  const answers = questions.map((q, i) => ({ id: q.id, choice: Number(picked[i]) }))
  void ctx.act.post('science/consent', { confirm: true, plain: true, bundled_with_product: false, study_id: study.id, answers, explained_by: 'page' }, { reload: SCIENCE_ROUTES, done: '已保存。', quiet: true }).then((res) => {
    if (res.ok) {
      for (const q of questions) setSub(ctx, `ans.${study.id}.${q.id}`, '')
      setSub(ctx, `tick.${study.id}`, '')
      setSub(ctx, `err.${study.id}`, '')
      setSub(ctx, `note.${study.id}`, '已保存。')
      ctx.act.detail(null)
    } else {
      setSub(ctx, `err.${study.id}`, String(res.json.error ?? `没有保存（${res.status}）`))
    }
  })
}

export function ConsentView(ctx: Ctx, study: StudyRow | null, community: Community | null): Node {
  const { Box, Text, Button } = ctx.E
  const back = <Button key="back" plain label="← 返回研究" onPress={() => ctx.act.detail(null)} />
  if (!study) {
    return (
      <Box flexDirection="column">
        {back}
        <Text dimColor>{community ? '没有找到这项研究。' : '正在读取研究…'}</Text>
      </Box>
    )
  }
  const width = ctx.width
  const questions = study.questions.slice(0, 2)
  const ticked = sub(ctx, `tick.${study.id}`) === '1'
  const ready = questions.every((q) => sub(ctx, `ans.${study.id}.${q.id}`) !== '') && ticked
  const err = sub(ctx, `err.${study.id}`)
  if (study.consented === 'granted') {
    return (
      <Box flexDirection="column">
        {back}
        <Text bold>{study.title_zh}</Text>
        <Text color={C.good}>你已参加这项研究。</Text>
        <Box key="acts" flexDirection="row" gap={1}>
          <Button key="wd" label="退出这项研究" onPress={() => withdraw(ctx, study)} />
        </Box>
        <Text dimColor wrap="wrap">{'已发送的汇总数据无法撤回。'}</Text>
      </Box>
    )
  }
  return (
    <Box flexDirection="column" width={width}>
      {back}
      <Text key="title" bold color={C.accent}>{`加入研究：${study.title_zh}`}</Text>
      {community?.reason_zh ? <Text key="stays" dimColor wrap="wrap">{wrapTo(localText(community.reason_zh), width)}</Text> : null}
      {Section(ctx.E, {
        key: 'step1', title: '第 1 步 · 读完整同意书', width,
        children: [
          P(ctx, withoutStaysLocal(study.summary_zh), 'sum'),
          P(ctx, localText(study.text_zh), 'text', { dim: false }),
          P(ctx, '基因数据和姓名不纳入研究。', 'nogene', { dim: true }),
        ],
      })}
      {Section(ctx.E, {
        key: 'step2', title: '第 2 步 · 回答两个问题', width,
        children: questions.map((q, qi) => {
          const value = sub(ctx, `ans.${study.id}.${q.id}`)
          return (
            <Box key={`q-${q.id}`} flexDirection="column" marginTop={qi === 0 ? 0 : 1}>
              <Text bold wrap="wrap">{wrapTo(`${qi + 1}. ${q.question_zh}`, width - 4)}</Text>
              {q.options_zh.map((option, oi) => Radio(ctx.E, {
                key: `opt-${study.id}-${q.id}-${oi}`,
                label: localText(option),
                on: value === String(oi),
                onPress: () => { setSub(ctx, `ans.${study.id}.${q.id}`, String(oi)); setSub(ctx, `err.${study.id}`, '') },
              }))}
            </Box>
          )
        }),
      })}
      {Section(ctx.E, {
        key: 'step3', title: '第 3 步 · 确认', width, tone: ready ? C.accent : C.dim,
        children: [
          Tick(ctx.E, { key: `tick-${study.id}`, label: '我看过说明，同意在这台电脑上参加', on: ticked, onPress: () => setSub(ctx, `tick.${study.id}`, ticked ? '' : '1') }),
          <Box key="acts" flexDirection="row" gap={1} marginTop={1}>
            <Button key={`join-${study.id}`} label="加入" {...(ready ? { variant: 'primary' as const } : { dimColor: true })} onPress={() => join(ctx, study)} />
            <Button key={`later-${study.id}`} label="以后再说" onPress={() => { later(ctx, study.id); ctx.act.detail(null) }} />
          </Box>,
          <Text key="stays2" dimColor wrap="wrap">{'已发送的汇总数据无法撤回。'}</Text>,
          err ? Callout(ctx.E, err, 'warn', 'err', width - 4) : null,
        ],
      })}
    </Box>
  )
}
