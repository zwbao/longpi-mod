// The 睡眠 page. (Stub: drawn by the page lane that owns it.)
import type { Ctx, Node, Page } from '../types.ts'
import { Loading, Muted } from '../kit.tsx'

function draw(ctx: Ctx): Node {
  const { Box } = ctx.E
  const journey = ctx.json('journey')
  if (!journey && 'indicators?area=sleep,codex/slot'.includes('journey')) return Loading(ctx.E)
  return <Box flexDirection="column">{Muted(ctx.E, '睡眠：建设中')}</Box>
}

export const page: Page = {
  tab: 'sleep',
  label: '睡眠',
  routes: () => ['indicators?area=sleep', 'codex/slot'],
  draw,
}
