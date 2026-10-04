// Small pieces 总览 and its onboarding draw with: a card frame with a title row, coloured chips, the ⓘ toggle,
// one-key folds kept in the page's view state, and a sparkline that colours the points outside a band.

import type { RenderElement } from 'claude-code'

import type { Ctx, Els, Node } from '../../types.ts'
import { C, cells, fit, zh } from '../../kit.tsx'

export const SUB = 'overview.'

/** Text for a wrapping Chinese line (kit's zh): no-break spaces so a line fills to the edge. */
export const nb = zh

/** A small choice of this page (a fold, a step, a draft), from the pane's view state. */
export function sub(ctx: Ctx, key: string): string {
  return ctx.view.sub[`${SUB}${key}`] ?? ''
}

export function setSub(ctx: Ctx, key: string, value: string): void {
  ctx.act.setSub(`${SUB}${key}`, value)
}

export function isOpen(ctx: Ctx, key: string): boolean {
  return sub(ctx, key) === '1'
}

export function flip(ctx: Ctx, key: string): void {
  setSub(ctx, key, isOpen(ctx, key) ? '' : '1')
}

export type Tone = 'good' | 'warn' | 'bad' | 'neutral' | 'info' | 'accent'

export const TONE: Record<Tone, string> = { good: C.good, warn: C.warn, bad: C.bad, neutral: C.silver, info: C.accent, accent: C.accent }

/** A coloured chip: ` 变好 ` on its colour, words always beside the colour. */
export function Chip(E: Els, text: string, tone: Tone, key?: string): RenderElement {
  const { Text } = E
  return <Text key={key ?? `chip-${text}`} backgroundColor={TONE[tone]} color="black">{` ${text} `}</Text>
}

/** A quiet tag: [模型估计]. */
export function Tag(E: Els, text: string, key?: string, color: string = C.silver): RenderElement {
  const { Text } = E
  return <Text key={key ?? `tag-${text}`} color={color}>{`[${text}]`}</Text>
}

/** A framed card: the title (and what sits right of it) on the frame's first row, the body under it. */
export function Card(ctx: Ctx, props: { key: string; title: string; width: number; tone?: string; titleColor?: string; aside?: Node | Node[]; note?: string; children: Node | Node[] }): RenderElement {
  const { Box, Text } = ctx.E
  const kids = (Array.isArray(props.children) ? props.children : [props.children]).filter((child): child is RenderElement => child != null)
  const aside = (Array.isArray(props.aside) ? props.aside : [props.aside]).filter((child): child is RenderElement => child != null)
  return (
    <Box key={props.key} flexDirection="column" borderStyle="round" borderColor={props.tone ?? C.dim} paddingX={1} width={props.width} marginBottom={1}>
      <Box key="head" flexDirection="row" justifyContent="space-between">
        <Box key="title" flexDirection="row" gap={1}>
          <Text key="t" bold color={props.titleColor}>{props.title}</Text>
          {props.note ? <Text key="n" dimColor>{fit(props.note, Math.max(6, props.width - cells(props.title) - 8 - aside.length * 12))}</Text> : null}
        </Box>
        {aside.length > 0 ? <Box key="aside" flexDirection="row" gap={1}>{aside}</Box> : null}
      </Box>
      {kids}
    </Box>
  )
}

/** The ⓘ next to a result's title: opens its explanation under the card's head. */
export function InfoButton(ctx: Ctx, key: string): RenderElement {
  const { Button } = ctx.E
  const open = isOpen(ctx, key)
  return <Button key={`info-${key}`} plain label={open ? 'ⓘ 收起' : 'ⓘ'} onPress={() => flip(ctx, key)} />
}

/** A fold's switch: 「判断依据 ▸」 / 「判断依据 ▾」. */
export function FoldButton(ctx: Ctx, key: string, label: string): RenderElement {
  const { Button } = ctx.E
  const open = isOpen(ctx, key)
  return <Button key={`fold-${key}`} plain dimColor label={`${label} ${open ? '▾' : '▸'}`} onPress={() => flip(ctx, key)} />
}

