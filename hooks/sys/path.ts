// node:path for POSIX paths, enough for the core.

export const sep = '/'
export const delimiter = ':'

export function normalize(path: string): string {
  if (path === '') return '.'
  const isAbs = path.startsWith('/')
  const out: string[] = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') out.pop()
      else if (!isAbs) out.push('..')
      continue
    }
    out.push(part)
  }
  const body = out.join('/')
  if (isAbs) return `/${body}`
  return body || '.'
}

export function join(...parts: string[]): string {
  const kept = parts.filter((part) => typeof part === 'string' && part !== '')
  if (kept.length === 0) return '.'
  return normalize(kept.join('/'))
}

export function isAbsolute(path: string): boolean {
  return path.startsWith('/')
}

let cwdOf: () => string = () => '/'

export function setCwd(fn: () => string): void {
  cwdOf = fn
}

export function resolve(...parts: string[]): string {
  let out = ''
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i]
    if (!part) continue
    out = out ? `${part}/${out}` : part
    if (part.startsWith('/')) break
  }
  if (!out.startsWith('/')) out = `${cwdOf()}/${out}`
  const normal = normalize(out)
  return normal.length > 1 && normal.endsWith('/') ? normal.slice(0, -1) : normal
}

export function dirname(path: string): string {
  if (!path) return '.'
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path
  const at = trimmed.lastIndexOf('/')
  if (at < 0) return '.'
  if (at === 0) return '/'
  return trimmed.slice(0, at)
}

export function basename(path: string, ext?: string): string {
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path
  const base = trimmed.slice(trimmed.lastIndexOf('/') + 1)
  return ext && base.endsWith(ext) && base !== ext ? base.slice(0, -ext.length) : base
}

export function extname(path: string): string {
  const base = basename(path)
  const at = base.lastIndexOf('.')
  return at <= 0 ? '' : base.slice(at)
}

export function relative(from: string, to: string): string {
  const a = resolve(from).split('/').filter(Boolean)
  const b = resolve(to).split('/').filter(Boolean)
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1
  return [...a.slice(i).map(() => '..'), ...b.slice(i)].join('/')
}

export function parse(path: string): { root: string; dir: string; base: string; ext: string; name: string } {
  const base = basename(path)
  const ext = extname(path)
  return { root: path.startsWith('/') ? '/' : '', dir: dirname(path), base, ext, name: ext ? base.slice(0, -ext.length) : base }
}

export const posix = { sep, delimiter, normalize, join, isAbsolute, resolve, dirname, basename, extname, relative, parse }

export default posix
