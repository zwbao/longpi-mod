// The ported core reads and writes files synchronously, as it did under Node. A mod reaches the disk only
// asynchronously, through the engine. So each operation runs against an in-memory copy: `sync` loads the
// roots the core uses (the LongPi home, the method library's tables, the mod's own data) before the
// operation, the core works on the copy, and `flush` writes what changed back after it. A read outside the
// loaded roots is a miss: it behaves as "no such file" and is logged, never guessed.

import { host, type Io } from './host.ts'
import { dirname, normalize } from './path.ts'
import { toBase64 } from './buffer.ts'

type FileNode = {
  /** null: the file exists on disk but was not loaded (too big, or binary). */
  text: string | null
  /** Bytes written by the core that are not text (the zip export). */
  bytes: Uint8Array | null
  size: number
  mtimeMs: number
  dirty: boolean
  onDisk: boolean
  mode: number | null
}

export type RootSpec = {
  path: string
  /** Load everything below (default), or only the listed files. */
  recursive?: boolean
  /** Sub-directories (names) not to walk; they are known to exist but stay unlisted. */
  skipDirs?: readonly string[]
  /** Files larger than this stay unloaded (text null). */
  maxBytes?: number
  /** Read once per session (the mod's own shipped files): later syncs skip it. */
  once?: boolean
}

const TEXT_EXT = /\.(json|jsonl|md|txt|csv|tsv|yml|yaml|ics|html|py|toml|ts|js|mjs|xml|svg|log|tmp)$|^[^.]+$/i
const DEFAULT_MAX = 6 * 1024 * 1024

/** One operation's hold on the copy, for letting it go while the operation waits outside. */
export type OpToken = { yielded: boolean; out: number; back: Promise<void> | null }

export class Vfs {
  files = new Map<string, FileNode>()
  dirs = new Set<string>()
  /** Directories whose children are all known. */
  listed = new Set<string>()
  newDirs = new Set<string>()
  deleted = new Set<string>()
  chmods = new Map<string, number>()
  misses = new Set<string>()
  roots: RootSpec[] = []
  private held = false
  private waiting: Array<() => void> = []
  /** The operation holding the copy now (null between operations or while its holder waits outside). */
  private owner: OpToken | null = null

  /** True while an operation holds the copy. */
  busy = false

