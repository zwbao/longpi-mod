// 基本情况: the profile questions (client/profile-editor.ts). Only questions that unlock a result are asked; every
// one can be skipped, and 不确定 is saved as unknown, never as "no". In the pane each answer saves on its own:
// a text field on Enter, a choice on the press (the route merges, so an untouched fact stays untouched).

import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from '../../types.ts'
import { Choice, Err, Field, LABEL, Note, Subhead } from './ui.tsx'
import type { Focus, Journey, JourneyQuestion, RiskFact } from './types.ts'
import { errorOf, setSub, sub } from './util.ts'

type Answer = 'yes' | 'no' | 'unsure'

const ANSWERS: ReadonlyArray<{ value: Answer; label: string }> = [
  { value: 'yes', label: '是' },
  { value: 'no', label: '否' },
  { value: 'unsure', label: '不确定' },
]

const RISK_FALLBACK: ReadonlyArray<{ key: RiskFact; zh: string; menOnly?: boolean }> = [
  { key: 'smoker', zh: '现在吸烟' },
  { key: 'diabetes', zh: '有糖尿病' },
  { key: 'bp_treated', zh: '两周内用过降压药' },
  { key: 'north', zh: '住在北方（长江以北）' },
  { key: 'urban', zh: '住在城市', menOnly: true },
  { key: 'family_history', zh: '父母或兄弟姐妹有心梗或脑卒中', menOnly: true },
]

const FOCUS_FALLBACK: ReadonlyArray<{ key: Focus; label_zh: string }> = [
  { key: 'bioage', label_zh: '身体年龄' },
  { key: 'cardio', label_zh: '心血管' },
  { key: 'glucose', label_zh: '血糖' },
  { key: 'weight', label_zh: '体重' },
  { key: 'sleep', label_zh: '睡眠' },
  { key: 'plan', label_zh: '方案效果' },
]

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧']

function facts(journey: Journey): JourneyQuestion[] {
  const fromServer = (journey.profile.questions ?? []).filter((row) => row.key !== 'age' && row.key !== 'sex')
  if (fromServer.length > 0) return fromServer
  return RISK_FALLBACK.map((row) => ({ key: row.key, label_zh: row.zh, unlocks_zh: '心血管风险', answered: false, ...(row.menOnly ? { men_only: true } : {}) }))
}

function answerOf(journey: Journey, key: RiskFact): Answer | '' {
  if ((journey.profile.riskUnknown ?? []).includes(key)) return 'unsure'
  const value = journey.profile.risk[key]
  return value === true ? 'yes' : value === false ? 'no' : ''
}

function unlockOf(journey: Journey, key: 'age' | 'sex'): string {
  return journey.profile.questions.find((row) => row.key === key)?.unlocks_zh || '身体年龄、心血管风险'
}

async function save(ctx: Ctx, body: Record<string, unknown>, done = '档案已保存。'): Promise<boolean> {
  setSub(ctx, 'pf.error', '')
  const out = await ctx.act.post('profile', body, { reload: ['journey'], done, quiet: true })
  if (!out.ok) setSub(ctx, 'pf.error', `保存失败：${errorOf(out.json, '请稍后再试')}`)
  return out.ok
}

/** One line for the closed fold. */
export function basicsSummary(journey: Journey | null): string {
  if (!journey) return ''
  const p = journey.profile
  const sex = p.sex === 'male' ? '男' : p.sex === 'female' ? '女' : ''
  const answered = facts(journey).filter((row) => answerOf(journey, row.key as RiskFact) !== '').length
  const focus = p.focus.map((key) => (journey.focus_options.length ? journey.focus_options : FOCUS_FALLBACK).find((row) => row.key === key)?.label_zh ?? key)
  const parts = [p.age != null ? `${p.age} 岁` : '', sex, `已回答 ${answered} 项`, focus.length ? `关心${focus.join('、')}` : '']
  const text = parts.filter(Boolean).join(' · ')
  return p.age == null && !sex && answered === 0 ? '还没有填写' : text
}

