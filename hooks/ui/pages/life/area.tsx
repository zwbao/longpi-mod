// The 化验, 睡眠 and 运动 pages: one indicators list each (the web's IndicatorsTab with its area), the 自测
// block under 体格与血压 on 化验, the wearable series as charts on 睡眠 and 运动, and an opened indicator.

import type { RenderElement } from 'claude-code'

import type { Ctx, LongPiView, Node, RoutePath } from '../../types.ts'
import { C, Failed, Heading, Loading, routeState, zh } from '../../kit.tsx'
import { detailPath, indicatorsOf, indicatorsPath, rowsOfArea, type Indicators } from './data.ts'
import { DetailView } from './detail.tsx'
import type { LifeArea } from './plain.ts'
import { SelfBlock } from './self.tsx'
import { DEVICE_IDS, SeriesCard, SpanButtons, spanOf } from './series.tsx'
import { IndicatorTable, visibleRows } from './table.tsx'

/** What a page reads: the list, the journey (自测, advice), and an open indicator with the plan it belongs to. */
export function areaRoutes(area: LifeArea, view: LongPiView): RoutePath[] {
  const out: RoutePath[] = [indicatorsPath(area)]
  if (area === 'labs') out.push('journey')
  if (area !== 'labs') out.push(...DEVICE_IDS[area].map(detailPath))
  if (area === 'labs' && view.sub['life.self.open'] === '1') out.push('self')
  if (view.detail) out.push(detailPath(view.detail), 'tracking')
  return [...new Set(out)]
}

type Empty = { title: string; text: string; button: string; prompt: string }

const EMPTY: Record<LifeArea, Empty> = {
  labs: {
    title: '还没有化验数据',
    text: '把体检报告（PDF 或照片）拖进对话框，或粘贴它的文件路径，交给 Claude 录入。录入后，这里会列出每项化验及其变化，并判断变化是否超出正常波动。',
    button: '交给 Claude 录入报告',
    prompt: '请帮我录入这份体检报告：',
  },
  sleep: {
    title: '还没有睡眠数据',
    text: '把手环或手表 App 导出的睡眠记录（文件或截图）拖进对话框交给 Claude 录入。录入后，这里会列出睡眠时长和变化趋势。',
    button: '交给 Claude 录入睡眠记录',
    prompt: '请帮我录入这份手环导出的睡眠记录：',
  },
  training: {
    title: '还没有运动数据',
    text: '把手环或手表 App 导出的运动记录（文件或截图）拖进对话框交给 Claude 录入。录入后，这里会列出步数、活动量和变化趋势。',
    button: '交给 Claude 录入运动记录',
    prompt: '请帮我录入这份手环导出的运动记录：',
  },
}

function emptyCard(ctx: Ctx, area: LifeArea, data: Indicators): RenderElement {
  const { Box, Text, Button } = ctx.E
  const copy = EMPTY[area]
  return (
    <Box key="empty" flexDirection="column" borderStyle="round" borderColor={C.dim} paddingX={1} width={ctx.width}>
      <Text bold>{copy.title}</Text>
      <Text dimColor wrap="wrap">{zh(copy.text)}</Text>
      <Box flexDirection="row" gap={1} marginTop={1}>
        <Button key="empty-fill" variant="primary" label={copy.button} onPress={() => ctx.act.fill(copy.prompt)} />
        {area !== 'labs' && data.record.status !== 'none' ? <Button key="empty-connect" plain label="查看数据连接 ›" onPress={() => ctx.act.go('profile')} /> : null}
      </Box>
    </Box>
  )
}

/** The wearable series of the page, each a card with its chart. */
function seriesSection(ctx: Ctx, area: 'sleep' | 'training', data: Indicators): Node[] {
  const rows = rowsOfArea(data, area).filter((row) => row.source === 'device' && (row.points.length > 0 || row.latest))
  if (rows.length === 0) return []
  const spanKey = `life.${area}.span`
  const span = spanOf(ctx, spanKey)
  return [
    Heading(ctx.E, '趋势', '手环每天的数值', 'h-trend'),
    SpanButtons(ctx, spanKey, `span-${area}`),
    ...rows.map((row) => SeriesCard(ctx, row, span, `series-${row.id}`)),
  ]
}

export function drawArea(ctx: Ctx, area: LifeArea): Node {
  const { Box } = ctx.E
  const path = indicatorsPath(area)
  const state = routeState(ctx, path)
  if (state.kind === 'loading') return Loading(ctx.E, '正在读取指标…')
  const data = state.kind === 'ok' ? indicatorsOf(state.json) : null
  if (!data) return Failed(ctx.E, `指标：${state.kind === 'error' ? state.error : '格式不对'}`, () => ctx.act.load([path], true))
  if (data.groups.length === 0 && data.record.status === 'error') {
    return Failed(ctx.E, `体检记录：${data.record.error || '记录读取失败。'}`, () => ctx.act.load([path], true))
  }
  if (ctx.view.detail) return DetailView(ctx, { area, rows: visibleRows(ctx, data, area), id: ctx.view.detail })
  const all = rowsOfArea(data, area)
  if (all.length === 0) {
    return (
      <Box key={`area-${area}`} flexDirection="column">
        {emptyCard(ctx, area, data)}
        {area === 'labs' ? SelfBlock(ctx) : null}
      </Box>
    )
  }
  const table = IndicatorTable(ctx, { area, data, ...(area === 'labs' ? { after: { group: 'body', node: SelfBlock(ctx) } } : {}) })
  return (
    <Box key={`area-${area}`} flexDirection="column">
      {table}
      {area === 'labs' ? null : seriesSection(ctx, area, data)}
    </Box>
  )
}
