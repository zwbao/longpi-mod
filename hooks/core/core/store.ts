import { process } from '../../sys/process.ts'
// dataDir file access for the new stores (AA §3.5): atomic rename, 0600, and a file that fails to parse is
// kept aside as <name>.damaged-<ts> instead of being overwritten silently.

import { randomBytes } from '../../sys/crypto.ts'
import { appendFileSync, chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from '../../sys/fs.ts'
import { dirname } from '../../sys/path.ts'

export class DamagedFileError extends Error {
  constructor(readonly path: string, readonly kept: string) {
    super(`${path} could not be parsed; kept as ${kept}`)
  }
}

/** The file's value, or empty() when it does not exist. A damaged file is copied aside once and empty() returned. */
export function readJson<T>(path: string, parse: (raw: unknown) => T, empty: () => T): T {
  if (!existsSync(path)) return empty()
  let text = ''
  try {
    text = readFileSync(path, 'utf8')
    return parse(JSON.parse(text))
  } catch {
    try {
      const kept = `${path}.damaged-${Date.now()}`
      copyFileSync(path, kept)
      // Replace it with an empty value so the copy is made once, not on every read.
      writeJsonAtomic(path, empty())
    } catch {
      // unreadable and uncopyable: the empty value still lets the plugin run
    }
    return empty()
  }
}

export function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const tmp = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  chmodSync(tmp, 0o600)
  renameSync(tmp, path)
}

/** One JSON line, appended whole (a single write call). */
export function appendJsonl(path: string, row: unknown): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  appendFileSync(path, `${JSON.stringify(row)}\n`, { mode: 0o600 })
}

/** Every parseable line; a torn line is skipped. */
export function readJsonl<T>(path: string, keep: (raw: unknown) => T | null = (raw) => raw as T): T[] {
  if (!existsSync(path)) return []
  const out: T[] = []
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      const row = keep(JSON.parse(line))
      if (row != null) out.push(row)
    } catch {
      // torn line
    }
  }
  return out
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
}
