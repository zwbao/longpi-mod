// Reference tables from longevity-skills/data: within-person biological
// variation (to tell a real change from noise) and average intervention
// effects from trials (to say whether a change is in line with them). Both are
// medical constants kept with their sources in the skills repository; the
// harness only reads them.

import { existsSync, readFileSync } from '../sys/fs.ts'
import { join } from '../sys/path.ts'
import { foldName, nameVariants } from './units.ts'

export interface BiovarMarker {
  key: string
  label_zh: string
  loinc: string[]
  device_codes?: string[]
  aliases?: string[]
  unit: string
  cvi_pct: number
  cvi_ci_pct?: [number, number]
  cva_pct?: number | null
  log_normal: boolean
  better: 'lower' | 'higher' | 'range' | 'none'
  min_retest_days?: number | null
  retest_note_zh?: string
  cvi_source: { title: string; url: string; doi?: string; note?: string }
  retest_source?: { title: string; url: string; doi?: string }
  /** Factors that convert another unit into this row's unit (mg/dL → mmol/L for triglycerides). */
  convert?: Record<string, number>
  /** Compare means over this many days, because the CVI was measured on such means (home blood pressure). */
  average_days?: number
  population?: string
  /** What the reader should know about this row's band (a very small CVI, results excluded from the study). */
  caveat_zh?: string
  verified: boolean
}

export interface Biovar {
  z: number
  default_cva_rule_zh: string
  markers: BiovarMarker[]
}

export interface EffectRow {
  id: string
  intervention: string
  intervention_zh: string
  keywords?: string[]
  category: string
  marker: string
  marker_zh: string
  marker_key?: string
  loinc?: string[]
  effect: { kind: 'mean_difference' | 'percent_change' | 'per_unit' | 'standardized' | 'rate'; value: number; unit: string; ci?: [number, number]; per?: string }
  duration_weeks?: number | null
  population: string
  design: string
  trials?: number | null
  participants?: number | null
  doi: string
  quote: string
  note_zh?: string
  verified: boolean
  /** person, or quote_match: a script matched the quote against the source text and found every number in it. */
  verified_by?: 'person' | 'quote_match'
}

export interface Reference {
  biovar: Biovar
  effects: EffectRow[]
  error?: string
}

const EMPTY: Biovar = { z: 1.96, default_cva_rule_zh: '', markers: [] }
/** EFLM desirable analytical imprecision: CVA at most half of CVI (Fraser). Used when the source gives no CVA. */
export const DEFAULT_CVA_FACTOR = 0.5

/**
 * Codes Mirobody assigns that name the same measurement as a variation row but are not in its list.
 * 22748-8 is LDL cholesterol in mmol/L; without it the changes card never sees that series.
 */
const EXTRA_LOINC: Record<string, readonly string[]> = {
  ldl: ['22748-8', '2089-1'],
}

function withExtraCodes(markers: BiovarMarker[]): BiovarMarker[] {
  return markers.map((marker) => {
    const extra = EXTRA_LOINC[marker.key]
    if (!extra) return marker
    const missing = extra.filter((code) => !marker.loinc.includes(code))
    return missing.length > 0 ? { ...marker, loinc: [...marker.loinc, ...missing] } : marker
  })
}

let memo: { home: string; stamp: string; value: Reference } | null = null

function stampOf(path: string): string {
  try {
    return existsSync(path) ? String(readFileSync(path).length) : '-'
  } catch {
    return '-'
  }
}

export function loadReference(skillsHome: string): Reference {
  const biovarPath = join(skillsHome, 'data', 'biological_variation.json')
  const effectsPath = join(skillsHome, 'data', 'effects.jsonl')
  const stamp = `${stampOf(biovarPath)}:${stampOf(effectsPath)}`
  if (memo && memo.home === skillsHome && memo.stamp === stamp) return memo.value
  const value: Reference = { biovar: EMPTY, effects: [] }
  try {
    if (existsSync(biovarPath)) {
      const parsed = JSON.parse(readFileSync(biovarPath, 'utf8')) as Partial<Biovar> & { schema?: string }
      if (parsed.schema === 'longevity-biovar/1' && Array.isArray(parsed.markers)) {
        value.biovar = { z: typeof parsed.z === 'number' ? parsed.z : 1.96, default_cva_rule_zh: parsed.default_cva_rule_zh ?? '', markers: withExtraCodes(parsed.markers) }
      }
    }
    if (existsSync(effectsPath)) {
      for (const line of readFileSync(effectsPath, 'utf8').split(/\r?\n/)) {
        if (!line.trim()) continue
        try {
          const row = JSON.parse(line) as EffectRow
          if (row && row.id && row.effect) value.effects.push(row)
        } catch {
          /* skip a torn line */
        }
      }
    }
  } catch (error) {
    value.error = error instanceof Error ? error.message : 'reference tables unreadable'
  }
  memo = { home: skillsHome, stamp, value }
  return value
}

