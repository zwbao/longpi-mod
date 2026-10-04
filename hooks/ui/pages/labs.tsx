// The 化验 page: every checkup value by body system, each with its latest value, trend and how its last change
// compares with normal fluctuation; the 自测 block under 体格与血压; an opened indicator with its chart.
import type { Ctx, Node, Page } from '../types.ts'
import { areaRoutes, drawArea } from './life/area.tsx'

function draw(ctx: Ctx): Node {
  return drawArea(ctx, 'labs')
}

export const page: Page = {
  tab: 'labs',
  label: '化验',
  routes: (view) => areaRoutes('labs', view),
  draw,
}
