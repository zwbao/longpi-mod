// Pi, the companion, and the road to 120, in the same pixel style as the Codex (art.ts): a small round creature
// with π on its belly that grows through five forms as the person keeps doing real things (never with a
// biomarker), and a winding road with twelve stations. Pure: rasters out.

import { Raster } from '../codex/art.ts'

const INK = '#0d0f12'
const TEAL = { l: '#8ff0df', b: '#2fbfa8', d: '#1b6f63' }
const CREAM = '#f4ead5'
const GOLD = '#f2b53a'
const PINK = '#ff8fab'
const LEAF = '#7bd88f'

export type PiForm = 0 | 1 | 2 | 3 | 4
export const PI_FORMS: ReadonlyArray<{ name: string; zh: string; at: number }> = [
  { name: 'egg', zh: '一颗蛋', at: 0 },
  { name: 'baby', zh: '小 Pi', at: 3 },
  { name: 'sprout', zh: '发芽的 Pi', at: 15 },
  { name: 'walker', zh: '出门走走的 Pi', at: 50 },
  { name: 'sage', zh: '百岁的 Pi', at: 150 },
]

export type PiMood = 'idle' | 'happy' | 'sleepy'

const memo = new Map<string, Raster>()

function piGlyph(r: Raster, cx: number, cy: number, col: string): void {
  r.rect(cx - 3, cy - 2, 7, 1, col)
  r.rect(cx - 2, cy - 1, 1, 4, col)
  r.rect(cx + 1, cy - 1, 1, 3, col)
  r.set(cx + 2, cy + 2, col)
}

function eyes(r: Raster, cx: number, cy: number, mood: PiMood, blink: boolean): void {
  if (blink || mood === 'sleepy') {
    r.rect(cx - 4, cy, 2, 1, INK)
    r.rect(cx + 2, cy, 2, 1, INK)
    return
  }
  if (mood === 'happy') {
    r.set(cx - 4, cy + 1, INK); r.set(cx - 3, cy, INK); r.set(cx - 2, cy + 1, INK)
    r.set(cx + 2, cy + 1, INK); r.set(cx + 3, cy, INK); r.set(cx + 4, cy + 1, INK)
    return
  }
  r.rect(cx - 4, cy - 1, 2, 2, INK)
  r.rect(cx + 2, cy - 1, 2, 2, INK)
  r.set(cx - 4, cy - 1, '#ffffff')
  r.set(cx + 2, cy - 1, '#ffffff')
}

/** Pi in one of its five forms, 28 × 28, at animation frame `frame` (bob and blink). */
export function piSprite(form: PiForm, mood: PiMood, frame: number): Raster {
  const bob = mood === 'sleepy' ? 0 : frame % 4 === 1 || frame % 4 === 2 ? 1 : 0
  const blink = frame % 16 === 7
  const key = `${form}:${mood}:${bob}:${blink ? 1 : 0}`
  const hit = memo.get(key)
  if (hit) return hit
  const r = new Raster(28, 28)
  const cx = 14
  const cy = 16 - bob
  if (form === 0) {
    r.ellipse(cx, cy, 8, 10, CREAM)
    r.ellipse(cx - 2, cy - 4, 2, 3, '#ffffff')
    for (let x = cx - 5; x <= cx + 5; x += 1) r.set(x, cy + ((x % 2) === 0 ? -1 : 0), '#c9b48c')
    piGlyph(r, cx, cy + 4, TEAL.d)
    if (mood === 'happy') { r.set(cx - 9, cy - 8, GOLD); r.set(cx + 9, cy - 9, GOLD) }
    memo.set(key, r.outline())
    return r
  }
  const size = form === 1 ? 7 : form === 2 ? 8 : 9
  r.disc(cx, cy, size, TEAL.b)
  r.disc(cx - 2, cy - 3, size - 4, TEAL.l)
  r.disc(cx, cy + 1, size - 2, TEAL.b)
  r.ellipse(cx, cy + 4, size - 3, size - 5, '#e9fffa')
  piGlyph(r, cx, cy + 4, TEAL.d)
  eyes(r, cx, cy - 2, mood, blink)
  if (mood === 'happy') { r.set(cx - 6, cy + 1, PINK); r.set(cx + 6, cy + 1, PINK) }
  // feet
  r.rect(cx - 5, cy + size, 3, 1, TEAL.d)
  r.rect(cx + 3, cy + size, 3, 1, TEAL.d)
  if (form >= 2) {
    // a sprout on the head
    r.line(cx, cy - size - 1, cx, cy - size + 1, LEAF)
    r.ellipse(cx - 2, cy - size - 2, 2, 1, LEAF)
    r.ellipse(cx + 2, cy - size - 3, 2, 1, LEAF)
  }
  if (form >= 3) {
    // a scarf for the road
    r.rect(cx - size + 2, cy + 1, size * 2 - 3, 2, '#e5484d')
    r.rect(cx + size - 3, cy + 3, 2, 3, '#e5484d')
  }
  if (form >= 4) {
    // the sage: a halo of gold and a long white brow
    r.ring(cx, cy - size - 4, 3, GOLD)
    r.rect(cx - 6, cy - 4, 3, 1, '#ffffff')
    r.rect(cx + 4, cy - 4, 3, 1, '#ffffff')
  }
  if (mood === 'sleepy') { r.set(cx + 9, cy - 9, '#cfe3ff'); r.set(cx + 11, cy - 11, '#cfe3ff'); r.set(cx + 12, cy - 11, '#cfe3ff') }
  memo.set(key, r.outline())
  return r
}

