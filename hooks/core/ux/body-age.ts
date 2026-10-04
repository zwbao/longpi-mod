// Which inputs moved a PhenoAge change, and the one sentence the page and the chat both use.
// Weights are the unrounded Levine coefficients in phenoage_calc.R (orig=TRUE),
// the same numbers longevity-skills stores in presets.py. Age is not a driver.

const PANEL_KEYS: Array<keyof PhenoPanel> = [
  'albumin_gL', 'creat_umol', 'glucose_mmol', 'crp_mg_dl', 'lymph_pct',
  'mcv_fl', 'rdw_pct', 'alp_u_l', 'wbc_10e3', 'age',
]

// The skill converts declared units itself (skill.json); the attribution below needs the method's units too.
// Factor from the unit a record may carry to the key's unit. A unit not listed is taken as already right.
const TO_METHOD_UNIT: Record<string, Record<string, number>> = {
  albumin_gL: { 'g/dl': 10, 'g/l': 1 },
  creat_umol: { 'mg/dl': 88.4, 'umol/l': 1, 'µmol/l': 1, 'μmol/l': 1 },
  glucose_mmol: { 'mg/dl': 1 / 18.016, 'mmol/l': 1 },
  crp_mg_dl: { 'mg/l': 0.1, 'mg/dl': 1 },
}

function inMethodUnit(key: string, value: number, unit: string | undefined): number {
  const table = TO_METHOD_UNIT[key]
  const factor = table?.[(unit ?? '').trim().toLowerCase().replace(/\s+/g, '')]
  return factor ? value * factor : value
}

/** A skill measurement list (with the unit each value came in), plus the age used for that draw. */
export function panelFromMeasurements(rows: readonly { key: string; value: number | string; unit?: string }[], age: number): PhenoPanel | null {
  const values: Partial<PhenoPanel> = { age }
  for (const row of rows) {
    const value = typeof row.value === 'string' ? Number(row.value) : row.value
    if ((PANEL_KEYS as string[]).includes(row.key) && typeof value === 'number' && Number.isFinite(value)) {
      values[row.key as keyof PhenoPanel] = inMethodUnit(row.key, value, row.unit)
    }
  }
  for (const key of PANEL_KEYS) if (typeof values[key] !== 'number') return null
  return values as PhenoPanel
}

export interface PhenoPanel {
  albumin_gL: number
  creat_umol: number
  glucose_mmol: number
  crp_mg_dl: number
  lymph_pct: number
  mcv_fl: number
  rdw_pct: number
  alp_u_l: number
  wbc_10e3: number
  age: number
}

const KEYS = [
  'albumin_gL', 'creat_umol', 'glucose_mmol', 'crp_mg_dl', 'lymph_pct',
  'mcv_fl', 'rdw_pct', 'alp_u_l', 'wbc_10e3',
] as const

type MarkerKey = (typeof KEYS)[number]

const LABEL: Record<MarkerKey, string> = {
  albumin_gL: '白蛋白',
  creat_umol: '肌酐',
  glucose_mmol: '空腹血糖',
  crp_mg_dl: '超敏 C 反应蛋白',
  lymph_pct: '淋巴细胞百分比',
  mcv_fl: '平均红细胞体积',
  rdw_pct: '红细胞分布宽度',
  alp_u_l: '碱性磷酸酶',
  wbc_10e3: '白细胞',
}

const WEIGHT = {
  albumin_gL: -0.03359355,
  creat_umol: 0.009506491,
  glucose_mmol: 0.1953192,
  lncrp: 0.09536762,
  lymph_pct: -0.01199984,
  mcv_fl: 0.02676401,
  rdw_pct: 0.3306156,
  alp_u_l: 0.001868778,
  wbc_10e3: 0.05542406,
  age: 0.08035356,
} as const

const INTERCEPT = -19.90667
const GAMMA = 0.007692696
const MORTALITY_NUMERATOR = -1.51714
const PHENOAGE_OFFSET = 141.50225
const PHENOAGE_LOG_NUMERATOR = -0.0055305
const PHENOAGE_LOG_DENOMINATOR = 0.090165

