// The 问 LongPi page. (Stub: drawn by the page lane that owns it.)
import type { Ctx, Node, Page } from '../types.ts'
import { Loading, Muted } from '../kit.tsx'

function draw(ctx: Ctx): Node {
  const { Box } = ctx.E
  const journey = ctx.json('journey')
  if (!journey && 'journey,surfaces'.includes('journey')) return Loading(ctx.E)
  return <Box flexDirection="column">{Muted(ctx.E, '问 LongPi：建设中')}</Box>
}

export const page: Page = {
  tab: 'ask',
  label: '问 LongPi',
  routes: () => ['journey', 'surfaces'],
  draw,
}
