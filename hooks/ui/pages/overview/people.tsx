// Whose record the pane shows (client/people.ts): a row at the top of 总览 — 在看：我 / family / 示例档案 — and
// 添加家人. Switching reloads every section, so each reads the chosen person's store. The 示例档案 says what it is;
// someone whose own record is still empty is invited to look at it first.

import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from '../../types.ts'
import { C } from '../../kit.tsx'
import { DRAFT_KEYS } from './onboarding.tsx'
import { Callout, Caption, Card, isOpen, Para, setSub, sub } from './ui.tsx'

interface PersonRow { id: string; label_zh: string; name: string; connected?: boolean; link_error_zh?: string; demo?: boolean }
interface PeopleView { ok?: boolean; active: string; people: PersonRow[]; can_create_in_mirobody?: boolean; create_hint_zh?: string }

/** Every route 总览 and the header read: after a switch they all belong to someone else. */
export const PERSON_ROUTES = ['journey', 'tracking', 'people', 'surfaces', 'triage', 'codex/slot', 'indicators', 'science/invite', 'followup', 'privacy'] as const

type Field = (props: Record<string, unknown>) => RenderElement

function people(ctx: Ctx): PeopleView | null {
  const view = ctx.json<PeopleView>('people')
  return view && Array.isArray(view.people) ? view : null
}

function optionText(p: PersonRow): string {
  if (p.demo) return `${p.label_zh}（${p.name}）`
  const name = p.id !== 'self' && p.name && p.name !== p.label_zh ? `（${p.name}）` : ''
  const suffix = p.id !== 'self' && p.link_error_zh ? ' · 链接待续期' : ''
  return `${p.label_zh}${name}${suffix}`
}

async function choose(ctx: Ctx, id: string): Promise<void> {
  const answer = await ctx.act.post('people/active', { id }, { reload: PERSON_ROUTES, quiet: true })
  if (!answer.ok) ctx.act.toast(typeof answer.json.error === 'string' ? answer.json.error : '切换失败')
  else if (typeof answer.json.warning_zh === 'string' && answer.json.warning_zh) ctx.act.toast(answer.json.warning_zh)
  // Every small choice of this page belonged to the person shown before.
  for (const key of ['onboarding', 'step', 'noReport', 'briefId', 'care.step', 'addons', 'agree', ...DRAFT_KEYS]) setSub(ctx, key, '')
}

/** 在看：我 · 爸爸 · 示例档案（李明华） · ＋ 添加家人 */
export function PeopleRow(ctx: Ctx): Node {
  const view = people(ctx)
  if (!view) return null
  const { Box, Text, Button } = ctx.E
  const real = view.people.filter((p) => !p.demo)
  const demo = view.people.filter((p) => p.demo)
  const item = (p: PersonRow) => p.id === view.active
    ? <Text key={`who-${p.id}`} bold color={p.demo ? C.warn : C.accent}>{`【${optionText(p)}】`}</Text>
    : <Button key={`who-${p.id}`} plain label={optionText(p)} onPress={() => { void choose(ctx, p.id) }} />
  return (
    <Box key="people" flexDirection="row" columnGap={1} flexWrap="wrap">
      <Text key="l" dimColor>在看：</Text>
      {real.map(item)}
      {demo.length > 0 ? <Text key="sep" dimColor>│ 示例</Text> : null}
      {demo.map(item)}
      <Button key="who-add" plain dimColor label={isOpen(ctx, 'addPerson') ? '＋ 添加家人 ▾' : '＋ 添加家人'} onPress={() => setSub(ctx, 'addPerson', isOpen(ctx, 'addPerson') ? '' : '1')} />
    </Box>
  )
}

/** The shown person's notice: what the 示例档案 is, or a family member's link problem. */
export function PersonNotice(ctx: Ctx): Node {
  const view = people(ctx)
  const shown = view?.people.find((p) => p.id === view.active)
  if (!shown) return null
  const { Box, Text } = ctx.E
  if (shown.demo) {
    return (
      <Box key="demo-note" flexDirection="column" width={ctx.width}>
        <Text key="t" bold color={C.warn}>你在看示例档案</Text>
        {Para(ctx.E, `${shown.name}（虚构人物，58 岁）完整使用 LongPi 后的样子：两次体检、手环数据、一次深度分析和执行了三周的方案。数据都是合成的，不对应任何真实的人。`, ctx.width, { key: 'b' })}
        {Para(ctx.E, '可在此随意操作，改动不会保存，下次打开时恢复原样。查看完毕后，请在上方切换回「我」。', ctx.width, { key: 'c', dim: true })}
      </Box>
    )
  }
  if (shown.id === 'self' || !shown.link_error_zh) return null
  return Callout(ctx.E, shown.link_error_zh, 'warn', 'link-note', ctx.width)
}

