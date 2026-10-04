// Structured outcomes from something the person said. The quote is kept; the model does not invent the number.

import { join } from '../../sys/path.ts'
import type { IsoTime } from '../contracts/common.ts'
import { appendJsonl, readJsonl } from '../core/store.ts'

export type WalkArm = 'morning' | 'after_dinner'

export interface Outcome {
  id: string
  at: IsoTime
  day: string
  study_id: string | null
  arm: WalkArm | null
  marker: string | null
  value: number | null
  unit: string | null
  minutes: number | null
  quote_zh: string
}

const MORNING = /早晨|早上|晨起|空腹走|晨走/
const AFTER = /晚饭后|餐后|晚饭|晚餐后|饭后/
const GLUCOSE = /血糖\s*([0-9]+(?:\.[0-9]+)?)\s*(mmol\/L|毫摩)?/
const MINUTES = /([0-9]{1,3})\s*分钟/

export function outcomesPath(dataDir: string): string {
  return join(dataDir, 'science', 'outcomes.jsonl')
}

export function readOutcomes(dataDir: string): Outcome[] {
  return readJsonl<Outcome>(outcomesPath(dataDir), (raw) => {
    const row = raw as Outcome
    return row && typeof row.quote_zh === 'string' ? row : null
  })
}

/** Pull a walk arm, a glucose number and a duration out of one Chinese sentence. */
export function extractOutcome(text: string, day: string): Omit<Outcome, 'id' | 'at' | 'study_id'> | null {
  const quote = text.trim().slice(0, 200)
  if (!quote) return null
  let arm: WalkArm | null = null
  if (AFTER.test(quote)) arm = 'after_dinner'
  else if (MORNING.test(quote)) arm = 'morning'
  const glucose = GLUCOSE.exec(quote)
  const minutes = MINUTES.exec(quote)
  const value = glucose ? Number(glucose[1]) : null
  if (arm == null && value == null && !minutes) return null
  return {
    day,
    arm,
    marker: value != null ? 'glucose' : null,
    value: value != null && Number.isFinite(value) ? value : null,
    unit: value != null ? 'mmol/L' : null,
    minutes: minutes ? Number(minutes[1]) : null,
    quote_zh: quote,
  }
}

export function logOutcome(dataDir: string, text: string, day: string, study_id: string | null, id: string, at: IsoTime): Outcome | null {
  const extracted = extractOutcome(text, day)
  if (!extracted) return null
  const row: Outcome = { id, at, study_id, ...extracted }
  appendJsonl(outcomesPath(dataDir), row)
  return row
}

export function armsFromOutcomes(rows: readonly Outcome[]): Record<string, number[]> {
  const out: Record<string, number[]> = { morning: [], after_dinner: [] }
  for (const row of rows) {
    if (row.marker !== 'glucose' || row.value == null || !row.arm) continue
    out[row.arm]?.push(row.value)
  }
  return out
}
