import { process } from '../sys/process.ts'
// A prescription the person asked to remember ("请记一下"). Mirobody keeps the
// imported plan; this file is what they just said, and the summary prefers it.

import { randomBytes } from '../sys/crypto.ts'
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from '../sys/fs.ts'
import { dirname, join } from '../sys/path.ts'
import { memoryFor } from './core/memory.ts'
import type { MedicationRow } from './situation.ts'

export interface StatedMedication {
  name: string
  dose_text: string
  frequency_text: string
  since: string
  at: string
}

const STOPPED = /^\s*(?:stopped|ended|inactive|completed|discontinued|停用|已停|已停用|停药|结束|已结束|已完成)\s*$/i

function pathOf(dataDir: string): string {
  return join(dataDir, 'medication_statements.jsonl')
}

export function readStatements(dataDir: string): StatedMedication[] {
  const path = pathOf(dataDir)
  if (!existsSync(path)) return []
  const out: StatedMedication[] = []
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      const raw = JSON.parse(line) as Record<string, unknown>
      if (typeof raw.name !== 'string' || !raw.name.trim()) continue
      out.push({
        name: raw.name.trim(),
        dose_text: typeof raw.dose_text === 'string' ? raw.dose_text.trim() : '',
        frequency_text: typeof raw.frequency_text === 'string' ? raw.frequency_text.trim() : '',
        since: typeof raw.since === 'string' ? raw.since.slice(0, 10) : '',
        at: typeof raw.at === 'string' ? raw.at : '',
      })
    } catch {
      // a torn line is skipped; the rest of the log still counts
    }
  }
  return out.slice(-40)
}

export function addStatement(dataDir: string, row: Omit<StatedMedication, 'at'>, now = new Date()): StatedMedication {
  const saved: StatedMedication = { ...row, name: row.name.trim(), at: now.toISOString() }
  const path = pathOf(dataDir)
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const tmp = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  const prior = existsSync(path) ? readFileSync(path, 'utf8') : ''
  writeFileSync(tmp, `${prior}${JSON.stringify(saved)}\n`, { mode: 0o600 })
  chmodSync(tmp, 0o600)
  renameSync(tmp, path)
  // The memory mirror imports this log. Touching it here makes the new line visible
  // before the next journey build. A failure to mirror does not drop the statement.
  try {
    memoryFor(dataDir)
  } catch {
    // the jsonl line is the record of what they said
  }
  return saved
}

/** Mirobody prints a once-daily plan as "0x/day" (period of 1 day, count left at 0). */
export function fixScheduleText(text: string): string {
  return text
    .replace(/(\d+(?:\.\d+)?)\s*(mg|g|μg|µg|mcg|IU|U|毫克|克)\s+0x\/day/gi, '$1 $2，每天 1 次')
    .replace(/\b0x\/day\b/g, '每天 1 次')
    .replace(/\b(\d+)x\/day\b/g, '每天 $1 次')
}

export function drugCore(name: string): string {
  return name.replace(/缓释片|控释片|肠溶片|分散片|缓释|控释|肠溶|胶囊|片|颗粒/g, '').replace(/\s/g, '').toLowerCase()
}

function ended(row: MedicationRow): boolean {
  return STOPPED.test(row.status ?? '') || Boolean(row.until)
}

function asRow(row: StatedMedication): MedicationRow {
  const schedule = [row.dose_text, row.frequency_text].filter(Boolean).join(' ')
  return {
    name: row.name,
    status: 'active',
    recorded_dose: row.dose_text,
    schedule: schedule || row.frequency_text,
    ...(row.since ? { since: row.since } : {}),
  }
}

export function regimenLine(row: MedicationRow, role: '当前' | '较早' | '你记下的'): string {
  const when = row.schedule ? fixScheduleText(row.schedule) : fixScheduleText(row.recorded_dose)
  const from = row.since ? `，${row.since} 起` : ''
  const to = row.until ? `至 ${row.until}` : ''
  return `${role}：${row.name}${when ? ` ${when}` : ''}${from}${to}`
}

/**
 * One current line per drug. A statement the person just asked to remember
 * wins. An older or ended plan stays on a second line so it is not read as today's dose.
 */
export function presentMedications(rows: readonly MedicationRow[], stated: readonly StatedMedication[] = []): { rows: MedicationRow[]; lines: string[] } {
  const fixed = rows.map((row) => ({
    ...row,
    recorded_dose: fixScheduleText(row.recorded_dose),
    ...(row.schedule ? { schedule: fixScheduleText(row.schedule) } : {}),
  }))
  const groups = new Map<string, MedicationRow[]>()
  for (const row of fixed) {
    const key = drugCore(row.name)
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  for (const row of stated) {
    const key = drugCore(row.name)
    const list = groups.get(key) ?? []
    groups.set(key, [asRow(row), ...list.filter((item) => item.name !== row.name || item.since !== row.since)])
  }
  const kept: MedicationRow[] = []
  const lines: string[] = []
  for (const list of groups.values()) {
    const ordered = [...list].sort((a, b) => Number(ended(a)) - Number(ended(b)) || (b.since ?? '').localeCompare(a.since ?? ''))
    const current = ordered[0]
    if (!current) continue
    kept.push(current)
    const statedHit = stated.some((row) => drugCore(row.name) === drugCore(current.name) && row.since === (current.since ?? '') && row.name === current.name)
    lines.push(regimenLine(current, statedHit ? '你记下的' : ended(current) ? '较早' : '当前'))
    for (const older of ordered.slice(1, 3)) lines.push(regimenLine(older, '较早'))
  }
  return { rows: kept.slice(0, 30), lines }
}
