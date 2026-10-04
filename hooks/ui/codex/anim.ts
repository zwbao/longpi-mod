// The Codex stage, frame by frame: a pack shaking, bursting into pixel shards and dealing three cards face
// down that turn over one by one; an experiment card turning over at the end of a run, with foil, shards and
// the gold stamp only for a good primary result (docs/codex-design.md 1.3, decisions 1, 6, 12, 15). The web
// panel did this with CSS; here every frame is drawn into a framebuffer and blitted into the pane's Raster.

import { CARD_H, CARD_W, cardBack, pack, PACK_SHARDS, rng, SWIRL_H, SWIRL_W, swirlFrame, type Raster } from './art.ts'
import { Frame, hex, hue, mix, NONE, shade, shrink } from './pixels.ts'

export type PackPhase = 'idle' | 'shake' | 'burst' | 'deal' | 'flip' | 'cards'
export type RevealPhase = 'back' | 'turning' | 'foil' | 'front'

export const DURATION: Record<string, number> = {
  shake: 560,
  burst: 520,
  deal: 700,
  turning: 620,
  foil: 1900,
}

/** How long the flip phase runs for `count` cards. */
export function flipDuration(count: number): number {
  return Math.max(1, count) * 170 + 440
}

const BG = 0x0f1720
const SHARD_GOLD = ['#f2b53a', '#ffe896', '#ffffff']
const SHARD_FOIL = ['#ff5e5e', '#ffd166', '#5eead4', '#60a5fa', '#c084fc']

const ease = (t: number) => 1 - (1 - t) ** 3
const clamp01 = (t: number) => Math.max(0, Math.min(1, t))

// --- the backdrop: the web panel's dithered swirl, dimmed ----------------------------------------------

let swirlCache: { t: number; data: Uint8ClampedArray } | null = null

function backdrop(frame: Frame, t: number, still: boolean): void {
  const step = still ? 0 : Math.floor(t / 160) * 0.06
  if (!swirlCache || swirlCache.t !== step) swirlCache = { t: step, data: swirlFrame(step) }
  const data = swirlCache.data
  for (let y = 0; y < frame.h; y += 1) {
    const sy = Math.min(SWIRL_H - 1, Math.floor((y / frame.h) * SWIRL_H))
    for (let x = 0; x < frame.w; x += 1) {
      const sx = Math.min(SWIRL_W - 1, Math.floor((x / frame.w) * SWIRL_W))
      const i = (sy * SWIRL_W + sx) * 4
      const color = ((data[i] ?? 0) << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0)
      frame.set(x, y, mix(color, BG, 0.35))
    }
  }
}

// --- shards ------------------------------------------------------------------------------------------

function shards(frame: Frame, cx: number, cy: number, colors: readonly string[], count: number, t: number, seed: number, spread = 1): void {
  const r = rng(seed)
  const tau = t / 1000
  for (let i = 0; i < count; i += 1) {
    const angle = r() * Math.PI * 2
    const speed = (22 + r() * 46) * spread
    const life = 0.45 + r() * 0.5
    if (tau > life) continue
    const x = cx + Math.cos(angle) * speed * tau
    const y = cy + Math.sin(angle) * speed * tau * 0.8 + 38 * tau * tau
    const color = hex(colors[i % colors.length] as string)
    const faded = tau > life * 0.7 ? mix(color, BG, (tau - life * 0.7) / (life * 0.3)) : color
    frame.set(x, y, faded)
    if (r() < 0.5) frame.set(x + 1, y, faded)
  }
}

// --- layout ------------------------------------------------------------------------------------------

export type Layout = {
  cols: number
  /** Pixel height (rows × 2). */
  h: number
  /** 1 (full face), 2 (half) or 3 (third) for the three-pick. */
  n: number
  slots: Array<{ x: number; y: number }>
  cardW: number
  cardH: number
}

/** Where three (or `count`) cards sit in a stage `cols` wide. */
export function packLayout(cols: number, count: number): Layout {
  const n = cols >= 3 * 25 + 8 ? 2 : 3
  const cardW = Math.ceil(CARD_W / n)
  const cardH = Math.ceil(CARD_H / n)
  const gap = Math.max(2, Math.min(6, Math.floor((cols - count * cardW) / Math.max(1, count + 1))))
  const total = count * cardW + (count - 1) * gap
  const left = Math.max(0, Math.floor((cols - total) / 2))
  const h = Math.max(44, cardH + 6)
  const y = Math.floor((h - cardH) / 2)
  const slots = Array.from({ length: Math.max(1, count) }, (_, i) => ({ x: left + i * (cardW + gap), y }))
  return { cols, h: h + (h % 2), n, slots, cardW, cardH }
}

// --- the pack ----------------------------------------------------------------------------------------

export type PackScene = {
  kind: 'experiment' | 'retest'
  phase: PackPhase
  /** ms since the phase began */
  t: number
  cols: number
  faces: Raster[]
  /** which faces get gold shards when they land face up (retest result cards that are not plain) */
  gilded?: boolean[]
  still?: boolean
  seed?: number
}

