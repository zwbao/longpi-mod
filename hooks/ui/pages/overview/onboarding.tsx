// LongPi's setup in the pane (client/onboarding.ts, journey-steps.ts, profile-editor.ts, privacy/consent-screen.ts):
// four short steps drawn as real forms on 总览 — 开始 (what LongPi is, and one consent), 基本信息 (age, sex and the
// six facts the cardiovascular model needs, each skippable as 不确定), 第一份资料 (what the record holds, and how to
// give Claude a report), 第一个结果 (the two results or what blocks them, what can be measured at home now, the
// add-on tests, and the evening check-in reminder). Nothing locks: 先看看总览 puts it off.

import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from '../../types.ts'
import { C, cells } from '../../kit.tsx'
import { recordConnected, type Journey, type RiskFact, type SelfKey } from './journey.ts'
import { AddonList, SelfEntry } from './results.tsx'
import { nb, Callout, Caption, Card, Chip, FoldButton, isOpen, Pair, Para, setSub, sub } from './ui.tsx'
import { chineseDate, chineseMonth, fmt, FOCUS_FALLBACK, inClaude, inPane, RISK_FACTS, riskText, versusAge } from './words.ts'

type Field = (props: Record<string, unknown>) => RenderElement

export const STEP_TITLES = ['欢迎使用 LongPi', '填写基本信息', '添加第一份资料', '你的第一个结果'] as const
const STEP_NAMES = ['开始', '基本信息', '第一份资料', '第一个结果'] as const

/** What to fill the prompt with when the person wants Claude to read a report. */
export const REPORT_PROMPT = '请帮我读取并录入这份体检报告：'

function inputOf(ctx: Ctx): Field | null {
  return 'Input' in ctx.E ? (ctx.E as unknown as { Input: Field }).Input : null
}

/** The step a journey starts at: the first one not done. */
export function autoStep(ctx: Ctx, journey: Journey): number {
  if (!journey.consent.accepted) return 0
  if (!journey.profile.complete) return 1
  if (!(recordConnected(journey.records.status) && journey.records.indicator_count > 0) && sub(ctx, 'noReport') !== '1') return 2
  return 3
}

export function stepOf(ctx: Ctx, journey: Journey): number {
  const chosen = sub(ctx, 'step')
  if (!/^[0-3]$/.test(chosen)) return autoStep(ctx, journey)
  // A step the flow moved to earlier (not one the person picked) gives way once it is done, e.g. the consent
  // given in the chat's dialog: the page goes on to the first open step by itself.
  const auto = autoStep(ctx, journey)
  if (sub(ctx, 'stepPicked') !== '1' && Number(chosen) < auto) return auto
  return Number(chosen)
}

/** Move to a step: `picked` when the person chose it (the stepper, 上一步), so it stays even when done. */
function go(ctx: Ctx, step: number, picked = false): void {
  setSub(ctx, 'stepPicked', picked ? '1' : '')
  setSub(ctx, 'step', String(step))
}

function close(ctx: Ctx): void {
  setSub(ctx, 'step', '')
  setSub(ctx, 'onboarding', '0')
  // Every answer went out in a whole-set save by now: from here the saved profile speaks (the chat may change it).
  for (const key of DRAFT_KEYS) setSub(ctx, key, '')
}

function Stepper(ctx: Ctx, journey: Journey, step: number): RenderElement {
  const { Box, Text, Button } = ctx.E
  const reached = autoStep(ctx, journey)
  return (
    <Box key="stepper" flexDirection="row" justifyContent="space-between" flexWrap="wrap">
      <Box key="steps" flexDirection="row" columnGap={1} flexWrap="wrap">
        {STEP_NAMES.map((name, index) => {
          const mark = index < reached && index !== step ? '✓' : String(index + 1)
          const label = `${mark} ${name}`
          if (index === step) return <Text key={`st${index}`} bold color={C.accent}>{`【${label}】`}</Text>
          if (index <= reached) return <Button key={`st${index}`} plain dimColor={index !== step} label={label} onPress={() => go(ctx, index, true)} />
          return <Text key={`st${index}`} dimColor>{label}</Text>
        })}
      </Box>
      <Button key="ob-later" plain dimColor label="先看看总览 →" onPress={() => close(ctx)} />
    </Box>
  )
}

