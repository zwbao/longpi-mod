// Draft an intervention plan from what this person's results say is worth
// improving and what the collected trials found for it. The markers come from
// the skills' own sensitivity (PhenoAge, China-PAR) and the person's focus; the
// items and their expected effects come from data/effects.jsonl, each with its
// population and DOI. Lifestyle items only, plus at most one supplement as an
// option to confirm with a doctor, never with a dose; never a drug. Every goal
// is the latest value plus a trial average, labelled as such. Nothing here is
// saved: the person tailors the draft in chat or accepts it on the page.

import { hasDose, stripDoses } from './dose.ts'
import { drinkingFromText, fingerprint, readPlanPrefs, rememberExclusions, setDrinking, writePlanPrefs } from './plan-prefs.ts'
import {
  bodyMassIndex, BREASTFEEDING_NOTE_ZH, egfrBelowCkd, exclusionsFromText, FISH_OIL, FISH_OIL_CAUTION, flagsFromText,
  FOLIC_PLANNING_NOTE_ZH, holdWeightLoss, interventionBlocked, medicationClasses, PLANNING_NOTE_ZH, preconceptionFolic,
  reproductiveDenied, reproductiveFromText, TIME_RESTRICTED,
} from './plan-safety.ts'
import { NO_STOP, panelPoints } from './doctor-first.ts'
import { drugClassesOf, memoryFor } from './core/memory.ts'
import { rememberFromWords } from './core/remember-rules.ts'
import { careState, seenChangeKeys, seenNotes } from './triage/care.ts'
import { buildTracking, type ModelCard, type TrackingContext } from './tracking.ts'
import { addDays, CATEGORY_ZH, currentPlan, type Category } from './interventions.ts'
import type { MountState } from './mirobody.ts'
import { preferSelf } from './measurements.ts'
import { FOCUS, FOCUS_ZH, type Focus } from './profile.ts'
import { sameMeasure } from './records.ts'
import { checkupMarkerFor, loadReference, markerFor, markerGroupKeys, type Biovar, type BiovarMarker, type EffectRow } from './reference.ts'
import { SELF_SPEC } from './selfmeasure.ts'
import { GLUCOSE_LOWERING, medicationsForWindow, type IndicatorRow, type MedicationRow } from './situation.ts'
import { foldName, parseNumber } from './units.ts'

export const DRAFT_CATEGORIES = ['diet', 'exercise', 'sleep', 'weight', 'behavior', 'supplement'] as const
export type DraftCategory = (typeof DRAFT_CATEGORIES)[number]

export interface PlanBrief {
  today: string
  focus: Focus[]
  /** What is worth improving, most important first. */
  priorities: Array<{
    marker_key: string
    label_zh: string
    value: number | null
    unit: string
    date: string | null
    why_zh: string
    source: 'phenoage_levers' | 'china_par_levers' | 'focus'
  }>
  /** Evidence-backed options for those priorities, from data/effects.jsonl; never a drug. */
  candidates: Array<{
    id: string
    intervention_zh: string
    category: string
    marker_key: string
    label_zh: string
    effect: { value: number; unit: string; kind?: string }
    duration_weeks: number | null
    population: string
    design: string
    doi: string
    verified: boolean
    expected_zh: string
    needs_doctor: boolean
    cautions_zh: string[]
    /** The trial average in the unit of this person's latest value, when it converts exactly; else null. Used for goals. */
    effect_in_record_unit: number | null
    /** The evidence row's own note (left out for supplements, whose notes name study doses). */
    note_zh?: string
    /** Forms the evidence row lists (快走、骑车…), for exercise items. */
    examples_zh: string[]
  }>
  /**
   * weight_med: a current medicine, or one that starts inside the plan window, that moves weight by itself (GLP-1,
   * SGLT2, insulin). The draft then gives no trial kilogram figure and no weight goal (INT062 fix 5b).
   */
  safety: { medications: string[]; notes_zh: string[]; stop_zh?: string; no_weight_loss?: boolean; weight_med?: string }
  /** Evidence ids and titles the person already refused. */
  excluded_ids?: string[]
  excluded_phrases?: string[]
  past_items: Array<{ title: string; category: string; verdicts: string[]; adherence_pct: number | null }>
  /** Daily wearable metrics on record (dailySteps, dailyTotalSleepTime): a target is only offered for these. */
  metrics: string[]
  /** Why a focus or a priority got no item (no evidence rows yet, no value on record). */
  notes_zh: string[]
  boundary_zh: string
}

export interface DraftItem {
  /** The evidence row the item came from. */
  id: string
  category: DraftCategory
  category_zh: string
  title: string
  detail: string
  start: string
  markers: string[]
  target: { metric: string; op: '>=' | '<='; value: number; unit: string } | null
  evidence: { effect_id: string; expected_zh: string; doi: string; verified: boolean; population: string }
  needs_doctor: boolean
  cautions_zh: string[]
}

export interface PlanDraft {
  title: string
  items: DraftItem[]
  /** basis_item_id: the draft item whose evidence gives the goal; the goal goes when that item is removed. */
  goals: Array<{ marker: string; value: number; unit: string; basis_zh: string; basis_item_id: string }>
  notes_zh: string[]
}

type Priority = PlanBrief['priorities'][number]
type Candidate = PlanBrief['candidates'][number]

const BOUNDARY_ZH = 'LongPi 只起草生活方式方案：饮食、运动、睡眠、体重、饮酒、吸烟、盐这类行为目标，每一项都注明研究证据。它不开始、不停止、也不调整任何处方药，不给药物或补剂的剂量；补剂只作为需先与医生确认的选项。试验平均效应不是对你个人的预测，个人效果因人而异。'
const SUPPLEMENT_DETAIL = '可选：需先与医生确认；不给剂量。'
const GOAL_BASIS = '按试验平均效应估算，不是个人预测'
/** A trial average that would move today's value by more than this share is no goal for this person. */
const GOAL_MAX_CHANGE = 0.5
const DETAIL_MAX = 300
const PRIORITY_MAX = 8
const LEVERS_PER_MODEL = 3
const WHY: Record<Priority['source'], string> = {
  phenoage_levers: '对你的身体年龄影响最大的指标之一（模型估计）',
  china_par_levers: '10 年心血管风险的主要来源之一（模型估计）',
  focus: '',
}
/** Markers each focus points at; bioage takes PhenoAge's own top levers instead, sleep and plan none. */
const FOCUS_MARKERS: Record<Focus, string[]> = {
  bioage: [], cardio: ['sbp', 'ldl', 'hdl', 'tg'], glucose: ['glucose', 'hba1c'], weight: ['weight', 'waist'], sleep: [], plan: [],
}
const DESIGN_ZH: Record<string, string> = { 'meta-analysis': '荟萃分析', rct: '随机对照试验', cohort: '队列研究' }

