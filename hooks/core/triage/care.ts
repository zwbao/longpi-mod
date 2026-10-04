// After "see a doctor": did they book, did they go, what did the doctor say (M1). Each answer is a CareItem
// in the person's memory; a visit logged after the values it was about lets the plan go ahead (the plan
// adapts), a newer checkup that still shows them opens the finding again.

import type { Id, IsoDay, Provenance } from '../contracts/common.ts'
import type { CareItem, NewMemoryItem } from '../contracts/memory.ts'
import type { TriageFinding } from '../contracts/triage.ts'
import { currentBus } from '../core/bus.ts'
import { memoryFor } from '../core/memory.ts'
import { quoteIn } from '../core/turn-text.ts'
import { addDays } from '../interventions.ts'
import { DOCTOR_ZH, type StopResult } from '../plan-safety.ts'
import { findingsFrom, patterns } from './rules.ts'

/** 「9 月 10 日」, with the year when it is not this year. */
function dayZhC(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return iso ?? ''
  const md = `${Number(m[2])} 月 ${Number(m[3])} 日`
  return Number(m[1]) === new Date().getFullYear() ? md : `${m[1]} 年 ${md}`
}

export type CareStatus = CareItem['care_status']

export function careItems(dataDir: string): CareItem[] {
  try {
    return memoryFor(dataDir).active('care') as CareItem[]
  } catch {
    return []
  }
}

export function careFor(dataDir: string, findingId: string): CareItem | null {
  const items = careItems(dataDir).filter((item) => item.finding_id === findingId)
  return items.at(-1) ?? null
}

const STATUS_ZH: Record<CareStatus, string> = { advised: '建议看医生', booked: '已预约', visited: '已看过医生', declined: '暂不就诊', unknown: '不确定' }

/** What the doctor said, without a leading 医生说 (the sentence around it already says so). */
export function outcomeText(text: string | undefined): string {
  return String(text ?? '').trim().replace(/^(?:医生|大夫)(?:说|讲|告诉我)[：:，,]?\s*/, '').replace(/[。.]$/, '')
}

export function careText(input: { status: CareStatus; department_zh?: string; visit_date?: string; outcome_zh?: string; label_zh?: string }): string {
  const what = input.label_zh ? `${input.label_zh}：` : ''
  const where = input.department_zh ? `（${input.department_zh}）` : ''
  const when = input.visit_date ? ` ${dayZhC(input.visit_date)}` : ''
  const outcome = input.outcome_zh ? `，医生说：${outcomeText(input.outcome_zh)}` : ''
  return `${what}${STATUS_ZH[input.status]}${when}${where}${outcome}`
}

export interface VisitInput {
  finding_id?: string
  status: CareStatus
  visit_date?: string
  department_zh?: string
  outcome_zh?: string
  quote_zh?: string
  /** The person's own message this turn, for the verbatim check. */
  said_zh?: string
  /** Civil day used to resolve 下周一. */
  today?: string
  via: 'chat' | 'page'
  session_id?: string
  confirmed?: boolean
}

const DENY_BOOKING = /没约|没有约|未约|没有这条预约|不是这天|不是那天|删掉|取消这|页头说我已约|你又说没有/
const AFFIRM_BOOKING = /(?:我|已经|刚).{0,8}(?:约了|约好|预约|挂了号|挂号)|约了\d|约好了|预约了|已挂号|挂好了号/
const WEEKDAY: Record<string, number> = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 }

function upcomingWeekday(today: string, want: number): string {
  const dow = new Date(`${today}T12:00:00+08:00`).getUTCDay()
  let delta = (want - dow + 7) % 7
  if (delta === 0) delta = 7
  return addDays(today, delta)
}

/** Whether their words name this calendar day (2026-10-05, 10月5日, or 下周一 when that is the day). */
export function dateSaid(quote: string, visitDate: string, today?: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) return false
  const folded = quote.normalize('NFKC').replace(/\s+/g, '')
  if (folded.includes(visitDate)) return true
  const [, month, day] = visitDate.split('-').map(Number) as [number, number, number]
  if (new RegExp(`${month}月${day}[日号]`).test(folded)) return true
  if (today) {
    const relative = /下?周([一二三四五六日天])/.exec(folded)
    const want = relative ? WEEKDAY[relative[1] ?? ''] : undefined
    if (want != null && upcomingWeekday(today, want) === visitDate) return true
  }
  return false
}

/** They are denying a booking (没约那一天, 页头说我已约). */
export function deniesBooking(quote: string): boolean {
  return DENY_BOOKING.test(quote.normalize('NFKC'))
}

/**
 * A booking is theirs only when the quote is their words, says they booked, and names the date.
 * 「下周一去社区医院」 is a plan, not a booking. 「页头说我已约 10 月 5 日」 is a denial.
 */
