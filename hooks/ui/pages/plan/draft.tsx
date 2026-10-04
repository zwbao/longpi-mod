// The plan draft (方案草稿): what LongPi proposes from the person's own results and the trial evidence,
// before anything is saved. Each item shows what to do and one line of evidence; the population, DOI and
// the goals open on request. The person drops items (saved, so a dropped item stays out of later drafts),
// then adopts the rest after a confirmation that lists exactly what will be saved and offers the evening
// reminder (client/plan-draft.ts, plan.ts PlanStart).

import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from '../../types.ts'
import { C, fit, pad, routeState, Section, Tag, zh } from '../../kit.tsx'
import { behaviorOf, chineseDate, datesZh, fmt, plainUnits } from './format.ts'
import { Fold, isOn } from './shared.tsx'
import type { DraftGoal, DraftItem, FollowupResponse, Journey, PlanDraft, PlanDraftResponse } from './types.ts'

export const DRAFT_PROMPT = '帮我制定一份改善方案'

const METRIC_ZH: Record<string, string> = { dailySteps: '每日步数', dailyTotalSleepTime: '每晚睡眠' }
const UNIT_ZH: Record<string, string> = { count: '步', hours: '小时' }

/** Values as the server stated them (up to two decimals): what is shown is what gets saved. */
const num = (value: number) => fmt(value, 2)

/** The follow-up the adoption turns on: desktop only, no health values. */
const REMIND_BODY = { enabled: true, desktop: true, detail: 'minimal' }

const DRAFT_ROUTES = ['plan-draft', 'tracking', 'followup'] as const

/** The draft's notes shown at once; the rest open on request. */
const NOTES_SHOWN = 3

function targetText(target: NonNullable<DraftItem['target']>): string {
  return `手环自动记录：${METRIC_ZH[target.metric] ?? target.metric} ${target.op === '>=' ? '≥' : '≤'} ${num(target.value)} ${UNIT_ZH[target.unit] ?? target.unit}`
}

function covers(items: DraftItem[], goal: DraftGoal): boolean {
  return items.some((item) => item.markers.includes(goal.marker))
}

/** A goal goes with the item it came from: dropped with it, never based on an effect the person did not see. */
export function keptGoals(draft: PlanDraft, kept: DraftItem[]): DraftGoal[] {
  return draft.goals.filter((goal) => goal.basis_item_id
    ? kept.some((item) => item.id === goal.basis_item_id)
    : !covers(draft.items, goal) || covers(kept, goal))
}

/** Whether to offer the evening reminder, and at what time: not when it is on, nor without desktop notices. */
function reminderOffer(data: FollowupResponse | null): { time: string } | null {
  if (data && !data.platform_desktop) return null
  if (data && data.settings.enabled && (data.settings.desktop || data.settings.webhook)) return null
  return { time: data?.settings.checkin_time ?? '21:00' }
}

function errorOf(json: Record<string, unknown>, fallback: string): string {
  const problems = Array.isArray(json.problems) ? (json.problems as unknown[]).map(String).join(' ') : ''
  return problems || (typeof json.error === 'string' && json.error ? json.error : fallback)
}

/** 去掉 and 恢复, saved on the server so a removed item stays out of every later draft. */
async function setExcluded(ctx: Ctx, item: { id: string; title: string }, excluded: boolean): Promise<void> {
  ctx.act.setSub('plan.draftbusy', '1')
  const out = await ctx.act.post('plan-draft/exclude', { id: item.id, title: item.title, excluded }, { reload: ['plan-draft'], quiet: true })
  ctx.act.setSub('plan.draftbusy', '')
  if (out.ok) ctx.act.toast(excluded ? `已移除「${fit(item.title, 20)}」，后续草稿不会再加入此项。` : `已恢复「${fit(item.title, 20)}」。`)
  else ctx.act.toast(`${excluded ? '保存' : '恢复'}失败：${errorOf(out.json, '保存失败')}`)
}

