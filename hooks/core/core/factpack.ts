// The per-person fact pack (AA §2.4): the one place where everything a surface or a model may say is
// assembled — top facts, the numbers that may be quoted, next-best-action candidates, memory, plan state.
// Built synchronously from what the journey already computed, so the page and the chat read one state.

import { createHash } from '../../sys/crypto.ts'
import type { NumberRef } from '../contracts/common.ts'
import type { FactPack, Stage } from '../contracts/factpack.ts'
import { registeredMethodResults } from '../contracts/library.ts'
import { alignBodyAge, titleOf, type BodyAgeFigure } from './method-view.ts'
import type { ExclusionItem, GoalItem } from '../contracts/memory.ts'
import type { NextBestAction } from '../contracts/surfaces.ts'
import type { RecordChange } from '../changes.ts'
import { engagementSummary } from '../engage/index.ts'
import { feedbackFor } from '../feedback/index.ts'
import type { StopHit } from '../plan-safety.ts'
import { scienceSummary } from '../science/index.ts'
import { journeyCandidates } from '../surfaces/providers.ts'
import type { Tracking } from '../tracking.ts'
import type { CareState } from '../triage/care.ts'
import { triageCandidates } from '../triage/index.ts'
import { screeningTopics } from '../triage/screening.ts'
import { addDays } from '../interventions.ts'
import { drugClassesOf, memoryFor } from './memory.ts'
import { collectCandidates } from './nba-registry.ts'
import { rankTopFacts } from './topfacts.ts'

export interface PackInput {
  dataDir: string
  today: string
  stage: Stage
  person: FactPack['person']
  care: CareState
  /** Every hit of the record's stop, before visits (the status line quotes their values). */
  hits: readonly StopHit[]
  needsSex: boolean
  medications: string[]
  changes: readonly RecordChange[]
  results: {
    /** status and headline_zh are the page's; without status, a phenoage means ok. */
    bioage: { phenoage: number | null; advance: number | null; date: string | null; status?: 'ok' | 'blocked'; headline_zh?: string }
    risk: { risk_pct: number | null; date: string | null }
  }
  plan: { exists: boolean; version: number | null; days: number | null; open_checkins: number; adherence_pct: number | null }
  self: Array<{ key: string; label_zh: string; value: number; unit: string; date: string }>
  stageNext: FactPack['stage_next']
  /** No checkup in the record yet (the empty state). */
  emptyRecord: boolean
  tracking?: Tracking
  trackingGeneration: number
}

function numberText(value: number, unit: string): string {
  const shown = String(Number(value.toFixed(2)))
  return unit === '%' ? `${shown}%` : `${shown} ${unit}`.trim()
}

/** The page's body-age figure, for one number across the page, the facts and the chat. */
function bodyAgeFigure(input: PackInput): BodyAgeFigure & { headline_zh?: string } {
  const bio = input.results.bioage
  const status = bio.status ?? (bio.phenoage != null ? 'ok' : 'blocked')
  return { status, phenoage: bio.phenoage, advance: bio.advance, ...(bio.headline_zh ? { headline_zh: bio.headline_zh } : {}) }
}