export function formOf(actions: number): PiForm {
  let form: PiForm = 0
  PI_FORMS.forEach((row, i) => { if (actions >= row.at) form = i as PiForm })
  return form
}

/** The road to 120: twelve stations on a winding path, the reached ones lit, Pi standing at the last one reached. */
export function roadSprite(width: number, reached: number, total = 12): Raster {
  const h = 30
  const r = new Raster(width, h, '#14202a')
  // hills
  for (let x = 0; x < width; x += 1) {
    const hill = Math.round(6 + Math.sin(x / 9) * 2 + Math.sin(x / 4.3) * 1)
    for (let y = h - hill; y < h; y += 1) r.set(x, y, y === h - hill ? '#2c4a3a' : '#1f3a2c')
  }
  // stars
  for (let i = 0; i < width / 6; i += 1) r.set((i * 37) % width, (i * 13) % 10, i % 3 === 0 ? '#9fb3c8' : '#5d6f82')
  const points: Array<[number, number]> = []
  for (let i = 0; i < total; i += 1) {
    const x = Math.round(4 + (i / (total - 1)) * (width - 9))
    const y = Math.round(15 + Math.sin(i * 1.1) * 5)
    points.push([x, y])
  }
  for (let i = 1; i < points.length; i += 1) {
    const [ax, ay] = points[i - 1] as [number, number]
    const [bx, by] = points[i] as [number, number]
    r.thick(ax, ay, bx, by, i <= reached - 1 ? '#c9a46a' : '#3b4048', 2)
  }
  points.forEach(([x, y], i) => {
    const lit = i < reached
    r.disc(x, y, 2, lit ? GOLD : '#4b5566')
    if (lit) r.set(x, y, '#fff7d6')
  })
  // the flag at 120
  const [fx, fy] = points[points.length - 1] as [number, number]
  r.rect(fx + 2, fy - 9, 1, 9, CREAM)
  r.rect(fx + 3, fy - 9, 4, 3, reached >= total ? GOLD : '#e5484d')
  return r.outline()
}

/** Where on the road (pixels) station `i` sits, for placing Pi and the station numbers. */
export function stationAt(width: number, i: number, total = 12): { x: number; y: number } {
  return { x: Math.round(4 + (i / (total - 1)) * (width - 9)), y: Math.round(15 + Math.sin(i * 1.1) * 5) }
}

/** A medal for an achievement: gold when earned, a dark outline when not yet. */
export function medal(earned: boolean, kind: number): Raster {
  const key = `medal:${earned ? 1 : 0}:${kind % 6}`
  const hit = memo.get(key)
  if (hit) return hit
  const ribbons = ['#e5484d', '#5b8def', '#3fb950', '#a371f7', '#d29922', '#39c5bb']
  const r = new Raster(14, 16)
  if (earned) {
    r.rect(4, 0, 2, 6, ribbons[kind % 6] as string)
    r.rect(8, 0, 2, 6, ribbons[(kind + 2) % 6] as string)
    r.disc(7, 10, 5, GOLD)
    r.disc(7, 10, 3, '#ffe896')
    r.set(7, 10, '#fff7d6')
  } else {
    r.rect(4, 0, 2, 6, '#3b4048')
    r.rect(8, 0, 2, 6, '#3b4048')
    r.ring(7, 10, 5, '#4b5566')
  }
  memo.set(key, r.outline())
  return r
}
