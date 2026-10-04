// 深度分析 results: the report summary, the organ table, the question board, the plan read back with 接受方案,
// what goes to the doctor (and the brief), and the comparison with the analysis before.
import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from '../../types.ts'
import { C, Md, Section, cells, fit } from '../../kit.tsx'
import { Callout, Fold, isOpen, P, Row, setSub, sub, wrapTo } from './bits.tsx'
import type { BoardRow, Compare, Current, OrganRow, ReadBack } from './analysis-data.ts'
import { CONF_ZH, VERDICT_ZH, cleanLabel, dateOf, fmt, measureParts, num, pageBoundary, rangeText, splitFirst, t, valueText, type Readout } from './format.ts'

export const READ_REPORT_SAY = '请帮我读一下深度分析的完整报告，用简单的话讲讲最重要的几点，以及我接下来该做什么。'

// --- the report --------------------------------------------------------------------------------------

/** Headline readouts first: ages, then AI estimates, then the rest; at most four. */
function headline(cur: Current): Readout[] {
  const rank = (r: Readout) => (r.unit === 'a' ? 0 : r.kind === 'llm_estimate' ? 1 : 2)
  return cur.readouts.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).slice(0, 4).map((x) => x.r)
}

export function ReportCard(ctx: Ctx, cur: Current, planItems: number): RenderElement {
  const { Box, Text, Button } = ctx.E
  const inner = ctx.width - 4
  const facts: Array<[string, number, string]> = [['器官', cur.organs.length, '个'], ['问题', cur.board.length, '个'], ['方案', planItems, '项'], ['复测', cur.retests.length, '项']]
  const boundary = pageBoundary(t(cur.boundary_zh))
  return Section(ctx.E, {
    key: 'report', title: '报告', note: cur.imported_at ? `导入于 ${dateOf(t(cur.imported_at), ctx.today)}` : '', width: ctx.width,
    children: [
      <Box key="facts" flexDirection="row" gap={3} flexWrap="wrap">
        {facts.map(([label, value, unit]) => (
          <Text key={`fact-${label}`}><Text dimColor>{`${label} `}</Text><Text bold color={C.accent}>{String(value)}</Text><Text dimColor>{` ${unit}`}</Text></Text>
        ))}
      </Box>,
      <Box key="head" flexDirection="column" marginTop={1}>
        {headline(cur).map((r, i) => Row(ctx.E, t(r.label_zh), fmt(r), { key: `hl-${i}`, width: inner, bold: true }))}
      </Box>,
      boundary ? P(ctx, boundary, 'boundary', { dim: true }) : null,
      <Box key="acts" flexDirection="row" gap={1} marginTop={1} flexWrap="wrap">
        <Button key="open-report" variant="primary" label="打开完整报告" onPress={() => ctx.act.detail('report')} />
        <Button key="ask-report" label="请 Claude 讲解报告" onPress={() => ctx.act.say(READ_REPORT_SAY)} />
      </Box>,
    ],
  })
}

const GROUP_ZH: Array<[string, string]> = [
  ['method', '为你计算的读数'],
  ['insight', '你在同龄人群中的位置'],
  ['genetic', '基因'],
  ['organ_ai_estimate', '器官 AI 预测'],
]

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ', apos: "'" }

/** The 摘要 of the report's HTML as plain markdown: paragraphs and list items, no markup. */
export function summaryOfHtml(html: string): string {
  const body = html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '')
  const m = /<h2[^>]*>\s*摘要\s*<\/h2>([\s\S]*?)(?=<h2[\s>])/i.exec(body)
  if (!m) return ''
  return (m[1] ?? '')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|ul|ol|h3|h4)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#?\w+);/g, (all, name: string) => ENTITY[name] ?? (name.startsWith('#') ? String.fromCodePoint(Number(name.slice(1)) || 32) : all))
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map((line) => tidyLine(line)).join('\n').trim()
}
const tidyLine = (line: string) => t(line.trim()) || ''

