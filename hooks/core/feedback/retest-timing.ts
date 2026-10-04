// When a repeat measurement can actually show a change (owner rule): lipids, fasting
// glucose and weight 8–12 weeks; body age 3–6 months; HbA1c at least 90 days.
// The table's shorter minimum (lipids 28 days) is not what we tell the person.

import { dateZh } from '../ux/plain.ts'

export interface RetestAdvice {
  /** Days that must pass before a result is comparable. */
  minDays: number
  /** Earliest next draw we suggest, counted from the later result (or from today when that date has passed). */
  earliestDays: number
  recommendedDays: number
  why_zh: string
  family: 'lipids' | 'glucose' | 'weight' | 'hba1c' | 'bioage' | 'vitamin_d' | 'other'
}

const LIPIDS = new Set(['tc', 'ldl', 'hdl', 'tg', 'non_hdl', 'nonhdl', 'cholesterol', 'ldl_c', 'hdl_c', 'ldlc', 'hdlc'])

export function addDays(iso: string, days: number): string {
  const at = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  at.setUTCDate(at.getUTCDate() + days)
  return at.toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from.slice(0, 10)}T00:00:00Z`)
  const end = Date.parse(`${to.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.round((end - start) / 86_400_000)
}

export function retestAdvice(key: string): RetestAdvice {
  const k = key.trim().toLowerCase()
  if (k === 'hba1c' || k.includes('hba1c') || k.includes('a1c')) {
    return { minDays: 90, earliestDays: 90, recommendedDays: 90, family: 'hba1c', why_zh: '糖化血红蛋白反映近 3 个月的平均血糖，两次检测至少间隔 90 天。' }
  }
  if (k === 'phenoage' || k === 'bioage' || k === 'bodyage') {
    return { minDays: 90, earliestDays: 90, recommendedDays: 180, family: 'bioage', why_zh: '身体年龄的测量波动大约有两三岁。间隔 3 到 6 个月、在同一家实验室复测，才能区分是否为真实变化。' }
  }
  if (k === 'vitd' || k === 'vitamin_d' || k === '25ohd' || k.includes('vitd')) {
    return { minDays: 90, earliestDays: 90, recommendedDays: 90, family: 'vitamin_d', why_zh: '维生素 D 至少间隔 90 天复测，更早出现的变化通常属于波动。' }
  }
  if (LIPIDS.has(k)) {
    return { minDays: 56, earliestDays: 56, recommendedDays: 84, family: 'lipids', why_zh: '血脂的真实变化通常需要 8–12 周才能显现。' }
  }
  if (k === 'glucose' || k === 'fpg' || k === 'fasting_glucose') {
    return { minDays: 56, earliestDays: 56, recommendedDays: 84, family: 'glucose', why_zh: '空腹血糖的真实变化通常需要 8–12 周才能显现。' }
  }
  if (k === 'weight' || k === 'bmi' || k === 'bodymass') {
    return { minDays: 56, earliestDays: 56, recommendedDays: 84, family: 'weight', why_zh: '体重的真实变化通常需要 8–12 周才能显现。' }
  }
  return { minDays: 28, earliestDays: 28, recommendedDays: 56, family: 'other', why_zh: '此项至少间隔 4 周复测，才能区分波动与真实变化。' }
}

/**
 * Dates to show. `waitedDays` is how long the person has already waited (plan days, or the gap between the two draws).
 * `completedOn` is the date of a draw that already happened. The window stays anchored to that draw: it does not
 * slide forward with today, and a draw inside the minimum interval is the retest, not a reason to open the next one.
 */
export function retestDates(today: string, advice: RetestAdvice, waitedDays: number | null, anchor: string | null, completedOn: string | null = null): { earliest: string; recommended: string; why_zh: string } {
  const done = completedOn && /^\d{4}-\d{2}-\d{2}/.test(completedOn) ? completedOn.slice(0, 10) : ''
  if (done && daysBetween(done, today) >= 0 && daysBetween(done, today) < advice.minDays) {
    return { earliest: done, recommended: done, why_zh: `复测已在 ${dateZh(done, today)}完成。` }
  }
  const base = (anchor && /^\d{4}-\d{2}-\d{2}/.test(anchor) ? anchor : today).slice(0, 10)
  const waited = waitedDays ?? 0
  if (waited < advice.minDays) {
    const left = advice.minDays - waited
    const earliest = addDays(today, left)
    const extra = Math.max(0, advice.recommendedDays - advice.minDays)
    return { earliest, recommended: addDays(earliest, extra), why_zh: advice.why_zh }
  }
  // The next window opens on the anchor draw and stays there. It is not moved forward to today,
  // which used to walk the suggestion past a retest the person had already done.
  const earliest = addDays(base, advice.earliestDays)
  const recommended = addDays(base, advice.recommendedDays)
  return { earliest, recommended, why_zh: advice.why_zh }
}
