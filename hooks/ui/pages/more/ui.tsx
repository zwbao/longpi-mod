// Drawing pieces for the 档案 and 设置 pages: an accordion row, a row of choices, a labelled text field,
// error and note lines, a two-column row. Pure: elements in, trees out.

import type { RenderElement } from 'claude-code'

import type { Ctx, Els, Node } from '../../types.ts'
import { C, cells, fit, pad } from '../../kit.tsx'
import { isOpen, toggleOpen } from './util.ts'

/** Label column of a form row, in cells. */
export const LABEL = 12

/**
 * One accordion row: ▸/▾ and the title as a button, a dim summary on the right. The body is drawn by the caller
 * under it when `open` is true.
 */
export function Fold(ctx: Ctx, props: { page: string; id: string; title: string; summary?: string; fallback?: string; tone?: string }): { head: RenderElement; open: boolean } {
  const { Box, Text, Button } = ctx.E
  const open = isOpen(ctx, props.page, props.id, props.fallback ?? '')
  const room = Math.max(6, ctx.width - cells(props.title) - 6)
  const head = (
    <Box key={`fold-${props.id}`} flexDirection="row" justifyContent="space-between" width={ctx.width}>
      <Button key={`fold-${props.id}-btn`} plain label={`${open ? '▾' : '▸'} ${props.title}`} onPress={() => toggleOpen(ctx, props.page, props.id, props.fallback ?? '')} />
      {props.summary ? <Text dimColor={!props.tone} color={props.tone}>{fit(props.summary, room)}</Text> : null}
    </Box>
  )
  return { head, open }
}

/** The body under an open fold: indented two cells, a blank line after. */
export function Body(ctx: Ctx, key: string, children: Node[]): RenderElement {
  const { Box } = ctx.E
  return (
    <Box key={`body-${key}`} flexDirection="column" paddingLeft={2} marginBottom={1} width={ctx.width}>
      {children.filter((child): child is RenderElement => child !== null)}
    </Box>
  )
}

/** A small fold inside a body (更多设置, 高级): ▸ label, pressed to open. */
export function SubFold(E: Els, key: string, label: string, open: boolean, onPress: () => void, note = ''): RenderElement {
  const { Box, Button, Text } = E
  return (
    <Box key={`subfold-${key}`} flexDirection="row" gap={1} marginTop={1}>
      <Button key={`subfold-${key}-btn`} plain label={`${open ? '▾' : '▸'} ${label}`} onPress={() => onPress()} />
      {note && !open ? <Text dimColor wrap="truncate-end">{note}</Text> : null}
    </Box>
  )
}

/** A row of choices: ● the chosen one, ○ the others (dim). A press picks. */
export function Choice<V extends string>(E: Els, key: string, options: ReadonlyArray<{ value: V; label: string }>, value: V | '', onPick: (value: V) => void, label = ''): RenderElement {
  const { Box, Button, Text } = E
  return (
    <Box key={`choice-${key}`} flexDirection="row" gap={1} flexWrap="wrap">
      {label ? <Text>{pad(label, LABEL + 1)}</Text> : null}
      {options.map((option) => (
        <Button
          key={`${key}-${option.value}`}
          plain
          label={`${option.value === value ? '●' : '○'} ${option.label}`}
          {...(option.value === value ? {} : { dimColor: true })}
          onPress={() => onPick(option.value)}
        />
      ))}
    </Box>
  )
}

/** A switch drawn as one press: ● 开 / ○ 关 and its label. */
export function Switch(E: Els, key: string, on: boolean, label: string, onChange: (next: boolean) => void): RenderElement {
  const { Button } = E
  return <Button key={`switch-${key}`} plain label={`${on ? '◉ 已开启' : '○ 已关闭'}  ${label}`} {...(on ? {} : { dimColor: true })} onPress={() => onChange(!on)} />
}

/**
 * A labelled text field. Enter submits; `hint` is drawn dim after it. Where the surface has no Input, the value alone.
 * The field empties itself on Enter, so the saved value doubles as the placeholder: an emptied field still shows it.
 */
export function Field(ctx: Ctx, props: { key: string; label: string; value?: string; placeholder?: string; submitLabel?: string; hint?: string; onSubmit: (value: string) => void; onInput?: (value: string) => void; labelWidth?: number }): RenderElement {
  const E = ctx.E
  const { Box, Text } = E
  const label = pad(props.label, props.labelWidth ?? LABEL)
  if (!('Input' in E)) {
    return (
      <Box key={`field-${props.key}`} flexDirection="row">
        <Text>{label}</Text>
        <Text>{props.value || '—'}</Text>
      </Box>
    )
  }
  const { Input } = E
  return (
    <Box key={`field-${props.key}`} flexDirection="column">
      <Input
        key={props.key}
        label={label}
        value={props.value ?? ''}
        placeholder={props.value || props.placeholder || ''}
        submitLabel={props.submitLabel ?? '保存'}
        onSubmit={(value: string) => props.onSubmit(value)}
        {...(props.onInput ? { onInput: (value: string) => props.onInput?.(value) } : {})}
      />
      {props.hint ? Para(ctx, props.hint, { key: `${props.key}-hint`, dim: true, indent: (props.labelWidth ?? LABEL) + 2 }) : null}
    </Box>
  )
}

