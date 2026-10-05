// Words and numbers as the web's 方案 and 日程 tabs print them (client/format.ts, charts.ts, goals.ts,
// feedback/grade.ts, followup.ts), copied DOM-free so the pane says exactly what the page said.

import { dateZh } from '../../kit.tsx'

/** Two decimals at most, trailing zeros dropped, a real minus sign (−); -0 is 0. */
export function fmt(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const fixed = value.toFixed(digits)
  const text = fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
  if (text === '-0') return '0'
  return text.startsWith('-') ? `−${text.slice(1)}` : text
}

/** Two decimals under 10, one from 10 up: 1.26 mmol/L, 44.8 岁, 138.7 mmHg. */
export function fmtAuto(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return fmt(value, Math.abs(value) >= 10 ? 1 : 2)
}

/** A fraction as a signed percentage: one decimal below 10 %, none above; a change that rounds to nothing is 0%. */
export function pct(value: number): string {
  const percent = value * 100
  const text = fmt(percent, Math.abs(percent) < 10 ? 1 : 0)
  if (text === '—') return text
  if (Number(text.replace('−', '-')) === 0) return '0%'
  return `${percent > 0 ? '+' : ''}${text.replace(/^-/, '−')}%`
}

/** Negative numbers with the minus sign (−), not a hyphen. */
export function minus(text: string): string {
  return text.replace(/(^|[\s(（:：→])-(?=\d)/g, '$1−')
}

/** 「10 月 11 日」, with the year when it is not this year. */
export function chineseDate(iso: string | null | undefined, today: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return ''
  // No-break spaces: a wrapped line never leaves 「24」 on one row and 「日」 on the next.
  return dateZh(iso, today).replace(/ /g, '\u00a0')
}

/** Every ISO date inside a sentence written as a Chinese date. */
export function datesZh(text: string, today: string): string {
  return text.replace(/\d{4}-\d{2}-\d{2}/g, (iso) => dateZh(iso, today))
}

/** 「10 月」 with the year when it is not this year. */
export function monthLabel(iso: string, today: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(iso)
  if (!match) return iso
  const month = `${Number(match[2])} 月`
  return match[1] === today.slice(0, 4) ? month : `${match[1]} 年 ${month}`
}

const FIELD_ZH: Record<string, string> = {
  sleepDuration: '睡眠时长', sleepHours: '睡眠时长', deepSleep: '深睡', remSleep: '快速眼动睡眠', sleepScore: '睡眠评分',
  steps: '步数', stepCount: '步数', restingHeartRate: '静息心率', heartRate: '心率', hrv: '心率变异性', heartRateVariability: '心率变异性',
  vo2max: '最大摄氧量', vo2Max: '最大摄氧量', activeCalories: '活动消耗', exerciseMinutes: '运动时长', weight: '体重', bmi: 'BMI',
  waist: '腰围', systolic: '收缩压', diastolic: '舒张压', spo2: '血氧', dailySteps: '每日步数', dailyTotalSleepTime: '每晚睡眠',
}

const SUPERSCRIPT: Record<string, string> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }

/** Units and field names as a lab report prints them: umol/L → μmol/L, 10^3/uL → ×10³/μL, camelCase in Chinese. */
export function plainUnits(text: string): string {
  return text
    .replace(/\b[a-z]+(?:[A-Z][a-z0-9]*)+\b|\b(?:steps|hrv|spo2|waist|weight|systolic|diastolic|vo2max)\b/g, (word) => FIELD_ZH[word] ?? word)
    .replace(/(^|[^A-Za-z])u(IU|mol|g|L)\b/g, '$1μ$2')
    .replace(/(×)?10[\^~*](\d+)\//g, (_m: string, _times: string | undefined, power: string) => `×10${[...power].map((digit) => SUPERSCRIPT[digit] ?? digit).join('')}/`)
    .replace(/(\d)\s+%/g, '$1%')
    .replace(/\s+([（【「])/g, '$1').replace(/([）】」])\s+(?=[\w一-鿿])/g, '$1')
    .replace(/(\d|\/)m2\b/g, '$1m²')
    .replace(/\bm2\b/g, 'm²')
    .replace(/(\d)\s*h\b(?![\w/])/g, '$1 小时')
    .replace(/(\d)\s*min\b/g, '$1 分钟')
    .replace(/(^|[^\w.\-−])-(?=\d)/g, '$1−')
}

/** What to do, without the category head and the evidence tail the card shows on their own lines. */
export function behaviorOf(item: { detail: string; title: string; category_zh?: string; evidence: { expected_zh: string } }): string {
  const evidence = item.evidence.expected_zh
  let text = item.detail
  const tail = evidence ? text.lastIndexOf(`证据：${evidence}`) : -1
  if (tail >= 0) text = text.slice(0, tail)
  else if (evidence && text.includes(evidence)) text = text.replace(evidence, '')
  const head = item.category_zh ? `${item.category_zh}：${item.title}` : ''
  if (head && text.startsWith(head)) text = text.slice(head.length).replace(/^[，,。；;\s]+/, '')
  return text.replace(/\s*(证据|依据)[:：]\s*$/, '').replace(/[\s，,；;]+$/, '').trim()
}

function showYears(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return String(Math.round(value * 10) / 10)
}

/** 「模型估计：血糖降到 5.4，身体年龄约年轻 0.6 岁。」 */
export function projectionSentence(label: string, target: string, years: number | null, from?: string | null): string {
  const targetNum = Number.parseFloat(target)
  const fromNum = from == null ? Number.NaN : Number.parseFloat(from)
  const verb = Number.isFinite(targetNum) && Number.isFinite(fromNum) && targetNum < fromNum ? '降到' : '到'
  const yearsText = years == null || !Number.isFinite(years)
    ? ''
    : years < -0.05
      ? `，身体年龄约年轻 ${showYears(-years)} 岁`
      : years > 0.05
        ? `，身体年龄约增加 ${showYears(years)} 岁`
        : '，身体年龄基本不变'
  return `模型估计：${label}${verb} ${target}${yearsText}。`
}

/** "2026-09-24T21:00:00" (local, as the server sends it) → 今天 21:00. */
export function whenText(iso: string | null, today: string): string {
  if (!iso) return ''
  let date = iso.slice(0, 10)
  let time = iso.slice(11, 16)
  if (/(Z|[+-]\d\d:?\d\d)$/.test(iso)) {
    const at = new Date(iso)
    if (!Number.isNaN(at.getTime())) {
      const two = (value: number) => String(value).padStart(2, '0')
      date = `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`
      time = `${two(at.getHours())}:${two(at.getMinutes())}`
    }
  }
  const tomorrow = new Date(`${today}T12:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const label = date === today ? '今天' : date === tomorrow.toISOString().slice(0, 10) ? '明天' : chineseDate(date, today)
  return `${label} ${time}`.trim()
}

/** Day number since the epoch, for laying dates on a line. */
export function dayNumber(iso: string): number {
  return Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000)
}

export function isoOfDay(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10)
}