// A conservative screen, not an exhaustive interaction check: name fragments of common medicine classes.
const ANTIHYPERTENSIVE = /地平|普利|沙坦|洛尔|噻嗪|吲达帕胺|螺内酯|呋塞米|托拉塞米|降压|amlodipine|nifedipine|felodipine|pril\b|sartan|olol\b|thiazide|indapamide|spironolactone|furosemide/i
const ANTITHROMBOTIC = /阿司匹林|氯吡格雷|替格瑞洛|华法林|沙班|达比加群|肝素|抗凝|抗血小板|aspirin|clopidogrel|ticagrelor|prasugrel|warfarin|xaban\b|dabigatran|heparin/i
const SMOKING_CESSATION = /戒烟|smoking cessation|quit smoking/i
const ALCOHOL = /饮酒|少喝酒|减酒|限酒|酒精|alcohol/i
/** Office systolic below this, with no treated or stated hypertension, is normal: no BP-lowering item (FINDINGS 47/58/69). */
const NORMAL_SBP = 130
/** How far ahead a draft looks for a medicine that is about to start: one season, about 12 weeks. */
export const PLAN_WINDOW_DAYS = 84
/** Medicine classes that move body weight by themselves. */
const WEIGHT_MED_CLASSES = new Set(['glp1ra', 'sglt2i', 'insulin'])

/** The first current or about-to-start medicine that moves weight by itself, or ''. */
function weightMedicine(current: readonly string[]): string {
  return current.find((name) => drugClassesOf(name).some((cls) => WEIGHT_MED_CLASSES.has(cls))) ?? ''
}

/** The plain attribution sentence for a draft while such a medicine is in use. */
export function weightMedNote(name: string): string {
  return `你正在使用（或近期将开始使用）${name}：这段时间体重的变化主要来自${name}，不是方案本身的效果，因此方案中不写试验的公斤数，也不设体重目标。`
}
const NORMAL_DBP = 85
const BP_KEYS = ['sbp', 'dbp']
const ASKED_WHY = '你指定要改善的指标'

export interface BriefOptions {
  /** Focus for this draft only (the saved profile is not changed). */
  focus?: readonly Focus[]
  /** Markers the person asked to improve, by name or key; they come first. */
  markers?: readonly string[]
  /** Limits they just stated (不要限时进食, 怀孕). Saved, and applied to this draft. */
  constraints?: string
}

/**
 * A draft's focus and markers as the tool and the accept route both read them: unknown focus values are
 * dropped (none left, the saved focus), markers trimmed, at most 8 of 40 characters or fewer.
 */
export function briefOptionsOf(focus: unknown, markers: unknown): BriefOptions {
  const kept = (Array.isArray(focus) ? focus : []).filter((item): item is Focus => (FOCUS as readonly string[]).includes(String(item)))
  const asked = (Array.isArray(markers) ? markers : []).map((item) => String(item).trim()).filter((item) => item && item.length <= 40).slice(0, 8)
  return { ...(kept.length > 0 ? { focus: kept } : {}), markers: asked }
}

export async function buildPlanBrief(context: TrackingContext & { mount?: MountState }, options: BriefOptions = {}): Promise<PlanBrief> {
  const tracking = await buildTracking(context)
  const reference = loadReference(context.skillsHome)
  const { profile, indicators, medications } = context.records
  const goalsFromMemory = rememberedGoals(context.dataDir)
  const focus = [...new Set([...(options.focus ?? profile.focus), ...goalsFromMemory.focus])]
  const notes: string[] = [...goalsFromMemory.notes]
  const prefs = readPlanPrefs(context.dataDir)
  const said = flagsFromText(options.constraints ?? '')
  if ((options.constraints ?? '').trim()) {
    try {
      rememberFromWords(context.dataDir, options.constraints ?? '')
    } catch {
      // an unwritable data dir must not block the draft
    }
  }
  if (said.pregnant || said.ckd) {
    writePlanPrefs(context.dataDir, { ...prefs, pregnant: said.pregnant || prefs.pregnant, ckd: said.ckd || prefs.ckd })
  }
  const saidDrinking = drinkingFromText(options.constraints ?? '')
  if (saidDrinking != null) setDrinking(context.dataDir, saidDrinking)
  const stored = readPlanPrefs(context.dataDir)
  if ((options.constraints ?? '').trim()) rememberExclusions(context.dataDir, exclusionsFromText(options.constraints ?? ''))
  const excluded = readPlanPrefs(context.dataDir)
  // A prescription whose start date falls inside the plan window counts from the draft on (INT062 fix 5a).
  const current = medicationsForWindow(medications, addDays(context.today, PLAN_WINDOW_DAYS))
  // Conditions they told LongPi (memory; unconfirmed ones count too, since they only add caution).
  const remembered = rememberedReproductive(context.dataDir)
  const folic = preconceptionFolic(medications)
  const planning = said.planning || remembered.planning || folic
  const breastfeeding = said.breastfeeding || remembered.breastfeeding
  const bmi = bodyMassIndex(indicators)
  const classes = medicationClasses(current, {
    pregnant: said.pregnant || stored.pregnant === true || remembered.pregnant,
    planning,
    breastfeeding,
    bmi,
    ckd: said.ckd || stored.ckd === true || remembered.ckd,
    diabetes: profile.risk.diabetes,
  })
  if (egfrBelowCkd(panelPoints(indicators))) classes.ckd = true
  // Computed once with the tracking (doctor-first.ts): the overview and the chat say the same. A finding a
  // doctor has seen since (M1, a logged visit) no longer stops the plan; what the doctor said is noted.
  const care = careState(context.dataDir, tracking.doctor_first ?? NO_STOP, context.today)
  const stop = care.stop
  notes.push(...seenNotes(care))
  if (stop.stop) notes.push(stop.sentence_zh)
  else {
    // A change a doctor has already seen (a logged visit) is not sent to the doctor again.
    const seenKeys = seenChangeKeys(care)
    const toDoctor = tracking.changes.filter((row) => row.ask_doctor && !seenKeys.has(row.key)).map((row) => row.label_zh)
    if (toDoctor.length > 0) notes.push(`记录里有超出正常波动的变化（${toDoctor.join('、')}），建议先请医生看过再开始方案。`)
  }
  const allPriorities = prioritiesOf({
    focus, asked: [...(options.markers ?? []), ...goalsFromMemory.asked], models: tracking.models, biovar: reference.biovar, indicators, notes,
  })
  // Normal blood pressure and no hypertension known: no salt, DASH or other BP-lowering item unless they asked
  // for blood pressure themselves.
  const sbp = latestFor('sbp', indicators, reference.biovar)
  const dbp = latestFor('dbp', indicators, reference.biovar)
  const conditionFlags = safeConditions(context.dataDir)
  const hypertensive = profile.risk.bp_treated === true || current.some((name) => ANTIHYPERTENSIVE.test(name)) || conditionFlags.includes('hypertension')
  const normotensive = !hypertensive && sbp != null && sbp.value < NORMAL_SBP && (dbp == null || dbp.value < NORMAL_DBP)
  const priorities = normotensive ? allPriorities.filter((row) => !BP_KEYS.includes(row.marker_key) || row.why_zh === ASKED_WHY) : allPriorities
  if (normotensive && priorities.length < allPriorities.length) {
    notes.push(`你的血压在正常范围（收缩压 ${Number(sbp.value.toFixed(1))} mmHg${dbp ? `，舒张压 ${Number(dbp.value.toFixed(1))} mmHg` : ''}，也没有高血压或降压药记录），这份草稿不安排减盐、DASH 饮食这类降压项目。`)
  }
  const drinks = stored.drinks
  const screen = safetyScreen(profile.risk, medications, current, classes, drinks)
  const candidates = stop.stop ? [] : candidatesOf(priorities, reference.effects, reference.biovar, screen, profile.risk.smoker === false, excluded.excluded_ids, excluded.excluded_phrases)
  if (!stop.stop) {
    for (const row of priorities) {
      if (!candidates.some((item) => covers(item.marker_key, row.marker_key))) notes.push(`${row.label_zh}：方法库里还没有针对它的干预证据，这份草稿不含它的项目。`)
    }
    if (focus.includes('sleep') && !candidates.some((row) => row.category === 'sleep')) {
      notes.push('睡眠：方法库里还没有核对过的睡眠干预证据，这份草稿不含睡眠项目。')
    }
  }
  if (profile.risk.smoker === false && reference.effects.some((row) => SMOKING_CESSATION.test(interventionText(row)) && priorities.some((p) => covers(row.marker_key ?? '', p.marker_key)))) {
    notes.push('你已说明不吸烟，因此未列出戒烟。')
  }
  const reproductive = classes.pregnant || classes.planning || classes.breastfeeding
  if (!stop.stop && !reproductive && drinks !== true && reference.effects.some((row) => ALCOHOL.test(interventionText(row)) && priorities.some((p) => covers(row.marker_key ?? '', p.marker_key)))) {
    notes.push(drinks === false ? '你已说明不饮酒，因此未列出减少饮酒。' : '尚不清楚你是否饮酒，因此未列出减少饮酒；如有饮酒，请告诉我饮酒频率和每次饮用量。')
  }
  if (classes.planning) {
    const line = remembered.planning || said.planning ? PLANNING_NOTE_ZH : FOLIC_PLANNING_NOTE_ZH
    notes.push(line)
    screen.notes.push(line)
  }
  if (classes.breastfeeding) {
    notes.push(BREASTFEEDING_NOTE_ZH)
    screen.notes.push(BREASTFEEDING_NOTE_ZH)
  }
  const plan = currentPlan(context.dataDir)
  const past = plan
    ? plan.items.map((item) => {
      const summary = tracking.items.find((row) => row.id === item.id)
      const rate = summary?.adherence.rate
      return {
        title: item.title,
        category: item.category,
        verdicts: (summary?.verdicts ?? []).map((row) => `${row.marker}：${row.verdict}`),
        adherence_pct: rate == null ? null : Math.round(rate * 100),
      }
    })
    : []
  const metrics = ['dailySteps', 'dailyTotalSleepTime'].filter((name) => indicators.some((row) => row.name === name && row.source !== 'self'))
  if (!notes.some((line) => line.startsWith('你说过的目标') && /脂肪肝|公斤|\bkg\b|体重/i.test(line))) {
    notes.push('尚未记录体重目标或脂肪肝情况。如有，请直接告诉我，例如「体重目标 75 公斤」或「想管脂肪肝」。')
  }
  return {
    today: context.today,
    focus,
    priorities,
    candidates,
    safety: { medications: current, notes_zh: screen.notes, ...(stop.stop ? { stop_zh: stop.sentence_zh } : {}), ...(holdWeightLoss(classes) ? { no_weight_loss: true } : {}), ...(screen.weightMed ? { weight_med: screen.weightMed } : {}) },
    excluded_ids: excluded.excluded_ids,
    excluded_phrases: excluded.excluded_phrases,
    past_items: past,
    metrics,
    notes_zh: notes,
    boundary_zh: BOUNDARY_ZH,
  }
}

