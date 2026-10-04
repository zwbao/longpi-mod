// 家人 (client/people.ts): whose record the pane shows, the account holder (我) or a family member added here, and
// the bundled 示例档案. Switching makes every page, and Claude's next answer, read the chosen person's record.

import type { Ctx, Node } from '../../types.ts'
import { Buttons, C, fit } from '../../kit.tsx'
import { Choice, Err, Field, Note, Subhead } from './ui.tsx'
import type { People, PersonRow } from './types.ts'
import { errorOf, flag, setSub, sub, toggleFlag } from './util.ts'

/** What a person switch makes stale: this page, the header, and what the overview and plan read. */
export const PERSON_ROUTES = ['people', 'tracking', 'self', 'connection', 'privacy', 'meds', 'conditions', 'findings', 'stores', 'memory', 'followup']

function nameOf(p: PersonRow): string {
  if (p.demo) return `${p.label_zh}（${p.name}）`
  return p.id !== 'self' && p.name && p.name !== p.label_zh ? `${p.label_zh}（${p.name}）` : p.label_zh
}

export function peopleSummary(ctx: Ctx): string {
  const view = ctx.json<People>('people')
  if (!view) return ''
  const active = view.people.find((p) => p.id === view.active)
  const family = view.people.filter((p) => p.id !== 'self' && !p.demo).length
  return [`在看：${active ? nameOf(active) : '我'}`, family > 0 ? `家人 ${family} 位` : '还没有添加家人'].join(' · ')
}

async function choose(ctx: Ctx, person: PersonRow): Promise<void> {
  const out = await ctx.act.post('people/active', { id: person.id }, { reload: PERSON_ROUTES, quiet: true })
  if (!out.ok) {
    setSub(ctx, 'people.error', `切换失败：${errorOf(out.json, '请稍后再试')}`)
    return
  }
  setSub(ctx, 'people.error', typeof out.json.warning_zh === 'string' ? out.json.warning_zh : '')
  ctx.act.toast(`现在看的是：${nameOf(person)}`)
  ctx.act.refresh()
}

async function remove(ctx: Ctx, person: PersonRow): Promise<void> {
  const answer = await ctx.act.ask(`移除「${nameOf(person)}」？这台电脑上${person.label_zh}的档案、方案和记录会一起删除，不能恢复。`, ['移除', '取消'], '移除家人')
  if (answer !== '移除') return
  const out = await ctx.act.post('people/remove', { id: person.id }, { reload: PERSON_ROUTES, done: `已移除${person.label_zh}。`, quiet: true })
  if (!out.ok) setSub(ctx, 'people.error', `移除失败：${errorOf(out.json, '请稍后再试')}`)
}

function addForm(ctx: Ctx, view: People): Node[] {
  const E = ctx.E
  if (!view.can_create_in_mirobody) {
    return [Note(E, '这台电脑上暂时还不能为家人另建档案，LongPi 正在补上这一步。现在可以先看示例档案，了解档案完整后的样子。', 'person-cannot')]
  }
  const label = sub(ctx, 'person.label')
  const name = sub(ctx, 'person.name')
  const year = sub(ctx, 'person.year')
  const sex = sub(ctx, 'person.sex') as 'male' | 'female' | ''
  const add = async () => {
    setSub(ctx, 'person.error', '')
    if (!label.trim()) return setSub(ctx, 'person.error', '请填写称呼，例如「爸爸」「妈妈」。')
    if (name.trim().length < 2) return setSub(ctx, 'person.error', '请填写家人的姓名（与报告一致），用于核对报告是否为本人的。')
    if (!sex) return setSub(ctx, 'person.error', '请选择生理性别（许多计算按性别分别进行）。')
    const birth = year.trim() ? Number(year.trim()) : null
    if (birth !== null && (!Number.isInteger(birth) || birth < 1900 || birth > Number(ctx.today.slice(0, 4)))) return setSub(ctx, 'person.error', '出生年份请填写四位数，例如 1960。')
    const out = await ctx.act.post('people', { label_zh: label.trim(), name: name.trim(), sex, birth_year: birth }, { reload: ['people'], quiet: true })
    if (!out.ok) return setSub(ctx, 'person.error', errorOf(out.json, '添加失败，请稍后再试'))
    for (const key of ['label', 'name', 'year', 'sex']) setSub(ctx, `person.${key}`, '')
    setSub(ctx, 'people.add', '')
    const added = out.json.person as { id?: string; label_zh?: string } | undefined
    if (added?.id) await choose(ctx, { id: added.id, label_zh: added.label_zh ?? label, name: name.trim(), connected: true, managed: true })
  }
  return [
    Note(E, '将为家人建立独立档案，家人无需单独注册。家人的体检、方案和深度分析都和你的分开。', 'person-intro'),
    Field(ctx, { key: 'person-label', label: '称呼', value: label, placeholder: '如 爸爸、妈妈', submitLabel: '记下', onInput: (v) => setSub(ctx, 'person.label', v), onSubmit: (v) => setSub(ctx, 'person.label', v) }),
    Field(ctx, { key: 'person-year', label: '出生年份', value: year, placeholder: '例如 1960', submitLabel: '记下', onInput: (v) => setSub(ctx, 'person.year', v), onSubmit: (v) => setSub(ctx, 'person.year', v) }),
    Field(ctx, { key: 'person-name', label: '姓名', value: name, placeholder: '报告上的真实姓名', submitLabel: '记下', hint: '报告上的真实姓名，用于核对交给 Claude 的报告是否属于本人', onInput: (v) => setSub(ctx, 'person.name', v), onSubmit: (v) => setSub(ctx, 'person.name', v) }),
    Choice(E, 'person-sex', [{ value: 'male', label: '男' }, { value: 'female', label: '女' }], sex, (v) => setSub(ctx, 'person.sex', v), '生理性别'),
    Err(E, sub(ctx, 'person.error'), 'person-err'),
    Buttons(E, [
      { key: 'person-add', label: '添加', primary: true, onPress: () => { void add() } },
      { key: 'person-cancel', label: '取消', onPress: () => setSub(ctx, 'people.add', '') },
    ], 'person-buttons'),
  ]
}

