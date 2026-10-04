// A person's own intervention plan and check-ins, kept in dataDir next to
// history.jsonl. Nothing here is uploaded, and nothing here is a prescription:
// the plan is what the person (or their doctor or coach) decided, saved as they
// confirmed it. Medicines and supplements are referenced by name only; their
// schedule, dose and dose log stay in Mirobody, which is where the person
// records them.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from '../sys/fs.ts'
import { join } from '../sys/path.ts'
import { stripDoses } from './dose.ts'
import { foldName } from './units.ts'

export const CATEGORIES = ['diet', 'exercise', 'sleep', 'supplement', 'drug', 'behavior', 'weight', 'other'] as const
export type Category = typeof CATEGORIES[number]
export const CATEGORY_ZH: Record<Category, string> = {
  diet: '饮食', exercise: '运动', sleep: '睡眠', supplement: '补剂', drug: '药物', behavior: '行为', weight: '体重', other: '其他',
}
export const CHECKIN_TAGS = ['illness', 'travel', 'lab_change', 'stress', 'other'] as const
export const TAG_ZH: Record<string, string> = { illness: '生病', travel: '出差旅行', lab_change: '更换检测机构', stress: '压力大', other: '其他' }

export interface Target {
  /** A Mirobody indicator measured daily, such as dailySteps or dailyTotalSleepTime. */
  metric: string
  op: '>=' | '<='
  value: number
  unit: string
}

export interface PlanItem {
  id: string
  category: Category
  title: string
  detail: string
  start: string
  end: string | null
  frequency: { times: number; per: 'day' | 'week' } | null
  target: Target | null
  markers: string[]
  mirobody: { medication: string; plan_id?: string } | null
}

export interface PlanGoal {
  marker: string
  value: number
  unit: string
}

export interface PlanVersion {
  schema: 'longpi-plan/1'
  version: number
  saved_at: string
  title: string
  source: 'chat' | 'file' | 'board' | 'analysis'
  note: string
  items: PlanItem[]
  goals: PlanGoal[]
}

export interface CheckIn {
  at: string
  date: string
  item: string
  /** true done, false an explicit miss (没做到), null a note or tag alone, or an undo. */
  done: boolean | null
  amount: number | null
  unit: string
  note: string
  tags: string[]
  source: 'chat' | 'board'
  /** Set on the row that takes back that day's check-in: the day is unknown again. */
  undo?: true
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

function dir(dataDir: string): string {
  return join(dataDir, 'interventions')
}

function readLines<T>(path: string, keep: (row: T) => boolean): T[] {
  if (!existsSync(path)) return []
  const rows: T[] = []
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const row = JSON.parse(line) as T
      if (row && keep(row)) rows.push(row)
    } catch {
      /* skip a torn line */
    }
  }
  return rows
}

function append(dataDir: string, file: string, row: unknown): void {
  mkdirSync(dir(dataDir), { recursive: true, mode: 0o700 })
  appendFileSync(join(dir(dataDir), file), `${JSON.stringify(row)}\n`, { mode: 0o600 })
}

export function readPlans(dataDir: string): PlanVersion[] {
  return readLines<PlanVersion>(join(dir(dataDir), 'plan.jsonl'), (row) => row.schema === 'longpi-plan/1' && Array.isArray(row.items))
}

export function currentPlan(dataDir: string): PlanVersion | null {
  const plans = readPlans(dataDir)
  return plans.length > 0 ? plans[plans.length - 1] ?? null : null
}

export function readCheckIns(dataDir: string): CheckIn[] {
  return readLines<CheckIn>(join(dir(dataDir), 'adherence.jsonl'), (row) => typeof row.item === 'string' && DATE.test(row.date))
}

/**
 * Whether each item was done on each day: the latest check-in that says done (true), not done (false) or
 * takes the day back (undo) wins, in the order they were recorded. A day with no such row, or whose latest
 * is an undo, is absent: unknown, never a miss. A note or tag alone says nothing about it.
 */
export function checkinStatus(rows: readonly CheckIn[]): Map<string, Map<string, boolean>> {
  const out = new Map<string, Map<string, boolean>>()
  for (const row of rows) {
    if (typeof row.done !== 'boolean' && !row.undo) continue
    const days = out.get(row.item) ?? new Map<string, boolean>()
    if (typeof row.done === 'boolean') days.set(row.date, row.done)
    else days.delete(row.date)
    out.set(row.item, days)
  }
  return out
}

/** Days each item was done, counted cumulatively: a missed day never takes one away. */
export function doneCounts(dataDir: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const [item, days] of checkinStatus(readCheckIns(dataDir))) out.set(item, [...days.values()].filter(Boolean).length)
  return out
}

