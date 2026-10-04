// Pixel art in the terminal: a framebuffer of RGB pixels, two pixels per cell (the upper-half block ▀ with
// the top pixel as its colour and the bottom pixel as its background), encoded the way the engine's Raster
// element takes cells. Also the smaller faces (half and third size) and an SVG for surfaces without Raster.

import { toBase64 } from '../../sys/buffer.ts'
import type { Raster } from './art.ts'

export const NONE = -1
const DEFAULT_COLOR = 0x01000000

export function hex(color: string): number {
  return parseInt(color.slice(1, 7), 16)
}

export function rgb(color: number): [number, number, number] {
  return [(color >> 16) & 255, (color >> 8) & 255, color & 255]
}

export function pack(r: number, g: number, b: number): number {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return (c(r) << 16) | (c(g) << 8) | c(b)
}

export function mix(a: number, b: number, k: number): number {
  const [ar, ag, ab] = rgb(a)
  const [br, bg, bb] = rgb(b)
  return pack(ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k)
}

export function shade(color: number, k: number): number {
  return k >= 0 ? mix(color, 0xffffff, k) : mix(color, 0x000000, -k)
}

/** A colour on the hue wheel (h in degrees), for the foil. */
export function hue(h: number, s = 0.75, l = 0.62): number {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return pack(f(0) * 255, f(8) * 255, f(4) * 255)
}

export class Frame {
  readonly px: Int32Array
  constructor(readonly w: number, readonly h: number, fill = NONE) {
    this.px = new Int32Array(w * h).fill(fill)
  }

  set(x: number, y: number, color: number): void {
    const xi = Math.round(x)
    const yi = Math.round(y)
    if (xi >= 0 && yi >= 0 && xi < this.w && yi < this.h) this.px[yi * this.w + xi] = color
  }

  get(x: number, y: number): number {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? (this.px[y * this.w + x] as number) : NONE
  }

  rect(x: number, y: number, w: number, h: number, color: number): void {
    for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) this.set(x + i, y + j, color)
  }

  /** A sprite at (ox, oy). `squash` (0..1) narrows it about its middle column, for a card turning over. */
  sprite(r: Raster, ox: number, oy: number, opts: { squash?: number; dim?: number; tint?: (x: number, y: number, color: number) => number } = {}): void {
    const squash = opts.squash ?? 1
    const x0 = Math.round(ox)
    const y0 = Math.round(oy)
    if (squash <= 0.02) {
      for (let y = 0; y < r.h; y += 1) this.set(x0 + Math.floor(r.w / 2), y0 + y, 0x0d0f12)
      return
    }
    const half = r.w / 2
    const shown = Math.max(1, Math.round(r.w * squash))
    const left = Math.round(half - shown / 2)
    for (let y = 0; y < r.h; y += 1) {
      for (let i = 0; i < shown; i += 1) {
        const sx = Math.min(r.w - 1, Math.floor(((i + 0.5) / shown) * r.w))
        const col = r.c[y * r.w + sx]
        if (!col) continue
        let color = hex(col)
        if (opts.tint) color = opts.tint(sx, y, color)
        if (opts.dim) color = shade(color, -opts.dim)
        this.set(x0 + left + i, y0 + y, color)
      }
    }
  }

  /** Cells for the Raster element: `rows = h / 2`, row-major, little-endian u32 triplets, base64. */
  cells(): { columns: number; rows: number; cells: string } {
    const rows = Math.ceil(this.h / 2)
    const words = new Uint32Array(this.w * rows * 3)
    let at = 0
    for (let row = 0; row < rows; row += 1) {
      for (let x = 0; x < this.w; x += 1) {
        const top = this.get(x, row * 2)
        const bottom = this.get(x, row * 2 + 1)
        if (top === NONE && bottom === NONE) {
          words[at] = 0x20
          words[at + 1] = DEFAULT_COLOR
          words[at + 2] = DEFAULT_COLOR
        } else if (bottom === NONE) {
          words[at] = 0x2580
          words[at + 1] = top
          words[at + 2] = DEFAULT_COLOR
        } else if (top === NONE) {
          words[at] = 0x2584
          words[at + 1] = bottom
          words[at + 2] = DEFAULT_COLOR
        } else {
          words[at] = 0x2580
          words[at + 1] = top
          words[at + 2] = bottom
        }
        at += 3
      }
    }
    return { columns: this.w, rows, cells: toBase64(new Uint8Array(words.buffer)) }
  }

  /** An SVG of the frame (runs of one colour per row), for surfaces without Raster. */
  svg(scale = 4): string {
    const rects: string[] = []
    for (let y = 0; y < this.h; y += 1) {
      let x = 0
      while (x < this.w) {
        const color = this.get(x, y)
        let run = 1
        while (x + run < this.w && this.get(x + run, y) === color) run += 1
        if (color !== NONE) rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="#${color.toString(16).padStart(6, '0')}"/>`)
        x += run
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w * scale}" height="${this.h * scale}" shape-rendering="crispEdges">${rects.join('')}</svg>`
  }
}

// --- smaller faces ------------------------------------------------------------------------------------

const shrunk = new WeakMap<Raster, Map<number, Raster>>()

/**
 * The face at 1/n size: each n×n block becomes its most frequent colour, the dark outline winning a tie,
 * and stays empty when most of the block is empty (the rounded corners).
 */
export function shrink(r: Raster, n: number): Raster {
  if (n <= 1) return r
  let byN = shrunk.get(r)
  if (!byN) {
    byN = new Map()
    shrunk.set(r, byN)
  }
  const hit = byN.get(n)
  if (hit) return hit
  const w = Math.ceil(r.w / n)
  const h = Math.ceil(r.h / n)
  const out = { w, h, c: new Array<string | null>(w * h).fill(null) } as unknown as Raster
  for (let by = 0; by < h; by += 1) {
    for (let bx = 0; bx < w; bx += 1) {
      const counts = new Map<string, number>()
      let empty = 0
      for (let j = 0; j < n; j += 1) {
        for (let i = 0; i < n; i += 1) {
          const x = bx * n + i
          const y = by * n + j
          if (x >= r.w || y >= r.h) continue
          const col = r.c[y * r.w + x]
          if (!col) empty += 1
          else counts.set(col, (counts.get(col) ?? 0) + 1)
        }
      }
      let best: string | null = null
      let bestN = 0
      for (const [col, count] of counts) {
        if (count > bestN || (count === bestN && col === '#0d0f12')) {
          best = col
          bestN = count
        }
      }
      if (best && bestN * 2 >= empty) out.c[by * w + bx] = best
    }
  }
  byN.set(n, out)
  return out
}

/** A face drawn alone as cells (a card in a list, a pack on the shelf). */
export function faceCells(r: Raster, n = 1): { columns: number; rows: number; cells: string } {
  const face = shrink(r, n)
  const frame = new Frame(face.w, face.h + (face.h % 2))
  frame.sprite(face, 0, 0)
  return frame.cells()
}

export function faceSvg(r: Raster, scale = 3): string {
  const frame = new Frame(r.w, r.h)
  frame.sprite(r, 0, 0)
  return frame.svg(scale)
}
