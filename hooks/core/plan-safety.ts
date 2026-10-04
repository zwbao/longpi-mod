// Who must not be handed a lifestyle draft, and which items are unsafe for the
// medicines they already take. Numbers are the thresholds in the field-test
// clinical review (male haemoglobin, MCV, RDW-CV, undiagnosed diabetes-range
// glucose, LDL-C, office SBP). A known diagnosis is the person's own yes, or a
// current glucose-lowering medicine — a lab on its own is not "the doctor knows".

import { dateZh } from './ux/plain.ts'

export const FISH_OIL_CAUTION = '试验用的是处方级的较高用量 EPA+DHA，鱼油可能增加出血和房颤（心房颤动）风险；这不是给你的用量，先与医生确认'
export const HYPO_AWAKE_ZH = '先吃 15 克快速吸收的糖（葡萄糖片或一小杯含糖果汁），15 分钟后复测；仍低于 3.9 mmol/L 就再吃 15 克。'
export const HYPO_UNCONSCIOUS_ZH = '昏迷、叫不醒或无法吞咽时不要喂东西，请立即拨打 120。'
/** After a low on insulin or a sulfonylurea: the next dose is the prescriber's, or 120. Not "stop the insulin". */
export const HYPO_NEXT_DOSE_ZH = '这次低血糖先按上面处理。下一次胰岛素或磺脲类的剂量，联系开药的医生；人已经叫不醒、无法吞咽或你不确定时，拨打 120。'

/** Tells them to skip or stop an insulin injection. "不要自行停药" is not this. */
const INSULIN_HOLD = /(?:不要|别|勿)(?:再|继续)(?:注射|打)(?:一?针)?胰岛素|(?:不要|别|勿)再打胰岛素|(?<!自行)(?<!自己)(?:停掉|停止|停用|先停)胰岛素|把胰岛素停|别再打胰岛素/
export const DOCTOR_ZH = '请先去看医生。就诊前，可以先坚持步行、每餐安排蔬菜和蛋白质、保持规律睡眠；如果吸烟或饮酒，请先减量。这份安排不含断食、大幅减重、补剂或补铁。'

export const SGLT2 = /列净|gliflozin|dapagliflozin|empagliflozin|canagliflozin|ertugliflozin/i
export const INSULIN_SU = /胰岛素|\binsulin\b|格列(?!净)|磺脲|消渴丸|glibenclamide|glimepiride|gliclazide|glipizide|glyburide/i
export const TIME_RESTRICTED = /限时进食|time-restricted|16:8|轻断食|断食/i
export const VERY_LOW_CARB = /生酮|极低碳|低碳水|低碳饮食|ketogenic|\bketo\b|very-low-carb|低碳/i
export const FISH_OIL = /鱼油|omega-?3|ω-?3|\bepa\b|\bdha\b/i
export const DASH = /DASH|得舒/i
/** Stated pregnancy. 备孕 / 准备怀孕 are planning, not this. 碰到怀孕 is a question, not a statement. */
const PREGNANT_STATED = /怀孕了|已怀孕|正在怀孕|我(?:现在|已经|正在|在)?怀孕|怀孕\s*\d+\s*(?:周|个月)|(?<!备)孕期|(?<![备])妊娠(?!糖尿病)/
/** 备孕, 准备怀孕, 计划要孩子. */
export const PLANNING_WORDS = /备孕|准备怀孕|计划怀孕|准备要孩子|计划要孩子/
export const FEEDING_WORDS = /哺乳|母乳|breastfeeding/i
const CKD_WORDS = /肾功能不全|慢性肾病|透析|\bckd\b/i
const WEIGHT_LOSS = /减重|减肥|热量限制|热量缺口/
const STOPPED_MED = /^\s*(?:stopped|ended|inactive|completed|discontinued|停用|已停|已停用|停药|结束|已结束|已完成)\s*$/i

