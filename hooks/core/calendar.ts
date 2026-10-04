import { Buffer } from '../sys/buffer.ts'
// Reminders as an iCalendar file the person adds to their own calendar: DSH
// has no push notifications, and a calendar already knows how to remind. Only
// retest dates the plan's verdicts give and a daily check-in while the plan
// has items to tick. RFC 5545: CRLF, lines folded at 75 octets, text escaped.
// UIDs never contain a date that moves, so importing the file again updates
// the same events instead of adding new ones.

import { createHash } from '../sys/crypto.ts'
import { addDays, daysBetween } from './interventions.ts'
import { retestsOf, type Journey } from './journey.ts'
import type { Tracking } from './tracking.ts'

const PRODID = '-//dsh-plugin-longpi//LongPi//ZH'
const UID_HOST = '@dsh-plugin-longpi'
const CHECKIN_DAYS = 90
const MAX_OCTETS = 75

export function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Split a content line into 75-octet pieces without cutting a UTF-8 character; continuations start with a space. */
export function foldLine(line: string): string {
  const pieces: string[] = []
  let current = ''
  let size = 0
  for (const char of line) {
    const bytes = Buffer.byteLength(char, 'utf8')
    if (size + bytes > MAX_OCTETS) {
      pieces.push(current)
      current = ' '
      size = 1
    }
    current += char
    size += bytes
  }
  pieces.push(current)
  return pieces.join('\r\n')
}

function compactDate(iso: string): string {
  return iso.replace(/-/g, '')
}

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function slug(marker: string): string {
  const ascii = marker.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  // Chinese marker names stay stable in a UID through a short hash of the name.
  if (/^[\x20-\x7e]+$/.test(marker) && ascii) return ascii
  const hash = createHash('sha1').update(marker).digest('hex').slice(0, 8)
  return ascii ? `${ascii}-${hash}` : hash
}

function alarm(description: string, trigger: string): string[] {
  return ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(description)}`, `TRIGGER:${trigger}`, 'END:VALARM']
}

/**
 * The day a retest event sits on: its date while that is still ahead or due
 * today for the first time; once it is overdue, tomorrow, so the 09:00 alarm
 * can still fire. The UID stays the same, so a re-import moves the one event.
 */
export function retestDay(retest: { date: string; first_due: string }, today: string): { date: string; sequence: number } {
  if (retest.first_due >= today) return { date: retest.date > today ? retest.date : today, sequence: 0 }
  return { date: addDays(today, 1), sequence: Math.max(0, daysBetween(retest.first_due, today)) }
}

export function buildCalendar(journey: Journey, tracking: Tracking, opts: { now: Date }): string {
  const dtstamp = stamp(opts.now)
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${PRODID}`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:LongPi']
  const version = tracking.plan?.version ?? journey.plan.version ?? 0
  for (const retest of retestsOf(tracking)) {
    const summary = `LongPi 复测：${retest.marker}`
    const day = retestDay(retest, journey.today)
    lines.push(
      'BEGIN:VEVENT',
      `UID:longpi-retest-${slug(retest.marker)}-v${version}${UID_HOST}`,
      `DTSTAMP:${dtstamp}`,
      `SEQUENCE:${day.sequence}`,
      `DTSTART;VALUE=DATE:${compactDate(day.date)}`,
      `DTEND;VALUE=DATE:${compactDate(addDays(day.date, 1))}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(`LongPi 按方案给出的${retest.marker}复测日期。结果放进体检记录后，LongPi 会判断变化是否超出正常波动。`)}`,
      'TRANSP:TRANSPARENT',
      ...alarm(summary, 'PT9H'),
      'END:VEVENT',
    )
  }
  if (journey.plan.exists && journey.plan.checkin_items.length > 0) {
    const ends = (tracking.plan?.items ?? []).filter((item) => journey.plan.checkin_items.some((row) => row.id === item.id)).map((item) => item.end)
    const until = ends.length > 0 && ends.every((end): end is string => Boolean(end))
      ? ends.sort().at(-1) as string
      : addDays(journey.today, CHECKIN_DAYS)
    const summary = `LongPi 打卡：${journey.plan.title}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:longpi-checkin${UID_HOST}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${compactDate(journey.today)}T210000`,
      'DURATION:PT10M',
      `RRULE:FREQ=DAILY;UNTIL=${compactDate(until)}T235959`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(`今天的方案：${journey.plan.checkin_items.map((item) => item.title).join('、')}。在 LongPi 健康页点“今天完成了”，或在对话里说一句。`)}`,
      ...alarm(summary, 'PT0M'),
      'END:VEVENT',
    )
  }
  // No saved plan: remind the missing checks that unlock a result, once a week.
  // With nothing missing there is no event; the follow-up answer says why it is quiet.
  if (!journey.plan.exists) {
    for (const addon of (journey.addons ?? []).slice(0, 3)) {
      const summary = `LongPi：${addon.item_zh} → 解锁${addon.unlocks_zh}`
      lines.push(
        'BEGIN:VEVENT',
        `UID:longpi-unlock-${slug(addon.item_zh)}${UID_HOST}`,
        `DTSTAMP:${dtstamp}`,
        'SEQUENCE:0',
        `DTSTART:${compactDate(journey.today)}T200000`,
        'DURATION:PT15M',
        'RRULE:FREQ=WEEKLY;COUNT=12',
        `SUMMARY:${escapeText(summary)}`,
        `DESCRIPTION:${escapeText('没有日常打卡方案。每周提醒这一项待解锁的检查，做完就不需要再看「还差几项检查」。没有别的事要催时，也不会每天响。')}`,
        ...alarm(summary, 'PT0M'),
        'END:VEVENT',
      )
    }
  }
  lines.push('END:VCALENDAR')
  return `${lines.map(foldLine).join('\r\n')}\r\n`
}
