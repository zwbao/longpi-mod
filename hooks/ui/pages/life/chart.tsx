// Charts drawn in terminal cells. A line chart (braille dots, two by four per cell) with the normal-fluctuation
// band shaded ░ behind it, a column chart (eighth blocks) with the person's usual range shaded the same way,
// labelled dates under both and value ticks beside them; and a one-line trend for table rows. Pure: numbers in,
// lines of coloured segments out, drawn as Text rows by `ChartLines`.

import type { RenderElement } from 'claude-code'

import type { Els } from '../../types.ts'
import { C, cells, padStart } from '../../kit.tsx'
import { dateAxis, dayNumber, fmt, fmtShort } from './plain.ts'

export type Style = { color?: string; dim?: boolean; bold?: boolean }
export type Seg = Style & { text: string }
export type Line = Seg[]

type Cell = Style & { ch: string }

export const DATA = C.accent
const SHADE = '░'
const EIGHTHS = '▁▂▃▄▅▆▇█'

// --- drawing the lines ------------------------------------------------------------------------------

function same(a: Style, b: Style): boolean {
  return a.color === b.color && Boolean(a.dim) === Boolean(b.dim) && Boolean(a.bold) === Boolean(b.bold)
}

/** Neighbouring cells of one style become one segment. */
function merge(row: readonly Cell[]): Line {
  const out: Line = []
  for (const cell of row) {
    const last = out[out.length - 1]
    // A blank looks the same in any style: it joins the segment before it, which keeps the tree small.
    if (last && (same(last, cell) || (cell.ch === ' ' && !last.bold))) last.text += cell.ch
    else out.push({ text: cell.ch, ...(cell.color ? { color: cell.color } : {}), ...(cell.dim ? { dim: true } : {}), ...(cell.bold ? { bold: true } : {}) })
  }
  return out
}

/** A plain line of text in one style. */
export function plain(text: string, style: Style = {}): Line {
  return [{ text, ...style }]
}

/** Lines of segments as Text rows; a row never wraps. */
export function ChartLines(E: Els, lines: readonly Line[], key: string): RenderElement {
  const { Box, Text } = E
  return (
    <Box key={key} flexDirection="column">
      {lines.map((line, i) => (
        <Text key={`r${i}`} wrap="truncate-end">
          {line.map((seg, j) => (
            <Text key={`s${j}`} {...(seg.color ? { color: seg.color } : {})} {...(seg.dim ? { dimColor: true } : {})} {...(seg.bold ? { bold: true } : {})}>{seg.text}</Text>
          ))}
        </Text>
      ))}
    </Box>
  )
}

// --- scales -------------------------------------------------------------------------------------------

function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count)
  const power = 10 ** Math.floor(Math.log10(raw || 1))
  const scaled = raw / power
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 2.5 ? 2.5 : scaled <= 5 ? 5 : 10
  return nice * power
}

function ticks(min: number, max: number, count: number): number[] {
  if (!(max > min)) return [min]
  const step = niceStep(max - min, count)
  const out: number[] = []
  for (let value = Math.ceil(min / step) * step; value <= max + step * 1e-9; value += step) out.push(Number(value.toFixed(10)))
  return out
}

/** A tick's text: as many decimals as the step has, at most two (2.5, not 3). */
function tickText(value: number, step: number): string {
  const digits = Math.min(2, (String(Number(step.toFixed(6))).split('.')[1] ?? '').length)
  return fmt(value, digits)
}

// --- x labels -----------------------------------------------------------------------------------------

/**
 * Labels under the plot at given columns, most important first; one is left out when it would touch another.
 * Returns the label line and the columns that got a label (for the ┴ marks on the axis).
 */
function placeLabels(items: ReadonlyArray<{ col: number; text: string }>, room: number): { line: string; at: number[] } {
  const used: boolean[] = Array.from({ length: room }, () => false)
  const placed: Array<{ start: number; text: string; col: number }> = []
  for (const item of items) {
    const w = cells(item.text)
    if (w > room) continue
    const start = Math.max(0, Math.min(room - w, item.col - Math.floor(w / 2)))
    let free = true
    for (let i = Math.max(0, start - 2); i < Math.min(room, start + w + 2); i += 1) if (used[i]) free = false
    if (!free) continue
    for (let i = start; i < start + w; i += 1) used[i] = true
    placed.push({ start, text: item.text, col: item.col })
  }
  placed.sort((a, b) => a.start - b.start)
  let line = ''
  let at = 0
  for (const label of placed) {
    line += ' '.repeat(Math.max(0, label.start - at)) + label.text
    at = label.start + cells(label.text)
  }
  return { line, at: placed.map((label) => label.col) }
}

