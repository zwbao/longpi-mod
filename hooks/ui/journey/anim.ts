// Frames for Pi: idle in the 总览 card (bob, blink, asleep at night), standing on the road to 120, and the
// celebration when a station is reached or Pi grows (a jump, confetti, the old form flashing into the new).

import { Frame } from '../codex/pixels.ts'
import { formOf as formByPoints, piSprite, roadSprite, stationAt, type PiForm, type PiMood } from './sprites.ts'

export const PI_W = 28
export const PI_H = 28
export const IDLE_MS = 450
export const CELEBRATE_MS = 2600

export function moodAt(now: number): PiMood {
  const hour = new Date(now).getHours()
  return hour >= 23 || hour < 6 ? 'sleepy' : 'idle'
}

/** Pi alone, for the 总览 card: frame n of the idle loop. */
export function piFrame(form: PiForm, mood: PiMood, n: number): Frame {
  const f = new Frame(PI_W, PI_H)
  f.sprite(piSprite(form, mood, n), 0, 0)
  return f
}

const ROAD_TOP = 8

/** Pi at half size (14 × 14): every other pixel of the 28 × 28 sprite. */
export function halfPi(form: PiForm, mood: PiMood, n = 0): Frame {
  const small = piSprite(form, mood, n)
  const half = new Frame(14, 14)
  for (let y = 0; y < 14; y += 1) for (let x = 0; x < 14; x += 1) {
    const col = small.c[(y * 2 + 1) * small.w + x * 2 + 1] ?? small.c[(y * 2) * small.w + x * 2]
    if (col) half.set(x, y, parseInt(col.slice(1), 16))
  }
  return half
}

/**
 * The road with its reached stations lit and Pi on the way to the next one: at the station before it, or at
 * the flag once all twelve are reached.
 */
export function roadFrame(width: number, lit: readonly boolean[], form: PiForm, n = 0): Frame {
  const w = Math.max(40, width)
  const road = roadSprite(w, lit)
  const f = new Frame(w, road.h + ROAD_TOP, 0x14202a)
  f.sprite(road, 0, ROAD_TOP)
  const next = lit.findIndex((on) => !on)
  const stand = next < 0 ? lit.length - 1 : next - 1
  const at = stationAt(w, Math.max(0, stand))
  const half = halfPi(form, 'idle', n)
  const px = Math.max(0, Math.min(w - 14, at.x - 7 + (stand < 0 ? -4 : 0)))
  const py = ROAD_TOP + at.y - 15
  for (let y = 0; y < 14; y += 1) for (let x = 0; x < 14; x += 1) {
    const col = half.get(x, y)
    if (col >= 0) f.set(px + x, py + y, col)
  }
  return f
}

const CONFETTI = [0xf2b53a, 0xe5484d, 0x5b8def, 0x3fb950, 0xa371f7, 0xff8fab, 0x8ff0df]

function hash(i: number): number {
  let h = (i + 1) * 2654435761
  h ^= h >>> 13
  h = Math.imul(h, 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

/**
 * The celebration at `t` ms: Pi jumps for joy among falling confetti; when Pi grew, the old form flashes
 * into the new one in the first half. Ends still, on the new form with the last confetti settled.
 */
export function celebrateFrame(width: number, t: number, form: PiForm, from: PiForm | null): Frame {
  const w = Math.max(40, Math.min(width, 72))
  const h = 40
  const f = new Frame(w, h, 0x101820)
  const clamped = Math.min(t, CELEBRATE_MS)
  // rays
  const cx = Math.floor(w / 2)
  const cy = 22
  const spin = clamped / 900
  for (let k = 0; k < 12; k += 1) {
    const a = spin + (k * Math.PI) / 6
    for (let r = 12; r < 30; r += 1) {
      const x = Math.round(cx + Math.cos(a) * r)
      const y = Math.round(cy + Math.sin(a) * r * 0.8)
      if (x >= 0 && x < w && y >= 0 && y < h && (r + k) % 3 !== 0) f.set(x, y, k % 2 ? 0x1c2a36 : 0x22313f)
    }
  }
  // confetti
  for (let i = 0; i < 46; i += 1) {
    const r = hash(i)
    const x0 = r % w
    const speed = 0.012 + ((r >>> 8) % 100) / 6000
    const start = ((r >>> 16) % 700)
    const y = Math.floor((clamped - start) * speed) - 2
    if (clamped < start || y >= h - 1) {
      if (clamped >= start && y >= h - 1) f.set((x0 + i) % w, h - 1, CONFETTI[i % CONFETTI.length] as number)
      continue
    }
    const x = Math.round(x0 + Math.sin((clamped + i * 97) / 180) * 2)
    if (x >= 0 && x < w && y >= 0) {
      f.set(x, y, CONFETTI[i % CONFETTI.length] as number)
      if ((i + Math.floor(clamped / 120)) % 2 === 0 && x + 1 < w) f.set(x + 1, y, CONFETTI[i % CONFETTI.length] as number)
    }
  }
  // Pi: the old form until the flash, then the new one, jumping
  const growing = from !== null && from !== form
  const flashAt = 900
  const shown: PiForm = growing && clamped < flashAt ? (from as PiForm) : form
  const jump = clamped < 2000 ? Math.round(Math.abs(Math.sin((clamped / 2000) * Math.PI * 3)) * 6) : 0
  const pi = piSprite(shown, 'happy', Math.floor(clamped / 120))
  const px = cx - 14
  const py = cy - 14 - jump
  const flashing = growing && clamped > flashAt - 200 && clamped < flashAt + 200 && Math.floor(clamped / 60) % 2 === 0
  for (let y = 0; y < pi.h; y += 1) for (let x = 0; x < pi.w; x += 1) {
    const col = pi.c[y * pi.w + x]
    if (!col) continue
    const X = px + x
    const Y = py + y
    if (X >= 0 && X < w && Y >= 0 && Y < h) f.set(X, Y, flashing ? 0xffffff : parseInt(col.slice(1), 16))
  }
  // sparkles around Pi after growing
  if (growing && clamped > flashAt) {
    const k = Math.floor((clamped - flashAt) / 150)
    for (let i = 0; i < 8; i += 1) {
      const a = (i * Math.PI) / 4 + k * 0.3
      const r = 16 + (k % 3)
      const x = Math.round(cx + Math.cos(a) * r)
      const y = Math.round(cy - 2 + Math.sin(a) * r * 0.7)
      if (x >= 0 && x < w && y >= 0 && y < h) f.set(x, y, 0xfff7d6)
    }
  }
  return f
}

export { formByPoints }