// --- 1 开始 ------------------------------------------------------------------------------------------

async function agreeAll(ctx: Ctx): Promise<void> {
  setSub(ctx, 'busy', '1')
  const first = await ctx.act.post('consent', { accept: true }, { quiet: true })
  if (first.ok) {
    await ctx.act.post('privacy/consent', { scope: 'pipl_sensitive', decision: 'granted' }, { quiet: true })
    await ctx.act.post('privacy/consent', { scope: 'data_flow_deepseek', decision: 'granted' }, { reload: ['privacy', 'tracking', 'surfaces'], quiet: true })
  }
  setSub(ctx, 'busy', '')
  if (!first.ok) {
    ctx.act.toast(`保存失败：${typeof first.json.error === 'string' ? first.json.error : '请稍后再试'}`)
    return
  }
  ctx.act.toast('已同意，可以开始了。')
  setSub(ctx, 'agree', '')
  go(ctx, 1)
}

function Welcome(ctx: Ctx, journey: Journey): Node[] {
  const { Box, Text, Button } = ctx.E
  const today = journey.today || ctx.today
  const agreed = sub(ctx, 'agree') === '1'
  const busy = sub(ctx, 'busy') === '1'
  const privacy = ctx.json<{ copy?: { pipl?: { title?: string; lead?: string; paragraphs?: string[] } } }>('privacy')
  const pipl = privacy?.copy?.pipl
  const accepted = journey.consent.accepted
  // A family member's folder: the holder agrees on their behalf, having asked them.
  const people = ctx.json<{ active?: string; people?: Array<{ id: string; label_zh: string; demo?: boolean }> }>('people')
  const member = people?.people?.find((row) => row.id === people.active && row.id !== 'self' && !row.demo)?.label_zh ?? ''
  return [
    Para(ctx.E, 'LongPi 帮你管理自己的健康数据：根据体检结果估算身体年龄和 10 年心血管风险，并跟踪你的改善计划执行得怎么样。', ctx.width - 4, { key: 'p1' }),
    Para(ctx.E, '它只提供健康管理参考，不做诊断，不开处方，也不给出用药剂量。', ctx.width - 4, { key: 'p2' }),
    Para(ctx.E, '档案和记录只保存在这台电脑上。你交给 Claude 的报告和问题会像平时用 Claude 一样发给它处理；LongPi 自己附上的是回答需要的健康数值。', ctx.width - 4, { key: 'p3' }),
    pipl
      ? (
        <Box key="pipl" flexDirection="column">
          {FoldButton(ctx, 'pipl', pipl.title ?? '单独同意：处理你的健康信息')}
          {isOpen(ctx, 'pipl')
            ? (
              <Box key="body" flexDirection="column" paddingLeft={2}>
                {pipl.lead ? Caption(ctx.E, inClaude(pipl.lead), 'lead', ctx.width - 6) : null}
                {(pipl.paragraphs ?? []).map((line, i) => Para(ctx.E, inClaude(line), ctx.width - 6, { key: `pp${i}` }))}
              </Box>
            )
            : null}
        </Box>
      )
      : null,
    accepted
      ? (
        <Box key="done" flexDirection="column" marginTop={1}>
          <Text key="t" color={C.good}>{`✓ 已同意${journey.consent.accepted_at ? `（${chineseDate(journey.consent.accepted_at, today)}）` : ''}`}</Text>
          <Box key="a" flexDirection="row" gap={1} marginTop={1}>
            <Button key="ob-next" variant="primary" label="下一步" onPress={() => go(ctx, 1)} />
          </Box>
        </Box>
      )
      : (
        <Box key="agree" flexDirection="column" marginTop={1}>
          <Button key="ob-agree" plain label={member ? `${agreed ? '☑' : '☐'} 我已经告诉${member}，${member}同意 LongPi 按上述方式使用${member}的体检、化验、血压、血糖、体重和用药等健康信息。` : `${agreed ? '☑' : '☐'} 我同意 LongPi 按上述方式使用我的体检、化验、血压、血糖、体重和用药等健康信息。`} onPress={() => setSub(ctx, 'agree', agreed ? '' : '1')} />
          <Text key="c" dimColor>可以随时在「设置」中撤回。</Text>
          <Box key="a" flexDirection="row" gap={1} marginTop={1}>
            <Button key="ob-later2" plain dimColor label="以后再说" onPress={() => close(ctx)} />
            <Button key="ob-start" {...(agreed ? { variant: 'primary' as const } : { dimColor: true })} label={busy ? '正在保存…' : '同意并开始'} onPress={() => { if (!agreed) ctx.act.toast('请先勾选上面的同意。'); else if (!busy) void agreeAll(ctx) }} />
          </Box>
        </Box>
      ),
  ]
}