/** Population guidance for pregnancy planning in China. Not a personal prescription. */
export const FOLIC_GUIDANCE_ZH = '备孕叶酸的一般人群建议是每天 0.4 mg（400 微克），这是中国备孕的常规人群指导，不是新开的个人剂量。'
const REPRO_RULES_ZH = '方案不安排限时进食或断食；体重指数低于 24 时不设减重目标。避免饮酒。'
export const PLANNING_NOTE_ZH = `你在备孕：${REPRO_RULES_ZH}${FOLIC_GUIDANCE_ZH}`
export const FOLIC_PLANNING_NOTE_ZH = `用药计划里的叶酸是每天 0.4 mg。按备孕处理这份方案：${REPRO_RULES_ZH}${FOLIC_GUIDANCE_ZH}`
export const BREASTFEEDING_NOTE_ZH = `你在哺乳：${REPRO_RULES_ZH}`

export interface PanelPoint {
  name: string
  label?: string
  loinc?: string
  value: number
  unit: string
  date: string
}

export interface SafetyClasses {
  sglt2: boolean
  sglt2Name: string
  hypoDrugs: boolean
  pregnant: boolean
  /** Planning a pregnancy (备孕 / 准备怀孕 / 计划要孩子), or the standard 0.4 mg folic acid plan. */
  planning: boolean
  breastfeeding: boolean
  /** Latest BMI when height and weight, or a BMI row, are on the record. */
  bmi: number | null
  ckd: boolean
  diabetesKnown: boolean
}

export interface StopHit {
  key: 'hgb' | 'mcv' | 'rdw' | 'ferritin' | 'glucose' | 'hba1c' | 'ldl' | 'sbp'
  /** Short, for the overview title: 血红蛋白 120 g/L 偏低. */
  short_zh: string
  /** The full clause with the date and, when the checkups show it, the fall across them. */
  text_zh: string
  /** The latest value in the unit named, its date, and the fall when there is one (for the brief and the fact pack). */
  value?: number
  unit?: string
  date?: string
  label_zh?: string
  low?: boolean
  fall?: Array<{ date: string; value: number }>
}

export interface StopResult {
  stop: boolean
  /**
   * The profile has no sex and a value sits between the women's and the men's limits.
   * That is not a referral. The page asks for sex first.
   */
  needs_sex?: boolean
  /** 请先去看医生：… — the whole reply when a plan is asked for. */
  sentence_zh: string
  /** The overview's next step title. */
  title_zh: string
  hits: StopHit[]
}

export function medicationClasses(names: readonly string[], flags: { pregnant?: boolean | null; planning?: boolean | null; breastfeeding?: boolean | null; bmi?: number | null; ckd?: boolean | null; diabetes?: boolean | null } = {}): SafetyClasses {
  const sglt2Name = names.find((name) => SGLT2.test(name)) ?? ''
  return {
    sglt2: sglt2Name !== '',
    sglt2Name,
    hypoDrugs: names.some((name) => INSULIN_SU.test(name)),
    pregnant: flags.pregnant === true,
    planning: flags.planning === true,
    breastfeeding: flags.breastfeeding === true,
    bmi: typeof flags.bmi === 'number' && Number.isFinite(flags.bmi) ? flags.bmi : null,
    ckd: flags.ckd === true,
    diabetesKnown: flags.diabetes === true || names.some((name) => /二甲双胍|列汀|列净|胰岛素|阿卡波糖|鲁肽|降糖|metformin|insulin|gliptin|gliflozin|glutide|glipizide|gliclazide|glimepiride|acarbose/i.test(name)),
  }
}

/** A denial. Bare 不 is too wide (不安排, 不要). 未 is not used alone so 未来 does not count. */
const DENY_PREGNANT = /(?:没有|没|不是|并不|并未|否认).{0,8}(?:在)?怀孕|(?:没有|没|不是|并不|并未|否认).{0,8}(?:在)?妊娠/
const DENY_PLANNING = /(?:没有|没|不是|并不|并未|否认).{0,8}(?:在)?备孕|(?:没有|没).{0,8}准备怀孕|(?:没有|没).{0,8}计划(?:要孩子|怀孕)|不在备孕|没有写备孕/
const DENY_FEEDING = /(?:没有|没|不是|并不|并未|否认).{0,8}(?:在)?(?:哺乳|母乳)/