/** The full report in the pane: its summary when the report text is at hand, then every readout by group. */
export function ReportView(ctx: Ctx, cur: Current | null): RenderElement {
  const { Box, Text, Button } = ctx.E
  const back = <Button key="back" plain label="← 返回深度分析" onPress={() => ctx.act.detail(null)} />
  if (!cur) return <Box flexDirection="column">{back}<Text dimColor>读取中…</Text></Box>
  const inner = ctx.width - 4
  const held = ctx.route('analysis/report') as { text?: unknown } | undefined
  const summary = typeof held?.text === 'string' ? summaryOfHtml(held.text) : ''
  const member = cur.member
  const meta = [member?.sex === 'male' ? '男' : member?.sex === 'female' ? '女' : '', member?.age ? `${member.age} 岁` : '', member?.sample_date ? `采样 ${dateOf(member.sample_date, ctx.today)}` : ''].filter(Boolean).join(' · ')
  const groups = GROUP_ZH.map(([group, title]) => ({ group, title, rows: cur.readouts.filter((r) => r.group === group) })).filter((g) => g.rows.length > 0)
  const known = new Set(GROUP_ZH.map(([g]) => g))
  const other = cur.readouts.filter((r) => !known.has(r.group ?? ''))
  if (other.length) groups.push({ group: 'other', title: '其他读数', rows: other })
  return (
    <Box flexDirection="column" width={ctx.width}>
      {back}
      <Text bold color={C.accent}>深度分析报告</Text>
      {meta ? <Text dimColor>{meta}</Text> : null}
      {Section(ctx.E, {
        key: 'summary', title: '摘要', width: ctx.width,
        children: summary
          ? [Md(ctx.E, summary, 'summary-md')]
          : [
            P(ctx, '报告的文字部分（摘要和分系统解读）请 Claude 在对话里讲给你听；下面是这份报告的全部读数。', 'no-summary', { dim: true }),
            <Button key="ask-report" label="请 Claude 讲解报告" onPress={() => ctx.act.say(READ_REPORT_SAY)} />,
          ],
      })}
      {groups.map((g) => {
        const open = isOpen(ctx, `rg.${g.group}`)
        const shown = open ? g.rows : g.rows.slice(0, 8)
        return Section(ctx.E, {
          key: `rg-${g.group}`, title: g.title, note: `${g.rows.length} 项`, width: ctx.width,
          children: [
            g.group === 'organ_ai_estimate' ? P(ctx, '均为 AI 预测；疾病风险为 10 年，后面是可能的范围。', 'ai-cap', { dim: true }) : null,
            g.group === 'method' && g.rows.some((r) => r.kind === 'descriptive') ? P(ctx, '灰字是「数据描述」：质控或计数，不是健康判断。', 'desc-cap', { dim: true }) : null,
            ...shown.map((r, i) => {
              const estimate = r.kind === 'llm_estimate'
              const range = estimate ? rangeText(r) : ''
              const value = estimate ? `${valueText(r)}${range ? `  ${range}` : ''}` : fmt(r)
              const label = estimate ? cleanLabel(t(r.label_zh)) : t(r.label_zh)
              return Row(ctx.E, label, fit(value, Math.floor(inner / 2)), { key: `r-${g.group}-${i}`, width: inner, dimLabel: r.kind === 'descriptive' })
            }),
            g.rows.length > 8 ? Fold(ctx, `rg.${g.group}`, `全部 ${g.rows.length} 项`) : null,
          ],
        })
      })}
      {P(ctx, pageBoundary(t(cur.boundary_zh)), 'boundary', { dim: true, width: ctx.width })}
    </Box>
  )
}

// --- the organ table -----------------------------------------------------------------------------------