// --- 2 基本信息 ----------------------------------------------------------------------------------------

type Answer = 'yes' | 'no' | 'unsure' | ''

/**
 * The profile form's answers: what was pressed in this pane (kept in the view state at once), else what is saved.
 * Every save sends the whole set, so an answer is never lost to a save that crossed another.
 */
export const DRAFT_KEYS = ['p.age', 'p.sex', 'p.focus', ...RISK_FACTS.map((row) => `p.f.${row.key}`)]

function answerOf(ctx: Ctx, journey: Journey, key: RiskFact): Answer {
  const draft = sub(ctx, `p.f.${key}`)
  if (draft === 'yes' || draft === 'no' || draft === 'unsure') return draft
  const value = journey.profile.risk[key]
  if (value === true) return 'yes'
  if (value === false) return 'no'
  return (journey.profile.riskUnknown ?? []).includes(key) ? 'unsure' : ''
}

function sexOf(ctx: Ctx, journey: Journey): string {
  return sub(ctx, 'p.sex') || journey.profile.sex
}

function focusOf(ctx: Ctx, journey: Journey): string[] {
  const draft = sub(ctx, 'p.focus')
  if (draft === '-') return []
  return draft ? draft.split(',') : [...journey.profile.focus]
}

function profileBody(ctx: Ctx, journey: Journey, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const risk: Record<string, boolean | null> = {}
  for (const row of RISK_FACTS) {
    const answer = answerOf(ctx, journey, row.key as RiskFact)
    if (answer === '') continue
    risk[row.key] = answer === 'yes' ? true : answer === 'no' ? false : null
  }
  const sex = sexOf(ctx, journey)
  return {
    ...(journey.profile.age != null ? { age: journey.profile.age } : {}),
    ...(sex === 'male' || sex === 'female' ? { sex } : {}),
    risk,
    focus: focusOf(ctx, journey),
    ...extra,
  }
}

function saveProfile(ctx: Ctx, journey: Journey, extra: Record<string, unknown> = {}, done?: string): Promise<boolean> {
  return ctx.act.post('profile', profileBody(ctx, journey, extra), { reload: ['tracking', 'surfaces'], ...(done ? { done } : {}) }).then((answer) => answer.ok)
}

function parseAge(text: string): number | null | 'bad' {
  const trimmed = text.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  return Number.isInteger(value) && value >= 1 && value <= 120 ? value : 'bad'
}

async function saveAge(ctx: Ctx, journey: Journey, text: string): Promise<boolean> {
  const age = parseAge(text)
  if (age === 'bad') {
    ctx.act.toast('年龄请填写整数，例如 52。')
    return false
  }
  if (age == null) return true
  setSub(ctx, 'p.age', '')
  return saveProfile(ctx, journey, { age }, `已保存：${age} 岁。`)
}

function Choice(ctx: Ctx, key: string, label: string, on: boolean, press: () => void): RenderElement {
  const { Button } = ctx.E
  return <Button key={key} {...(on ? { variant: 'primary' as const } : {})} label={on ? `● ${label}` : label} onPress={() => press()} />
}

