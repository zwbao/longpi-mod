import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

// The engine beneath LongPi in a test: a small file system in memory (the person's LongPi home starts empty),
// processes that answer like a Mac with no method library installed, a clock, a store and a surface.

const T0 = new Date(2026, 9, 5, 15, 0).getTime()
const HOME = '/home/tester'
const PANE = { title: 'LongPi', isFocused: true, bodyColumns: 92, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } as const
const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const

type Node = { text: string; mtime: number }

function world(on: On) {
  const files = new Map<string, Node>()
  const dirs = new Set<string>(['/', '/home', HOME, '/tmp'])
  const toasts: string[] = []
  const commands: string[][] = []
  const parent = (path: string) => path.slice(0, Math.max(1, path.lastIndexOf('/')))
  const mkdirp = (path: string) => {
    let at = path
    while (at && at !== '/' && !dirs.has(at)) {
      dirs.add(at)
      at = parent(at)
    }
  }
  const missing = (path: string) => Object.assign(new Error(`ENOENT: no such file or directory, '${path}'`), { code: 'ENOENT' })
  mock.store(on)
  const clock = mock.clock(on, { now: T0 })
  mock.env(on, { HOME, LANG: 'zh_CN.UTF-8', PATH: '/usr/bin:/bin' })
  on('fs.read', ($, e) => {
    const node = files.get(e.path)
    if (!node) throw missing(e.path)
    return { value: node.text }
  })
  on('fs.write', ($, e) => {
    mkdirp(parent(e.path))
    files.set(e.path, { text: e.text, mtime: Date.now() })
    return { value: undefined }
  })
  on('fs.exists', ($, e) => ({ value: files.has(e.path) || dirs.has(e.path) }))
  on('fs.stat', ($, e) => {
    const node = files.get(e.path)
    if (node) return { value: { kind: 'file' as const, size: node.text.length, mtimeMs: node.mtime, isLink: false } }
    if (dirs.has(e.path)) return { value: { kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false } }
    throw missing(e.path)
  })
  on('fs.list', ($, e) => {
    if (!dirs.has(e.path)) throw missing(e.path)
    const prefix = e.path === '/' ? '/' : `${e.path}/`
    const names = new Map<string, 'file' | 'dir'>()
    for (const path of files.keys()) if (path.startsWith(prefix) && !path.slice(prefix.length).includes('/')) names.set(path.slice(prefix.length), 'file')
    for (const dir of dirs) if (dir.startsWith(prefix) && dir !== e.path && !dir.slice(prefix.length).includes('/')) names.set(dir.slice(prefix.length), 'dir')
    return { value: [...names].map(([name, kind]) => ({ name, kind, size: kind === 'file' ? files.get(`${prefix}${name}`)?.text.length ?? 0 : 0, mtimeMs: kind === 'file' ? files.get(`${prefix}${name}`)?.mtime ?? 0 : 0, isLink: false })) }
  })
  const ran = (exitCode: number, stdout = '', stderr = '') => ({ value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false } })
  on('process.run', ($, e) => {
    commands.push([...e.argv])
    const [cmd = '', ...args] = e.argv
    if (cmd === 'uname') return ran(0, 'Darwin\n')
    if (cmd === 'mkdir') {
      for (const path of args.filter((arg) => arg.startsWith('/'))) mkdirp(path)
      return ran(0)
    }
    if (cmd === 'rm' || cmd === 'chmod') return ran(0)
    return ran(127, '', `${cmd}: not found`)
  })
  on('session.id', () => ({ value: 'test-session' }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', ($, e) => {
    return { value: undefined }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('tool.register', ($, e) => ({ value: { tool: `mcp__longpi__${e.name}` } }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  return { files, toasts, commands, clock }
}

const REPORT = {
  date: '2026-09-12',
  source: 'checkup',
  file: '2026 年度体检报告.pdf',
  items: [
    { name: '白蛋白(ALB)', value: '44.6', unit: 'g/L', ref_low: '40', ref_high: '55' },
    { name: '葡萄糖(GLU)', value: '5.9 ↑', unit: 'mmol/L', ref_low: '3.9', ref_high: '6.1' },
    { name: '低密度脂蛋白胆固醇(LDL-C)', value: '3.6', unit: 'mmol/L', loinc: '13457-7' },
  ],
}

describe('LongPi in a Claude Code session', () => {
  test('a report Claude read is filed as printed, and the record shows it', async ($, on) => {
    const { files } = world(on)
    await $.session.start(START)
    const saved = await $.tool.call({ tool: 'mcp__longpi__record_measurements', ...REPORT })
    expect(String(saved.result)).toContain('"saved": 3')
    const record = JSON.parse(files.get(`${HOME}/.longpi/record.json`)?.text ?? '{}') as { observations?: Array<{ name: string; value: string; unit: string }> }
    expect(record.observations?.map((row) => row.value)).toEqual(['44.6', '5.9 ↑', '3.6'])
    const again = await $.tool.call({ tool: 'mcp__longpi__record_measurements', ...REPORT })
    expect(String(again.result)).toContain('"already_on_file": 3')
    const situation = await $.tool.call({ tool: 'mcp__longpi__read_personal_situation' })
    expect(String(situation.result)).toContain('"indicator_count": 3')
  })

  test('every request carries the brief; LongPi in use adds Pi and the snapshot', async ($, on) => {
    world(on)
    on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'You are Claude Code.', scope: 'shared' as const }] }))
    await $.session.start(START)
    const compose = () => $.prompt.compose({ model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] })
    expect((await compose()).sections.map((s) => s.id)).toEqual(['intro', 'longpi:brief'])
    const first = await $.tool.call({ tool: 'mcp__longpi__longpi_status' })
    expect((first.context ?? []).join('\n')).toContain('LongPi coach mode')
    expect((await compose()).sections.map((s) => s.id)).toContain('longpi:coach')
    const coach = (await compose()).sections.find((s) => s.id === 'longpi:coach')?.text ?? ''
    expect(coach).toContain('inside Claude Code')
    expect(coach).not.toContain('DeepSeek Harness')
  })

  test('/longpi opens the pane on every surface that draws it, with its tabs and the Codex', async ($, on) => {
    world(on)
    await $.session.start(START)
    await $.command.run({ command: 'longpi', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 180 } })
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'longpi', surface, component: 'Pane', requestId: 'longpi', props: PANE })
      const has = async (label: string, query: Parameters<typeof ui.find>[0]) => {
        const found = await ui.find(query)
        if (!found) console.log('MISSING', surface, label, JSON.stringify(await ui.drawn()).slice(0, 3000))
        return found
      }
      expect(await has('header', { type: 'Text', text: /LongPi ·/ })).toBeDefined()
      expect(await has('tab-overview', { type: 'Button', key: 'tab-overview' })).toBeDefined()
      await ui.press({ key: 'tab-codex' })
      expect(await has('codex', { type: 'Text', text: /长寿图鉴/ })).toBeDefined()
      // 更多 toggles the secondary pages; the choice is the session's, kept across mounts.
      if (!(await ui.find({ type: 'Button', key: 'tab-settings' }))) await ui.press({ key: 'tab-more' })
      expect(await has('tab-settings', { type: 'Button', key: 'tab-settings' })).toBeDefined()
      await ui.press({ key: 'tab-more' })
      await ui.unmount()
    }
  })

  test('/longpi with a question asks Pi in the person\'s words and turns coach mode on', async ($, on) => {
    const { clock } = world(on)
    let asked = ''
    on('prompt.submit', ($, e) => {
      asked = e.text
      return { text: e.text }
    })
    on('prompt.compose', () => ({ sections: [] }))
    await $.session.start(START)
    await $.command.run({ command: 'longpi', args: '我的身体年龄怎么样', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
    await clock.advance(10)
    expect(asked).toBe('我的身体年龄怎么样')
    const composed = await $.prompt.compose({ model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] })
    expect(composed.sections.map((s) => s.id)).toContain('longpi:coach')
  })
})