// --- priorities ----------------------------------------------------------------

/** Condition flags the person stated (memory), for the suitability checks; none when memory cannot be read. */
function rememberedGoals(dataDir: string): { focus: Focus[]; asked: string[]; notes: string[] } {
  const focus: Focus[] = []
  const asked: string[] = []
  const notes: string[] = []
  try {
    for (const item of memoryFor(dataDir).active('goal')) {
      const text = item.text_zh
      notes.push(`你说过的目标：${text}`)
      if (item.focus) focus.push(item.focus)
      if (item.target?.marker_key) asked.push(item.target.marker_key)
      if (/脂肪肝|体重|公斤|kg|腰围/.test(text)) {
        focus.push('weight')
        asked.push('体重')
      }
      if (/血糖|糖化/.test(text)) focus.push('glucose')
      if (/血压/.test(text)) asked.push('血压')
      if (/睡眠/.test(text)) focus.push('sleep')
    }
  } catch {
    // memory unreadable: the draft still uses the profile focus
  }
  return { focus: [...new Set(focus)], asked: [...new Set(asked)], notes }
}

function safeConditions(dataDir: string): string[] {
  try {
    return memoryFor(dataDir).safetyFlags().conditions
  } catch {
    return []
  }
}

/** Pregnancy, planning, or breastfeeding from a condition flag or from anything they said (a goal counts). */
function rememberedReproductive(dataDir: string): { pregnant: boolean; planning: boolean; breastfeeding: boolean; ckd: boolean } {
  const out = { pregnant: false, planning: false, breastfeeding: false, ckd: false }
  const denied = { pregnant: false, planning: false, breastfeeding: false }
  try {
    const memory = memoryFor(dataDir)
    const flags = memory.safetyFlags().conditions
    out.pregnant = flags.includes('pregnancy')
    out.planning = flags.includes('pregnancy_planning')
    out.breastfeeding = flags.includes('breastfeeding')
    out.ckd = flags.includes('ckd')
    for (const item of memory.read().items) {
      if (item.status !== 'active') continue
      const said = reproductiveFromText(item.text_zh)
      const no = reproductiveDenied(item.text_zh)
      denied.pregnant = denied.pregnant || no.pregnant
      denied.planning = denied.planning || no.planning
      denied.breastfeeding = denied.breastfeeding || no.breastfeeding
      out.pregnant = out.pregnant || said.pregnant
      out.planning = out.planning || said.planning
      out.breastfeeding = out.breastfeeding || said.breastfeeding
    }
  } catch {
    // memory unreadable: the draft still uses what they passed this turn
  }
  // 「我没有在备孕」 stored as pregnancy_planning, or a goal that only says the overview did not mention it, is not a reason.
  if (denied.pregnant) out.pregnant = false
  if (denied.planning) out.planning = false
  if (denied.breastfeeding) out.breastfeeding = false
  return out
}