function BasicInfo(ctx: Ctx, journey: Journey): Node[] {
  const { Box, Text, Button } = ctx.E
  const Input = inputOf(ctx)
  const profile = journey.profile
  const sex = sexOf(ctx, journey)
  const female = sex === 'female'
  const focus = focusOf(ctx, journey)
  const fromServer = profile.questions.filter((row) => row.key !== 'age' && row.key !== 'sex')
  const facts = fromServer.length > 0 ? fromServer : RISK_FACTS.map((row) => ({ key: row.key as RiskFact, label_zh: row.zh, unlocks_zh: '心血管风险', answered: false, men_only: row.menOnly }))
  const answered = facts.filter((row) => answerOf(ctx, journey, row.key as RiskFact) !== '').length
  const unlockAge = profile.questions.find((row) => row.key === 'age')?.unlocks_zh || '身体年龄、心血管风险'
  const focusOptions = journey.focus_options.length > 0 ? journey.focus_options : FOCUS_FALLBACK
  const narrow = ctx.width < 70
  // 保存并继续 moves on at once; the save runs behind (it reruns the methods, which takes seconds), and a
  // failure brings the step back with a message.
  const next = async () => {
    const typed = sub(ctx, 'p.age')
    if (typed && parseAge(typed) === 'bad') {
      ctx.act.toast('年龄请填写整数，例如 52。')
      return
    }
    ctx.act.toast('正在保存基本信息，结果会在后台重新计算…')
    go(ctx, 2)
    const ok = typed ? await saveAge(ctx, journey, typed) : await saveProfile(ctx, journey, {}, '基本信息已保存。')
    if (!ok) {
      ctx.act.toast('基本信息没有保存成功，请再按一次「保存并继续」。')
      go(ctx, 1, true)
    }
  }
  const setFact = (key: string, value: Answer) => {
    setSub(ctx, `p.f.${key}`, value)
    void saveProfile(ctx, journey, { risk: { ...(profileBody(ctx, journey).risk as Record<string, unknown>), [key]: value === 'yes' ? true : value === 'no' ? false : null } })
  }
  const setSex = (value: 'male' | 'female') => {
    setSub(ctx, 'p.sex', value)
    void saveProfile(ctx, journey, { sex: value })
  }
  const toggleFocus = (key: string) => {
    const next = focus.includes(key) ? focus.filter((item) => item !== key) : [...focus, key]
    setSub(ctx, 'p.focus', next.length > 0 ? next.join(',') : '-')
    void saveProfile(ctx, journey, { focus: next })
  }
  return [
    Para(ctx.E, '计算身体年龄需要你的年龄和性别。每个问题都可以跳过；选好就会保存。', ctx.width - 4, { key: 'lead' }),
    <Box key="basics" flexDirection="column" marginTop={1}>
      <Box key="age" flexDirection="row" gap={2} flexWrap="wrap">
        {Input ? Input({ key: 'ob-age', label: '年龄（周岁）', placeholder: profile.age != null ? `${profile.age}（已填，可改）` : '例如 52', submitLabel: '保存', onInput: (v: string) => setSub(ctx, 'p.age', v), onSubmit: (v: string) => { void saveAge(ctx, journey, v) } }) : null}
        {profile.age != null ? <Text key="now" color={C.good}>{`✓ ${profile.age} 岁`}</Text> : null}
      </Box>
      <Box key="sex" flexDirection="row" gap={1}>
        <Text key="l">性别</Text>
        {Choice(ctx, 'ob-sex-m', '男', sex === 'male', () => setSex('male'))}
        {Choice(ctx, 'ob-sex-f', '女', sex === 'female', () => setSex('female'))}
      </Box>
      <Text key="unlock" dimColor>{`解锁：${unlockAge}`}</Text>
    </Box>,
    <Box key="facts" flexDirection="column" marginTop={1}>
      <Text key="h" bold>心血管风险还需要这 6 项</Text>
      {Para(ctx.E, `已回答 ${answered} 项。如不确定，请选择「不确定」，不会按「否」处理。`, ctx.width - 4, { key: 'c', dim: true })}
      {facts.map((row) => {
        const value = answerOf(ctx, journey, row.key as RiskFact)
        const caption = `解锁：${row.unlocks_zh || '心血管风险'}${row.men_only ? (female ? ' · 女性公式不使用此项，可跳过' : ' · 只用于男性的公式') : ''}`
        const buttons = (
          <Box key="b" flexDirection="row" gap={1}>
            {Choice(ctx, `ob-${row.key}-yes`, '是', value === 'yes', () => setFact(row.key, 'yes'))}
            {Choice(ctx, `ob-${row.key}-no`, '否', value === 'no', () => setFact(row.key, 'no'))}
            {Choice(ctx, `ob-${row.key}-unsure`, '不确定', value === 'unsure', () => setFact(row.key, 'unsure'))}
          </Box>
        )
        const side = !narrow && cells(row.label_zh) + 30 <= ctx.width - 4
        return (
          <Box key={`fact-${row.key}`} flexDirection="column">
            {side
              ? <Box key="r" flexDirection="row" justifyContent="space-between"><Text key="l">{row.label_zh}</Text>{buttons}</Box>
              : <Box key="r" flexDirection="column">{Para(ctx.E, row.label_zh, ctx.width - 4, { key: 'l' })}{buttons}</Box>}
            <Text key="u" dimColor>{caption}</Text>
          </Box>
        )
      })}
    </Box>,
    <Box key="focus" flexDirection="column" marginTop={1}>
      <Text key="h"><Text key="a" bold>你最关心什么</Text><Text key="b" dimColor>  可多选，按选择顺序排列</Text></Text>
      <Box key="chips" flexDirection="row" columnGap={1} flexWrap="wrap">
        {focusOptions.map((option) => {
          const index = focus.indexOf(option.key)
          return <Button key={`ob-focus-${option.key}`} {...(index >= 0 ? { variant: 'primary' as const } : {})} label={index >= 0 ? `${index + 1} ${option.label_zh}` : option.label_zh} onPress={() => toggleFocus(option.key)} />
        })}
      </Box>
    </Box>,
    <Box key="act" flexDirection="row" gap={1} marginTop={1}>
      <Button key="ob-back1" plain dimColor label="← 上一步" onPress={() => go(ctx, 0, true)} />
      <Button key="ob-skip1" plain dimColor label="跳过" onPress={() => go(ctx, 2)} />
      <Button key="ob-save1" variant="primary" label="保存并继续" onPress={() => { void next() }} />
    </Box>,
  ]
}

