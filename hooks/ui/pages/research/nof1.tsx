// 个人对照: a personal trial on this computer (science/n-of-1). The person picks how to alternate, the computer
// draws which walk comes first, and the plan comes back as dated blocks. There is no route to read a plan
// again, so the answer is kept in view.sub.
import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from '../../types.ts'
import { C, Section } from '../../kit.tsx'
import { Callout, P, Radio, setSub, sub, subJson } from './bits.tsx'
import { localText, scrubVisible } from './copy.ts'
import { dateOf } from './format.ts'
import type { Community, NOf1Plan, ScheduleBlock } from './science-data.ts'

const DESIGNS = [
  { id: 'abab', label: '轮换：每种走 7 天，中间照常生活 3 天，再来一轮', note: '约 5 周' },
  { id: 'crossover', label: '交叉：每种连续走两周，中间照常生活 7 天，然后对调', note: '约 11 周' },
] as const

const ARM_COLOR: Record<ScheduleBlock['arm'], string> = { morning: C.teal, after_dinner: C.gold, washout: C.dim }
const ARM_GLYPH: Record<ScheduleBlock['arm'], string> = { morning: '█', after_dinner: '▒', washout: '·' }

function days(block: ScheduleBlock): number {
  return Math.max(1, Math.round((Date.parse(`${block.to}T00:00:00Z`) - Date.parse(`${block.from}T00:00:00Z`)) / 86_400_000) + 1)
}

/** 洗脱 in plain words: a few ordinary days that are not compared. */
const plainBlock = (label: string) => label.replace('洗脱期，不纳入比较', '照常生活，不作比较')
const plainProtocol = (text: string) => scrubVisible(localText(text)).replace(/洗脱/g, '照常生活').replace(/本机用种子随机决定/g, '这台电脑随机决定').replace(/，种子不出这台电脑/g, '').replace(/^ABAB：/, '轮换：').replace(/按 ?ABBA ?对调/g, '对调')

export function planOf(ctx: Ctx): NOf1Plan | null {
  return subJson<NOf1Plan>(ctx, 'nof1')
}

function start(ctx: Ctx, design: string): void {
  void ctx.act.post('science/n-of-1', { confirm: true, design }, { done: '个人对照已安排，仅保存在这台电脑上。', quiet: false }).then((res) => {
    if (!res.ok) {
      setSub(ctx, 'nof1.err', String(res.json.error ?? '未能安排个人对照'))
      return
    }
    const { title_zh, protocol_zh, schedule, result_zh, stopping, quest, design: made, carryover_days } = res.json as Record<string, unknown>
    setSub(ctx, 'nof1.err', '')
    setSub(ctx, 'nof1', JSON.stringify({ title_zh, protocol_zh, schedule, result_zh, stopping: stopping ?? null, quest: { title_zh: (quest as { title_zh?: string } | undefined)?.title_zh ?? '' }, design: made, carryover_days }))
  })
}

/** The plan as a strip of days (one cell a day) and dated rows; today's block is marked. */
export function PlanBlock(ctx: Ctx, plan: NOf1Plan, opts: { compact?: boolean } = {}): RenderElement {
  const { Box, Text, Button } = ctx.E
  const width = ctx.width - 4
  const total = plan.schedule.reduce((sum, block) => sum + days(block), 0)
  const scale = total > width - 2 ? (width - 2) / total : 1
  const now = plan.schedule.findIndex((block) => block.from <= ctx.today && ctx.today <= block.to)
  const first = plan.schedule[0]
  const last = plan.schedule[plan.schedule.length - 1]
  const status = first && ctx.today < first.from ? `${dateOf(first.from, ctx.today)}开始` : last && ctx.today > last.to ? '已走完全部安排' : now >= 0 ? `今天：${plainBlock(plan.schedule[now]?.label_zh ?? '')}` : ''
  return (
    <Box key="plan" flexDirection="column" width={width}>
      <Box key="strip" flexDirection="row">
        {plan.schedule.map((block, i) => (
          <Text key={`seg-${i}`} color={ARM_COLOR[block.arm]} bold={i === now}>{ARM_GLYPH[block.arm].repeat(Math.max(1, Math.round(days(block) * scale)))}</Text>
        ))}
      </Box>
      <Box key="legend" flexDirection="row" gap={2}>
        <Text color={C.teal}>█ 早晨走</Text>
        <Text color={C.gold}>▒ 晚饭后走</Text>
        <Text dimColor>· 照常生活</Text>
      </Box>
      {status ? <Text key="status" color={C.accent}>{status}</Text> : null}
      {opts.compact
        ? null
        : plan.schedule.map((block, i) => (
          <Box key={`blk-${i}`} flexDirection="row" gap={1}>
            <Text color={i === now ? C.accent : undefined}>{i === now ? '▶' : ' '}</Text>
            <Text dimColor={block.role === 'washout'}>{`${dateOf(block.from, ctx.today)}–${dateOf(block.to, ctx.today)}`}</Text>
            <Text color={ARM_COLOR[block.arm]} dimColor={block.role === 'washout'}>{plainBlock(block.label_zh)}</Text>
          </Box>
        ))}
      {opts.compact ? null : <Button key="log" plain label="记一次走后血糖（在对话里说）" onPress={() => ctx.act.fill('记录个人对照：今天早晨走 20 分钟，走后血糖 ')} />}
    </Box>
  )
}

