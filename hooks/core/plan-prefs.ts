import { process } from '../sys/process.ts'
// What the person has already ruled out of a plan, and the draft date. The
// clock moving to the next day does not by itself rewrite the title.

// Since 0.5.3 the exclusions also live in the person's memory (core/memory.ts): every exclusion written here
// is written there too, and what the planner reads is the union, so an exclusion said in chat, taken out on
// the page or imported from an older plan_prefs.json all hold.

import { createHash, randomBytes } from '../sys/crypto.ts'
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from '../sys/fs.ts'
import { dirname, join } from '../sys/path.ts'
import type { ExclusionItem, NewMemoryItem } from './contracts/memory.ts'
import type { PlanPrefs } from './contracts/plan.ts'
import { memoryFor } from './core/memory.ts'

export type { PlanPrefs } from './contracts/plan.ts'

const EMPTY: PlanPrefs = {
  excluded_ids: [],
  excluded_phrases: [],
  removed_items: [],
  pregnant: null,
  ckd: null,
  drinks: null,
  drafted_on: '',
  clinical_fp: '',
  content_fp: '',
  draft: null,
}

function pathOf(dataDir: string): string {
  return join(dataDir, 'plan_prefs.json')
}

function list(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim()))].slice(0, 40)
}

function removedList(value: unknown): PlanPrefs['removed_items'] {
  if (!Array.isArray(value)) return []
  const out: PlanPrefs['removed_items'] = []
  for (const row of value) {
    if (!row || typeof row !== 'object') continue
    const id = typeof (row as { id?: unknown }).id === 'string' ? (row as { id: string }).id.trim() : ''
    const title = typeof (row as { title?: unknown }).title === 'string' ? (row as { title: string }).title.trim() : ''
    if ((id || title) && !out.some((item) => item.id === id && item.title === title)) out.push({ id, title })
  }
  return out.slice(0, 40)
}

/** The file as written, without the memory's exclusions. */
function readFile(dataDir: string): PlanPrefs {
  const path = pathOf(dataDir)
  if (!existsSync(path)) return { ...EMPTY, excluded_ids: [], excluded_phrases: [], removed_items: [] }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
    return {
      excluded_ids: list(raw.excluded_ids),
      excluded_phrases: list(raw.excluded_phrases),
      removed_items: removedList(raw.removed_items),
      pregnant: typeof raw.pregnant === 'boolean' ? raw.pregnant : null,
      ckd: typeof raw.ckd === 'boolean' ? raw.ckd : null,
      drinks: typeof raw.drinks === 'boolean' ? raw.drinks : null,
      drafted_on: typeof raw.drafted_on === 'string' ? raw.drafted_on : '',
      clinical_fp: typeof raw.clinical_fp === 'string' ? raw.clinical_fp : '',
      content_fp: typeof raw.content_fp === 'string' ? raw.content_fp : '',
      draft: raw.draft ?? null,
    }
  } catch {
    return { ...EMPTY, excluded_ids: [], excluded_phrases: [], removed_items: [] }
  }
}

/** The active plan exclusions in memory: phrases and item ids. */
function memoryExclusions(dataDir: string): { phrases: string[]; ids: string[] } {
  try {
    const items = memoryFor(dataDir).active('exclusion') as ExclusionItem[]
    return {
      phrases: items.flatMap((item) => item.match.phrases_zh ?? []),
      ids: items.flatMap((item) => item.match.item_ids ?? []),
    }
  } catch {
    return { phrases: [], ids: [] }
  }
}

export function readPlanPrefs(dataDir: string): PlanPrefs {
  const file = readFile(dataDir)
  const memory = memoryExclusions(dataDir)
  return {
    ...file,
    excluded_ids: [...new Set([...file.excluded_ids, ...memory.ids])],
    excluded_phrases: [...new Set([...file.excluded_phrases, ...memory.phrases])],
  }
}

function rememberInMemory(dataDir: string, item: { phrases?: string[]; ids?: string[]; text: string; kind: 'chat' | 'page' }): void {
  try {
    memoryFor(dataDir).apply([{ op: 'add', item: {
      kind: 'exclusion', scope: 'plan_item', match: { phrases_zh: item.phrases ?? [], ...(item.ids?.length ? { item_ids: item.ids } : {}) },
      text_zh: item.text, confirmed: true, provenance: { kind: item.kind, at: new Date().toISOString(), by: 'M3' },
    } as NewMemoryItem }], 'M3')
  } catch {
    // the file still holds it
  }
}

function forgetInMemory(dataDir: string, keys: string[]): void {
  try {
    const store = memoryFor(dataDir)
    const ids = [...new Set(keys.filter(Boolean).flatMap((key) => store.exclusionIds(key)))]
    if (ids.length > 0) store.apply(ids.map((id) => ({ op: 'retract' as const, id, provenance: { kind: 'page' as const, at: new Date().toISOString(), by: 'M3' as const } })), 'M3')
  } catch {
    // nothing to forget
  }
}

