// A wearable's series on 睡眠 and 运动 (and in a wearable row's detail): the last 7 or 30 days day by day, or
// the weekly means; the average, how it moved against the period before, the lowest and highest day; and a
// chart with the person's own usual range shaded. Durations and counts are columns from zero; levels
// (heart rate, variability, oxygen) are a line. Wearable values are not judged against normal fluctuation.

import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from '../../types.ts'
import { C, cells, fit, Section, zh } from '../../kit.tsx'
import { ChartLines, columnChart, lineChart, middleHalf, type Line, type Slot } from './chart.tsx'
import { detailOf, detailPath, type IndicatorRow, type Point } from './data.ts'
import { cleanLabel, dateAxis, dateZh, dayNumber, fmtAuto, fmtMean, fmtShort, isoOfDay, unitText, weekdayZh, withUnit } from './plain.ts'

export type Span = '7' | '30' | 'w'

export const SPANS: ReadonlyArray<{ key: Span; label: string }> = [
  { key: '7', label: '近 7 天' },
  { key: '30', label: '近 30 天' },
  { key: 'w', label: '每周平均' },
]

export function spanOf(ctx: Ctx, subKey: string): Span {
  const value = ctx.view.sub[subKey]
  return value === '7' || value === 'w' ? value : '30'
}

export function SpanButtons(ctx: Ctx, subKey: string, key: string): RenderElement {
  const { Box, Button } = ctx.E
  const on = spanOf(ctx, subKey)
  return (
    <Box key={key} flexDirection="row" gap={1}>
      {SPANS.map((span) => (
        <Button key={`${key}-${span.key}`} plain label={span.key === on ? `【${span.label}】` : ` ${span.label} `} onPress={() => ctx.act.setSub(subKey, span.key)} />
      ))}
    </Box>
  )
}

/** The wearable series LongPi knows, by area: their detail routes load with the page (the day-by-day values). */
export const DEVICE_IDS: Record<'sleep' | 'training', readonly string[]> = {
  sleep: ['device:sleepDuration', 'device:dailyTotalSleepTime', 'device:deepSleepDuration', 'device:hrvRmssd', 'device:hrv', 'device:spo2Min'],
  training: ['device:dailySteps', 'device:steps', 'device:restingHeartRate', 'device:dailyRestingHeartRates', 'device:activeEnergy', 'device:vo2Max'],
}

/** A row's values day by day, from its detail; null while not read (or not readable). */
export function dailyOf(ctx: Ctx, row: IndicatorRow): { points: Point[] | null; state: 'ok' | 'loading' | 'unread' | 'error' } {
  const cached = ctx.route(detailPath(row.id))
  if (!cached) return { points: null, state: 'unread' }
  if (cached.loading && cached.json == null) return { points: null, state: 'loading' }
  const detail = cached.status === 200 ? detailOf(cached.json) : null
  if (!detail) return { points: null, state: 'error' }
  const points = detail.all_points.flatMap((point) => (point.value == null ? [] : [{ date: point.date, value: point.value }]))
  return { points: points.sort((a, b) => a.date.localeCompare(b.date)), state: 'ok' }
}

/** Durations and counts read as columns from zero; a level (heart rate, variability, oxygen) as a line. */
export function isCumulative(row: IndicatorRow): boolean {
  return ['小时', '步', '千卡', '分钟', '次', 'h', 'count', 'kcal', 'min'].includes(row.unit.trim())
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length
}

function moved(diff: number, unit: string, days: number): string {
  const text = fmtMean(Math.abs(diff))
  if (Number(text) === 0) return `和之前 ${days} 天持平`
  return `比之前 ${days} 天${diff > 0 ? '多' : '少'} ${withUnit(text, unit)}`
}

type Window = { slots: Array<{ date: string; value: number | null }>; values: number[]; previous: number[] }

function windowOf(points: readonly Point[], days: number): Window | null {
  const last = points.at(-1)
  if (!last) return null
  const end = dayNumber(last.date)
  const byDay = new Map(points.map((point) => [dayNumber(point.date), point.value]))
  const slots = Array.from({ length: days }, (_, i) => {
    const day = end - days + 1 + i
    return { date: isoOfDay(day), value: byDay.get(day) ?? null }
  })
  const previous: number[] = []
  for (let day = end - 2 * days + 1; day <= end - days; day += 1) {
    const value = byDay.get(day)
    if (value != null) previous.push(value)
  }
  return { slots, values: slots.flatMap((slot) => (slot.value == null ? [] : [slot.value])), previous }
}