// --- line chart ---------------------------------------------------------------------------------------

export type LinePoint = { date: string; value: number }

export type LineSpec = {
  points: readonly LinePoint[]
  /** Columns for the whole chart, axis and end label included. */
  width: number
  /** Rows of the plot. */
  height: number
  today: string
  /** Shaded behind the line, from `from` on (the day the comparison starts). */
  band?: { lo: number; hi: number; from?: string } | null
  /** A dot (●) on every reading: checkups. Off for daily series (only the last gets one). */
  dots: boolean
  /** The colour of the last reading and its value. */
  lastColor?: string
  /** Label every reading's date (checkups) or a few evenly spaced (daily series). */
  labelEvery?: boolean
}

const BRAILLE_BITS = [[0x01, 0x02, 0x04, 0x40], [0x08, 0x10, 0x20, 0x80]] as const

export function lineChart(spec: LineSpec): Line[] {
  const points = [...spec.points].sort((a, b) => a.date.localeCompare(b.date))
  if (points.length < 2) return []
  const height = Math.max(3, spec.height)
  const values = points.map((point) => point.value)
  const band = spec.band && Number.isFinite(spec.band.lo) && Number.isFinite(spec.band.hi) ? spec.band : null
  let min = Math.min(...values, ...(band ? [band.lo] : []))
  let max = Math.max(...values, ...(band ? [band.hi] : []))
  if (max === min) {
    max += Math.abs(max) * 0.1 || 1
    min -= Math.abs(min) * 0.1 || 1
  }
  const span = max - min
  min -= span * 0.1
  max += span * 0.1
  const tickValues = ticks(min, max, Math.max(2, height - 3))
  const step = tickValues.length > 1 ? (tickValues[1] as number) - (tickValues[0] as number) : span
  const tickLabels = tickValues.map((value) => tickText(value, step))
  const axisW = Math.max(...tickLabels.map(cells), 1)
  const last = points[points.length - 1] as LinePoint
  const endText = fmtShort(last.value)
  const rightW = cells(endText) + 1
  const plotW = Math.max(8, spec.width - axisW - 1 - rightW)
  const X = plotW * 2
  const Y = height * 4
  const days = points.map((point) => dayNumber(point.date))
  const d0 = days[0] as number
  const d1 = days[days.length - 1] as number
  const xDot = (day: number) => (d1 === d0 ? Math.floor(X / 2) : Math.round(((day - d0) / (d1 - d0)) * (X - 1)))
  const yDot = (value: number) => Math.max(0, Math.min(Y - 1, Math.round(((max - value) / (max - min)) * (Y - 1))))

  const dots: boolean[][] = Array.from({ length: Y }, () => Array.from({ length: X }, () => false))
  const plot = (x: number, y: number) => {
    if (x >= 0 && x < X && y >= 0 && y < Y) (dots[y] as boolean[])[x] = true
  }
  for (let i = 0; i < points.length; i += 1) {
    const x1 = xDot(days[i] as number)
    const y1 = yDot((points[i] as LinePoint).value)
    if (i === 0) {
      plot(x1, y1)
      continue
    }
    // Bresenham from the previous reading.
    let x0 = xDot(days[i - 1] as number)
    let y0 = yDot((points[i - 1] as LinePoint).value)
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      plot(x0, y0)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x0 += sx }
      if (e2 <= dx) { err += dx; y0 += sy }
    }
  }

  // Which rows the band covers: a row whose middle value is inside it; at least the row of its middle.
  const rowMid = (r: number) => max - (((r * 4 + 1.5) / (Y - 1)) * (max - min))
  const bandRows = new Set<number>()
  if (band) {
    for (let r = 0; r < height; r += 1) if (rowMid(r) >= band.lo && rowMid(r) <= band.hi) bandRows.add(r)
    if (bandRows.size === 0) bandRows.add(Math.floor(yDot((band.lo + band.hi) / 2) / 4))
  }
  const bandFromCol = band?.from ? Math.max(0, Math.floor(xDot(dayNumber(band.from)) / 2)) : 0

  const grid: Cell[][] = []
  for (let r = 0; r < height; r += 1) {
    const row: Cell[] = []
    for (let c = 0; c < plotW; c += 1) {
      let code = 0
      for (let dc = 0; dc < 2; dc += 1) {
        for (let dr = 0; dr < 4; dr += 1) if (dots[r * 4 + dr]?.[c * 2 + dc]) code |= (BRAILLE_BITS[dc] as readonly number[])[dr] as number
      }
      if (code) row.push({ ch: String.fromCharCode(0x2800 + code), color: DATA })
      else if (bandRows.has(r) && c >= bandFromCol) row.push({ ch: SHADE, dim: true })
      else row.push({ ch: ' ' })
    }
    grid.push(row)
  }
  const cellOf = (i: number) => ({ r: Math.floor(yDot((points[i] as LinePoint).value) / 4), c: Math.min(plotW - 1, Math.floor(xDot(days[i] as number) / 2)) })
  if (spec.dots) {
    for (let i = 0; i < points.length - 1; i += 1) {
      const { r, c } = cellOf(i)
      ;(grid[r] as Cell[])[c] = { ch: '●', color: DATA }
    }
  }
  const lastCell = cellOf(points.length - 1)
  const lastColor = spec.lastColor ?? DATA
  ;(grid[lastCell.r] as Cell[])[lastCell.c] = { ch: '●', color: lastColor, bold: true }

  const tickRow = new Map<number, string>()
  tickValues.forEach((value, i) => {
    const r = Math.floor(yDot(value) / 4)
    if (!tickRow.has(r)) tickRow.set(r, tickLabels[i] as string)
  })
  const lines: Line[] = grid.map((row, r) => {
    const label = tickRow.get(r)
    const lead: Line = [{ text: `${padStart(label ?? '', axisW)}${label ? '┤' : '│'}`, dim: true }]
    const tail: Line = r === lastCell.r ? [{ text: ` ${endText}`, color: lastColor, bold: true }] : []
    return [...lead, ...merge(row), ...tail]
  })

  // Dates: the last and the first reading first, then the others (checkups) or a few evenly spaced (daily).
  const order: number[] = [points.length - 1, 0]
  if (spec.labelEvery) for (let i = points.length - 2; i > 0; i -= 1) order.push(i)
  else {
    const want = Math.max(0, Math.floor(plotW / 14) - 1)
    for (let k = 1; k <= want; k += 1) order.push(Math.round((k * (points.length - 1)) / (want + 1)))
  }
  const labels = placeLabels(order.map((i) => ({ col: cellOf(i).c, text: dateAxis((points[i] as LinePoint).date, spec.today) })), plotW + rightW)
  const axis = Array.from({ length: plotW }, (_, c) => (labels.at.includes(c) ? '┴' : '─')).join('')
  lines.push([{ text: `${' '.repeat(axisW)}└${axis}`, dim: true }])
  lines.push([{ text: `${' '.repeat(axisW + 1)}${labels.line}`, dim: true }])
  return lines
}