/** Take an exclusion back everywhere (memory retract through the chat or the page). */
export function forgetExclusion(dataDir: string, keys: string[]): PlanPrefs {
  const prefs = readFile(dataDir)
  const drop = new Set(keys.filter(Boolean))
  prefs.excluded_ids = prefs.excluded_ids.filter((row) => !drop.has(row))
  prefs.excluded_phrases = prefs.excluded_phrases.filter((row) => !drop.has(row))
  prefs.removed_items = prefs.removed_items.filter((row) => !drop.has(row.id) && !drop.has(row.title))
  prefs.content_fp = ''
  writePlanPrefs(dataDir, prefs)
  forgetInMemory(dataDir, [...drop])
  return readPlanPrefs(dataDir)
}

export function writePlanPrefs(dataDir: string, prefs: PlanPrefs): void {
  const path = pathOf(dataDir)
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const tmp = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  writeFileSync(tmp, `${JSON.stringify(prefs, null, 2)}\n`, { mode: 0o600 })
  chmodSync(tmp, 0o600)
  renameSync(tmp, path)
}

export function fingerprint(value: unknown): string {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 16)
}

/** Drop or restore one drafted item. The title is stored as a phrase so the same intervention cannot regrow under another evidence id. */
export function setPlanExclusion(dataDir: string, item: { id?: string; title?: string; excluded: boolean }): PlanPrefs {
  const prefs = readFile(dataDir)
  const id = (item.id ?? '').trim()
  const title = (item.title ?? '').trim()
  const drop = (list: string[], value: string) => list.filter((row) => row !== value)
  if (item.excluded) {
    if (id && !prefs.excluded_ids.includes(id)) prefs.excluded_ids.push(id)
    if (title && !prefs.excluded_phrases.includes(title)) prefs.excluded_phrases.push(title)
    if (!prefs.removed_items.some((row) => row.id === id && row.title === title)) prefs.removed_items.push({ id, title })
  } else {
    prefs.excluded_ids = drop(prefs.excluded_ids, id)
    prefs.excluded_phrases = drop(prefs.excluded_phrases, title)
    prefs.removed_items = prefs.removed_items.filter((row) => !(row.id === id || (title && row.title === title)))
  }
  prefs.content_fp = ''
  writePlanPrefs(dataDir, prefs)
  if (item.excluded) rememberInMemory(dataDir, { phrases: title ? [title] : [], ids: id ? [id] : [], text: `不要${title ? `「${title}」` : '这一项'}`, kind: 'page' })
  else forgetInMemory(dataDir, [id, title])
  return readPlanPrefs(dataDir)
}

export function rememberExclusions(dataDir: string, phrases: readonly string[]): PlanPrefs {
  const prefs = readFile(dataDir)
  let changed = false
  for (const phrase of phrases) {
    if (!phrase || prefs.excluded_phrases.includes(phrase)) continue
    prefs.excluded_phrases.push(phrase)
    changed = true
  }
  if (changed) {
    prefs.content_fp = ''
    writePlanPrefs(dataDir, prefs)
  }
  const known = memoryExclusions(dataDir).phrases
  for (const phrase of phrases) if (phrase && !known.includes(phrase)) rememberInMemory(dataDir, { phrases: [phrase], text: `不要${phrase}`, kind: 'chat' })
  return readPlanPrefs(dataDir)
}

/** Whether they drink, from their own words: 不喝酒 → false; 喝酒, 一个月两杯红酒 → true. null leaves it as it was. */
export function drinkingFromText(text: string): boolean | null {
  const raw = String(text ?? '')
  if (/不喝酒|从不喝|滴酒不沾|不沾酒|戒酒了|已经戒酒|酒不喝|不饮酒|没有饮酒|不怎么喝酒|基本不喝/.test(raw)) return false
  if (/(?:我|平时|经常|偶尔|每周|每月|一个月|一周|周末|晚上|应酬)[^。？?！!]{0,10}(?:喝|饮)[^。？?！!，,]{0,6}酒|(?:喝|饮)(?:酒|啤酒|白酒|红酒|葡萄酒)[^。？?]{0,6}(?:杯|瓶|两|次|斤)|(?:红酒|啤酒|白酒|葡萄酒|黄酒)[^。？?]{0,8}(?:杯|瓶|两|次)/.test(raw)) return true
  return null
}

export function setDrinking(dataDir: string, drinks: boolean): PlanPrefs {
  const prefs = readFile(dataDir)
  if (prefs.drinks === drinks) return readPlanPrefs(dataDir)
  prefs.drinks = drinks
  prefs.content_fp = ''
  writePlanPrefs(dataDir, prefs)
  return readPlanPrefs(dataDir)
}

export function setClinicalFlags(dataDir: string, flags: { pregnant?: boolean | null; ckd?: boolean | null }): PlanPrefs {
  const prefs = readFile(dataDir)
  if (flags.pregnant !== undefined) prefs.pregnant = flags.pregnant
  if (flags.ckd !== undefined) prefs.ckd = flags.ckd
  writePlanPrefs(dataDir, prefs)
  return prefs
}
