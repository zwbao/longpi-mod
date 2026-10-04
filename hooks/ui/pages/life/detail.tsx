// One indicator opened (client/indicators.ts DetailBody): how it moved, the change and the advice, the chart
// with its normal-fluctuation band, the reference range, what the band is and where it comes from, every
// reading with its date and report, and the plan items that follow it. A wearable's series is drawn day by day.

import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from '../../types.ts'
import { C, cells, Failed, fit, Heading, Loading, pad, padStart, Section, zh } from '../../kit.tsx'
import { ChartLines, lineChart } from './chart.tsx'
import { detailOf, detailPath, planLinks, type IndicatorDetail, type IndicatorRow } from './data.ts'
import {
  cleanLabel, dateZh, fmt, judgementKind, judgementText, movementLead, reasonBesideChip, scrubVisible, SOURCE_ZH,
  sourceLabel, tidy, unitText, VERDICT_ZH, withUnit, type LifeArea,
} from './plain.ts'
import { SeriesCard, SpanButtons, spanOf } from './series.tsx'
import { judgedChip, openDetail } from './table.tsx'

const BACK: Record<LifeArea, string> = { labs: '‹ 返回化验', sleep: '‹ 返回睡眠', training: '‹ 返回运动' }

function noiseSentence(detail: IndicatorDetail): string | null {
  const { row, biovar } = detail
  if (!biovar) return null
  const tooEarly = row.gate === 'too_early' || (row.reason_zh ?? '').startsWith('太早')
  if (tooEarly || row.judged === 'changed') return null
  return `正常波动：+${fmt(biovar.band_pct.up, 1)}% / ${fmt(biovar.band_pct.down, 1)}%（个体内变异 ${fmt(biovar.cvi_pct, 1)}%）。两次结果的差异在此范围内时，多半属于测量误差和生理波动。`
}

/** The caption under the chart: what the band is, or why there is none (the web's wording). */
function basisLines(detail: IndicatorDetail): string[] {
  const { row, biovar } = detail
  const noise = noiseSentence(detail)
  if (noise) return [noise]
  if (biovar && (row.gate === 'too_early' || (row.reason_zh ?? '').startsWith('太早'))) return [reasonBesideChip(row.gate, row.reason_zh) || '距上次检测尚未达到此项的最短复测间隔。']
  if (biovar && row.judged === 'changed') return ['两次结果之差超出了上面的正常波动范围。']
  if (row.range_zh) return ['此项缺少用于比较两次变化的波动数据，上方已按参考范围标注偏低或偏高。']
  if (row.source === 'checkup') return ['此项未收录个体正常波动数据，无法区分真实变化与波动，因此不作判断。']
  return ['手环和自测数据按周均值或日值显示趋势，不作正常波动判断。']
}

/** The advice the 值得注意的变化 card gives for this marker (journey.changes), when it has one. */
function adviceOf(ctx: Ctx, row: IndicatorRow): string {
  const journey = ctx.json<{ changes?: Array<{ label_zh?: string; advice_zh?: string; ask_doctor?: boolean }> }>('journey')
  const name = row.label_zh.replace(/\s+/g, '')
  const hit = (journey?.changes ?? []).find((change) => {
    const label = (change.label_zh ?? '').replace(/\s+/g, '')
    return label !== '' && (label === name || name.startsWith(label) || label.startsWith(name))
  })
  return hit?.ask_doctor && hit.advice_zh ? hit.advice_zh : ''
}