/** The plan on the study list, when there is one. */
export function PlanCard(ctx: Ctx): Node {
  const plan = planOf(ctx)
  if (!plan) return null
  const { Button } = ctx.E
  return Section(ctx.E, {
    key: 'myplan', title: '我的个人对照', note: plan.title_zh.replace(/^个人\s*/, ''), width: ctx.width, tone: C.teal,
    children: [
      PlanBlock(ctx, plan, { compact: true }),
      <Button key="open-plan" plain label="查看安排" onPress={() => ctx.act.detail('nof1')} />,
    ],
  })
}

/** The designer: what a personal trial is, how to alternate, start; then the plan it made. */
export function NOf1View(ctx: Ctx, data: Community | null): RenderElement {
  const { Box, Text, Button } = ctx.E
  const width = ctx.width
  const design = sub(ctx, 'nof1.design') || 'abab'
  const plan = planOf(ctx)
  const err = sub(ctx, 'nof1.err')
  const early = data?.early_zh ? localText(data.early_zh) : ''
  return (
    <Box flexDirection="column" width={width}>
      <Button key="back" plain label="← 返回研究" onPress={() => ctx.act.detail(null)} />
      <Text key="title" bold color={C.accent}>个人对照：早晨走和晚饭后走</Text>
      {P(ctx, early || '可以先在这台电脑上做个人对照。', 'early', { dim: true, width: ctx.width })}
      {Section(ctx.E, {
        key: 'design', title: '怎么安排', width,
        children: [
          ...DESIGNS.map((row) => Radio(ctx.E, { key: `design-${row.id}`, label: row.label, note: row.note, on: design === row.id, onPress: () => setSub(ctx, 'nof1.design', row.id) })),
          P(ctx, '先走哪一种由这台电脑随机决定。每次走 20 分钟，比的是你自己记下的走后血糖。照常生活的那几天和每段开头 2 天不作比较。', 'how', { dim: true }),
          P(ctx, '正在打胰岛素或在吃容易让血糖过低的药，请先问医生再做。', 'safety', { color: C.warn }),
          <Box key="acts" flexDirection="row" gap={1} marginTop={1}>
            <Button key="start" variant="primary" label={plan ? '按这个重新安排' : '按这个安排开始'} onPress={() => start(ctx, design)} />
          </Box>,
          err ? Callout(ctx.E, err, 'warn', 'err', width - 4) : null,
        ],
      })}
      {plan
        ? Section(ctx.E, {
          key: 'plan', title: plan.title_zh, width, tone: C.teal,
          children: [
            PlanBlock(ctx, plan),
            P(ctx, plainProtocol(plan.protocol_zh), 'protocol', { dim: true }),
            P(ctx, scrubVisible(localText(plan.result_zh)), 'result'),
            plan.stopping?.reason_zh ? P(ctx, plan.stopping.reason_zh, 'stop', { dim: true }) : null,
            plan.quest?.title_zh ? P(ctx, `走完后记入长寿图鉴足迹：${plan.quest.title_zh}`, 'quest', { color: C.gold }) : null,
          ],
        })
        : null}
    </Box>
  )
}
