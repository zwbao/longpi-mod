// The 运动 page. (Stub: drawn by the page lane that owns it.)
import type { Ctx, Node, Page } from '../types.ts'
import { Loading, Muted } from '../kit.tsx'

function draw(ctx: Ctx): Node {
  const { Box } = ctx.E
  const journey = ctx.json('journey')
  if (!journey && 'indicators?area=training'.includes('journey')) return Loading(ctx.E)
  return <Box flexDirection="column">{Muted(ctx.E, '运动：建设中')}</Box>
}

export const page: Page = {
  tab: 'training',
  label: '运动',
  routes: () => ['indicators?area=training'],
  draw,
}
