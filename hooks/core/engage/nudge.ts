// The one prompt slot in the DSH workday (docs/codex-design.md §2): the stand-up reminder and, on a reveal day,
// one 「有一张实验卡可以翻了」. Pure rules; the client adds what only it can see (typing in the last 10 s, a turn
// running for 60 s, how long DSH has been in continuous use). No reward is attached to standing up, the text
// never carries a health number, and nothing appears in presentation mode or outside 我的白天.

import type { IsoDay, IsoTime } from '../contracts/common.ts'
import { addDays, civilParts, isoDay } from '../interventions.ts'

export const STANDUP_MAX_PER_DAY = 2
export const STANDUP_GAP_MS = 2 * 60 * 60_000
export const STANDUP_SITTING_MIN = 90
export const TURN_RUNNING_MS = 60_000
export const TYPING_QUIET_MS = 10_000
export const CONFIRM_WINDOW_MS = 10 * 60_000

export interface MyDay { start: string; end: string; asked: boolean }
export const DEFAULT_MY_DAY: MyDay = { start: '09:00', end: '22:00', asked: false }

export interface NudgeState {
  /** Opt-in (owner decision 2026-09-27; asked in the first-open flow). */
  standup: 'on' | 'off' | null
  shown: Array<{ at: IsoTime; kind: 'standup' | 'reveal'; ref?: string }>
  dismissed_day: IsoDay | null
  /** 好 pressed; confirmed when the wristband shows steps within 10 minutes. */
  acks: Array<{ at: IsoTime; status: 'pending' | 'confirmed' | 'unconfirmed' }>
  /** Reveal notices: per run or pack, the day first shown and whether 稍后 asked for one more. */
  reveal: Record<string, { first: IsoDay | null; later: IsoDay | null; done: boolean }>
}

export const EMPTY_NUDGE: NudgeState = { standup: null, shown: [], dismissed_day: null, acks: [], reveal: {} }

function minutesOf(text: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim())
  if (!m) return -1
  return Number(m[1]) * 60 + Number(m[2])
}

export function validClock(text: unknown): text is string {
  return typeof text === 'string' && minutesOf(text) >= 0 && minutesOf(text) < 24 * 60
}

/** Inside 我的白天; a window may cross midnight (13:00–02:00). */
export function inMyDay(myDay: MyDay, now: Date): boolean {
  const start = minutesOf(myDay.start)
  const end = minutesOf(myDay.end)
  if (start < 0 || end < 0 || start === end) return true
  const parts = civilParts(now)
  const t = parts.hour * 60 + parts.minute
  return start < end ? t >= start && t < end : t >= start || t < end
}

/** 「1 小时 40 分」 from minutes; never a health number, only the sitting time DSH saw. */
export function sittingZh(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  const hours = Math.floor(m / 60)
  const rest = m % 60
  if (hours === 0) return `${rest} 分钟`
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分`
}

export function standupLine(minutes: number): string {
  return `已经坐了 ${sittingZh(minutes)}。起来走两分钟？`
}

export const REVEAL_LINE = '有一张实验卡可以翻了。'

export interface SlotInput {
  now: Date
  enabled: boolean
  wristband: boolean
  presentation: boolean
  myDay: MyDay
  nudge: NudgeState
  /** Runs or packs ready to turn, oldest first. */
  ready: Array<{ ref: string; since: IsoDay }>
}

export interface SlotView {
  /** The server allows a stand-up line now; the client still needs ≥90 min sitting, a turn running ≥60 s, no typing for 10 s. */
  standup: boolean
  standups_left: number
  reveal: null | { ref: string; text_zh: string }
  quiet: null | 'presentation' | 'outside_my_day' | 'off'
}

export function slotView(input: SlotInput): SlotView {
  const today = isoDay(input.now)
  const blank: SlotView = { standup: false, standups_left: 0, reveal: null, quiet: null }
  if (!input.enabled) return { ...blank, quiet: 'off' }
  if (input.presentation) return { ...blank, quiet: 'presentation' }
  if (!inMyDay(input.myDay, input.now)) return { ...blank, quiet: 'outside_my_day' }
  const todays = input.nudge.shown.filter((row) => isoDay(new Date(row.at)) === today)
  const standups = todays.filter((row) => row.kind === 'standup')
  const last = standups.at(-1)
  const gapOk = !last || input.now.getTime() - Date.parse(last.at) >= STANDUP_GAP_MS
  const left = Math.max(0, STANDUP_MAX_PER_DAY - standups.length)
  const standup = input.nudge.standup === 'on' && input.wristband && input.nudge.dismissed_day !== today && left > 0 && gapOk
  let reveal: SlotView['reveal'] = null
  if (!todays.some((row) => row.kind === 'reveal')) {
    for (const row of input.ready) {
      const state = input.nudge.reveal[row.ref]
      if (state?.done) continue
      const due = !state || !state.first || (state.later != null && state.later === today)
      if (due) { reveal = { ref: row.ref, text_zh: REVEAL_LINE }; break }
    }
  }
  return { standup, standups_left: left, reveal, quiet: null }
}

/** 稍后: one more notice the next day, then none; the card stays and never expires. */
export function laterReveal(nudge: NudgeState, ref: string, today: IsoDay): void {
  const state = nudge.reveal[ref] ?? { first: today, later: null, done: false }
  if (state.later) state.done = true
  else state.later = addDays(state.first ?? today, 1)
  nudge.reveal[ref] = state
}

export function markRevealShown(nudge: NudgeState, ref: string, now: Date): void {
  const today = isoDay(now)
  const state = nudge.reveal[ref] ?? { first: null, later: null, done: false }
  if (!state.first) state.first = today
  else if (state.later === today) state.done = true
  nudge.reveal[ref] = state
  nudge.shown.push({ at: now.toISOString() as IsoTime, kind: 'reveal', ref })
}

/**
 * Settle 好 presses against raw wristband steps. A press counts only when steps arrive within 10 minutes;
 * a press whose window the wristband has not synced yet stays pending, and is dropped after two days.
 */
export function settleAcks(nudge: NudgeState, samples: ReadonlyArray<{ at: number; value: number }> | null, now: Date, day?: IsoDay): number {
  let confirmed = 0
  const newest = samples && samples.length > 0 ? Math.max(...samples.map((row) => row.at)) : null
  for (const ack of nudge.acks) {
    if (ack.status !== 'pending') continue
    if (day && isoDay(new Date(ack.at)) !== day) continue
    const at = Date.parse(ack.at)
    const end = at + CONFIRM_WINDOW_MS
    if (samples) {
      const steps = samples.filter((row) => row.at >= at && row.at <= end).reduce((sum, row) => sum + row.value, 0)
      if (steps >= 20) { ack.status = 'confirmed'; confirmed += 1; continue }
      if (newest != null && newest > end) { ack.status = 'unconfirmed'; continue }
    }
    if (now.getTime() - at > 2 * 86_400_000) ack.status = 'unconfirmed'
  }
  nudge.acks = nudge.acks.slice(-40)
  nudge.shown = nudge.shown.filter((row) => now.getTime() - Date.parse(row.at) < 14 * 86_400_000)
  return confirmed
}

/** Days with at least one confirmed stand-up (the 「每坐 90 分钟起身一次」 experiment's 做到 days). */
export function standupDays(nudge: NudgeState): Set<IsoDay> {
  return new Set(nudge.acks.filter((row) => row.status === 'confirmed').map((row) => isoDay(new Date(row.at))))
}
