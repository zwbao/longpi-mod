// What the Codex takes from a journey build: safety facts, what the plan and next step are about, the latest
// checkup and the results a retest pack shows. Values stay in the holder's own LongPi home.

import type { IsoDay } from '../contracts/common.ts'
import type { FactPack } from '../contracts/factpack.ts'
import type { TriageFinding } from '../contracts/triage.ts'
import { drugClassesOf } from '../core/memory.ts'
import type { Profile } from '../profile.ts'
import type { RecordSnapshot } from '../records.ts'
import type { Tracking } from '../tracking.ts'
import { careItems } from '../triage/care.ts'
import type { CodexContext } from './state.ts'

const LDL = /LDL|低密度脂蛋白/i
const DEVICE_NAME = /^[a-z][A-Za-z]+$/

function hasLab(indicators: RecordSnapshot['indicators'], kind: 'hscrp' | 'waist'): boolean {
  return indicators.some((row) => {
    const text = `${row.name} ${row.label ?? ''} ${row.loinc ?? ''}`
    if (kind === 'waist') return /腰围/.test(text)
    if (/总蛋白/.test(text) && !/C反应|CRP/i.test(text)) return false
    return row.loinc === '30522-7' || row.loinc === '1988-5' || /超敏\s*C\s*反应蛋白|hs-?CRP|C反应蛋白/i.test(text)
  })
}

function latestCheckup(indicators: RecordSnapshot['indicators']): IsoDay | null {
  let latest: IsoDay | null = null
  for (const row of indicators) {
    if (row.source === 'self' || DEVICE_NAME.test(row.name)) continue
    const day = (row.date ?? '').slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && (!latest || day > latest)) latest = day
  }
  return latest
}

function ldlOf(indicators: RecordSnapshot['indicators']): CodexContext['ldl'] {
  const rows = indicators.filter((row) => LDL.test(`${row.name} ${row.label ?? ''}`) && /^\d{4}-\d{2}-\d{2}/.test(row.date ?? ''))
  const row = rows.sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]
  if (!row) return null
  const raw = Number.parseFloat(String(row.value))
  if (!Number.isFinite(raw)) return null
  const mgdl = /mg/i.test(row.unit ?? '')
  return { value: mgdl ? Math.round((raw / 38.67) * 100) / 100 : raw, unit: 'mmol/L', date: String(row.date).slice(0, 10) }
}

export interface JourneyPieces {
  dataDir: string
  profile: Profile
  age: number | null
  records: RecordSnapshot
  tracking: Tracking
  pack: Pick<FactPack, 'safety' | 'top_facts' | 'method_results'>
  findings: readonly TriageFinding[]
  next: { title_zh: string; detail_zh: string }
  planText: string
  retests: Array<{ marker: string; date: string }>
  risk: { status: string; risk_pct: number | null; date: string | null; category_zh: string }
}

/** China-PAR was built on adults 35–74 without atherosclerotic heart disease; outside that it gives no number. */
function riskApplicability(age: number | null, conditions: ReadonlySet<string>): { applicable: boolean; reason_zh: string } {
  if (conditions.has('cvd') || conditions.has('stent')) return { applicable: false, reason_zh: '已有冠心病，风险评估请以医生为准。' }
  if (age == null) return { applicable: false, reason_zh: '档案里没有年龄，这个公式算不了。' }
  if (age < 35) return { applicable: false, reason_zh: '这个公式不适用：你还不到建模年龄（35–74 岁），健康页不出这个数。' }
  if (age > 74) return { applicable: false, reason_zh: '这个公式不适用：超出了建模年龄（35–74 岁），健康页不出这个数。' }
  return { applicable: true, reason_zh: '' }
}

export function codexContextFrom(input: JourneyPieces): Omit<CodexContext, 'at'> & { care_visits: Array<{ id: string; date: IsoDay | null; with_brief: boolean }> } {
  const drug = new Set<string>(input.pack.safety.drug_classes)
  for (const row of input.records.medications ?? []) for (const cls of drugClassesOf(String((row as { name?: string }).name ?? ''))) drug.add(cls)
  const conditions = new Set<string>(input.pack.safety.conditions)
  if (input.profile.risk?.diabetes) conditions.add('diabetes')
  if (input.profile.risk?.bp_treated) { conditions.add('hypertension'); drug.add('antihypertensive') }
  const points = input.tracking.bioage.points
  const now = points.at(-1)
  const prev = points.length > 1 ? points.at(-2) : undefined
  const applicability = riskApplicability(input.age, conditions)
  const facts = input.pack.top_facts.map((fact) => fact.text_zh).join(' ')
  return {
    age: input.age,
    drug_classes: [...drug],
    conditions: [...conditions],
    pregnant: conditions.has('pregnancy'),
    open_findings: input.findings.filter((row) => row.status === 'open' || row.status === 'advised').map((row) => row.id),
    personal_text: `${input.planText} ${input.next.title_zh} ${input.next.detail_zh} ${facts}`.slice(0, 2000),
    focus: [...input.profile.focus],
    ldl: ldlOf(input.records.indicators),
    retests: input.retests.map((row) => ({ marker: row.marker, date: row.date.slice(0, 10) })),
    latest_checkup: latestCheckup(input.records.indicators),
    results: {
      bioage: now ? { now: now.phenoage, date: now.date.slice(0, 10), prev: prev?.phenoage ?? null, prev_date: prev?.date?.slice(0, 10) ?? null, band: input.tracking.bioage.band_years } : null,
      risk: input.risk.status === 'ok' || !applicability.applicable
        ? { pct: applicability.applicable ? input.risk.risk_pct : null, date: input.risk.date, category_zh: input.risk.category_zh, applicable: applicability.applicable, reason_zh: applicability.reason_zh }
        : null,
      changes: input.tracking.changes.map((row) => ({
        key: row.key,
        label_zh: row.label_zh,
        unit: row.unit,
        from: row.compare.from,
        to: row.compare.to,
        from_date: row.compare.from_date.slice(0, 10),
        to_date: row.compare.to_date.slice(0, 10),
        beyond: row.compare.pct > row.band_pct.up || row.compare.pct < row.band_pct.down,
        verdict: row.verdict,
        ask_doctor: row.ask_doctor,
      })),
    },
    labs: { hscrp: hasLab(input.records.indicators, 'hscrp'), waist: hasLab(input.records.indicators, 'waist') },
    method_results: input.pack.method_results.slice(0, 40).flatMap((row) => {
      const first = row.outputs.find((out) => typeof out.value === 'number' || (typeof out.value === 'string' && out.value.trim()))
      if (!first) return []
      return [{ skill: row.skill, text_zh: `你的记录算过这一项${row.title_zh ? `（${row.title_zh}）` : ''}，结果在健康页上。` }]
    }),
    care_visits: careItems(input.dataDir).filter((item) => item.care_status === 'visited').map((item) => ({ id: item.id, date: item.visit_date ?? null, with_brief: Boolean(item.brief_id) })),
  }
}
