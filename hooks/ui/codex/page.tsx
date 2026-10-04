// The 长寿图鉴 page. (Stub.)
import type { Ctx, Node, Page } from '../types.ts'
import { Muted } from '../kit.tsx'

function draw(ctx: Ctx): Node {
  return Muted(ctx.E, '长寿图鉴：建设中')
}

export const page: Page = {
  tab: 'codex',
  label: '长寿图鉴',
  routes: () => ['codex', 'codex/library'],
  draw,
}
