// 最重要的一步 on 总览 (client/triage/care-card.ts): when the record says to see a doctor first, the values and who
// to see, the one-page brief for the doctor (drawn here, to copy), and 是否已预约？医生意见如何？ answered in place.

import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from '../../types.ts'
import { C } from '../../kit.tsx'
import type { Journey } from './journey.ts'
import { nb, Caption, Card, Para, setSub, sub } from './ui.tsx'
import { careDetail, chineseDate } from './words.ts'
import { markdownToHtml } from '../../printable.ts'

type Field = (props: Record<string, unknown>) => RenderElement

function inputOf(ctx: Ctx): Field | null {
  return 'Input' in ctx.E ? (ctx.E as unknown as { Input: Field }).Input : null
}

async function openBrief(ctx: Ctx): Promise<void> {
  setSub(ctx, 'briefBusy', '1')
  const answer = await ctx.act.post('brief', {}, { reload: ['triage'], quiet: true })
  setSub(ctx, 'briefBusy', '')
  const brief = answer.json.brief as { id?: unknown } | undefined
  if (!answer.ok || typeof brief?.id !== 'string') {
    ctx.act.toast(`简报生成失败：${typeof answer.json.error === 'string' ? answer.json.error : '请稍后再试'}`)
    return
  }
  setSub(ctx, 'briefId', brief.id)
  ctx.act.load([`brief?id=${encodeURIComponent(brief.id)}`], true)
}

/** The family member shown now ('' for the holder), for the file name. */
function whoOf(ctx: Ctx): string {
  const people = ctx.json<{ active?: string; people?: Array<{ id: string; label_zh: string }> }>('people')
  return people?.people?.find((row) => row.id === people.active && row.id !== 'self')?.label_zh ?? ''
}

/** The brief, once made: its text and how to take it along. */
function BriefView(ctx: Ctx, journey: Journey): Node {
  const id = sub(ctx, 'briefId')
  if (!id) return null
  const { Box, Text, Button, Markdown } = ctx.E
  const brief = ctx.json<{ markdown?: string; brief?: { created?: string } }>(`brief?id=${encodeURIComponent(id)}`)
  const markdown = typeof brief?.markdown === 'string' ? brief.markdown : ''
  return Card(ctx, {
    key: 'brief', title: '给医生的一页简报', width: ctx.width - 4, tone: C.accent,
    aside: <Button key="brief-close" plain dimColor label="关闭" onPress={() => setSub(ctx, 'briefId', '')} />,
    children: [
      Caption(ctx.E, '数字来自你的体检记录；姓名一栏留空，打印后手写。这不是诊断。', 'c', ctx.width - 8),
      markdown ? <Markdown key="md" text={markdown.slice(0, 9800)} /> : <Text key="md" dimColor>正在整理…</Text>,
      markdown
        ? (
          <Box key="a" flexDirection="row" gap={1} marginTop={1}>
            <Button key="brief-print" variant="primary" label="存成可打印的网页" onPress={() => { void ctx.act.saveText(markdownToHtml(markdown, 'LongPi 医生简报'), `LongPi 医生简报${whoOf(ctx) ? ` ${whoOf(ctx)}` : ''} ${journey.today || ctx.today}.html`, true) }} />
            <Button key="brief-copy" label="复制简报" onPress={() => ctx.act.copy(markdown)} />
            <Text key="hint" dimColor>网页存进「下载」并在浏览器里打开，按 ⌘P 打印。</Text>
          </Box>
        )
        : null,
    ],
  })
}

function lastText(journey: Journey, today: string): string {
  const last = journey.triage.care.at(-1)
  if (!last) return ''
  if (last.care_status === 'booked') return `已预约 ${chineseDate(last.visit_date, today)}`.trim()
  if (last.care_status === 'declined') return '暂不就诊'
  if (last.care_status === 'visited') return `已就诊 ${chineseDate(last.visit_date, today)}`.trim()
  return ''
}

async function sendVisit(ctx: Ctx, status: 'booked' | 'visited' | 'declined', today: string): Promise<void> {
  const date = (sub(ctx, 'care.date') || today).trim()
  const outcome = sub(ctx, 'care.outcome').trim()
  if (status !== 'declined' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    ctx.act.toast('就诊日期请写成 2026-10-12 这样。')
    return
  }
  const done = status === 'visited' ? '已记录医生结论，下一步建议和方案将相应调整。'
    : status === 'booked' ? `已记录：${chineseDate(date, today)}就诊。就诊前可打开简报。`
      : '已记录。需要就诊时，可随时打开简报。'
  const answer = await ctx.act.post('care-visit', {
    status,
    ...(status !== 'declined' ? { visit_date: date } : {}),
    ...(status === 'visited' && outcome ? { outcome_zh: outcome } : {}),
  }, { reload: ['triage'], done })
  if (answer.ok) {
    setSub(ctx, 'care.step', '')
    setSub(ctx, 'care.outcome', '')
  }
}

