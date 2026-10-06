// Shared pieces for LongPi's pages in the terminal (and the desktop): text width with CJK, small marks,
// section frames, rows of label and value, sparklines and bars. Pure: elements in, trees out.

import type { RenderElement } from 'claude-code'

import type { Ctx, Els, Node } from './types.ts'

// --- text width -------------------------------------------------------------------------------------

const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|[\u{1f300}-\u{1faff}]/u

/** Terminal cells a string takes: CJK and emoji take two. */
export function cells(text: string): number {
  let n = 0
  for (const ch of text) n += WIDE.test(ch) ? 2 : 1
  return n
}

const HAS_CJK = /[\u3000-\u9fff\uff00-\uffef]/

/**
 * Chinese prose for a wrapping Text. The terminal wraps at spaces, so a sentence like 「卡片底部 14 格是 14 天」
 * breaks early at the space before a long run of characters. With its spaces made non-breaking the paragraph
 * wraps at the edge, as Chinese should.
 */
export function zh(text: string): string {
  return HAS_CJK.test(text) ? text.replace(/ /g, '\u00a0') : text
}

/** Core sentences written for the web page, said the way Claude Code says them. */
export function scrubZh(text: string): string {
  return text
    .replace(/DeepSeek Harness|DeepSeek/g, 'Claude')
    .replace(/健康页/g, 'LongPi 页面')
    .replace(/上传一份体检报告/g, '把一份体检报告交给 Claude')
    .replace(/上传(体检|化验)?报告/g, '把$1报告交给 Claude')
    .replace(/上传后/g, '交给 Claude 后')
    .replace(/上传/g, '交给 Claude ')
    .replace(/Claude (?=[，。、；：）」])/g, 'Claude')
    .replace(/右侧健康栏|健康栏/g, 'LongPi 面板')
}

/** Cut a string to `cols` cells, ending with … when cut. */
export function fit(text: string, cols: number): string {
  if (cells(text) <= cols) return text
  let w = 0
  let out = ''
  for (const ch of text) {
    const cw = WIDE.test(ch) ? 2 : 1
    if (w + cw > Math.max(1, cols - 1)) return `${out}…`
    w += cw
    out += ch
  }
  return out
}

/** Pad to `cols` cells (left-aligned), or cut. */
export function pad(text: string, cols: number): string {
  const cut = fit(text, cols)
  return cut + ' '.repeat(Math.max(0, cols - cells(cut)))
}

export function padStart(text: string, cols: number): string {
  const cut = fit(text, cols)
  return ' '.repeat(Math.max(0, cols - cells(cut))) + cut
}

// --- numbers and dates ------------------------------------------------------------------------------

/** A number as the page prints it: at most `digits` decimals, trailing zeros dropped. */
export function num(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const fixed = value.toFixed(digits)
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
}

/** 2026-10-04 → 10 月 4 日 (with the year when it is not this year). */
export function dateZh(iso: string | null | undefined, today?: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return iso
  const sameYear = today ? today.slice(0, 4) === String(y) : false
  return sameYear ? `${m} 月 ${d} 日` : `${y} 年 ${m} 月 ${d} 日`
}

/** Days from one ISO day to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 86_400_000)
}

// --- colours (the terminal's 256-colour palette by name, hex where it matters) ----------------------

export const C = {
  dim: 'gray',
  accent: '#5b8def',
  good: '#3fb950',
  warn: '#d29922',
  bad: '#f85149',
  violet: '#a371f7',
  gold: '#e3b341',
  copper: '#c9824a',
  silver: '#9aa4b2',
  teal: '#39c5bb',
} as const

// --- small marks -----------------------------------------------------------------------------------

/** A short coloured tag: [变好] [模型估计]. */
export function Tag(E: Els, text: string, color: string = C.dim, key?: string): RenderElement {
  const { Text } = E
  return <Text key={key ?? `tag-${text}`} color={color}>{`[${text}]`}</Text>
}

/** A one-line heading with an optional dim note on the right. */
export function Heading(E: Els, title: string, note = '', key?: string): RenderElement {
  const { Box, Text } = E
  return (
    <Box key={key ?? `h-${title}`} flexDirection="row" justifyContent="space-between" marginTop={1}>
      <Text bold>{title}</Text>
      {note ? <Text dimColor>{note}</Text> : null}
    </Box>
  )
}

/**
 * A section: a heading over a bordered body. `width` is the outer width; the body gets width-4 to draw in.
 */