/** Save the kept items (and the goals that still have their item), then turn the reminder on if asked. */
async function accept(ctx: Ctx, draft: PlanDraft, kept: DraftItem[], remind: boolean): Promise<void> {
  ctx.act.setSub('plan.draftbusy', '1')
  ctx.act.setSub('plan.drafterr', '')
  const goals = keptGoals(draft, kept)
  const out = await ctx.act.post('plan-draft/accept', { draft: { ...draft, items: kept, goals } }, { reload: remind ? [] : DRAFT_ROUTES, quiet: true })
  if (!out.ok) {
    ctx.act.setSub('plan.drafterr', `保存失败：${errorOf(out.json, '请稍后再试')}`)
    ctx.act.setSub('plan.draftbusy', '')
    return
  }
  let reminder: string | null = null
  if (remind) {
    const saved = await ctx.act.post('followup', REMIND_BODY, { reload: DRAFT_ROUTES, quiet: true })
    if (!saved.ok) reminder = errorOf(saved.json, '未能开启')
  }
  const plan = (out.json.plan ?? {}) as { version?: number; items?: number }
  ctx.act.setSub('plan.confirm', '')
  ctx.act.setSub('plan.draft', '')
  ctx.act.setSub('plan.draftbusy', '')
  ctx.act.toast(`已保存为方案第 ${plan.version ?? 1} 版，共 ${plan.items ?? kept.length} 项。${reminder ? `打卡提醒没有打开：${reminder}` : remind ? '每晚会提醒你打卡。' : ''}`)
}

function Hint(ctx: Ctx, key = 'hint'): RenderElement {
  const { Box, Text, Button } = ctx.E
  return (
    <Box key={key} flexDirection="row" gap={1} flexWrap="wrap">
      <Text dimColor>{`如需调整，请在对话中提出「${DRAFT_PROMPT}」`}</Text>
      <Button key={`${key}-say`} plain label="让 Pi 帮我调整" onPress={() => ctx.act.say(DRAFT_PROMPT)} />
    </Box>
  )
}

function ItemCard(ctx: Ctx, item: DraftItem, busy: boolean, index: number): RenderElement {
  const { Box, Text, Button } = ctx.E
  const inner = ctx.width - 4
  // A caution the detail already says is said once, in the warning colour.
  const what = item.cautions_zh.reduce((text, caution) => text.replace(caution, '').replace(/[；;，,。\s]+$/, '。').replace(/^[；;，,。\s]+/, ''), behaviorOf(item)).replace(/^。$/, '')
  const foldKey = `plan.ev.${item.id}`
  const { evidence, target } = item
  const more = Boolean(evidence.population || evidence.doi || target)
  return (
    <Box key={`d-${item.id}`} flexDirection="column" marginTop={index > 0 ? 1 : 0}>
      <Box flexDirection="row" justifyContent="space-between">
        <Box flexDirection="row" gap={1} flexWrap="wrap" width={Math.max(10, inner - 9)}>
          {item.category_zh ? Tag(ctx.E, item.category_zh, C.teal, 'cat') : null}
          <Text key="title" bold>{item.title}</Text>
          {item.needs_doctor ? Tag(ctx.E, '需先与医生确认', C.warn, 'doctor') : null}
        </Box>
        <Button key={`drop-${item.id}`} plain dimColor label="✕ 移除" onPress={() => { if (!busy) void setExcluded(ctx, item, true) }} />
      </Box>
      {what ? <Text key="what" wrap="wrap">{zh(plainUnits(what))}</Text> : null}
      <Box key="ev" flexDirection="row" gap={1}>
        <Text color={C.accent}>⚗</Text>
        <Box width={Math.max(10, inner - 2)}><Text wrap="wrap">{zh(plainUnits(evidence.expected_zh || '有研究证据支持'))}</Text></Box>
      </Box>
      {item.cautions_zh.map((text, i) => <Text key={`caution${i}`} color={C.warn} wrap="wrap">{zh(`! ${text}`)}</Text>)}
      {more ? Fold(ctx, foldKey, '证据', `fold-ev-${item.id}`) : null}
      {more && isOn(ctx, foldKey)
        ? (
            <Box key="more" flexDirection="column" paddingLeft={2}>
              {evidence.population ? <Text key="pop" dimColor wrap="wrap">{zh(`试验人群：${evidence.population}`)}</Text> : null}
              {evidence.doi ? <Text key="doi" dimColor wrap="wrap">{zh(`文献：doi:${evidence.doi}${evidence.verified ? '' : '（数据待核对）'}`)}</Text> : null}
              {target ? <Text key="target" dimColor wrap="wrap">{zh(targetText(target))}</Text> : null}
              <Text key="avg" dimColor>这是试验里的平均效果，个人结果会不同。</Text>
            </Box>
          )
        : null}
    </Box>
  )
}