/** 是否已预约？医生意见如何？ with 已预约 / 已就诊 / 暂不就诊, and the date (and the doctor's words) in place. */
function VisitForm(ctx: Ctx, journey: Journey, today: string): RenderElement {
  const { Box, Button } = ctx.E
  const Input = inputOf(ctx)
  const step = sub(ctx, 'care.step')
  const last = lastText(journey, today)
  return (
    <Box key="visit" flexDirection="column" marginTop={1}>
      {Caption(ctx.E, last ? `是否已预约？医生意见如何？（上次：${last}）` : '是否已预约？医生意见如何？', 'q', ctx.width - 4)}
      {step === ''
        ? (
          <Box key="choices" flexDirection="row" gap={1}>
            <Button key="care-booked" label="已预约" onPress={() => setSub(ctx, 'care.step', 'booked')} />
            <Button key="care-visited" label="已就诊" onPress={() => setSub(ctx, 'care.step', 'visited')} />
            <Button key="care-declined" plain dimColor label="暂不就诊" onPress={() => { void sendVisit(ctx, 'declined', today) }} />
          </Box>
        )
        : (
          <Box key="form" flexDirection="column">
            {Input ? Input({ key: 'care-date', label: '就诊日期', placeholder: `${today}（不填即今天）`, submitLabel: '确定', onInput: (v: string) => setSub(ctx, 'care.date', v), onSubmit: (v: string) => setSub(ctx, 'care.date', v) }) : null}
            {step === 'visited' && Input
              ? Input({ key: 'care-outcome', label: '医生意见', placeholder: '例如：缺铁，已开药，3 个月后复查', submitLabel: '确定', onInput: (v: string) => setSub(ctx, 'care.outcome', v), onSubmit: (v: string) => setSub(ctx, 'care.outcome', v) })
              : null}
            <Box key="act" flexDirection="row" gap={1}>
              <Button key="care-save" variant="primary" label="保存" onPress={() => { void sendVisit(ctx, step === 'visited' ? 'visited' : 'booked', today) }} />
              <Button key="care-cancel" plain dimColor label="取消" onPress={() => setSub(ctx, 'care.step', '')} />
            </Box>
          </Box>
        )}
    </Box>
  )
}

/** The doctor-first card: title, the values, the brief and the visit answers. */
export function CareCard(ctx: Ctx, journey: Journey): Node {
  if (journey.next.action !== 'doctor') return null
  const { Box, Text, Button } = ctx.E
  const today = journey.today || ctx.today
  const detail = careDetail(journey.next.title_zh, journey.next.detail_zh)
  const busy = sub(ctx, 'briefBusy') === '1'
  return Card(ctx, {
    key: 'care', title: '! 最重要的一步', titleColor: C.warn, width: ctx.width, tone: C.warn,
    children: [
      Para(ctx.E, journey.next.title_zh, ctx.width - 4, { key: 't', bold: true }),
      detail ? Para(ctx.E, detail, ctx.width - 4, { key: 'd', dim: true }) : null,
      <Box key="acts" flexDirection="row" columnGap={1} flexWrap="wrap" marginTop={1}>
        <Button key="care-brief" variant="primary" label={busy ? '正在整理…' : '医生简报（可打印）'} onPress={() => { if (!busy) void openBrief(ctx) }} />
        <Button key="care-labs" label="查看这些指标" onPress={() => ctx.act.go('labs', { 'labs.filter': 'changed' })} />
        {journey.triage.needs_sex ? <Button key="care-sex" label="填写性别" onPress={() => { setSub(ctx, 'step', '1'); setSub(ctx, 'onboarding', '1') }} /> : null}
      </Box>,
      BriefView(ctx, journey),
      VisitForm(ctx, journey, today),
    ],
  })
}

/** The brief route the page reads while a brief is open. */
export function briefRoute(subs: Record<string, string>): string | null {
  const id = subs['overview.briefId'] ?? ''
  return id ? `brief?id=${encodeURIComponent(id)}` : null
}
