// The 化验 page. (Stub: drawn by the page lane that owns it.)
import type { Ctx, Node, Page } from '../types.ts'
import { Loading, Muted } from '../kit.tsx'

function draw(ctx: Ctx): Node {
  const { Box } = ctx.E
  const journey = ctx.json('journey')
  if (!journey && 'indicators?area=labs,journey'.includes('journey')) return Loading(ctx.E)
  return <Box flexDirection="column">{Muted(ctx.E, '化验：建设中')}</Box>
}

export const page: Page = {
  tab: 'labs',
  label: '化验',
  routes: () => ['indicators?area=labs', 'journey'],
  draw,
}