// --- 3 第一份资料 -------------------------------------------------------------------------------------

function FoundTiles(ctx: Ctx, journey: Journey): RenderElement {
  const { Box, Text } = ctx.E
  const today = journey.today || ctx.today
  const records = journey.records
  const summary = records.summary
  const tiles: Array<{ label: string; figure: string; unit: string; caption: string }> = []
  if (summary) {
    const range = summary.first_date && summary.last_date && summary.first_date !== summary.last_date
      ? `${chineseMonth(summary.first_date)} → ${chineseMonth(summary.last_date)}` : summary.last_date ? chineseDate(summary.last_date, today) : ''
    tiles.push({ label: '体检', figure: String(summary.checkups), unit: '次', caption: range })
    tiles.push({ label: '指标', figure: String(records.indicator_count), unit: '项', caption: summary.categories_zh.length > 0 ? `${summary.categories_zh.slice(0, 3).join(' · ')}${summary.categories_zh.length > 3 ? '…' : ''}` : '' })
    tiles.push({ label: '手环', figure: String(summary.wearable_days), unit: '天', caption: summary.wearable_days > 0 ? '近一年有记录的天数' : '没有手环数据' })
  } else {
    tiles.push({ label: '指标', figure: String(records.indicator_count), unit: '项', caption: '' })
    tiles.push({ label: '完整体检', figure: String(records.full_checkups), unit: '次', caption: records.latest_checkup ? `最近 ${chineseDate(records.latest_checkup, today)}` : '九项血检还没有在同一天测齐' })
  }
  return (
    <Box key="tiles" flexDirection="column" marginTop={1}>
      {tiles.map((tile) => (
        <Text key={`tile-${tile.label}`}>
          <Text key="l" dimColor>{`${tile.label}  `}</Text>
          <Text key="f" bold color={C.accent}>{tile.figure}</Text>
          <Text key="u">{` ${tile.unit}`}</Text>
          {tile.caption ? <Text key="c" dimColor>{`   ${tile.caption}`}</Text> : null}
        </Text>
      ))}
    </Box>
  )
}