export function reproductiveDenied(text: string): { pregnant: boolean; planning: boolean; breastfeeding: boolean } {
  const raw = String(text ?? '')
  return { pregnant: DENY_PREGNANT.test(raw), planning: DENY_PLANNING.test(raw), breastfeeding: DENY_FEEDING.test(raw) }
}

/** Pregnancy, planning one, or breastfeeding, from the person's own words. A denial wins over the same sentence. */
export function reproductiveFromText(text: string): { pregnant: boolean; planning: boolean; breastfeeding: boolean } {
  const raw = String(text ?? '')
  const denied = reproductiveDenied(raw)
  return {
    pregnant: PREGNANT_STATED.test(raw) && !denied.pregnant,
    planning: PLANNING_WORDS.test(raw) && !denied.planning,
    breastfeeding: FEEDING_WORDS.test(raw) && !denied.breastfeeding,
  }
}

export function flagsFromText(text: string): { pregnant: boolean; ckd: boolean; planning: boolean; breastfeeding: boolean } {
  const repro = reproductiveFromText(text)
  return { pregnant: repro.pregnant, ckd: CKD_WORDS.test(text), planning: repro.planning, breastfeeding: repro.breastfeeding }
}

/** 叶酸 0.4 mg (400 μg) a day: the standard preconception dose in China. A lab folate result is not a medicine row. */
export function preconceptionFolic(rows: readonly { name?: string; status?: string; until?: string; schedule?: string; recorded_dose?: string }[]): boolean {
  return rows.some((row) => {
    const name = row.name ?? ''
    if (!name || STOPPED_MED.test(row.status ?? '') || row.until) return false
    if (!/叶酸|folic|folate/i.test(name)) return false
    const dose = `${row.schedule ?? ''} ${row.recorded_dose ?? ''}`.normalize('NFKC')
    return /0\.4\s*(?:mg|毫克)|400\s*(?:μg|µg|ug|mcg|微克)/i.test(dose)
  })
}

export function bodyMassIndex(indicators: readonly { name: string; label?: string; loinc?: string; value: string | number; unit?: string; date?: string }[]): number | null {
  const rows = indicators.flatMap((row) => {
    const value = typeof row.value === 'number' ? row.value : Number(String(row.value).replace(/,/g, ''))
    if (!Number.isFinite(value)) return []
    return [{ value, unit: row.unit ?? '', date: row.date ?? '', loinc: row.loinc ?? '', text: `${row.name} ${row.label ?? ''}` }]
  })
  const latest = (pick: (row: (typeof rows)[number]) => boolean) => rows.filter(pick).reduce<(typeof rows)[number] | null>((best, row) => (!best || row.date > best.date ? row : best), null)
  const stated = latest((row) => row.loinc === '39156-5' || /体重指数|体质指数|\bBMI\b/i.test(row.text))
  const weight = latest((row) => (row.loinc === '29463-7' || /体重|body\s*mass|\bweight\b/i.test(row.text)) && !/指数|bmi|腰/i.test(row.text))
  const height = latest((row) => row.loinc === '8302-2' || row.loinc === '3137-7' || /身高|\bheight\b/i.test(row.text))
  const measuredOn = weight && height ? (weight.date < height.date ? weight.date : height.date) : ''
  if (stated && stated.value >= 12 && stated.value <= 60 && (!measuredOn || stated.date >= measuredOn)) return stated.value
  if (!weight || !height) return null
  let kg = weight.value
  if (/斤|jin/i.test(weight.unit)) kg *= 0.5
  else if (/lb/i.test(weight.unit)) kg *= 0.45359237
  let meters = height.value
  if (/cm|厘米/i.test(height.unit) || meters > 3) meters /= 100
  if (!(kg >= 20 && kg <= 300) || !(meters >= 1 && meters <= 2.5)) return null
  return kg / (meters * meters)
}