/** Civil clock for check-ins, streaks and reminders. The person is in China; the process zone is not. */
export const CIVIL_TZ = 'Asia/Shanghai'

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Wall-clock parts in Asia/Shanghai. Hour 24 (some engines at midnight) is 0. */
export function civilParts(at: Date = new Date()): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: CIVIL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  })
  const map = Object.fromEntries(fmt.formatToParts(at).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  let hour = Number(map.hour)
  if (hour === 24) hour = 0
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    weekday: WEEKDAY_INDEX[map.weekday ?? ''] ?? 0,
  }
}

/** YYYY-MM-DD in Asia/Shanghai, not UTC and not the process zone. */
export function isoDay(at: Date = new Date()): string {
  const parts = civilParts(at)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

export function addDays(iso: string, days: number): string {
  const at = new Date(`${iso}T00:00:00Z`)
  at.setUTCDate(at.getUTCDate() + days)
  return at.toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : ''
}

const DOSE_NOT_SAVED = '方案只记做什么，不记剂量；药物和补剂的剂量与服用记录在用药计划里。'

export interface NormalizeContext {
  today: string
  /** Names on the person's Mirobody medication plan, with plan ids. */
  medications: Array<{ name: string; plan_id?: string }>
  previous: PlanVersion | null
}

export interface Normalized {
  plan: Omit<PlanVersion, 'version' | 'saved_at'>
  warnings: string[]
  errors: string[]
}

/**
 * Check a plan the person described or uploaded and put it in the stored shape.
 * Returns errors that stop saving and warnings to read back before confirming.
 */
export function normalizePlan(raw: unknown, context: NormalizeContext): Normalized {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const errors: string[] = []
  const warnings: string[] = []
  const itemsIn = Array.isArray(input.items) ? input.items : []
  if (itemsIn.length === 0) errors.push('方案里没有任何一项干预。')
  if (itemsIn.length > 30) errors.push('一次最多保存 30 项干预。')
  const previousByTitle = new Map((context.previous?.items ?? []).map((item) => [foldName(item.title), item]))
  const usedIds = new Set<string>()
  const items: PlanItem[] = []
  itemsIn.slice(0, 30).forEach((value, index) => {
    const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
    // A dose is never saved, whatever the category: the plan keeps what to do, Mirobody keeps doses.
    const titleIn = text(row.title, 60)
    const cleanedTitle = stripDoses(titleIn)
    const cleanedDetail = stripDoses(text(row.detail, 300))
    const title = cleanedTitle.text
    const where = title || `第 ${index + 1} 项`
    if (!titleIn) errors.push(`${where}没有名称。`)
    else if (!title) errors.push(`${where}：标题仅包含剂量，请填写具体做法。`)
    if (cleanedTitle.stripped || cleanedDetail.stripped) warnings.push(`${where}的剂量没有保存：${DOSE_NOT_SAVED}`)
    const category = (CATEGORIES as readonly string[]).includes(String(row.category)) ? row.category as Category : 'other'
    if (category === 'other' && row.category && row.category !== 'other') warnings.push(`${where}的类别「${String(row.category)}」无法识别，已归为「其他」。`)
    const detail = cleanedDetail.text
    const start = text(row.start, 10)
    if (!DATE.test(start)) errors.push(`${where}缺少开始日期（YYYY-MM-DD）。判断效果要靠它找基线。`)
    const endText = text(row.end, 10)
    const end = DATE.test(endText) ? endText : null
    if (end && DATE.test(start) && end < start) errors.push(`${where}的结束日期早于开始日期。`)
    if (DATE.test(start) && start > addDays(context.today, 60)) warnings.push(`${where}的开始日期在两个月以后。`)

    let mirobody: PlanItem['mirobody'] = null
    if ((category === 'drug' || category === 'supplement') && title) {
      const medication = stripDoses(text(row.medication, 60))
      if (medication.stripped && !cleanedTitle.stripped && !cleanedDetail.stripped) warnings.push(`${where}的剂量没有保存：${DOSE_NOT_SAVED}`)
      const name = medication.text || title
      // Linked by the name as written first (a dose stripped out may have taken part of it), then as stored.
      const hit = [...new Set([text(row.medication, 60) || titleIn, name])].map(foldName).map((folded) => context.medications.find((med) => {
        const other = foldName(med.name)
        return other && folded && (other.includes(folded) || folded.includes(other))
      })).find(Boolean)
      if (hit) mirobody = { medication: hit.name, ...(hit.plan_id ? { plan_id: hit.plan_id } : {}) }
      else {
        mirobody = { medication: name }
        warnings.push(`用药计划中未找到「${name}」。请在健康数据服务中建立用药计划并打卡，之后才能跟踪服用情况。`)
      }
    }

    let frequency: PlanItem['frequency'] = null
    const freq = row.frequency && typeof row.frequency === 'object' ? row.frequency as Record<string, unknown> : null
    if (freq && Number.isFinite(Number(freq.times)) && Number(freq.times) > 0 && (freq.per === 'day' || freq.per === 'week')) {
      frequency = { times: Math.min(50, Math.round(Number(freq.times))), per: freq.per }
    }

    let target: Target | null = null
    const tgt = row.target && typeof row.target === 'object' ? row.target as Record<string, unknown> : null
    if (tgt && text(tgt.metric, 80) && Number.isFinite(Number(tgt.value))) {
      target = { metric: text(tgt.metric, 80), op: tgt.op === '<=' ? '<=' : '>=', value: Number(tgt.value), unit: text(tgt.unit, 20) }
    }

    const markers = [...new Set((Array.isArray(row.markers) ? row.markers : []).map((item) => text(item, 60)).filter(Boolean))].slice(0, 12)
    const previous = title ? previousByTitle.get(foldName(title)) : undefined
    let id = text(row.id, 40) || previous?.id || ''
    if (!/^[a-z0-9-]{2,40}$/.test(id) || usedIds.has(id)) id = `i${Date.now().toString(36)}${index.toString(36)}`
    usedIds.add(id)
    items.push({ id, category, title, detail, start, end, frequency, target, markers, mirobody })
  })

  const goals: PlanGoal[] = []
  for (const value of Array.isArray(input.goals) ? input.goals.slice(0, 20) : []) {
    const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
    const marker = text(row.marker, 60)
    const number = Number(row.value)
    if (!marker || !Number.isFinite(number)) {
      warnings.push(`目标「${marker || '未命名'}」没有数值，没有保存。`)
      continue
    }
    goals.push({ marker, value: number, unit: text(row.unit, 20) })
  }

  const source = input.source === 'file' || input.source === 'board' || input.source === 'analysis' ? input.source : 'chat'
  const planTitle = stripDoses(text(input.title, 60))
  const note = stripDoses(text(input.note, 500))
  if (planTitle.stripped || note.stripped) warnings.push(`方案${planTitle.stripped ? '标题' : '备注'}里的剂量没有保存：${DOSE_NOT_SAVED}`)
  return {
    plan: { schema: 'longpi-plan/1', title: planTitle.text || '我的干预方案', source, note: note.text, items, goals },
    warnings,
    errors,
  }
}

export function savePlan(dataDir: string, plan: Normalized['plan']): PlanVersion {
  const previous = currentPlan(dataDir)
  const saved: PlanVersion = { ...plan, version: (previous?.version ?? 0) + 1, saved_at: new Date().toISOString() }
  append(dataDir, 'plan.jsonl', saved)
  return saved
}

export interface CheckInResult {
  saved: CheckIn[]
  problems: string[]
}

/** Record check-ins against items of the current plan. `item` may be an id or a title. */
export function addCheckIns(dataDir: string, entries: unknown[], context: { today: string; source: 'chat' | 'board' }): CheckInResult {
  const plan = currentPlan(dataDir)
  const problems: string[] = []
  const saved: CheckIn[] = []
  if (!plan) return { saved, problems: ['还没有保存的干预方案。先保存方案再打卡。'] }
  for (const value of entries.slice(0, 40)) {
    const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
    const ref = text(row.item, 60)
    const folded = foldName(ref)
    const item = plan.items.find((candidate) => candidate.id === ref)
      ?? plan.items.find((candidate) => foldName(candidate.title) === folded)
      ?? plan.items.find((candidate) => folded.length >= 2 && foldName(candidate.title).includes(folded))
    if (!item) {
      problems.push(`方案里没有「${ref}」。`)
      continue
    }
    if (item.mirobody) {
      problems.push(`「${item.title}」是药物或补剂，服用情况记录在用药计划中，此处仅可查看。`)
      continue
    }
    const date = DATE.test(text(row.date, 10)) ? text(row.date, 10) : context.today
    if (date > context.today) {
      problems.push(`「${item.title}」的打卡日期 ${date} 在未来。`)
      continue
    }
    // done null, given as such, takes that day's check-in back; left out, a note or tag says nothing about it.
    const undo = 'done' in row && row.done === null
    const amount = !undo && Number.isFinite(Number(row.amount)) && row.amount !== null && row.amount !== '' ? Number(row.amount) : null
    const tags = undo ? [] : (Array.isArray(row.tags) ? row.tags : []).map((tag) => String(tag)).filter((tag) => (CHECKIN_TAGS as readonly string[]).includes(tag))
    const checkIn: CheckIn = {
      at: new Date().toISOString(),
      date,
      item: item.id,
      done: typeof row.done === 'boolean' ? row.done : (amount != null ? true : null),
      amount,
      unit: undo ? '' : text(row.unit, 20),
      note: undo ? '' : text(row.note, 200),
      tags,
      source: context.source,
      ...(undo ? { undo: true as const } : {}),
    }
    append(dataDir, 'adherence.jsonl', checkIn)
    saved.push(checkIn)
  }
  return { saved, problems }
}
