// The indicator list of 化验, 睡眠 and 运动 (client/indicators.ts IndicatorsTab): the record status, the
// filters with their counts, the last checkup, then the groups, each row in columns: name, latest value, unit,
// date, trend, how its last change compares with normal fluctuation, source. A row opens its detail.

import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from '../../types.ts'
import { C, cells, fit, pad, padStart, zh } from '../../kit.tsx'
import { trend } from './chart.tsx'
import { detailPath, rowsOfArea, type IndicatorRow, type Indicators } from './data.ts'
import {
  cleanLabel, dateCell, dateZh, fmtAuto, JUDGEMENT_HELP, judgementKind, judgementText, pairText, scrubVisible,
  SOURCE_ZH, unitText, VERDICT_ZH, type LifeArea,
} from './plain.ts'

export type FilterKey = 'all' | 'changed' | 'plan' | 'device'

export const FILTERS: ReadonlyArray<{ key: FilterKey; label: string; test: (row: IndicatorRow) => boolean }> = [
  { key: 'all', label: '全部', test: () => true },
  { key: 'changed', label: '有变化', test: (row) => row.judged === 'changed' },
  { key: 'plan', label: '方案相关', test: (row) => row.plan_marker },
  { key: 'device', label: '手环', test: (row) => row.source === 'device' },
]

/** Open a row's detail: the page shows it, its readings and the plan it belongs to load. */
export function openDetail(ctx: Ctx, id: string): void {
  ctx.act.detail(id)
  ctx.act.load([detailPath(id), 'tracking'])
}

export function filterOf(ctx: Ctx, area: LifeArea): (typeof FILTERS)[number] {
  const offered = area === 'labs' ? FILTERS : FILTERS.filter((row) => row.key !== 'device')
  const key = ctx.view.sub[`life.${area}.filter`] ?? 'all'
  return offered.find((row) => row.key === key) ?? (offered[0] as (typeof FILTERS)[number])
}

/** The rows of the page under its filter, in group order: the order 上一项 / 下一项 walk in a detail. */
export function visibleRows(ctx: Ctx, data: Indicators, area: LifeArea): IndicatorRow[] {
  const all = rowsOfArea(data, area)
  const filter = filterOf(ctx, area)
  return data.groups.flatMap((group) => group.indicators.filter((row) => all.includes(row) && filter.test(row)))
}

function latestText(row: IndicatorRow): string {
  if (!row.latest) return '—'
  if (row.latest.text) return row.latest.text
  return row.latest.value == null ? '—' : fmtAuto(row.latest.value)
}

/** The 「和正常波动比」 cell: a short chip in its tone, or 「—」 when nothing is judged. */
export function judgedChip(row: IndicatorRow): { text: string; color?: string; dim?: boolean } {
  if (row.range_flag === 'low' || row.range_flag === 'high') return { text: row.range_flag === 'low' ? '偏低' : '偏高', color: C.warn }
  const kind = judgementKind({ gate: row.gate, judged: row.judged, reason: row.reason_zh })
  if (kind === 'beyond') {
    const change = row.change
    const color = change?.verdict === 'better' && !change.ask_doctor ? C.good : change && change.verdict === 'unclear' && !change.ask_doctor ? undefined : C.warn
    const arrow = change ? (change.pct > 0 ? ' ↑' : change.pct < 0 ? ' ↓' : '') : ''
    return { text: `${judgementText(kind, false)}${arrow}`, ...(color ? { color } : {}) }
  }
  if (kind === 'within') return { text: judgementText(kind, false), color: C.good }
  if (kind === 'unjudged') return { text: '—', dim: true }
  return { text: judgementText(kind, false), dim: true }
}

type Cols = { name: number; value: number; unit: number; date: number; trend: number; judged: number; source: number }

function columns(width: number, judged: boolean, source: boolean): Cols {
  const value = 7
  const unit = 8
  const date = width >= 74 ? 10 : 0
  const trendW = width >= 58 ? 10 : 0
  const judgedW = judged ? 16 : 0
  const sourceW = source && width >= 80 ? 4 : 0
  const fixed = [value, unit, date, trendW, judgedW, sourceW].filter((w) => w > 0)
  const name = Math.max(10, width - fixed.reduce((sum, w) => sum + w + 1, 0))
  return { name, value, unit, date, trend: trendW, judged: judgedW, source: sourceW }
}

function header(ctx: Ctx, cols: Cols, area: LifeArea): RenderElement {
  const { Text } = ctx.E
  const parts = [
    pad('指标', cols.name),
    pad(area === 'labs' ? '最近一次' : '最近', cols.value + 1 + cols.unit),
    cols.date ? pad('日期', cols.date) : '',
    cols.trend ? pad('趋势', cols.trend) : '',
    cols.judged ? pad('和正常波动比', cols.judged) : '',
    cols.source ? pad('来源', cols.source) : '',
  ].filter(Boolean)
  return <Text key="ind-head" dimColor wrap="truncate-end">{parts.join(' ')}</Text>
}