/** For someone whose own record is still empty: one line inviting them to the 示例档案 first. */
export function DemoInvite(ctx: Ctx, empty: boolean): Node {
  const view = people(ctx)
  const demo = view?.people.find((p) => p.demo)
  if (!empty || !view || !demo || view.active !== 'self') return null
  const { Box, Text, Button } = ctx.E
  return (
    <Box key="demo-invite" flexDirection="row" columnGap={1} flexWrap="wrap">
      <Text key="s" color={C.gold}>✦</Text>
      <Text key="t">想了解档案完整后，LongPi 能为你做什么？</Text>
      <Button key="demo-open" plain label="打开示例档案 →" onPress={() => { void choose(ctx, demo.id) }} />
    </Box>
  )
}

/** 添加家人: 称呼, 姓名, 生理性别 and 出生年份; added and then shown. */
export function AddPerson(ctx: Ctx): Node {
  if (!isOpen(ctx, 'addPerson')) return null
  const view = people(ctx)
  if (!view) return null
  const { Box, Text, Button } = ctx.E
  const Input = 'Input' in ctx.E ? (ctx.E as unknown as { Input: Field }).Input : null
  // The input empties on Enter: what was saved shows beside it, as on the 基本情况 step.
  const field = (key: string, label: string, placeholder: string) => {
    if (!Input) return null
    const saved = sub(ctx, `person.${key}`).trim()
    return (
      <Box key={`person-row-${key}`} flexDirection="row" gap={2}>
        {Input({ key: `person-${key}`, label, placeholder: saved ? `${saved}（已填，可改）` : placeholder, submitLabel: '确定', onInput: (v: string) => setSub(ctx, `person.${key}`, v), onSubmit: (v: string) => setSub(ctx, `person.${key}`, v) })}
        {saved ? <Text key="saved" color={C.good}>{`✓ ${saved}`}</Text> : null}
      </Box>
    )
  }
  const sex = sub(ctx, 'person.sex')
  const ready = sub(ctx, 'person.label').trim() !== '' && sub(ctx, 'person.name').trim().length >= 2 && (sex === 'male' || sex === 'female')
  const busy = sub(ctx, 'person.busy') === '1'
  const add = async () => {
    if (!ready || busy) {
      if (!ready) ctx.act.toast('请填写称呼、姓名（至少两个字）并选择生理性别。')
      return
    }
    setSub(ctx, 'person.busy', '1')
    const year = sub(ctx, 'person.year').trim()
    const answer = await ctx.act.post('people', {
      label_zh: sub(ctx, 'person.label').trim(), name: sub(ctx, 'person.name').trim(), sex, birth_year: /^\d{4}$/.test(year) ? Number(year) : null,
    }, { reload: ['people'], quiet: true })
    setSub(ctx, 'person.busy', '')
    const person = answer.json.person as { id?: unknown } | undefined
    if (!answer.ok || typeof person?.id !== 'string') {
      ctx.act.toast(typeof answer.json.error === 'string' ? answer.json.error : '添加失败，请稍后再试')
      return
    }
    for (const key of ['label', 'name', 'year', 'sex']) setSub(ctx, `person.${key}`, '')
    setSub(ctx, 'addPerson', '')
    await choose(ctx, person.id)
  }
  return Card(ctx, {
    key: 'add-person', title: '添加家人', width: ctx.width, tone: C.accent,
    aside: <Button key="person-close" plain dimColor label="取消" onPress={() => setSub(ctx, 'addPerson', '')} />,
    children: [
      Caption(ctx.E, view.can_create_in_mirobody ? '将为家人建立独立档案，家人无需单独注册。家人的体检、方案和深度分析都和你的分开。' : (view.create_hint_zh ?? '').trim(), 'lead', ctx.width - 4),
      field('label', '称呼', '如 爸爸、妈妈'),
      field('name', '姓名', '报告上的真实姓名'),
      <Text key="name-hint" dimColor>　　姓名用于核对上传的报告是否属于本人</Text>,
      field('year', '出生年份', '例如 1960'),
      <Box key="sex" flexDirection="row" gap={1}>
        <Text key="l">生理性别</Text>
        <Button key="person-male" {...(sex === 'male' ? { variant: 'primary' as const } : {})} label={sex === 'male' ? '● 男' : '男'} onPress={() => setSub(ctx, 'person.sex', 'male')} />
        <Button key="person-female" {...(sex === 'female' ? { variant: 'primary' as const } : {})} label={sex === 'female' ? '● 女' : '女'} onPress={() => setSub(ctx, 'person.sex', 'female')} />
      </Box>,
      <Box key="act" flexDirection="row" gap={1} marginTop={1}>
        <Button key="person-add" variant="primary" label={busy ? '添加中' : '添加'} onPress={() => { void add() }} />
        {!ready ? <Text key="need" dimColor>填好称呼、姓名和性别后添加</Text> : null}
      </Box>,
    ],
  })
}
