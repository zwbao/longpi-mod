// Outputs of past skill runs (out/result.json), kept locally so a later skill
// can use them (fasting-mimicking-diet takes two phenotypic ages) and the board
// can show before and after. Values stay in dataDir; nothing is uploaded.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from '../sys/fs.ts'
import { join } from '../sys/path.ts'

export interface OutputValue {
  value: number | string | null
  unit: string
  label_zh: string
}

export interface HistoryRow {
  at: string
  skill: string
  revision: string
  outputs: Record<string, OutputValue>
  /** Local date of the measurements the run read, when it read an earlier checkup. */
  measured_at?: string
  /** A hash of what the run read (the inputs, the age, the skill version): a row whose hash is not today's is stale. */
  inputs_key?: string
}

export interface LatestOutput extends OutputValue {
  at: string
  skill: string
  measured_at?: string
}

function historyPath(dataDir: string): string {
  return join(dataDir, 'history.jsonl')
}

export function readResultFile(path: string): Record<string, OutputValue> {
  if (!existsSync(path)) return {}
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { schema?: string; outputs?: Record<string, OutputValue> }
    if (parsed.schema !== 'longevity-result/1' || !parsed.outputs) return {}
    return parsed.outputs
  } catch {
    return {}
  }
}

export function recordOutputs(dataDir: string, row: HistoryRow): void {
  const kept = Object.fromEntries(Object.entries(row.outputs).filter(([, item]) => item && item.value != null))
  if (Object.keys(kept).length === 0) return
  mkdirSync(dataDir, { recursive: true, mode: 0o700 })
  appendFileSync(historyPath(dataDir), `${JSON.stringify({ ...row, outputs: kept })}\n`, { mode: 0o600 })
}

export function readHistory(dataDir: string, limit = 200): HistoryRow[] {
  const path = historyPath(dataDir)
  if (!existsSync(path)) return []
  const rows: HistoryRow[] = []
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).slice(-limit)) {
    try {
      const item = JSON.parse(line) as HistoryRow
      if (item && typeof item.skill === 'string' && item.outputs) rows.push(item)
    } catch {
      /* skip a torn line */
    }
  }
  return rows
}

function whenOf(row: HistoryRow): string {
  return row.measured_at || row.at
}

/** The value of each output key read from the most recent measurements (not the most recent run). */
export function latestOutputs(dataDir: string): Record<string, LatestOutput> {
  const latest: Record<string, LatestOutput> = {}
  for (const row of readHistory(dataDir)) {
    for (const [key, item] of Object.entries(row.outputs)) {
      if (item.value == null) continue
      const prior = latest[key]
      if (prior && (prior.measured_at || prior.at) > whenOf(row)) continue
      latest[key] = { ...item, at: row.at, skill: row.skill, ...(row.measured_at ? { measured_at: row.measured_at } : {}) }
    }
  }
  return latest
}

/**
 * Every recorded value of one output key, oldest measurement first, one per
 * measurement date (a rerun on the same checkup replaces the earlier run).
 */
export function seriesOf(dataDir: string, key: string): Array<{ at: string; value: number | string; skill: string; measured_at?: string }> {
  const byDate = new Map<string, { at: string; value: number | string; skill: string; measured_at?: string }>()
  for (const row of readHistory(dataDir, 1000)) {
    const item = row.outputs[key]
    if (!item || item.value == null) continue
    byDate.set(whenOf(row), { at: row.at, value: item.value, skill: row.skill, ...(row.measured_at ? { measured_at: row.measured_at } : {}) })
  }
  return [...byDate.values()].sort((a, b) => (a.measured_at || a.at).localeCompare(b.measured_at || b.at))
}