/** One wearable series as a card. `daily` null: only the weekly means (the day values are still loading). */
export function SeriesCard(ctx: Ctx, row: IndicatorRow, span: Span, key: string, options: { width?: number; titled?: boolean; title?: string } = {}): RenderElement {
  const { Text, Box, Button } = ctx.E
  const width = options.width ?? ctx.width
  const inner = width - 4
  const unit = unitText(row.unit)
  const daily = dailyOf(ctx, row)
  const days = daily.points
  const cumulative = isCumulative(row)
  const band = days ? middleHalf(days.map((point) => point.value)) : middleHalf(row.points.map((point) => point.value))
  const latest = row.latest
  const note = latest ? `最近 ${dateZh(latest.date, ctx.today)} ${withUnit(latest.text ?? fmtAuto(latest.value), unit)}` : ''
  const effective: Span = days && days.length > 0 ? span : 'w'
  const height = 7
  const kids: Node[] = []

  if (effective === 'w') {
    const weeks = row.points
    if (weeks.length === 0) {
      kids.push(<Text key="none" dimColor>还没有可以画趋势的数值。</Text>)
    } else {
      const first = weeks[0] as Point
      const last = weeks[weeks.length - 1] as Point
      kids.push(<Text key="stat" wrap="wrap">{zh(`近 ${weeks.length} 周的每周平均：第一周 ${withUnit(fmtMean(first.value), unit)}，最近一周 ${withUnit(fmtMean(last.value), unit)}`)}</Text>)
      // A weekly mean is a level whatever the series: a line, so a small shift between weeks shows.
      const lines: Line[] = lineChart({ points: weeks, width: inner, height, today: ctx.today, band, dots: true, labelEvery: true })
      kids.push(ChartLines(ctx.E, lines, 'chart'))
      kids.push(<Text key="axis-note" dimColor>日期是每周的周一。</Text>)
    }
  } else if (days) {
    const n = effective === '7' ? 7 : 30
    const win = windowOf(days, n)
    if (win) {
      const avg = mean(win.values)
      const before = mean(win.previous)
      const parts = [
        avg == null ? '' : `近 ${n} 天平均 ${withUnit(fmtMean(avg), unit)}`,
        avg != null && before != null && win.previous.length >= n / 2 ? moved(avg - before, unit, n) : '',
        win.values.length > 0 ? `最少 ${fmtShort(Math.min(...win.values))}，最多 ${fmtShort(Math.max(...win.values))}` : '',
      ].filter(Boolean)
      kids.push(<Text key="stat" wrap="wrap">{zh(parts.join(' · '))}</Text>)
      if (win.values.length < n) kids.push(<Text key="cover" dimColor>{`${n} 天里有 ${win.values.length} 天的数据。`}</Text>)
      const first = win.slots[0]?.date ?? ''
      const last = win.slots[win.slots.length - 1]?.date ?? ''
      kids.push(<Text key="span" dimColor>{`${dateZh(first, ctx.today)}–${dateZh(last, ctx.today)}`}</Text>)
      let lines: Line[]
      if (cumulative) {
        lines = columnChart({
          slots: win.slots.map((slot): Slot => ({
            value: slot.value,
            label: n === 7 ? `周${weekdayZh(slot.date)}` : dateAxis(slot.date, ctx.today),
            ...(n === 7 && slot.value != null ? { under: fmtShort(slot.value) } : {}),
          })),
          width: inner, height, band, markLast: true,
        })
      } else {
        const pts = win.slots.flatMap((slot) => (slot.value == null ? [] : [{ date: slot.date, value: slot.value }]))
        lines = pts.length >= 2 ? lineChart({ points: pts, width: inner, height, today: ctx.today, band, dots: n === 7, labelEvery: n === 7 }) : []
      }
      if (lines.length > 0) kids.push(ChartLines(ctx.E, lines, 'chart'))
    }
  }
  if (band) {
    const count = days ? days.length : row.points.length
    const what = days ? `近 ${count} 天里，一半的日子` : `近 ${count} 周里，一半的周`
    kids.push(<Text key="band" dimColor wrap="wrap">{zh(`░ ${what}在 ${fmtShort(band.lo)}–${withUnit(fmtShort(band.hi), unit)}之间。这是你自己的常见范围，不是标准。`)}</Text>)
  }
  if (!days && span !== 'w') {
    kids.push(daily.state === 'loading'
      ? <Text key="wait" dimColor>正在读取每天的数值…</Text>
      : (
        <Box key="wait" flexDirection="row" gap={1}>
          <Text dimColor>{daily.state === 'error' ? '每天的数值本次没有读到，先显示每周平均。' : '先显示每周平均。'}</Text>
          <Button key={`load-${row.id}`} plain label="读取每天的数值" onPress={() => ctx.act.load([detailPath(row.id)], true)} />
        </Box>
      ))
  }
  if (options.titled === false) return <Box key={key} flexDirection="column">{kids}</Box>
  const title = fit(options.title ?? cleanLabel(row.label_zh), Math.max(8, inner - cells(note) - 2))
  return Section(ctx.E, { key, title, note, width, children: kids, tone: C.dim })
}
