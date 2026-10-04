// Per-person memory (AA §2.5): dataDir/memory.json (current state, with rev) and memory_log.jsonl (every op).
// Safety relevance comes from rule tables, never from a model. Nothing is deleted: retract and supersede only
// change status. Z's plan_prefs exclusions and flags, and the medication statements, are imported once.

import { createHash } from '../../sys/crypto.ts'
import { join } from '../../sys/path.ts'
import type { Id, IsoDay, ModuleId, Provenance } from '../contracts/common.ts'
import {
  MEMORY_VERSION, SAFETY_CONDITION_FLAGS, SAFETY_DRUG_CLASSES,
  type CareItem, type CommitmentItem, type ConditionFlag, type DrugClass, type ExclusionItem, type MemoryApi, type MemoryApplyResult, type MemoryItem,
  type MemoryKind, type MemoryOp, type NewMemoryItem, type PersonMemory,
} from '../contracts/memory.ts'
import { doneCounts } from '../interventions.ts'
import { currentBus } from './bus.ts'
import { appendJsonl, newId, readJson, readJsonl, writeJsonAtomic } from './store.ts'

/** Name fragments of medicine classes, checked in order; a name can hit several. */
const DRUG_CLASS_RULES: Array<[DrugClass, RegExp]> = [
  ['sglt2i', /列净|gliflozin/i],
  ['insulin', /胰岛素|\binsulin\b|门冬|甘精|地特|德谷|赖脯/i],
  ['sulfonylurea', /格列(?!净|汀)|磺脲|消渴丸|glibenclamide|glimepiride|gliclazide|glipizide|glyburide/i],
  ['metformin', /二甲双胍|metformin/i],
  ['glp1ra', /鲁肽|艾塞那肽|glutide|exenatide/i],
  ['statin', /他汀|statin\b|atorvastatin|rosuvastatin|simvastatin/i],
  ['anticoagulant', /华法林|沙班|达比加群|肝素|warfarin|xaban\b|dabigatran|heparin/i],
  ['antiplatelet', /阿司匹林|氯吡格雷|替格瑞洛|aspirin|clopidogrel|ticagrelor|prasugrel/i],
  ['antihypertensive', /地平|普利|沙坦|洛尔|噻嗪|吲达帕胺|螺内酯|降压|amlodipine|nifedipine|pril\b|sartan|olol\b/i],
  ['thyroid_hormone', /左甲状腺素|优甲乐|雷替斯|levothyroxine/i],
  ['iron', /铁剂|亚铁|多糖铁|蔗糖铁|补铁|\biron\b|ferrous/i],
  ['steroid', /泼尼松|甲泼尼龙|地塞米松|氢化可的松|糖皮质激素|prednison|dexamethasone|hydrocortisone/i],
]

export function drugClassesOf(name: string): DrugClass[] {
  const out = DRUG_CLASS_RULES.filter(([, pattern]) => pattern.test(name)).map(([cls]) => cls)
  return out.length > 0 ? out : ['other']
}

const CONDITION_RULES: Array<[ConditionFlag, RegExp]> = [
  ['pregnancy', /怀孕|孕期|妊娠|怀上了/],
  ['pregnancy_planning', /备孕|准备怀孕|计划怀孕|准备要孩子|计划要孩子/],
  ['breastfeeding', /哺乳|母乳/],
  ['ckd', /肾功能不全|慢性肾病|肾衰|透析|\bckd\b/i],
  ['diabetes', /(?<!前期|前)糖尿病|2型糖尿|1型糖尿/],
  ['prediabetes', /糖尿病前期|血糖偏高前期|糖耐量受损/],
  ['cancer_followup', /癌|肿瘤|化疗|放疗/],
  ['cvd', /冠心病|心梗|心肌梗死|中风|脑卒中|脑梗/],
  ['stent', /支架/],
  ['hypertension', /高血压/],
  ['nafld', /脂肪肝/],
  ['anaemia', /贫血/],
  ['thyroid', /甲亢|甲减|桥本|甲状腺功能/],
]

