// 通往 120 岁 in the pane: Pi and today's three things on 总览, the road page (stations, Pi's forms, the medal
// wall, what counted), and the celebration drawn over the pane when a station is reached or Pi grows.
// Pi grows with things done that leave a record, never with a check-in or a health number.

import type { RenderElement } from 'claude-code'

import type { Celebration } from '../../../types'
import type { GameAction, GameView } from '../../app/game.ts'
import type { Ctx, Els, Node, Page } from '../types.ts'
import { C, cells, fit, zh } from '../kit.tsx'
import type { Frame } from '../codex/pixels.ts'
import { CELEBRATE_MS, celebrateFrame, moodAt, piFrame, roadFrame } from './anim.ts'
import { medal, PI_FORMS, piSprite, type PiForm } from './sprites.ts'
import { Frame as PixelFrame } from '../codex/pixels.ts'

export type { GameView }

const DEED_ROWS: ReadonlyArray<[keyof GameView['deeds'], string]> = [
  ['reports', '体检报告'], ['measures', '自测'], ['cards', '研究卡'], ['species', '物种'], ['experiments', '小实验'],
  ['reveals', '揭晓'], ['visits', '带简报看医生'], ['retests', '复查'], ['methods', '算过的方法'], ['analyses', '深度分析'],
  ['plans', '方案'], ['family', '家人'], ['seasons', '赛季'], ['profile', '基本情况'],
]

/** A frame as the surface draws pictures: cells in the terminal, an SVG elsewhere. */
export function picture(E: Els, key: string, frame: Frame, alt: string, scale = 4): RenderElement {
  const { Text } = E
  if ('Raster' in E) {
    const { Raster } = E
    const c = frame.cells()
    return <Raster key={key} columns={c.columns} rows={c.rows} cells={c.cells} />
  }
  if ('Svg' in E) {
    const { Svg } = E as Els & { Svg: (props: { source: string; alt: string; width?: number }) => RenderElement }
    return <Svg key={key} source={frame.svg(scale)} alt={alt} width={frame.w * scale} />
  }
  return <Text key={key} dimColor>{`［${alt}］`}</Text>
}

function run(ctx: Ctx, action: GameAction): void {
  if (action.kind === 'go') ctx.act.go(action.tab as Parameters<Ctx['act']['go']>[0], action.sub)
  else if (action.kind === 'say') ctx.act.say(action.text)
  else ctx.act.fill(action.text)
}

function nextLine(game: GameView): string {
  if (game.form.next_at == null || game.form.next_zh == null) return `一共做了 ${game.points} 件事。`
  return `一共做了 ${game.points} 件事 · 再做 ${game.form.next_at - game.points} 件，长成「${game.form.next_zh}」`
}

function still(ctx: Ctx): boolean {
  return ctx.privacy.presentation
}

/** The 总览 card: Pi (animated by the pane's idle driver), its line, and today's three things. */
export function PiCard(ctx: Ctx): Node {
  const game = ctx.json<GameView>('game')
  if (!game) return null
  const { Box, Text, Button } = ctx.E
  const form = game.form.no as PiForm
  const pic = picture(ctx.E, 'pi-card', piFrame(form, still(ctx) ? 'idle' : moodAt(ctx.now), 0), game.form.zh, 3)
  const right = Math.max(24, ctx.width - 34)
  const title = game.demo ? `示例档案的 Pi · ${game.form.zh}` : game.member ? `你的 Pi · ${game.form.zh}` : `Pi · ${game.form.zh}`
  const things = game.things.map((thing, i) => (
    <Box key={`thing-${thing.id}`} flexDirection="row" gap={1}>
      <Text color={thing.done ? C.good : C.dim}>{thing.done ? '✓' : `${i + 1}.`}</Text>
      <Box flexShrink={1}><Text {...(thing.done ? { dimColor: true, strikethrough: true } : {})}>{zh(fit(thing.text_zh, right - 10))}</Text></Box>
      {thing.done ? null : <Button key={`thing-go-${i}`} plain label="去" onPress={() => run(ctx, thing.action)} />}
    </Box>
  ))
  return (
    <Box key="pi-card" flexDirection="column" borderStyle="round" borderColor={C.accent} paddingX={1} width={ctx.width} marginBottom={1}>
      <Box key="row" flexDirection="row" gap={2}>
        <Box key="pic" flexDirection="column" flexShrink={0}>{pic}</Box>
        <Box key="text" flexDirection="column" width={right}>
          <Box key="head" flexDirection="row" justifyContent="space-between">
            <Text bold color={C.accent}>{title}</Text>
            <Button key="road" plain hotkey="j" label={`通往 120 · 第 ${game.reached}/12 站 ›`} onPress={() => ctx.act.go('journey')} />
          </Box>
          <Text key="line" dimColor>{zh(fit(game.member ? '现在看的是家人的档案；Pi 跟着你自己的档案长大。' : game.form.line_zh, right))}</Text>
          <Text key="next" dimColor>{zh(fit(nextLine(game), right))}</Text>
          {things.length > 0 ? <Box key="gap" height={1} /> : null}
          {things.length > 0 ? <Text key="three" bold>今天的三件事</Text> : null}
          {things}
        </Box>
      </Box>
    </Box>
  )
}