/** Below 24, or unknown: no weight-loss target while planning or breastfeeding. Pregnancy blocks weight loss at any BMI. */
export function holdWeightLoss(classes: Pick<SafetyClasses, 'pregnant' | 'planning' | 'breastfeeding' | 'bmi'>): boolean {
  if (classes.pregnant) return true
  if (!(classes.planning || classes.breastfeeding)) return false
  return classes.bmi == null || classes.bmi < 24
}

/** Phrases the person has ruled out, kept so the next draft does not grow them back. */
export function exclusionsFromText(text: string): string[] {
  const out: string[] = []
  if (/不要限时|不限时|别限时|不用限时|不接受限时|去掉限时|丢掉限时|不做限时|不准限时|拒绝限时|不要断食|不断食|不要轻断食|不要\s*16:8|不要\s*16：8/.test(text)) out.push('限时进食')
  if (/不要生酮|不生酮|不要低碳|不低碳|不要极低碳|不极低碳/.test(text)) out.push('低碳')
  return out
}

export function interventionBlocked(text: string, category: string, id: string, classes: SafetyClasses, excludedIds: readonly string[], excludedPhrases: readonly string[]): boolean {
  if (excludedIds.includes(id)) return true
  if (excludedPhrases.some((phrase) => text.includes(phrase) || (phrase === '低碳' && VERY_LOW_CARB.test(text)) || (phrase === '限时进食' && TIME_RESTRICTED.test(text)))) return true
  if (classes.sglt2 && (TIME_RESTRICTED.test(text) || VERY_LOW_CARB.test(text))) return true
  const reproductive = classes.pregnant || classes.planning || classes.breastfeeding
  if (reproductive && (TIME_RESTRICTED.test(text) || VERY_LOW_CARB.test(text) || /饮酒|酒精/.test(text) || FISH_OIL.test(text))) return true
  if (holdWeightLoss(classes) && (category === 'weight' || WEIGHT_LOSS.test(text))) return true
  if (classes.ckd && DASH.test(text)) return true
  return false
}

function textOf(point: PanelPoint): string {
  return `${point.name} ${point.label ?? ''}`
}

function newest(points: PanelPoint[]): PanelPoint | null {
  return points.reduce<PanelPoint | null>((best, row) => (!best || row.date > best.date ? row : best), null)
}

function hbValue(point: PanelPoint): number {
  return /dl/i.test(point.unit) && point.value < 30 ? point.value * 10 : point.value
}

function glucoseMmol(point: PanelPoint): number {
  return /mg/i.test(point.unit) || point.value > 25 ? point.value / 18 : point.value
}

function ldlMmol(point: PanelPoint): number {
  return /mg/i.test(point.unit) || point.value > 15 ? point.value / 38.67 : point.value
}

function hba1cPct(point: PanelPoint): number | null {
  if (/mmol\/mol/i.test(point.unit)) return (point.value / 10.929) + 2.15
  if (point.value > 20) return null
  return point.value
}

function ferritinNgMl(point: PanelPoint): number {
  return /pmol/i.test(point.unit) ? point.value / 2.247 : point.value
}

function isHb(point: PanelPoint): boolean {
  if (point.loinc === '718-7') return true
  const name = textOf(point)
  if (/糖化|平均|压积|MCH|浓度|含量|尿|A1c/i.test(name)) return false
  return /血红蛋白|^\s*(?:Hb|HGB)\b|Hemoglobin/i.test(name)
}

function isMcv(point: PanelPoint): boolean {
  return point.loinc === '787-2' || point.loinc === '30428-7' || /平均红细胞体积|^\s*MCV\b/i.test(textOf(point))
}

function isRdwCv(point: PanelPoint): boolean {
  const name = textOf(point)
  // 血小板分布宽度 (PDW) and the SD form in fL are other measurements.
  if (/标准差|RDW-?SD|血小板|PDW|PLT/i.test(name) || /fl/i.test(point.unit)) return false
  return point.loinc === '788-0' || point.loinc === '30385-9' || /红细胞分布宽度|RDW/i.test(name)
}