// --- column chart -------------------------------------------------------------------------------------

export type Slot = { value: number | null; label?: string; under?: string }

export type ColumnSpec = {
  slots: readonly Slot[]
  width: number
  height: number
  /** Shaded behind the columns. */
  band?: { lo: number; hi: number } | null
  /** The last column drawn bold (today, or the latest week). */
  markLast?: boolean
}

export function columnChart(spec: ColumnSpec): Line[] {
  const slots = spec.slots
  const n = slots.length
  if (n === 0) return []
  const height = Math.max(3, spec.height)
  const values = slots.map((slot) => slot.value).filter((value): value is number => value != null && Number.isFinite(value))
  if (values.length === 0) return []
  const band = spec.band && Number.isFinite(spec.band.lo) && Number.isFinite(spec.band.hi) ? spec.band : null
  const peak = Math.max(...values, band?.hi ?? 0)
  const tickValues = ticks(0, peak * 1.04, Math.max(2, height - 2))
  const top = Math.max(peak * 1.04, tickValues[tickValues.length - 1] ?? peak)
  const step = tickValues.length > 1 ? (tickValues[1] as number) - (tickValues[0] as number) : top
  const tickLabels = tickValues.map((value) => tickText(value, step))
  const axisW = Math.max(...tickLabels.map(cells), 1)
  const plotRoom = Math.max(n, spec.width - axisW - 1)
  const slotW = Math.max(1, Math.min(12, Math.floor(plotRoom / n)))
  const barW = slotW >= 3 ? slotW - Math.ceil(slotW / 3) : slotW === 2 ? 1 : 1
  const leftPad = Math.floor((slotW - barW) / 2)
  const plotW = slotW * n
  const rowStep = top / height
  const bandRows = new Set<number>()
  if (band) {
    for (let r = 0; r < height; r += 1) {
      const mid = (height - r - 0.5) * rowStep
      if (mid >= band.lo && mid <= band.hi) bandRows.add(r)
    }
    if (bandRows.size === 0) bandRows.add(Math.max(0, Math.min(height - 1, height - 1 - Math.floor(((band.lo + band.hi) / 2) / rowStep))))
  }
  const grid: Cell[][] = []
  for (let r = 0; r < height; r += 1) {
    const level = height - 1 - r
    const row: Cell[] = []
    slots.forEach((slot, i) => {
      const lastOne = spec.markLast && i === n - 1
      for (let k = 0; k < slotW; k += 1) {
        const inBar = k >= leftPad && k < leftPad + barW
        const shade: Cell = bandRows.has(r) ? { ch: SHADE, dim: true } : { ch: ' ' }
        if (!inBar || slot.value == null || !Number.isFinite(slot.value)) {
          row.push(inBar && slot.value == null && level === 0 ? { ch: '·', dim: true } : shade)
          continue
        }
        const eighths = Math.max(slot.value > 0 ? 1 : 0, Math.round((slot.value / top) * height * 8))
        const fill = eighths - level * 8
        if (fill <= 0) row.push(shade)
        else row.push({ ch: EIGHTHS[Math.min(8, fill) - 1] as string, color: DATA, ...(lastOne ? { bold: true } : {}) })
      }
    })
    grid.push(row)
  }
  const tickRow = new Map<number, string>()
  tickValues.forEach((value, i) => {
    if (value <= 0) return
    // The row whose span holds the value: where a column reaching it ends.
    const r = Math.max(0, Math.min(height - 1, height - 1 - Math.floor(value / rowStep + 1e-9)))
    if (!tickRow.has(r)) tickRow.set(r, tickLabels[i] as string)
  })
  const lines: Line[] = grid.map((row, r) => {
    const label = tickRow.get(r)
    return [{ text: `${padStart(label ?? '', axisW)}${label ? '┤' : '│'}`, dim: true }, ...merge(row)]
  })
  lines.push([{ text: `${padStart('0', axisW)}└${'─'.repeat(plotW)}`, dim: true }])
  // Labels under the columns: each where it fits, else every k-th from the last one back.
  const labelled = slots.map((slot, i) => ({ i, text: slot.label ?? '' })).filter((item) => item.text)
  if (labelled.length > 0) {
    const widest = Math.max(...labelled.map((item) => cells(item.text)))
    const every = Math.max(1, Math.ceil((widest + 1) / slotW))
    const items = labelled.filter((item) => (n - 1 - item.i) % every === 0).reverse()
      .map((item) => ({ col: item.i * slotW + leftPad + Math.floor(barW / 2), text: item.text }))
    lines.push([{ text: `${' '.repeat(axisW + 1)}${placeLabels(items, plotW).line}`, dim: true }])
  }
  const under = slots.map((slot, i) => ({ i, text: slot.under ?? '' })).filter((item) => item.text)
  if (under.length > 0 && Math.max(...under.map((item) => cells(item.text))) < slotW) {
    const items = under.map((item) => ({ col: item.i * slotW + leftPad + Math.floor(barW / 2), text: item.text }))
    lines.push([{ text: `${' '.repeat(axisW + 1)}${placeLabels(items, plotW).line}` }])
  }
  return lines
}

