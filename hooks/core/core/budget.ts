// The cost ledger and daily caps (AA §2.10, D8): every LongPi model call is a line in dataDir/usage.jsonl;
// over a cap every profile uses its deterministic fallback, silently (shown only on /api/longpi/usage).

import { join } from '../../sys/path.ts'
import type { AgentRunRecord } from '../contracts/agents.ts'
import { BUDGET_DEFAULTS, type Config } from '../config.ts'
import { isoDay } from '../interventions.ts'
import { appendJsonl, readJsonl } from './store.ts'

export interface Budget {
  remaining(): { input: number; output: number; spawns: number }
  record(run: AgentRunRecord): void
  /** Why a call may not run now, or null. */
  blocked(): string | null
  today(): { input: number; output: number; calls: number; spawns: number; by_profile: Record<string, { calls: number; input: number; output: number; fallback: number }> }
}

export function createBudget(config: () => Partial<Config>, dataDir: () => string): Budget {
  const path = () => join(dataDir(), 'usage.jsonl')
  const rows = () => readJsonl<AgentRunRecord & { day?: string }>(path()).filter((row) => (row.day ?? String(row.at ?? '').slice(0, 10)) === isoDay())
  const caps = () => ({ ...BUDGET_DEFAULTS, ...(config().budget ?? {}) })
  const today = () => {
    const out = { input: 0, output: 0, calls: 0, spawns: 0, by_profile: {} as Record<string, { calls: number; input: number; output: number; fallback: number }> }
    for (const row of rows()) {
      const input = row.usage?.inputTokens ?? 0
      const output = row.usage?.outputTokens ?? 0
      out.input += input
      out.output += output
      out.calls += 1
      if (row.mode === 'in_turn') out.spawns += 1
      const mine = out.by_profile[row.profile] ??= { calls: 0, input: 0, output: 0, fallback: 0 }
      mine.calls += 1
      mine.input += input
      mine.output += output
      if (row.source === 'fallback') mine.fallback += 1
    }
    return out
  }
  return {
    remaining() {
      const used = today()
      const cap = caps()
      return { input: cap.dailyInputTokens - used.input, output: cap.dailyOutputTokens - used.output, spawns: cap.maxSpawnsPerDay - used.spawns }
    },
    record(run) {
      try {
        appendJsonl(path(), { ...run, day: isoDay() })
      } catch {
        // the call happened; only the ledger line is missing
      }
    },
    blocked() {
      const left = this.remaining()
      if (left.input <= 0) return 'daily input budget used up'
      if (left.output <= 0) return 'daily output budget used up'
      return null
    },
    today,
  }
}
