// The web page's shared wording and number formats, copied from the client (terms.ts, format.ts, charts.ts,
// changes.ts, overview-facts.ts, constants.ts) so 总览 reads exactly as the web page did. DOM-free.

import type { Journey } from './journey.ts'

// --- terms.ts -------------------------------------------------------------------------------------

export const BIOAGE_LABEL = '身体年龄'
export const RISK_LABEL = '10 年心血管风险'
export const BIOAGE_INFO = '身体年龄根据九项常规血检和周岁计算得出（模型估计，不是诊断，也不代表预期寿命）。学术上称为表型年龄。'
export const RISK_INFO = '10 年心血管风险：与你情况相近的人群中，未来 10 年发生心梗或脑卒中的比例（模型估计）。该模型未公开个体波动范围。年龄不在 35–74 岁时，结果更不确定。模型名称为 China-PAR。'

/** changes.ts: the one plain sentence behind 判断依据. */
export const BASIS_ZH = '「超出正常波动」指两次结果的差异大于同一个人平常的起伏。不同医院、不同仪器之间的差异未计入。这不是诊断。'

export const UNMATCHED_ALL_ZH = '这些结果是按化验名称从你的档案里取数算的（体检报告一般不印标准编码），单位和数值范围都核对过；各卡注明了用到的数值。'
export const unmatchedSomeZh = (count: number) => `其中 ${count} 项是按化验名称从你的档案里取数算的（体检报告一般不印标准编码），单位和数值范围都核对过。`

/** constants.ts RISK_FACTS: the six China-PAR facts when the server sends no questions. */
export const RISK_FACTS: ReadonlyArray<{ key: string; zh: string; menOnly?: boolean }> = [
  { key: 'smoker', zh: '现在吸烟' },
  { key: 'diabetes', zh: '有糖尿病' },
  { key: 'bp_treated', zh: '两周内用过降压药' },
  { key: 'north', zh: '住在北方（长江以北）' },
  { key: 'urban', zh: '住在城市', menOnly: true },
  { key: 'family_history', zh: '父母或兄弟姐妹有心梗或脑卒中', menOnly: true },
]

export const FOCUS_FALLBACK: ReadonlyArray<{ key: string; label_zh: string }> = [
  { key: 'bioage', label_zh: '身体年龄' },
  { key: 'cardio', label_zh: '心血管' },
  { key: 'glucose', label_zh: '血糖' },
  { key: 'weight', label_zh: '体重' },
  { key: 'sleep', label_zh: '睡眠' },
  { key: 'plan', label_zh: '方案效果' },
]

/** The web said 「DeepSeek 模型」: here the model the person talks to is Claude. */
export function inClaude(text: string): string {
  return text.replace(/DeepSeek 模型/g, 'Claude').replace(/你配置的 DeepSeek/g, 'Claude').replace(/DeepSeek/g, 'Claude')
}

/**
 * The server's next-step sentences say 上传 (the web page had an upload field). In the pane a report is given to
 * Claude in the chat, so those words follow what the person actually does here.
 */
export function inPane(text: string): string {
  return text
    .replace(/上传一份体检报告/g, '把一份体检报告交给 Claude 读取')
    .replace(/上传体检报告/g, '把体检报告交给 Claude 读取')
    .replace(/上传后/g, '录入后')
    .replace(/在健康页填写/g, '在总览填写')
}

// --- numbers (charts.ts fmt, format.ts) ------------------------------------------------------------

/** At most `digits` decimals, trailing zeros dropped, a real minus sign; -0 is 0. */
export function fmt(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const fixed = value.toFixed(digits)
  const text = fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
  if (text === '-0') return '0'
  return text.startsWith('-') ? `−${text.slice(1)}` : text
}

/** Two decimals under 10, one from 10 up. */
export function fmtAuto(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return fmt(value, Math.abs(value) >= 10 ? 1 : 2)
}

export function riskText(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : value.toFixed(1)
}

/** 2026-10-04 → 10 月 4 日; another year says which. */
export function chineseDate(iso: string | null | undefined, today: string): string {
  if (!iso) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return ''
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return ''
  return match[1] !== today.slice(0, 4) ? `${match[1]} 年 ${month} 月 ${day} 日` : `${month} 月 ${day} 日`
}

export function chineseMonth(iso: string | null | undefined): string {
  if (!iso) return ''
  const match = /^(\d{4})-(\d{2})/.exec(iso)
  if (!match) return ''
  return `${match[1]} 年 ${Number(match[2])} 月`
}

/** Every ISO date in a sentence, as the page writes dates. */
export function datesZh(text: string, today: string): string {
  return text.replace(/\d{4}-\d{2}-\d{2}/g, (iso) => chineseDate(iso, today) || iso)
}

/** Body age against the calendar; a single draw is never "younger". */
export function versusAge(advance: number | null | undefined, checkups: number | null | undefined = 2): string {
  if (advance == null || !Number.isFinite(advance)) return ''
  if (Math.abs(advance) < 0.5) return '与实足年龄相当'
  if (advance < 0 && (checkups ?? 0) < 2) return `根据单次检查估算（模型估计，不是诊断），比实足年龄小 ${fmt(-advance)} 岁。单次检查不能说明你变年轻了`
  return advance < 0 ? `比实足年龄年轻 ${fmt(-advance)} 岁` : `比实足年龄大 ${fmt(advance)} 岁`
}