function isFerritin(point: PanelPoint): boolean {
  return point.loinc === '2276-4' || /铁蛋白|ferritin/i.test(textOf(point))
}

function isGlucose(point: PanelPoint): boolean {
  const name = textOf(point)
  if (/尿|糖化|负荷|餐后|随机/.test(name)) return false
  return point.loinc === '14771-0' || point.loinc === '1558-6' || /空腹血糖|空腹葡萄糖|空腹血葡萄糖/.test(name)
}

function isHba1c(point: PanelPoint): boolean {
  return point.loinc === '4548-4' || /糖化血红蛋白|HbA1c|A1[Cc]/.test(textOf(point))
}

function isLdl(point: PanelPoint): boolean {
  return point.loinc === '2089-1' || point.loinc === '13457-7' || /低密度脂蛋白|^\s*LDL/i.test(textOf(point))
}

function isSbp(point: PanelPoint): boolean {
  const name = textOf(point)
  if (/舒张|DBP/i.test(name)) return false
  return point.loinc === '8480-6' || /收缩压|^\s*SBP\b/i.test(name)
}

function isEgfr(point: PanelPoint): boolean {
  return /egfr|肾小球滤过/i.test(textOf(point))
}

/** Rows the red-cell trend is read from (their earlier checkups too). */
export function trendRow(point: Pick<PanelPoint, 'name' | 'label' | 'loinc' | 'unit'>): boolean {
  const row = { ...point, value: 0, date: '' }
  return isHb(row) || isMcv(row)
}

function num(value: number): string {
  return String(Number(value.toFixed(2)))
}

/** One value per checkup day (the last of the day), oldest first. */
function byDay(points: readonly PanelPoint[], valueOf: (point: PanelPoint) => number): Array<{ date: string; value: number }> {
  const days = new Map<string, number>()
  for (const row of [...points].filter((item) => item.date).sort((a, b) => a.date.localeCompare(b.date))) days.set(row.date.slice(0, 10), valueOf(row))
  return [...days].map(([date, value]) => ({ date, value }))
}

/**
 * A fall across checkups: the last three each lower than the one before and
 * together down by at least minPct, or any two down by twice that.
 */
function progressiveFall(days: Array<{ date: string; value: number }>, minPct: number): Array<{ date: string; value: number }> | null {
  if (days.length < 2) return null
  const recent = days.slice(-3)
  const last = recent.at(-1) as { date: string; value: number }
  const falling = recent.every((row, index) => index === 0 || row.value < (recent[index - 1] as { value: number }).value)
  const drop = (from: number) => (from - last.value) / from
  if (recent.length >= 3 && falling && drop((recent[0] as { value: number }).value) >= minPct) return recent
  const peak = days.slice(0, -1).reduce((best, row) => (row.value > best.value ? row : best), days[0] as { date: string; value: number })
  if (drop(peak.value) >= minPct * 2) return [peak, last]
  return null
}

function trendText(rows: Array<{ date: string; value: number }> | null): string {
  if (!rows) return ''
  return `，${rows.length} 次体检 ${rows.map((row) => num(row.value)).join(' → ')}（${dateZh(rows[0]?.date)}至 ${dateZh(rows.at(-1)?.date)}）持续下降`
}

function dated(point: PanelPoint): string {
  return point.date ? `（${dateZh(point.date.slice(0, 10))}）` : ''
}

/**
 * Lower limits used when the report's own range is not in the record (Mirobody keeps no ranges).
 * A value below both limits is low for either sex. A value between the women's and the men's
 * limits asks for sex and is not a referral: the men's limit is not applied to someone who may be female.
 */
const HB_LOW = { male: 130, female: 115 } as const
const FERRITIN_LOW = { male: 30, female: 15 } as const
const SEX_ASK_ZH = '档案中尚无性别。该数值介于男女参考范围之间，请先填写性别，再判断是否需要就医。本次暂不提示转诊。'