export function packFrame(scene: PackScene): Frame {
  const count = Math.max(1, scene.faces.length || 3)
  const layout = packLayout(scene.cols, count)
  const frame = new Frame(layout.cols, layout.h, BG)
  backdrop(frame, scene.t, Boolean(scene.still))
  const sprite = pack(scene.kind)
  const px = Math.floor((layout.cols - sprite.w) / 2)
  const py = Math.floor((layout.h - sprite.h) / 2)
  const back = shrink(cardBack(), layout.n)
  const seed = scene.seed ?? 7
  const t = scene.t
  switch (scene.phase) {
    case 'idle': {
      const bob = scene.still ? 0 : Math.round(Math.sin(t / 380) * 1.5)
      frame.sprite(sprite, px, py + bob)
      return frame
    }
    case 'shake': {
      const k = clamp01(t / DURATION.shake!)
      const amp = scene.still ? 0 : 1 + k * 2.5
      const dx = Math.round(Math.sin(t / 18) * amp)
      const dy = Math.round(Math.cos(t / 23) * amp * 0.5)
      frame.sprite(sprite, px + dx, py + dy, { tint: (_x, _y, color) => mix(color, 0xffffff, k * 0.25) })
      return frame
    }
    case 'burst': {
      const k = ease(clamp01(t / DURATION.burst!))
      // The pack tears along its band: the top flies up, the bottom drops, both fade into the dark.
      const top = { ...sprite, h: 28, c: sprite.c.slice(0, 28 * sprite.w) } as unknown as Raster
      const bottom = { ...sprite, h: sprite.h - 28, c: sprite.c.slice(28 * sprite.w) } as unknown as Raster
      frame.sprite(top, px - k * 6, py - k * 22, { dim: k * 0.8 })
      frame.sprite(bottom, px + k * 4, py + 28 + k * 18, { dim: k * 0.8 })
      const flash = 1 - k
      if (flash > 0.4) frame.rect(px + 4, py + 27, sprite.w - 8, 2, mix(0xffffff, 0xffe896, k))
      shards(frame, px + sprite.w / 2, py + 28, PACK_SHARDS[scene.kind], 40, t, seed, 1.3)
      return frame
    }
    case 'deal': {
      shards(frame, px + sprite.w / 2, py + 28, PACK_SHARDS[scene.kind], 40, t + DURATION.burst!, seed, 1.3)
      layout.slots.forEach((slot, i) => {
        const k = ease(clamp01((t - i * 120) / 420))
        if (k <= 0) return
        const x = px + sprite.w / 2 - layout.cardW / 2 + (slot.x - (px + sprite.w / 2 - layout.cardW / 2)) * k
        const y = py + 6 + (slot.y - (py + 6)) * k
        frame.sprite(back, x, y)
      })
      return frame
    }
    case 'flip':
    case 'cards': {
      layout.slots.forEach((slot, i) => {
        const face = scene.faces[i] ? shrink(scene.faces[i] as Raster, layout.n) : back
        if (scene.phase === 'cards') {
          frame.sprite(face, slot.x, slot.y)
          return
        }
        const local = clamp01((t - i * 170) / 380)
        if (local <= 0) {
          frame.sprite(back, slot.x, slot.y)
          return
        }
        const squash = Math.abs(Math.cos(local * Math.PI))
        frame.sprite(local < 0.5 ? back : face, slot.x, slot.y - Math.round(Math.sin(local * Math.PI) * 2), { squash })
        if (local >= 1 && scene.gilded?.[i]) {
          shards(frame, slot.x + layout.cardW / 2, slot.y + layout.cardH / 2, SHARD_GOLD, 16, t - i * 170 - 380, seed + i, 0.7)
        }
      })
      return frame
    }
  }
}

// --- one card turning over (the reveal) and one card shown (study, result, species) -------------------------

export type RevealScene = {
  phase: RevealPhase
  t: number
  cols: number
  face: Raster
  good: boolean
  still?: boolean
  seed?: number
}

export function revealHeight(): number {
  return CARD_H + 6
}

/** The foil: a slow diagonal band of colour over the face, and a faint rainbow everywhere. */
function foilTint(t: number, strength: number): (x: number, y: number, color: number) => number {
  return (x, y, color) => {
    const band = Math.sin((x + y * 0.7) / 5 - t / 140)
    const h = (x * 6 + y * 4 + t / 6) % 360
    const k = band > 0.55 ? 0.5 * strength : 0.14 * strength
    return mix(color, hue(h), k)
  }
}

/**
 * The result banner across the card's window (the web's stamp: 8 units in from each side, 34 down, 7 tall),
 * gold and tilted for a good result, grey and level otherwise. Its words are drawn over it by the page.
 */
