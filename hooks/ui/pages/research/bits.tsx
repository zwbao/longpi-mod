// Small pieces the 研究 and 深度分析 pages share: a callout, a per-route failure line, radio rows, folds.
import type { RenderElement } from 'claude-code'

import type { Ctx, Els, Node } from '../../types.ts'
import { C, cells, fit } from '../../kit.tsx'

const NO_START = new Set([...'，。、；：！？）」』】》〉…·％%,.;:!?)]}'])
const NO_END = new Set([...'（「『【《〈([{'])
const WORDISH = /[A-Za-z0-9._\-+/]/

/**
 * Text broken into lines of `width` cells the Chinese way: a line breaks where the column ends (not before a
 * whole sentence after 「LongPi 」), never starts with 。，） and never ends with （; short Latin words and
 * numbers stay whole. The lines are joined with newlines, so Ink has nothing left to wrap.
 */
export function wrapTo(text: string, width: number): string {
  const cols = Math.max(8, width)
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line: string[] = []
    let w = 0
    for (const ch of para) {
      const cw = cells(ch)
      if (w + cw > cols && line.length > 0) {
        let carry: string[] = []
        if (NO_START.has(ch)) {
          // pull the last character down with the punctuation
          carry = line.splice(line.length - 1, 1)
        } else if (WORDISH.test(ch)) {
          // keep a short word or number whole
          let i = line.length
          while (i > 0 && WORDISH.test(line[i - 1] as string)) i--
          if (i > 0 && line.length - i < 16) carry = line.splice(i)
        }
        while (line.length > 1 && NO_END.has(line[line.length - 1] as string)) carry = [...line.splice(line.length - 1, 1), ...carry]
        out.push(line.join('').trimEnd())
        line = carry
        w = carry.reduce((sum, c) => sum + cells(c), 0)
        if (ch === ' ' && line.length === 0) continue
      }
      line.push(ch)
      w += cw
    }
    out.push(line.join('').trimEnd())
  }
  return out.join('\n')
}

/** Without a width: spaces become no-break spaces, so Ink breaks at the column, not before a whole sentence. */
export const nb = (text: string): string => text.replace(/ /g, '\u00a0')

/** The research lane's own small choices live under this prefix in view.sub. */
export const sub = (ctx: Ctx, key: string): string => ctx.view.sub[`research.${key}`] ?? ''
export const setSub = (ctx: Ctx, key: string, value: string): void => ctx.act.setSub(`research.${key}`, value)

/** A JSON value kept in view.sub (sub values are strings). */
export function subJson<T>(ctx: Ctx, key: string): T | null {
  const raw = sub(ctx, key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** A note with a coloured bar on the left: info (accent), warn, bad, good. */
export function Callout(E: Els, text: string, tone: 'info' | 'warn' | 'bad' | 'good', key: string, width: number): RenderElement {
  const { Box, Text } = E
  const color = tone === 'warn' ? C.warn : tone === 'bad' ? C.bad : tone === 'good' ? C.good : C.accent
  return (
    <Box key={key} flexDirection="row" width={width} marginTop={0}>
      <Text color={color}>{'▍'}</Text>
      <Box flexDirection="column" width={Math.max(10, width - 2)}>
        <Text wrap="wrap">{wrapTo(text, Math.max(10, width - 2))}</Text>
      </Box>
    </Box>
  )
}

/** One route that did not answer: its own message (shown as the core wrote it) and a keyed retry. */
export function FailLine(ctx: Ctx, path: string, error: string, key: string, lead = '没有读到'): RenderElement {
  const { Box, Text, Button } = ctx.E
  return (
    <Box key={key} flexDirection="column">
      <Text color={C.warn} wrap="wrap">{nb(`${lead}：${error || '未知原因'}`)}</Text>
      <Button key={`${key}-retry`} plain label="重试" onPress={() => ctx.act.load([path], true)} />
    </Box>
  )
}

/** A radio row: ◉ picked, ○ not. */
export function Radio(E: Els, props: { key: string; label: string; on: boolean; onPress: () => void; note?: string }): RenderElement {
  const { Button } = E
  return <Button key={props.key} plain label={`${props.on ? '◉' : '○'} ${props.label}${props.note ? `  ${props.note}` : ''}`} onPress={() => props.onPress()} />
}

/** A tick box that is never ticked until the person ticks it. */
export function Tick(E: Els, props: { key: string; label: string; on: boolean; onPress: () => void }): RenderElement {
  const { Button } = E
  return <Button key={props.key} plain label={`${props.on ? '☑' : '☐'} ${props.label}`} onPress={() => props.onPress()} />
}

/** A fold switch: ▸ label while closed, ▾ 收起 while open. */
export function Fold(ctx: Ctx, key: string, label: string, openLabel = '收起'): RenderElement {
  const { Button } = ctx.E
  const open = sub(ctx, key) === '1'
  return <Button key={`fold-${key}`} plain dimColor label={open ? `▾ ${openLabel}` : `▸ ${label}`} onPress={() => setSub(ctx, key, open ? '' : '1')} />
}

export const isOpen = (ctx: Ctx, key: string): boolean => sub(ctx, key) === '1'

/** Wrapped text, optionally dim or coloured; `width` defaults to the inside of a Section. */
export function P(ctx: Ctx, text: string, key: string, opts: { dim?: boolean; color?: string; bold?: boolean; width?: number } = {}): Node {
  if (!text) return null
  const { Text } = ctx.E
  return <Text key={key} wrap="wrap" dimColor={opts.dim} color={opts.color} bold={opts.bold}>{wrapTo(text, opts.width ?? ctx.width - 4)}</Text>
}

/** A label on the left, a value on the right; the label is cut to fit, the value never. */
export function Row(E: Els, label: string, value: string, props: { key: string; width: number; color?: string; dimLabel?: boolean; bold?: boolean }): RenderElement {
  const { Box, Text } = E
  const room = Math.max(4, props.width - cells(value) - 2)
  return (
    <Box key={props.key} flexDirection="row" justifyContent="space-between" width={props.width}>
      <Text dimColor={props.dimLabel}>{fit(label, room)}</Text>
      <Text color={props.color} bold={props.bold}>{value}</Text>
    </Box>
  )
}

/** A text bar: █ for the done part, ░ for the rest. */
export function meter(frac: number, width: number): string {
  const w = Math.max(4, width)
  const f = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0))
  const full = Math.round(f * w)
  return `${'█'.repeat(full)}${'░'.repeat(w - full)}`
}