function OrganBlock(ctx: Ctx, o: OrganRow, inner: number): RenderElement {
  const { Box, Text } = ctx.E
  const measures = [...o.measured, ...o.indices]
  const age = o.ai_age ? `${valueText(o.ai_age)}${rangeText(o.ai_age) ? `（${rangeText(o.ai_age)}）` : ''}` : '—'
  return (
    <Box key={`organ-${t(o.organ)}`} flexDirection="column" marginTop={1} width={inner}>
      <Box flexDirection="row" justifyContent="space-between" width={inner}>
        <Text bold color={C.accent}>{t(o.label_zh)}</Text>
        <Text><Text dimColor>{'年龄 · AI 预测  '}</Text><Text bold>{age}</Text></Text>
      </Box>
      {measures.length
        ? measures.flatMap((r, i) => {
          const [value, note] = measureParts(r)
          return [
            Row(ctx.E, `  ${t(r.label_zh)}`, value, { key: `m-${i}`, width: inner, dimLabel: true }),
            note ? <Text key={`mn-${i}`} dimColor>{wrapTo(`    ${note}`, inner)}</Text> : null,
          ]
        })
        : <Text key="m-none" dimColor>{'  测量和公式：—'}</Text>}
      {o.ai_risks.map((r, i) => {
        const range = rangeText(r)
        const value = `${valueText(r)}${range ? `  ${range}` : ''}`
        return Row(ctx.E, `  ${cleanLabel(t(r.label_zh))}`, value, { key: `risk-${i}`, width: inner })
      })}
      {o.overrides.map((x, i) => (
        <Box key={`ov-${i}`} flexDirection="column">
          <Text bold>{`  ${t(x.disease)}`}</Text>
          <Text color={C.warn}>{wrapTo(`    ${t(x.message_zh)}`, inner)}</Text>
        </Box>
      ))}
    </Box>
  )
}

export function OrgansCard(ctx: Ctx, cur: Current): Node {
  if (!cur.organs.length) return null
  const inner = ctx.width - 4
  const open = isOpen(ctx, 'organs')
  const shown = open ? cur.organs : cur.organs.slice(0, 3)
  return Section(ctx.E, {
    key: 'organs', title: '器官体检表', note: `${cur.organs.length} 个器官`, width: ctx.width,
    children: [
      P(ctx, '年龄与疾病风险均为 AI 预测，风险为 10 年；灰字是测量和公式算出的数。', 'cap', { dim: true }),
      ...shown.map((o) => OrganBlock(ctx, o, inner)),
      cur.organs.length > 3 ? Fold(ctx, 'organs', `展开其余 ${cur.organs.length - 3} 个器官`) : null,
    ],
  })
}

// --- the question board --------------------------------------------------------------------------------

function QuestionBlock(ctx: Ctx, b: BoardRow, inner: number): RenderElement {
  const { Box, Text } = ctx.E
  const conf = Object.prototype.hasOwnProperty.call(CONF_ZH, t(b.confidence)) ? CONF_ZH[t(b.confidence)] : ''
  const verdict = t(b.verdict_zh)
  const summary = t(b.summary_zh)
  const [lead, more] = splitFirst(verdict && summary ? `${verdict}：${summary}` : verdict || summary)
  const limits = t(b.limitations_zh)
  const next = t(b.next_step_zh)
  const key = `q.${t(b.id)}`
  const open = isOpen(ctx, key)
  return (
    <Box key={`q-${t(b.id)}`} flexDirection="column" marginTop={1} width={inner}>
      <Text bold>{wrapTo(`${t(b.id)} ${t(b.title_zh)}`.trim(), inner)}</Text>
      {conf ? <Text color={conf === '低' ? C.warn : C.dim}>{`[可信度：${conf}]`}</Text> : null}
      <Text>{wrapTo(lead || '暂无结论。', inner)}</Text>
      {next ? <Text color={C.teal}>{wrapTo(`下一步：${next}`, inner)}</Text> : null}
      {more || limits ? Fold(ctx, key, limits ? '证据与局限' : '证据') : null}
      {open && more ? <Text dimColor>{wrapTo(more, inner)}</Text> : null}
      {open && limits ? <Text dimColor>{wrapTo(`局限：${limits}`, inner)}</Text> : null}
    </Box>
  )
}

export function BoardCard(ctx: Ctx, cur: Current): Node {
  if (!cur.board.length) return null
  const inner = ctx.width - 4
  return Section(ctx.E, {
    key: 'board', title: '问题看板', note: '每个问题由一位独立 AI 研究员查证', width: ctx.width,
    children: cur.board.map((b) => QuestionBlock(ctx, b, inner)),
  })
}

// --- the plan read back --------------------------------------------------------------------------------