function indicatorLine(ctx: Ctx, row: IndicatorRow, cols: Cols): RenderElement {
  const { Box, Text, Button } = ctx.E
  const missed = row.read_error ? scrubVisible(row.read_error).replace(/没有在 \d+ 秒内返回这一项/, '本次未读取到，请稍后刷新') : ''
  const unit = unitText(row.unit)
  const percent = unit.startsWith('%')
  const tag = row.plan_marker ? ' 方案' : ''
  const name = fit(cleanLabel(row.label_zh), Math.max(4, cols.name - cells(tag)))
  const filler = ' '.repeat(Math.max(0, cols.name - cells(name) - cells(tag)))
  const value = missed ? '未读取到' : percent ? `${latestText(row)}${unit}` : latestText(row)
  const chip = missed ? { text: '—', dim: true } : judgedChip(row)
  const numbers = row.points.map((point) => point.value)
  const line = trend(numbers, cols.trend)
  const opened = ctx.view.detail === row.id
  return (
    <Box key={`row-${row.id}`} flexDirection="row">
      <Button key={`open-${row.id}`} plain label={name} onPress={() => (opened ? ctx.act.detail(null) : openDetail(ctx, row.id))} />
      <Text wrap="truncate-end">
        <Text color={C.accent}>{tag}</Text>
        <Text>{filler}</Text>
        <Text {...(missed ? { color: C.warn } : { bold: true })}>{` ${padStart(value, cols.value)}`}</Text>
        <Text dimColor>{` ${pad(missed || percent ? '' : unit, cols.unit)}`}</Text>
        {cols.date ? <Text dimColor>{` ${pad(missed || !row.latest ? '—' : dateCell(row.latest.date, ctx.today), cols.date)}`}</Text> : null}
        {cols.trend ? <Text {...(line === '—' || missed ? { dimColor: true } : { color: C.accent })}>{` ${pad(missed ? '—' : line, cols.trend)}`}</Text> : null}
        {cols.judged ? <Text {...(chip.color ? { color: chip.color } : {})} {...(chip.dim ? { dimColor: true } : {})}>{` ${pad(chip.text, cols.judged)}`}</Text> : null}
        {cols.source ? <Text dimColor>{` ${pad(SOURCE_ZH[row.source] ?? '—', cols.source)}`}</Text> : null}
      </Text>
    </Box>
  )
}

/** Under a changed row, the change as the 值得注意的变化 card writes it: verdict, from → to, and since when. */
function changeLine(ctx: Ctx, row: IndicatorRow): Node {
  const change = row.change
  if (!change || row.judged !== 'changed') return null
  const { Text } = ctx.E
  const from = row.points.at(-2)
  const to = row.points.at(-1)
  const unit = unitText(row.unit)
  const pair = from && to ? `${pairText(from.value, to.value)}${unit.startsWith('%') ? unit : unit ? ` ${unit}` : ''}` : ''
  const span = from && to ? `（${dateZh(from.date, ctx.today)} → ${dateZh(to.date, ctx.today)}）` : ''
  const color = change.verdict === 'better' && !change.ask_doctor ? C.good : change.verdict === 'worse' || change.ask_doctor ? C.warn : undefined
  return (
    <Text key={`chg-${row.id}`} wrap="truncate-end">
      <Text>{'  └ '}</Text>
      <Text {...(color ? { color } : {})}>{`[${VERDICT_ZH[change.verdict]}]`}</Text>
      <Text>{` ${pair}`}</Text>
      <Text dimColor>{span}</Text>
    </Text>
  )
}

function lastCheckup(rows: readonly IndicatorRow[]): string | null {
  let last: string | null = null
  for (const row of rows) if (row.source === 'checkup' && row.latest && (!last || row.latest.date > last)) last = row.latest.date
  return last
}

export type TableOptions = {
  area: LifeArea
  data: Indicators
  /** Drawn right under a group's rows (the 自测 block under 体格与血压), and at the end when that group is not shown. */
  after?: { group: string; node: Node }
}

