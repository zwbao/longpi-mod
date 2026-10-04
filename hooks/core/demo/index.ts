// 示例档案: a complete, fictional member (李明华, male, 58, Hangzhou; synthetic data matching no real person) that
// anyone can open from the person picker to see what LongPi offers once a record is full — results, a deep analysis,
// a plan in its third week with check-ins, wearable days up to yesterday.
//
// It lives in the person registry like a family member (people/<DEMO_ID>/), but its store is rebuilt from the bundled
// assets every time it is opened, so whatever someone does in it is gone the next time, and its record comes from a
// local read-only stand-in for Mirobody (server.ts) instead of any account. Dates are shifted to today: the plan
// started three weeks ago, the watch days end yesterday, the checkups keep their spacing before the plan.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from '../../sys/fs.ts'
import { dirname, join } from '../../sys/path.ts'
import { readConnection, saveConnection } from '../connection.ts'
import { addCheckIns, currentPlan } from '../interventions.ts'
import { personDir, readRegistry, updatePerson, type Person } from '../people/store.ts'
import { writeJsonAtomic } from '../core/store.ts'
import record from './assets/record.ts'
import store from './assets/store.ts'
import { RECORD_FILE, writeLocalRecord, type LocalRecord } from '../local-record.ts'
import { LOCAL_MCP_URL } from '../mcp.ts'

export const DEMO_ID = 'pdemolimh01'
export const DEMO_LABEL = '示例档案'
/** The plan in the bundled store started on this day; it is moved to three weeks before today. */
const PLAN_DAYS = 21

interface DemoObservation { indicator: string; name: string; system: string; code: string; unit: string; date: string; time: string; value: string; file: string }

function isoDay(at: Date): string {
  return at.toISOString().slice(0, 10)
}

function addDays(iso: string, days: number): string {
  const at = new Date(`${iso}T00:00:00Z`)
  at.setUTCDate(at.getUTCDate() + days)
  return isoDay(at)
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/** Every ISO date (and the date part of a timestamp) moved by `days`. */
function shiftText(text: string, days: number): string {
  if (days === 0) return text
  // A version that looks like a date (the consent version 2026-09-24) is a name, not a day: it stays.
  return text.replace(/(?<!"version"\s*:\s*"|version=)\b(20\d{2}-\d{2}-\d{2})(?=T|\b)/g, (date) => addDays(date, days))
}

/** The record as of today: checkups keep their spacing before the plan; the 90 watch days end yesterday. */
export function demoRecord(today: string): typeof record {
  const labShift = daysBetween(store.anchor, addDays(today, -PLAN_DAYS))
  const watch = (record.observations as DemoObservation[]).filter((row) => /^[a-z]/.test(row.indicator))
  const lastWatch = watch.map((row) => row.date).sort().at(-1) ?? store.anchor
  const watchShift = daysBetween(lastWatch, addDays(today, -1))
  const observations = (record.observations as DemoObservation[]).map((row) => {
    const shift = /^[a-z]/.test(row.indicator) ? watchShift : labShift
    return { ...row, date: addDays(row.date, shift), time: `${addDays(row.date, shift)}${row.time.slice(10)}` }
  })
  return { ...record, today, observations }
}

/** The demo's record goes into its own store as record.json, dated to today; the local record answers for it. */
function writeDemoRecord(dir: string, today: string): void {
  writeLocalRecord(join(dir, RECORD_FILE), demoRecord(today) as unknown as LocalRecord)
  writeFileSync(join(dir, 'record-day.txt'), today, { mode: 0o600 })
}

/** The demo's registry entry, added once; it is never removed and never paired with an account. */
export function ensureDemoPerson(root: string): void {
  const reg = readRegistry(root)
  if (reg.people.some((person) => person.id === DEMO_ID)) return
  const demo: Person = { id: DEMO_ID, label_zh: DEMO_LABEL, name: '李明华', sex: 'male', birth_year: 1968, created_at: new Date().toISOString(), demo: true }
  const path = join(root, 'people.json')
  mkdirSync(root, { recursive: true, mode: 0o700 })
  writeJsonAtomic(path, { active: reg.active, people: [...reg.people, demo] })
}

export function isDemo(id: string | null | undefined): boolean {
  return id === DEMO_ID
}

/** A fresh copy of the demo store, dated to today, with three weeks of check-ins and a live record address. */
export async function openDemo(root: string, today = isoDay(new Date())): Promise<void> {
  const dir = personDir(root, DEMO_ID)
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const shift = daysBetween(store.anchor, addDays(today, -PLAN_DAYS))
  for (const [rel, text] of Object.entries(store.files as Record<string, string>)) {
    const path = join(dir, rel)
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    writeFileSync(path, shiftText(text, shift), { mode: 0o600 })
  }
  writeDemoRecord(dir, today)
  saveConnection(dir, { mcp_url: LOCAL_MCP_URL, mcp_token: '' })
  // Three weeks lived: daily items done on most days, a one-off (a referral) done once.
  const plan = currentPlan(dir)
  if (plan) {
    const start = addDays(today, -PLAN_DAYS)
    for (let day = 0; day < PLAN_DAYS; day += 1) {
      const date = addDays(start, day)
      const entries = plan.items.filter((item) => !item.mirobody).flatMap((item, index) => {
        if (item.category === 'other') return day === 9 + index ? [{ item: item.id, date, done: true }] : []
        const done = ((day * 7 + index * 3) % 10) < 8
        return [{ item: item.id, date, done }]
      })
      if (entries.length) addCheckIns(dir, entries, { today, source: 'board' })
    }
  }
  updatePerson(root, DEMO_ID, { link_error: '' })
}

/** A new day moves the demo's dates along: its record is rewritten for today. */
export async function keepDemoReachable(root: string, today = isoDay(new Date())): Promise<void> {
  const dir = personDir(root, DEMO_ID)
  if (!existsSync(dir)) return
  let day = ''
  try {
    day = readFileSync(join(dir, 'record-day.txt'), 'utf8').trim()
  } catch {
    day = ''
  }
  if (day !== today) writeDemoRecord(dir, today)
  if (readConnection(dir)?.mcp_url !== LOCAL_MCP_URL) saveConnection(dir, { mcp_url: LOCAL_MCP_URL, mcp_token: '' })
}
