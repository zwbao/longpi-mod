// The 深度分析 page. (Stub: drawn by the page lane that owns it.)
import type { Ctx, Node, Page } from '../types.ts'
import { Loading, Muted } from '../kit.tsx'

function draw(ctx: Ctx): Node {
  const { Box } = ctx.E
  const journey = ctx.json('journey')
  if (!journey && 'analysis'.includes('journey')) return Loading(ctx.E)
  return <Box flexDirection="column">{Muted(ctx.E, '深度分析：建设中')}</Box>
}

export const page: Page = {
  tab: 'analysis',
  label: '深度分析',
  routes: () => ['analysis'],
  draw,
}
