// Triage findings (M1): the values clinicalStop (plan-safety.ts) flags, grouped by the patterns in
// data/triage/patterns.json into findings a person can take to one doctor: where to go, what to ask,
// what to request. Rules only; no model decides a finding.

import { existsSync, readFileSync } from '../../sys/fs.ts'
import { fileURLToPath, libUrl } from '../../sys/url.ts'
import type { NumberRef } from '../contracts/common.ts'
import type { CareItem } from '../contracts/memory.ts'
import type { TriageFinding } from '../contracts/triage.ts'
import type { StopHit, StopResult } from '../plan-safety.ts'

export interface Pattern {
  id: string
  rule: string
  keys: Array<StopHit['key']>
  priority: TriageFinding['priority']
  label_zh: string
  department_zh: string
  tests_zh: string[]
  questions_zh: string[]
  trend_markers: string[]
}

const BUILT_IN: Pattern[] = [
  { id: 'red-cell', rule: 'triage.pattern.red_cell', keys: ['hgb', 'mcv', 'rdw', 'ferritin'], priority: 'must_surface', label_zh: '红细胞和铁', department_zh: '全科或血液科', tests_zh: ['复查血常规（含网织红细胞计数）', '铁蛋白、血清铁、总铁结合力和转铁蛋白饱和度'], questions_zh: ['最可能是什么原因？'], trend_markers: ['hb', 'mcv', 'ferritin'] },
  { id: 'undiagnosed-diabetes', rule: 'triage.critical.undiagnosed_diabetes', keys: ['glucose', 'hba1c'], priority: 'must_surface', label_zh: '血糖', department_zh: '内分泌科', tests_zh: ['复查空腹血糖和糖化血红蛋白'], questions_zh: ['是否已经达到糖尿病的诊断标准？'], trend_markers: ['glucose', 'hba1c'] },
  { id: 'ldl-very-high', rule: 'triage.critical.ldl_very_high', keys: ['ldl'], priority: 'must_surface', label_zh: '低密度脂蛋白胆固醇', department_zh: '心内科或内分泌科', tests_zh: ['复查血脂四项'], questions_zh: ['需要用药吗？'], trend_markers: ['ldl'] },
  { id: 'sbp-very-high', rule: 'triage.critical.sbp_very_high', keys: ['sbp'], priority: 'must_surface', label_zh: '血压', department_zh: '心内科（尽快）', tests_zh: ['诊室和家庭血压复测'], questions_zh: ['需要马上用药吗？'], trend_markers: ['sbp'] },
]

let cached: Pattern[] | null = null

/** The pattern table: data/triage/patterns.json beside the package (lib/ or src/triage/), else the built-in copy. */
export function patterns(): Pattern[] {
  if (cached) return cached
  for (const rel of ['../data/triage/patterns.json', '../../data/triage/patterns.json']) {
    try {
      const path = fileURLToPath(new URL(rel, libUrl()))
      if (!existsSync(path)) continue
      const raw = JSON.parse(readFileSync(path, 'utf8')) as { patterns?: Pattern[] }
      if (Array.isArray(raw.patterns) && raw.patterns.length > 0) {
        cached = raw.patterns
        return cached
      }
    } catch {
      // try the next place
    }
  }
  cached = BUILT_IN
  return cached
}

export function findingId(pattern: Pick<Pattern, 'id'>): string {
  return `finding-${pattern.id}`
}

function fmt(value: number): string {
  return String(Number(value.toFixed(2)))
}

export function hitRefs(hit: StopHit): NumberRef[] {
  if (hit.value == null) return []
  const unit = hit.unit ?? ''
  const label = hit.label_zh ?? hit.key
  const text = (value: number) => (unit === '%' ? `${fmt(value)}%` : `${fmt(value)} ${unit}`.trim())
  const refs: NumberRef[] = [{ key: `${hit.key}@${hit.date ?? 'latest'}`, label_zh: label, value: hit.value, unit, date: hit.date ?? null, source: 'record', text: text(hit.value) }]
  for (const point of hit.fall ?? []) {
    const key = `${hit.key}@${point.date}`
    if (!refs.some((row) => row.key === key)) refs.push({ key, label_zh: label, value: point.value, unit, date: point.date, source: 'record', text: text(point.value) })
  }
  return refs
}

/** The finding's status from the latest care item about it (memory). */
export function statusFrom(care: CareItem | null): TriageFinding['status'] {
  if (!care) return 'open'
  if (care.care_status === 'visited') return 'visited'
  if (care.care_status === 'advised' || care.care_status === 'booked') return 'advised'
  return 'open'
}

/** One finding per pattern that has at least one hit, in the table's order. */
export function findingsFrom(stop: StopResult, today: string, careOf: (findingId: string) => CareItem | null = () => null): TriageFinding[] {
  if (!stop.stop && stop.hits.length === 0) return []
  const out: TriageFinding[] = []
  for (const pattern of patterns()) {
    const hits = stop.hits.filter((hit) => pattern.keys.includes(hit.key))
    if (hits.length === 0) continue
    const id = findingId(pattern)
    const care = careOf(id)
    const dates = hits.map((hit) => hit.date ?? '').filter(Boolean).sort()
    out.push({
      id,
      rule: pattern.rule,
      priority: pattern.priority,
      kind: hits.some((hit) => (hit.fall?.length ?? 0) > 0) ? 'progressive_pattern' : hits.some((hit) => hit.low) ? 'below_range' : 'critical_value',
      title_zh: hits.map((hit) => hit.short_zh).join('，'),
      text_zh: hits.map((hit) => hit.text_zh).join('；'),
      numbers: hits.flatMap(hitRefs),
      department_zh: pattern.department_zh,
      tests_to_request_zh: [...pattern.tests_zh],
      questions_zh: [...pattern.questions_zh],
      status: statusFrom(care),
      opened: dates.at(-1) ?? today,
      ...(care ? { care_item_id: care.id } : {}),
    })
  }
  return out
}

/** A short line for the status card: the values with their fall, then who to see. */
export function statusLine(finding: TriageFinding, hits: readonly StopHit[]): string {
  const order = ['hgb', 'ferritin', 'mcv', 'rdw', 'glucose', 'hba1c', 'ldl', 'sbp']
  const mine = hits.filter((hit) => finding.numbers.some((ref) => ref.key.startsWith(`${hit.key}@`)))
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)).slice(0, 3)
  const parts = mine.map((hit) => {
    const unit = hit.unit === '%' ? '%' : hit.unit ? ` ${hit.unit}` : ''
    const values = hit.fall && hit.fall.length >= 2 ? hit.fall.map((row) => fmt(row.value)).join('→') : fmt(hit.value ?? 0)
    const qual = hit.low ? '偏低' : hit.fall ? '在下降' : '偏高'
    return `${hit.label_zh ?? hit.key} ${values}${unit} ${qual}`
  })
  return `${parts.join('，')}——请先去看医生（${finding.department_zh}）`
}