export function PlanCard(ctx: Ctx, cur: Current, back: ReadBack): RenderElement {
  const { Box, Text, Button } = ctx.E
  const inner = ctx.width - 4
  const details = isOpen(ctx, 'plan.detail')
  const accept = () => {
    if (!back.ok) {
      ctx.act.toast('这份方案还有问题没解决，暂时不能接受。')
      return
    }
    void ctx.act.post('analysis/plan-accept', { run_id: back.run_id, plan_key: back.plan_key }, { reload: ['analysis', 'tracking', 'journey'] }).then((res) => {
      if (res.ok) ctx.act.toast(`方案已保存（第 ${t(res.json.version)} 版），复测提醒会按方案里的指标安排。`)
    })
  }
  return Section(ctx.E, {
    key: 'plan', title: '干预方案', note: back.items.length ? `${back.items.length} 项` : '', width: ctx.width,
    tone: cur.plan_accepted_version ? C.good : C.accent,
    children: [
      ...(back.items.length
        ? back.items.map((item, i) => (
          <Box key={`pi-${t(item.id) || i}`} flexDirection="column" marginTop={i === 0 ? 0 : 1}>
            <Text bold>{wrapTo(`${i + 1}. ${t(item.title)}`, inner)}</Text>
            {item.markers.length ? <Text color={C.teal}>{wrapTo(`   复测指标：${item.markers.map(t).join('、')}`, inner)}</Text> : null}
            {details && item.detail ? <Text dimColor>{wrapTo(`   ${t(item.detail)}`, inner)}</Text> : null}
          </Box>
        ))
        : [P(ctx, '这份方案里没有条目。', 'none', { dim: true })]),
      back.items.some((item) => item.detail) ? Fold(ctx, 'plan.detail', '展开每一项的说明', '收起说明') : null,
      ...back.warnings.map((w, i) => Callout(ctx.E, t(w), 'warn', `warn-${i}`, inner)),
      back.errors.length ? Callout(ctx.E, back.errors.map(t).join('；'), 'bad', 'errors', inner) : null,
      cur.retests.length ? P(ctx, '复测：' + cur.retests.map((r) => `${t(r.what)}（${t(r.after_weeks)} 周后）`).join('；'), 'retests', { dim: true }) : null,
      <Box key="foot" flexDirection="row" gap={1} marginTop={1} flexWrap="wrap">
        {cur.plan_accepted_version
          ? <Text color={C.good} bold>{`✓ 已保存为第 ${t(cur.plan_accepted_version)} 版`}</Text>
          : <Text dimColor>确认后才生效</Text>}
        {cur.plan_accepted_version ? null : <Button key="accept" label="我已阅读，接受方案" {...(back.ok ? { variant: 'primary' as const } : { dimColor: true })} onPress={accept} />}
      </Box>,
    ],
  })
}

// --- for the doctor -----------------------------------------------------------------------------------

export function DoctorCard(ctx: Ctx, cur: Current): Node {
  const items = cur.doctor_items ?? []
  if (!items.length) return null
  const { Box, Text, Button } = ctx.E
  const inner = ctx.width - 4
  const busy = sub(ctx, 'brief.busy') === '1'
  const open = () => {
    setSub(ctx, 'brief.busy', '1')
    void ctx.act.post('brief', {}, { quiet: true }).then((res) => {
      setSub(ctx, 'brief.busy', '')
      if (res.ok && typeof res.json.markdown === 'string') {
        setSub(ctx, 'brief', res.json.markdown)
        ctx.act.detail('brief')
      } else {
        ctx.act.toast(String(res.json.error ?? '简报生成失败'))
      }
    })
  }
  return Section(ctx.E, {
    key: 'doctor', title: '交给医生的事项', width: ctx.width,
    children: [
      P(ctx, '补剂、检查和转诊由医生决定，不放进方案打卡；它们会写进医生简报。', 'cap', { dim: true }),
      ...items.map((item, n) => (
        <Box key={`doc-${n}`} flexDirection="column" marginTop={1}>
          <Text><Text color={C.violet}>{`[${t(item.kind_zh)}] `}</Text><Text bold>{t(item.title)}</Text></Text>
          {item.detail && item.detail !== item.title ? <Text dimColor>{wrapTo(t(item.detail), inner)}</Text> : null}
        </Box>
      )),
      <Box key="acts" marginTop={1}><Button key="brief" label={busy ? '正在整理…' : '医生简报（可打印）'} onPress={open} /></Box>,
    ],
  })
}

