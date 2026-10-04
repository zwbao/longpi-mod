// Append-only transparency log. Every consent, run and release is one line in a hash chain.
// The line names what happened. It does not copy a lab value.

import { join } from '../../sys/path.ts'
import type { IsoTime } from '../contracts/common.ts'
import type { TransparencyLogEntry } from '../contracts/science.ts'
import { appendJsonl, readJsonl } from '../core/store.ts'
import { stableStringify } from './canonical.ts'
import { sha256Hex } from './verify.ts'

export type LogKind = TransparencyLogEntry['kind']

export function logPath(dataDir: string): string {
  return join(dataDir, 'science', 'translog.jsonl')
}

export function readLog(dataDir: string): TransparencyLogEntry[] {
  return readJsonl<TransparencyLogEntry>(logPath(dataDir), (raw) => {
    const row = raw as TransparencyLogEntry
    return row && typeof row.seq === 'number' && typeof row.digest === 'string' ? row : null
  })
}

export function verifyChain(entries: readonly TransparencyLogEntry[]): { ok: true } | { ok: false; seq: number; reason: string } {
  let prev = '0'.repeat(64)
  for (const entry of entries) {
    if (entry.prev !== prev) return { ok: false, seq: entry.seq, reason: 'prev 对不上' }
    const digest = digestOf({ ...entry, digest: '' })
    if (digest !== entry.digest) return { ok: false, seq: entry.seq, reason: 'digest 对不上' }
    prev = entry.digest
  }
  return { ok: true }
}

function digestOf(entry: TransparencyLogEntry): string {
  const body = stableStringify({
    seq: entry.seq,
    at: entry.at,
    kind: entry.kind,
    study_id: entry.study_id ?? '',
    prev: entry.prev,
    detail_zh: entry.detail_zh,
  })
  return sha256Hex(body)
}

/** Public export. Only the chain fields. Lab values are not a column on this log. */
export function exportTransparency(entries: readonly TransparencyLogEntry[]): string {
  const lines = entries.map((row) => JSON.stringify({
    seq: row.seq,
    at: row.at,
    kind: row.kind,
    study_id: row.study_id ?? '',
    digest: row.digest,
    prev: row.prev,
    detail_zh: row.detail_zh,
  }))
  return lines.length > 0 ? `${lines.join('\n')}\n` : ''
}

/** Append one line. Returns the seq written into the consent or the result. */
export function appendLog(dataDir: string, kind: LogKind, detail_zh: string, study_id?: string, at: IsoTime = new Date().toISOString()): TransparencyLogEntry {
  const prior = readLog(dataDir)
  const prev = prior.length > 0 ? (prior[prior.length - 1]?.digest ?? '0'.repeat(64)) : '0'.repeat(64)
  const seq = prior.length > 0 ? (prior[prior.length - 1]?.seq ?? prior.length) + 1 : 1
  const draft: TransparencyLogEntry = { seq, at, kind, ...(study_id ? { study_id } : {}), digest: '', prev, detail_zh: detail_zh.slice(0, 400) }
  draft.digest = digestOf(draft)
  appendJsonl(logPath(dataDir), draft)
  return draft
}
