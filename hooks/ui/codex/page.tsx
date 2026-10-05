// 长寿图鉴 (docs/codex-design.md 1.3) in the terminal: the web Codex panel (src/client/engage/codex-page.ts)
// with its pixel cards drawn into the engine's Raster, two pixels to a cell. The main line is a two-week
// personal experiment (three to choose from → do it → turn the card); the library is free to read; a retest
// brings a pack of result cards; what the person did is kept as footprint cards. The stage (a pack being torn,
// a card being turned) is animated by register.tsx frame by frame from stage.ts.

import type { RenderElement } from 'claude-code'

import type { ChapterInfo, Footprint, ResultCard, RunResult, SpeciesInfo, StudyCard } from '../../core/contracts/codex.ts'
import type { CodexView, ExperimentOption, RunView } from '../../core/engage/engine.ts'
import { CODEX_INTRO, SEASON_INTRO } from '../../core/ux/plain.ts'
import { C, cells, fit, Loading, Muted, zh } from '../kit.tsx'
import type { Ctx, Els, Node, Page } from '../types.ts'
import { cardBack, experimentFace, footprintFace, pack as packSprite, speciesFace, studyFace, type Raster } from './art.ts'
import { cardLeft, cardText, packLayout, shelfFrame } from './anim.ts'
import { faceCells, Frame, shrink } from './pixels.ts'
import { goodRun, isAnimated, optionFace, payloadOf, runFace, stageAt, stageCols, type StagePayload } from './stage.ts'

type Tier = StudyCard['tier']
type LibStudy = StudyCard & { read: boolean; relation_zh: string | null }
type LibSpecies = SpeciesInfo & { met: boolean }
type LibraryView = { ok: boolean; revision: string | null; note_zh: string; chapters: Array<ChapterInfo & { size?: number }>; species: LibSpecies[]; pending: number; studies: LibStudy[] }
type Pack = CodexView['packs'][number]

const TIERS: Record<Tier, { metal: string; label: string; color: string }> = {
  cell: { metal: '铜', label: '细胞实验', color: C.copper },
  animal: { metal: '银', label: '动物实验', color: C.silver },
  human: { metal: '紫', label: '人群研究', color: C.violet },
  trial: { metal: '金', label: '人体随机试验', color: C.gold },
}
const TIER_ORDER: Tier[] = ['cell', 'animal', 'human', 'trial']
const OUTCOME_STAMP = { outside: '超出波动', inside: '波动内', insufficient: '数据不够' } as const
const OBJECT_ZH: Record<string, string> = { human: '人', cell_line: '细胞', multi_species: '多种动物', other: '其他动物' }
const TABS: Array<[string, string]> = [['exp', '实验'], ['library', '图书馆'], ['deck', '牌组'], ['species', '物种志'], ['footprints', '足迹'], ['settings', '设置']]

const INK = '#0d0f12'
const CREAM = '#f4ead5'
const PANEL = '#232a30'

function goodResult(result: RunResult | null | undefined): boolean {
  return result?.outcome === 'outside' && result.primary.direction === 'better'
}

function dayZh(day: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? '')
  return m ? `${Number(m[2])}月${Number(m[3])}日` : ''
}

const sub = (ctx: Ctx, key: string): string => ctx.view.sub[`codex.${key}`] ?? ''
const setSub = (ctx: Ctx, key: string, value: string) => ctx.act.setSub(`codex.${key}`, value)

// --- pictures --------------------------------------------------------------------------------------------