function numbersOf(input: PackInput, methods: readonly ReturnType<typeof registeredMethodResults>[number][]): NumberRef[] {
  const out: NumberRef[] = []
  const add = (ref: NumberRef) => { if (!out.some((row) => row.key === ref.key)) out.push(ref) }
  for (const finding of input.care.findings) for (const ref of finding.numbers) add(ref)
  const { bioage, risk } = input.results
  if (bioage.phenoage != null) add({ key: 'phenoage.latest', label_zh: '身体年龄（表型年龄）', value: bioage.phenoage, unit: '岁', date: bioage.date, source: 'skill', text: numberText(bioage.phenoage, '岁') })
  if (bioage.advance != null) add({ key: 'phenoage.advance', label_zh: '身体年龄与实足年龄之差', value: bioage.advance, unit: '岁', date: bioage.date, source: 'skill', text: numberText(Math.abs(bioage.advance), '岁') })
  if (risk.risk_pct != null) add({ key: 'chinapar.risk', label_zh: '10 年心血管风险', value: risk.risk_pct, unit: '%', date: risk.date, source: 'skill', text: `${Number(risk.risk_pct.toFixed(1))}%` })
  for (const row of input.changes) {
    add({ key: `${row.key}@${row.compare.from_date}`, label_zh: row.label_zh, value: row.compare.from, unit: row.unit, date: row.compare.from_date, source: 'record', text: numberText(row.compare.from, row.unit) })
    add({ key: `${row.key}@${row.compare.to_date}`, label_zh: row.label_zh, value: row.compare.to, unit: row.unit, date: row.compare.to_date, source: 'record', text: numberText(row.compare.to, row.unit) })
  }
  for (const row of input.self) add({ key: `self.${row.key}`, label_zh: row.label_zh, value: row.value, unit: row.unit, date: row.date, source: 'self', text: numberText(row.value, row.unit) })
  if (input.plan.adherence_pct != null) add({ key: 'plan.adherence', label_zh: '方案执行率', value: input.plan.adherence_pct, unit: '%', date: input.today, source: 'derived', text: `${input.plan.adherence_pct}%` })
  if (input.plan.days != null) add({ key: 'plan.days', label_zh: '方案天数', value: input.plan.days, unit: '天', date: input.today, source: 'derived', text: `${input.plan.days} 天` })
  // Personal method outputs, so a surface can quote them. Evidence-only rows have no personal number.
  methods.forEach((row, index) => {
    if (row.label === 'evidence-only') return
    let n = 0
    for (const item of row.outputs) {
      if (typeof item.value !== 'number' || !Number.isFinite(item.value)) continue
      n += 1
      const day = /^\d{4}-\d{2}-\d{2}/.test(row.ran_at) ? row.ran_at.slice(0, 10) : null
      add({
        key: n === 1 ? `method.${index + 1}` : `method.${index + 1}.${n}`,
        label_zh: titleOf(row.skill),
        value: item.value,
        unit: item.unit,
        date: day,
        source: 'skill',
        text: numberText(item.value, item.unit),
      })
    }
  })
  return out
}

/** sha256 over the fields generators read (not the display name, not timestamps). */
export function packFp(pack: Omit<FactPack, 'fp'>): string {
  const canonical = {
    today: pack.today, stage: pack.stage, person: { age: pack.person.age, sex: pack.person.sex },
    top: pack.top_facts.map((row) => [row.id, row.priority, row.text_zh]),
    numbers: pack.numbers.map((row) => [row.key, row.value]),
    candidates: pack.candidates.map((row) => [row.id, row.kind, row.mandatory, row.title_zh]),
    plan: pack.plan, exclusions: pack.exclusions.map((row) => row.id), safety: pack.safety,
    digest: pack.memory_digest_zh, asked: pack.asked_recent,
    triage: pack.triage.care.map((row) => [row.finding_id, row.care_status, row.visit_date, row.outcome_zh]),
    methods: pack.method_results.map((row) => [row.skill, row.label, row.outputs.map((item) => [item.key, item.value, item.unit])]),
  }
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex').slice(0, 32)
}

