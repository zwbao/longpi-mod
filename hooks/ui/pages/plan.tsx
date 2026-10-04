// The 方案 page. (Stub: drawn by the page lane that owns it.)
import type { Ctx, Node, Page } from '../types.ts'
import { Loading, Muted } from '../kit.tsx'

function draw(ctx: Ctx): Node {
  const { Box } = ctx.E
  const journey = ctx.json('journey')
  if (!journey && 'journey,tracking,plan-draft,followup'.includes('journey')) return Loading(ctx.E)
  return <Box flexDirection="column">{Muted(ctx.E, '方案：建设中')}</Box>
}

export const page: Page = {
  tab: 'plan',
  label: '方案',
  routes: () => ['journey', 'tracking', 'plan-draft', 'followup'],
  draw,
}
