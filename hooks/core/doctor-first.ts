// Whether the record must go to a doctor before any lifestyle plan: the
// critical values and red-cell pattern in plan-safety.ts, read from the
// latest value of every indicator plus the earlier checkups of haemoglobin
// and MCV. Computed once per tracking build; the plan draft, the overview's
// next step and read_personal_situation all read the same result.

import { addDays } from './interventions.ts'
import { loadSeries, recordReadable, type RecordSnapshot } from './records.ts'
import { clinicalStop, medicationClasses, trendRow, type PanelPoint, type StopResult } from './plan-safety.ts'
import { currentMedications, type IndicatorRow } from './situation.ts'
import { parseNumber } from './units.ts'
import type { Config } from './config.ts'

export const NO_STOP: StopResult = { stop: false, sentence_zh: '', title_zh: '', hits: [] }

/** Ten years back: the red-cell trend can span many checkups. */
const LOOKBACK_DAYS = 10 * 365

export function panelPoints(indicators: readonly IndicatorRow[]): PanelPoint[] {
  const out: PanelPoint[] = []
  for (const row of indicators) {
    const value = parseNumber(row.value)
    if (value == null) continue
    out.push({ name: row.name, ...(row.label ? { label: row.label } : {}), ...(row.loinc ? { loinc: row.loinc } : {}), value, unit: row.unit, date: row.date || row.last_date || '' })
  }
  return out
}

/** Diabetes a doctor knows about: the person's own yes, or a current glucose-lowering medicine. */
export function diabetesKnown(records: Pick<RecordSnapshot, 'profile' | 'medications'>): boolean {
  return medicationClasses(currentMedications(records.medications), { diabetes: records.profile.risk.diabetes === true }).diabetesKnown
}

export async function buildDoctorFirst(context: { config: Config; records: RecordSnapshot; today: string }): Promise<StopResult> {
  const { records } = context
  if (!recordReadable(records)) return NO_STOP
  const latest = panelPoints(records.indicators.filter((row) => row.source !== 'self'))
  const trendNames = [...new Set(records.indicators.filter((row) => row.source !== 'self' && trendRow(row)).map((row) => row.name))]
  const history: PanelPoint[] = []
  if (trendNames.length > 0) {
    try {
      const read = await loadSeries(context.config, trendNames, { start: addDays(context.today, -LOOKBACK_DAYS), end: context.today, resolution: 'raw' })
      for (const [name, series] of Object.entries(read.series)) {
        const row = records.indicators.find((item) => item.name === name)
        for (const point of series.points) {
          history.push({
            name,
            ...(row?.label ?? series.label ? { label: row?.label ?? series.label } : {}),
            ...(row?.loinc ?? series.loinc ? { loinc: row?.loinc ?? series.loinc } : {}),
            value: point.value,
            unit: point.unit || series.unit,
            date: point.date,
          })
        }
      }
    } catch {
      // the latest values still decide; only the trend is missing
    }
  }
  return clinicalStop({ sex: records.profile.sex, diabetesKnown: diabetesKnown(records), points: [...latest, ...history] })
}