/** Usual adult window. A move toward the bad edge, or past it, is a concern. */
const RANGE: Record<MarkerKey, { low: number; high: number; worse: 'down' | 'up' }> = {
  albumin_gL: { low: 35, high: 50, worse: 'down' },
  creat_umol: { low: 44, high: 133, worse: 'up' },
  glucose_mmol: { low: 3.9, high: 6.1, worse: 'up' },
  crp_mg_dl: { low: 0, high: 0.3, worse: 'up' },
  lymph_pct: { low: 20, high: 40, worse: 'down' },
  mcv_fl: { low: 82, high: 100, worse: 'down' },
  rdw_pct: { low: 11.5, high: 14.5, worse: 'up' },
  alp_u_l: { low: 40, high: 150, worse: 'up' },
  wbc_10e3: { low: 3.5, high: 9.5, worse: 'up' },
}

const CAUTION_KEYS: Record<string, MarkerKey[]> = {
  mcv: ['mcv_fl'],
  hgb: ['mcv_fl', 'rdw_pct'],
  hb: ['mcv_fl', 'rdw_pct'],
  ferritin: ['mcv_fl', 'rdw_pct'],
  iron: ['mcv_fl'],
  rdw: ['rdw_pct'],
  creat: ['creat_umol'],
  creatinine: ['creat_umol'],
  egfr: ['creat_umol'],
  albumin: ['albumin_gL'],
  glucose: ['glucose_mmol'],
  hba1c: ['glucose_mmol'],
  hscrp: ['crp_mg_dl'],
  crp: ['crp_mg_dl'],
  wbc: ['wbc_10e3'],
  lymph: ['lymph_pct'],
  alp: ['alp_u_l'],
}

export interface DriverMove {
  key: MarkerKey
  label_zh: string
  from: number
  to: number
  /** Years this one input added. Negative means the phenotypic age got smaller. */
  years: number
  concern: boolean
  healthy: boolean
}

export interface BodyAgeStory {
  headline_zh: string
  /** The chat is told to say this same sentence. */
  chat_zh: string
  allows_younger: boolean
  concern: boolean
  drivers: DriverMove[]
}

function finite(value: number): boolean {
  return Number.isFinite(value)
}

function xb(panel: PhenoPanel): number | null {
  if (!finite(panel.crp_mg_dl) || panel.crp_mg_dl <= 0) return null
  let sum = INTERCEPT + WEIGHT.lncrp * Math.log(panel.crp_mg_dl) + WEIGHT.age * panel.age
  for (const key of KEYS) {
    if (key === 'crp_mg_dl') continue
    if (!finite(panel[key])) return null
    sum += WEIGHT[key] * panel[key]
  }
  return sum
}

/** Levine phenotypic age, or null when the panel cannot be scored. */
export function phenotypicAge(panel: PhenoPanel): number | null {
  const linear = xb(panel)
  if (linear == null) return null
  const mortality = 1 - Math.exp((MORTALITY_NUMERATOR * Math.exp(linear)) / GAMMA)
  if (!(mortality > 0) || !(mortality < 1)) return null
  const age = PHENOAGE_OFFSET + Math.log(PHENOAGE_LOG_NUMERATOR * Math.log(1 - mortality)) / PHENOAGE_LOG_DENOMINATOR
  return finite(age) ? age : null
}

function swapped(after: PhenoPanel, key: MarkerKey, value: number): PhenoPanel {
  return { ...after, [key]: value }
}

function towardBad(key: MarkerKey, from: number, to: number): boolean {
  const range = RANGE[key]
  const worseDown = range.worse === 'down'
  const movedWorse = worseDown ? to < from - 1e-9 : to > from + 1e-9
  if (!movedWorse) return false
  const outside = to < range.low || to > range.high
  if (outside) return true
  const edge = worseDown ? range.low : range.high
  return Math.abs(to - edge) < Math.abs(from - edge)
}

function patternConcern(key: MarkerKey, from: number, to: number): boolean {
  if (key === 'mcv_fl' && to < from) return true
  if (key === 'rdw_pct' && to > from) return true
  if (key === 'creat_umol' && to > from) return true
  if (key === 'albumin_gL' && to < from && to <= RANGE.albumin_gL.low + 2) return true
  return false
}

