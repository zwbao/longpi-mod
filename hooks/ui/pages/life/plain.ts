// Wording and number/unit/date formats for the 化验, 睡眠 and 运动 pages, copied from the web client
// (client/indicators.ts, changes.ts, charts.ts, format.ts and ux/plain.ts). DOM-free; the Chinese is the web's.

export type IndicatorSource = 'checkup' | 'device' | 'self'
export type LifeArea = 'labs' | 'sleep' | 'training'

export const SOURCE_ZH: Record<IndicatorSource, string> = { checkup: '体检', device: '手环', self: '自测' }

export const JUDGEMENT = {
  beyond: '超出正常波动（比你平时的波动更大，建议咨询医生。不是急症。）',
  within: '在正常波动范围内（尚不能视为真实变化）',
  too_early: '太早（距上次检测时间过短，目前的变化多为正常波动）',
  not_comparable: '不可比（两次检测不在同一家机构，无法直接比较）',
  unjudged: '暂不能下结论（请查看缺少的环节）',
} as const

export type JudgementKey = keyof typeof JUDGEMENT

/** Short chip, or the one-sentence meaning. */
export function judgementText(kind: JudgementKey, full: boolean): string {
  const text = JUDGEMENT[kind]
  return full ? text : (text.split('（')[0] ?? text)
}

export function judgementKind(input: { gate?: string; judged?: string; reason?: string }): JudgementKey {
  const reason = input.reason ?? ''
  if (input.gate === 'too_early' || reason.startsWith('太早')) return 'too_early'
  if (input.gate === 'not_comparable' || reason.startsWith('不可比')) return 'not_comparable'
  if (input.judged === 'changed') return 'beyond'
  if (input.judged === 'within') return 'within'
  return 'unjudged'
}

export const JUDGEMENT_HELP = '超出正常波动：变化大于你平常的起伏，建议咨询医生，但不属于急症。在正常波动范围内：变化没有实际意义。太早：距上次检测时间过短。不可比：两次检测不在同一机构。还不能下结论：请查看缺少哪一步。'

/** The one plain sentence behind 判断依据 (changes.ts). */
export const BASIS_ZH = '「超出正常波动」指两次结果的差异大于同一个人平常的起伏。不同医院、不同仪器之间的差异未计入。这不是诊断。'

export const VERDICT_ZH: Record<'better' | 'worse' | 'unclear', string> = { better: '变好', worse: '变差', unclear: '需结合参考范围' }

export function lifeAreaOf(label: string): LifeArea {
  if (/睡眠|入睡|深睡|清醒时间|心率变异|夜间最低血氧/.test(label)) return 'sleep'
  if (/步数|运动|活动量|活动消耗|锻炼|卡路里|训练负荷|步行|静息心率|最大摄氧量/.test(label)) return 'training'
  return 'labs'
}

// --- numbers ------------------------------------------------------------------------------------------

export function fmt(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const fixed = value.toFixed(digits)
  const text = fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
  if (text === '-0') return '0'
  return text.startsWith('-') ? `−${text.slice(1)}` : text
}

/** Two decimals under 10, one from 10 up (charts.ts). */
export function fmtAuto(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return fmt(value, Math.abs(value) >= 10 ? 1 : 2)
}

/** A number on an axis or under a bar: whole from 100 up, one decimal from 10, two under 10. */
export function fmtShort(value: number): string {
  const abs = Math.abs(value)
  return fmt(value, abs >= 100 ? 0 : abs >= 10 ? 1 : 2)
}

/** A mean or a difference of wearable values: whole from 100 up, else one decimal kept (7.0 小时). */
export function fmtMean(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const text = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1)
  return text === '-0' || text === '-0.0' ? text.slice(1) : text.startsWith('-') ? `−${text.slice(1)}` : text
}

function trimNum(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2
  return value.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
}

// --- dates --------------------------------------------------------------------------------------------

/** 「9 月 10 日」, with the year when it is not this year. */
export function dateZh(iso: string | null | undefined, today: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return iso ?? ''
  const md = `${Number(m[2])} 月 ${Number(m[3])} 日`
  return m[1] === today.slice(0, 4) ? md : `${m[1]} 年 ${md}`
}

/** A table cell date: 「8 月 24 日」 this year, 「2025年8月」 another year (fits 10 cells). */
export function dateCell(iso: string | null | undefined, today: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return iso ?? ''
  return m[1] === today.slice(0, 4) ? `${Number(m[2])} 月 ${Number(m[3])} 日` : `${m[1]}年${Number(m[2])}月`
}

/** An axis label: 「9月7日」, 「2025年8月26日」 for another year. */
export function dateAxis(iso: string, today: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const md = `${Number(m[2])}月${Number(m[3])}日`
  return m[1] === today.slice(0, 4) ? md : `${m[1]}年${md}`
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function weekdayZh(iso: string): string {
  return WEEKDAYS[new Date(`${iso.slice(0, 10)}T12:00:00Z`).getUTCDay()] ?? ''
}

export function dayNumber(iso: string): number {
  return Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000)
}