/**
 * Critical values and a red-cell pattern that need a doctor before any
 * lifestyle plan. points holds the latest value of every indicator and, for
 * haemoglobin and MCV, their earlier checkups. One plain sentence names each
 * value with its number, calls a low value 偏低, and sends the person to a doctor.
 */
export function clinicalStop(input: { sex: string; diabetesKnown: boolean; points: readonly PanelPoint[] }): StopResult {
  const hits: StopHit[] = []
  const sex = input.sex === 'male' ? 'male' : input.sex === 'female' ? 'female' : 'unknown'
  const sexZh = sex === 'female' ? '女性' : '男性'
  let needsSex = false
  const limitOf = (table: { male: number; female: number }) => (sex === 'female' ? table.female : sex === 'male' ? table.male : table.female)
  const lowFor = (value: number, table: { male: number; female: number }) => {
    if (sex === 'unknown' && value >= table.female && value < table.male) {
      needsSex = true
      return false
    }
    return value < limitOf(table)
  }
  const lowWords = (table: { male: number; female: number }) => (
    sex === 'unknown' ? `偏低，低于女性参考下限 ${table.female}，男女均属偏低` : `偏低，低于${sexZh}参考下限 ${limitOf(table)}`
  )
  const hb = input.points.filter(isHb)
  const mcv = input.points.filter(isMcv)
  const latestHb = newest(hb)
  const latestMcv = newest(mcv)
  const latestRdw = newest(input.points.filter(isRdwCv))
  const latestFerritin = newest(input.points.filter(isFerritin))
  const hbFall = progressiveFall(byDay(hb, hbValue), 0.1)
  const mcvFall = progressiveFall(byDay(mcv, (row) => row.value), 0.08)
  if (latestHb) {
    const value = hbValue(latestHb)
    const low = lowFor(value, HB_LOW)
    if (low || hbFall) {
      hits.push({
        key: 'hgb', value, unit: 'g/L', date: latestHb.date.slice(0, 10), label_zh: '血红蛋白', low, ...(hbFall ? { fall: hbFall } : {}),
        short_zh: `血红蛋白 ${num(value)} g/L ${low ? '偏低' : '在下降'}`,
        text_zh: `血红蛋白 ${num(value)} g/L${dated(latestHb)}${low ? lowWords(HB_LOW) : ''}${trendText(hbFall)}`,
      })
    }
  }
  if (latestMcv) {
    const low = latestMcv.value < 80
    if (low || mcvFall) {
      hits.push({
        key: 'mcv', value: latestMcv.value, unit: 'fL', date: latestMcv.date.slice(0, 10), label_zh: '平均红细胞体积', low, ...(mcvFall ? { fall: mcvFall } : {}),
        short_zh: `平均红细胞体积 ${num(latestMcv.value)} fL ${low ? '偏低' : '在下降'}`,
        text_zh: `平均红细胞体积（MCV）${num(latestMcv.value)} fL${dated(latestMcv)}${low ? '偏低，低于 80' : ''}${trendText(mcvFall)}`,
      })
    }
  }
  if (latestRdw && latestRdw.value > 15) {
    hits.push({
      key: 'rdw', value: latestRdw.value, unit: '%', date: latestRdw.date.slice(0, 10), label_zh: '红细胞分布宽度', low: false,
      short_zh: `红细胞分布宽度 ${num(latestRdw.value)}% 偏高`,
      text_zh: `红细胞分布宽度（RDW-CV）${num(latestRdw.value)}%${dated(latestRdw)}偏高，高于常用参考上限 15%`,
    })
  }
  if (latestFerritin) {
    const value = ferritinNgMl(latestFerritin)
    if (value > 0 && lowFor(value, FERRITIN_LOW)) {
      hits.push({
        key: 'ferritin', value, unit: 'ng/mL', date: latestFerritin.date.slice(0, 10), label_zh: '铁蛋白', low: true,
        short_zh: `铁蛋白 ${num(value)} ng/mL 偏低`,
        text_zh: `铁蛋白 ${num(value)} ng/mL${dated(latestFerritin)}${lowWords(FERRITIN_LOW).replace('参考下限', '常用参考下限')}`,
      })
    }
  }
  if (!input.diabetesKnown) {
    const glucose = newest(input.points.filter(isGlucose))
    const a1c = newest(input.points.filter(isHba1c))
    if (glucose && glucoseMmol(glucose) >= 7) {
      hits.push({
        key: 'glucose', value: Number(glucoseMmol(glucose).toFixed(2)), unit: 'mmol/L', date: glucose.date.slice(0, 10), label_zh: '空腹血糖', low: false,
        short_zh: `空腹血糖 ${num(glucoseMmol(glucose))} mmol/L 偏高`,
        text_zh: `空腹血糖 ${num(glucoseMmol(glucose))} mmol/L${dated(glucose)}偏高，达到糖尿病诊断范围（≥7.0），记录中尚无医生已知悉此情况的信息`,
      })
    }
    const pct = a1c ? hba1cPct(a1c) : null
    if (a1c && pct != null && pct >= 6.5) {
      hits.push({
        key: 'hba1c', value: Number(pct.toFixed(2)), unit: '%', date: a1c.date.slice(0, 10), label_zh: '糖化血红蛋白', low: false,
        short_zh: `糖化血红蛋白 ${num(pct)}% 偏高`,
        text_zh: `糖化血红蛋白 ${num(pct)}%${dated(a1c)}偏高，达到糖尿病诊断范围（≥6.5%），记录中尚无医生已知悉此情况的信息`,
      })
    }
  }
  const ldl = newest(input.points.filter(isLdl))
  if (ldl && ldlMmol(ldl) >= 4.9) {
    hits.push({
      key: 'ldl', value: Number(ldlMmol(ldl).toFixed(2)), unit: 'mmol/L', date: ldl.date.slice(0, 10), label_zh: '低密度脂蛋白胆固醇', low: false,
      short_zh: `低密度脂蛋白胆固醇 ${num(ldlMmol(ldl))} mmol/L 很高`,
      text_zh: `低密度脂蛋白胆固醇 ${num(ldlMmol(ldl))} mmol/L${dated(ldl)}很高（≥4.9），需要医生评估`,
    })
  }
  const sbp = newest(input.points.filter(isSbp))
  if (sbp && sbp.value >= 180) {
    hits.push({
      key: 'sbp', value: sbp.value, unit: 'mmHg', date: sbp.date.slice(0, 10), label_zh: '收缩压', low: false,
      short_zh: `收缩压 ${num(sbp.value)} mmHg 很高`,
      text_zh: `收缩压 ${num(sbp.value)} mmHg${dated(sbp)}很高（≥180）`,
    })
  }
  if (hits.length === 0) {
    if (needsSex) return { stop: false, needs_sex: true, sentence_zh: SEX_ASK_ZH, title_zh: '填写性别', hits: [] }
    return { stop: false, sentence_zh: '', title_zh: '', hits: [] }
  }
  const redCell = hits.some((hit) => hit.key === 'hgb' || hit.key === 'mcv' || hit.key === 'rdw' || hit.key === 'ferritin')
  // A falling red-cell count with low ferritin or small red cells is usually iron deficiency, whose cause in an adult is
  // often in the gut: the gastroenterologist is named too, with a time frame (the season already says 血液科或消化科).
  const iron = hits.some((hit) => hit.key === 'ferritin' || (hit.key === 'mcv' && hit.low))
  const where = redCell ? `（可先就诊全科或血液科${iron ? '，缺铁的原因常要消化科一起查' : ''}，尽量在 1 到 2 周内就诊）` : ''
  const urgent = hits.some((hit) => hit.key === 'sbp') ? '血压明显偏高，请尽快就医；如果同时有胸痛、剧烈头痛、一侧无力或说话不清，立即拨打 120。' : ''
  const selfTreat = redCell ? '在医生查明原因之前，不要自己买铁剂或补剂。' : ''
  const sentence = `请先去看医生：${hits.map((hit) => hit.text_zh).join('；')}。${urgent}请携带这几次体检报告就诊${where}，查明原因。${selfTreat}${DOCTOR_ZH}`
  return { stop: true, sentence_zh: sentence, title_zh: `请先去看医生：${hits.map((hit) => hit.short_zh).slice(0, 3).join('，')}`, hits, ...(needsSex ? { needs_sex: true } : {}) }
}