function Records(ctx: Ctx, journey: Journey): Node[] {
  const { Box, Text, Button } = ctx.E
  const records = journey.records
  const connected = recordConnected(records.status)
  const has = connected && records.indicator_count > 0
  const none = sub(ctx, 'noReport') === '1'
  const rows = journey.changes
  const doctor = rows.some((row) => row.ask_doctor)
  return [
    has
      ? (
        <Box key="found" flexDirection="column">
          <Text key="t" dimColor>已有的体检记录（只读）：</Text>
          {FoundTiles(ctx, journey)}
          {records.status === 'partial' ? Callout(ctx.E, `部分记录本次未读取到${records.read_errors[0] ? `：${records.read_errors[0]}` : ''}。这些指标并非未检测，请稍后在总览上方点「刷新」。`, 'warn', 'partial') : null}
          {rows.length > 0
            ? (
              <Box key="changes" flexDirection="row" gap={1} marginTop={1}>
                <Text key="m" color={doctor ? C.warn : C.accent}>{doctor ? '!' : 'i'}</Text>
                <Text key="t" wrap="wrap"><Text key="a" bold>{nb(`值得注意：${rows.length} 项指标的变化超出正常波动`)}</Text>{nb(` · ${rows.slice(0, 3).map((row) => row.label_zh).join('、')}${rows.length > 3 ? ' 等' : ''}`)}</Text>
              </Box>
            )
            : null}
        </Box>
      )
      : records.status === 'error'
        ? Para(ctx.E, `记录读取失败：${records.error || '没有返回原因'}`, ctx.width - 4, { key: 'err', color: C.bad })
        : <Text key="none" dimColor>还没有体检记录。</Text>,
    <Box key="how" flexDirection="column" marginTop={1}>
      <Text key="h" bold>{has ? '再添加一份报告' : '添加第一份报告'}</Text>
      {Para(ctx.E, '把体检或化验报告交给 Claude：在下面的对话框里粘贴报告的文件路径，或把 PDF、照片拖进来。Claude 会读出其中的指标，存进这台电脑上的档案，算出你的结果。', ctx.width - 4, { key: 't' })}
      <Box key="a" flexDirection="row" columnGap={1} marginTop={1} flexWrap="wrap">
        <Button key="ob-report" {...(has ? {} : { variant: 'primary' as const })} label="请 Claude 读取我的报告" onPress={() => ctx.act.fill(REPORT_PROMPT)} />
        {!has && !none ? <Button key="ob-noreport" plain label="我现在没有报告 →" onPress={() => setSub(ctx, 'noReport', '1')} /> : null}
      </Box>
      {Para(ctx.E, `按下后，对话框里会写好「${REPORT_PROMPT}」，在后面粘贴文件路径或拖入文件，再按回车发送。`, ctx.width - 4, { key: 'c', dim: true })}
    </Box>,
    none && !has
      ? (
        <Box key="none-note" flexDirection="column" borderStyle="single" borderColor={C.accent} paddingX={1} marginTop={1}>
          <Text key="t" bold>没有报告也可以先开始：</Text>
          <Text key="a">• 记录一次血压或腰围</Text>
          {Para(ctx.E, '• 在对话里说说你想改善什么（睡眠、体重、血糖……）', ctx.width - 4, { key: 'b' })}
          {Para(ctx.E, '以后拿到体检报告，随时交给 Claude 录入。', ctx.width - 4, { key: 'c', dim: true })}
        </Box>
      )
      : null,
    <Box key="act" flexDirection="row" gap={1} marginTop={1}>
      <Button key="ob-back2" plain dimColor label="← 上一步" onPress={() => go(ctx, 1, true)} />
      <Button key="ob-next2" {...(has || none ? { variant: 'primary' as const } : {})} label="下一步" onPress={() => go(ctx, 3)} />
    </Box>,
  ]
}

// --- 4 第一个结果 -------------------------------------------------------------------------------------