export function affirmsBooking(quote: string, said: string, visitDate: string, today?: string): boolean {
  const text = quote.normalize('NFKC').trim()
  if (!text || !quoteIn(text, said)) return false
  if (deniesBooking(text)) return false
  if (!AFFIRM_BOOKING.test(text.replace(/\s+/g, ''))) return false
  return dateSaid(text, visitDate, today)
}

function isDay(value: unknown): value is IsoDay {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/**
 * Record a booking, a visit or a decision not to go. Without a finding id it applies to the first open
 * finding. Supersedes the finding's previous care item, so the history stays in memory_log.
 */
export function logCareVisit(dataDir: string, input: VisitInput, findings: readonly TriageFinding[]): { ok: true; item: CareItem; cleared?: boolean; kept?: boolean } | { ok: false; error: string } {
  const finding = input.finding_id ? findings.find((row) => row.id === input.finding_id) : findings.find((row) => row.status !== 'visited') ?? findings[0]
  const findingId = finding?.id ?? input.finding_id ?? ''
  if (!['advised', 'booked', 'visited', 'declined', 'unknown'].includes(input.status)) return { ok: false, error: 'status must be advised, booked, visited, declined or unknown' }
  const store = memoryFor(dataDir)
  const previous = findingId ? careFor(dataDir, findingId) : careItems(dataDir).filter((row) => row.care_status === 'booked').at(-1) ?? null
  // Chat can store a booking only from the person's own words: a date they said they booked.
  // Anything else is a proposal (no date on the header). A denial retracts the booking and stays retracted.
  if (input.status === 'booked' && input.via === 'chat') {
    const quote = (input.quote_zh ?? '').trim()
    const said = input.said_zh ?? ''
    const provenance: Provenance = {
      kind: 'chat', at: new Date().toISOString(), by: 'M1',
      ...(input.session_id ? { session_id: input.session_id } : {}),
      ...(quote ? { quote_zh: quote.slice(0, 200) } : {}),
    }
    if (said && deniesBooking(said) && (!quote || quoteIn(quote, said))) {
      const booked = careItems(dataDir).filter((row) => row.care_status === 'booked')
      if (booked.length > 0) store.apply(booked.map((row) => ({ op: 'retract' as const, id: row.id, provenance })), 'M1')
      const ghost = {
        ...(booked[0] ?? previous ?? { id: 'cleared', kind: 'care' as const, text_zh: '', confirmed: true, status: 'retracted' as const, safety_relevant: false, provenance, updated: provenance.at }),
        care_status: 'unknown' as const,
        text_zh: '已删除这条预约',
        confirmed: true,
        status: 'retracted' as const,
        visit_date: undefined,
      }
      return { ok: true, cleared: true, item: ghost as CareItem }
    }
    const day = isDay(input.visit_date) ? input.visit_date : ''
    if (day && affirmsBooking(quote, said, day, input.today)) {
      input = { ...input, confirmed: true }
    } else if (previous?.care_status === 'visited' || (previous?.care_status === 'booked' && previous.confirmed !== false)) {
      return { ok: true, kept: true, item: previous }
    } else {
      const proposed = day || '未注明日期'
      const proposal = {
        kind: 'care',
        ...(findingId ? { finding_id: findingId } : {}),
        care_status: 'advised' as const,
        ...(input.department_zh || finding?.department_zh ? { department_zh: input.department_zh || finding?.department_zh } : {}),
        text_zh: `待确认：提到 ${proposed} 就诊，但你尚未确认已预约该日。`,
        confirmed: false,
        provenance,
      } as NewMemoryItem
      const applied = store.apply([previous ? { op: 'supersede', id: previous.id, item: proposal } : { op: 'add', item: proposal }], 'M1')
      const id = applied.applied[0]
      const saved = (store.active('care') as CareItem[]).find((row) => row.id === id)
      if (!saved) return { ok: false, error: applied.rejected[0]?.reason ?? 'not saved' }
      return { ok: true, item: saved }
    }
  }
  const pattern = patterns().find((row) => `finding-${row.id}` === findingId)
  const provenance: Provenance = {
    kind: input.via, at: new Date().toISOString(), by: 'M1',
    ...(input.session_id ? { session_id: input.session_id } : {}),
    ...(input.quote_zh ? { quote_zh: input.quote_zh.slice(0, 200) } : {}),
  }
  const item = {
    kind: 'care',
    ...(findingId ? { finding_id: findingId } : {}),
    care_status: input.status,
    ...(input.department_zh || finding?.department_zh ? { department_zh: input.department_zh || finding?.department_zh } : {}),
    ...(isDay(input.visit_date) ? { visit_date: input.visit_date } : {}),
    ...(input.outcome_zh ? { outcome_zh: input.outcome_zh.trim().slice(0, 300) } : {}),
    text_zh: careText({ status: input.status, department_zh: input.department_zh || finding?.department_zh, visit_date: isDay(input.visit_date) ? input.visit_date : undefined, outcome_zh: input.outcome_zh?.trim(), label_zh: pattern?.label_zh }),
    confirmed: input.confirmed !== false,
    provenance,
  } as NewMemoryItem
  // A visit told without a date took place on the day that was booked (when that day has come), else today.
  const itemRecord = item as unknown as { visit_date?: string; outcome_zh?: string; text_zh: string }
  if (input.status === 'visited' && !itemRecord.visit_date) {
    const today = new Date().toISOString().slice(0, 10)
    const booked = previous?.care_status === 'booked' && previous.visit_date && previous.visit_date <= today ? previous.visit_date : today
    itemRecord.visit_date = booked
    itemRecord.text_zh = careText({ status: input.status, department_zh: input.department_zh || finding?.department_zh, visit_date: booked, outcome_zh: input.outcome_zh?.trim(), label_zh: pattern?.label_zh })
  }
  if (itemRecord.outcome_zh) itemRecord.outcome_zh = outcomeText(itemRecord.outcome_zh)
  const result = store.apply([previous ? { op: 'supersede', id: previous.id, item } : { op: 'add', item }], 'M1')
  const id = result.applied[0]
  const saved = (store.active('care') as CareItem[]).find((row) => row.id === id)
  if (!saved) return { ok: false, error: result.rejected[0]?.reason ?? 'not saved' }
  const bus = currentBus()
  if (bus) {
    if (input.status === 'visited') bus.emit('care.visit_logged', { care_item_id: saved.id as Id, ...(findingId ? { finding_id: findingId } : {}), with_brief: Boolean(saved.brief_id) }, { module: 'M1', via: input.via === 'chat' ? 'tool' : 'route' })
    if (input.status === 'visited' && findingId) bus.emit('triage.resolved', { finding_id: findingId, how: 'visited' }, { module: 'M1', via: input.via === 'chat' ? 'tool' : 'route' })
  }
  return { ok: true, item: saved }
}

export interface CareState {
  /** The stop after visits: findings a doctor has seen since their values are taken out. */
  stop: StopResult
  findings: TriageFinding[]
  /** Findings a doctor has seen, with what they said. */
  seen: Array<{ finding: TriageFinding; care: CareItem }>
}

/**
 * The record's stop with the person's visits applied. A finding counts as seen when a visit is logged on
 * or after the date of its newest value; a checkup after the visit that still shows it opens it again.
 */
export function careState(dataDir: string, stop: StopResult, today: string): CareState {
  const careOf = (id: string) => careFor(dataDir, id)
  const findings = findingsFrom(stop, today, careOf)
  const seen: CareState['seen'] = []
  const seenKeys = new Set<string>()
  for (const finding of findings) {
    const care = careOf(finding.id)
    if (!care || care.care_status !== 'visited') continue
    const visitDay = care.visit_date ?? care.updated.slice(0, 10)
    const newest = finding.numbers.map((ref) => ref.date ?? '').sort().at(-1) ?? ''
    if (newest && newest > visitDay) {
      finding.status = 'open'
      continue
    }
    seen.push({ finding, care })
    const pattern = patterns().find((row) => `finding-${row.id}` === finding.id)
    for (const key of pattern?.keys ?? []) seenKeys.add(key)
  }
  if (seenKeys.size === 0) return { stop, findings, seen }
  const left = stop.hits.filter((hit) => !seenKeys.has(hit.key))
  if (left.length === stop.hits.length) return { stop, findings, seen }
  if (left.length === 0) return { stop: { stop: false, sentence_zh: '', title_zh: '', hits: [] }, findings, seen }
  // Some findings seen, others not: the sentence is rebuilt from the hits still open.
  const sentence = `请先去看医生：${left.map((hit) => hit.text_zh).join('；')}。请携带这几次体检报告就诊，查明原因。${DOCTOR_ZH}`
  return { stop: { stop: true, sentence_zh: sentence, title_zh: `请先去看医生：${left.map((hit) => hit.short_zh).slice(0, 3).join('，')}`, hits: left }, findings, seen }
}

/** What the doctor said, for the plan's notes: one line per finding seen. */
export function seenNotes(state: CareState): string[] {
  return state.seen.map(({ finding, care }) => `医生已经看过${finding.title_zh.replace(/ 偏低| 偏高| 在下降/g, '')}${care.visit_date ? `（${dayZhC(care.visit_date)}）` : ''}${care.outcome_zh ? `，医生说：${outcomeText(care.outcome_zh)}` : ''}。本方案仅安排生活方式；用药、补铁或补剂遵医嘱，不纳入方案。`)
}

/** The record-change keys a finding a doctor has seen already covers (the red-cell indices for the red-cell finding). */
export function seenChangeKeys(state: CareState): Set<string> {
  const keys = new Set<string>()
  for (const { finding } of state.seen) if (finding.id === 'finding-red-cell') for (const key of ['hb', 'hct', 'mcv', 'mch', 'mchc', 'rbc']) keys.add(key)
  return keys
}