/** The list: callout, filters, latest line, groups of rows, fine print. */
export function IndicatorTable(ctx: Ctx, options: TableOptions): RenderElement {
  const { Box, Text, Button } = ctx.E
  const { area, data } = options
  const all = rowsOfArea(data, area)
  const filters = area === 'labs' ? FILTERS : FILTERS.filter((row) => row.key !== 'device')
  const filter = filterOf(ctx, area)
  const groups = data.groups
    .map((group) => ({ ...group, indicators: group.indicators.filter((row) => all.includes(row)).filter(filter.test) }))
    .filter((group) => group.indicators.length > 0)
  const failed = all.filter((row) => row.read_error).length
  const judgedAny = groups.some((group) => group.indicators.some((row) => !row.read_error
    && (row.range_flag === 'low' || row.range_flag === 'high' || judgementKind({ gate: row.gate, judged: row.judged, reason: row.reason_zh }) !== 'unjudged')))
  const oneSource = new Set(groups.flatMap((group) => group.indicators.map((row) => row.source))).size <= 1
  const lastDate = area === 'labs' ? lastCheckup(all) : all.reduce<string | null>((last, row) => (row.latest && (!last || row.latest.date > last) ? row.latest.date : last), null)
  const latestLine = lastDate ? `${area === 'labs' ? '最近一次体检' : '最近一次'} ${dateZh(lastDate, ctx.today)}` : ''
  const helpOpen = ctx.view.sub['life.help'] === '1'
  const cols = columns(ctx.width, judgedAny, !oneSource)
  const folded = (key: string) => ctx.view.sub[`life.fold.${key}`] === '1'
  const afterShown = options.after && filter.key === 'all' && groups.some((group) => group.key === options.after?.group)

  const body: Node[] = []
  if (data.record.status === 'partial' || data.record.status === 'error') {
    body.push(
      <Box key="callout" borderStyle="round" borderColor={C.warn} paddingX={1} width={ctx.width}>
        <Text color={C.warn} wrap="wrap">{zh(`部分记录本次未读取到${data.record.error ? `：${scrubVisible(data.record.error)}` : failed > 0 ? `（${failed} 项）` : ''}。标有「未读取到」的指标并非未检测，请稍后刷新重试。`)}</Text>
      </Box>,
    )
  }
  body.push(
    <Box key="toolbar" flexDirection="row" flexWrap="wrap" gap={1}>
      {filters.map((row) => {
        const count = all.filter(row.test).length
        const on = filter.key === row.key
        const label = `${row.label} ${count}`
        if (count === 0 && !on) return <Text key={`flt-${row.key}`} dimColor>{` ${label} `}</Text>
        return <Button key={`flt-${area}-${row.key}`} plain label={on ? `【${label}】` : ` ${label} `} onPress={() => ctx.act.setSub(`life.${area}.filter`, row.key)} />
      })}
    </Box>,
  )
  if (latestLine) {
    body.push(
      <Box key="latest" flexDirection="row" gap={1}>
        <Text dimColor>{latestLine}</Text>
        {judgedAny ? <Button key="help" plain label={helpOpen ? '收起说明' : '「和正常波动比」是什么意思'} onPress={() => ctx.act.setSub('life.help', helpOpen ? '' : '1')} /> : null}
      </Box>,
    )
  }
  if (helpOpen && judgedAny) body.push(<Text key="help-text" dimColor wrap="wrap">{zh(JUDGEMENT_HELP)}</Text>)

  if (groups.length === 0) {
    body.push(
      <Box key="filter-empty" flexDirection="column" marginTop={1}>
        <Text bold>{`没有「${filter.label}」的指标`}</Text>
        <Text dimColor>请更换筛选条件。</Text>
        <Button key="filter-all" label="查看全部" onPress={() => ctx.act.setSub(`life.${area}.filter`, 'all')} />
      </Box>,
    )
  } else {
    body.push(<Box key="head-gap" marginTop={1}>{header(ctx, cols, area)}</Box>)
    for (const group of groups) {
      const shut = folded(group.key)
      body.push(
        <Box key={`grp-${group.key}`} flexDirection="row" gap={1}>
          <Button key={`grp-btn-${group.key}`} plain label={`${shut ? '▸' : '▾'} ${group.label_zh}`} onPress={() => ctx.act.setSub(`life.fold.${group.key}`, shut ? '' : '1')} />
          <Text dimColor>{`${group.indicators.length} 项`}</Text>
        </Box>,
      )
      if (shut) {
        if (afterShown && options.after?.group === group.key) body.push(<Box key={`after-${group.key}`} flexDirection="column">{options.after.node}</Box>)
        continue
      }
      for (const row of group.indicators) {
        body.push(indicatorLine(ctx, row, cols))
        const change = changeLine(ctx, row)
        if (change) body.push(change)
      }
      if (afterShown && options.after?.group === group.key) body.push(<Box key={`after-${group.key}`} flexDirection="column">{options.after.node}</Box>)
    }
  }
  if (options.after && filter.key === 'all' && !afterShown) body.push(<Box key="after-end" flexDirection="column" marginTop={1}>{options.after.node}</Box>)
  body.push(<Text key="fine" dimColor wrap="wrap">{zh('选中任一行的名称按回车（或用鼠标点），可查看历次数值、单位、来源报告及正常波动依据。')}</Text>)
  return <Box key={`table-${area}`} flexDirection="column">{body}</Box>
}