  private async acquire(): Promise<void> {
    if (!this.held) {
      this.held = true
      return
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve))
  }

  private release(): void {
    const next = this.waiting.shift()
    if (next) next()
    else this.held = false
  }

  /** Serialises operations: one core operation at a time sees and changes the copy. */
  async exclusive<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    const token: OpToken = { yielded: false, out: 0, back: null }
    this.owner = token
    this.busy = true
    try {
      return await fn()
    } finally {
      this.owner = null
      this.busy = false
      this.release()
    }
  }

  /** The operation running now, for a later outside(): taken when the work is started, while its code runs. */
  current(): OpToken | null {
    return this.busy ? this.owner : null
  }

  /**
   * Run `work` (a process, a model call: seconds to minutes of waiting on the outside) with the copy let go, so
   * other operations are not held up behind it; the operation takes the copy back before its code goes on. Several
   * of one operation's works may be out at once (methods run side by side): the first back takes the copy again,
   * the others find it theirs. `token` is the operation's, from current() when the work was started; without one
   * (no operation) the work simply runs. Flushes and syncs never use this: they are the operation's own part.
   */
  async outside<T>(token: OpToken | null, work: () => Promise<T>): Promise<T> {
    if (!token) return work()
    if (!token.yielded) {
      if (this.owner !== token) return work()
      token.yielded = true
      this.owner = null
      this.busy = false
      this.release()
    }
    token.out += 1
    try {
      return await work()
    } finally {
      token.out -= 1
      // The first back takes the copy for the operation; a sibling back meanwhile waits for that same taking.
      if (token.yielded) {
        token.back ??= (async () => {
          await this.acquire()
          token.yielded = false
          this.owner = token
          this.busy = true
          token.back = null
        })()
        await token.back
      }
    }
  }

  addRoot(spec: RootSpec): void {
    const path = normalize(spec.path)
    if (this.roots.some((root) => root.path === path)) return
    this.roots.push({ ...spec, path })
  }

  isKnownDir(path: string): boolean {
    return this.dirs.has(path)
  }

  /** The nearest listed ancestor decides whether a missing path is truly absent. */
  private authoritative(path: string): boolean {
    let dir = dirname(path)
    for (;;) {
      if (this.listed.has(dir)) return true
      if (this.dirs.has(dir) && !this.listed.has(dir)) return false
      const up = dirname(dir)
      if (up === dir) return false
      dir = up
    }
  }

  noteMiss(path: string): void {
    if (this.authoritative(path)) return
    if (!this.misses.has(path)) {
      this.misses.add(path)
      try {
        host().io.log(`vfs miss: ${path}`)
      } catch {
        // no host yet
      }
    }
  }

  ensureDirChain(path: string, created: boolean): void {
    let dir = normalize(path)
    const chain: string[] = []
    while (!this.dirs.has(dir)) {
      chain.push(dir)
      const up = dirname(dir)
      if (up === dir) break
      dir = up
    }
    for (const item of chain) {
      this.dirs.add(item)
      this.listed.add(item)
      if (created) this.newDirs.add(item)
    }
  }

  /** Load or refresh one root from disk. */
  async syncRoot(io: Io, spec: RootSpec): Promise<void> {
    const stat = await io.stat(spec.path)
    if (!stat) {
      // The root is absent on disk; whatever the core created in memory stays.
      for (const path of [...this.files.keys()]) {
        const node = this.files.get(path)
        if (node && node.onDisk && path.startsWith(`${spec.path}/`) && !node.dirty) this.files.delete(path)
      }
      if (!this.newDirs.has(spec.path)) {
        this.dirs.delete(spec.path)
        this.listed.delete(spec.path)
      }
      // Its parent is authoritative for it now.
      this.dirs.add(dirname(spec.path))
      this.listed.add(dirname(spec.path))
      return
    }
    if (stat.kind === 'file') {
      await this.syncFile(io, spec.path, stat.size, stat.mtimeMs, spec.maxBytes ?? DEFAULT_MAX)
      this.ensureDirChain(dirname(spec.path), false)
      return
    }
    this.ensureDirChain(spec.path, false)
    if (spec.recursive === false) return
    await this.walk(io, spec.path, spec)
  }

  private async walk(io: Io, dir: string, spec: RootSpec): Promise<void> {
    let entries
    try {
      entries = await io.list(dir)
    } catch {
      return
    }
    this.dirs.add(dir)
    this.listed.add(dir)
    const seen = new Set<string>()
    for (const entry of entries) {
      const path = `${dir}/${entry.name}`
      seen.add(path)
      if (this.deleted.has(path)) continue
      if (entry.kind === 'directory') {
        this.dirs.add(path)
        if (spec.skipDirs?.includes(entry.name) && dir === spec.path) {
          this.listed.delete(path)
          continue
        }
        await this.walk(io, path, spec)
      } else if (entry.kind === 'file') {
        await this.syncFile(io, path, entry.size, entry.mtimeMs, spec.maxBytes ?? DEFAULT_MAX)
      }
    }
    // Files gone from disk (and not written by the core since) are gone here too.
    for (const path of [...this.files.keys()]) {
      if (dirname(path) !== dir || seen.has(path)) continue
      const node = this.files.get(path)
      if (node && node.onDisk && !node.dirty) this.files.delete(path)
    }
  }

  private async syncFile(io: Io, path: string, size: number, mtimeMs: number, maxBytes: number): Promise<void> {
    const node = this.files.get(path)
    const loaded = node ? node.text !== null || node.bytes !== null : false
    if (node && (node.dirty || (loaded && node.mtimeMs === mtimeMs && node.size === size))) return
    if (this.deleted.has(path)) return
    const loadable = size <= maxBytes && TEXT_EXT.test(path.slice(path.lastIndexOf('/') + 1))
    let text: string | null = null
    if (loadable) {
      try {
        text = await io.read(path)
      } catch {
        text = null
      }
    }
    this.files.set(path, { text, bytes: null, size, mtimeMs, dirty: false, onDisk: true, mode: null })
  }

  /** Load one file or directory on demand (an async caller about to run sync code that reads it). */
  async ensure(io: Io, path: string, options: { recursive?: boolean; maxBytes?: number } = {}): Promise<void> {
    const at = normalize(path)
    const stat = await io.stat(at)
    if (!stat) {
      this.ensureDirChain(dirname(at), false)
      this.listed.add(dirname(at))
      return
    }
    if (stat.kind === 'file') {
      this.ensureDirChain(dirname(at), false)
      await this.syncFile(io, at, stat.size, stat.mtimeMs, options.maxBytes ?? DEFAULT_MAX)
      return
    }
    this.ensureDirChain(at, false)
    if (options.recursive) await this.walk(io, at, { path: at, maxBytes: options.maxBytes })
    else {
      const entries = await io.list(at)
      this.listed.add(at)
      for (const entry of entries) {
        const child = `${at}/${entry.name}`
        if (entry.kind === 'directory') this.dirs.add(child)
        else if (entry.kind === 'file' && !this.files.has(child)) {
          this.files.set(child, { text: null, bytes: null, size: entry.size, mtimeMs: -1, dirty: false, onDisk: true, mode: null })
        }
      }
    }
  }

  /**
   * One process walks a large read-only tree (the method library) and returns its listing, with the text of
   * the files `include` names; far faster than a listing call per directory. False when no Python ran.
   */
  async bulkLoad(io: Io, python: string, root: string, include: string, maxBytes = 512 * 1024): Promise<boolean> {
    const script = [
      'import json,os,re,sys',
      'root,inc,cap=sys.argv[1],re.compile(sys.argv[2]),int(sys.argv[3])',
      'out=[]',
      'for d,ds,fs in os.walk(root):',
      ' ds[:]=[x for x in ds if not x.startswith(".") and x!="__pycache__"]',
      ' out.append({"p":d,"k":"d"})',
      ' for f in fs:',
      '  p=os.path.join(d,f)',
      '  try: st=os.stat(p)',
      '  except OSError: continue',
      '  e={"p":p,"k":"f","s":st.st_size,"m":int(st.st_mtime*1000)}',
      '  if inc.search(f) and st.st_size<=cap:',
      '   try: e["t"]=open(p,encoding="utf-8").read()',
      '   except Exception: pass',
      '  out.append(e)',
      'sys.stdout.write(json.dumps(out,ensure_ascii=False))',
    ].join('\n')
    let result
    try {
      result = await io.run([python, '-c', script, root, include, String(maxBytes)], { timeoutMs: 60_000 })
    } catch {
      return false
    }
    if (result.exitCode !== 0) return false
    let rows: Array<{ p: string; k: 'd' | 'f'; s?: number; m?: number; t?: string }>
    try {
      rows = JSON.parse(result.stdout) as typeof rows
    } catch {
      return false
    }
    this.ensureDirChain(root, false)
    for (const row of rows) {
      if (row.k === 'd') {
        this.dirs.add(row.p)
        this.listed.add(row.p)
        continue
      }
      const prior = this.files.get(row.p)
      if (prior?.dirty) continue
      this.files.set(row.p, { text: typeof row.t === 'string' ? row.t : null, bytes: null, size: row.s ?? 0, mtimeMs: row.m ?? 0, dirty: false, onDisk: true, mode: null })
    }
    return true
  }

  private done = new Set<string>()

  async sync(io: Io): Promise<void> {
    for (const root of this.roots) {
      if (root.once && this.done.has(root.path)) continue
      await this.syncRoot(io, root)
      if (root.once) this.done.add(root.path)
    }
  }

  /** Whether the core wrote something not yet on disk. */
  hasPending(): boolean {
    if (this.deleted.size > 0 || this.newDirs.size > 0 || this.chmods.size > 0) return true
    for (const node of this.files.values()) if (node.dirty) return true
    return false
  }

  async flush(io: Io): Promise<void> {
    const removals = [...this.deleted]
    if (removals.length > 0) {
      await io.run(['rm', '-rf', '--', ...removals]).catch(() => undefined)
      this.deleted.clear()
    }
    const mk = [...this.newDirs].filter((dir) => this.dirs.has(dir)).sort((a, b) => a.length - b.length)
    if (mk.length > 0) {
      await io.run(['mkdir', '-p', '--', ...mk]).catch(() => undefined)
      this.newDirs.clear()
    }
    for (const [path, node] of this.files) {
      if (!node.dirty) continue
      if (node.bytes) {
        const tmp = `${path}.b64tmp`
        await io.write(tmp, toBase64(node.bytes))
        await io.run(['python3', '-c', 'import base64,sys;open(sys.argv[2],"wb").write(base64.b64decode(open(sys.argv[1]).read()))', tmp, path]).catch(() => undefined)
        await io.run(['rm', '-f', '--', tmp]).catch(() => undefined)
      } else {
        await io.write(path, node.text ?? '')
      }
      node.dirty = false
      node.onDisk = true
      const stat = await io.stat(path).catch(() => null)
      if (stat) {
        node.mtimeMs = stat.mtimeMs
        node.size = stat.size
      }
    }
    if (this.chmods.size > 0) {
      const byMode = new Map<number, string[]>()
      for (const [path, mode] of this.chmods) byMode.set(mode, [...(byMode.get(mode) ?? []), path])
      this.chmods.clear()
      for (const [mode, paths] of byMode) await io.run(['chmod', mode.toString(8), ...paths]).catch(() => undefined)
    }
  }

  children(dir: string): Array<{ name: string; kind: 'file' | 'directory' }> {
    const prefix = dir === '/' ? '/' : `${dir}/`
    const out = new Map<string, 'file' | 'directory'>()
    for (const path of this.files.keys()) {
      if (!path.startsWith(prefix)) continue
      const rest = path.slice(prefix.length)
      const slash = rest.indexOf('/')
      if (slash < 0) out.set(rest, 'file')
      else out.set(rest.slice(0, slash), 'directory')
    }
    for (const path of this.dirs) {
      if (!path.startsWith(prefix) || path === dir) continue
      const rest = path.slice(prefix.length)
      const slash = rest.indexOf('/')
      out.set(slash < 0 ? rest : rest.slice(0, slash), 'directory')
    }
    return [...out.entries()].map(([name, kind]) => ({ name, kind })).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  }

  remove(path: string): void {
    const prefix = `${path}/`
    let wasOnDisk = false
    const node = this.files.get(path)
    if (node) {
      wasOnDisk = node.onDisk
      this.files.delete(path)
    }
    for (const [key, child] of [...this.files]) {
      if (key.startsWith(prefix)) {
        if (child.onDisk) wasOnDisk = true
        this.files.delete(key)
      }
    }
    if (this.dirs.has(path)) {
      wasOnDisk = wasOnDisk || !this.newDirs.has(path)
      for (const dir of [...this.dirs]) if (dir === path || dir.startsWith(prefix)) {
        this.dirs.delete(dir)
        this.listed.delete(dir)
        this.newDirs.delete(dir)
      }
    }
    if (wasOnDisk) this.deleted.add(path)
  }
}

export const vfs = new Vfs()

/**
 * Wait for work another operation started (a run in flight, shared): with the copy let go, or the other operation
 * could never take it back to finish and both would wait forever.
 */
export function awaitShared<T>(promise: Promise<T>): Promise<T> {
  return vfs.outside(vfs.current(), () => promise)
}

export type { FileNode }
