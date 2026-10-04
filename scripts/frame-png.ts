// Dev only: draw Codex stage frames to PNG (each pixel a 6×6 square) to look at the art and the motion.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { crc32 } from 'node:zlib'
import { packFrame, revealFrame, showFrame } from '../hooks/ui/codex/anim.ts'
import { experimentFace, studyFace, cardBack } from '../hooks/ui/codex/art.ts'
import type { Frame } from '../hooks/ui/codex/pixels.ts'

function png(frame: Frame, scale = 6): Buffer {
  const w = frame.w * scale, h = frame.h * scale
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0
    for (let x = 0; x < w; x++) {
      let c = frame.get(Math.floor(x / scale), Math.floor(y / scale))
      if (c < 0) c = 0x202020
      const i = y * (w * 3 + 1) + 1 + x * 3
      raw[i] = (c >> 16) & 255; raw[i + 1] = (c >> 8) & 255; raw[i + 2] = c & 255
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0)
    return Buffer.concat([len, td, crc])
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const out = process.argv[2] ?? '/tmp/frames'
const faces = [experimentFace({ id: 'sleep-plus-30', icon: 'moon' }, []), experimentFace({ id: 'walk-after-meal', icon: 'walk' }, []), experimentFace({ id: 'early-dinner', icon: 'bowl' }, [])]
const shots: Array<[string, Frame]> = [
  ['pack-idle', packFrame({ kind: 'experiment', phase: 'idle', t: 0, cols: 90, faces })],
  ['pack-shake', packFrame({ kind: 'experiment', phase: 'shake', t: 300, cols: 90, faces })],
  ['pack-burst', packFrame({ kind: 'experiment', phase: 'burst', t: 200, cols: 90, faces })],
  ['pack-deal', packFrame({ kind: 'experiment', phase: 'deal', t: 350, cols: 90, faces })],
  ['pack-flip', packFrame({ kind: 'experiment', phase: 'flip', t: 330, cols: 90, faces })],
  ['pack-cards', packFrame({ kind: 'experiment', phase: 'cards', t: 0, cols: 90, faces })],
  ['pack-cards-narrow', packFrame({ kind: 'experiment', phase: 'cards', t: 0, cols: 62, faces })],
  ['reveal-back', revealFrame({ phase: 'back', t: 0, cols: 70, face: faces[0]!, good: true })],
  ['reveal-turning', revealFrame({ phase: 'turning', t: 400, cols: 70, face: faces[0]!, good: true })],
  ['reveal-foil', revealFrame({ phase: 'foil', t: 700, cols: 70, face: experimentFace({ id: 'sleep-plus-30', icon: 'moon' }, ['d','d','m','d','d','d','d','d','d','m','d','d','d','d']), good: true })],
  ['reveal-front', revealFrame({ phase: 'front', t: 0, cols: 70, face: experimentFace({ id: 'sleep-plus-30', icon: 'moon' }, ['d','d','m','d','d','d','d','d','d','m','d','d','d','d']), good: true })],
  ['study', showFrame(70, studyFace({ tier: 'trial', art: { motif: 'clock', seed: 42 } }))],
  ['back', showFrame(60, cardBack())],
]
for (const [name, frame] of shots) writeFileSync(`${out}/${name}.png`, png(frame))
console.log('wrote', shots.length)
