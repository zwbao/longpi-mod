// Dev only: a tmux pane capture with colours (`tmux capture-pane -e -p`) to a PNG, so the pixel art in the
// pane can be looked at. Half blocks draw as two pixels; any other glyph as a small block of its colour.
import { deflateSync, crc32 } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'

const [input, output, x0s = '0', x1s = '999'] = process.argv.slice(2)
const text = readFileSync(input as string, 'utf8')
const lines = text.split('\n')
const W = 8, H = 16
const xterm = (n: number): number => {
  if (n < 16) return [0x000000, 0x800000, 0x008000, 0x808000, 0x000080, 0x800080, 0x008080, 0xc0c0c0, 0x808080, 0xff0000, 0x00ff00, 0xffff00, 0x0000ff, 0xff00ff, 0x00ffff, 0xffffff][n] as number
  if (n < 232) { const i = n - 16; const v = (k: number) => (k ? 55 + k * 40 : 0); return (v(Math.floor(i / 36)) << 16) | (v(Math.floor(i / 6) % 6) << 8) | v(i % 6) }
  const g = 8 + (n - 232) * 10
  return (g << 16) | (g << 8) | g
}
type Cell = { ch: string; fg: number; bg: number }
const grid: Cell[][] = []
for (const line of lines) {
  const row: Cell[] = []
  let fg = 0xc8c8c8, bg = 0x101010, i = 0
  while (i < line.length) {
    if (line[i] === '\x1b' && line[i + 1] === '[') {
      const end = line.indexOf('m', i)
      const codes = line.slice(i + 2, end).split(';').map(Number)
      for (let k = 0; k < codes.length; k++) {
        const c = codes[k] as number
        if (c === 0 || Number.isNaN(c)) { fg = 0xc8c8c8; bg = 0x101010 }
        else if (c === 38 && codes[k + 1] === 2) { fg = ((codes[k + 2] as number) << 16) | ((codes[k + 3] as number) << 8) | (codes[k + 4] as number); k += 4 }
        else if (c === 48 && codes[k + 1] === 2) { bg = ((codes[k + 2] as number) << 16) | ((codes[k + 3] as number) << 8) | (codes[k + 4] as number); k += 4 }
        else if (c === 38 && codes[k + 1] === 5) { fg = xterm(codes[k + 2] as number); k += 2 }
        else if (c === 48 && codes[k + 1] === 5) { bg = xterm(codes[k + 2] as number); k += 2 }
        else if (c >= 30 && c <= 37) fg = xterm(c - 30)
        else if (c >= 90 && c <= 97) fg = xterm(c - 90 + 8)
        else if (c >= 40 && c <= 47) bg = xterm(c - 40)
        else if (c === 39) fg = 0xc8c8c8
        else if (c === 49) bg = 0x101010
      }
      i = end + 1
      continue
    }
    const cp = line.codePointAt(i) as number
    const ch = String.fromCodePoint(cp)
    i += ch.length
    row.push({ ch, fg, bg })
    if (/[⺀-鿿＀-￯]/.test(ch)) row.push({ ch: '', fg, bg })
  }
  grid.push(row)
}
const x0 = Number(x0s), x1 = Math.min(Number(x1s), Math.max(...grid.map((r) => r.length)))
const cols = x1 - x0, rows = grid.length
const w = cols * W, h = rows * H
const px = new Uint32Array(w * h).fill(0x101010)
const fill = (x: number, y: number, ww: number, hh: number, c: number) => { for (let j = 0; j < hh; j++) for (let i2 = 0; i2 < ww; i2++) px[(y + j) * w + x + i2] = c }
grid.forEach((row, ry) => row.slice(x0, x1).forEach((cell, cx) => {
  const X = cx * W, Y = ry * H
  fill(X, Y, W, H, cell.bg)
  if (cell.ch === '▀') fill(X, Y, W, H / 2, cell.fg)
  else if (cell.ch === '▄') fill(X, Y + H / 2, W, H / 2, cell.fg)
  else if (cell.ch === '█') fill(X, Y, W, H, cell.fg)
  else if (cell.ch.trim() && cell.ch !== '') fill(X + 1, Y + 4, W - 2, H - 8, cell.fg)
}))
const raw = Buffer.alloc((w * 3 + 1) * h)
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = px[y * w + x] as number; const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = c >> 16; raw[o + 1] = (c >> 8) & 255; raw[o + 2] = c & 255 }
const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0); return Buffer.concat([len, td, crc]) }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
writeFileSync(output as string, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