function readingsTable(ctx: Ctx, detail: IndicatorDetail, digits: number): RenderElement {
  const { Box, Text, Button } = ctx.E
  const { row } = detail
  const all = [...detail.all_points].reverse()
  const longList = all.length > 14
  const showAll = ctx.view.sub['life.detail.all'] === row.id
  const shown = longList && !showAll ? all.slice(0, 14) : all
  const dateW = Math.max(10, ...shown.map((point) => cells(dateZh(point.date, ctx.today))))
  const valueW = Math.max(4, ...shown.map((point) => cells(point.text ?? (point.value == null ? '—' : fmt(point.value, digits)))))
  const unitW = Math.max(4, ...shown.map((point) => cells(unitText(point.unit) || '—')))
  const sourceW = Math.max(4, ctx.width - dateW - valueW - unitW - 6)
  return (
    <Box key="readings" flexDirection="column">
      <Text dimColor>{`${pad('日期', dateW)}  ${padStart('数值', valueW)}  ${pad('单位', unitW)}  来源`}</Text>
      {shown.map((point, i) => (
        <Text key={`pt-${i}`} wrap="truncate-end">
          <Text>{pad(dateZh(point.date, ctx.today), dateW)}</Text>
          <Text bold>{`  ${padStart(point.text ?? (point.value == null ? '—' : fmt(point.value, digits)), valueW)}`}</Text>
          <Text dimColor>{`  ${pad(unitText(point.unit) || '—', unitW)}  ${fit(point.file ?? SOURCE_ZH[row.source], sourceW)}`}</Text>
        </Text>
      ))}
      {longList ? <Button key="all-points" plain label={showAll ? `只看最近 14 ${row.source === 'device' ? '天' : '次'}` : `显示全部 ${all.length} ${row.source === 'device' ? '天' : '次'}`} onPress={() => ctx.act.setSub('life.detail.all', showAll ? '' : row.id)} /> : null}
    </Box>
  )
}

/** The checkup chart: the readings on their dates, the band around the reading the last one is compared with. */
function checkupChart(ctx: Ctx, detail: IndicatorDetail, digits: number): Node[] {
  const { Text } = ctx.E
  const { row, biovar } = detail
  const numeric = detail.all_points.flatMap((point) => (point.value == null ? [] : [{ date: point.date, value: point.value, unit: point.unit }]))
  const units = [...new Set(detail.all_points.map((point) => point.unit).filter(Boolean))]
  const unit = unitText(units[0] ?? row.unit)
  if (numeric.length === 0) return []
  if (numeric.length === 1) {
    const only = numeric[0] as { date: string; value: number }
    return [
      <Text key="single" wrap="wrap">
        <Text bold>{withUnit(fmt(only.value, digits), unit)}</Text>
        <Text dimColor>{zh(`  ${dateZh(only.date, ctx.today)} · 再复测一次后可显示趋势`)}</Text>
      </Text>,
    ]
  }
  if (units.length > 1) return [<Text key="units" dimColor wrap="wrap">{zh('历次结果的单位不同，下面按原样列出，不画在同一张图上。')}</Text>]
  // The band is drawn around the reading before the last one, from its date: the last reading outside it is the change.
  const base = numeric[numeric.length - 2] as { date: string; value: number }
  const band = biovar ? { lo: base.value * (1 + biovar.band_pct.down / 100), hi: base.value * (1 + biovar.band_pct.up / 100), from: base.date } : null
  const chip = judgedChip(row)
  const lines = lineChart({ points: numeric, width: ctx.width - 4, height: 8, today: ctx.today, band, dots: true, labelEvery: true, ...(chip.color ? { lastColor: chip.color } : {}) })
  const kids: Node[] = [ChartLines(ctx.E, lines, 'chart')]
  if (band) kids.push(<Text key="band" dimColor wrap="wrap">{zh(`░ 正常波动范围：以 ${dateZh(base.date, ctx.today)}的 ${fmt(base.value, digits)} 为起点，${fmt(band.lo, digits + 1)}–${withUnit(fmt(band.hi, digits + 1), unit)}。最后一次落在阴影外，才算超出正常波动。`)}</Text>)
  return [Section(ctx.E, { key: 'chart-card', title: '趋势', note: `${numeric.length} 次`, width: ctx.width, children: kids })]
}