export function conditionFlagsOf(text: string): ConditionFlag[] {
  const flags = CONDITION_RULES.filter(([, pattern]) => pattern.test(text)).map(([flag]) => flag)
  // 准备怀孕 contains 怀孕. Planning is not a current pregnancy unless they also said they are pregnant.
  if (flags.includes('pregnancy_planning') && flags.includes('pregnancy')) {
    const rest = text.replace(/备孕|准备怀孕|计划怀孕|准备要孩子|计划要孩子/g, '')
    if (!/怀孕了|已怀孕|正在怀孕|我怀孕|孕期|妊娠|怀上了/.test(rest)) return flags.filter((flag) => flag !== 'pregnancy')
  }
  return flags
}

export function computeSafety(item: Pick<MemoryItem, 'kind'> & Partial<{ drug_class: DrugClass[]; flags: ConditionFlag[] }>): boolean {
  if (item.kind === 'medication' || item.kind === 'supplement') return (item.drug_class ?? []).some((cls) => SAFETY_DRUG_CLASSES.includes(cls))
  if (item.kind === 'condition') return (item.flags ?? []).some((flag) => SAFETY_CONDITION_FLAGS.includes(flag))
  return false
}

function emptyMemory(): PersonMemory {
  return { version: MEMORY_VERSION, rev: 0, updated: new Date(0).toISOString(), items: [], migrated: [] }
}

function parseMemory(raw: unknown): PersonMemory {
  const value = raw && typeof raw === 'object' ? raw as Partial<PersonMemory> : {}
  return {
    version: MEMORY_VERSION,
    rev: typeof value.rev === 'number' ? value.rev : 0,
    updated: typeof value.updated === 'string' ? value.updated : new Date(0).toISOString(),
    items: Array.isArray(value.items) ? value.items.filter((item): item is MemoryItem => Boolean(item) && typeof item === 'object' && typeof (item as MemoryItem).id === 'string') : [],
    migrated: Array.isArray(value.migrated) ? value.migrated.filter((row): row is string => typeof row === 'string') : [],
  }
}

