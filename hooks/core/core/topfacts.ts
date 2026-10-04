// Top facts (AA §2.4): what matters most for this person, ranked by rule tables — triage findings first,
// then medicines and conditions that change what is safe, then care follow-up, then goals. No model ranks.

import type { NumberRef } from '../contracts/common.ts'
import { FACT_PRIORITY_RANK, type TopFact } from '../contracts/factpack.ts'
import { registeredMethodResults, type MethodResult } from '../contracts/library.ts'
import type { ConditionFlag, DrugClass } from '../contracts/memory.ts'
import type { TriageFinding } from '../contracts/triage.ts'
import type { RecordChange } from '../changes.ts'
import type { StopHit } from '../plan-safety.ts'
import { statusLine } from '../triage/rules.ts'
import { outcomeText, type CareState } from '../triage/care.ts'
import { bodyAgeFactText, measuresBodyAge, methodFactText, overviewSlice, type BodyAgeFigure } from './method-view.ts'
import './method-results.ts'

const KIND_ORDER: Record<TopFact['kind'], number> = { triage: 0, safety_med: 1, safety_condition: 2, screening: 3, care_followup: 4, milestone: 5, goal: 6 }

export interface TopFactInput {
  care: CareState
  hits: readonly StopHit[]
  /** Current medicines by name with their classes (record and memory). */
  meds: Array<{ name: string; classes: DrugClass[] }>
  conditions: ConditionFlag[]
  changes: readonly RecordChange[]
  goals: Array<{ id: string; text_zh: string }>
  /** Screening topics (M1, triage/screening.ts), already ranked. */
  screening?: TopFact[]
  /** The stop used the men's limits because no sex is on file. */
  needsSex?: boolean
  /**
   * Labeled method results for this generation. Omitted means the registered
   * hook, which is empty until a run is recorded. They rank under triage and
   * safety: an emergency, a critical pattern, and a safety medicine stay first.
   */
  methods?: readonly MethodResult[]
  /** The page's body-age figure. Method results that measure body age become one fact with this number. */
  bioage?: BodyAgeFigure & { headline_zh?: string }
}

const MED_FACT: Partial<Record<DrugClass, { rule: string; text: (name: string) => string }>> = {
  glp1ra: { rule: 'safety.med.glp1ra', text: (name) => `你在用${name}（GLP-1 类药物）：体重和血糖的变化主要来自药物，剂量怎么调听开药的医生` },
  sglt2i: { rule: 'safety.med.sglt2i', text: (name) => `你在用${name}（SGLT2 抑制剂）：方案不安排限时进食、断食或极低碳饮食；吃得明显少或生病时先问开药的医生` },
  insulin: { rule: 'safety.med.insulin', text: (name) => `你在用${name}（胰岛素）：运动、少吃和减重都要防低血糖` },
  sulfonylurea: { rule: 'safety.med.sulfonylurea', text: (name) => `你在用${name}（磺脲类）：运动、少吃和减重都要防低血糖` },
  anticoagulant: { rule: 'safety.med.anticoagulant', text: (name) => `你在用${name}（抗凝药）：鱼油等补剂可能增加出血风险，先问医生` },
  // INT062 fix 4: a lipid drop after a statin starts is the statin's, not the walking plan's.
  statin: { rule: 'safety.med.statin', text: (name) => `你在用${name}（他汀类降脂药）：低密度脂蛋白和总胆固醇的下降主要来自${name}，不算走路或方案的效果；药怎么吃听开药的医生` },
}

const CONDITION_FACT: Partial<Record<ConditionFlag, { rule: string; text: string }>> = {
  pregnancy: { rule: 'safety.condition.pregnancy', text: '你说过怀孕了：方案不安排限时进食、减重、饮酒和鱼油' },
  pregnancy_planning: { rule: 'safety.condition.pregnancy_planning', text: '你在备孕：方案不安排限时进食或断食，体重指数低于 24 时不设减重目标，避免饮酒。备孕叶酸的一般人群建议是每天 0.4 mg，这是中国备孕的常规人群指导' },
  breastfeeding: { rule: 'safety.condition.breastfeeding', text: '你在哺乳：方案不安排限时进食或断食，体重指数低于 24 时不设减重目标，避免饮酒' },
  ckd: { rule: 'safety.condition.ckd', text: '你有慢性肾病：方案不安排未经调整的 DASH 饮食' },
  cancer_followup: { rule: 'safety.condition.cancer_followup', text: '你在肿瘤随访中：任何饮食或补剂改动先问主治医生' },
}

function ruleOf(label: MethodResult['label']): string {
  return label === 'verified' ? 'method.verified' : label === 'unverified-binding' ? 'method.unverified' : 'method.evidence'
}

function methodTopFacts(results: readonly MethodResult[], bioage?: TopFactInput['bioage']): TopFact[] {
  const slice = overviewSlice(results)
  const rows = [...slice.value, ...slice.evidence]
  // Every result that measures body age is one fact with the page's number (INT062 fix 2), never a second figure.
  const bodyRows = rows.filter((row) => measuresBodyAge(row))
  const label = bodyRows.find((row) => row.label === 'verified')?.label ?? bodyRows[0]?.label ?? null
  const body = bodyRows.length > 0 && bioage ? bodyAgeFactText(bioage, label) : ''
  const facts: TopFact[] = []
  if (body && label) facts.push({ id: 'method-result-bioage', kind: 'milestone', priority: 'should_surface', text_zh: body, refs: [], source_ids: [], rule: ruleOf(label) })
  for (const row of rows) {
    if (measuresBodyAge(row)) continue
    facts.push({ id: `method-result-${facts.length + 1}`, kind: 'milestone', priority: 'should_surface', text_zh: methodFactText(row), refs: [], source_ids: [], rule: ruleOf(row.label) })
  }
  return facts
}