export function BriefView(ctx: Ctx): RenderElement {
  const { Box, Text, Button } = ctx.E
  const markdown = sub(ctx, 'brief')
  return (
    <Box flexDirection="column" width={ctx.width}>
      <Button key="back" plain label="← 返回深度分析" onPress={() => ctx.act.detail(null)} />
      <Text bold color={C.accent}>给医生的一页简报</Text>
      <Text dimColor>{wrapTo('数字来自你的体检记录；姓名一栏留空，打印后手写。这不是诊断。', ctx.width)}</Text>
      {markdown
        ? Section(ctx.E, { key: 'brief', title: '简报', width: ctx.width, children: [Md(ctx.E, markdown, 'brief-md')] })
        : <Text dimColor>还没有生成简报。</Text>}
      <Box key="acts" flexDirection="row" gap={1}>
        {markdown ? <Button key="copy" variant="primary" label="复制全文" onPress={() => ctx.act.copy(markdown)} /> : null}
        {markdown ? <Button key="save" label="请 Claude 存成文件" onPress={() => ctx.act.fill('请把刚才的医生简报存成一个 Markdown 文件，放在桌面上。')} /> : null}
        <Button key="close" label="关闭" onPress={() => ctx.act.detail(null)} />
      </Box>
      {markdown ? <Text dimColor>复制后可以粘贴到文档里打印。</Text> : null}
    </Box>
  )
}

// --- compared with the analysis before ---------------------------------------------------------------------

export function CompareCard(ctx: Ctx, c: Compare): RenderElement {
  const { Box, Text } = ctx.E
  const inner = ctx.width - 4
  if (!c.ok) return Section(ctx.E, { key: 'compare', title: '和上次深度分析相比', width: ctx.width, children: [P(ctx, t(c.error_zh), 'err', { dim: true })] })
  const beyond = c.rows.filter((r) => r.verdict !== 'within_noise')
  const within = c.rows.filter((r) => r.verdict === 'within_noise')
  const since = c.prev_sample_date || c.prev_imported_at
  return Section(ctx.E, {
    key: 'compare', title: '和上次深度分析相比', width: ctx.width,
    children: [
      ...c.alerts.map((a, i) => Callout(ctx.E, t(a), 'bad', `alert-${i}`, inner)),
      P(ctx, `与${since ? ` ${dateOf(t(since), ctx.today)} 的` : '上一次'}分析比较。超出个人正常波动（平时的波动）才算真实变化；在波动内的还看不出变化。`, 'cap', { dim: true }),
      ...(beyond.length
        ? beyond.map((r, i) => {
          const change = `${t(r.prev)} → ${t(r.cur)}${r.unit ? ` ${t(r.unit)}` : ''}`
          const up = r.verdict === 'increase_beyond_noise'
          return (
            <Box key={`cmp-${i}`} flexDirection="column" marginTop={1}>
              <Box flexDirection="row" justifyContent="space-between" width={inner}>
                <Text bold>{fit(t(r.marker), Math.max(6, inner - cells(change) - 2))}</Text>
                <Text>{change}</Text>
              </Box>
              <Text color={up ? C.warn : C.teal}>{`${VERDICT_ZH[r.verdict] ?? t(r.verdict)}${r.change_pct !== null ? `（${r.change_pct > 0 ? '+' : '−'}${num(Math.abs(r.change_pct))}%）` : ''}`}</Text>
              {r.caveat ? <Text color={C.warn}>{wrapTo(t(r.caveat), inner)}</Text> : null}
            </Box>
          )
        })
        : [P(ctx, '没有超出正常波动的变化。', 'none', { dim: true })]),
      P(ctx, [
        within.length ? `${within.length} 项在正常波动内（${within.slice(0, 6).map((r) => t(r.marker)).join('、')}${within.length > 6 ? ' 等' : ''}）` : '',
        c.not_judged ? `${c.not_judged} 项没有个人波动数据或条件不足，只能并排看，不判断变好变坏` : '',
      ].filter(Boolean).join('；'), 'rest', { dim: true }),
    ],
  })
}