function clip(text: string, max: number): string {
  const chars = [...text]
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join('')}…`
}

const DRUG_ZH: Partial<Record<DrugClass, string>> = {
  sglt2i: 'SGLT2 抑制剂', insulin: '胰岛素', sulfonylurea: '磺脲类', anticoagulant: '抗凝药', antiplatelet: '抗血小板药', glp1ra: 'GLP-1 类', steroid: '激素',
}

function dayOf(at: string): IsoDay {
  return at.slice(0, 10)
}

export interface MemoryStore extends MemoryApi {
  /** The ids of the active exclusion items whose phrase is this one. */
  exclusionIds(phrase: string): Id[]
  latestCare(): CareItem | null
}

export function createMemory(dataDir: () => string): MemoryStore {
  const path = () => join(dataDir(), 'memory.json')
  const logPath = () => join(dataDir(), 'memory_log.jsonl')
  const read = (): PersonMemory => readJson(path(), parseMemory, emptyMemory)

  const materialise = (item: NewMemoryItem, now: string): MemoryItem => {
    const raw = { ...item } as Record<string, unknown>
    if ((raw.kind === 'medication' || raw.kind === 'supplement') && (!Array.isArray(raw.drug_class) || (raw.drug_class as unknown[]).length === 0)) {
      raw.drug_class = drugClassesOf(String(raw.name_zh ?? raw.text_zh ?? ''))
    }
    if (raw.kind === 'condition' && (!Array.isArray(raw.flags) || (raw.flags as unknown[]).length === 0)) raw.flags = conditionFlagsOf(`${raw.name_zh ?? ''} ${raw.text_zh ?? ''}`)
    const provenance = raw.provenance as Provenance
    if (provenance?.quote_zh) provenance.quote_zh = clip(provenance.quote_zh, 200)
    return {
      ...raw,
      id: newId(String(raw.kind).replace(/_/g, '-')),
      text_zh: clip(String(raw.text_zh ?? '').trim(), 200),
      status: 'active',
      safety_relevant: computeSafety(raw as Parameters<typeof computeSafety>[0]),
      updated: now,
    } as MemoryItem
  }

  const sameActive = (items: MemoryItem[], item: NewMemoryItem): MemoryItem | undefined => items.find((row) => row.status === 'active' && row.kind === item.kind && row.text_zh === String(item.text_zh ?? '').trim())

  const api: MemoryStore = {
    read,
    active(kind) {
      return read().items.filter((item) => item.status === 'active' && item.kind === kind) as never
    },
    apply(ops: MemoryOp[], by: ModuleId): MemoryApplyResult {
      const memory = read()
      const now = new Date().toISOString()
      const applied: Id[] = []
      const rejected: MemoryApplyResult['rejected'] = []
      const changed: MemoryItem[] = []
      const log: unknown[] = []
      for (const op of ops) {
        try {
          if (op.op === 'add') {
            if (!op.item || !op.item.kind || !String(op.item.text_zh ?? '').trim()) {
              rejected.push({ op, reason: 'an item needs a kind and text_zh' })
              continue
            }
            const dup = sameActive(memory.items, op.item)
            if (dup) {
              // Said again: a confirmation when it now comes from the person.
              if (op.item.confirmed && !dup.confirmed) {
                dup.confirmed = true
                dup.updated = now
                changed.push(dup)
              }
              applied.push(dup.id)
              continue
            }
            const item = materialise(op.item, now)
            memory.items.push(item)
            changed.push(item)
            applied.push(item.id)
            log.push({ at: now, by, op: 'add', id: item.id, kind: item.kind, text_zh: item.text_zh, confirmed: item.confirmed, provenance: item.provenance })
          } else if (op.op === 'retract' || op.op === 'confirm') {
            const item = memory.items.find((row) => row.id === op.id)
            if (!item || item.status !== 'active') {
              rejected.push({ op, reason: 'no active item with that id' })
              continue
            }
            if (op.op === 'retract') item.status = 'retracted'
            else item.confirmed = true
            item.updated = now
            changed.push(item)
            applied.push(item.id)
            log.push({ at: now, by, op: op.op, id: item.id, provenance: op.provenance })
          } else if (op.op === 'graduate') {
            const item = memory.items.find((row) => row.id === op.id)
            if (!item || item.status !== 'active' || item.kind !== 'commitment') {
              rejected.push({ op, reason: 'no active commitment with that id' })
              continue
            }
            item.graduated = op.day
            item.updated = now
            changed.push(item)
            applied.push(item.id)
            log.push({ at: now, by, op: 'graduate', id: item.id, day: op.day, provenance: op.provenance })
          } else if (op.op === 'supersede') {
            const old = memory.items.find((row) => row.id === op.id)
            if (!old || old.status !== 'active') {
              rejected.push({ op, reason: 'no active item with that id' })
              continue
            }
            old.status = 'superseded'
            old.updated = now
            const item = materialise({ ...op.item, supersedes: old.id } as NewMemoryItem, now)
            memory.items.push(item)
            changed.push(old, item)
            applied.push(item.id)
            log.push({ at: now, by, op: 'supersede', id: item.id, supersedes: old.id, kind: item.kind, text_zh: item.text_zh })
          } else if (op.op === 'touch_topic') {
            const topic = memory.items.find((row) => row.kind === 'asked_topic' && row.status === 'active' && row.topic_key === op.topic_key)
            if (topic && topic.kind === 'asked_topic') {
              topic.last_asked = op.day
              topic.count += 1
              topic.updated = now
              changed.push(topic)
              applied.push(topic.id)
            } else {
              const item = materialise({ kind: 'asked_topic', topic_key: op.topic_key, last_asked: op.day, count: 1, text_zh: op.topic_key, confirmed: true, provenance: op.provenance } as NewMemoryItem, now)
              memory.items.push(item)
              changed.push(item)
              applied.push(item.id)
            }
          }
        } catch (error) {
          rejected.push({ op, reason: error instanceof Error ? error.message : String(error) })
        }
      }
      if (changed.length === 0) return { rev: memory.rev, applied, rejected }
      memory.rev += 1
      memory.updated = now
      writeJsonAtomic(path(), memory)
      for (const row of log) {
        try {
          appendJsonl(logPath(), { rev: memory.rev, ...(row as object) })
        } catch {
          // the state file is written; the log line is best effort
        }
      }
      const kinds = [...new Set(changed.map((item) => item.kind))] as MemoryKind[]
      currentBus()?.emit('memory.changed', { rev: memory.rev, kinds, safety_relevant: changed.some((item) => item.safety_relevant || item.kind === 'exclusion'), item_ids: [...new Set(changed.map((item) => item.id))] }, { module: 'M0', via: 'hook' })
      return { rev: memory.rev, applied, rejected }
    },
    digest({ purpose, maxChars = 1200 }) {
      const items = read().items.filter((item) => item.status === 'active')
      const mark = (item: MemoryItem) => (item.confirmed ? '' : '（未确认）')
      const lines: string[] = purpose === 'triage' || purpose === 'advice' ? [] : coachLines(items, dataDir())
      const meds = items.filter((item) => item.kind === 'medication' || item.kind === 'supplement') as Array<Extract<MemoryItem, { kind: 'medication' | 'supplement' }>>
      const safetyMeds = meds.filter((item) => item.safety_relevant && !item.stopped)
      if (safetyMeds.length > 0) lines.push(`用药安全：${safetyMeds.map((item) => `${item.name_zh}（${item.drug_class.map((cls) => DRUG_ZH[cls]).filter(Boolean).join('、') || '药物'}）${mark(item)}`).join('；')}`)
      const conditions = items.filter((item) => item.kind === 'condition') as Array<Extract<MemoryItem, { kind: 'condition' }>>
      if (conditions.length > 0) lines.push(`身体状况：${conditions.map((item) => `${item.text_zh}${item.state === 'past' ? '（以前）' : ''}${mark(item)}`).join('；')}`)
      const exclusions = items.filter((item) => item.kind === 'exclusion') as ExclusionItem[]
      if (exclusions.length > 0) lines.push(`不要：${exclusions.map((item) => `${item.text_zh.replace(/^不要/, '')}${mark(item)}`).join('；')}`)
      const goals = items.filter((item) => item.kind === 'goal')
      if (goals.length > 0) lines.push(`目标：${goals.map((item) => `${item.text_zh}${mark(item)}`).join('；')}`)
      const care = items.filter((item) => item.kind === 'care') as CareItem[]
      if (care.length > 0) lines.push(`就医：${care.slice(-3).map((item) => item.text_zh).join('；')}`)
      const events = items.filter((item) => item.kind === 'life_event')
      if (events.length > 0 && purpose !== 'triage') lines.push(`近况：${events.slice(-3).map((item) => item.text_zh).join('；')}`)
      const otherMeds = meds.filter((item) => !item.safety_relevant && !item.stopped)
      if (otherMeds.length > 0) lines.push(`在用：${otherMeds.slice(-6).map((item) => `${item.name_zh}${mark(item)}`).join('、')}`)
      const notes = items.filter((item) => item.kind === 'note' || item.kind === 'preference' || item.kind === 'family_history')
      if (notes.length > 0 && purpose !== 'triage') lines.push(`其他：${notes.slice(-4).map((item) => item.text_zh).join('；')}`)
      return clip(lines.join('\n'), maxChars)
    },
    safetyFlags() {
      const items = read().items.filter((item) => item.status === 'active')
      const drugs = new Set<DrugClass>()
      const conditions = new Set<ConditionFlag>()
      for (const item of items) {
        if ((item.kind === 'medication' || item.kind === 'supplement') && !item.stopped) for (const cls of item.drug_class) drugs.add(cls)
        if (item.kind === 'condition' && (item.state === 'current' || item.state === 'suspected')) for (const flag of item.flags) conditions.add(flag)
      }
      return { drug_classes: [...drugs].filter((cls) => cls !== 'other'), conditions: [...conditions] }
    },
    exclusionIds(phrase) {
      return (read().items.filter((item) => item.status === 'active' && item.kind === 'exclusion') as ExclusionItem[])
        .filter((item) => item.match.phrases_zh.includes(phrase) || (item.match.item_ids ?? []).includes(phrase)).map((item) => item.id)
    },
    latestCare() {
      const care = read().items.filter((item) => item.status === 'active' && item.kind === 'care') as CareItem[]
      return care.at(-1) ?? null
    },
  }
  return api
}

/** Pi's part of the file, first so a clipped digest keeps it: the picture, why, how to speak, commitments with their counts, wins. */
export function coachLines(items: MemoryItem[], dataDir: string): string[] {
  const latest = <K extends MemoryItem['kind']>(kind: K, n: number) => items.filter((item) => item.kind === kind).slice(-n) as Array<Extract<MemoryItem, { kind: K }>>
  const lines: string[] = []
  const vision = latest('vision', 2)
  if (vision.length > 0) lines.push(`想要的画面：${vision.map((item) => item.text_zh).join('；')}`)
  const why = latest('motivation', 1)
  if (why.length > 0) lines.push(`为什么在乎：${why.map((item) => item.text_zh).join('；')}`)
  const style = latest('style', 1)
  if (style.length > 0) lines.push(`称呼和风格：${style[0]?.text_zh}`)
  const commitments = items.filter((item): item is CommitmentItem => item.kind === 'commitment')
  if (commitments.length > 0) {
    let counts = new Map<string, number>()
    try {
      counts = doneCounts(dataDir)
    } catch {
      // the counts are a bonus; the commitments are still listed
    }
    const count = (item: CommitmentItem) => {
      const total = (item.carried_count ?? 0) + (item.plan_item ? counts.get(item.plan_item) ?? 0 : 0)
      return item.plan_item || item.carried_count ? `，累计 ${total} 次` : ''
    }
    const doing = commitments.filter((item) => !item.graduated).slice(-3)
    if (doing.length > 0) lines.push(`在做的小承诺：${doing.map((item) => `${item.text_zh}（${item.confidence !== null ? `把握度 ${item.confidence}/10` : '把握度未问'}${count(item)}）[${item.id}]`).join('；')}`)
    const habits = commitments.filter((item) => item.graduated).slice(-3)
    if (habits.length > 0) lines.push(`已成习惯：${habits.map((item) => `${item.text_zh}${count(item)}`).join('；')}`)
  }
  const wins = latest('win', 3)
  if (wins.length > 0) lines.push(`最近的小胜利：${wins.map((item) => `${item.day.slice(5).replace('-', '/')} ${item.text_zh}`).join('；')}`)
  return lines
}

const stores = new Map<string, MemoryStore>()

/** The memory of the person whose data lives in dataDir (one profile = one person). Legacy files are imported on first use. */
export function memoryFor(dataDir: string): MemoryStore {
  let store = stores.get(dataDir)
  if (!store) {
    store = createMemory(() => dataDir)
    stores.set(dataDir, store)
  }
  try {
    migrateLegacy(store, dataDir)
  } catch {
    // an unreadable legacy file must not stop the memory
  }
  return store
}

function statementId(row: { name?: unknown; at?: unknown; since?: unknown }): string {
  return createHash('sha1').update(`${String(row.name ?? '')}|${String(row.at ?? '')}|${String(row.since ?? '')}`).digest('hex').slice(0, 12)
}

const MIGRATION: Provenance = { kind: 'migration', at: new Date(0).toISOString(), by: 'M0' }

/**
 * Z's plan_prefs.json (excluded phrases and ids, pregnant, ckd) once, and every medication statement not yet
 * mirrored (by statement id), as memory items with provenance 'migration' (statements: 'import').
 */
export function migrateLegacy(store: MemoryStore, dataDir: string): void {
  const memory = store.read()
  const done = new Set(memory.migrated ?? [])
  const ops: MemoryOp[] = []
  const at = new Date().toISOString()
  if (!done.has('plan_prefs_v1')) {
    const prefs = readJson<Record<string, unknown>>(join(dataDir, 'plan_prefs.json'), (raw) => (raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}), () => ({}))
    const phrases = Array.isArray(prefs.excluded_phrases) ? prefs.excluded_phrases.filter((row): row is string => typeof row === 'string') : []
    const ids = Array.isArray(prefs.excluded_ids) ? prefs.excluded_ids.filter((row): row is string => typeof row === 'string') : []
    for (const phrase of phrases) ops.push({ op: 'add', item: { kind: 'exclusion', scope: 'plan_item', match: { phrases_zh: [phrase] }, text_zh: `不要${phrase}`, confirmed: true, provenance: { ...MIGRATION, at } } as NewMemoryItem })
    if (ids.length > 0) ops.push({ op: 'add', item: { kind: 'exclusion', scope: 'plan_item', match: { item_ids: ids, phrases_zh: [] }, text_zh: `方案里去掉的 ${ids.length} 项`, confirmed: true, provenance: { ...MIGRATION, at } } as NewMemoryItem })
    if (prefs.pregnant === true) ops.push({ op: 'add', item: { kind: 'condition', name_zh: '怀孕', flags: ['pregnancy'], state: 'current', text_zh: '怀孕', confirmed: true, provenance: { ...MIGRATION, at } } as NewMemoryItem })
    if (prefs.ckd === true) ops.push({ op: 'add', item: { kind: 'condition', name_zh: '慢性肾病', flags: ['ckd'], state: 'current', text_zh: '慢性肾病', confirmed: true, provenance: { ...MIGRATION, at } } as NewMemoryItem })
  }
  const mirrored = new Set((memory.items.filter((item) => item.kind === 'medication' || item.kind === 'supplement') as Array<{ statement_id?: string }>).map((item) => item.statement_id).filter(Boolean))
  for (const row of readJsonl<Record<string, unknown>>(join(dataDir, 'medication_statements.jsonl'))) {
    if (typeof row.name !== 'string' || !row.name.trim()) continue
    const id = statementId(row)
    if (mirrored.has(id)) continue
    const regimen = [row.dose_text, row.frequency_text].filter((part) => typeof part === 'string' && part.trim()).join(' ')
    ops.push({
      op: 'add',
      item: {
        kind: 'medication', name_zh: row.name.trim(), drug_class: drugClassesOf(row.name), source_rx: 'doctor', statement_id: id,
        ...(regimen ? { regimen_text: regimen } : {}), ...(typeof row.since === 'string' && row.since ? { started: row.since.slice(0, 10) } : {}),
        text_zh: `${row.name.trim()}${regimen ? ` ${regimen}` : ''}`, confirmed: true,
        provenance: { kind: 'import', at: typeof row.at === 'string' ? row.at : at, by: 'M0' },
      } as NewMemoryItem,
    })
  }
  if (ops.length === 0 && done.has('plan_prefs_v1')) return
  if (ops.length > 0) store.apply(ops, 'M0')
  if (!done.has('plan_prefs_v1')) {
    const after = store.read()
    writeJsonAtomic(join(dataDir, 'memory.json'), { ...after, migrated: [...new Set([...(after.migrated ?? []), 'plan_prefs_v1'])] })
  }
}

export { dayOf }