/** A frame as the surface draws pictures: cells in the terminal, an SVG elsewhere. */
function picture(ctx: Ctx, key: string, frame: Frame, alt: string, scale = 4): RenderElement {
  const E = ctx.E
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

function face(ctx: Ctx, key: string, raster: Raster, n: number, alt: string): RenderElement {
  const small = shrink(raster, n)
  const frame = new Frame(small.w, small.h + (small.h % 2))
  frame.sprite(small, 0, 0)
  void faceCells
  return picture(ctx, key, frame, alt, n === 1 ? 4 : 3)
}

/** Words drawn over a picture, at a cell position (terminal); placed in the flow below it elsewhere. */
function over(ctx: Ctx, key: string, row: number, col: number, width: number, text: string, colors: { fg: string; bg: string; bold?: boolean }): RenderElement | null {
  if (!text || width < 2) return null
  const { Box, Text } = ctx.E
  return (
    <Box key={key} position="absolute" top={row} left={col} width={width} justifyContent="center">
      <Text color={colors.fg} backgroundColor={colors.bg} bold={colors.bold}>{fit(text, width)}</Text>
    </Box>
  )
}

function cardWords(ctx: Ctx, key: string, x: number, y: number, n: number, words: { top?: string; name?: string; stamp?: { text: string; good: boolean } }): Array<RenderElement | null> {
  const at = cardText(x, y, n)
  return [
    n <= 2 && words.top ? over(ctx, `${key}-top`, at.top.row, at.top.col, at.top.width, words.top, { fg: INK, bg: CREAM }) : null,
    words.name ? over(ctx, `${key}-name`, at.name.row, at.name.col, at.name.width, words.name, { fg: CREAM, bg: PANEL, bold: true }) : null,
    words.stamp ? over(ctx, `${key}-stamp`, at.stamp.row, at.stamp.col, at.stamp.width, words.stamp.text, { fg: words.stamp.good ? '#3a2600' : INK, bg: words.stamp.good ? '#f2b53a' : '#8b949e', bold: true }) : null,
  ]
}

// --- small pieces ----------------------------------------------------------------------------------------

function H2(E: Els, text: string, key?: string): RenderElement {
  const { Text } = E
  return <Text key={key ?? `h2-${text}`} bold color={C.gold}>{text}</Text>
}

function Lead(E: Els, text: string, key?: string): RenderElement {
  const { Text } = E
  return <Text key={key ?? `lead-${text.slice(0, 10)}`} wrap="wrap">{zh(text)}</Text>
}

function Cap(E: Els, text: string, key?: string): RenderElement {
  const { Text } = E
  return <Text key={key ?? `cap-${text.slice(0, 10)}`} dimColor wrap="wrap">{zh(text)}</Text>
}

function Box2(ctx: Ctx, key: string, children: Array<RenderElement | null>, tone: string = '#30363d'): RenderElement {
  const { Box } = ctx.E
  return (
    <Box key={key} flexDirection="column" borderStyle="round" borderColor={tone} paddingX={1} marginBottom={1} width={ctx.width}>
      {children.filter((child): child is RenderElement => child !== null)}
    </Box>
  )
}

function Btn(ctx: Ctx, key: string, label: string, onPress: () => void, opts: { primary?: boolean; hotkey?: string; dim?: boolean } = {}): RenderElement {
  const { Button } = ctx.E
  return (
    <Button
      key={key}
      label={label}
      onPress={() => onPress()}
      {...(opts.primary ? { variant: 'primary' as const } : {})}
      {...(opts.hotkey ? { hotkey: opts.hotkey } : {})}
      {...(opts.dim ? { dimColor: true } : {})}
    />
  )
}

function Row(ctx: Ctx, key: string, children: Array<RenderElement | null>): RenderElement {
  const { Box } = ctx.E
  return <Box key={key} flexDirection="row" gap={1} flexWrap="wrap">{children.filter((child): child is RenderElement => child !== null)}</Box>
}

/** A picture with text beside it when there is room, under it otherwise. */
function Pair(ctx: Ctx, key: string, pic: RenderElement, picCols: number, text: Array<RenderElement | null>): RenderElement {
  const { Box } = ctx.E
  const side = ctx.width - picCols - 6 >= 30
  return (
    <Box key={key} flexDirection={side ? 'row' : 'column'} gap={side ? 2 : 0} marginBottom={1}>
      <Box flexShrink={0}>{pic}</Box>
      <Box flexDirection="column" flexGrow={1} flexShrink={1} {...(side ? { width: Math.max(20, ctx.width - picCols - 8) } : {})}>
        {text.filter((child): child is RenderElement => child !== null)}
      </Box>
    </Box>
  )
}

// --- the header ------------------------------------------------------------------------------------------

function seasonLine(view: CodexView): string {
  const season = view.season
  if (!view.enabled || !view.started || !season) return '读研究，做两周的小实验，翻开看自己的结果。'
  if (season.status === 'closed') return '赛季已结束。做过的实验都在牌组里。'
  const mode = season.mode === 'retest' ? '到下次复查为止' : `共 ${season.weeks} 周`
  const parts = [`赛季 · 第 ${season.week} 周 / ${mode}`]
  if (view.packs.length > 0) parts.push(`${view.packs.length} 个包等你拆开`)
  if (view.ready.length > 0) parts.push(`${view.ready.length} 张实验卡可以翻了`)
  return parts.join(' · ')
}

function header(ctx: Ctx, view: CodexView | null): RenderElement {
  const { Box, Text } = ctx.E
  const logo = face(ctx, 'logo', cardBack(), 5, '卡背')
  return (
    <Box key="codex-head" flexDirection="row" gap={2} marginBottom={1}>
      {logo}
      <Box flexDirection="column">
        <Text bold color={C.teal}>长寿图鉴</Text>
        <Text dimColor wrap="wrap">{view ? seasonLine(view) : '读研究，做两周的小实验，翻开看自己的结果。'}</Text>
      </Box>
    </Box>
  )
}

// --- first open ------------------------------------------------------------------------------------------

function firstOpen(ctx: Ctx, view: CodexView): RenderElement {
  const { Box, Text } = ctx.E
  const start = sub(ctx, 'myday.start') || view.intro.my_day.start
  const end = sub(ctx, 'myday.end') || view.intro.my_day.end
  const mode = (sub(ctx, 'season') || view.intro.season_mode) as '8w' | 'retest'
  const standup = (sub(ctx, 'standup') || (view.intro.standup ? '1' : '')) === '1'
  const timeInput = (key: string, label: string, value: string) => {
    if (!('Input' in ctx.E)) return <Text key={key}>{`${label} ${value}`}</Text>
    const { Input } = ctx.E as Els & { Input: (props: Record<string, unknown>) => RenderElement }
    return <Input key={key} label={label} value={value} placeholder="09:00" submitLabel="记下" onSubmit={(text: string) => { if (/^\d{1,2}:\d{2}$/.test(text.trim())) setSub(ctx, key === 'start' ? 'myday.start' : 'myday.end', text.trim().padStart(5, '0')) }} />
  }
  return Box2(ctx, 'first', [
    Pair(ctx, 'first-pair', face(ctx, 'first-pack', packSprite('experiment'), 2, '实验包'), 15, [
      H2(ctx.E, '第一次打开长寿图鉴'),
      Lead(ctx.E, CODEX_INTRO),
      Cap(ctx.E, SEASON_INTRO),
    ]),
    <Text key="q1" bold>你通常几点开始、几点结束一天的工作？</Text>,
    <Box key="times" flexDirection="row" gap={2}>{timeInput('start', '开始', start)}{timeInput('end', '结束', end)}</Box>,
    Cap(ctx.E, '可以跨过午夜，比如 13:00 到 02:00。LongPi 只在这段时间里提醒你。', 'cap-myday'),
    <Text key="q2" bold>一个赛季多长？</Text>,
    Row(ctx, 'season-mode', [
      Btn(ctx, 'mode-8w', mode === '8w' ? '● 8 周' : '○ 8 周', () => setSub(ctx, 'season', '8w')),
      Btn(ctx, 'mode-retest', mode === 'retest' ? '● 到下次复查为止' : '○ 到下次复查为止', () => setSub(ctx, 'season', 'retest')),
    ]),
    <Text key="q3" bold>起身提醒</Text>,
    view.intro.wristband
      ? Row(ctx, 'standup', [
        Btn(ctx, 'standup-toggle', standup ? '● 坐太久时提醒我起来走两分钟' : '○ 坐太久时提醒我起来走两分钟', () => setSub(ctx, 'standup', standup ? '0' : '1')),
      ])
      : Lead(ctx.E, '没有手环时，不会出现起身提醒。', 'no-wristband'),
    view.intro.wristband ? Cap(ctx.E, '你在电脑前已经坐了 90 分钟、又正好在等 Claude 跑任务时，提示栏会出现一行小字。点「好」后手环记到你走动才算一次。每天最多两次，不发奖励。', 'cap-standup') : null,
    Row(ctx, 'start-row', [
      Btn(ctx, 'season-start', '开始', () => void ctx.act.codex.act({ action: 'start', my_day: { start, end }, season_mode: mode, standup: view.intro.wristband ? standup : false }), { primary: true, hotkey: 'k' }),
    ]),
  ], C.teal)
}

// --- 实验 ------------------------------------------------------------------------------------------------

function optionPayload(option: ExperimentOption): StagePayload {
  return { option, answers: {}, randomized: false }
}

function experimentsTab(ctx: Ctx, view: CodexView): RenderElement[] {
  const E = ctx.E
  const { Text } = E
  const out: RenderElement[] = []
  if (view.ready.length > 0) {
    out.push(Box2(ctx, 'ready', [
      H2(E, '可以翻了'),
      ...view.ready.map((run, i) => Pair(ctx, `ready-${run.id}`, face(ctx, `ready-back-${run.id}`, cardBack(), 3, '卡背'), 17, [
        <Text key="t" bold>{`「${run.title_zh}」做完了`}</Text>,
        Lead(E, `${run.days} 天里做到了 ${run.done_count} 天。`, `done-${run.id}`),
        Cap(E, `翻开看主要结果：${run.primary_zh}，有没有超出你的平时波动。`, `look-${run.id}`),
        Row(ctx, `ready-btns-${run.id}`, [Btn(ctx, `reveal-${run.id}`, '翻开', () => ctx.act.codex.open('reveal', run.id, { run }, 'back'), { primary: true, ...(i === 0 ? { hotkey: 'f' } : {}) })]),
      ])),
    ], C.gold))
  }
  if (view.packs.length > 0) {
    out.push(Box2(ctx, 'packs', [
      H2(E, '等你拆开的包'),
      Lead(E, '实验包里有三个小实验（多数是两周），选一个开始；复查包里是这次体检能算出的结果卡。包会一直留着。', 'packs-lead'),
      ...view.packs.map((pack: Pack, i) => Pair(ctx, `pack-${pack.id}`, face(ctx, `pack-sprite-${pack.id}`, packSprite(pack.kind), 2, pack.kind === 'experiment' ? '实验包' : '复查包'), 15, [
        <Text key="n" bold>{pack.kind === 'experiment' ? '实验包' : '复查包'}</Text>,
        Cap(E, pack.source_zh, `src-${pack.id}`),
        <Text key="st" color={C.gold}>{pack.empty_zh ?? (pack.opened ? '拆开了，还没选' : '点开拆')}</Text>,
        Row(ctx, `pack-btns-${pack.id}`, [
          Btn(ctx, `open-${pack.id}`, pack.opened && pack.options.length > 0 ? '看三张' : '拆开', () => {
            const opened = pack.kind === 'experiment' && Boolean(pack.opened) && pack.options.length > 0
            ctx.act.codex.open('pack', pack.id, { packKind: pack.kind, sourceZh: pack.source_zh, options: opened ? pack.options : [], results: [] }, opened ? 'cards' : 'idle')
          }, { primary: true, ...(i === 0 ? { hotkey: 'o' } : {}) }),
        ]),
      ])),
    ], '#ef8a2a'))
  }
  const running = [
    H2(E, '进行中'),
    ...(view.running.length === 0
      ? [Muted(E, view.packs.some((pack) => pack.kind === 'experiment') ? '现在没有进行中的实验。拆开上面的实验包，选一个开始。' : '现在没有进行中的实验。做完一个实验、或者新赛季开始时，会有新的实验包。', 'run-empty')]
      : view.running.map((run) => runBlock(ctx, run))),
    view.running.length > 0 ? Cap(E, '卡片底部 14 格是 14 天：亮的是做到的日子，暗的是断掉的日子，浅色是还没到的日子。断几天没关系，有 10 天的数据就能揭晓。', 'cells-cap') : null,
  ]
  out.push(Box2(ctx, 'running', running))
  if (view.reserve.length > 0) {
    out.push(Box2(ctx, 'reserve', [
      H2(E, '待选'),
      Lead(E, '之前没选的实验放在这里，下次可以直接开始。', 'reserve-lead'),
      ...view.reserve.map((option) => Pair(ctx, `res-${option.id}`, face(ctx, `res-face-${option.id}`, optionFace(option), 4, option.title_zh), 13, [
        <Text key="t" bold>{option.title_zh}</Text>,
        Lead(E, option.do_zh, `do-${option.id}`),
        Cap(E, `看什么：${option.primary_zh} · ${option.days} 天${option.randomizable ? ' · 可选随机版' : ''}${option.needs_retest ? ' · 等复查揭晓' : ''}`, `see-${option.id}`),
        Row(ctx, `res-btns-${option.id}`, [Btn(ctx, `choose-${option.id}`, '开始', () => ctx.act.codex.open('choose', option.id, optionPayload(option), 'front'))]),
      ])),
    ]))
  }
  return out
}

function runBlock(ctx: Ctx, run: RunView): RenderElement {
  const E = ctx.E
  const { Text } = E
  const canTick = run.status === 'running' && Boolean(run.checkin_zh)
  const open = sub(ctx, `how.${run.id}`) === '1'
  return Pair(ctx, `run-${run.id}`, face(ctx, `run-face-${run.id}`, runFace(run), 2, run.title_zh), 25, [
    <Text key="t" bold color={C.teal}>{run.title_zh}</Text>,
    <Text key="d">{run.status === 'retest_wait' ? '等复查' : `第 ${run.day}/${run.days} 天${run.randomized ? ' · 随机版' : ''}`}</Text>,
    run.today_zh ? <Text key="today" color={C.accent}>{run.today_zh}</Text> : null,
    <Text key="do" wrap="wrap"><Text color={C.gold}>做什么　</Text>{run.do_zh}</Text>,
    <Text key="see" wrap="wrap"><Text color={C.gold}>看什么　</Text>{run.primary_zh}</Text>,
    run.status === 'retest_wait' ? Cap(E, '这个实验的结果靠化验。下次复查的结果进了档案，会在复查包里揭晓。', `wait-${run.id}`) : null,
    canTick ? Row(ctx, `tick-${run.id}`, [
      Btn(ctx, `tick-btn-${run.id}`, run.done_today ? `今天已记：${run.checkin_zh.replace(/^今天/, '')}` : run.checkin_zh, () => void ctx.act.codex.act({ action: 'checkin', run_id: run.id, done: !run.done_today }), { primary: !run.done_today }),
    ]) : null,
    canTick && run.done_today ? Cap(E, '记错了就再点一下。', `undo-${run.id}`) : null,
    run.status === 'running' && !run.checkin_zh ? Cap(E, '这个实验不用你记，手环或血压计会自动记上。', `auto-${run.id}`) : null,
    Row(ctx, `run-more-${run.id}`, [
      Btn(ctx, `how-${run.id}`, open ? '收起「怎么判定」' : '怎么判定', () => setSub(ctx, `how.${run.id}`, open ? '' : '1'), { dim: true }),
      Btn(ctx, `stop-${run.id}`, '停下', () => {
        void ctx.act.ask(`停下「${run.title_zh}」？停下不算失败，也不扣任何东西。`, ['停下', '再想想'], '长寿图鉴').then((answer) => {
          if (answer === '停下') void ctx.act.codex.act({ action: 'stop', run_id: run.id })
        })
      }, { dim: true }),
    ]),
    open ? Cap(E, run.threshold_zh, `thr-${run.id}`) : null,
  ])
}

// --- 图书馆 ----------------------------------------------------------------------------------------------

function speciesNameOf(lib: LibraryView | null): (key: string) => string {
  return (key) => lib?.species.find((row) => row.key === key)?.name_zh ?? OBJECT_ZH[key] ?? key
}

function objectOf(card: StudyCard, speciesName: (key: string) => string): string {
  if (card.tier === 'cell') return '细胞'
  if (card.tier === 'human' || card.tier === 'trial') return '人'
  const animal = card.species.find((key) => key !== 'human' && key !== 'cell_line')
  return animal ? speciesName(animal) : '动物'
}

function studyRow(ctx: Ctx, card: LibStudy, speciesName: (key: string) => string): RenderElement {
  const { Box, Text, Button } = ctx.E
  const tier = TIERS[card.tier]
  const head = `No.${card.no} `
  const room = Math.max(10, ctx.width - 26)
  return (
    <Box key={`study-${card.id}`} flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text color={tier.color}>{`■${tier.metal}`}</Text>
        <Button key={`read-${card.id}`} plain label={fit(`${head}${card.title_zh}`, room)} onPress={() => ctx.act.codex.open('study', card.id, { study: card }, 'front')} />
        <Text dimColor>{`${objectOf(card, speciesName)}${card.source.year ? ` · ${card.source.year}` : ''}`}</Text>
        {card.read ? <Text color={C.accent}>已读</Text> : null}
      </Box>
      <Box paddingLeft={4}>
        <Text dimColor wrap="truncate-end">{card.relation_zh ? `和你的关系：${card.relation_zh}` : card.line_zh}</Text>
      </Box>
    </Box>
  )
}

function libraryTab(ctx: Ctx, lib: LibraryView | null, libState: string): RenderElement[] {
  const E = ctx.E
  const { Box, Text } = E
  if (!lib) return [Box2(ctx, 'lib-loading', [libState ? Lead(E, `没能打开图书馆：${libState}`) : Loading(E, '正在打开图书馆…')])]
  const speciesName = speciesNameOf(lib)
  const chapters = [...lib.chapters].sort((a, b) => a.no - b.no)
  const read = lib.studies.filter((row) => row.read).length
  const pending = lib.pending > 0 ? Cap(E, `还有 ${lib.pending} 张卡在审核，审核通过后上架。`, 'pending') : null
  if (lib.studies.length === 0) return [Box2(ctx, 'lib-empty', [H2(E, '图书馆'), Lead(E, '图书馆里还没有上架的研究卡。'), pending])]
  const filterTier = sub(ctx, 'tier') as Tier | ''
  const filterChapter = sub(ctx, 'chapter')
  const order = new Map(chapters.map((row) => [row.id, row.no]))
  const shown = lib.studies.filter((row) => (!filterTier || row.tier === filterTier) && (!filterChapter || row.chapter === filterChapter))
    .sort((a, b) => Number(Boolean(b.relation_zh)) - Number(Boolean(a.relation_zh)) || (order.get(a.chapter) ?? 99) - (order.get(b.chapter) ?? 99) || a.no.localeCompare(b.no))
  const mine = shown.filter((row) => row.relation_zh)
  const tierCount = (tier: Tier) => lib.studies.filter((row) => row.tier === tier && (!filterChapter || row.chapter === filterChapter)).length
  const barWidth = 10
  const chapterRows = chapters.map((chapter) => {
    const size = lib.studies.filter((row) => row.chapter === chapter.id).length
    const done = lib.studies.filter((row) => row.chapter === chapter.id && row.read).length
    const filled = size ? Math.round((done / size) * barWidth) : 0
    const on = filterChapter === chapter.id
    return (
      <Box key={`ch-${chapter.id}`} flexDirection="row" gap={1}>
        {Btn(ctx, `chapter-${chapter.id}`, `${on ? '●' : '○'} ${chapter.no > 0 ? `第 ${chapter.no} 章 ` : '✦ '}${chapter.title_zh}`, () => setSub(ctx, 'chapter', on ? '' : chapter.id))}
        <Text color={C.accent}>{'█'.repeat(filled)}<Text dimColor>{'░'.repeat(barWidth - filled)}</Text></Text>
        <Text dimColor>{`读过 ${done}/${size}`}</Text>
      </Box>
    )
  })
  const tierRow = Row(ctx, 'tiers', [
    Btn(ctx, 'tier-all', filterTier ? '全部颜色' : '● 全部颜色', () => setSub(ctx, 'tier', '')),
    ...TIER_ORDER.map((tier) => Btn(ctx, `tier-${tier}`, `${filterTier === tier ? '●' : ''}${TIERS[tier].metal} ${TIERS[tier].label} ${tierCount(tier)}`, () => setSub(ctx, 'tier', filterTier === tier ? '' : tier))),
  ])
  const out: RenderElement[] = [Box2(ctx, 'lib-head', [
    H2(E, '图书馆'),
    Lead(E, `${lib.studies.length} 张研究卡，随时可以读。读过 ${read} 张；读过的卡后面有蓝色的「已读」。`, 'lib-lead'),
    pending,
    ...chapterRows,
    tierRow,
    Cap(E, lib.note_zh, 'lib-note'),
  ])]
  if (shown.length === 0) out.push(Box2(ctx, 'lib-none', [Lead(E, '这个筛选下没有卡。')]))
  const groups: Array<{ key: string; title: string; cards: LibStudy[] }> = []
  if (mine.length > 0) groups.push({ key: 'mine', title: '和你有关', cards: mine })
  const filtered = Boolean(filterChapter || filterTier)
  for (const chapter of chapters) {
    const cards = shown.filter((row) => !row.relation_zh && row.chapter === chapter.id)
    if (cards.length > 0 && (filtered || groups.length === 0 || filterChapter === chapter.id)) groups.push({ key: chapter.id, title: chapter.no > 0 ? `第 ${chapter.no} 章 · ${chapter.title_zh}` : `✦ ${chapter.title_zh}`, cards })
  }
  for (const group of groups) {
    const shelf = shelfFrame(ctx.width - 4, group.cards.map((card) => studyFace(card)), 3)
    out.push(Box2(ctx, `group-${group.key}`, [
      <Text key="gt" bold>{`${group.title} · ${group.cards.length} 张`}</Text>,
      picture(ctx, `shelf-${group.key}`, shelf.frame, `${group.title}的研究卡`),
      ...group.cards.map((card) => studyRow(ctx, card, speciesName)),
    ]))
  }
  if (!filtered && groups.length <= 1) out.push(Cap(E, '点上面的章节，看这一章的卡。', 'pick-chapter'))
  return out
}

// --- 牌组 / 物种志 / 足迹 -----------------------------------------------------------------------------------

function deckTab(ctx: Ctx, view: CodexView): RenderElement[] {
  const E = ctx.E
  const { Box, Text, Button } = E
  if (view.deck.length === 0) return [Box2(ctx, 'deck-empty', [H2(E, '牌组'), Lead(E, '做完的实验翻开后会收进这里，每做一次留一张。')])]
  const shelf = shelfFrame(ctx.width - 4, view.deck.map(runFace), 2, { good: view.deck.map((run) => goodResult(run.result)) })
  return [Box2(ctx, 'deck', [
    H2(E, '牌组'),
    Lead(E, '每做完一个实验留一张卡。主要结果超出你的平时波动时，卡是镭射版。点开看结果。', 'deck-lead'),
    picture(ctx, 'deck-shelf', shelf.frame, '牌组'),
    ...view.deck.map((run) => (
      <Box key={`deck-${run.id}`} flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Button key={`deck-open-${run.id}`} plain label={run.title_zh} onPress={() => ctx.act.codex.open('result', run.id, { run }, 'front')} />
          <Text color={goodResult(run.result) ? C.gold : undefined} dimColor={!goodResult(run.result)}>{run.result ? OUTCOME_STAMP[run.result.outcome] : ''}</Text>
          <Text dimColor>{`${dayZh(run.start)}–${dayZh(run.end)}${run.randomized ? ' · 随机版' : ''}`}</Text>
        </Box>
        {run.result ? <Box paddingLeft={2}><Text dimColor wrap="truncate-end">{run.result.primary.text_zh}</Text></Box> : null}
      </Box>
    )),
  ], C.gold)]
}

function speciesTab(ctx: Ctx, lib: LibraryView | null, libState: string): RenderElement[] {
  const E = ctx.E
  const { Box, Text, Button } = E
  if (!lib) return [Box2(ctx, 'sp-loading', [libState ? Lead(E, `没能打开物种志：${libState}`) : Loading(E, '正在打开物种志…')])]
  const met = lib.species.filter((row) => row.met).length
  const per = Math.max(1, Math.floor((ctx.width - 4 + 2) / (17 + 2)))
  const shelves: RenderElement[] = []
  for (let i = 0; i < lib.species.length; i += per) {
    const rows = lib.species.slice(i, i + per)
    shelves.push(picture(ctx, `sp-shelf-${i}`, shelfFrame(ctx.width - 4, rows.map((row) => speciesFace(row, !row.met)), 3).frame, '物种'))
  }
  return [Box2(ctx, 'species', [
    H2(E, `物种志 · 遇见了 ${met}/${lib.species.length} 种`),
    Lead(E, '第一次读到用到某种动物的研究卡时，就遇见了它。卡下方是寿命尺：从一周到三百年，金点是这种动物，白线是人。', 'sp-lead'),
    ...shelves,
    ...lib.species.map((row) => (
      <Box key={`sp-${row.key}`} flexDirection="column" marginTop={1}>
        <Box flexDirection="row" gap={1}>
          <Text dimColor>{`No.${row.no}`}</Text>
          {row.met
            ? <Button key={`sp-open-${row.key}`} plain label={row.name_zh} onPress={() => ctx.act.codex.open('species', row.key, { species: row }, 'front')} />
            : <Text>？？？</Text>}
          {row.met ? <Text dimColor>{`${row.latin} · 寿命 ${row.lifespan_zh} · ${row.studies.length} 张研究卡`}</Text> : null}
        </Box>
        <Box paddingLeft={2} flexDirection="column">
          {row.met
            ? [<Text key="hook" color={C.gold} wrap="wrap">{zh(String(row.hook_zh ?? ''))}</Text>, <Text key="body" wrap="wrap">{zh(String(row.body_zh ?? ''))}</Text>]
            : [<Text key="lock" dimColor wrap="wrap">{row.studies.length > 0 ? `图书馆里有 ${row.studies.length} 张研究卡用到它。读到其中一张，就会遇见它。` : '图书馆里暂时还没有用到它的研究卡。'}</Text>]}
        </Box>
      </Box>
    )),
  ])]
}

function footprintsTab(ctx: Ctx, view: CodexView): RenderElement[] {
  const E = ctx.E
  const { Box, Text } = E
  return [Box2(ctx, 'footprints', [
    H2(E, '足迹'),
    Lead(E, view.footprints_note_zh, 'fp-note'),
    ...(view.footprints.length === 0
      ? [Muted(E, '还没有足迹。带着简报去看医生、按时复查、做完一个实验，都会记在这里。', 'fp-empty')]
      : view.footprints.map((row: Footprint) => Pair(ctx, `fp-${row.id}`, face(ctx, `fp-face-${row.id}`, footprintFace(row.kind), 4, row.title_zh), 13, [
        <Text key="t" bold>{row.title_zh}</Text>,
        <Text key="d" color={C.gold}>{dayZh(row.day)}</Text>,
        <Text key="x" wrap="wrap">{zh(String(row.text_zh ?? ''))}</Text>,
      ]))),
    view.footprints.length > 0 ? <Box key="fp-sp" /> : null,
  ])]
}

// --- 设置 ------------------------------------------------------------------------------------------------

function settingsTab(ctx: Ctx, view: CodexView): RenderElement[] {
  const E = ctx.E
  const { Box, Text } = E
  const act = ctx.act.codex.act
  const toggle = (key: string, on: boolean, label: string, body: Record<string, unknown>) => Btn(ctx, key, `${on ? '● 开' : '○ 关'}　${label}`, () => void act(body))
  const day = view.prefs.my_day
  const timeInput = (key: 'start' | 'end', label: string) => {
    if (!('Input' in E)) return <Text key={key}>{`${label} ${day[key]}`}</Text>
    const { Input } = E as Els & { Input: (props: Record<string, unknown>) => RenderElement }
    return <Input key={`myday-${key}`} label={label} value={day[key]} placeholder="09:00" submitLabel="保存" onSubmit={(text: string) => {
      const value = text.trim().padStart(5, '0')
      if (/^\d{2}:\d{2}$/.test(value)) void act({ action: 'prefs', my_day: { ...day, [key]: value } }).then((res) => { if (res.ok) ctx.act.toast('我的白天已保存。') })
    }} />
  }
  const row = (key: string, title: string, children: Array<RenderElement | null>) => (
    <Box key={key} flexDirection="column" marginBottom={1}>
      <Text bold>{title}</Text>
      <Box flexDirection="column" paddingLeft={2}>{children.filter((child): child is RenderElement => child !== null)}</Box>
    </Box>
  )
  return [Box2(ctx, 'codex-settings', [
    H2(E, '设置'),
    row('simple', '简洁模式', [toggle('pref-simple', view.prefs.simple, '用列表显示', { action: 'prefs', simple: !view.prefs.simple }), Cap(E, '打开后用列表显示，不翻牌、不放镭射和碎片，内容不变。', 'c1')]),
    row('present', '演示模式', [toggle('pref-present', view.prefs.presentation, '投屏或开会时打开', { action: 'prefs', presentation: !view.prefs.presentation }), Cap(E, '打开后，LongPi 不出现任何提示，图鉴里也不播放动画。', 'c2')]),
    row('myday', '我的白天', [<Box key="t" flexDirection="row" gap={2}>{timeInput('start', '开始')}{timeInput('end', '结束')}</Box>, Cap(E, '提醒只在这段时间里出现。可以跨过午夜，比如 13:00 到 02:00。', 'c3')]),
    row('standup', '起身提醒', view.devices.wristband
      ? [toggle('pref-standup', view.prefs.standup, '坐太久时提醒我起来走两分钟', { action: 'prefs', standup: !view.prefs.standup }), Cap(E, '每天最多两次，不发奖励。点「好」之后手环看到你起身走动，才记一次起身。', 'c4')]
      : [Lead(E, '没有手环时，不会出现起身提醒。', 'c4')]),
    row('season', '赛季长度', [Row(ctx, 'season-btns', [
      Btn(ctx, 'season-8w', view.prefs.season_mode === '8w' ? '● 8 周' : '○ 8 周', () => void act({ action: 'prefs', season_mode: '8w' })),
      Btn(ctx, 'season-retest', view.prefs.season_mode === 'retest' ? '● 到下次复查为止' : '○ 到下次复查为止', () => void act({ action: 'prefs', season_mode: 'retest' })),
    ]), Cap(E, '从下一个赛季开始算。', 'c5')]),
    row('rules', '规则', view.rules_zh.map((line, i) => <Text key={`rule-${i}`} wrap="wrap">{`· ${line}`}</Text>)),
    row('close', '关闭', [Btn(ctx, 'codex-close', '关闭长寿图鉴', () => {
      void ctx.act.ask('关闭长寿图鉴？已经读过的卡、做过的实验和足迹都会留着，随时可以重新打开。', ['关闭', '再想想'], '长寿图鉴').then((answer) => {
        if (answer === '关闭') void act({ action: 'prefs', codex: false })
      })
    }, { dim: true })]),
  ])]
}

// --- the stage -------------------------------------------------------------------------------------------

function choosePanel(ctx: Ctx, option: ExperimentOption, payload: StagePayload, back: { label: string; run: () => void }): Array<RenderElement | null> {
  const E = ctx.E
  const { Text, Box } = E
  const answers = payload.answers ?? {}
  const unanswered = option.questions.some((q) => answers[q.id] === undefined)
  return [
    <Text key="title" bold color={C.teal}>{option.title_zh}</Text>,
    <Text key="do" wrap="wrap"><Text bold>做什么　</Text>{option.do_zh}</Text>,
    <Text key="see" wrap="wrap"><Text bold>看什么　</Text>{option.primary_zh}</Text>,
    option.also_zh.length > 0 ? <Text key="also" wrap="wrap"><Text bold>顺便看　</Text>{option.also_zh.join('、')}</Text> : null,
    <Text key="chips" color={C.teal}>{[`${option.days} 天`, option.randomizable ? '可选随机版' : '', option.needs_retest ? '等复查揭晓' : ''].filter(Boolean).map((chip) => `[${chip}]`).join(' ')}</Text>,
    Cap(E, `来源：${option.source_zh}`, 'source'),
    option.needs_retest ? Cap(E, '这个实验的结果要靠化验，等下次复查时在复查包里揭晓。', 'retest') : null,
    option.lead_in ? Cap(E, '开始前两周量得还不多。开始后先量 7 天当对照，再做 14 天。', 'lead-in') : null,
    option.questions.length > 0 ? <Text key="ask-h" bold>开始前问一句</Text> : null,
    ...option.questions.map((q) => (
      <Box key={`q-${q.id}`} flexDirection="row" gap={1} flexWrap="wrap">
        <Text>{q.text_zh}</Text>
        {Btn(ctx, `q-${q.id}-yes`, answers[q.id] === true ? '● 是' : '○ 是', () => ctx.act.codex.answer(q.id, true))}
        {Btn(ctx, `q-${q.id}-no`, answers[q.id] === false ? '● 不是' : '○ 不是', () => ctx.act.codex.answer(q.id, false))}
      </Box>
    )),
    option.randomizable ? Btn(ctx, 'randomize', payload.randomized ? '● 用随机版' : '○ 用随机版', () => ctx.act.codex.randomize(!payload.randomized)) : null,
    option.randomizable ? Cap(E, '随机版：每天早上由 LongPi 随机定今天做还是不做，两种日子各 7 天，最后比较两种日子。比前后比较更能排除天气和忙闲的影响。', 'rand-cap') : null,
    Row(ctx, 'choose-btns', [
      Btn(ctx, 'begin', '开始这个实验', () => { if (!unanswered) ctx.act.codex.begin() }, { primary: !unanswered, hotkey: 'k', dim: unanswered }),
      Btn(ctx, 'back', back.label, back.run, { hotkey: 'b' }),
    ]),
    unanswered ? Cap(E, '先回答上面的问题。', 'answer-first') : null,
  ]
}

function resultInfo(ctx: Ctx, run: RunView, result: RunResult): Array<RenderElement | null> {
  const E = ctx.E
  const { Text } = E
  const open = sub(ctx, 'how') === '1'
  return [
    <Text key="t" bold color={C.teal}>{run.title_zh}</Text>,
    <Text key="main" bold wrap="wrap">{zh(String(result.primary.text_zh ?? ''))}</Text>,
    result.praise_zh ? <Text key="praise" color={C.gold} wrap="wrap">{zh(String(result.praise_zh ?? ''))}</Text> : null,
    ...result.also.map((row) => <Text key={`also-${row.key}`} wrap="wrap">{zh(String(row.text_zh ?? ''))}</Text>),
    <Text key="done" wrap="wrap">{result.done_zh ?? `${result.window_days} 天里做到了 ${result.done_days} 天。`}</Text>,
    run.randomized ? Cap(E, '这是随机版：比较的是做的日子和不做的日子。', 'rand') : null,
    Btn(ctx, 'how', open ? '收起「怎么算的」' : '怎么算的', () => setSub(ctx, 'how', open ? '' : '1'), { dim: true }),
    open ? Cap(E, result.how_zh, 'how-text') : null,
  ]
}

function studyInfo(ctx: Ctx, card: LibStudy, lib: LibraryView | null, met: string[]): Array<RenderElement | null> {
  const E = ctx.E
  const { Text } = E
  const tier = TIERS[card.tier]
  const chapter = lib?.chapters.find((row) => row.id === card.chapter)
  const speciesName = speciesNameOf(lib)
  const s = card.source
  const head = [`${s.first_author}${s.et_al ? ' 等' : ''}`, s.journal, s.year ? String(s.year) : '', s.preprint ? '预印本' : ''].filter(Boolean).join(' · ')
  return [
    <Text key="t" bold color={tier.color}>{card.title_zh}</Text>,
    <Text key="line" wrap="wrap">{zh(String(card.line_zh ?? ''))}</Text>,
    <Text key="chips"><Text color={tier.color}>{`[${tier.metal} · ${tier.label}]`}</Text>{chapter ? <Text dimColor>{chapter.no > 0 ? ` [第 ${chapter.no} 章 · ${chapter.title_zh}]` : ` [${chapter.title_zh}]`}</Text> : null}</Text>,
    <Text key="about" wrap="wrap"><Text bold>这项研究　</Text>{card.about_zh}</Text>,
    card.relation_zh ? <Text key="mine" color={C.accent} wrap="wrap"><Text bold>和你的关系　</Text>{card.relation_zh}</Text> : null,
    <Text key="why" wrap="wrap"><Text bold>{`为什么是${tier.metal}色　`}</Text>{`${tier.metal} · ${tier.label}：${card.tier_reason_zh}`}</Text>,
    <Text key="src" dimColor wrap="wrap">{`出处：${head}`}</Text>,
    s.doi ? <Text key="doi" dimColor>{`DOI ${s.doi}`}</Text> : null,
    s.coi_zh ? <Text key="coi" dimColor wrap="wrap">{zh(String(s.coi_zh ?? ''))}</Text> : null,
    <Text key="read" color={C.accent}>已读</Text>,
    ...met.map((key) => <Text key={`met-${key}`} color={C.gold}>{`遇见了 ${speciesName(key)}，已放进物种志。`}</Text>),
  ]
}

function stageTree(ctx: Ctx, view: CodexView | null, lib: LibraryView | null): RenderElement {
  const E = ctx.E
  const { Box, Text } = E
  const o = ctx.overlay
  const payload = payloadOf(o)
  const still = Boolean(view?.prefs.presentation || view?.prefs.simple || ctx.privacy.presentation)
  const cols = stageCols(ctx.width)
  const now = stageAt(o, cols, ctx.now, still)
  const animating = isAnimated(o) && !['idle', 'back'].includes(o.phase)
  const close = Btn(ctx, 'stage-close', '关闭 ×', () => ctx.act.codex.close(), { hotkey: 'x', dim: true })
  const words: Array<RenderElement | null> = []
  // Words over the cards, only once they hold still.
  if (now && 'Raster' in E && !animating) {
    if (o.kind === 'pack' && o.phase === 'cards' && !o.chosen) {
      const items = payload.packKind === 'retest' ? (payload.results ?? []) : (payload.options ?? [])
      const layout = packLayout(cols, Math.max(1, items.length))
      items.forEach((item, i) => {
        const slot = layout.slots[i]
        if (!slot) return
        const option = item as ExperimentOption
        const result = item as ResultCard
        words.push(...cardWords(ctx, `card${i}`, slot.x, slot.y, layout.n, payload.packKind === 'retest'
          ? { top: '复查', name: result.title_zh.replace(/（[^）]*）/g, ''), ...(result.outcome ? { stamp: { text: OUTCOME_STAMP[result.outcome], good: result.outcome === 'outside' && !result.plain } } : {}) }
          : { top: `实验 ${option.days}天`, name: option.title_zh }))
      })
    }
    const full = (top: string, name: string, stamp?: { text: string; good: boolean }) => words.push(...cardWords(ctx, 'big', cardLeft(cols), 3, 1, { top, name, ...(stamp ? { stamp } : {}) }))
    if ((o.kind === 'reveal' && o.phase === 'front') || o.kind === 'result') {
      const run = payload.run
      if (run) full(`实验 · ${run.days} 天`, run.title_zh, run.result ? { text: OUTCOME_STAMP[run.result.outcome], good: goodRun(run) } : undefined)
    }
    if (o.kind === 'study' && payload.study) full(`No.${payload.study.no}  ${TIERS[payload.study.tier].label}`, payload.study.title_zh)
    if (o.kind === 'species' && payload.species) full(`No.${payload.species.no}`, payload.species.name_zh)
    if (o.kind === 'choose' && payload.option) full(`实验 · ${payload.option.days} 天`, payload.option.title_zh)
    const picked = o.kind === 'pack' && o.phase === 'cards' && o.chosen ? (payload.options ?? []).find((row) => row.id === o.chosen) : undefined
    if (picked) full(`实验 · ${picked.days} 天`, picked.title_zh)
    if (o.kind === 'footprint' && payload.footprint) full('足迹', payload.footprint.title_zh)
  }
  const pictureBox = now ? (
    <Box key="stage-pic" flexDirection="column" width={cols}>
      {picture(ctx, 'codex-stage', now.frame, '长寿图鉴')}
      {words.filter((w): w is RenderElement => w !== null)}
    </Box>
  ) : null
  const body: Array<RenderElement | null> = []
  const titleOf = () => {
    if (o.kind === 'pack') return payload.packKind === 'retest' ? '复查包' : '实验包'
    if (o.kind === 'reveal') return '翻开实验卡'
    if (o.kind === 'result') return '实验结果'
    if (o.kind === 'study') return '研究卡'
    if (o.kind === 'species') return '物种志'
    if (o.kind === 'choose') return '开始一个实验'
    return '长寿图鉴'
  }
  if (o.kind === 'pack') {
    const name = payload.packKind === 'retest' ? '复查包' : '实验包'
    if (o.phase === 'idle') {
      body.push(Lead(E, `${payload.sourceZh ?? ''}　点一下拆开`, 'pack-hint'), Row(ctx, 'tear-row', [Btn(ctx, 'tear', `拆开${name}`, () => ctx.act.codex.tear(), { primary: true, hotkey: 'o' }), close]))
    } else if (o.phase === 'empty') {
      body.push(Lead(E, o.note || '现在没有适合你的实验。包会一直留着。', 'empty-note'), Row(ctx, 'empty-row', [Btn(ctx, 'ok', '好', () => ctx.act.codex.close(), { primary: true })]))
    } else if (o.phase !== 'cards') {
      body.push(Cap(E, '……', 'tearing'))
    } else if (payload.packKind === 'retest') {
      body.push(H2(E, '这次复查能算出的结果', 'rt-h'), Cap(E, '每张写明和上次相比，有没有超出平时波动。需要先看医生的结果不放在这里，在总览上单独说。', 'rt-cap'))
      if ((payload.results ?? []).length === 0) body.push(Lead(E, '这次复查没有能算出的新结果。', 'rt-none'))
      for (const card of payload.results ?? []) {
        body.push(
          <Box key={`rc-${card.id}`} flexDirection="column" marginTop={1}>
            <Text bold>{card.title_zh}</Text>
            {card.value_zh ? <Text bold color={C.gold}>{card.value_zh}</Text> : null}
            <Text wrap="wrap">{zh(String(card.compare_zh ?? ''))}</Text>
            {card.note_zh && card.note_zh !== card.compare_zh ? <Text dimColor wrap="wrap">{zh(String(card.note_zh ?? ''))}</Text> : null}
          </Box>,
        )
      }
      body.push(Row(ctx, 'rt-row', [Btn(ctx, 'keep', '收好', () => ctx.act.codex.close(), { primary: true, hotkey: 'k' })]))
    } else {
      const options = payload.options ?? []
      const chosen = options.find((row) => row.id === o.chosen)
      if (chosen) {
        body.push(Lead(E, '选这张？', 'pick-q'), ...choosePanel(ctx, chosen, payload, { label: '回到三张', run: () => ctx.act.codex.pick(null) }))
        body.push(Cap(E, '另外两个会放进「待选」，下次可以直接开始。', 'rest-note'))
      } else {
        body.push(H2(E, '三选一', 'three'), Cap(E, '三个小实验，都是按你的数据和方案挑的。选一张看详情；都不想做也可以，包会留着。', 'three-cap'))
        const keys = ['a', 'c', 'e']
        options.forEach((option, i) => {
          body.push(
            <Box key={`opt-${option.id}`} flexDirection="column" marginTop={1}>
              <Box flexDirection="row" gap={1}>
                {Btn(ctx, `pick-${option.id}`, `选「${option.title_zh}」`, () => ctx.act.codex.pick(option.id), { primary: i === 0, ...(keys[i] ? { hotkey: keys[i] } : {}) })}
                <Text color={C.teal}>{`${option.days} 天${option.randomizable ? ' · 可选随机版' : ''}`}</Text>
              </Box>
              <Box flexDirection="column" paddingLeft={2}>
                <Text wrap="wrap"><Text bold>做什么　</Text>{option.do_zh}</Text>
                <Text wrap="wrap"><Text bold>看什么　</Text>{option.primary_zh}{option.also_zh.length ? <Text dimColor>{`（顺便看 ${option.also_zh.join('、')}）`}</Text> : null}</Text>
              </Box>
            </Box>,
          )
        })
        body.push(Row(ctx, 'later-row', [Btn(ctx, 'later', '先不选，包留着', () => ctx.act.codex.close(), { dim: true })]))
      }
    }
  } else if (o.kind === 'reveal') {
    const run = payload.run
    if (run && o.phase === 'back') {
      body.push(<Text key="rv-t" bold>{`「${run.title_zh}」做完了`}</Text>, Lead(E, '翻开看看：主要结果有没有超出你的平时波动。', 'rv-lead'), Row(ctx, 'rv-row', [Btn(ctx, 'turn', payload.busy ? '正在翻…' : '翻开', () => ctx.act.codex.turn(), { primary: true, hotkey: 'f' }), close]))
    } else if (run && o.phase === 'front' && run.result) {
      body.push(...resultInfo(ctx, run, run.result), Row(ctx, 'keep-row', [Btn(ctx, 'to-deck', '收进牌组', () => { ctx.act.codex.close(); setSub(ctx, 'tab', 'deck') }, { primary: true, hotkey: 'k' })]))
    } else {
      body.push(Cap(E, '……', 'turning'))
    }
  } else if (o.kind === 'result' && payload.run) {
    body.push(...(payload.run.result ? resultInfo(ctx, payload.run, payload.run.result) : [Lead(E, '这张卡还没有结果。', 'no-result')]))
  } else if (o.kind === 'study' && payload.study) {
    const card = (lib?.studies.find((row) => row.id === payload.study?.id) ?? { ...payload.study, read: true, relation_zh: null }) as LibStudy
    body.push(...studyInfo(ctx, card, lib, payload.met ?? []))
  } else if (o.kind === 'species' && payload.species) {
    const row = payload.species
    body.push(<Text key="n" bold>{row.name_zh}</Text>, <Text key="l" dimColor>{row.latin}</Text>, <Text key="c" color={C.teal}>{`[寿命 ${row.lifespan_zh}] [${row.studies.length} 张研究卡]`}</Text>, <Text key="h" color={C.gold} wrap="wrap">{zh(String(row.hook_zh ?? ''))}</Text>, <Text key="b" wrap="wrap">{zh(String(row.body_zh ?? ''))}</Text>)
  } else if (o.kind === 'choose' && payload.option) {
    body.push(...choosePanel(ctx, payload.option, payload, { label: '回到列表', run: () => ctx.act.codex.close() }))
  }
  const showClose = !(o.kind === 'pack' && (o.phase === 'idle')) && !(o.kind === 'reveal' && o.phase === 'back')
  // A still, full-size card is about 40 rows: what to read and press goes above it, not below the fold.
  const bodyFirst = o.kind === 'choose' || o.kind === 'study' || o.kind === 'species' || o.kind === 'result' || (o.kind === 'pack' && o.phase === 'cards' && Boolean(o.chosen))
  const bodyBox = <Box key="stage-body" flexDirection="column" marginTop={bodyFirst ? 0 : 1} marginBottom={bodyFirst ? 1 : 0} width={ctx.width}>{body.filter((b): b is RenderElement => b !== null)}</Box>
  return (
    <Box key="codex-stage-box" flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between" width={Math.min(ctx.width, cols)}>
        <Text bold color={C.teal}>{`长寿图鉴 · ${titleOf()}`}</Text>
        {showClose ? close : null}
      </Box>
      {bodyFirst ? bodyBox : null}
      {pictureBox}
      {bodyFirst ? null : bodyBox}
    </Box>
  )
}

// --- the page ----------------------------------------------------------------------------------------------

function draw(ctx: Ctx): Node {
  const E = ctx.E
  const { Box, Text } = E
  const codex = ctx.route('codex')
  const libRoute = ctx.route('codex/library')
  const view = ctx.json<CodexView>('codex')
  const lib = ctx.json<LibraryView>('codex/library')
  const libState = libRoute && libRoute.status !== 200 && !libRoute.loading ? libRoute.error || '读取失败' : ''
  if (ctx.overlay.kind !== 'none') return stageTree(ctx, view, lib)
  if (!view) {
    if (codex && codex.status !== 200 && !codex.loading) {
      return <Box flexDirection="column">{header(ctx, null)}{Box2(ctx, 'fail', [Lead(E, `没能打开长寿图鉴：${codex.error}`), Row(ctx, 'retry', [Btn(ctx, 'retry', '再试一次', () => ctx.act.load(['codex', 'codex/library'], true))])])}</Box>
    }
    return <Box flexDirection="column">{header(ctx, null)}{Loading(E, '正在打开长寿图鉴…')}</Box>
  }
  const member = view.member ? Box2(ctx, 'member', [<Text key="m" wrap="wrap">{zh(String(view.member.note_zh ?? ''))}</Text>], '#c9824a') : null
  if (!view.enabled) {
    const closed = view.reason === 'opt_out'
    return (
      <Box flexDirection="column">
        {header(ctx, view)}
        {member}
        {Box2(ctx, 'off', [
          <Text key="r" bold wrap="wrap">{view.reason_zh || '长寿图鉴没有打开。'}</Text>,
          closed ? Row(ctx, 'reopen', [Btn(ctx, 'reopen', '重新打开', () => void ctx.act.codex.act({ action: 'prefs', codex: true }), { primary: true })]) : null,
          view.needs_consent ? Row(ctx, 'consent', [Btn(ctx, 'go-consent', '去总览完成设置', () => ctx.act.go('overview', { 'overview.onboarding': '1' }))]) : null,
          !view.needs_consent && /年龄/.test(view.reason_zh ?? '') ? Row(ctx, 'age', [Btn(ctx, 'go-age', '去填年龄', () => ctx.act.go('overview', { 'overview.onboarding': '1', 'overview.step': '1' }), { primary: true })]) : null,
        ])}
      </Box>
    )
  }
  if (!view.started) return <Box flexDirection="column">{header(ctx, view)}{member}{firstOpen(ctx, view)}</Box>
  const tab = sub(ctx, 'tab') || 'exp'
  const badge: Record<string, string> = {
    exp: String(view.packs.length + view.ready.length || ''),
    deck: view.deck.length ? String(view.deck.length) : '',
    species: `${view.species.met}/${view.species.total}`,
  }
  const closedSeason = view.season?.status === 'closed'
  const body = tab === 'library' ? libraryTab(ctx, lib, libState)
    : tab === 'deck' ? deckTab(ctx, view)
      : tab === 'species' ? speciesTab(ctx, lib, libState)
        : tab === 'footprints' ? footprintsTab(ctx, view)
          : tab === 'settings' ? settingsTab(ctx, view)
            : experimentsTab(ctx, view)
  return (
    <Box flexDirection="column">
      {header(ctx, view)}
      {member}
      {closedSeason ? Row(ctx, 'next-season', [Btn(ctx, 'next-season', '开始下一个赛季', () => void ctx.act.codex.act({ action: 'next_season' }), { primary: true })]) : null}
      {Row(ctx, 'codex-tabs', TABS.map(([key, label]) => Btn(ctx, `ctab-${key}`, `${tab === key ? '【' : ''}${label}${badge[key] ? ` ${badge[key]}` : ''}${tab === key ? '】' : ''}`, () => setSub(ctx, 'tab', key))))}
      <Box flexDirection="column" marginTop={1}>{body}</Box>
    </Box>
  )
}

export const page: Page = {
  tab: 'codex',
  label: '长寿图鉴',
  routes: () => ['codex', 'codex/library'],
  draw,
}

export { cells }