export function banner(frame: Frame, cardX: number, cardY: number, n: number, good: boolean, k = 1): void {
  const fill = good ? hex('#f2b53a') : hex('#8b949e')
  const ink = hex('#0d0f12')
  const pop = 1 + (1 - k) * 0.35
  const w = Math.round((34 / n) * pop)
  const h = Math.max(2, Math.round((7 / n) * pop))
  const x0 = Math.round(cardX + 25 / n - w / 2)
  const y0 = Math.round(cardY + 37.5 / n - h / 2)
  for (let i = -1; i <= w; i += 1) {
    const tilt = good ? Math.round(((w / 2 - i) / w) * (3 / n)) : 0
    for (let j = -1; j <= h; j += 1) {
      const edge = i < 0 || i >= w || j < 0 || j >= h
      frame.set(x0 + i, y0 + j + tilt, edge ? ink : k < 0.35 ? 0xffffff : fill)
    }
    frame.set(x0 + i, y0 + h + 1 + tilt, ink)
  }
}

export function revealFrame(scene: RevealScene): Frame {
  const h = revealHeight() + (revealHeight() % 2)
  const frame = new Frame(scene.cols, h, BG)
  backdrop(frame, scene.t, Boolean(scene.still))
  const x = cardLeft(scene.cols)
  const y = 3
  const back = cardBack()
  const t = scene.t
  switch (scene.phase) {
    case 'back': {
      const bob = scene.still ? 0 : Math.round(Math.sin(t / 420) * 1.5)
      frame.sprite(back, x, y + bob, { tint: scene.still ? undefined : (_x, _y, color) => mix(color, 0xffffff, (Math.sin(t / 300) + 1) * 0.04) })
      return frame
    }
    case 'turning': {
      const k = clamp01(t / DURATION.turning!)
      const squash = Math.abs(Math.cos(k * Math.PI))
      frame.sprite(k < 0.5 ? back : scene.face, x, y - Math.round(Math.sin(k * Math.PI) * 3), { squash })
      return frame
    }
    case 'foil': {
      const k = clamp01(t / DURATION.foil!)
      frame.sprite(scene.face, x, y, { tint: foilTint(t, 1 - k * 0.5) })
      shards(frame, x + CARD_W / 2, y + CARD_H / 2, SHARD_FOIL, 54, t, scene.seed ?? 11, 1.6)
      if (k > 0.3) banner(frame, x, y, 1, true, clamp01((k - 0.3) / 0.25))
      return frame
    }
    case 'front': {
      frame.sprite(scene.face, x, y, scene.good ? { tint: foilTint(600, 0.55) } : {})
      banner(frame, x, y, 1, scene.good)
      return frame
    }
  }
}

/** One face, full size, on the dark stage (a study card, a result in the deck, a species). */
export function showFrame(cols: number, face: Raster, opts: { good?: boolean; calmStamp?: boolean } = {}): Frame {
  const h = face.h + 6 + ((face.h + 6) % 2)
  const frame = new Frame(cols, h, BG)
  backdrop(frame, 0, true)
  const x = cardLeft(cols)
  frame.sprite(face, x, 3, opts.good ? { tint: foilTint(600, 0.55) } : {})
  if (opts.good || opts.calmStamp) banner(frame, x, 3, 1, Boolean(opts.good))
  return frame
}

/** Where a full-size card sits in a stage `cols` wide (the page puts its words at the same place). */
export function cardLeft(cols: number): number {
  return Math.floor((cols - CARD_W) / 2)
}

/** Where the words go on a card drawn at (x, y) in pixels at 1/n size: cell rows and columns. */
export function cardText(x: number, y: number, n: number): { top: { row: number; col: number; width: number }; name: { row: number; col: number; width: number }; stamp: { row: number; col: number; width: number } } {
  const col = (px: number) => Math.round(x + px / n)
  const row = (py: number) => Math.floor((y + py / n) / 2)
  return {
    top: { row: row(6), col: col(6), width: Math.floor(38 / n) },
    name: { row: row(54), col: col(7), width: Math.floor(36 / n) },
    stamp: { row: row(37), col: col(9), width: Math.floor(32 / n) },
  }
}

/** A row of small faces (the library grid, the deck, the species shelf) as one frame. */
export function shelfFrame(cols: number, faces: Raster[], n: number, opts: { good?: boolean[] } = {}): { frame: Frame; per: number; slots: number[] } {
  const w = Math.ceil(CARD_W / n)
  const h = Math.ceil(CARD_H / n)
  const gap = 2
  const per = Math.max(1, Math.floor((cols + gap) / (w + gap)))
  const frame = new Frame(Math.min(cols, per * (w + gap) - gap), h + (h % 2), NONE)
  const slots: number[] = []
  faces.slice(0, per).forEach((face, i) => {
    const small = shrink(face, n)
    frame.sprite(small, i * (w + gap), 0, opts.good?.[i] ? { tint: foilTint(600, 0.5) } : {})
    slots.push(i * (w + gap))
  })
  return { frame, per, slots }
}

export { shade }