function prioritiesOf(input: {
  focus: Focus[]
  asked: readonly string[]
  models: ModelCard[]
  biovar: Biovar
  indicators: readonly IndicatorRow[]
  notes: string[]
}): Priority[] {
  const out: Priority[] = []
  const add = (key: string, source: Priority['source'], why: string) => {
    const hit = out.find((row) => row.marker_key === key)
    if (hit) return
    const label = labelOf(key, input.biovar)
    if (!label) return
    const latest = latestFor(key, input.indicators, input.biovar)
    out.push({ marker_key: key, label_zh: label, value: latest?.value ?? null, unit: latest?.unit ?? unitOf(key, input.biovar), date: latest?.date ?? null, why_zh: why, source })
  }
  const topKeys = (model: ModelCard['model']) => (input.models.find((card) => card.model === model)?.sensitivity ?? [])
    .filter((row): row is typeof row & { key: string } => Boolean(row.key))
    .slice().sort((a, b) => Math.abs(b.years_per_step) - Math.abs(a.years_per_step))
    .slice(0, LEVERS_PER_MODEL).map((row) => row.key)
  const pheno = topKeys('phenoage')
  const par = topKeys('china-par')
  for (const name of input.asked) {
    // A word for several markers (血压) asks for each of them.
    const key = keyOf(name, input.biovar)
    const keys = key ? [key] : markerGroupKeys(input.biovar, name)
    for (const one of keys) add(one, 'focus', '你指定要改善的指标')
    if (keys.length === 0) input.notes.push(`「${name}」没有对应的研究证据指标，这份草稿没有针对它。`)
  }
  for (const item of input.focus) {
    const cares = `你最关心${FOCUS_ZH[item]}`
    if (item === 'bioage') for (const key of pheno) add(key, 'phenoage_levers', `${cares}；${WHY.phenoage_levers}`)
    for (const key of FOCUS_MARKERS[item]) add(key, 'focus', cares)
  }
  // Then both models' own levers, alternating so neither crowds out the other.
  for (let i = 0; i < LEVERS_PER_MODEL; i += 1) {
    if (pheno[i]) add(pheno[i] as string, 'phenoage_levers', WHY.phenoage_levers)
    if (par[i]) add(par[i] as string, 'china_par_levers', WHY.china_par_levers)
  }
  return out.slice(0, PRIORITY_MAX)
}

function labelOf(key: string, biovar: Biovar): string {
  if (key === 'waist') return SELF_SPEC.waist.label_zh
  return biovar.markers.find((row) => row.key === key)?.label_zh ?? ''
}

function unitOf(key: string, biovar: Biovar): string {
  if (key === 'waist') return SELF_SPEC.waist.unit
  return biovar.markers.find((row) => row.key === key)?.unit ?? ''
}

function keyOf(name: string, biovar: Biovar): string | null {
  const text = name.trim()
  if (!text) return null
  if (text === 'waist' || sameMeasure('waist', { name: text })) return 'waist'
  return (biovar.markers.find((row) => row.key === text) ?? markerFor(biovar, { name: text, label: text }))?.key ?? null
}

function dateOf(row: IndicatorRow): string {
  return row.date || row.last_date || ''
}

/** The newest of the rows; list order (a self measurement first) breaks a tie. */
function newest(rows: IndicatorRow[]): IndicatorRow | undefined {
  return rows.reduce<IndicatorRow | undefined>((best, row) => (!best || dateOf(row) > dateOf(best) ? row : best), undefined)
}

/**
 * The latest value on record for a marker key. Several rows can measure one marker (a checkup weight and
 * a smart scale, two glucose codes): the newest counts. Rows matched only by name are a fallback, and never
 * a row whose LOINC code the marker does not list (urine glucose is not blood glucose).
 */
function latestFor(key: string, indicators: readonly IndicatorRow[], biovar: Biovar): { value: number; unit: string; date: string | null } | null {
  const rows = preferSelf(indicators).filter((row) => parseNumber(row.value) != null)
  let row: IndicatorRow | undefined
  if (key === 'waist') {
    row = newest(rows.filter((item) => sameMeasure('waist', item)))
  } else {
    const marker = biovar.markers.find((item) => item.key === key)
    if (!marker) return null
    row = newest(rows.filter((item) => (item.loinc && marker.loinc.includes(item.loinc)) || (marker.device_codes ?? []).includes(item.name)))
      ?? newest(rows.filter((item) => checkupMarkerFor(biovar, item) === marker))
  }
  if (!row) return null
  return { value: parseNumber(row.value) as number, unit: row.unit, date: dateOf(row) || null }
}

// --- candidates ----------------------------------------------------------------

interface Screen {
  /** A medicine that moves weight by itself (fix 5b), and a GLP-1 by name (fix 5c); '' when none. */
  weightMed: string
  glp1Name: string
  onMedication: boolean
  bpTreated: boolean
  glucoseRisk: boolean
  hypoDrugs: boolean
  sglt2: boolean
  sglt2Name: string
  pregnant: boolean
  planning: boolean
  breastfeeding: boolean
  bmi: number | null
  ckd: boolean
  antithrombotic: boolean
  /** Their own answer; null = never asked, so no alcohol item. */
  drinks: boolean | null
  current: string[]
  notes: string[]
}

function safetyScreen(risk: Partial<Record<string, boolean>>, medications: readonly MedicationRow[], current: string[], classes: ReturnType<typeof medicationClasses>, drinks: boolean | null = null): Screen {
  const names = current.join('、')
  const notes: string[] = []
  const screen: Screen = {
    weightMed: weightMedicine(current),
    glp1Name: current.find((name) => drugClassesOf(name).includes('glp1ra')) ?? '',
    onMedication: current.length > 0,
    bpTreated: risk.bp_treated === true || current.some((name) => ANTIHYPERTENSIVE.test(name)),
    glucoseRisk: risk.diabetes === true || current.some((name) => GLUCOSE_LOWERING.test(name)),
    hypoDrugs: classes.hypoDrugs,
    sglt2: classes.sglt2,
    sglt2Name: classes.sglt2Name,
    pregnant: classes.pregnant,
    planning: classes.planning,
    breastfeeding: classes.breastfeeding,
    bmi: classes.bmi,
    ckd: classes.ckd,
    antithrombotic: current.some((name) => ANTITHROMBOTIC.test(name)),
    drinks,
    current,
    notes,
  }
  if (screen.onMedication) notes.push(`你的用药计划里有：${names}。饮食和补剂项目开始前，先与医生确认。`)
  if (screen.bpTreated) notes.push('你在用降压药：运动强度先与医生确认。')
  if (screen.sglt2) notes.push(`你在用${screen.sglt2Name}（SGLT2 抑制剂）。进食明显减少、断食或极低碳饮食时，它可以引起正常血糖性酮症酸中毒（euglycaemic ketoacidosis）：血糖不高，但会恶心、呕吐、腹痛、乏力、呼吸深快，需要立即就医。所以这份草稿不安排限时进食、断食或极低碳饮食；生病或进食明显减少时，请先咨询开药的医生是否需要暂停。`)
  if (screen.hypoDrugs) notes.push('你在用胰岛素或磺脲类：运动、少吃和减重都有低血糖风险，先与医生确认。')
  else if (screen.glucoseRisk && !screen.sglt2) notes.push('你有糖尿病或在用降糖药：限时进食、少吃这类饮食改动有低血糖风险，先与医生确认。')
  if (screen.weightMed) notes.push(weightMedNote(screen.weightMed))
  if (screen.pregnant) notes.push('怀孕时不安排限时进食、减重、饮酒和鱼油。')
  if (screen.ckd) notes.push('肾功能不全时不安排未经调整的 DASH 饮食（钾含量高），需要肾脏专科或营养师看过。')
  if (screen.antithrombotic) notes.push('你在用抗凝或抗血小板药：鱼油可能增加出血风险，先与医生确认。')
  notes.push(`这只是几类常见情况的简单筛查，并不完整${medications.length > 0 ? '' : '（记录里没有用药计划）'}；任何改变开始前都可以先问医生。LongPi 不会建议开始、停止或调整任何药物。`)
  return screen
}

