// The markers the plan aims to move against their normal fluctuation, what the models say if the plan's
// goals are reached, and the next steps (client/plan.ts Markers, goals.ts Goals and NextSteps).

import type { RenderElement } from 'claude-code'

import type { Ctx, Els, Node } from '../../types.ts'
import { C, cells, fit, pad, Section, spark, Tag, zh } from '../../kit.tsx'
import { chineseDate, fmt, minus, plainUnits, projectionSentence } from './format.ts'
import { Fold, isOn, VerdictTag } from './shared.tsx'
import type { Chart, Tracking, Verdict } from './types.ts'

const BIOAGE_LABEL = '身体年龄'
const RISK_LABEL = '10 年心血管风险'
const BIOAGE_INFO = '身体年龄根据九项常规血检和周岁计算得出（模型估计，不是诊断，也不代表预期寿命）。学术上称为表型年龄。'
const RISK_INFO = '10 年心血管风险：与你情况相近的人群中，未来 10 年发生心梗或脑卒中的比例（模型估计）。该模型未公开个体波动范围。年龄不在 35–74 岁时，结果更不确定。模型名称为 China-PAR。'

// --- markers --------------------------------------------------------------------------------------

/** The band as a line: low ├──●──┤ high, the latest value where it falls, the goal as ◎. */
function BandLine(E: Els, chart: Chart, value: number, width: number, digits: number, key: string): RenderElement {
  const { Box, Text } = E
  const band = chart.band as NonNullable<Chart['band']>
  const lo = fmt(band.low, digits)
  const hi = fmt(band.high, digits)
  const span = Math.max(6, Math.min(48, width - cells(lo) - cells(hi) - 2))
  const min = Math.min(band.low, value, chart.goal ?? band.low)
  const max = Math.max(band.high, value, chart.goal ?? band.high)
  const pos = (v: number) => Math.max(0, Math.min(span - 1, Math.round(((v - min) / Math.max(1e-9, max - min)) * (span - 1))))
  const row: string[] = Array.from({ length: span }, (_, i) => (i >= pos(band.low) && i <= pos(band.high) ? '─' : ' '))
  row[pos(band.low)] = '├'
  row[pos(band.high)] = '┤'
  if (chart.goal != null) row[pos(chart.goal)] = '◎'
  const at = pos(value)
  const inside = value >= band.low && value <= band.high
  return (
    <Box key={key} flexDirection="row">
      <Text dimColor>{`${lo} `}</Text>
      <Text dimColor>{row.slice(0, at).join('')}</Text>
      <Text color={inside ? C.accent : C.warn} bold>●</Text>
      <Text dimColor>{row.slice(at + 1).join('')}</Text>
      <Text dimColor>{` ${hi}`}</Text>
    </Box>
  )
}

function ChartCard(ctx: Ctx, chart: Chart, verdict: Verdict | undefined, width: number, today: string): RenderElement {
  const { Box, Text } = ctx.E
  const inner = width - 4
  const digits = Math.max(...chart.points.map((point) => (String(point.value).split('.')[1] ?? '').length), 0) > 1 ? 2 : 1
  const unit = plainUnits(chart.unit)
  const dateOf = (iso: string) => (chart.weekly ? `${chineseDate(iso, today)}起一周` : chineseDate(iso, today))
  const last = chart.points[chart.points.length - 1]
  const foldKey = `plan.chart.${chart.key}`
  const kids: Node[] = [
    <Box key="head" flexDirection="row" justifyContent="space-between">
      <Text bold>{fit(chart.label, Math.max(8, inner - 12))}</Text>
      {verdict ? VerdictTag(ctx.E, verdict.verdict, 'verdict') : null}
    </Box>,
  ]
  if (last) {
    kids.push(
      <Box key="value" flexDirection="row" gap={1}>
        <Text bold>{fmt(last.value, digits)}</Text>
        {unit ? <Text dimColor>{unit}</Text> : null}
        <Text dimColor>{`· ${dateOf(last.date)}`}</Text>
        {chart.points.length > 1 ? <Text color={C.accent}>{spark(chart.points.map((point) => point.value), Math.min(24, Math.max(4, inner - 30)))}</Text> : null}
      </Box>,
    )
    if (chart.band) kids.push(BandLine(ctx.E, chart, last.value, inner, digits, 'band'))
  }
  if (chart.band) kids.push(<Text key="band-cap" dimColor wrap="wrap">{zh(`波动带：以 ${chineseDate(chart.band.base_date, today)}的 ${fmt(chart.band.base, 2)} 为基线的正常波动${chart.band.verified === false ? '（变异数据待核对）' : ''}。`)}</Text>)
  if (chart.goal != null) kids.push(<Text key="goal" dimColor>{`◎ 目标 ${fmt(chart.goal, digits)} ${unit}`}</Text>)
  if (chart.points.length > 1) {
    kids.push(Fold(ctx, foldKey, '历次数值', `fold-${chart.key}`))
    if (isOn(ctx, foldKey)) {
      kids.push(<Text key="th" dimColor>{`${pad('日期', 20)}${unit ? `数值（${unit}）` : '数值'}`}</Text>)
      for (const point of chart.points) kids.push(<Text key={`p-${point.date}`}>{`${pad(dateOf(point.date), 20)}${fmt(point.value, digits)}`}</Text>)
    }
  }
  return (
    <Box key={`chart-${chart.key}`} flexDirection="column" width={width} borderStyle="round" borderColor={C.dim} paddingX={1}>
      {kids.filter((kid): kid is RenderElement => kid !== null)}
    </Box>
  )
}