/** The dropped items, each a button that puts it back. */
function Removed(ctx: Ctx, rows: Array<{ id: string; title: string }>, busy: boolean): Node {
  const { Box, Text, Button } = ctx.E
  if (rows.length === 0) return null
  return (
    <Box key="removed" flexDirection="row" gap={1} flexWrap="wrap" marginTop={1}>
      <Text dimColor>已移除：</Text>
      {rows.map((row) => (
        <Button key={`restore-${row.id || row.title}`} plain dimColor label={`+ ${fit(row.title, 24)}`} onPress={() => { if (!busy) void setExcluded(ctx, row, false) }} />
      ))}
    </Box>
  )
}

function Priorities(ctx: Ctx, brief: PlanDraftResponse['brief'], today: string, open: boolean): Node {
  const { Box, Text } = ctx.E
  const rows = brief.priorities
  if (rows.length === 0) return null
  const shown = open || isOn(ctx, 'plan.why')
  return (
    <Box key="why" flexDirection="column">
      {open ? <Text key="h" bold>为什么是这几项</Text> : Fold(ctx, 'plan.why', '为什么是这几项', 'fold-why')}
      {shown
        ? rows.map((row, i) => (
            <Box key={`pr${i}`} flexDirection="column" paddingLeft={2}>
              <Box flexDirection="row" gap={1}>
                <Text>{`${i + 1}. ${row.label_zh}`}</Text>
                {row.value != null ? <Text bold>{plainUnits(`${num(row.value)} ${row.unit}`)}</Text> : null}
              </Box>
              <Text dimColor wrap="wrap">{zh(`   ${[row.why_zh, row.date ? `${chineseDate(row.date, today)}的记录` : ''].filter(Boolean).join(' · ')}`)}</Text>
            </Box>
          ))
        : null}
    </Box>
  )
}

function Goals(ctx: Ctx, goals: DraftGoal[], dropped: number): Node {
  const { Box, Text } = ctx.E
  if (goals.length === 0 && dropped === 0) return null
  const inner = ctx.width - 4
  return (
    <Box key="goals" flexDirection="column">
      {Fold(ctx, 'plan.goals', `目标（${goals.length} 个，按试验平均效应估算）`, 'fold-goals')}
      {isOn(ctx, 'plan.goals')
        ? goals.map((goal) => (
            <Box key={`g-${goal.marker}`} flexDirection="column" paddingLeft={2}>
              <Box flexDirection="row" justifyContent="space-between" width={inner - 2}>
                <Text bold>{goal.marker}</Text>
                <Text>{plainUnits(`${num(goal.value)} ${goal.unit}`)}</Text>
              </Box>
              {goal.basis_zh ? <Text dimColor wrap="wrap">{zh(plainUnits(goal.basis_zh))}</Text> : null}
            </Box>
          ))
        : null}
      {isOn(ctx, 'plan.goals') && dropped > 0 ? <Text key="dropped" dimColor>{`  已移除项目对应的 ${dropped} 个目标也不会保存。`}</Text> : null}
    </Box>
  )
}

/** The confirmation: what will be saved, the doctor note, the evening reminder, 确认采用 / 暂不采用. */
function Confirm(ctx: Ctx, draft: PlanDraft, kept: DraftItem[], journey: Journey, followup: FollowupResponse | null, busy: boolean): RenderElement {
  const { Box, Text, Button } = ctx.E
  const goals = keptGoals(draft, kept)
  const doctor = kept.filter((item) => item.needs_doctor)
  const offer = reminderOffer(followup)
  const remind = offer != null && ctx.view.sub['plan.remind'] !== '0'
  const error = ctx.view.sub['plan.drafterr'] ?? ''
  return (
    <Box key="confirm" flexDirection="column" borderStyle="round" borderColor={C.accent} paddingX={1} marginTop={1}>
      <Text bold>采用这份方案？</Text>
      <Text dimColor wrap="wrap">{zh(`保存为你的方案「${datesZh(draft.title || '改善方案', journey.today)}」，从今天（${chineseDate(journey.today, journey.today)}）开始。此后按项目打卡，并按各项指标安排复测；如需调整，可随时在对话中提出。`)}</Text>
      {kept.map((item) => (
        <Box key={`c-${item.id}`} flexDirection="row" gap={1} flexWrap="wrap">
          <Text>·</Text>
          {item.category_zh ? Tag(ctx.E, item.category_zh, C.teal, 'cat') : null}
          <Text key="t">{item.title}</Text>
          {item.needs_doctor ? Tag(ctx.E, '需先与医生确认', C.warn, 'doc') : null}
        </Box>
      ))}
      {goals.length > 0
        ? <Text key="goals" dimColor wrap="wrap">{zh(plainUnits(`目标：${goals.map((goal) => `${goal.marker} ${num(goal.value)} ${goal.unit}`).join('、')}（按试验平均效应估算，不是个人预测）`))}</Text>
        : null}
      {doctor.length > 0
        ? <Text key="doctor" color={C.warn} wrap="wrap">{zh(`! ${doctor.map((item) => `「${item.title}」`).join('')}需先与医生确认后再开始。方案里不含任何剂量。`)}</Text>
        : null}
      {offer
        ? <Button key="remind" plain label={`${remind ? '[x]' : '[ ]'} 每晚 ${offer.time} 提醒我打卡（不含健康数值）`} onPress={() => ctx.act.setSub('plan.remind', remind ? '0' : '1')} />
        : null}
      {error ? <Text key="err" color={C.bad} wrap="wrap">{zh(error)}</Text> : null}
      <Box key="actions" flexDirection="row" gap={1}>
        <Button key="confirm-no" label="暂不采用" onPress={() => { ctx.act.setSub('plan.confirm', ''); ctx.act.setSub('plan.drafterr', '') }} />
        <Button key="confirm-yes" variant="primary" label={busy ? '保存中…' : '确认采用'} onPress={() => { if (!busy) void accept(ctx, draft, kept, remind) }} />
      </Box>
    </Box>
  )
}

