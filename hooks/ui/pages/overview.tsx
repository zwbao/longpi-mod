// The 总览 page. (Stub: drawn by the page lane that owns it.)
import type { Ctx, Node, Page } from '../types.ts'
import { Loading, Muted } from '../kit.tsx'

function draw(ctx: Ctx): Node {
  const { Box } = ctx.E
  const journey = ctx.json('journey')
  if (!journey && 'journey,tracking,surfaces,triage,feedback,people'.includes('journey')) return Loading(ctx.E)
  return <Box flexDirection="column">{Muted(ctx.E, '总览：建设中')}</Box>
}

export const page: Page = {
  tab: 'overview',
  label: '总览',
  routes: () => ['journey', 'tracking', 'surfaces', 'triage', 'feedback', 'people'],
  draw,
}