function stationRow(ctx: Ctx, row: GameView['stations'][number], current: boolean): RenderElement {
  const { Box, Text } = ctx.E
  const done = Boolean(row.reached)
  const day = row.reached ? row.reached.slice(5).replace('-', '/') : ''
  return (
    <Box key={`st-${row.id}`} flexDirection="row" gap={1}>
      <Text color={done ? C.gold : C.dim}>{done ? '●' : current ? '◎' : '○'}</Text>
      <Text color={done ? undefined : C.dim} bold={current}>{`${String(row.no).padStart(2, ' ')}  ${row.title_zh}`}</Text>
      <Box flexShrink={1}><Text dimColor>{done ? day : zh(fit(row.how_zh, Math.max(10, ctx.width - cells(row.title_zh) - 10)))}</Text></Box>
    </Box>
  )
}

function formsRow(ctx: Ctx, game: GameView): RenderElement {
  const { Box, Text } = ctx.E
  const n = PI_FORMS.length
  const w = 30 * n
  const f = new PixelFrame(w, 30)
  PI_FORMS.forEach((row, i) => {
    const sprite = piSprite(i as PiForm, 'idle', 0)
    const reached = i <= game.form.no
    f.sprite(sprite, i * 30 + 1, 1, reached ? {} : { tint: () => 0x2a3138 })
  })
  const fits = ctx.width >= w + 2
  return (
    <Box key="forms" flexDirection="column">
      {fits ? picture(ctx.E, 'pi-forms', f, 'Pi 的五个样子', 2) : null}
      <Box key="labels" flexDirection="row">
        {PI_FORMS.map((row, i) => (
          <Box key={`fl-${i}`} width={fits ? 30 : Math.max(10, Math.floor(ctx.width / n))}>
            <Text color={i <= game.form.no ? C.accent : C.dim}>{fit(i <= game.form.no ? row.zh : `${row.at} 件事`, fits ? 28 : Math.max(8, Math.floor(ctx.width / n) - 1))}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function medalWall(ctx: Ctx, game: GameView): RenderElement {
  const { Box, Text } = ctx.E
  const per = Math.max(1, Math.min(game.medals.length, Math.floor(ctx.width / 16)))
  const rows: RenderElement[] = []
  for (let start = 0; start < game.medals.length; start += per) {
    const slice = game.medals.slice(start, start + per)
    const f = new PixelFrame(16 * slice.length, 16)
    slice.forEach((row, i) => f.sprite(medal(Boolean(row.earned), start + i), i * 16 + 1, 0))
    rows.push(
      <Box key={`mw-${start}`} flexDirection="column">
        {picture(ctx.E, `medals-${start}`, f, '奖章', 3)}
        <Box key="names" flexDirection="row">
          {slice.map((row) => (
            <Box key={`mn-${row.id}`} width={16}><Text color={row.earned ? C.gold : C.dim}>{fit(row.title_zh, 15)}</Text></Box>
          ))}
        </Box>
      </Box>,
    )
  }
  const open = game.medals.filter((row) => !row.earned)
  return (
    <Box key="medals" flexDirection="column">
      {rows}
      {open.length > 0 ? <Text key="how" dimColor>{zh(fit(`下一枚可以这样拿：${open.slice(0, 2).map((row) => `「${row.title_zh}」${row.how_zh}`).join(' ')}`, ctx.width * 2))}</Text> : null}
    </Box>
  )
}

function deedTable(ctx: Ctx, game: GameView): RenderElement {
  const { Box, Text } = ctx.E
  const shown = DEED_ROWS.filter(([key]) => (game.deeds[key] ?? 0) > 0)
  const col = 18
  const per = Math.max(1, Math.floor(ctx.width / col))
  const lines: RenderElement[] = []
  for (let i = 0; i < shown.length; i += per) {
    lines.push(
      <Box key={`dl-${i}`} flexDirection="row">
        {shown.slice(i, i + per).map(([key, label]) => (
          <Box key={`d-${key}`} width={col}><Text>{`${label} `}<Text bold color={C.accent}>{String(game.deeds[key])}</Text></Text></Box>
        ))}
      </Box>,
    )
  }
  return (
    <Box key="deeds" flexDirection="column">
      {lines.length > 0 ? lines : <Text dimColor>还没有。录入一份报告，或者读一张研究卡，就是第一件。</Text>}
    </Box>
  )
}

function section(ctx: Ctx, key: string, title: string, note: string, body: Node[]): RenderElement {
  const { Box, Text } = ctx.E
  return (
    <Box key={key} flexDirection="column" marginBottom={1}>
      <Box key="h" flexDirection="row" gap={2}>
        <Text bold color={C.accent}>{title}</Text>
        {note ? <Text dimColor>{note}</Text> : null}
      </Box>
      {body}
    </Box>
  )
}

function draw(ctx: Ctx): Node {
  const { Box, Text, Button } = ctx.E
  const game = ctx.json<GameView>('game')
  const state = ctx.route('game')
  if (!game) return <Text dimColor>{state?.error ? `没能读到：${state.error}` : '正在读取…'}</Text>
  const form = game.form.no as PiForm
  const current = game.stations.find((row) => !row.reached)
  const roadWidth = Math.min(ctx.width, 110)
  return (
    <Box flexDirection="column">
      {game.demo ? <Text key="demo" color={C.warn}>这是示例档案的路。切回「我」，看你自己的。</Text> : null}
      {section(ctx, 'road', '通往 120 岁', `第 ${game.reached}/12 站`, [
        picture(ctx.E, 'road-pic', roadFrame(roadWidth, game.reached, form, 0), '通往 120 岁的路', 3),
        current ? <Text key="next" dimColor>{zh(`下一站：${current.title_zh}。${current.how_zh}`)}</Text> : <Text key="next" color={C.gold}>十二站都走过了。这条路还长，Pi 陪你接着走。</Text>,
      ])}
      {section(ctx, 'stations', '十二站', '每一站都是一件做了的事，不看化验数值', game.stations.map((row) => stationRow(ctx, row, row.id === current?.id)))}
      {section(ctx, 'forms', 'Pi 的样子', nextLine(game), [formsRow(ctx, game)])}
      {section(ctx, 'medal-wall', '奖章墙', `${game.medals.filter((row) => row.earned).length}/${game.medals.length}`, [medalWall(ctx, game)])}
      {section(ctx, 'deed-list', '你做过的事', '只增不减', [deedTable(ctx, game)])}
      <Text key="rule" dimColor>{zh('Pi 跟着你做过的事长大：录入报告、在家自测、读研究卡、做小实验、复查、带简报看医生。打卡不算，化验数值的高低也不算。')}</Text>
      <Box key="back" marginTop={1}><Button key="to-overview" plain label="‹ 回总览" onPress={() => ctx.act.go('overview')} /></Box>
    </Box>
  )
}

export const page: Page = {
  tab: 'journey',
  label: '通往120',
  routes: () => ['game', 'people'],
  draw,
}

/** The celebration over the pane: the picture (blitted by the driver while it moves), the words, 好. */
export function CelebrationTree(ctx: Ctx, c: NonNullable<Celebration>, form: PiForm): RenderElement {
  const { Box, Text, Button } = ctx.E
  const t = still(ctx) ? CELEBRATE_MS : Math.max(0, ctx.now - c.since)
  const frame = celebrateFrame(Math.min(ctx.width, 72), t, form, c.from == null ? null : (c.from as PiForm))
  return (
    <Box key="celebrate" flexDirection="column" alignItems="center" width={ctx.width}>
      {picture(ctx.E, 'pi-celebrate', frame, 'Pi 在庆祝', 4)}
      {c.lines.map((line, i) => <Text key={`cl-${i}`} bold={i === 0} color={i === 0 ? C.gold : undefined}>{zh(line)}</Text>)}
      <Box key="btns" flexDirection="row" gap={2} marginTop={1}>
        <Button key="cel-ok" hotkey="o" label="好" onPress={() => ctx.act.celebrated(false)} />
        <Button key="cel-road" plain hotkey="j" label="看看这条路 ›" onPress={() => ctx.act.celebrated(true)} />
      </Box>
    </Box>
  )
}