export function Section(E: Els, props: { title: string; note?: string; key?: string; width: number; children: Node[] | Node; tone?: string }): RenderElement {
  const { Box, Text } = E
  const kids = (Array.isArray(props.children) ? props.children : [props.children]).filter((child): child is RenderElement => child !== null)
  return (
    <Box key={props.key ?? `sec-${props.title}`} flexDirection="column" borderStyle="round" borderColor={props.tone ?? C.dim} paddingX={1} width={props.width} marginBottom={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold>{props.title}</Text>
        {props.note ? <Text dimColor>{fit(props.note, Math.max(8, props.width - cells(props.title) - 8))}</Text> : null}
      </Box>
      {kids}
    </Box>
  )
}

/** A label on the left and a value on the right, on one line. */
export function KV(E: Els, label: string, value: string, opts: { key?: string; width: number; color?: string; bold?: boolean }): RenderElement {
  const { Box, Text } = E
  const room = Math.max(4, opts.width - cells(value) - 2)
  return (
    <Box key={opts.key ?? `kv-${label}`} flexDirection="row" justifyContent="space-between" width={opts.width}>
      <Text>{fit(label, room)}</Text>
      <Text color={opts.color} bold={opts.bold}>{value}</Text>
    </Box>
  )
}

/** Plain wrapped lines. */
export function Lines(E: Els, lines: readonly string[], opts: { key?: string; dim?: boolean; color?: string } = {}): RenderElement {
  const { Box, Text } = E
  return (
    <Box key={opts.key ?? `lines-${lines[0]?.slice(0, 12) ?? ''}`} flexDirection="column">
      {lines.filter(Boolean).map((line, i) => <Text key={`l${i}`} dimColor={opts.dim} color={opts.color} wrap="wrap">{zh(line)}</Text>)}
    </Box>
  )
}

export function Muted(E: Els, text: string, key?: string): RenderElement {
  const { Text } = E
  return <Text key={key ?? `m-${text.slice(0, 16)}`} dimColor wrap="wrap">{zh(text)}</Text>
}

export function Loading(E: Els, text = '正在读取…'): RenderElement {
  const { Text } = E
  return <Text key="loading" dimColor>{text}</Text>
}

export function Failed(E: Els, error: string, retry?: () => void): RenderElement {
  const { Box, Text, Button } = E
  return (
    <Box key="failed" flexDirection="column">
      <Text color={C.warn} wrap="wrap">{`没有读到：${error || '未知原因'}`}</Text>
      {retry ? <Button key="retry" label="重试" onPress={() => retry()} /> : null}
    </Box>
  )
}

/** The loading / error / data switch for one route. */
export function routeState(ctx: Ctx, path: string): { kind: 'loading' } | { kind: 'error'; error: string } | { kind: 'ok'; json: Record<string, unknown> } {
  const cached = ctx.route(path)
  if (!cached || (cached.loading && cached.json === null)) return { kind: 'loading' }
  if (cached.status !== 200 || cached.json === null) {
    const json = cached.json as { error?: unknown } | null
    return { kind: 'error', error: cached.error || (typeof json?.error === 'string' ? json.error : `HTTP ${cached.status}`) }
  }
  return { kind: 'ok', json: cached.json as Record<string, unknown> }
}

// --- charts in text -----------------------------------------------------------------------------------

const SPARK = '▁▂▃▄▅▆▇█'

/** A sparkline of `values` in `width` cells (resampled), optionally against a band [lo, hi]. */
export function spark(values: readonly number[], width: number): string {
  const nums = values.filter((v) => Number.isFinite(v))
  if (nums.length === 0) return ''
  const w = Math.max(1, Math.min(width, nums.length))
  const pick = Array.from({ length: w }, (_, i) => nums[Math.round((i * (nums.length - 1)) / Math.max(1, w - 1))] as number)
  const lo = Math.min(...pick)
  const hi = Math.max(...pick)
  const span = hi - lo || 1
  return pick.map((v) => SPARK[Math.min(7, Math.max(0, Math.round(((v - lo) / span) * 7)))]).join('')
}

/** A horizontal bar of `frac` (0..1) in `width` cells, with eighth-cell resolution. */
export function bar(frac: number, width: number): string {
  const f = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0))
  const eighths = Math.round(f * width * 8)
  const full = Math.floor(eighths / 8)
  const part = eighths % 8
  const parts = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']
  return `${'█'.repeat(full)}${parts[part] ?? ''}`.padEnd(width, ' ')
}

/** Days as cells: ■ done, □ missed, · no record, ▣ today. */
export function dayStrip(states: ReadonlyArray<boolean | null>, todayIndex = -1): string {
  return states.map((state, i) => (i === todayIndex && state === null ? '▣' : state === true ? '■' : state === false ? '□' : '·')).join('')
}

/** A number folded unless the privacy switch shows it. */
export function masked(ctx: Ctx, text: string): string {
  return ctx.privacy.shown ? text : '••'
}

/** A row of buttons. */
export function Buttons(E: Els, buttons: ReadonlyArray<{ key: string; label: string; onPress: () => void; hotkey?: string; primary?: boolean; dim?: boolean }>, key = 'buttons'): RenderElement {
  const { Box, Button } = E
  return (
    <Box key={key} flexDirection="row" gap={1} flexWrap="wrap">
      {buttons.map((b) => (
        <Button
          key={b.key}
          label={b.label}
          onPress={() => b.onPress()}
          {...(b.hotkey ? { hotkey: b.hotkey } : {})}
          {...(b.primary ? { variant: 'primary' as const } : {})}
          {...(b.dim ? { dimColor: true } : {})}
        />
      ))}
    </Box>
  )
}

/** A link-like plain button: `label` drawn without brackets. */
export function LinkButton(E: Els, label: string, onPress: () => void, key?: string): RenderElement {
  const { Button } = E
  return <Button key={key ?? `lb-${label}`} plain label={label} onPress={() => onPress()} />
}

/** Markdown where the surface draws it (all do). */
export function Md(E: Els, text: string, key = 'md'): RenderElement {
  const { Markdown } = E
  return <Markdown key={key} text={text.slice(0, 9800)} />
}

/** Whether the surface has the terminal's cell-grid element. */
export function hasRaster(E: Els): boolean {
  return 'Raster' in E
}