export function isoOfDay(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10)
}

/** Every ISO date inside a sentence written as dateZh. */
export function datesZh(text: string, today: string): string {
  return text.replace(/\d{4}-\d{2}-\d{2}/g, (iso) => dateZh(iso, today))
}

// --- units and labels ---------------------------------------------------------------------------------

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

/** Units as printed on a lab sheet: μ for micro. */
export function unitText(unit: string | undefined): string {
  return plainUnits(unit ?? '').replace(/(^|[^A-Za-z])u(IU|mol|g|L)\b/g, '$1μ$2')
}

/** Names as typeset Chinese: no space hugging a full-width bracket. */
export function cleanLabel(text: string): string {
  return text.replace(/\s+([（【「])/g, '$1').replace(/([）】」])\s+/g, '$1')
}

/** 「62%」 with no space before %, 「3.8 mmol/L」 otherwise. */
export function withUnit(value: string, unit: string): string {
  if (!unit) return value
  return unit.startsWith('%') ? `${value}${unit}` : `${value} ${unit}`
}

/** Sentences from the server: ISO dates as 「9 月 10 日」, micro units, no space before %. */
export function tidy(text: string, today: string): string {
  return datesZh(unitText(text), today).replace(/(\d) %/g, '$1%')
}

/** The chip already says 太早: the caption keeps the rest of the sentence once. */
export function reasonBesideChip(gate: string | undefined, reason: string | undefined): string {
  const text = (reason ?? '').trim()
  if (!text) return ''
  if (gate === 'too_early' || text.startsWith('太早')) return text.replace(/^太早[：:]?\s*/, '')
  return text
}

/** A paper as a person reads it: first author and year. */
export function sourceLabel(title: string): string {
  const text = title.trim()
  if (!text) return '收录的研究'
  if (/[一-鿿]/.test(text) && !/[A-Za-z]{4,}(?:\s+[A-Za-z]{2,}){2,}/.test(text)) return text
  const author = /^([A-Z][A-Za-z'’-]+)/.exec(text)?.[1] ?? ''
  const year = /\b(19\d{2}|20\d{2})\b/.exec(text)?.[1] ?? ''
  if (author && year) return `${author} 等，${year} 年的研究`
  if (year) return `${year} 年的研究`
  return author ? `${author} 等的研究` : '收录的研究'
}

/** Backend words never reach the page (ux/plain.ts scrubVisible, the parts a read error can carry). */
export function scrubVisible(text: string): string {
  return text
    .replace(/Mirobody/gi, '健康数据服务')
    .replace(/longevity-skills/gi, '')
    .replace(/\bMCP\b|\/mcp\/\S*|\bDSH\b|HARNESS|\bLOINC\b|record_status/gi, '')
    .replace(/\bRCV\b/g, '正常波动')
    .replace(/https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\S*/g, '')
    .replace(/\b(?:NaN|undefined|null)\b/g, '')
    .replace(/[A-Za-z_]+(?:[ \t]+[A-Za-z_']+){2,}/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export interface MovePoint { date: string; value: number }

/** The detail's first line: from → to, percent, how many results, and the date span (ux/plain.ts movementOf). */
export function movementLead(points: readonly MovePoint[], unit: string, today: string): string | null {
  const rows = points.filter((point) => Number.isFinite(point.value) && point.date)
  if (rows.length === 0) return null
  const first = rows[0] as MovePoint
  const last = rows[rows.length - 1] as MovePoint
  const unitPart = unit ? (unit.startsWith('%') ? unit : ` ${unit}`) : ''
  if (rows.length === 1) return `${trimNum(first.value)}${unitPart} · 1 次 · ${dateZh(first.date, today)}`
  const pct = first.value === 0 ? null : ((last.value - first.value) / Math.abs(first.value)) * 100
  const pctText = pct == null ? '' : ` · ${pct > 0 ? '+' : pct < 0 ? '−' : ''}${trimNum(Math.abs(pct))}%`
  return `${trimNum(first.value)} → ${trimNum(last.value)}${unitPart}${pctText} · ${rows.length} 次 · ${dateZh(first.date, today)}–${dateZh(last.date, today)}`
}

function decimals(value: number): number {
  return (String(value).split('.')[1] ?? '').length
}

/** Both ends with the same decimals, as a lab prints them: 4.2 → 3.0 (changes.ts pairText). */
export function pairText(from: number, to: number): string {
  const digits = Math.min(2, Math.max(decimals(from), decimals(to)))
  return plainUnits(`${from.toFixed(digits)} → ${to.toFixed(digits)}`)
}
