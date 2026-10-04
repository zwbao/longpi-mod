// Turn a persona file, a checkup list or logged outcomes into marker series. Genetics are dropped.

import type { ConditionFlag, DrugClass } from '../contracts/memory.ts'
import type { Point } from './stats.ts'

export interface MarkerSpec {
  key: string
  label_zh: string
  unit: string
  /** Published within-person CV, percent, from longevity-skills biological_variation.json (EuBIVAS and the rows named there). */
  cvi_pct: number
  test: (name: string) => boolean
  loinc?: string[]
}

export const MARKERS: readonly MarkerSpec[] = [
  { key: 'glucose', label_zh: '空腹血糖', unit: 'mmol/L', cvi_pct: 4.7, loinc: ['14771-0', '1558-6', '2345-7'], test: (name) => name === '空腹血糖' || name === '空腹葡萄糖' },
  { key: 'hba1c', label_zh: '糖化血红蛋白', unit: '%', cvi_pct: 1.2, loinc: ['4548-4'], test: (name) => name.includes('糖化血红蛋白') },
  { key: 'hb', label_zh: '血红蛋白', unit: 'g/L', cvi_pct: 2.71, loinc: ['718-7'], test: (name) => name === '血红蛋白' },
  { key: 'tc', label_zh: '总胆固醇', unit: 'mmol/L', cvi_pct: 5.18, test: (name) => name === '总胆固醇' },
  { key: 'ldl', label_zh: '低密度脂蛋白胆固醇', unit: 'mmol/L', cvi_pct: 8.46, test: (name) => name.includes('低密度脂蛋白') },
  { key: 'hdl', label_zh: '高密度脂蛋白胆固醇', unit: 'mmol/L', cvi_pct: 5.67, test: (name) => name.includes('高密度脂蛋白') },
  { key: 'tg', label_zh: '甘油三酯', unit: 'mmol/L', cvi_pct: 19.8, test: (name) => name === '甘油三酯' },
  { key: 'creatinine', label_zh: '肌酐', unit: 'µmol/L', cvi_pct: 4.4, loinc: ['2160-0'], test: (name) => name === '肌酐' },
  { key: 'sbp', label_zh: '收缩压', unit: 'mmHg', cvi_pct: 4.2, loinc: ['8480-6'], test: (name) => name === '收缩压' },
  { key: 'wbc', label_zh: '白细胞计数', unit: '10^9/L', cvi_pct: 10.01, test: (name) => name === '白细胞计数' || name === '白细胞' },
  { key: 'albumin', label_zh: '白蛋白', unit: 'g/L', cvi_pct: 2.5, test: (name) => name === '白蛋白' },
]

export function markerByKey(key: string): MarkerSpec | undefined {
  return MARKERS.find((row) => row.key === key)
}

export interface PersonaNode {
  id: string
  age: number | null
  sex: 'female' | 'male' | 'other' | 'unknown'
  conditions: ConditionFlag[]
  drug_classes: DrugClass[]
  markers: Record<string, Point[]>
  wearable: Array<{ day: string; steps: number | null; resting_hr: number | null }>
}

interface Item { name_zh?: string; loinc?: string; value?: unknown; unit?: string }

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function convert(key: string, value: number, unit: string): number | null {
  const u = unit.replace(/\s/g, '')
  if (key === 'glucose' && /mg\/dL/i.test(u)) return value * 0.0555
  if (key === 'hb' && /g\/dL/i.test(u)) return value * 10
  if (key === 'creatinine' && /mg\/dL/i.test(u)) return value * 88.4
  if (value <= 0 && key !== 'mean_diff') return null
  return value
}

function matchItem(item: Item): string | null {
  const loinc = item.loinc ?? ''
  if (loinc) {
    const byCode = MARKERS.find((row) => row.loinc?.includes(loinc))
    if (byCode) return byCode.key
  }
  const name = (item.name_zh ?? '').trim()
  if (!name || /纸质|尿糖|基因|snp/i.test(name)) return null
  return MARKERS.find((row) => row.test(name))?.key ?? null
}

export function pointsFromCheckups(checkups: unknown): Record<string, Point[]> {
  const buckets = new Map<string, Map<string, number>>()
  if (!Array.isArray(checkups)) return {}
  for (const checkup of checkups) {
    const day = String((checkup as { date?: string }).date ?? '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
    const items = (checkup as { items?: Item[] }).items ?? []
    for (const item of items) {
      const key = matchItem(item)
      const raw = asNumber(item.value)
      if (!key || raw == null) continue
      const value = convert(key, raw, item.unit ?? '')
      if (value == null || !Number.isFinite(value) || value <= 0) continue
      const days = buckets.get(key) ?? new Map<string, number>()
      if (!days.has(day)) days.set(day, value)
      buckets.set(key, days)
    }
  }
  const out: Record<string, Point[]> = {}
  for (const [key, days] of buckets) {
    out[key] = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ day, value }))
  }
  return out
}

export function ageOn(birth: string, today = '2026-09-28'): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null
  let age = Number(today.slice(0, 4)) - Number(birth.slice(0, 4))
  if (today.slice(5) < birth.slice(5)) age -= 1
  return age
}

function sexOf(value: unknown): PersonaNode['sex'] {
  const text = String(value ?? '').toLowerCase()
  if (text === 'm' || text === 'male' || text === '男') return 'male'
  if (text === 'f' || text === 'female' || text === '女') return 'female'
  if (text === 'other') return 'other'
  return 'unknown'
}

function flagsOf(doc: Record<string, unknown>): { conditions: ConditionFlag[]; drug_classes: DrugClass[] } {
  const conditions: ConditionFlag[] = []
  const drugs: DrugClass[] = []
  const condText = JSON.stringify(doc.conditions ?? [])
  const meds = doc.medications ?? (doc.persona as { medications?: unknown } | undefined)?.medications ?? []
  const medText = JSON.stringify(meds)
  if (/孕/.test(condText)) conditions.push('pregnancy')
  if (/未成年|儿童/.test(condText)) conditions.push('minor')
  if (/胰岛素|\binsulin\b/i.test(medText)) drugs.push('insulin')
  if (/格列(?!净)|磺脲|消渴丸/.test(medText)) drugs.push('sulfonylurea')
  if (/列净|gliflozin/i.test(medText)) drugs.push('sglt2i')
  return { conditions, drug_classes: drugs }
}

export function nodeFromPersona(doc: Record<string, unknown>, today = '2026-09-28'): PersonaNode {
  const flags = flagsOf(doc)
  const daily = ((doc.wearables as { daily?: Array<Record<string, unknown>> } | undefined)?.daily ?? []).slice(-180)
  return {
    id: String(doc.person_id ?? 'person'),
    age: ageOn(String(doc.birth_date ?? ''), today),
    sex: sexOf(doc.sex),
    conditions: flags.conditions,
    drug_classes: flags.drug_classes,
    markers: pointsFromCheckups(doc.checkups),
    wearable: daily.map((row) => ({
      day: String(row.date ?? '').slice(0, 10),
      steps: typeof row.steps === 'number' ? row.steps : null,
      resting_hr: typeof row.resting_hr === 'number' ? row.resting_hr : null,
    })).filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.day)),
  }
}

/** Alternating checkup values, so a noise study has two arms when the file has no timed walks. */
export function scheduleArms(points: readonly Point[]): { morning: number[]; after_dinner: number[] } {
  const morning: number[] = []
  const after_dinner: number[] = []
  points.forEach((point, index) => {
    (index % 2 === 0 ? morning : after_dinner).push(point.value)
  })
  return { morning, after_dinner }
}