/** 方案相关的指标: each target marker against its band, in two columns on a wide pane. */
export function Markers(ctx: Ctx, tracking: Tracking | null, today: string): Node {
  const { Box, Text } = ctx.E
  const charts = tracking?.charts ?? []
  if (charts.length === 0) return null
  const verdictOf = (indicator: string): Verdict | undefined => (tracking?.items ?? []).flatMap((item) => item.verdicts ?? [])
    .find((row) => row.indicator === indicator && row.verdict !== '无法判断')
  const notes = [
    charts.some((chart) => chart.points.length < 2) ? '仅有一次数值的指标，需再复测一次才能显示趋势。' : '',
    charts.some((chart) => !chart.band) ? '没有波动带的指标缺少个体变异数据，无法区分真实变化与波动。' : '',
  ].filter(Boolean).join('')
  const two = ctx.width >= 90
  const half = Math.floor((ctx.width - 1) / 2)
  const cards = charts.map((chart, i) => ChartCard(ctx, chart, verdictOf(chart.indicator), two ? (i % 2 === 0 ? half : ctx.width - half - 1) : ctx.width, today))
  const rows: RenderElement[] = []
  if (two) {
    for (let i = 0; i < cards.length; i += 2) rows.push(<Box key={`mrow-${i}`} flexDirection="row" gap={1} alignItems="flex-start">{cards.slice(i, i + 2)}</Box>)
  } else rows.push(...cards)
  return (
    <Box key="markers" flexDirection="column" marginBottom={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold>方案相关的指标</Text>
        {Fold(ctx, 'plan.bandinfo', '波动带', 'fold-bandinfo')}
      </Box>
      {isOn(ctx, 'plan.bandinfo') ? <Text key="info" dimColor wrap="wrap">波动带（├──┤）表示以基线为中心的正常波动范围。落在带外的变化才值得关注；带内的起伏通常没有实际意义。</Text> : null}
      {notes ? <Text key="notes" dimColor wrap="wrap">{zh(notes)}</Text> : null}
      {rows}
    </Box>
  )
}

// --- goals ----------------------------------------------------------------------------------------

/** One row per lever: label and from → to on one line, the bar and its value under it. */
function LeverBars(E: Els, rows: Array<{ label: string; detail: string; value: number; unit: string }>, width: number, key: string): RenderElement {
  const { Box, Text } = E
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 0.1)
  const barMax = Math.max(6, Math.min(30, width - 14))
  return (
    <Box key={key} flexDirection="column">
      {rows.map((row, i) => {
        const length = Math.max(1, Math.round((Math.abs(row.value) / max) * barMax))
        return (
          <Box key={`lv${i}`} flexDirection="column">
            <Box flexDirection="row" gap={1}>
              <Text>{row.label}</Text>
              {row.detail ? <Text dimColor>{row.detail}</Text> : null}
            </Box>
            <Box flexDirection="row" gap={1}>
              <Text color={row.value <= 0 ? C.good : C.silver}>{'█'.repeat(length)}</Text>
              <Text>{`${row.value > 0 ? '+' : ''}${fmt(row.value)} ${row.unit}`}</Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

function Figures(E: Els, now: string, goal: string | null, badge: string, badgeGood: boolean, key: string, nowBadge = ''): RenderElement {
  const { Box, Text } = E
  return (
    <Box key={key} flexDirection="row" gap={1} flexWrap="wrap">
      <Text dimColor>现在</Text>
      <Text bold>{now}</Text>
      {nowBadge ? <Text color={C.silver}>{`[${nowBadge}]`}</Text> : null}
      {goal ? <Text dimColor>→ 达到方案目标</Text> : null}
      {goal ? <Text bold color={C.good}>{goal}</Text> : null}
      {badge ? <Text color={badgeGood ? C.good : C.silver}>{`[${badge}]`}</Text> : null}
    </Box>
  )
}

export function Goals(ctx: Ctx, tracking: Tracking | null, today: string): Node {
  const { Box, Text } = ctx.E
  const models = tracking?.models ?? []
  if (!tracking?.plan || models.length === 0) return null
  const pheno = models.find((card) => card.model === 'phenoage')
  const risk = models.find((card) => card.model === 'china-par')
  const two = ctx.width >= 90 && Boolean(pheno) && Boolean(risk)
  const half = Math.floor((ctx.width - 1) / 2)
  const cardWidth = (i: number) => (two ? (i === 0 ? half : ctx.width - half - 1) : ctx.width)
  const cards: RenderElement[] = []
  if (pheno) {
    const width = cardWidth(cards.length)
    const leverRows = (pheno.levers ?? []).map((row) => ({ label: row.label, detail: plainUnits(`${row.from} → ${row.to}`), value: row.years, unit: '岁' }))
    const sensitivityRows = (pheno.sensitivity ?? []).map((row) => ({ label: row.label, detail: plainUnits(`一次真实变化约 ${row.step}`), value: -Math.abs(row.years_per_step), unit: '岁' }))
    const goal = pheno.goal
    const kids: Node[] = [
      Tag(ctx.E, '模型估计', C.violet, 'est'),
      isOn(ctx, 'plan.info.pheno') ? <Text key="info" dimColor wrap="wrap">{zh(BIOAGE_INFO)}</Text> : null,
      goal
        ? Figures(ctx.E, `${fmt(pheno.now?.phenoage)} 岁`, `${fmt(goal.phenoage)} 岁`, `${fmt(goal.phenoage_delta)} 岁`, true, 'fig')
        : <Text key="note" dimColor wrap="wrap">{zh(pheno.note_zh ?? '')}</Text>,
      leverRows.length > 0
        ? <Text key="sub" bold>每个目标单独的贡献</Text>
        : sensitivityRows.length > 0 ? <Text key="sub" bold>对你的身体年龄影响最大的指标</Text> : null,
      leverRows.length > 0 ? LeverBars(ctx.E, leverRows, width - 4, 'levers') : sensitivityRows.length > 0 ? LeverBars(ctx.E, sensitivityRows, width - 4, 'levers') : null,
      ...(pheno.levers ?? []).slice(0, 3).map((row, i) => <Text key={`proj${i}`} dimColor wrap="wrap">{zh(minus(projectionSentence(row.label, row.to, row.years, row.from)))}</Text>),
      goal && goal.phenoage_delta != null
        ? <Text key="projg" dimColor wrap="wrap">{zh(minus(projectionSentence('达到方案目标时的身体年龄', `${fmt(goal.phenoage)} 岁`, goal.phenoage_delta, pheno.now?.phenoage != null ? `${fmt(pheno.now.phenoage)} 岁` : undefined)))}</Text>
        : null,
      <Text key="bound" dimColor wrap="wrap">{zh(`${pheno.measured_on ? `按 ${chineseDate(pheno.measured_on, today) || pheno.measured_on}的血检计算。` : ''}${pheno.boundary_zh ?? ''}`)}</Text>,
    ]
    cards.push(
      <Box key="pheno" flexDirection="column" width={width} borderStyle="round" borderColor={C.dim} paddingX={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold>{BIOAGE_LABEL}</Text>
          {Fold(ctx, 'plan.info.pheno', '说明', 'fold-info-pheno')}
        </Box>
        {kids.filter((kid): kid is RenderElement => kid !== null)}
      </Box>,
    )
  }
  if (risk) {
    const width = cardWidth(cards.length)
    const missing = risk.missing ?? []
    let body: Node[]
    if (risk.status === 'unavailable') {
      body = missing.length > 0
        ? [
            <Text key="m" bold dimColor>{`还差 ${missing.length} 项`}</Text>,
            <Box key="mt" flexDirection="row" gap={1} flexWrap="wrap">
              {missing.slice(0, 3).map((name, i) => Tag(ctx.E, name, C.dim, `miss${i}`))}
              {missing.length > 3 ? <Text key="more" dimColor>{`等 ${missing.length} 项`}</Text> : null}
            </Box>,
          ]
        : [<Text key="m" bold dimColor>暂不显示</Text>, risk.note_zh ? <Text key="n" dimColor wrap="wrap">{zh(risk.note_zh)}</Text> : null]
    } else {
      const nowPct = risk.now?.risk_pct
      const goalPct = risk.goal?.risk_pct
      body = [
        Figures(ctx.E, nowPct == null ? '—' : `${nowPct.toFixed(1)}%`, risk.goal ? (goalPct == null ? '—' : `${goalPct.toFixed(1)}%`) : null, risk.category_zh?.goal ?? '', true, 'fig', risk.category_zh?.now ?? ''),
        (risk.levers ?? []).length > 0 ? <Text key="sub" bold>每个目标单独的贡献</Text> : null,
        (risk.levers ?? []).length > 0
          ? LeverBars(ctx.E, (risk.levers ?? []).map((row) => ({ label: row.label, detail: plainUnits(`${row.from} → ${row.to}`), value: row.years, unit: '个百分点' })), width - 4, 'levers')
          : <Text key="note" dimColor wrap="wrap">{zh(risk.note_zh ?? '')}</Text>,
      ]
    }
    cards.push(
      <Box key="risk" flexDirection="column" width={width} borderStyle="round" borderColor={C.dim} paddingX={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold>{RISK_LABEL}</Text>
          {Fold(ctx, 'plan.info.risk', '说明', 'fold-info-risk')}
        </Box>
        {Tag(ctx.E, '模型估计', C.violet, 'est')}
        {isOn(ctx, 'plan.info.risk') ? <Text key="info" dimColor wrap="wrap">{zh(RISK_INFO)}</Text> : null}
        {body.filter((kid): kid is RenderElement => kid !== null)}
        {risk.boundary_zh ? <Text key="bound" dimColor wrap="wrap">{zh(risk.boundary_zh)}</Text> : null}
      </Box>,
    )
  }
  return (
    <Box key="goals" flexDirection="column" marginBottom={1}>
      <Text bold>如果达到目标</Text>
      {two ? <Box key="cards" flexDirection="row" gap={1} alignItems="flex-start">{cards}</Box> : <Box key="cards" flexDirection="column">{cards}</Box>}
      <Text key="years" dimColor wrap="wrap">{zh('关于「能多活几年」：没有经过验证的模型能对个人给出这个数。这里只给有依据的模型估计。试验里的平均效应都不大：热量限制使衰老速度慢约 2–3%，鱼油三年约慢 3 个月；能坚持的小改变，比追逐一个数字更重要。')}</Text>
    </Box>
  )
}

// --- next steps -----------------------------------------------------------------------------------

const STEP_MARK: Record<string, string> = { retest: '↻', missing_marker: '+', adherence: '■', record: '✓', one_change: '·', review: '·', worse: '!', acute: '!', lever: '↗' }

export function NextSteps(ctx: Ctx, tracking: Tracking | null, today: string): Node {
  const { Box, Text } = ctx.E
  const rows = tracking?.suggestions ?? []
  if (rows.length === 0) return null
  return Section(ctx.E, {
    key: 'next', title: '下一步', note: '按优先级', width: ctx.width,
    children: rows.map((row, i) => (
      <Box key={`step-${i}`} flexDirection="row" gap={1}>
        <Text color={row.kind === 'worse' || row.kind === 'acute' ? C.warn : C.accent}>{`${i + 1}.${STEP_MARK[row.kind] ?? '·'}`}</Text>
        <Box width={ctx.width - 9}><Text wrap="wrap">{zh(minus(plainUnits(row.text_zh)).replace(/\d{4}-\d{2}-\d{2}/g, (iso) => chineseDate(iso, today)))}</Text></Box>
      </Box>
    )),
  })
}