/** A choice from a list, as a Select where the surface has one, else as a row of choices. */
export function Pick(ctx: Ctx, props: { key: string; label: string; options: ReadonlyArray<{ value: string; label: string }>; value: string; onSelect: (value: string) => void }): RenderElement {
  const E = ctx.E
  if (!('Select' in E)) return Choice(E, props.key, props.options, props.value, props.onSelect, props.label)
  const { Select } = E
  return (
    <Select
      key={props.key}
      label={pad(props.label, LABEL)}
      options={props.options}
      value={props.value}
      onSelect={(value: string) => props.onSelect(value)}
    />
  )
}

/** A label and a value on one line, the label in a fixed column. */
/** A label and a value on one line, the label in a fixed column; the value wraps under itself. */
export function Row(ctx: Ctx, label: string, value: string, opts: { key?: string; color?: string; dim?: boolean; labelWidth?: number; width?: number } = {}): RenderElement {
  const { Box, Text } = ctx.E
  const lw = (opts.labelWidth ?? LABEL) + 2
  const lines = wrapCells(value, Math.max(8, (opts.width ?? ctx.width - 2) - lw))
  return (
    <Box key={opts.key ?? `row-${label}`} flexDirection="row">
      <Text dimColor>{pad(label, lw)}</Text>
      <Box flexDirection="column">
        {lines.map((line, i) => <Text key={`l${i}`} color={opts.color} dimColor={opts.dim}>{line}</Text>)}
      </Box>
    </Box>
  )
}

// --- paragraphs ------------------------------------------------------------------------------------------

/** Characters a line must not start with (they hang on the line before). */
const NO_START = new Set([...'，。、；：！？）」』》〉】,.;:!?)%·…'])

/**
 * Lines of at most `width` cells: Chinese breaks between any two characters, a Latin word or number never
 * splits, and a line never starts with closing punctuation.
 */
export function wrapCells(text: string, width: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const tokens = para.match(/[A-Za-z0-9][A-Za-z0-9.,:/%~+\-_'@#&=?]*|\s+|./gu) ?? []
    let line: string[] = []
    let used = 0
    const flush = () => {
      out.push(line.join('').trimEnd())
      line = []
      used = 0
    }
    for (const token of tokens) {
      const w = cells(token)
      if (/^\s+$/.test(token)) {
        if (used > 0 && used + 1 <= width) {
          line.push(' ')
          used += 1
        }
        continue
      }
      if (used + w > width && used > 0) {
        // Closing punctuation pulls the token before it down with it.
        const carry: string[] = []
        if (NO_START.has(token) && line.length > 1) carry.push(line.pop() as string)
        flush()
        for (const piece of carry) {
          line.push(piece)
          used += cells(piece)
        }
      }
      if (w > width) {
        // A word longer than the line: cut it.
        let rest = token
        while (cells(rest) > width - used) {
          const cut = fit(rest, width - used).replace(/…$/, '')
          line.push(cut)
          flush()
          rest = rest.slice(cut.length)
        }
        line.push(rest)
        used += cells(rest)
        continue
      }
      line.push(token)
      used += w
    }
    if (line.length > 0 || out.length === 0) flush()
  }
  return out
}

/** A wrapped paragraph in `width` cells (default: a section body's). */
export function Para(ctx: Ctx, text: string, opts: { key: string; dim?: boolean; color?: string; bold?: boolean; width?: number; indent?: number }): RenderElement {
  const { Box, Text } = ctx.E
  const indent = ' '.repeat(opts.indent ?? 0)
  const lines = wrapCells(text, Math.max(8, (opts.width ?? ctx.width - 2) - (opts.indent ?? 0)))
  return (
    <Box key={opts.key} flexDirection="column">
      {lines.map((line, i) => <Text key={`l${i}`} dimColor={opts.dim} color={opts.color} bold={opts.bold}>{`${indent}${line}`}</Text>)}
    </Box>
  )
}

export function Err(ctx: Ctx, text: string, key = 'err'): Node {
  return text ? Para(ctx, text, { key, color: C.bad }) : null
}

export function Ok(ctx: Ctx, text: string, key = 'ok'): Node {
  return text ? Para(ctx, text, { key, color: C.good }) : null
}

export function Note(ctx: Ctx, text: string, key: string, width?: number): Node {
  return text ? Para(ctx, text, { key, dim: true, ...(width ? { width } : {}) }) : null
}

export function Subhead(E: Els, text: string, key: string, note = '', top = true): RenderElement {
  const { Box, Text } = E
  return (
    <Box key={key} flexDirection="row" gap={2} marginTop={top ? 1 : 0}>
      <Text bold>{text}</Text>
      {note ? <Text dimColor>{note}</Text> : null}
    </Box>
  )
}

/** A bullet list, wrapped under its own text. */
export function Bullets(ctx: Ctx, lines: readonly string[], key: string, dim = false): Node {
  if (lines.length === 0) return null
  const { Box, Text } = ctx.E
  return (
    <Box key={key} flexDirection="column">
      {lines.map((line, i) => (
        <Box key={`${key}-${i}`} flexDirection="row">
          <Text dimColor={dim}>· </Text>
          {Para(ctx, line, { key: `${key}-${i}-t`, dim, width: ctx.width - 4 })}
        </Box>
      ))}
    </Box>
  )
}

/** A status mark: ● green on, ● grey off, ● red failed. */
export function Dot(ctx: Ctx, state: 'on' | 'off' | 'bad', text: string, key = 'dot'): RenderElement {
  const { Box, Text } = ctx.E
  return (
    <Box key={key} flexDirection="row" gap={1}>
      <Text color={state === 'on' ? C.good : state === 'bad' ? C.bad : C.dim}>●</Text>
      {Para(ctx, text, { key: `${key}-t`, width: ctx.width - 4 })}
    </Box>
  )
}
