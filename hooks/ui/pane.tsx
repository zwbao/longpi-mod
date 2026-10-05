// The LongPi pane: a header (who is shown, refresh, privacy), the tab row, the page, and the footer line
// the web page carried. The pages themselves are in pages/ and codex/.

import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from './types.ts'
import { C, cells, fit, scrubZh } from './kit.tsx'
import { HOTKEYS, PRIMARY, SECONDARY, pageOf } from './pages/index.ts'
import { CelebrationTree, type GameView } from './journey/view.tsx'
import type { PiForm } from './journey/sprites.ts'

const FOOTER = '模型估计，不是诊断，也不是用药建议。紧急情况请拨打 120。档案、方案和打卡都只存在这台电脑上。'

type People = { active?: string; people?: Array<{ id: string; label_zh: string; demo?: boolean }> }
type JourneyHead = {
  today?: string
  stage?: string
  next?: { title_zh?: string; detail_zh?: string; action?: string }
  profile?: { displayName?: string }
  surfaces?: { greeting?: { text_zh?: string } } | null
  plan?: { exists?: boolean; days?: number | null }
}

function header(ctx: Ctx): RenderElement {
  const { Box, Text, Button } = ctx.E
  const journey = ctx.json<JourneyHead>('journey')
  const people = ctx.json<People>('people')
  const greeting = journey?.surfaces?.greeting?.text_zh || '你好'
  // The name joins a short greeting (你好，李明华), never a whole sentence the model wrote.
  const name = journey?.profile?.displayName && !/[。！？.!?]$/.test(greeting.trim()) ? `，${journey.profile.displayName}` : ''
  const active = people?.people?.find((person) => person.id === people.active)
  const who = active && active.id !== 'self' ? `在看：${active.label_zh}` : ''
  const planDay = journey?.plan?.exists && journey.plan.days ? ` · 方案第 ${journey.plan.days} 天` : ''
  const game = ctx.json<GameView>('game')
  const pi = game && !game.demo ? ` · ${game.form.zh} · 通往 120 第 ${game.reached}/12 站` : ''
  return (
    <Box key="head" flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={C.accent}>{fit(active && active.id !== 'self' ? `${active.label_zh}的档案${active.demo ? '（示例）' : ''}` : `${greeting}${name}`, Math.max(8, ctx.width - 24))}</Text>
        <Box flexDirection="row" gap={1}>
          {who ? <Text color={C.warn}>{who}</Text> : null}
          <Button key="refresh" plain hotkey="u" label="刷新" onPress={() => ctx.act.refresh()} />
        </Box>
      </Box>
      <Text dimColor wrap="truncate-end">{`LongPi · ${journey?.today ?? ctx.today}${planDay}${pi}`}</Text>
    </Box>
  )
}

function tabs(ctx: Ctx): RenderElement {
  const { Box, Button, Text } = ctx.E
  const current = ctx.view.tab
  const secondary = SECONDARY.some((page) => page.tab === current)
  const showMore = ctx.view.sub['pane.more'] === '1'
  const item = (tab: (typeof PRIMARY)[number]) => (
    <Button
      key={`tab-${tab.tab}`}
      plain
      label={current === tab.tab ? `【${tab.label}】` : tab.label}
      {...(HOTKEYS[tab.tab] ? { hotkey: HOTKEYS[tab.tab] } : {})}
      onPress={() => ctx.act.go(tab.tab)}
    />
  )
  return (
    <Box key="tabs" flexDirection="column" marginTop={1}>
      <Box flexDirection="row" gap={1} flexWrap="wrap">
        {PRIMARY.map(item)}
        {secondary && !showMore ? item(pageOf(current)) : null}
        <Button key="tab-more" plain hotkey="m" label={showMore ? '收起' : '更多'} onPress={() => ctx.act.setSub('pane.more', showMore ? '' : '1')} />
      </Box>
      {showMore ? <Box flexDirection="row" gap={1} flexWrap="wrap">{SECONDARY.map(item)}</Box> : null}
      <Text dimColor>{'─'.repeat(Math.max(4, Math.min(ctx.width, 120)))}</Text>
    </Box>
  )
}

/** One line while onboarding is not finished: where they are and how to go on. */
function banner(ctx: Ctx): Node {
  const journey = ctx.json<JourneyHead>('journey')
  if (!journey || !journey.stage || journey.stage === 'routine' || journey.stage === 'plan') return null
  // The setup steps are on screen already.
  if (ctx.view.tab === 'overview' && ctx.view.sub['overview.onboarding'] === '1') return null
  const { Box, Text, Button } = ctx.E
  const next = journey.next
  return (
    <Box key="banner" flexDirection="row" justifyContent="space-between" borderStyle="round" borderColor={C.accent} paddingX={1}>
      <Text wrap="truncate-end">{scrubZh(`下一步：${next?.title_zh ?? ''}${next?.detail_zh ? ` · ${next.detail_zh}` : ''}`)}</Text>
      <Button key="onboard" plain hotkey="g" label="开始" onPress={() => ctx.act.go('overview', { 'overview.onboarding': '1' })} />
    </Box>
  )
}

function notice(ctx: Ctx, text: string | null): Node {
  if (!text) return null
  const { Text } = ctx.E
  return <Text key="notice" color={C.good}>{text}</Text>
}

export function paneTree(ctx: Ctx, noticeText: string | null): RenderElement {
  const { Box, Text } = ctx.E
  const page = pageOf(ctx.view.tab)
  let body: Node
  try {
    const game = ctx.json<GameView>('game')
    body = ctx.celebrate ? CelebrationTree(ctx, ctx.celebrate, (game?.form.no ?? 0) as PiForm) : page.draw(ctx)
  } catch (error) {
    body = <Text color={C.bad} wrap="wrap">{`这一页画不出来：${error instanceof Error ? error.message : String(error)}`}</Text>
  }
  return (
    <Box flexDirection="column" width={ctx.width}>
      {header(ctx)}
      {tabs(ctx)}
      {banner(ctx)}
      {notice(ctx, noticeText)}
      <Box key="body" flexDirection="column">{body}</Box>
      <Box key="foot" marginTop={1}>
        <Text dimColor wrap="wrap">{FOOTER}</Text>
      </Box>
    </Box>
  )
}

/** The width a page draws into, from the pane's body columns. */
export function pageWidth(bodyColumns: number): number {
  return Math.max(30, bodyColumns - 1)
}

export { cells }