const FIELD_ZH: Record<string, string> = {
  sleepDuration: '睡眠时长', sleepHours: '睡眠时长', deepSleep: '深睡', remSleep: '快速眼动睡眠', sleepScore: '睡眠评分',
  steps: '步数', stepCount: '步数', restingHeartRate: '静息心率', heartRate: '心率', hrv: '心率变异性', heartRateVariability: '心率变异性',
  vo2max: '最大摄氧量', vo2Max: '最大摄氧量', activeCalories: '活动消耗', exerciseMinutes: '运动时长', weight: '体重', bmi: 'BMI',
  waist: '腰围', systolic: '收缩压', diastolic: '舒张压', spo2: '血氧',
}
const SUPERSCRIPT: Record<string, string> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }

/** Units and field names as a lab report prints them (format.ts plainUnits). */
export function plainUnits(text: string): string {
  return text
    .replace(/\b[a-z]+(?:[A-Z][a-z0-9]*)+\b|\b(?:steps|hrv|spo2|waist|weight|systolic|diastolic|vo2max)\b/g, (word) => FIELD_ZH[word] ?? word)
    .replace(/(^|[^A-Za-z])u(IU|mol|g|L)\b/g, '$1μ$2')
    .replace(/(×)?10\^(\d+)\//g, (_, _times: string | undefined, power: string) => `×10${[...power].map((digit) => SUPERSCRIPT[digit] ?? digit).join('')}/`)
    .replace(/(\d)\s+%/g, '$1%')
    .replace(/\s+([（【「])/g, '$1').replace(/([）】」])\s+(?=[\w一-鿿])/g, '$1')
    .replace(/(\d|\/)m2\b/g, '$1m²')
    .replace(/\bm2\b/g, 'm²')
    .replace(/(\d)\s*h\b(?![\w/])/g, '$1 小时')
    .replace(/(\d)\s*min\b/g, '$1 分钟')
    .replace(/(^|[^\w.\-−])-(?=\d)/g, '$1−')
}

/** goals.ts minus: negative numbers with the minus sign. */
export function minus(text: string): string {
  return text.replace(/(^|[\s(（:：→])-(?=\d)/g, '$1−')
}

function decimals(value: number): number {
  return (String(value).split('.')[1] ?? '').length
}

/** Both ends with the same decimals, as a lab prints them: 4.2 → 3.0. */
export function pairText(from: number, to: number): string {
  const digits = Math.min(2, Math.max(decimals(from), decimals(to)))
  return plainUnits(`${from.toFixed(digits)} → ${to.toFixed(digits)}`)
}

/** Keep compound names whole: γ-谷氨酰转移酶 must not break after the hyphen. */
export function keepWhole(text: string): string {
  return text.replace(/([α-ωΑ-Ω])-/g, '$1‑')
}

// --- overview-facts.ts ----------------------------------------------------------------------------

const RED_CELL = ['hb', 'hgb', 'hct', 'mcv', 'mch', 'mchc', 'rbc', 'rdw', 'rdw_cv', 'rdwcv', 'ferritin', 'iron']
const RED_CELL_LABEL = /(?<!糖化)血红蛋白|红细胞|血色素|铁蛋白|血清铁|MCV|MCH|RDW/i

export interface Covered { keys: Set<string>; labels: Set<string>; redCell: boolean }

export const NOTHING_COVERED: Covered = { keys: new Set(), labels: new Set(), redCell: false }

/** The markers 最重要的一步 already covers, when that card is on screen. */
export function coveredByCare(journey: Journey): Covered {
  if (journey.next.action !== 'doctor') return NOTHING_COVERED
  const hits = journey.doctor_first.hits
  const keys = new Set(hits.map((hit) => hit.key))
  const labels = new Set(hits.map((hit) => hit.short_zh.split(/\s/)[0] ?? '').filter(Boolean))
  const redCell = hits.some((hit) => RED_CELL.includes(hit.key)) || /(?<!糖化)血红蛋白|红细胞|贫血|铁蛋白/.test(`${journey.next.title_zh}${journey.next.detail_zh}`)
  if (redCell) for (const key of RED_CELL) keys.add(key)
  return { keys, labels, redCell }
}

export function isCovered(covered: Covered, row: { key?: string; label_zh?: string }): boolean {
  if (row.key && covered.keys.has(row.key)) return true
  const label = row.label_zh ?? ''
  if (label && covered.labels.has(label)) return true
  return covered.redCell && RED_CELL_LABEL.test(label)
}

export const NOTABLE_ON_OVERVIEW = 3

export function notableRows<T extends { key?: string; label_zh?: string }>(rows: readonly T[], covered: Covered): T[] {
  return rows.filter((row) => !isCovered(covered, row)).slice(0, NOTABLE_ON_OVERVIEW)
}

/** The doctor card's detail without the title it repeats. */
export function careDetail(title: string, detail: string): string {
  if (!detail || detail === title) return ''
  const lead = /^请先去看医生：/.test(title)
  return lead ? detail.replace(/^请先去看医生：/, '').replace(/请先去看医生。/g, '').replace(/\s{2,}/g, ' ').trim() : detail
}
