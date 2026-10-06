import { describe, expect, test } from 'claude-code/testing'

import { Vfs } from '../hooks/sys/vfs.ts'

// The copy's lock: an operation waiting on a process or a model lets others run, and takes the lock back before
// its own code goes on, also when several of its waits are out at once.

const later = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))

describe('the lock', () => {
  test('another operation runs while one waits outside, and the first resumes only after it', async () => {
    const vfs = new Vfs()
    const log: string[] = []
    const a = vfs.exclusive(async () => {
      log.push('a start')
      const token = vfs.current()
      // two waits of one operation at once (methods run side by side)
      await Promise.all([
        vfs.outside(token, async () => { await later(30); log.push('a work 1') }),
        vfs.outside(token, async () => { await later(60); log.push('a work 2') }),
      ])
      log.push(`a resumed busy=${vfs.busy}`)
    })
    await later(5)
    const b = vfs.exclusive(async () => {
      log.push('b start')
      await later(80)
      log.push('b end')
    })
    await Promise.all([a, b])
    expect(log).toEqual(['a start', 'b start', 'a work 1', 'a work 2', 'b end', 'a resumed busy=true'])
    expect(vfs.busy).toBe(false)
  })

  test('outside an operation the work simply runs; a later operation still gets the lock', async () => {
    const vfs = new Vfs()
    expect(await vfs.outside(null, async () => 7)).toBe(7)
    expect(await vfs.exclusive(async () => vfs.busy)).toBe(true)
  })
})
