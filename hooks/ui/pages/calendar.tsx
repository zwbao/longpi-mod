// The 日程 page. (Stub: drawn by the page lane that owns it.)
import type { Ctx, Node, Page } from '../types.ts'
import { Loading, Muted } from '../kit.tsx'

function draw(ctx: Ctx): Node {
  const { Box } = ctx.E
  const journey = ctx.json('journey')
  if (!journey && 'journey,schedule,followup'.includes('journey')) return Loading(ctx.E)
  return <Box flexDirection="column">{Muted(ctx.E, '日程：建设中')}</Box>
}

export const page: Page = {
  tab: 'calendar',
  label: '日程',
  routes: () => ['journey', 'schedule', 'followup'],
  draw,
}