export function egfrBelowCkd(points: readonly PanelPoint[]): boolean {
  const latest = newest(points.filter(isEgfr))
  return latest != null && latest.value < 60 && latest.value > 0
}

export interface HypoRead {
  now: boolean
  unconscious: boolean
}

/** A low reading or hypo symptoms happening now, not a past number told as history. */
export function hypoglycaemiaNow(text: string): HypoRead {
  const raw = String(text ?? '').normalize('NFKC')
  const unconscious = /昏迷|叫不醒|无法吞咽|不省人事|喂不进/.test(raw)
  const symptoms = /手抖|手在抖|手一直抖|手有点抖|发抖|哆嗦|出冷汗|冒冷汗|心慌|心悸|虚汗|快晕|头晕眼花|饿得发慌/.test(raw)
  const lows: number[] = []
  for (const hit of raw.matchAll(/(\d+(?:\.\d+)?)/g)) {
    const value = Number(hit[1])
    if (!(value > 0 && value < 3.9)) continue
    const at = hit.index ?? 0
    const around = raw.slice(Math.max(0, at - 16), at + hit[0].length + 18)
    if (!/血糖|指尖|mmol|毫摩|手指/.test(around)) continue
    const clauseStart = Math.max(raw.lastIndexOf('。', at), raw.lastIndexOf('\n', at), raw.lastIndexOf('；', at))
    const clause = raw.slice(clauseStart + 1, at + 24)
    const past = /去年|前年|那年|以前|曾经|20[0-2]\d|病史/.test(clause)
    const current = /刚才|刚刚|现在|今天|这会儿|早上|上午|中午|下午|晚上|饭前|午饭前|午餐前|中午前|餐前|手抖|在抖|出冷汗|心慌/.test(clause) || symptoms
    if (past && !current) continue
    lows.push(value)
  }
  const named = /低血糖/.test(raw) && !/怎么办才能|怎么预防|如何预防|会不会|风险/.test(raw) && (symptoms || /刚才|刚刚|现在|今天|又/.test(raw))
  const now = lows.length > 0 || named || (unconscious && /低血糖|血糖/.test(raw))
  return { now, unconscious: now && unconscious }
}

/**
 * Whether a reply to a hypoglycaemia message leads with the first step: within
 * its first three sentences, one names about 15 g of fast sugar before any
 * sentence sends them to a doctor, a medicine or a plan. When they cannot be
 * woken, 120 comes first instead.
 */
export function holdsInsulin(reply: string): boolean {
  return INSULIN_HOLD.test(String(reply ?? '').normalize('NFKC'))
}

export function leadsWithHypoFirstStep(reply: string, unconscious = false): boolean {
  const plain = String(reply ?? '').replace(/\*\*|__|`/g, '').split('\n').map((line) => line.replace(/^[\s#>*\-•]+|^\d+[.、)）]\s*/g, '').trim()).filter(Boolean).join('\n')
  const sentences = plain.split(/[。！!；;\n]/).map((part) => part.trim()).filter(Boolean).slice(0, 3)
  for (const sentence of sentences) {
    if (unconscious ? /120/.test(sentence) : /15\s*(?:克|g(?![a-z]))/i.test(sentence) && /糖|果汁|碳水|葡萄糖/.test(sentence)) return true
    if (/医生|医院|就医|门诊|药|方案|计划/.test(sentence)) return false
  }
  return false
}