function interventionText(row: EffectRow): string {
  return [row.intervention_zh, row.intervention, ...(row.keywords ?? [])].join(' ')
}

function cautionsFor(row: EffectRow, screen: Screen): string[] {
  const out: string[] = []
  const text = interventionText(row)
  if (screen.onMedication && (row.category === 'diet' || row.category === 'supplement')) out.push('你正在服药，开始前先与医生确认')
  if (screen.bpTreated && row.category === 'exercise') out.push('血压用药期间，运动强度先与医生确认')
  if (screen.hypoDrugs && (row.category === 'exercise' || row.category === 'weight' || TIME_RESTRICTED.test(text) || /减重|节食|热量限制/.test(text))) out.push('你在用胰岛素或磺脲类，这项有低血糖风险，先与医生确认')
  else if (screen.glucoseRisk && TIME_RESTRICTED.test(text)) out.push('有低血糖风险，先与医生确认')
  // INT062 fix 5c: a GLP-1 already cuts appetite. The window is kept, with the prescriber told first.
  if (screen.glp1Name && TIME_RESTRICTED.test(text)) out.push(`先告诉开药的医生：${screen.glp1Name}本身会降低食欲、容易引起恶心，进食窗口里要吃够蛋白质和水；恶心、呕吐或无法进食时先停止这一项`)
  if (screen.antithrombotic && FISH_OIL.test(text)) out.push('可能增加出血风险，先与医生确认')
  if (FISH_OIL.test(text)) out.push(FISH_OIL_CAUTION)
  const taking = row.category === 'supplement' ? screen.current.find((name) => sameThing(name, row)) : undefined
  if (taking) out.push(`你的用药计划里已经有「${taking}」`)
  return out
}

function sameThing(medication: string, row: EffectRow): boolean {
  const folded = foldName(medication)
  return [row.intervention_zh, row.intervention, ...(row.keywords ?? [])].map((word) => foldName(word)).filter((word) => word.length >= 2)
    .some((word) => folded.includes(word))
}

/** A candidate for marker `have` also serves priority `want`: weight covers waist. */
function covers(have: string, want: string): boolean {
  return have === want || (have === 'weight' && want === 'waist')
}

function candidatesOf(priorities: Priority[], effects: readonly EffectRow[], biovar: Biovar, screen: Screen, nonSmoker: boolean, excludedIds: readonly string[] = [], excludedPhrases: readonly string[] = []): Candidate[] {
  const rank = (key: string) => {
    const index = priorities.findIndex((row) => covers(key, row.marker_key))
    return index < 0 ? Number.POSITIVE_INFINITY : index
  }
  const classes = medicationClasses(screen.current, { pregnant: screen.pregnant, planning: screen.planning, breastfeeding: screen.breastfeeding, bmi: screen.bmi, ckd: screen.ckd, diabetes: screen.glucoseRisk })
  classes.sglt2 = screen.sglt2
  classes.sglt2Name = screen.sglt2Name
  classes.hypoDrugs = screen.hypoDrugs
  const rows = effects.filter((row) => row.marker_key && (DRAFT_CATEGORIES as readonly string[]).includes(row.category)
    && priorities.some((p) => covers(row.marker_key as string, p.marker_key))
    && !(nonSmoker && SMOKING_CESSATION.test(interventionText(row)))
    && !(screen.drinks !== true && ALCOHOL.test(interventionText(row)))
    && !interventionBlocked(interventionText(row), row.category, row.id, classes, excludedIds, excludedPhrases))
  const out = rows.map((row): Candidate & { magnitude: number } => {
    const key = row.marker_key as string
    const marker = biovar.markers.find((item) => item.key === key) ?? null
    const priority = priorities.find((item) => item.marker_key === key)
    const inRecord = priority ? effectInRecordUnit(row, priority, marker) : null
    const cautions = cautionsFor(row, screen)
    return {
      id: row.id,
      intervention_zh: row.intervention_zh,
      category: row.category,
      marker_key: key,
      label_zh: marker?.label_zh ?? row.marker_zh,
      effect: { value: row.effect.value, unit: row.effect.unit, ...(row.effect.kind ? { kind: row.effect.kind } : {}) },
      duration_weeks: row.duration_weeks ?? null,
      population: row.population,
      design: row.design,
      doi: row.doi,
      verified: row.verified,
      expected_zh: screen.weightMed && key === 'weight' ? expectedWithoutAmount(row, screen.weightMed) : expectedText(row),
      needs_doctor: row.category === 'supplement' || cautions.length > 0,
      cautions_zh: cautions,
      effect_in_record_unit: inRecord,
      ...(row.category !== 'supplement' && row.note_zh ? { note_zh: row.note_zh } : {}),
      examples_zh: row.category === 'exercise' ? (row.keywords ?? []).filter((word) => /[一-鿿]/.test(word) && !row.intervention_zh.includes(word)).slice(0, 4) : [],
      magnitude: magnitudeOf(row, marker, priority),
    }
  })
  out.sort((a, b) => rank(a.marker_key) - rank(b.marker_key) || Number(b.verified) - Number(a.verified) || b.magnitude - a.magnitude || a.id.localeCompare(b.id))
  return out.map(({ magnitude: _magnitude, ...row }) => row)
}

function norm(text: string): string {
  return text.replace(/\s/g, '').toLowerCase()
}

/** |effect| in the marker's own unit, for sorting: mean differences convert; a percent needs the person's value; others sort last. */
function magnitudeOf(row: EffectRow, marker: BiovarMarker | null, priority: Priority | undefined): number {
  if (row.effect.kind === 'mean_difference') {
    if (!marker || norm(row.effect.unit) === norm(marker.unit)) return Math.abs(row.effect.value)
    const factor = Object.entries(marker.convert ?? {}).find(([from]) => norm(from) === norm(row.effect.unit))?.[1]
    return factor == null ? 0 : Math.abs(row.effect.value * factor)
  }
  if (row.effect.kind === 'percent_change' && priority?.value != null) return Math.abs(priority.value * row.effect.value / 100)
  return 0
}