export function PeopleSection(ctx: Ctx): Node[] {
  const E = ctx.E
  const { Box, Text, Button } = E
  const view = ctx.json<People>('people')
  if (!view) return [Note(E, '正在读取…', 'people-loading')]
  const shown = view.people.find((p) => p.id === view.active)
  const rows = [...view.people.filter((p) => !p.demo), ...view.people.filter((p) => p.demo)]
  const adding = flag(ctx, 'people.add')
  return [
    shown?.demo
      ? (
        <Box key="people-demo" flexDirection="column" borderStyle="round" borderColor={C.accent} paddingX={1} width={ctx.width - 2}>
          <Text bold>你在看示例档案</Text>
          <Text wrap="wrap">{`${shown.name}（虚构人物，58 岁）完整使用 LongPi 后的样子：两次体检、手环数据、一次深度分析和执行了三周的方案。数据都是合成的，不对应任何真实的人。`}</Text>
          <Text dimColor wrap="wrap">可在此随意操作，改动不会保存，下次打开时恢复原样。查看完毕后，请在下面切换回「我」。</Text>
        </Box>
      )
      : null,
    shown && shown.id !== 'self' && shown.link_error_zh ? <Text key="people-link" color={C.warn} wrap="wrap">{shown.link_error_zh}</Text> : null,
    ...rows.map((p) => {
      const active = p.id === view.active
      const tags = [active ? '在看' : '', p.demo ? '示例' : '', p.id !== 'self' && p.link_error_zh ? '链接待续期' : ''].filter(Boolean).join(' · ')
      const left = nameOf(p)
      return (
        <Box key={`person-${p.id}`} flexDirection="row" justifyContent="space-between" width={ctx.width - 2}>
          <Box flexDirection="row" gap={2}>
            <Text color={active ? C.accent : undefined} bold={active}>{`${active ? '●' : '○'} ${fit(left, Math.max(8, ctx.width - 34))}`}</Text>
            {tags ? <Text dimColor>{tags}</Text> : null}
          </Box>
          <Box flexDirection="row" gap={1}>
            {!active ? <Button key={`person-view-${p.id}`} plain label={p.id === 'self' ? '切换回我' : '查看'} onPress={() => { void choose(ctx, p) }} /> : null}
            {p.id !== 'self' && !p.demo ? <Button key={`person-rm-${p.id}`} plain dimColor label="移除" onPress={() => { void remove(ctx, p) }} /> : null}
          </Box>
        </Box>
      )
    }),
    Err(E, sub(ctx, 'people.error'), 'people-err'),
    adding ? Subhead(E, '添加家人', 'person-add-head') : null,
    ...(adding ? addForm(ctx, view) : [Buttons(E, [{ key: 'people-add-open', label: '添加家人', onPress: () => toggleFlag(ctx, 'people.add') }], 'people-add-row')]),
  ]
}
