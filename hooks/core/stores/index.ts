// Typed local stores. Off until a file of that type is accepted.
// readStore is registered from datain/register.ts. This module does not choose a method.

import type { StoreKind, StoreRows } from '../contracts/library.ts'
import { commitRows, keptRows } from './commit.ts'
import { storeIsOn } from './disk.ts'
import { STORE_KINDS } from './limits.ts'
import { coverageOf, parseReport, type ParseOpts, type ParsedStores } from './parse.ts'
import type { StoreSummary } from './summary.ts'

export function isStoreKind(value: unknown): value is StoreKind {
  return value === 'methylation' || value === 'taxa' || value === 'proteins' || value === 'conditions'
}

export function readStored<K extends StoreKind>(dataDir: string, kind: K): StoreRows[K][] {
  if (!isStoreKind(kind)) throw new Error(`unknown store ${String(kind)}`)
  return keptRows(dataDir, kind)
}

export function saveReportText(dataDir: string, text: string, opts: ParseOpts): { parsed: ParsedStores; summaries: StoreSummary[] } {
  const parsed = parseReport(text, opts)
  const kinds = opts.type ? [opts.type] : parsed.detected
  const summaries = kinds.map((kind) => {
    const rows = parsed[kind] as StoreRows[typeof kind][]
    return commitRows(dataDir, kind, rows, opts.filename, parsed.rejected, (kept) => coverageOf(kind, kept as ParsedStores[typeof kind]))
  })
  return { parsed, summaries }
}

export function storeLabel(kind: StoreKind): string {
  if (kind === 'methylation') return '甲基化'
  if (kind === 'taxa') return '菌群'
  if (kind === 'proteins') return '蛋白'
  return '诊断编码'
}

export function confirmMessage(kind?: StoreKind): string {
  const what = kind ? storeLabel(kind) : '此类'
  return `该文件为${what}数据，确认后才会保存在这台电脑上，不会上传至健康数据服务。`
}

export function storeReadBack(summaries: StoreSummary[]): string {
  if (summaries.length === 0) return ''
  const lines: string[] = []
  for (const row of summaries) {
    const name = storeLabel(row.kind)
    if (row.error) {
      lines.push(`${name}未写入：无法读取已有文件，为避免覆盖未作修改。`)
      continue
    }
    if (row.stored === 0) lines.push(`${name}未写入：${row.rejected} 行未通过校验。`)
    else {
      lines.push(`${name}已记录 ${row.stored} 行。${row.coverage_zh}`)
      if (row.rejected > 0) lines.push(`另有 ${row.rejected} 行未写入。`)
    }
  }
  lines.push('原始表格仅保存在这台电脑上，未发送至对话。')
  return lines.join('')
}

export function anyStoreOn(dataDir: string): Record<StoreKind, boolean> {
  return {
    methylation: storeIsOn(dataDir, 'methylation'),
    taxa: storeIsOn(dataDir, 'taxa'),
    proteins: storeIsOn(dataDir, 'proteins'),
    conditions: storeIsOn(dataDir, 'conditions'),
  }
}

export { STORE_KINDS, IMPORT_CAP_BYTES, IMPORT_CAP_ROWS, MODEL_FILE_CAP } from './limits.ts'
export { storeIsOn, storePath } from './disk.ts'
export { parseReport, type ParseOpts, type ParsedStores } from './parse.ts'
export { writeNarrowCsv, type NarrowCsv, type NarrowOpts } from './narrow.ts'
export { FRAILTY_PROBE_IDS } from './methylation.ts'
export type { StoreSummary, StoreReject } from './summary.ts'
