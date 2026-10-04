// The 档案 page. (Stub: drawn by the page lane that owns it.)
import type { Ctx, Node, Page } from '../types.ts'
import { Loading, Muted } from '../kit.tsx'

function draw(ctx: Ctx): Node {
  const { Box } = ctx.E
  const journey = ctx.json('journey')
  if (!journey && 'journey,self,connection,people,memory,privacy,meds,conditions,findings,stores'.includes('journey')) return Loading(ctx.E)
  return <Box flexDirection="column">{Muted(ctx.E, '档案：建设中')}</Box>
}

export const page: Page = {
  tab: 'profile',
  label: '档案',
  routes: () => ['journey', 'self', 'connection', 'people', 'memory', 'privacy', 'meds', 'conditions', 'findings', 'stores'],
  draw,
}