/**
 * The trial average in the unit of the person's latest value, only when it converts exactly: the same
 * unit, a conversion factor from the biological-variation table, or a percent of the latest value.
 * Per-unit, standardized and annualized effects never become a goal.
 */
function effectInRecordUnit(row: EffectRow, priority: Priority, marker: BiovarMarker | null): number | null {
  if (priority.value == null) return null
  if (row.effect.kind === 'percent_change') return priority.value * row.effect.value / 100
  if (row.effect.kind !== 'mean_difference') return null
  if (norm(row.effect.unit) === norm(priority.unit)) return row.effect.value
  if (!marker || norm(marker.unit) !== norm(priority.unit)) return null
  const factor = Object.entries(marker.convert ?? {}).find(([from]) => norm(from) === norm(row.effect.unit))?.[1]
  return factor == null ? null : row.effect.value * factor
}

function fmt(value: number): string {
  return String(Number(Math.abs(value).toPrecision(3)))
}

function amountText(value: number, unit: string): string {
  return unit === '%' ? `${fmt(value)} 个百分点` : `${fmt(value)} ${unit}`.trim()
}

/**
 * The evidence line for a weight item while a weight-moving medicine is in use: the trial and its direction,
 * no kilogram figure, and whose effect the weight change will mostly be (INT062 fix 5b).
 */
export function expectedWithoutAmount(row: EffectRow, medicine: string): string {
  const design = DESIGN_ZH[row.design] ?? row.design
  const weeks = row.duration_weeks ? `，约 ${row.duration_weeks} 周` : ''
  const direction = row.effect.value < 0 ? '有所下降' : '有所上升'
  return `试验中${row.marker_zh}平均${direction}（${row.population}，${design}${weeks}）。这段时间体重的变化主要会来自${medicine}，不按试验数字定目标`
}

export function expectedText(row: EffectRow): string {
  const effect = row.effect
  const direction = effect.value < 0 ? '下降' : '升高'
  const design = DESIGN_ZH[row.design] ?? row.design
  const weeks = row.duration_weeks ? `，约 ${row.duration_weeks} 周` : ''
  const where = `（${row.population}，${design}${weeks}）`
  if (effect.kind === 'percent_change') return `试验中平均使${row.marker_zh}${direction} ${fmt(effect.value)}%${where}`
  if (effect.kind === 'per_unit') return `试验中${effect.per ? `${effect.per}，` : '每单位'}${row.marker_zh}平均${direction} ${amountText(effect.value, effect.unit)}${where}`
  if (effect.kind === 'mean_difference') return `试验中平均使${row.marker_zh}${direction} ${amountText(effect.value, effect.unit)}${where}`
  return `试验中对${row.marker_zh}的效应 ${effect.value}（${effect.unit}）${where}`
}

// --- the draft -------------------------------------------------------------------

interface Group {
  key: string
  rows: Candidate[]
  category: DraftCategory
  markers: string[]
  magnitude: number
}

function clipText(text: string, max: number): string {
  const chars = [...text]
  return chars.length <= max ? text : `${chars.slice(0, Math.max(0, max - 1)).join('')}…`
}

function targetFor(row: Candidate, brief: PlanBrief): DraftItem['target'] {
  const source = row.note_zh ?? ''
  if (row.category === 'exercise' && brief.metrics.includes('dailySteps')) {
    const steps = source.match(/(\d[\d,]*)\s*步/)
    if (steps) return { metric: 'dailySteps', op: '>=', value: Number((steps[1] as string).replace(/,/g, '')), unit: 'count' }
  }
  if (row.category === 'sleep' && brief.focus.includes('sleep') && brief.metrics.includes('dailyTotalSleepTime')) {
    const hours = source.match(/(\d+(?:\.\d+)?)\s*(?:小时|h\b)/)
    if (hours) return { metric: 'dailyTotalSleepTime', op: '>=', value: Number(hours[1]), unit: 'hours' }
  }
  return null
}

/**
 * A research note without the parts that name an amount (6 g 盐, 2 粒): a saved plan keeps no amount in any
 * item (interventions.ts), so the draft shows none either, and what is saved is what was shown.
 */
function noteWithoutAmounts(note: string): string {
  const kept = note.replace(/[。.]\s*$/, '').split(/[；;]/).map((part) => part.trim()).filter((part) => part && !hasDose(part))
  return kept.length > 0 ? `${kept.join('；')}。` : ''
}

function detailFor(group: Group, primary: Candidate): string {
  const evidence = `证据：${primary.expected_zh}，DOI ${primary.doi}。个人效果因人而异。`
  if (group.category === 'supplement') {
    const fish = FISH_OIL.test(primary.intervention_zh) ? `${FISH_OIL_CAUTION}。` : ''
    return clipText(`${SUPPLEMENT_DETAIL}${fish}${evidence}`, DETAIL_MAX)
  }
  const examples = primary.examples_zh.length > 0 ? `，形式可选${primary.examples_zh.join('、')}` : ''
  const behavior = `${CATEGORY_ZH[group.category as Category]}：${primary.intervention_zh}${examples}。`
  const room = DETAIL_MAX - [...behavior].length - [...evidence].length
  const research = noteWithoutAmounts(primary.note_zh ?? '')
  const note = research && room > 12 ? clipText(`研究备注：${research}`, room) : ''
  return clipText(`${behavior}${note}${evidence}`, DETAIL_MAX)
}

/** Two decimals for lab values (2.67 mmol/L), one for larger ones (121.8 mmHg): enough to keep the trial average intact. */
function round(value: number, like: number): number {
  const factor = Math.abs(like) >= 20 ? 10 : 100
  return Math.round(value * factor) / factor
}

/** Verified evidence rows grouped by intervention: one draft item each. A supplement already on the plan is not proposed again. */
function groupsOf(brief: PlanBrief): Map<string, Group> {
  const groups = new Map<string, Group>()
  for (const row of brief.candidates) {
    if (!row.verified || !(DRAFT_CATEGORIES as readonly string[]).includes(row.category)) continue
    if (row.cautions_zh.some((text) => text.startsWith('你的用药计划里已经有'))) continue
    const key = row.intervention_zh
    const group = groups.get(key) ?? { key, rows: [], category: row.category as DraftCategory, markers: [], magnitude: 0 }
    group.rows.push(row)
    for (const p of brief.priorities) if (covers(row.marker_key, p.marker_key) && !group.markers.includes(p.marker_key)) group.markers.push(p.marker_key)
    group.magnitude = Math.max(group.magnitude, Math.abs(row.effect_in_record_unit ?? 0))
    groups.set(key, group)
  }
  return groups
}