/** The biological-variation row for one indicator, by LOINC code, device code, or name. */
export function markerFor(biovar: Biovar, indicator: { name?: string; loinc?: string; label?: string }): BiovarMarker | null {
  if (indicator.loinc) {
    const hit = biovar.markers.find((row) => row.loinc.includes(indicator.loinc as string))
    if (hit) return hit
  }
  if (indicator.name) {
    const hit = biovar.markers.find((row) => (row.device_codes ?? []).includes(indicator.name as string))
    if (hit) return hit
  }
  const wanted = new Set([indicator.name, indicator.label].filter(Boolean).flatMap((name) => nameVariants(name as string)))
  if (wanted.size === 0) return null
  for (const row of biovar.markers) {
    const names = [row.key, row.label_zh, ...(row.aliases ?? [])].map((name) => foldName(name)).filter(Boolean)
    if (names.some((name) => wanted.has(name))) return row
  }
  return null
}

/**
 * Words people use for several markers at once, and the markers they mean. A verdict, a chart or a draft
 * priority is about one measured marker, so an item aimed at 血压 is judged on 收缩压 and on 舒张压.
 */
const MARKER_GROUPS: ReadonlyArray<{ names: readonly string[]; keys: readonly string[] }> = [
  { names: ['血压', '家庭血压', '家测血压', '居家血压', '自测血压', 'blood pressure', 'home blood pressure', 'bp'], keys: ['sbp', 'dbp'] },
]

/** The marker keys a word for several markers names (血压 → sbp, dbp); empty for one marker or anything else. */
export function markerGroupKeys(biovar: Biovar, name: string): string[] {
  if (markerFor(biovar, { name, label: name })) return []
  const folded = foldName(name)
  const group = MARKER_GROUPS.find((row) => row.names.some((word) => foldName(word) === folded))
  return group ? group.keys.filter((key) => biovar.markers.some((row) => row.key === key)) : []
}

/** The names with each word for several markers replaced by those markers' names, in order and once each. */
export function expandMarkerNames(biovar: Biovar, names: readonly string[]): string[] {
  const out: string[] = []
  for (const name of names) {
    const group = markerGroupKeys(biovar, name).map((key) => biovar.markers.find((row) => row.key === key)?.label_zh ?? key)
    for (const one of group.length > 0 ? group : [name]) if (!out.includes(one)) out.push(one)
  }
  return out
}

/**
 * markerFor for a row that carries a LOINC code. A code the matched row does not list is a different
 * measurement, often another specimen (urine creatinine is 2161-8, serum 2160-0; a report may print it as
 * 肌酐(尿) or 尿肌酐(Cr)), so the name match only stands for a row with no codes of its own.
 */
export function checkupMarkerFor(biovar: Biovar, indicator: { name?: string; loinc?: string; label?: string }): BiovarMarker | null {
  const marker = markerFor(biovar, indicator)
  if (!marker || !indicator.loinc || marker.loinc.includes(indicator.loinc)) return marker
  if (indicator.name && (marker.device_codes ?? []).includes(indicator.name)) return marker
  return marker.loinc.length === 0 ? marker : null
}

/**
 * Reference change value as fractions of the first result: a later result
 * outside [down, up] is unlikely (at z) to be noise alone. Symmetric for
 * normally distributed markers; asymmetric (log-normal) for right-skewed ones
 * such as CRP and triglycerides.
 */
export function rcvBand(marker: BiovarMarker, z: number): { up: number; down: number; cva_pct: number; cva_default: boolean } {
  const cvi = marker.cvi_pct / 100
  const cvaDefault = marker.cva_pct == null
  const cvaPct = cvaDefault ? marker.cvi_pct * DEFAULT_CVA_FACTOR : (marker.cva_pct as number)
  const cva = cvaPct / 100
  if (marker.log_normal) {
    const sigma = Math.sqrt(Math.log(1 + cvi * cvi) + Math.log(1 + cva * cva))
    return { up: Math.exp(z * Math.SQRT2 * sigma) - 1, down: Math.exp(-z * Math.SQRT2 * sigma) - 1, cva_pct: cvaPct, cva_default: cvaDefault }
  }
  const band = Math.SQRT2 * z * Math.sqrt(cvi * cvi + cva * cva)
  return { up: band, down: -band, cva_pct: cvaPct, cva_default: cvaDefault }
}

/** Trial effects on one marker for an intervention described in a person's plan. */
export function effectsFor(
  effects: readonly EffectRow[],
  item: { category: string; title: string; detail?: string },
  marker: BiovarMarker | null,
  loinc?: string,
): EffectRow[] {
  const text = foldName(`${item.title} ${item.detail ?? ''}`)
  return effects.filter((row) => {
    const sameMarker = (marker && row.marker_key === marker.key) || (loinc && (row.loinc ?? []).includes(loinc))
    if (!sameMarker) return false
    const words = [row.intervention_zh, row.intervention, ...(row.keywords ?? [])].map((word) => foldName(word)).filter((word) => word.length >= 2)
    return words.some((word) => text.includes(word))
  })
}