/** Dim wrapped caption lines; set to `width` when it is known. */
export function Caption(E: Els, text: string, key?: string, width?: number): RenderElement {
  const { Text } = E
  if (width) return Para(E, text, width, { key: key ?? `cap-${text.slice(0, 18)}`, dim: true })
  return <Text key={key ?? `cap-${text.slice(0, 18)}`} dimColor wrap="wrap">{nb(text)}</Text>
}

/** A one-line callout with a mark: ! for a warning, i for a note. */
export function Callout(E: Els, text: string, tone: 'warn' | 'info', key?: string, width?: number): RenderElement {
  const { Box, Text } = E
  return (
    <Box key={key ?? `call-${text.slice(0, 18)}`} flexDirection="row" gap={1}>
      <Text key="m" color={tone === 'warn' ? C.warn : C.accent}>{tone === 'warn' ? '!' : 'i'}</Text>
      {width
        ? Para(E, text, width - 2, { key: 't', ...(tone === 'warn' ? { color: C.warn } : {}) })
        : <Text key="t" wrap="wrap" color={tone === 'warn' ? C.warn : undefined}>{nb(text)}</Text>}
    </Box>
  )
}

const SPARK = '▁▂▃▄▅▆▇█'

/**
 * A sparkline of `values` (one cell per point, resampled to `width`), each cell coloured by where it sits against a
 * band [lo, hi]: inside the band dim, outside it in `out(v)`'s colour. The scale includes the band.
 */
export function BandSpark(E: Els, values: readonly number[], width: number, band: { lo: number; hi: number } | null, out: (value: number) => string, key = 'spark'): RenderElement {
  const { Text } = E
  const nums = values.filter((v) => Number.isFinite(v))
  const w = Math.max(1, Math.min(width, nums.length))
  const pick = Array.from({ length: w }, (_, i) => nums[Math.round((i * (nums.length - 1)) / Math.max(1, w - 1))] as number)
  const all = band ? [...pick, band.lo, band.hi] : pick
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const span = hi - lo || 1
  return (
    <Text key={key}>
      {pick.map((v, i) => {
        const inside = band ? v >= band.lo && v <= band.hi : true
        const glyph = SPARK[Math.min(7, Math.max(0, Math.round(((v - lo) / span) * 7)))] ?? '▁'
        return <Text key={`s${i}`} color={inside ? C.silver : out(v)}>{glyph}</Text>
      })}
    </Text>
  )
}

/** Two columns when there is room (≥ 90), else one under the other. */
export function Pair(ctx: Ctx, key: string, left: (width: number) => Node, right: (width: number) => Node): RenderElement {
  const { Box } = ctx.E
  if (ctx.width >= 90) {
    const half = Math.floor((ctx.width - 1) / 2)
    return (
      <Box key={key} flexDirection="row" gap={1}>
        {left(half)}
        {right(ctx.width - 1 - half)}
      </Box>
    )
  }
  return (
    <Box key={key} flexDirection="column">
      {left(ctx.width)}
      {right(ctx.width)}
    </Box>
  )
}

// --- big figures -----------------------------------------------------------------------------------

/** A 3×5 pixel font for the figures a card leads with: digits, the point and the minus sign. */
const GLYPHS: Record<string, string[]> = {
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '001', '001', '001'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
  '.': ['0', '0', '0', '0', '1'],
  '−': ['000', '000', '111', '000', '000'],
}