function changeRefs(row: RecordChange): NumberRef[] {
  const text = (value: number) => (row.unit === '%' ? `${Number(value.toPrecision(4))}%` : `${Number(value.toPrecision(4))} ${row.unit}`)
  return [
    { key: `${row.key}@${row.compare.from_date}`, label_zh: row.label_zh, value: row.compare.from, unit: row.unit, date: row.compare.from_date, source: 'record', text: text(row.compare.from) },
    { key: `${row.key}@${row.compare.to_date}`, label_zh: row.label_zh, value: row.compare.to, unit: row.unit, date: row.compare.to_date, source: 'record', text: text(row.compare.to) },
  ]
}

export function rankTopFacts(input: TopFactInput): TopFact[] {
  const facts: TopFact[] = []
  const seenIds = new Set(input.care.seen.map((row) => row.finding.id))
  const openFindings: TriageFinding[] = input.care.findings.filter((row) => !seenIds.has(row.id))
  for (const finding of openFindings) {
    const line = statusLine(finding, input.hits)
    const text = input.needsSex && finding.id === 'finding-red-cell' ? `${line}（性别还没填，男女参考范围不同，请先填写性别；介于两者之间的数值这次不转诊）` : line
    facts.push({ id: finding.id, kind: 'triage', priority: finding.priority, text_zh: text, refs: finding.numbers, source_ids: [finding.id], rule: finding.rule })
  }
  for (const { finding, care } of input.care.seen) {
    facts.push({
      id: `care-${finding.id}`, kind: 'care_followup', priority: 'should_surface',
      text_zh: `医生已经看过${finding.title_zh.replace(/ 偏低| 偏高| 在下降/g, '')}${care.visit_date ? `（${care.visit_date}）` : ''}${care.outcome_zh ? `：${outcomeText(care.outcome_zh)}` : ''}`,
      refs: [], source_ids: [finding.id, care.id], rule: 'care.visited',
    })
  }
  // One fact per class, in MED_FACT's order: a medicine that changes what is safe (GLP-1, SGLT2, insulin, a
  // sulfonylurea, an anticoagulant) ranks above the statin's attribution line, whatever order the record lists them.
  const medOrder = Object.keys(MED_FACT) as DrugClass[]
  const medFacts: Array<{ at: number; fact: TopFact }> = []
  const medSeen = new Set<DrugClass>()
  for (const med of input.meds) {
    for (const cls of med.classes) {
      const spec = MED_FACT[cls]
      if (!spec || medSeen.has(cls)) continue
      medSeen.add(cls)
      medFacts.push({ at: medOrder.indexOf(cls), fact: { id: `safety-${cls}`, kind: 'safety_med', priority: 'must_surface', text_zh: spec.text(med.name), refs: [], source_ids: [], rule: spec.rule } })
    }
  }
  facts.push(...medFacts.sort((a, b) => a.at - b.at).map((row) => row.fact))
  for (const flag of input.conditions) {
    const spec = CONDITION_FACT[flag]
    if (spec) facts.push({ id: `condition-${flag}`, kind: 'safety_condition', priority: 'must_surface', text_zh: spec.text, refs: [], source_ids: [], rule: spec.rule })
  }
  // Changes beyond normal fluctuation for a doctor that no finding already covers (e.g. MCHC 339 → 321). The
  // red-cell indices (Hct, MCH, MCHC, RBC) belong to the red-cell finding when it is open: one fact, not four.
  const covered = new Set(input.care.findings.flatMap((row) => row.numbers.map((ref) => ref.label_zh)))
  // Seen by a doctor counts too: the care follow-up fact says so instead.
  const redCellOpen = input.care.findings.some((row) => row.id === 'finding-red-cell')
  const RED_CELL_KEYS = ['hb', 'hct', 'mcv', 'mch', 'mchc', 'rbc']
  for (const row of input.changes.filter((item) => item.ask_doctor && !covered.has(item.label_zh) && !(redCellOpen && RED_CELL_KEYS.includes(item.key))).slice(0, 2)) {
    facts.push({ id: `change-${row.key}`, kind: 'triage', priority: 'should_surface', text_zh: `${row.text_zh.replace(/，超出正常波动.*$/, '')}，变化超出正常波动，可以问问医生`, refs: changeRefs(row), source_ids: [], rule: 'changes.ask_doctor' })
  }
  for (const fact of input.screening ?? []) facts.push(fact)
  for (const goal of input.goals.slice(0, 2)) facts.push({ id: `goal-${goal.id}`, kind: 'goal', priority: 'context', text_zh: `你的目标：${goal.text_zh}`, refs: [], source_ids: [goal.id], rule: 'memory.goal' })
  // Under triage and safety. should_surface sits below emergency and must_surface,
  // and milestone sits below a should_surface triage or screening fact.
  facts.push(...methodTopFacts(input.methods ?? registeredMethodResults(), input.bioage))
  return facts.sort((a, b) => FACT_PRIORITY_RANK[a.priority] - FACT_PRIORITY_RANK[b.priority] || KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
}
