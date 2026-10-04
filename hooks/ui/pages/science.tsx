// The 研究 page. (Stub: drawn by the page lane that owns it.)
import type { Ctx, Node, Page } from '../types.ts'
import { Loading, Muted } from '../kit.tsx'

function draw(ctx: Ctx): Node {
  const { Box } = ctx.E
  const journey = ctx.json('journey')
  if (!journey && 'science/studies,science/community?view=page,science/invite,science/transparency'.includes('journey')) return Loading(ctx.E)
  return <Box flexDirection="column">{Muted(ctx.E, '研究：建设中')}</Box>
}

export const page: Page = {
  tab: 'science',
  label: '研究',
  routes: () => ['science/studies', 'science/community?view=page', 'science/invite', 'science/transparency'],
  draw,
}
