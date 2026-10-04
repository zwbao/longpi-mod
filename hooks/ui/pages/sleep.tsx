// The 睡眠 page: the sleep rows of the record (the web's list with area sleep) and the wearable's sleep series
// day by day or by week, with averages and the person's usual range.
import type { Ctx, Node, Page } from '../types.ts'
import { areaRoutes, drawArea } from './life/area.tsx'

function draw(ctx: Ctx): Node {
  return drawArea(ctx, 'sleep')
}

export const page: Page = {
  tab: 'sleep',
  label: '睡眠',
  routes: (view) => areaRoutes('sleep', view),
  draw,
}