/** The draft as an editor: items with 移除, the dropped ones to put back, goals, why, 采用这份方案. */
function DraftEditor(ctx: Ctx, data: PlanDraftResponse, draft: PlanDraft, journey: Journey, followup: FollowupResponse | null, back: Node): RenderElement {
  const { Box, Text, Button } = ctx.E
  const busy = ctx.view.sub['plan.draftbusy'] === '1'
  const kept = draft.items
  const goals = keptGoals(draft, kept)
  const confirming = ctx.view.sub['plan.confirm'] === '1'
  const error = ctx.view.sub['plan.drafterr'] ?? ''
  const notes = draft.notes_zh
  return Section(ctx.E, {
    key: 'draft',
    title: datesZh(draft.title || '改善方案', journey.today),
    note: `方案草稿 · ${kept.length} 项 · 还没有保存`,
    width: ctx.width,
    tone: C.accent,
    children: [
      back,
      <Text key="intro" dimColor wrap="wrap">按你的检查结果和试验证据起草。每项注明试验里的平均效果，个人结果会不同；你确认后才保存。</Text>,
      kept.length > 0
        ? <Box key="items" flexDirection="column" marginTop={1}>{kept.map((item, i) => ItemCard(ctx, item, busy, i))}</Box>
        : <Text key="none" dimColor wrap="wrap">所有项目均已移除。可恢复其中一项，或在对话中说明希望如何调整。</Text>,
      Removed(ctx, data.removed_items, busy),
      error && !confirming ? <Text key="err" color={C.bad} wrap="wrap">{zh(error)}</Text> : null,
      <Box key="gap" height={1} />,
      Goals(ctx, goals, draft.goals.length - goals.length),
      Priorities(ctx, data.brief, journey.today, false),
      ...notes.slice(0, NOTES_SHOWN).map((text, i) => <Text key={`note${i}`} dimColor wrap="wrap">{zh(`· ${text}`)}</Text>),
      notes.length > NOTES_SHOWN ? Fold(ctx, 'plan.notes', `还有 ${notes.length - NOTES_SHOWN} 条说明`, 'fold-notes') : null,
      ...(isOn(ctx, 'plan.notes') ? notes.slice(NOTES_SHOWN).map((text, i) => <Text key={`note-more${i}`} dimColor wrap="wrap">{zh(`· ${text}`)}</Text>) : []),
      confirming
        ? Confirm(ctx, draft, kept, journey, followup, busy)
        : (
            <Box key="actions" flexDirection="row" gap={1} marginTop={1}>
              {kept.length > 0
                ? <Button key="adopt" variant="primary" label="采用这份方案" onPress={() => { ctx.act.setSub('plan.drafterr', ''); ctx.act.setSub('plan.confirm', '1') }} />
                : null}
            </Box>
          ),
      Hint(ctx),
      <Text key="boundary" dimColor wrap="wrap">{zh(data.brief.boundary_zh || '只起草生活方式；补剂只作为需先与医生确认的选项，不给剂量；不涉及任何处方药。')}</Text>,
    ],
  })
}

