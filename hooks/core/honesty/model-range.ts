// Age windows a model was derived on. Outside the window the number is still
// shown, with this sentence, on the page and in the tool the chat reads.

import { formatNumber } from './format.ts'

interface Range {
  low: number
  high: number
  name: string
}

/** Keys the risk card, the skill name and the short model id all hit. */
const RANGES: Record<string, Range> = {
  'china-par': { low: 35, high: 74, name: 'China-PAR' },
  china_par: { low: 35, high: 74, name: 'China-PAR' },
  'china-par-ascvd-risk': { low: 35, high: 74, name: 'China-PAR' },
}

/**
 * A sentence when `age` is outside the model's derivation range, or null when
 * the age is inside it (or the model has no published range here).
 */
export function modelRangeNote(model: string, age: number | null): string | null {
  if (age == null || !Number.isFinite(age)) return null
  const row = RANGES[model.trim().toLowerCase()]
  if (!row) return null
  if (age >= row.low && age <= row.high) return null
  const years = formatNumber({ value: age, unit: '岁' })
  return `${row.name} 由 ${row.low}–${row.high} 岁人群推导，${years}在这个范围之外，结果更不确定。`
}