function itemFor(group: Group, brief: PlanBrief, today: string): DraftItem {
  const primary = group.rows[0] as Candidate
  const cautions = [...new Set(group.rows.flatMap((row) => row.cautions_zh))]
  return {
    id: primary.id,
    category: group.category,
    category_zh: CATEGORY_ZH[group.category as Category],
    title: primary.intervention_zh,
    detail: detailFor(group, primary),
    start: today,
    markers: [...new Set(group.rows.map((row) => row.label_zh))],
    target: targetFor(primary, brief),
    evidence: { effect_id: primary.id, expected_zh: primary.expected_zh, doi: primary.doi, verified: primary.verified, population: primary.population },
    needs_doctor: group.category === 'supplement' || cautions.length > 0,
    cautions_zh: cautions,
  }
}

/**
 * Up to maxItems (default 3) items that cover the most important priorities with the largest verified
 * effects: one item per intervention, at most one supplement, different categories first. Deterministic;
 * saves nothing. Null when there is nothing evidence-backed to propose.
 */
/** The Chinese reply for this draft. The model sends it and does not call another tool first. */
/** Walking, meal quality, sleep, and smoking or alcohol. No fast, no large weight target, no supplement, no iron. */
export function softHoldDraft(today: string, notes: readonly string[] = []): PlanDraft {
  const item = (id: string, category: DraftCategory, title: string, detail: string): DraftItem => ({
    id, category, category_zh: CATEGORY_ZH[category], title, detail, start: today, markers: [], target: null,
    evidence: { effect_id: id, expected_zh: '这不是试验效应，而是就诊前可以先做的事。', doi: '', verified: false, population: '一般成人' },
    needs_doctor: false, cautions_zh: [],
  })
  const said = notes.filter((line) => line.startsWith('你说过的目标'))
  const weight = said.find((line) => /公斤|\bkg\b|体重/i.test(line))
  const liver = said.some((line) => /脂肪肝/.test(line))
  const extra = ['请先去看医生。就诊前，可以先做以上几项。']
  if (weight) extra.push(`${weight}。就诊前暂不减重。`)
  if (liver) extra.push('饮食这一项也覆盖你说过的脂肪肝，不另设体重目标。')
  if (!weight && !liver) {
    extra.push(notes.find((line) => line.startsWith('尚未记录体重目标')) ?? '尚未记录体重目标或脂肪肝情况。如有，请直接告诉我，例如「体重目标 75 公斤」或「想管脂肪肝」。')
  }
  return {
    title: `就诊前可以先做的事（${today}）`,
    items: [
      item('hold-walk', 'exercise', '每天走路 20 到 30 分钟', '以能正常交谈的速度步行。不能替代就诊。'),
      item('hold-diet', 'diet', '每餐有蔬菜和蛋白质，少喝含糖饮料', '保持平时的三餐，每餐安排蔬菜和蛋白质。'),
      item('hold-sleep', 'sleep', '尽量固定起床时间，睡大约 7 到 9 小时', '睡眠情况不用于判断本次检查结果的好坏。'),
      item('hold-smoke', 'behavior', '如果吸烟，请与医生讨论戒烟；如果饮酒，请先减量', '不吸烟、不饮酒者无需执行此项。'),
    ],
    goals: [],
    notes_zh: extra,
  }
}

export function replyForDraft(brief: PlanBrief, draft: PlanDraft | null): string {
  if (brief.safety.stop_zh) {
    const lines = (draft?.items ?? []).map((item) => `${item.category_zh}：${item.title}。${item.detail}`)
    return [brief.safety.stop_zh, ...lines].join('\n')
  }
  if (!draft) return brief.notes_zh[0] || '目前无法起草方案。'
  const lines = draft.items.map((item) => {
    const caution = item.cautions_zh.length > 0 ? `（${item.cautions_zh.join('；')}）` : ''
    return `${item.category_zh}：${item.title}${caution}。${item.evidence.expected_zh}`
  })
  const dated = draft.title.match(/\d{4}-\d{2}-\d{2}/)
  const repro = [...brief.notes_zh, ...brief.safety.notes_zh].filter((line) => /你在备孕|按备孕处理|你在哺乳|避免饮酒|0\.4 mg/.test(line))
  return [`这是草稿，尚未保存。日期：${dated ? dated[0] : brief.today}。`, ...new Set(repro), ...lines].join('\n')
}

/**
 * Keep the draft's date while the labs and medicines are the same. A new day,
 * by itself, does not retitle the draft. A new exclusion regenerates the items
 * and keeps the date.
 */
export function settleDraft(dataDir: string, brief: PlanBrief, today: string, opts: { maxItems?: number } = {}): PlanDraft | null {
  const prefs = readPlanPrefs(dataDir)
  const clinical = fingerprint({
    stop: brief.safety.stop_zh ?? '',
    meds: brief.safety.medications,
    priorities: brief.priorities.map((row) => [row.marker_key, row.value, row.date]),
  })
  const content = fingerprint({ clinical, ids: brief.excluded_ids ?? [], phrases: brief.excluded_phrases ?? [], max: opts.maxItems ?? null, candidates: brief.candidates.map((row) => row.id), focus: brief.focus })
  if (prefs.content_fp === content && prefs.draft && typeof prefs.draft === 'object') return prefs.draft as PlanDraft
  const draftedOn = prefs.clinical_fp === clinical && prefs.drafted_on ? prefs.drafted_on : today
  const draft = draftPlan(brief, { today: draftedOn, ...(opts.maxItems != null ? { maxItems: opts.maxItems } : {}) })
  writePlanPrefs(dataDir, { ...prefs, clinical_fp: clinical, content_fp: content, drafted_on: draft ? draftedOn : prefs.drafted_on, draft })
  return draft
}