// --- one-line trend -----------------------------------------------------------------------------------

/**
 * A sparkline in at most `width` cells: the values resampled, scaled to their range (a range under 5 % of the
 * level is drawn flatter, so noise does not look like a climb). Fewer than two values: 「—」.
 */
export function trend(values: readonly number[], width: number): string {
  const nums = values.filter((value) => Number.isFinite(value))
  if (nums.length < 2) return '—'
  const w = Math.max(2, Math.min(width, nums.length))
  const pick = Array.from({ length: w }, (_, i) => nums[Math.round((i * (nums.length - 1)) / (w - 1))] as number)
  const lo = Math.min(...pick)
  const hi = Math.max(...pick)
  const mean = pick.reduce((sum, value) => sum + value, 0) / pick.length
  const span = Math.max(hi - lo, Math.abs(mean) * 0.05, 1e-9)
  const base = lo - (span - (hi - lo)) / 2
  return pick.map((value) => EIGHTHS[Math.min(7, Math.max(0, Math.round(((value - base) / span) * 7)))]).join('')
}

/** The middle half of a person's own days: the 25th and 75th percentile. */
export function middleHalf(values: readonly number[]): { lo: number; hi: number } | null {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (sorted.length < 8) return null
  const at = (q: number) => {
    const pos = (sorted.length - 1) * q
    const lo = Math.floor(pos)
    const hi = Math.ceil(pos)
    return (sorted[lo] as number) + ((sorted[hi] as number) - (sorted[lo] as number)) * (pos - lo)
  }
  return { lo: at(0.25), hi: at(0.75) }
}