function healthyMove(key: MarkerKey, from: number, to: number, glucoseTreated: boolean): boolean {
  if (key === 'crp_mg_dl' && to < from && to <= RANGE.crp_mg_dl.high) return true
  if (key === 'glucose_mmol' && to < from && !glucoseTreated && to <= RANGE.glucose_mmol.high) return true
  if (key === 'albumin_gL' && to > from && to >= RANGE.albumin_gL.low && to <= RANGE.albumin_gL.high) return true
  return false
}

function cautionHits(key: MarkerKey, cautions: readonly string[]): boolean {
  for (const name of cautions) {
    const mapped = CAUTION_KEYS[name.toLowerCase()]
    if (mapped?.includes(key)) return true
    if (name === key) return true
  }
  return false
}

export function attributeDrivers(before: PhenoPanel, after: PhenoPanel, opts: { cautions?: readonly string[]; glucoseTreated?: boolean } = {}): DriverMove[] {
  const afterAge = phenotypicAge(after)
  if (afterAge == null) return []
  const cautions = opts.cautions ?? []
  const moves: DriverMove[] = []
  for (const key of KEYS) {
    if (!finite(before[key]) || !finite(after[key]) || before[key] === after[key]) continue
    const held = phenotypicAge(swapped(after, key, before[key]))
    if (held == null) continue
    const years = afterAge - held
    const concern = cautionHits(key, cautions) || towardBad(key, before[key], after[key]) || patternConcern(key, before[key], after[key])
    const healthy = !concern && healthyMove(key, before[key], after[key], opts.glucoseTreated === true)
    moves.push({ key, label_zh: LABEL[key], from: before[key], to: after[key], years, concern, healthy })
  }
  moves.sort((a, b) => Math.abs(b.years) - Math.abs(a.years))
  return moves
}

function yearsText(value: number): string {
  const rounded = Math.round(Math.abs(value) * 10) / 10
  return String(rounded)
}

function verb(from: number, to: number): string {
  return to < from ? '变小' : '变大'
}

/**
 * One sentence for a repeat panel whose phenotypic age moved past the noise band.
 * Returns null when there is only one draw, or the move is still inside the band:
 * those cases keep the existing wording and never celebrate.
 */
export function bodyAgeStory(input: {
  deltaYears: number
  bandYears: number | null
  draws: number
  before: PhenoPanel
  after: PhenoPanel
  cautions?: readonly string[]
  glucoseTreated?: boolean
}): BodyAgeStory | null {
  if (input.draws < 2) return null
  if (input.bandYears == null || !finite(input.deltaYears) || Math.abs(input.deltaYears) <= Math.abs(input.bandYears)) return null
  if (input.deltaYears >= 0) return null
  const drivers = attributeDrivers(input.before, input.after, { cautions: input.cautions, glucoseTreated: input.glucoseTreated })
  const helping = drivers.filter((row) => row.years < -0.05)
  const main = helping[0] ?? drivers[0]
  if (main?.concern) {
    const way = verb(main.from, main.to)
    const headline = `身体年龄的计算结果小了 ${yearsText(input.deltaYears)} 岁（模型估计），主要来自${main.label_zh}${way}。这一项${way}不一定是好事，建议下次就诊时咨询医生。`
    return { headline_zh: headline, chat_zh: headline, allows_younger: false, concern: true, drivers }
  }
  const named = helping.filter((row) => row.healthy).slice(0, 2)
  const who = named.length > 0 ? named : helping.slice(0, 2)
  const down = who.filter((row) => row.to < row.from).map((row) => row.label_zh)
  const up = who.filter((row) => row.to > row.from).map((row) => row.label_zh)
  const moved = [down.length > 0 ? `${down.join('和')}有所下降` : '', up.length > 0 ? `${up.join('和')}有所上升` : ''].filter(Boolean).join('，')
  const from = moved ? `主要来自${moved}。` : ''
  const headline = `你确实年轻了 ${yearsText(input.deltaYears)} 岁（模型估计，超出了测量波动，是真实的变化）。${from}`.replace(/。$/, '。')
  return { headline_zh: headline, chat_zh: headline, allows_younger: true, concern: false, drivers }
}

/** The page caption and the chat line are the same string. */
export function bodyAgeLines(story: BodyAgeStory): { page: string; chat: string } {
  return { page: story.headline_zh, chat: story.chat_zh }
}
