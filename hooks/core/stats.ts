// Anonymous run statistics for improving the skill library. Counts only:
// which skill ran, whether it finished, why it failed, and which input keys
// were missing. No values, no report text, no profile, no record content.
// The file stays in dataDir until the person chooses to share it.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from '../sys/fs.ts'
import { join } from '../sys/path.ts'
import type { Receipt } from './runner.ts'

export interface SkillStats {
  skill: string
  runs: number
  ok: number
  error_kinds: Record<string, number>
  problem_kinds: Record<string, number>
  missing_inputs: Record<string, number>
}

export interface Stats {
  schema: 'longpi-stats/1'
  week: string
  since: string
  until: string
  runs: number
  skills: SkillStats[]
}

function isoWeek(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const weekday = day.getUTCDay() || 7
  day.setUTCDate(day.getUTCDate() + 4 - weekday)
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((day.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function allReceipts(dataDir: string): Receipt[] {
  const path = join(dataDir, 'receipts.jsonl')
  if (!existsSync(path)) return []
  const rows: Receipt[] = []
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean)) {
    try {
      const item = JSON.parse(line) as Receipt
      if (item && typeof item.skill === 'string' && typeof item.at === 'string') rows.push(item)
    } catch {
      /* skip a torn line */
    }
  }
  return rows
}

function bump(counter: Record<string, number>, key: string | undefined): void {
  if (!key) return
  counter[key] = (counter[key] ?? 0) + 1
}

export function buildStats(dataDir: string, days = 7, now = new Date()): Stats {
  const since = new Date(now.getTime() - days * 86_400_000)
  const bySkill = new Map<string, SkillStats>()
  let runs = 0
  for (const receipt of allReceipts(dataDir)) {
    const at = new Date(receipt.at)
    if (Number.isNaN(at.getTime()) || at < since || at > now) continue
    runs += 1
    const row = bySkill.get(receipt.skill) ?? { skill: receipt.skill, runs: 0, ok: 0, error_kinds: {}, problem_kinds: {}, missing_inputs: {} }
    row.runs += 1
    if (receipt.ok) row.ok += 1
    bump(row.error_kinds, receipt.error_kind)
    for (const kind of receipt.problem_kinds ?? []) bump(row.problem_kinds, kind)
    for (const key of receipt.missing ?? []) bump(row.missing_inputs, key)
    bySkill.set(receipt.skill, row)
  }
  return {
    schema: 'longpi-stats/1',
    week: isoWeek(now),
    since: since.toISOString(),
    until: now.toISOString(),
    runs,
    skills: [...bySkill.values()].sort((a, b) => b.runs - a.runs || a.skill.localeCompare(b.skill)),
  }
}

export function writeStats(dataDir: string, now = new Date()): string {
  const stats = buildStats(dataDir, 7, now)
  mkdirSync(dataDir, { recursive: true, mode: 0o700 })
  const path = join(dataDir, `stats-${stats.week}.json`)
  writeFileSync(path, `${JSON.stringify(stats, null, 2)}\n`, { mode: 0o600 })
  return path
}