/** plan-draft.ts: offer the evening reminder unless it is on, or the computer cannot show notifications. */
const REMIND_BODY = { enabled: true, desktop: true, detail: 'minimal' }

function ReminderOffer(ctx: Ctx): Node {
  const data = ctx.json<{ settings?: { enabled?: boolean; desktop?: boolean; webhook?: unknown; checkin_time?: string }; platform_desktop?: boolean }>('followup')
  const { Box, Text, Button } = ctx.E
  const time = data?.settings?.checkin_time ?? '21:00'
  if (data && data.platform_desktop === false) return null
  if (data?.settings?.enabled && (data.settings.desktop || data.settings.webhook)) {
    return <Text key="remind" color={C.good}>{`✓ 每晚 ${time} 会提醒你打卡（不含健康数值）。`}</Text>
  }
  return (
    <Box key="remind" flexDirection="row" columnGap={1} flexWrap="wrap" marginTop={1}>
      <Text key="t">{`每晚 ${time} 提醒我打卡（不含健康数值）`}</Text>
      <Button key="ob-remind" label="开启提醒" onPress={() => { void ctx.act.post('followup', REMIND_BODY, { reload: ['followup'], done: '打卡提醒已开启。' }) }} />
    </Box>
  )
}

function ResultCell(ctx: Ctx, journey: Journey, which: 'bioage' | 'risk', width: number): RenderElement {
  const { Box, Text } = ctx.E
  const { bioage, risk } = journey.results
  const title = which === 'bioage' ? '身体年龄 · 模型估计' : '10 年心血管风险 · 模型估计'
  const ok = which === 'bioage' ? bioage.status === 'ok' : risk.status === 'ok'
  const children: Node[] = ok
    ? which === 'bioage'
      ? [
        <Text key="f"><Text key="n" bold color={C.accent}>{fmt(bioage.phenoage)}</Text><Text key="u"> 岁</Text></Text>,
        Para(ctx.E, bioage.headline_zh ? bioage.headline_zh : (bioage.allows_younger ? versusAge(bioage.advance, bioage.checkups) : ''), width - 4, { key: 'h', dim: true }),
        bioage.caveat_zh ? Callout(ctx.E, bioage.caveat_zh, 'warn', 'cv') : null,
      ]
      : [
        <Box key="f" flexDirection="row" gap={1}><Text key="n" bold color={C.accent}>{riskText(risk.risk_pct)}</Text><Text key="u">%</Text>{risk.category_zh ? Chip(ctx.E, risk.category_zh, 'neutral', 'cat') : null}</Box>,
      ]
    : [
      <Text key="w" bold dimColor>暂时无法计算</Text>,
      Para(ctx.E, inPane(which === 'bioage' ? bioage.blocker_zh : risk.blocker_zh), width - 4, { key: 'b', dim: true }),
    ]
  return Card(ctx, { key: `first-${which}`, title, width, children })
}

/** self-measure.ts SelfLatestList in one line: what was measured at home, blood pressure as one reading or mean. */
function SelfLatestLine(ctx: Ctx, journey: Journey): Node {
  const latest = journey.self.latest
  const rows = latest.filter((row) => row.key !== 'dbp')
  if (rows.length === 0) return null
  const { Text } = ctx.E
  const today = journey.today || ctx.today
  const text = rows.map((row) => {
    if (row.key === 'sbp') {
      const dbp = latest.find((item) => item.key === 'dbp')
      return `家庭血压 ${fmt(row.value)}${dbp ? `/${fmt(dbp.value)}` : ''} ${row.unit}（${row.n > 1 ? `7 天均值 · ${row.n} 次` : '1 次读数'}）`
    }
    return `${row.label_zh} ${fmt(row.value)} ${row.unit}（${chineseDate(row.date, today)}）`
  }).join(' · ')
  return Para(ctx.E, `已记录：${text}`, ctx.width - 4, { key: 'self-latest', color: C.teal })
}

