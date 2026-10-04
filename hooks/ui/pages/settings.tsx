// The 设置 page. (Stub: drawn by the page lane that owns it.)
import type { Ctx, Node, Page } from '../types.ts'
import { Loading, Muted } from '../kit.tsx'

function draw(ctx: Ctx): Node {
  const { Box } = ctx.E
  const journey = ctx.json('journey')
  if (!journey && 'followup,privacy,connection,stats,usage,version,science/invite'.includes('journey')) return Loading(ctx.E)
  return <Box flexDirection="column">{Muted(ctx.E, '设置：建设中')}</Box>
}

export const page: Page = {
  tab: 'settings',
  label: '设置',
  routes: () => ['followup', 'privacy', 'connection', 'stats', 'usage', 'version', 'science/invite'],
  draw,
}