/** No draft: the reasons first (a change to show a doctor, no evidence for a focus); the screen is fine print. */
function NoDraft(ctx: Ctx, data: PlanDraftResponse, journey: Journey, back: Node): RenderElement {
  const { Text } = ctx.E
  const brief = data.brief
  const stop = brief.safety.stop_zh ?? ''
  const reasons = stop ? [stop, ...brief.notes_zh.filter((text) => text !== stop)] : brief.notes_zh
  const fine = stop ? [brief.boundary_zh].filter(Boolean) : [...new Set([...reasons.slice(1), ...brief.safety.notes_zh, brief.boundary_zh].filter(Boolean))]
  const busy = ctx.view.sub['plan.draftbusy'] === '1'
  return Section(ctx.E, {
    key: 'draft',
    title: stop ? '请先去看医生，再做方案' : '暂时无法起草方案',
    note: '方案草稿',
    width: ctx.width,
    tone: stop ? C.warn : C.dim,
    children: [
      back,
      stop
        ? <Text key="stop" color={C.warn} wrap="wrap">{zh(`! ${reasons[0]}`)}</Text>
        : <Text key="why" wrap="wrap">{zh(reasons[0] || '你的记录中暂无与研究证据匹配的指标。')}</Text>,
      ...fine.map((text, i) => <Text key={`fine${i}`} dimColor wrap="wrap">{zh(text)}</Text>),
      stop ? null : Priorities(ctx, brief, journey.today, true),
      stop ? null : Removed(ctx, data.removed_items, busy),
      stop ? null : Hint(ctx),
    ],
  })
}

/** The plan section's draft: loading, failed, none possible, or the editor. */
export function DraftCard(ctx: Ctx, journey: Journey, withBack: boolean): RenderElement {
  const { Text, Button } = ctx.E
  const back = withBack
    ? <Button key="back" plain label="← 回到当前方案" onPress={() => { ctx.act.setSub('plan.draft', ''); ctx.act.setSub('plan.confirm', '') }} />
    : null
  const state = routeState(ctx, 'plan-draft')
  if (state.kind === 'loading') {
    return Section(ctx.E, {
      key: 'draft', title: '方案草稿', note: '正在按你的结果和研究证据起草…', width: ctx.width,
      children: [back, <Text key="wait" dimColor>正在起草…</Text>],
    })
  }
  if (state.kind === 'error') {
    return Section(ctx.E, {
      key: 'draft', title: '方案草稿', width: ctx.width,
      children: [back, <Text key="err" dimColor wrap="wrap">{zh(`未能读取方案草稿：${state.error || '未返回数据'}。`)}</Text>,
        <Button key="retry" plain label="重试" onPress={() => ctx.act.load(['plan-draft'], true)} />, Hint(ctx)],
    })
  }
  const data = state.json as unknown as PlanDraftResponse
  const followup = ctx.json<FollowupResponse>('followup')
  if (!data.draft) return NoDraft(ctx, { ...data, removed_items: data.removed_items ?? [] }, journey, back)
  return DraftEditor(ctx, { ...data, removed_items: data.removed_items ?? [] }, data.draft, journey, followup, back)
}

/** Stage plan, next to the draft: the person may bring their own plan instead. */
export function PlanStart(ctx: Ctx, journey: Journey): RenderElement {
  const { Box, Text, Button } = ctx.E
  return Section(ctx.E, {
    key: 'plan-start', title: '已经有自己的方案？', width: ctx.width,
    children: [
      <Text key="t" dimColor wrap="wrap">{zh('描述你的方案，或把医生、长寿师提供的方案（PDF 或照片）拖进对话。LongPi 会复述并经你确认后保存，再按各项指标安排复测日，并计算达到目标时的模型估计。')}</Text>,
      <Box key="own" flexDirection="row" gap={1} flexWrap="wrap">
        <Button key="own-describe" label="描述我的方案" onPress={() => ctx.act.fill('我想保存自己的方案：')} />
        <Button key="own-file" label="录入医生给的方案" onPress={() => ctx.act.fill('请帮我录入这份方案（把 PDF 或照片拖进来）：')} />
      </Box>,
      ...journey.suggestions.map((row) => (
        <Button key={`sugg-${row.id}`} plain dimColor label={`› ${pad(row.text_zh, Math.min(60, ctx.width - 8)).trimEnd()}`} onPress={() => ctx.act.say(row.text_zh)} />
      )),
      <Text key="bound" dimColor wrap="wrap">{zh('LongPi 只起草生活方式方案；不会开始、停止或调整任何处方药，也不给药物或补剂的剂量。')}</Text>,
    ],
  })
}