function FirstResult(ctx: Ctx, journey: Journey): Node[] {
  const { Box, Text, Button } = ctx.E
  const { bioage, risk } = journey.results
  const blocked = bioage.status !== 'ok' || risk.status !== 'ok'
  const selfRows = journey.addons.filter((row) => row.self_measurable && row.self_key && row.self_key !== 'dbp')
  const lab = journey.addons.filter((row) => !row.self_measurable)
  const showAddons = isOpen(ctx, 'ob.addons')
  const done = bioage.status === 'ok' && risk.status === 'ok'
  return [
    Pair(ctx, 'first', (w) => ResultCell(ctx, journey, 'bioage', w), (w) => ResultCell(ctx, journey, 'risk', w)),
    SelfLatestLine(ctx, journey),
    done ? Para(ctx.E, '两个结果都算出来了。之后每次有新的体检，LongPi 会按正常波动范围告诉你哪些是真实的变化。', ctx.width - 4, { key: 'cheer', color: C.good }) : null,
    blocked
      ? (
        <Box key="now" flexDirection="column">
          <Text key="h" bold>现在就能做的事</Text>
          {selfRows.map((row, i) => (
            <Box key={`self${i}`} flexDirection="column" marginTop={1}>
              <Text key="t"><Text key="i" color={C.teal}>◆ </Text><Text key="a" bold>{`测量${row.self_key === 'sbp' ? '血压' : row.item_zh}`}</Text><Text key="b" dimColor>{`  填写后即可计算${row.unlocks_zh}`}</Text></Text>
              <Box key="in" paddingLeft={2}>{SelfEntry(ctx, journey, row.self_key as SelfKey, `onb${i}`)}</Box>
            </Box>
          ))}
          <Box key="plan" flexDirection="column" marginTop={1}>
            <Text key="t"><Text key="i" color={C.gold}>✦ </Text><Text key="a" bold>制定改善方案</Text></Text>
            {Para(ctx.E, '　按你关心的方面，从收录的试验证据里起草；你确认后才保存。', ctx.width - 4, { key: 'c', dim: true })}
            <Box key="b" paddingLeft={2}><Button key="ob-plan" label="起草方案" onPress={() => ctx.act.go('plan')} /></Box>
          </Box>
          {lab.length > 0
            ? (
              <Box key="lab" flexDirection="column" marginTop={1}>
                <Text key="t"><Text key="i" color={C.silver}>◇ </Text><Text key="a" bold>{`下次体检加测${lab.slice(0, 2).map((row) => row.item_zh).join('、')}${lab.length > 2 ? ' 等' : ''}`}</Text></Text>
                <Text key="c" dimColor wrap="wrap">{nb(`　加测后即可计算${[...new Set(lab.map((row) => row.unlocks_zh))].join('、')}`)}</Text>
                <Box key="b" paddingLeft={2}><Button key="ob-addons" label={showAddons ? '收起加测清单' : '加测清单'} onPress={() => setSub(ctx, 'ob.addons', showAddons ? '' : '1')} /></Box>
                {showAddons ? <Box key="list" paddingLeft={2}>{AddonList(ctx, journey, 'onb-list', ctx.width - 6)}</Box> : null}
              </Box>
            )
            : null}
        </Box>
      )
      : null,
    ReminderOffer(ctx),
    <Box key="act" flexDirection="row" gap={1} marginTop={1}>
      <Button key="ob-back3" plain dimColor label="← 上一步" onPress={() => go(ctx, 2, true)} />
      <Button key="ob-finish" variant="primary" label="完成" onPress={() => close(ctx)} />
    </Box>,
  ]
}

export function Onboarding(ctx: Ctx, journey: Journey): RenderElement {
  const { Box } = ctx.E
  const step = stepOf(ctx, journey)
  const body = step === 0 ? Welcome(ctx, journey) : step === 1 ? BasicInfo(ctx, journey) : step === 2 ? Records(ctx, journey) : FirstResult(ctx, journey)
  return (
    <Box key="onboarding" flexDirection="column">
      {Stepper(ctx, journey, step)}
      {Card(ctx, { key: `step${step}`, title: STEP_TITLES[step] ?? '', width: ctx.width, tone: C.accent, titleColor: C.accent, note: `第 ${step + 1} 步，共 4 步`, children: body })}
    </Box>
  )
}