export function DetailView(ctx: Ctx, options: { area: LifeArea; rows: readonly IndicatorRow[]; id: string }): RenderElement {
  const { Box, Text, Button, Link } = ctx.E as typeof ctx.E & { Link?: unknown }
  const { area, id } = options
  const path = detailPath(id)
  const cached = ctx.route(path)
  const listRow = options.rows.find((row) => row.id === id) ?? null
  const index = options.rows.findIndex((row) => row.id === id)
  const prev = index > 0 ? options.rows[index - 1] : undefined
  const next = index >= 0 && index < options.rows.length - 1 ? options.rows[index + 1] : undefined
  const nav = (
    <Box key="nav" flexDirection="row" justifyContent="space-between">
      <Button key="back" plain hotkey="b" label={BACK[area]} onPress={() => ctx.act.detail(null)} />
      <Box flexDirection="row" gap={2}>
        {prev ? <Button key="prev" plain label="‹ 上一项" onPress={() => openDetail(ctx, prev.id)} /> : null}
        {next ? <Button key="next" plain label="下一项 ›" onPress={() => openDetail(ctx, next.id)} /> : null}
      </Box>
    </Box>
  )
  const detail = cached && cached.status === 200 ? detailOf(cached.json) : null
  const row = detail?.row ?? listRow
  const kids: Node[] = [nav]
  if (row) {
    const chip = judgedChip(row)
    kids.push(
      <Box key="title" flexDirection="row" gap={1} marginTop={1} flexWrap="wrap">
        <Text bold>{cleanLabel(row.label_zh)}</Text>
        {row.plan_marker ? <Text color={C.accent}>[方案]</Text> : null}
        {chip.text !== '—' ? <Text {...(chip.color ? { color: chip.color } : {})} {...(chip.dim ? { dimColor: true } : {})}>{`[${chip.text}]`}</Text> : null}
        <Text dimColor>{SOURCE_ZH[row.source]}</Text>
      </Box>,
    )
    const kind = judgementKind({ gate: row.gate, judged: row.judged, reason: row.reason_zh })
    if (kind !== 'unjudged' && !row.range_flag) kids.push(<Text key="kind" dimColor wrap="wrap">{zh(judgementText(kind, true))}</Text>)
  }
  if (!detail) {
    if (!cached || cached.loading) kids.push(Loading(ctx.E, '正在读取历次数值…'))
    else kids.push(Failed(ctx.E, `${listRow?.label_zh ?? '这项指标'}的历次数值：${cached.error || `HTTP ${cached.status}`}`, () => ctx.act.load([path], true)))
    return <Box key="detail" flexDirection="column">{kids}</Box>
  }

  const { row: r, biovar } = detail
  const numeric = detail.all_points.flatMap((point) => (point.value == null ? [] : [{ date: point.date, value: point.value }]))
  const digits = Math.max(...numeric.map((point) => (String(point.value).split('.')[1] ?? '').length), 0) > 1 ? 2 : 1
  const unit = unitText([...new Set(detail.all_points.map((point) => point.unit).filter(Boolean))][0] ?? r.unit)
  const lead = r.source === 'device' ? null : movementLead(numeric, unit, ctx.today)
  if (lead) kids.push(<Text key="lead" bold wrap="wrap">{zh(tidy(lead, ctx.today))}</Text>)
  if (r.read_error) kids.push(<Text key="read-error" color={C.bad} wrap="wrap">{zh(`此项本次未读取到：${scrubVisible(r.read_error)}。以下为已读取的部分。`)}</Text>)
  if (r.change) {
    kids.push(
      <Text key="change" wrap="wrap">
        <Text {...(r.change.verdict === 'better' && !r.change.ask_doctor ? { color: C.good } : r.change.verdict === 'worse' || r.change.ask_doctor ? { color: C.warn } : {})}>{`[${VERDICT_ZH[r.change.verdict]}] `}</Text>
        <Text dimColor>{zh(tidy(r.change.text_zh.replace(/（反向）$/, ''), ctx.today))}</Text>
      </Text>,
    )
  }
  const advice = adviceOf(ctx, r)
  if (advice) kids.push(<Text key="advice" color={C.warn} wrap="wrap">{zh(`⚠ ${advice}`)}</Text>)

  if (r.source === 'device') {
    const spanKey = 'life.detail.span'
    kids.push(<Box key="spans" marginTop={1}>{SpanButtons(ctx, spanKey, 'detail-span')}</Box>)
    kids.push(SeriesCard(ctx, r, spanOf(ctx, spanKey), 'series', { title: '趋势' }))
  } else {
    kids.push(...checkupChart(ctx, detail, digits))
  }
  if (r.range_zh) kids.push(<Text key="range" color={r.range_flag ? C.warn : undefined} wrap="wrap">{zh(tidy(r.range_zh, ctx.today))}</Text>)
  for (const [i, line] of basisLines(detail).entries()) kids.push(<Text key={`basis-${i}`} dimColor wrap="wrap">{zh(tidy(line, ctx.today))}</Text>)
  if (biovar) {
    kids.push(<Text key="research" dimColor wrap="wrap">{zh(`研究里用来判断变化的范围：+${fmt(biovar.band_pct.up, 1)}% / ${fmt(biovar.band_pct.down, 1)}%（来源：${sourceLabel(biovar.source.title)}${biovar.source.doi ? ` · doi:${biovar.source.doi}` : ''}）`)}</Text>)
    if (biovar.source.url && Link) {
      const L = Link as (props: { href: string; label?: string; key?: string }) => RenderElement
      kids.push(<Box key="source-link" flexDirection="row" gap={1}><Text dimColor>原文：</Text><L key="src" href={biovar.source.url} label={sourceLabel(biovar.source.title)} /></Box>)
    }
    if (biovar.caveat_zh && !r.gate) kids.push(<Text key="caveat" dimColor wrap="wrap">{zh(tidy(biovar.caveat_zh, ctx.today))}</Text>)
  }

  kids.push(Heading(ctx.E, '历次数值', r.source === 'device' ? `${detail.all_points.length} 天` : `${detail.all_points.length} 次`, 'h-readings'))
  kids.push(detail.all_points.length > 0 ? readingsTable(ctx, detail, digits) : <Text key="no-points" dimColor>没有可显示的数值。</Text>)

  const tracking = ctx.json<unknown>('tracking')
  const links = tracking ? planLinks(tracking, r.label_zh) : []
  if (links.length > 0) {
    kids.push(Heading(ctx.E, '方案里和它有关的', `${links.length} 项`, 'h-plan'))
    for (const link of links) {
      kids.push(
        <Box key={`plan-${link.id}`} flexDirection="column">
          <Text wrap="wrap">{zh(`· ${link.title}`)}</Text>
          {link.verdict || link.reason ? <Text dimColor wrap="wrap">{zh(`  ${[link.verdict, tidy(link.reason, ctx.today)].filter(Boolean).join('：').replace(/^无法判断：太早/, '太早')}`)}</Text> : null}
        </Box>,
      )
    }
    kids.push(<Button key="to-plan" plain label="去「方案」打卡 ›" onPress={() => ctx.act.go('plan')} />)
  }

  const latest = r.latest ? withUnit(r.latest.text ?? fmt(r.latest.value, digits), unit) : ''
  const question = latest
    ? `我的${cleanLabel(r.label_zh)}最近一次是 ${latest}（${dateZh(r.latest?.date, ctx.today)}），这说明什么？接下来我该注意什么？`
    : `我的${cleanLabel(r.label_zh)}应该怎么看？`
  kids.push(
    <Box key="ask" flexDirection="row" gap={1} marginTop={1}>
      <Button key="ask-pi" label="问 Pi 这一项" onPress={() => ctx.act.fill(question)} />
    </Box>,
  )
  return <Box key="detail" flexDirection="column">{kids}</Box>
}
