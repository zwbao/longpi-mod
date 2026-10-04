// node:fs, synchronous, over the in-memory copy in vfs.ts. Same names and shapes the core calls.

import { Buffer } from './buffer.ts'
import { dirname, normalize, resolve } from './path.ts'
import { vfs } from './vfs.ts'

type Enc = BufferEncoding | { encoding?: BufferEncoding | null; flag?: string } | null | undefined
type BufferEncoding = 'utf8' | 'utf-8' | 'hex' | 'base64' | 'latin1'

function err(code: string, syscall: string, path: string): Error {
  const error = new Error(`${code}: ${syscall} '${path}'`) as Error & { code: string; path: string; syscall: string }
  error.code = code
  error.path = path
  error.syscall = syscall
  return error
}

function full(path: string | URL): string {
  return normalize(resolve(String(path)))
}

function encodingOf(options: Enc): BufferEncoding | null {
  if (!options) return null
  if (typeof options === 'string') return options
  return options.encoding ?? null
}

function textOf(path: string, syscall: string): string {
  const node = vfs.files.get(path)
  if (!node) {
    vfs.noteMiss(path)
    throw err('ENOENT', syscall, path)
  }
  if (node.text === null) {
    if (node.bytes) return new TextDecoder().decode(node.bytes)
    vfs.noteMiss(path)
    throw err('EIO', syscall, `${path} (not loaded)`)
  }
  return node.text
}

export function existsSync(path: string | URL): boolean {
  const at = full(path)
  if (vfs.files.has(at) || vfs.dirs.has(at)) return true
  vfs.noteMiss(at)
  return false
}

export function readFileSync(path: string | URL, options?: Enc): string & Buffer
export function readFileSync(path: string | URL, options?: Enc): string | Buffer {
  const at = full(path)
  const node = vfs.files.get(at)
  if (node?.bytes && !encodingOf(options)) return Buffer.fromBytes(node.bytes)
  const text = textOf(at, 'open')
  const encoding = encodingOf(options)
  if (encoding) return text
  return Buffer.from(text, 'utf8')
}

function toText(data: string | Uint8Array): { text: string | null; bytes: Uint8Array | null } {
  if (typeof data === 'string') return { text: data, bytes: null }
  const decoded = new TextDecoder('utf-8').decode(data)
  const roundTrip = new TextEncoder().encode(decoded)
  const same = roundTrip.length === data.length && roundTrip.every((b, i) => b === data[i])
  return same ? { text: decoded, bytes: null } : { text: null, bytes: Uint8Array.from(data) }
}

export function writeFileSync(path: string | URL, data: string | Uint8Array, options?: Enc | { mode?: number; encoding?: string | null; flag?: string }): void {
  const at = full(path)
  if (vfs.dirs.has(at)) throw err('EISDIR', 'open', at)
  const flag = options && typeof options === 'object' ? (options as { flag?: string }).flag : undefined
  if (flag === 'wx' && vfs.files.has(at)) throw err('EEXIST', 'open', at)
  vfs.ensureDirChain(dirname(at), true)
  const { text, bytes } = toText(data)
  const prior = vfs.files.get(at)
  vfs.files.set(at, { text, bytes, size: text?.length ?? bytes?.length ?? 0, mtimeMs: Date.now(), dirty: true, onDisk: prior?.onDisk ?? false, mode: null })
  const mode = options && typeof options === 'object' ? (options as { mode?: number }).mode : undefined
  if (typeof mode === 'number') vfs.chmods.set(at, mode & 0o777)
}

export function appendFileSync(path: string | URL, data: string | Uint8Array, options?: Enc | { mode?: number }): void {
  const at = full(path)
  const node = vfs.files.get(at)
  const add = typeof data === 'string' ? data : new TextDecoder().decode(data)
  if (!node) {
    writeFileSync(at, add, options as Enc)
    return
  }
  const before = textOf(at, 'open')
  node.text = before + add
  node.size = node.text.length
  node.mtimeMs = Date.now()
  node.dirty = true
}

export function mkdirSync(path: string | URL, _options?: { recursive?: boolean; mode?: number } | number): string | undefined {
  const at = full(path)
  if (vfs.dirs.has(at)) return undefined
  vfs.ensureDirChain(at, true)
  return at
}

type Dirent = { name: string; isFile: () => boolean; isDirectory: () => boolean; isSymbolicLink: () => boolean; parentPath: string; path: string }

export function readdirSync(path: string | URL, options?: { withFileTypes?: boolean; encoding?: string } | string): string[] & Dirent[]
export function readdirSync(path: string | URL, options?: { withFileTypes?: boolean; encoding?: string } | string): string[] | Dirent[] {
  const at = full(path)
  if (!vfs.dirs.has(at)) {
    vfs.noteMiss(at)
    throw err('ENOENT', 'scandir', at)
  }
  if (!vfs.listed.has(at)) vfs.noteMiss(`${at}/`)
  const kids = vfs.children(at)
  if (options && typeof options === 'object' && options.withFileTypes) {
    return kids.map((kid) => ({
      name: kid.name,
      isFile: () => kid.kind === 'file',
      isDirectory: () => kid.kind === 'directory',
      isSymbolicLink: () => false,
      parentPath: at,
      path: at,
    }))
  }
  return kids.map((kid) => kid.name)
}

