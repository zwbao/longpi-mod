// Small pure helpers for the 档案 and 设置 pages: per-page state in ctx.view.sub, dates and numbers as the
// web page printed them, and the record summary line. No elements here.

import type { Ctx } from '../../types.ts'
import { dateZh, num } from '../../kit.tsx'

/** Every key this lane keeps in ctx.view.sub starts with this. */
export const P = 'more.'

export function sub(ctx: Ctx, key: string): string {
  return ctx.view.sub[P + key] ?? ''
}

export function setSub(ctx: Ctx, key: string, value: string): void {
  ctx.act.setSub(P + key, value)
}

/** One accordion open at a time per page: `fold` names it. */
export function isOpen(ctx: Ctx, page: string, id: string, fallback = ''): boolean {
  const open = ctx.view.sub[`${P}${page}.open`]
  return (open === undefined ? fallback : open) === id
}

export function toggleOpen(ctx: Ctx, page: string, id: string, fallback = ''): void {
  ctx.act.setSub(`${P}${page}.open`, isOpen(ctx, page, id, fallback) ? '-' : id)
}

/** A small fold inside a section (更多设置, 高级): on or off. */
export function flag(ctx: Ctx, key: string): boolean {
  return sub(ctx, key) === '1'
}

export function toggleFlag(ctx: Ctx, key: string): void {
  setSub(ctx, key, flag(ctx, key) ? '' : '1')
}

// --- numbers and dates -------------------------------------------------------------------------------

/** The web page's fmt: up to `digits` decimals, trailing zeros dropped. */
export function fmt(value: number | null | undefined, digits = 1): string {
  return num(value, digits)
}

export function day(ctx: Ctx, iso: string | null | undefined): string {
  return dateZh(iso, ctx.today) || (iso ?? '')
}

export function month(iso: string | null | undefined): string {
  if (!iso) return ''
  const match = /^(\d{4})-(\d{2})/.exec(iso)
  if (!match) return ''
  const m = Number(match[2])
  return m >= 1 && m <= 12 ? `${match[1]} 年 ${m} 月` : ''
}

/** A number typed by a person: 70.5, 70，5 → 70.5; empty → null; anything else → NaN. */
export function numberOf(text: string): number | null {
  const trimmed = text.trim().replace(/，/g, '.').replace(/,/g, '.')
  if (!trimmed) return null
  const value = Number(trimmed)
  return Number.isFinite(value) && value > 0 ? value : Number.NaN
}

/** HH:MM, also from 9:5 / 2130 / 21.30. */
export function timeOf(text: string): string | null {
  const trimmed = text.trim().replace(/[：.]/g, ':')
  const match = /^(\d{1,2}):?(\d{2})$/.exec(trimmed)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** YYYY-MM-DD, also from 2026/10/4 or 2026.10.4; null when not a date. */
export function isoOf(text: string): string | null {
  const match = /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/.exec(text.trim())
  if (!match) return null
  const iso = `${match[1]}-${String(Number(match[2])).padStart(2, '0')}-${String(Number(match[3])).padStart(2, '0')}`
  return Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) ? null : iso
}

/** "2026-09-24T21:00:00" (local, as the server sends it) → 今天 21:00 / 明天 09:00 / 9 月 30 日 20:00. */
export function whenText(ctx: Ctx, iso: string | null | undefined): string {
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
  const tomorrow = new Date(`${ctx.today}T12:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const label = date === ctx.today ? '今天' : date === tomorrow.toISOString().slice(0, 10) ? '明天' : day(ctx, date)
  return `${label} ${time}`.trim()
}

// --- the record ----------------------------------------------------------------------------------------

export type RecordsSummary = { checkups: number; first_date: string | null; last_date: string | null; categories_zh: string[]; wearable_days: number }

/** "2 次体检 · 2025 年 8 月至 2026 年 8 月 · 血常规、体格与血压、血脂等 · 手环 355 天": only what was counted. */
export function summaryParts(summary: RecordsSummary): string[] {
  const range = summary.first_date && summary.last_date
    ? summary.first_date.slice(0, 7) === summary.last_date.slice(0, 7) ? month(summary.last_date) : `${month(summary.first_date)}至 ${month(summary.last_date)}`
    : ''
  const categories = summary.categories_zh.length > 3 ? `${summary.categories_zh.slice(0, 3).join('、')}等` : summary.categories_zh.join('、')
  return [`${summary.checkups} 次体检`, range, categories, summary.wearable_days > 0 ? `手环 ${summary.wearable_days} 天` : ''].filter(Boolean)
}

/** The route copy names the web host's model and its record service; in Claude Code the model is Claude. */
export function hostText(text: string): string {
  return text.replace(/DeepSeek 模型/g, 'Claude').replace(/DeepSeek/g, 'Claude')
}

/** An error the route answered, or a fallback. */
export function errorOf(json: Record<string, unknown> | null | undefined, fallback: string): string {
  const error = json?.error
  return typeof error === 'string' && error.trim() ? error : fallback
}
