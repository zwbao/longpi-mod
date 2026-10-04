// Files live at <dataDir>/{methylation,taxa,proteins,conditions}.json.
// A missing file is off. A file that does not parse is left as it is.

import { existsSync, readFileSync, unlinkSync } from '../../sys/fs.ts'
import { join } from '../../sys/path.ts'
import type { StoreKind } from '../contracts/library.ts'
import { writeJsonAtomic } from '../core/store.ts'
import { STORE_SCHEMA } from './limits.ts'

export function storePath(dataDir: string, kind: StoreKind): string {
  return join(dataDir, `${kind}.json`)
}

export function storeIsOn(dataDir: string, kind: StoreKind): boolean {
  return existsSync(storePath(dataDir, kind))
}

export class DamagedStoreError extends Error {
  constructor(readonly kind: StoreKind) {
    super(`${kind} store is damaged`)
  }
}

export function readStoreDocument(dataDir: string, kind: StoreKind): { on: boolean; rows: unknown[] } {
  const path = storePath(dataDir, kind)
  if (!existsSync(path)) return { on: false, rows: [] }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape')
    const doc = parsed as { schema?: unknown; kind?: unknown; rows?: unknown }
    if (doc.schema !== STORE_SCHEMA || doc.kind !== kind || !Array.isArray(doc.rows)) throw new Error('shape')
    return { on: true, rows: doc.rows }
  } catch (error) {
    if (error instanceof DamagedStoreError) throw error
    throw new DamagedStoreError(kind)
  }
}

export function writeStoreDocument(dataDir: string, kind: StoreKind, rows: unknown[]): void {
  const path = storePath(dataDir, kind)
  if (rows.length === 0) {
    if (existsSync(path)) unlinkSync(path)
    return
  }
  writeJsonAtomic(path, { schema: STORE_SCHEMA, kind, rows })
}
