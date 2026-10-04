// One person's privacy budget across studies. Basic composition: epsilons add.
// A release that would pass the cap is refused. Withdrawing does not refund what was already released,
// and it does not remove that person from a sum that has already been published.

import { join } from '../../sys/path.ts'
import { readJson, writeJsonAtomic } from '../core/store.ts'

export const DEFAULT_EPSILON_CAP = 10

export const RELEASE_STAYS_ZH = '已发出的合计无法收回。退出后将停止后续发出，并删除尚未发出的部分。'

export interface BudgetEntry {
  study_id: string
  query: string
  epsilon: number
  delta: number
  at: string
  released: true
}

interface Ledger {
  cap: number
  closed: string[]
  entries: BudgetEntry[]
}

function pathOf(dataDir: string): string {
  return join(dataDir, 'science', 'budget.json')
}

function empty(cap = DEFAULT_EPSILON_CAP): Ledger {
  return { cap, closed: [], entries: [] }
}

export function readBudget(dataDir: string): Ledger {
  return readJson<Ledger>(pathOf(dataDir), (raw) => {
    const row = raw as Partial<Ledger>
    if (!row || typeof row !== 'object') return empty()
    return {
      cap: typeof row.cap === 'number' && row.cap > 0 ? row.cap : DEFAULT_EPSILON_CAP,
      closed: Array.isArray(row.closed) ? row.closed.filter((id) => typeof id === 'string') : [],
      entries: Array.isArray(row.entries) ? row.entries.filter((item) => item && typeof item.epsilon === 'number' && item.released === true) : [],
    }
  }, () => empty())
}

export function spentEpsilon(dataDir: string): number {
  return readBudget(dataDir).entries.reduce((sum, row) => sum + row.epsilon, 0)
}

export function tryRelease(dataDir: string, input: {
  study_id: string
  query: string
  epsilon: number
  delta?: number
  cap?: number
  at?: string
  /** Check the cap without writing a charge. */
  peek?: boolean
}): { ok: true; spent: number; cap: number; statement_zh: string } | { ok: false; reason_zh: string; spent: number; cap: number; statement_zh: string } {
  const ledger = readBudget(dataDir)
  const cap = input.cap ?? ledger.cap
  ledger.cap = cap
  const spent = ledger.entries.reduce((sum, row) => sum + row.epsilon, 0)
  const statement_zh = RELEASE_STAYS_ZH
  if (!(input.epsilon > 0)) return { ok: false, reason_zh: 'epsilon 必须大于 0', spent, cap, statement_zh }
  if (ledger.closed.includes(input.study_id)) {
    return { ok: false, reason_zh: `已经退出「${input.study_id}」。${statement_zh}`, spent, cap, statement_zh }
  }
  const prior = ledger.entries.find((row) => row.study_id === input.study_id && row.query === input.query)
  if (prior) return { ok: true, spent, cap, statement_zh }
  if (spent + input.epsilon > cap + 1e-12) {
    return {
      ok: false,
      reason_zh: `隐私预算不够。已用 ε=${roundEps(spent)}，这一次 ε=${roundEps(input.epsilon)}，上限 ε=${roundEps(cap)}。`,
      spent,
      cap,
      statement_zh,
    }
  }
  if (input.peek) return { ok: true, spent, cap, statement_zh }
  ledger.entries.push({
    study_id: input.study_id,
    query: input.query,
    epsilon: input.epsilon,
    delta: input.delta ?? 0,
    at: input.at ?? new Date().toISOString(),
    released: true,
  })
  writeJsonAtomic(pathOf(dataDir), ledger)
  return { ok: true, spent: spent + input.epsilon, cap, statement_zh }
}

/** Future releases for this study stop. Entries already charged stay charged. */
export function closeStudyBudget(dataDir: string, studyId: string): void {
  const ledger = readBudget(dataDir)
  if (!ledger.closed.includes(studyId)) ledger.closed.push(studyId)
  writeJsonAtomic(pathOf(dataDir), ledger)
}

function roundEps(value: number): string {
  return String(Number(value.toFixed(4)))
}