/** A figure in half-block pixels, three text rows high; null when a character has no glyph. */
export function bigRows(text: string): string[] | null {
  const chars = [...text.replace(/-/g, '−')]
  if (chars.length === 0 || chars.some((ch) => !GLYPHS[ch])) return null
  const rows = ['', '', '']
  chars.forEach((ch, index) => {
    const glyph = GLYPHS[ch] as string[]
    const px = (r: number, c: number) => (glyph[r]?.[c] ?? '0') === '1'
    for (let row = 0; row < 3; row += 1) {
      let line = ''
      for (let col = 0; col < (glyph[0]?.length ?? 0); col += 1) {
        const top = px(row * 2, col)
        const bottom = px(row * 2 + 1, col)
        line += top && bottom ? '█' : top ? '▀' : bottom ? '▄' : ' '
      }
      rows[row] += (index > 0 ? ' ' : '') + line
    }
  })
  return rows
}

/** The card's figure: big pixels with the unit on the last row and what goes beside it, or one bold line when narrow. */
export function BigFigure(E: Els, props: { key: string; value: string; unit: string; color: string; width: number; after?: Node[] }): RenderElement {
  const { Box, Text } = E
  const rows = bigRows(props.value)
  const after = (props.after ?? []).filter((node): node is RenderElement => node != null)
  if (!rows || cells(rows[0] ?? '') + cells(props.unit) + 4 > props.width) {
    return (
      <Box key={props.key} flexDirection="row" gap={1}>
        <Text key="n" bold color={props.color}>{props.value}</Text>
        <Text key="u">{props.unit}</Text>
        {after}
      </Box>
    )
  }
  return (
    <Box key={props.key} flexDirection="row" gap={1} alignItems="flex-end">
      <Box key="n" flexDirection="column">
        {rows.map((row, i) => <Text key={`r${i}`} color={props.color}>{row}</Text>)}
      </Box>
      <Text key="u" bold>{props.unit}</Text>
      {after.length > 0 ? <Box key="a" flexDirection="row" gap={1}>{after}</Box> : null}
    </Box>
  )
}

// --- paragraphs ------------------------------------------------------------------------------------

const NO_START = /^[。，、；：！？）」』】》〉…·%）,.;:!?)\]]/u
const WORD = /^[A-Za-z0-9.+\-/%×μ²³⁰¹⁴⁵⁶⁷⁸⁹−±~≥≤<>=_]+$/

/** Tokens: a run of Latin letters and digits stays whole; every other character is its own token. */
function tokens(text: string): string[] {
  const out: string[] = []
  let word = ''
  for (const ch of text) {
    if (WORD.test(ch)) { word += ch; continue }
    if (word) { out.push(word); word = '' }
    out.push(ch)
  }
  if (word) out.push(word)
  return out
}

/**
 * Lines of at most `width` cells, broken the way Chinese is set: anywhere between characters, never inside a
 * number or a Latin word, and never with a closing mark (。，、」…) at the start of a line.
 */
export function wrapZh(text: string, width: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    let line: string[] = []
    let w = 0
    for (const token of tokens(para)) {
      const tw = cells(token)
      if (w + tw > width && line.length > 0) {
        if (NO_START.test(token)) {
          // Carry the last character down with the mark, so the mark does not open the next line.
          const carry = line.length > 1 ? line.pop() as string : ''
          lines.push(line.join('').replace(/\s+$/, ''))
          line = carry ? [carry] : []
          w = cells(carry)
        } else {
          lines.push(line.join('').replace(/\s+$/, ''))
          line = []
          w = 0
          if (token === ' ') continue
        }
      }
      line.push(token)
      w += tw
    }
    lines.push(line.join(''))
  }
  return lines
}

/** A paragraph set to `width` (see wrapZh), one Text per line. */
export function Para(E: Els, text: string, width: number, props: { key?: string; dim?: boolean; color?: string; bold?: boolean } = {}): RenderElement {
  const { Box, Text } = E
  const lines = wrapZh(text, Math.max(8, width))
  return (
    <Box key={props.key ?? `p-${text.slice(0, 16)}`} flexDirection="column">
      {lines.map((line, i) => <Text key={`l${i}`} dimColor={props.dim} color={props.color} bold={props.bold}>{line || ' '}</Text>)}
    </Box>
  )
}
