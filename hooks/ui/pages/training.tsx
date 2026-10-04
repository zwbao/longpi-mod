// The 运动 page: the activity rows of the record (the web's list with area training) and the wearable's steps
// and resting heart rate day by day or by week, with averages and the person's usual range.
import type { Ctx, Node, Page } from '../types.ts'
import { areaRoutes, drawArea } from './life/area.tsx'

function draw(ctx: Ctx): Node {
  return drawArea(ctx, 'training')
}

export const page: Page = {
  tab: 'training',
  label: '运动',
  routes: (view) => areaRoutes('training', view),
  draw,
}
