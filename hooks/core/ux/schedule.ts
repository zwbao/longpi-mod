// Calendar events. A suggestion stays off the calendar until the person confirms it.

import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from '../../sys/fs.ts'
import { join } from '../../sys/path.ts'

export type ScheduleKind = 'visit' | 'retest' | 'followup'

export interface ScheduleEvent {
  id: string
  date: string
  kind: ScheduleKind
  title_zh: string
  brief_zh: string
  questions_zh: string[]
  confirmed: boolean
  source: 'person' | 'suggestion'
}

function dirOf(dataDir: string): string {
  return join(dataDir, 'schedule')
}

function fileOf(dataDir: string, id: string): string {
  return join(dirOf(dataDir), `${id.replace(/[^a-z0-9_-]/gi, '')}.json`)
}

export function suggestEvent(input: Omit<ScheduleEvent, 'confirmed' | 'source' | 'id'> & { id?: string }): ScheduleEvent {
  return {
    id: input.id ?? `sug-${input.kind}-${input.date}`,
    date: input.date,
    kind: input.kind,
    title_zh: input.title_zh,
    brief_zh: input.brief_zh,
    questions_zh: [...input.questions_zh],
    confirmed: false,
    source: 'suggestion',
  }
}

/** Only an explicit confirm puts a date on the calendar. */
export function confirmEvent(event: ScheduleEvent): ScheduleEvent {
  return { ...event, confirmed: true, source: 'person' }
}

export function listEvents(dataDir: string): ScheduleEvent[] {
  const dir = dirOf(dataDir)
  if (!existsSync(dir)) return []
  const rows: ScheduleEvent[] = []
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue
    try {
      const parsed = JSON.parse(readFileSync(join(dir, name), 'utf8')) as ScheduleEvent
      if (parsed && typeof parsed.id === 'string' && typeof parsed.date === 'string') rows.push(parsed)
    } catch {
      // a damaged card is skipped, not shown as a date
    }
  }
  return rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
}

export function saveEvent(dataDir: string, event: ScheduleEvent): ScheduleEvent {
  mkdirSync(dirOf(dataDir), { recursive: true })
  writeFileSync(fileOf(dataDir, event.id), JSON.stringify(event))
  return event
}

export function calendarEvents(dataDir: string): ScheduleEvent[] {
  return listEvents(dataDir).filter((event) => event.confirmed)
}
