// M9 seams (AA §3.6).

import type { NumberRef } from '../contracts/common.ts'
import { formatNumber as formatRef } from './format.ts'
import { modelRangeNote as rangeNote } from './model-range.ts'

export { formatPercent, roundPercentPoints } from './format.ts'
export { PHENOAGE_WINDOW_DAYS, DEFAULT_RETEST_DAYS, labToken, compareGate, siblingNames, codedRecords, bodyAgeWording, judgeSeries, missedPlanChanges } from './comparability.ts'
export type { CompareGate, BodyAgeWording, SeriesJudgement, MissedPlanInput } from './comparability.ts'

export function formatNumber(ref: Pick<NumberRef, 'value' | 'unit'>): string {
  return formatRef(ref)
}

export function modelRangeNote(model: string, age: number | null): string | null {
  return rangeNote(model, age)
}