export function draftPlan(brief: PlanBrief, opts: { today: string; maxItems?: number }): PlanDraft | null {
  if (brief.safety.stop_zh) return softHoldDraft(opts.today, [...brief.notes_zh, ...brief.safety.notes_zh])
  const maxItems = Math.max(1, Math.min(5, Math.round(opts.maxItems ?? 3)))
  const rankOf = (key: string) => brief.priorities.findIndex((row) => row.marker_key === key)
  const phrases = brief.excluded_phrases ?? []
  const ids = new Set(brief.excluded_ids ?? [])
  const groups = new Map([...groupsOf(brief)].filter(([key, group]) => !phrases.some((phrase) => key.includes(phrase) || (phrase === '限时进食' && TIME_RESTRICTED.test(key)) || (phrase === '低碳' && /低碳|生酮/.test(key))) && !group.rows.some((row) => ids.has(row.id))))
  const size = brief.priorities.length
  const chosen: Group[] = []
  const covered = new Set<string>()
  // Earlier priorities weigh more; covering two counts more than one.
  const score = (group: Group) => group.markers.filter((key) => !covered.has(key)).reduce((sum, key) => sum + (size - rankOf(key)), 0)
  const pick = (allowRepeat: boolean) => {
    const pool = [...groups.values()].filter((group) => !chosen.includes(group)
      && !(group.category === 'supplement' && chosen.some((item) => item.category === 'supplement'))
      && (allowRepeat || !chosen.some((item) => item.category === group.category))
      && score(group) > 0)
    pool.sort((a, b) => score(b) - score(a) || b.magnitude - a.magnitude || a.key.localeCompare(b.key))
    return pool[0]
  }
  for (const allowRepeat of [false, true]) {
    while (chosen.length < maxItems) {
      const next = pick(allowRepeat)
      if (!next) break
      chosen.push(next)
      for (const key of next.markers) covered.add(key)
    }
  }
  // Room left and every priority with evidence covered: another kind of item for the most important ones.
  while (chosen.length < maxItems) {
    const best = (group: Group) => Math.min(...group.markers.map(rankOf))
    const pool = [...groups.values()].filter((group) => !chosen.includes(group) && group.category !== 'supplement'
      && !chosen.some((item) => item.category === group.category) && group.markers.length > 0)
    pool.sort((a, b) => best(a) - best(b) || b.magnitude - a.magnitude || a.key.localeCompare(b.key))
    const next = pool[0]
    if (!next) break
    chosen.push(next)
  }
  if (chosen.length === 0) return null
  const items = chosen.map((group) => itemFor(group, brief, opts.today))
  const implausible: string[] = []
  const goals = goalsFor(brief, chosen, implausible)
  const notes = [
    '这是草稿：先在对话里按你的习惯和限制调整，确认后才保存。',
    ...(items.some((item) => item.category === 'supplement') ? ['补剂只是可选项：需先与医生确认，不给剂量。'] : []),
    ...brief.priorities.filter((row) => row.value == null && items.some((item) => item.markers.includes(row.label_zh))).map((row) => `${row.label_zh}还没有记录，暂不设目标；下次检查测一次才有基线。`),
    ...implausible.map((label) => `${label}：你现在的数值和试验人群相差较远，试验平均效应不宜直接换算成你的目标，暂不设目标。`),
    ...brief.notes_zh,
    'LongPi 不开始、不停止、也不调整任何处方药。',
  ]
  return { title: `改善方案（${opts.today}）`, items, goals, notes_zh: [...new Set(notes)] }
}

/**
 * The plan to save when the person accepts a draft on the page. Each item is rebuilt from the evidence
 * by its id (so nothing but what the evidence says is saved, and never a drug), goals are recomputed for
 * the items kept and filtered to the ones they kept. The caller normalizes and saves it like any plan.
 */
export function acceptedPlan(brief: PlanBrief, posted: unknown, today: string): { ok: true; plan: Record<string, unknown> } | { ok: false; error: string; problems: string[] } {
  const draft = (posted && typeof posted === 'object' ? posted : {}) as Record<string, unknown>
  const itemsIn = Array.isArray(draft.items) ? draft.items : []
  const problems: string[] = []
  if (itemsIn.length === 0) return { ok: false, error: '草稿里没有任何一项。', problems: ['草稿里没有任何一项。'] }
  const groups = [...groupsOf(brief).values()]
  const kept: Group[] = []
  for (const value of itemsIn.slice(0, 10)) {
    const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    const name = typeof row.title === 'string' && row.title.trim() ? row.title.trim() : id || '未命名'
    if (row.category === 'drug') {
      problems.push(`「${name}」是药物：LongPi 不起草、也不保存药物项目。`)
      continue
    }
    const group = groups.find((item) => item.rows.some((candidate) => candidate.id === id))
    if (!group) {
      problems.push(`「${name}」不在当前按证据起草的选项里，没有保存。请重新打开草稿。`)
      continue
    }
    // One item per intervention, even if two of its evidence rows were posted.
    if (kept.some((item) => item.key === group.key)) continue
    // Rebuild from the evidence row the person saw, even if it was not the group's first.
    kept.push({ ...group, rows: [...group.rows.filter((candidate) => candidate.id === id), ...group.rows.filter((candidate) => candidate.id !== id)] })
  }
  if (kept.filter((group) => group.category === 'supplement').length > 1) problems.push('一份方案最多一项补剂。')
  if (problems.length > 0) return { ok: false, error: problems[0] as string, problems }
  const wanted = new Set((Array.isArray(draft.goals) ? draft.goals : []).map((goal) => (goal && typeof goal === 'object' ? String((goal as Record<string, unknown>).marker ?? '') : '')))
  const goals = goalsFor(brief, kept).filter((goal) => wanted.has(goal.marker))
  // The posted title goes through the same dose stripping as any plan; nothing left, the server's own title.
  const title = stripDoses(typeof draft.title === 'string' ? draft.title.trim().slice(0, 60) : '').text || `改善方案（${today}）`
  return {
    ok: true,
    plan: {
      title,
      source: 'board',
      note: 'LongPi 按检查结果和研究证据起草，本人在健康页确认后保存。',
      items: kept.map((group) => {
        const item = itemFor(group, brief, today)
        return { category: item.category, title: item.title, detail: item.detail, start: today, markers: item.markers, ...(item.target ? { target: item.target } : {}) }
      }),
      goals: goals.map((goal) => ({ marker: goal.marker, value: goal.value, unit: goal.unit })),
    },
  }
}

type Goal = PlanDraft['goals'][number]

/**
 * Today's value plus one row's trial average. A change that rounds away is no goal; nor is one that would
 * reach zero or move today's value by more than half: the person is then too far from the trial's
 * population for its average to stand as their target.
 */
function goalFrom(priority: Priority, row: Candidate): Omit<Goal, 'basis_item_id'> | 'rounds' | 'implausible' {
  const today = priority.value as number
  const delta = row.effect_in_record_unit as number
  const value = round(today + delta, today)
  if (value === today) return 'rounds'
  if (value <= 0 || Math.abs(delta) > Math.abs(today) * GOAL_MAX_CHANGE) return 'implausible'
  const signed = `${delta < 0 ? '−' : '+'}${amountText(delta, priority.unit)}`
  return { marker: priority.label_zh, value, unit: priority.unit, basis_zh: `${GOAL_BASIS}（${row.intervention_zh}：${signed}）` }
}

/** One goal per priority with a value: from the first chosen item whose evidence gives a usable one. Markers left without one because every goal was implausible go into `implausible`. */
function goalsFor(brief: PlanBrief, chosen: Group[], implausible: string[] = []): Goal[] {
  const out: Goal[] = []
  for (const priority of brief.priorities) {
    if (priority.value == null) continue
    if (brief.safety.no_weight_loss && priority.marker_key === 'weight') continue
    if (brief.safety.weight_med && priority.marker_key === 'weight') continue
    let skipped = false
    for (const group of chosen) {
      const rows = group.rows.filter((item) => item.marker_key === priority.marker_key && item.verified && item.effect_in_record_unit != null)
      const goal = rows.map((row) => goalFrom(priority, row)).find((row) => typeof row === 'object')
      if (goal && typeof goal === 'object') {
        out.push({ ...goal, basis_item_id: (group.rows[0] as Candidate).id })
        skipped = false
        break
      }
      if (rows.some((row) => goalFrom(priority, row) === 'implausible')) skipped = true
    }
    if (skipped) implausible.push(priority.label_zh)
  }
  return out
}
