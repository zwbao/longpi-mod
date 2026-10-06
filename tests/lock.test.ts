import { describe, expect, test } from 'claude-code/testing'

import { vfs } from '../hooks/sys/vfs.ts'

// The copy's lock: one operation at a time, in order, and a failed one never leaves it taken.

const later = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))

describe('the lock', () => {
  test('operations run one at a time, in order, past a failure', async () => {
    const log: string[] = []
    const a = vfs.exclusive(async () => { log.push('a'); await later(20); log.push('a end') })
    const b = vfs.exclusive(async () => { log.push('b'); throw new Error('b failed') }).catch(() => log.push('b caught'))
    const c = vfs.exclusive(async () => { log.push('c') })
    await Promise.all([a, b, c])
    expect(log).toEqual(['a', 'a end', 'b', 'b caught', 'c'])
    expect(await Promise.race([vfs.exclusive(async () => 'd'), later(300).then(() => 'stuck')])).toBe('d')
  })
})
