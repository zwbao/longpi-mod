// The earliest retest per marker a plan review allows, and the sentence that says it (tools-tracking.ts).

import { addDays, daysBetween, retestAdvice } from './feedback/retest-timing.ts'

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

const ISO = /^\d{4}-\d{2}-\d{2}/

/** Retest interval key from a marker's name on the report. */
export function retestKey(label: string): string {
  const text = String(label ?? '')
  if (/糖化|hba1c|a1c/i.test(text)) return 'hba1c'
  if (/身体年龄|表型年龄|phenoage/i.test(text)) return 'phenoage'
  if (/维生素\s*d|25.?羟/i.test(text)) return 'vitd'
  if (/低密度|ldl/i.test(text)) return 'ldl'
  if (/高密度|hdl/i.test(text)) return 'hdl'
  if (/甘油三酯|triglycer|\btg\b/i.test(text)) return 'tg'
  if (/总胆固醇|胆固醇/i.test(text)) return 'tc'
  if (/空腹血糖|血糖|glucose/i.test(text)) return 'glucose'
  if (/体重|体质指数|体重指数|bmi|weight/i.test(text)) return 'weight'
  return String(label ?? '')
}

export interface RetestDue {
  marker: string
  /** Earliest date a retest can show a real change. */
  date: string
  /** Days from the anchor (the plan start, or the last retest) to that date. */
  days: number
  anchor: 'start' | 'retest'
  verdict: string
}

/**
 * The earliest retest per marker that is 波动内 or too early to judge, from a review_interventions result.
 * A too-early verdict carries next_retest; a 波动内 verdict after a retest opens the next window at that retest
 * plus the marker's interval (lipids, glucose and weight 8 weeks, HbA1c and body age 90 days).
 */
export function retestDue(review: unknown): RetestDue[] {
  const data = record(review)
  const today = typeof data.today === 'string' && ISO.test(data.today) ? data.today.slice(0, 10) : ''
  const out: RetestDue[] = []
  const seen = new Set<string>()
  for (const item of list(data.items)) {
    const start = String(record(item).start ?? '').slice(0, 10)
    for (const raw of list(record(item).verdicts)) {
      const row = record(raw)
      const verdict = String(row.verdict ?? '')
      if (verdict !== '波动内' && verdict !== '无法判断') continue
      const marker = String(row.marker ?? '')
      if (!marker || seen.has(marker)) continue
      const advice = retestAdvice(retestKey(`${row.indicator ?? ''} ${marker}`.trim()) || marker)
      const keyed = retestAdvice(retestKey(marker))
      const minDays = Math.max(advice.minDays, keyed.minDays)
      const next = typeof row.next_retest === 'string' && ISO.test(row.next_retest) ? row.next_retest.slice(0, 10) : ''
      const followup = String(record(row.followup).date ?? '').slice(0, 10)
      let due: RetestDue | null = null
      if (next && (!today || next >= today)) {
        due = { marker, date: next, days: ISO.test(start) ? Math.max(0, daysBetween(start, next)) : minDays, anchor: 'start', verdict }
      } else if (verdict === '波动内' && ISO.test(followup)) {
        const date = addDays(followup, minDays)
        if (!today || date >= today) due = { marker, date, days: minDays, anchor: 'retest', verdict }
      }
      if (!due) continue
      seen.add(marker)
      out.push(due)
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

function weeksZh(days: number): string {
  if (days >= 84 && days % 30 === 0) return `${days / 30} 个月`
  if (days % 7 === 0) return `${days / 7} 周`
  return `${days} 天`
}

export function retestSentence(due: RetestDue): string {
  const since = due.anchor === 'retest' ? '离这次复测' : '从方案开始算'
  return `${due.marker}下次复查最早在 ${due.date}（${since}满 ${weeksZh(due.days)}），那时才分得清是不是真实变化。`
}