export function Basics(ctx: Ctx, journey: Journey): Node[] {
  const E = ctx.E
  const { Box, Text, Button } = E
  const p = journey.profile
  const thisYear = Number(ctx.today.slice(0, 4))
  const female = p.sex === 'female'
  const list = facts(journey)
  const answered = list.filter((row) => answerOf(journey, row.key as RiskFact) !== '').length
  const options = journey.focus_options.length > 0 ? journey.focus_options : FOCUS_FALLBACK

  const saveAge = (text: string) => {
    const trimmed = text.trim()
    setSub(ctx, 'pf.d.age', '')
    if (trimmed === '' || trimmed === (p.age == null ? '' : String(p.age))) return
    const value = Number(trimmed)
    if (!Number.isInteger(value) || value < 0 || value > 130) {
      setSub(ctx, 'pf.d.age', trimmed)
      setSub(ctx, 'pf.error', '年龄请填写整数，例如 52。')
      return
    }
    // A birth year that no longer fits the age is dropped rather than left to disagree with it.
    const stale = value !== null && p.birthYear != null && Math.abs(thisYear - p.birthYear - value) > 1
    void save(ctx, { age: value, ...(stale ? { birthYear: null } : {}) })
  }
  const saveYear = (text: string) => {
    const trimmed = text.trim()
    setSub(ctx, 'pf.d.year', '')
    if (trimmed === '' || trimmed === (p.birthYear == null ? '' : String(p.birthYear))) return
    const year = Number(trimmed)
    if (!Number.isInteger(year) || year < 1900 || year > thisYear) {
      setSub(ctx, 'pf.d.year', trimmed)
      setSub(ctx, 'pf.error', '出生年份请填写四位数，例如 1968。')
      return
    }
    void save(ctx, { birthYear: year, age: thisYear - year })
  }
  const toggleFocus = (key: Focus) => {
    const has = p.focus.includes(key)
    void save(ctx, { focus: has ? p.focus.filter((item) => item !== key) : [...p.focus, key] }, has ? '已取消。' : '已加入。')
  }

  const factRow = (row: JourneyQuestion): RenderElement => {
    const key = row.key as RiskFact
    const note = `解锁：${row.unlocks_zh || '心血管风险'}${row.men_only ? (female ? ' · 女性公式不使用此项，可跳过' : ' · 只用于男性的公式') : ''}`
    return (
      <Box key={`fact-${key}`} flexDirection="column" marginTop={0}>
        <Text wrap="wrap">{row.label_zh}</Text>
        <Box flexDirection="row" gap={2} paddingLeft={2} flexWrap="wrap">
          {Choice(E, `rf-${key}`, ANSWERS, answerOf(journey, key), (value) => {
            void save(ctx, { risk: { [key]: value === 'yes' ? true : value === 'no' ? false : null } }, '已保存。')
          })}
          <Text dimColor>{note}</Text>
        </Box>
      </Box>
    )
  }

  return [
    Field(ctx, { key: 'pf-name', label: '称呼', value: p.displayName, placeholder: '页面中对你的称呼（选填）', onSubmit: (value) => { if (value.trim() && value.trim() !== p.displayName) void save(ctx, { displayName: value.trim().slice(0, 40) }) } }),
    Field(ctx, { key: 'pf-age', label: '年龄（周岁）', value: sub(ctx, 'pf.d.age') || (p.age == null ? '' : String(p.age)), placeholder: '例如 52', onSubmit: saveAge }),
    Field(ctx, { key: 'pf-year', label: '出生年份', value: sub(ctx, 'pf.d.year') || (p.birthYear == null ? '' : String(p.birthYear)), placeholder: '例如 1968（选填）', onSubmit: saveYear }),
    Choice(E, 'pf-sex', [{ value: 'male', label: '男' }, { value: 'female', label: '女' }], p.sex === 'male' || p.sex === 'female' ? p.sex : '', (value) => { void save(ctx, { sex: value }) }, '性别'),
    <Text key="pf-unlock" dimColor>{`${' '.repeat(LABEL + 2)}解锁：${unlockOf(journey, 'age')}`}</Text>,
    Note(E, '改好一项按回车就保存；选项点一下就保存。', 'pf-how'),
    Err(E, sub(ctx, 'pf.error'), 'pf-err'),
    Subhead(E, '心血管风险还需要这 6 项', 'pf-facts-head'),
    Note(E, `已回答 ${answered} 项。如不确定，请选择「不确定」，不会按「否」处理。`, 'pf-facts-note'),
    ...list.map(factRow),
    Subhead(E, '你最关心什么', 'pf-focus-head', '可多选，按选择顺序排列'),
    <Box key="pf-focus" flexDirection="row" gap={2} flexWrap="wrap">
      {options.map((option) => {
        const index = p.focus.indexOf(option.key)
        return (
          <Button
            key={`focus-${option.key}`}
            plain
            label={`${index >= 0 ? (CIRCLED[index] ?? '●') : '○'} ${option.label_zh}`}
            {...(index >= 0 ? {} : { dimColor: true })}
            onPress={() => toggleFocus(option.key)}
          />
        )
      })}
    </Box>,
    p.complete ? Note(E, '已是最新', 'pf-fresh') : null,
  ]
}