export type Stats = {
  ino: number
  isFile: () => boolean
  isDirectory: () => boolean
  isSymbolicLink: () => boolean
  size: number
  mtimeMs: number
  mtime: Date
  ctimeMs: number
  mode: number
}

function statOf(at: string, syscall: string): Stats {
  const node = vfs.files.get(at)
  if (node) {
    const mtimeMs = node.mtimeMs > 0 ? node.mtimeMs : Date.now()
    return { isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false, size: node.text?.length ?? node.bytes?.length ?? node.size, mtimeMs, mtime: new Date(mtimeMs), ctimeMs: mtimeMs, mode: node.mode ?? 0o644, ino: 0 }
  }
  if (vfs.dirs.has(at)) {
    return { isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false, size: 0, mtimeMs: 0, mtime: new Date(0), ctimeMs: 0, mode: 0o755, ino: 0 }
  }
  vfs.noteMiss(at)
  throw err('ENOENT', syscall, at)
}

export function statSync(path: string | URL, options?: { throwIfNoEntry?: boolean }): Stats {
  const at = full(path)
  if (options?.throwIfNoEntry === false && !vfs.files.has(at) && !vfs.dirs.has(at)) return undefined as unknown as Stats
  return statOf(at, 'stat')
}

export function lstatSync(path: string | URL, options?: { throwIfNoEntry?: boolean }): Stats {
  return statSync(path, options)
}

export function realpathSync(path: string | URL): string {
  const at = full(path)
  statOf(at, 'realpath')
  return at
}

export function renameSync(from: string | URL, to: string | URL): void {
  const a = full(from)
  const b = full(to)
  const node = vfs.files.get(a)
  if (node) {
    vfs.ensureDirChain(dirname(b), true)
    const prior = vfs.files.get(b)
    vfs.files.set(b, { ...node, dirty: true, onDisk: prior?.onDisk ?? false })
    vfs.remove(a)
    return
  }
  if (vfs.dirs.has(a)) {
    const moved: Array<[string, string]> = []
    for (const key of vfs.files.keys()) if (key.startsWith(`${a}/`)) moved.push([key, `${b}${key.slice(a.length)}`])
    for (const [src, dst] of moved) {
      const child = vfs.files.get(src)
      if (!child) continue
      vfs.ensureDirChain(dirname(dst), true)
      vfs.files.set(dst, { ...child, dirty: true, onDisk: false })
    }
    vfs.ensureDirChain(b, true)
    vfs.remove(a)
    return
  }
  throw err('ENOENT', 'rename', a)
}

export function rmSync(path: string | URL, options?: { recursive?: boolean; force?: boolean }): void {
  const at = full(path)
  if (!vfs.files.has(at) && !vfs.dirs.has(at)) {
    if (options?.force) return
    throw err('ENOENT', 'rm', at)
  }
  vfs.remove(at)
}

export function rmdirSync(path: string | URL, options?: { recursive?: boolean }): void {
  rmSync(path, { recursive: options?.recursive, force: false })
}

export function unlinkSync(path: string | URL): void {
  const at = full(path)
  if (!vfs.files.has(at)) throw err('ENOENT', 'unlink', at)
  vfs.remove(at)
}

export function copyFileSync(from: string | URL, to: string | URL): void {
  const a = full(from)
  const node = vfs.files.get(a)
  if (!node) throw err('ENOENT', 'copyfile', a)
  if (node.bytes) writeFileSync(to, node.bytes)
  else writeFileSync(to, textOf(a, 'copyfile'))
}

export function symlinkSync(target: string | URL, path: string | URL): void {
  copyFileSync(target, path)
}

export function chmodSync(path: string | URL, mode: number): void {
  const at = full(path)
  if (!vfs.files.has(at) && !vfs.dirs.has(at)) throw err('ENOENT', 'chmod', at)
  vfs.chmods.set(at, mode & 0o777)
}

export function openSync(): never {
  throw new Error('openSync is not available in the LongPi mod')
}

export const constants = { F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1 }

export function accessSync(path: string | URL): void {
  statOf(full(path), 'access')
}

export const promises = {
  readFile: async (path: string | URL, options?: Enc) => readFileSync(path, options),
  writeFile: async (path: string | URL, data: string | Uint8Array) => writeFileSync(path, data),
}

export default {
  existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, readdirSync, statSync, lstatSync, realpathSync, renameSync, rmSync, rmdirSync,
  unlinkSync, copyFileSync, chmodSync, openSync, accessSync, constants, promises,
}