export function packFrom(input: PackInput): FactPack {
  const memory = memoryFor(input.dataDir)
  const state = memory.read()
  const flags = memory.safetyFlags()
  const recordMeds = input.medications.map((name) => ({ name, classes: drugClassesOf(name) }))
  const memoryMeds = (state.items.filter((item) => item.status === 'active' && (item.kind === 'medication' || item.kind === 'supplement')) as Array<{ name_zh: string; drug_class: string[]; stopped?: string | null }>)
    .filter((item) => !item.stopped).map((item) => ({ name: item.name_zh, classes: item.drug_class as never }))
  const meds = [...recordMeds, ...memoryMeds.filter((row) => !recordMeds.some((rec) => rec.name === row.name))]
  const drugClasses = [...new Set([...flags.drug_classes, ...recordMeds.flatMap((row) => row.classes)])].filter((cls) => cls !== 'other')
  const goals = (state.items.filter((item) => item.status === 'active' && item.kind === 'goal') as GoalItem[]).map((item) => ({ id: item.id, text_zh: item.text_zh }))
  const family = (state.items.filter((item) => item.status === 'active' && (item.kind === 'family_history' || item.kind === 'note' || item.kind === 'condition')) as Array<{ text_zh: string; kind: string; condition_zh?: string; provenance: { quote_zh?: string } }>)
    .map((item) => `${item.text_zh} ${item.condition_zh ?? ''} ${item.provenance.quote_zh ?? ''}`)
    .filter((line) => /妈|母亲|姐|妹|女儿|外婆|奶奶|家里|家族/.test(line))
  const screening = input.stage === 'consent' ? [] : screeningTopics({ age: input.person.age, sex: input.person.sex, family, emptyRecord: input.emptyRecord })
  const bioFigure = bodyAgeFigure(input)
  // One body-age number (INT062 fix 2): method outputs that measure body age carry the page's figure, or nothing.
  const methods = alignBodyAge(registeredMethodResults(), bioFigure)
  const top = rankTopFacts({ care: input.care, hits: input.hits, meds, conditions: flags.conditions, changes: input.changes, goals, needsSex: input.needsSex, screening: screening.map((row) => row.fact), methods, bioage: bioFigure })
  const weekAgo = addDays(input.today, -7)
  const asked = (state.items.filter((item) => item.status === 'active' && item.kind === 'asked_topic') as Array<{ topic_key: string; last_asked: string }>)
    .filter((item) => item.last_asked >= weekAgo).map((item) => item.topic_key)
  const care = (state.items.filter((item) => item.status === 'active' && item.kind === 'care') as Array<{ finding_id?: string; care_status: string; visit_date?: string; outcome_zh?: string; updated: string; confirmed?: boolean }>)
    .map((item) => {
      // An unconfirmed date is a proposal. The header and the follow-up never treat it as booked.
      const hideDate = item.care_status === 'booked' && item.confirmed === false
      return {
        finding_id: item.finding_id ?? '',
        care_status: hideDate ? 'advised' : item.care_status,
        visit_date: hideDate ? null : (item.visit_date ?? null),
        outcome_zh: item.outcome_zh ?? null,
        updated: item.updated,
      }
    })
  const stop = input.care.stop.stop || input.needsSex
    ? { title_zh: input.care.stop.title_zh, sentence_zh: input.care.stop.sentence_zh, needs_sex: input.needsSex }
    : null
  const base: Omit<FactPack, 'candidates' | 'fp'> = {
    version: 1,
    today: input.today,
    stage: input.stage,
    person: input.person,
    top_facts: top,
    numbers: numbersOf(input, methods),
    feedback: input.tracking ? feedbackFor(input.tracking, memory) : [],
    plan: { ...input.plan, draft_hold: false },
    exclusions: memory.active('exclusion') as ExclusionItem[],
    safety: { drug_classes: drugClasses, conditions: flags.conditions },
    memory_digest_zh: memory.digest({ purpose: 'surface' }),
    asked_recent: asked,
    engagement: engagementSummary(),
    science: scienceSummary(),
    generations: { records: 0, tracking: input.trackingGeneration, memory_rev: state.rev, plan: input.plan.version, triage_rev: care.length, season_rev: 0 },
    triage: { findings: input.care.findings, care, stop },
    stage_next: input.stageNext,
    method_results: methods,
  }
  let candidates: NextBestAction[] = []
  candidates.push(...screening.map((row) => row.action))
  for (const provider of [triageCandidates, journeyCandidates]) {
    try {
      candidates.push(...provider(base))
    } catch {
      // a provider that fails adds nothing
    }
  }
  candidates = [...candidates, ...collectCandidates(base)]
  const withCandidates = { ...base, candidates }
  return { ...withCandidates, fp: packFp(withCandidates) }
}
