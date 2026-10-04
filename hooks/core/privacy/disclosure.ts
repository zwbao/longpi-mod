// Plain-language disclosure and the advertising-law wording list (PLAN §B item 11, R13).
// The JSON files are the copy the page shows. disclosure_zh.json is also bundled as the built-in copy, so it is the single source.

import { existsSync, readFileSync } from '../../sys/fs.ts'
import { fileURLToPath, libUrl } from '../../sys/url.ts'
import type { Id } from '../contracts/common.ts'
import type { FactPack } from '../contracts/factpack.ts'
import type { ValidatorRule } from '../contracts/agents.ts'
import DISCLOSURE_JSON from './disclosure-data.ts'

export interface DisclosureCopy {
  version: string
  pipl: { title: string; lead: string; paragraphs: string[] }
  data_flow: { title: string; to_deepseek: string[]; stays_local: string[]; mirobody: string[]; name: string; session_log: string }
  minor: { ask: string; under_18: string; under_14: string }
  buttons: { pipl_grant: string; pipl_decline: string; flow_grant: string; flow_decline: string; session_on: string; session_off: string }
  delete: { phrase: string; note: string }
}

export interface BannedClaims {
  version: string
  law_zh: string
  absolute: string[]
  younger: string[]
  younger_must_also_say: string
  weight_loss: string[]
  share_card_zh: string
}

// The built-in copy is the same JSON, bundled at build time, so the consent text never shrinks when the file is missing.
const FALLBACK_COPY: DisclosureCopy = DISCLOSURE_JSON

const FALLBACK_BANNED: BannedClaims = {
  version: '2026-09-28',
  law_zh: '广告法：不承诺绝对疗效；「年轻了」要写明是模型估计。',
  absolute: ['包治', '根治', '药到病除', '无效退款', '立竿见影', '返老还童', '显著延长寿命', '保证有效', '彻底治愈', '全国第一', '疗效最好', '最有效', '100%有效'],
  younger: ['年轻了', '变年轻', '更年轻', '逆龄', '返老还童'],
  younger_must_also_say: '估计',
  weight_loss: ['减肥', '减重', '减脂', '瘦身', '节食'],
  share_card_zh: '说「年轻了」时要同时写明这是模型估计，并带上正常波动范围。',
}

function readJson<T>(name: string): T | null {
  for (const rel of [`../data/privacy/${name}`, `../../data/privacy/${name}`]) {
    try {
      const path = fileURLToPath(new URL(rel, libUrl()))
      if (!existsSync(path)) continue
      return JSON.parse(readFileSync(path, 'utf8')) as T
    } catch {
      // the next path, then the built-in copy
    }
  }
  return null
}

let copyCache: DisclosureCopy | null = null
let bannedCache: BannedClaims | null = null

export function disclosureCopy(): DisclosureCopy {
  if (!copyCache) copyCache = readJson<DisclosureCopy>('disclosure_zh.json') ?? FALLBACK_COPY
  return copyCache
}

export function bannedClaims(): BannedClaims {
  if (!bannedCache) bannedCache = readJson<BannedClaims>('banned_claims.json') ?? FALLBACK_BANNED
  return bannedCache
}

/** What the person must type to delete the local store. */
export function deletePhrase(): string {
  return disclosureCopy().delete.phrase || '删除全部'
}

const NEGATED = /(?:不|别|没有|无需|不要|避免|不做|不安排|暂停)[^，。；,;]{0,4}$/

function affirmed(text: string, phrase: string): boolean {
  let at = text.indexOf(phrase)
  while (at >= 0) {
    const before = text.slice(Math.max(0, at - 8), at)
    // 「要不要减肥」is a suggestion. 「不要减肥」is a refusal.
    const negated = !/要不要[^，。；,;]{0,4}$/.test(before) && NEGATED.test(before)
    if (!negated) return true
    at = text.indexOf(phrase, at + phrase.length)
  }
  return false
}

function youngerAllowed(card: { fact_ids: Id[]; number_keys: string[] }, pack: FactPack): boolean {
  return (pack.feedback ?? []).some((row) => row.allowed_claims?.includes('younger') && (card.fact_ids.includes(row.id) || card.number_keys.some((key) => (row.numbers ?? []).some((ref) => ref.key === key))))
}

/** Null when the text may be shown. M4: a real "年轻了" also has to say 估计. Minors get no weight-loss line. */
export function wordingProblem(text: string, card: { fact_ids: Id[]; number_keys: string[] }, pack: FactPack): string | null {
  const rules = bannedClaims()
  for (const phrase of rules.absolute) {
    if (phrase && affirmed(text, phrase)) return `广告法：不能说「${phrase}」`
  }
  if (rules.younger.some((phrase) => phrase && affirmed(text, phrase)) && youngerAllowed(card, pack) && !text.includes(rules.younger_must_also_say)) {
    return '广告法：说年轻了时要同时写明这是模型估计'
  }
  const age = pack.person?.age
  if (typeof age === 'number' && age < 18) {
    for (const phrase of rules.weight_loss) {
      if (phrase && affirmed(text, phrase)) return '未满 18 岁不安排减肥'
    }
  }
  return null
}

const APPLIES: ValidatorRule['applies'] = ['greeting', 'status', 'next_step', 'suggestion', 'weekly_narrative', 'nudge', 'care', 'season', 'feedback', 'brief', 'plan', 'advice']

export function wordingRule(): ValidatorRule {
  return { id: 'adlaw.wording', owner: 'M11', applies: APPLIES, check: wordingProblem }
}

export function weightLossPhrase(text: string): boolean {
  return bannedClaims().weight_loss.some((phrase) => phrase && affirmed(text, phrase))
}

const NAME_KEYS = new Set(['displayName', 'display_name'])

function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Family members' names on this install and what each becomes (their label: 妈妈), set by the plugin (M13). */
let familyNames: () => Array<[string, string]> = () => []
export function setFamilyNames(fn: () => Array<[string, string]>): void {
  familyNames = fn
}

/**
 * Replace the holder's saved name (2+ characters) with 你, and each family member's name with how the holder calls
 * them. One-character names are stripped only from name fields, where they would erase ordinary words.
 */
export function redactText(text: string, name: string): string {
  const trimmed = name.trim()
  let out = text.replace(/("displayName"\s*:\s*")[^"]*(")/g, '$1$2').replace(/("display_name"\s*:\s*")[^"]*(")/g, '$1$2')
  let family: Array<[string, string]> = []
  try { family = familyNames() } catch { family = [] }
  for (const [other, label] of family) {
    const n = other.trim()
    if (n.length >= 2 && n !== label && n !== trimmed) out = out.replace(new RegExp(escapeReg(n), 'gi'), label)
  }
  if (trimmed.length < 2 || trimmed === '你') return out
  out = out.replace(new RegExp(escapeReg(trimmed), 'gi'), '你')
  return out
}

/** Walk a tool result or a model payload. Name fields are cleared even when the saved name is a single character. */
export function redactOutbound(value: unknown, name: string): unknown {
  if (typeof value === 'string') return redactText(value, name)
  if (Array.isArray(value)) return value.map((item) => redactOutbound(item, name))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (NAME_KEYS.has(key) && (typeof inner === 'string' || inner == null)) out[key] = ''
      else out[key] = redactOutbound(inner, name)
    }
    return out
  }
  return value
}

const WEIGHT_CATEGORY = new Set(['weight'])

function itemText(item: unknown): string {
  if (!item || typeof item !== 'object') return ''
  const row = item as Record<string, unknown>
  return [row.title_zh, row.behaviour_zh, row.title, row.text_zh, row.category].filter((part) => typeof part === 'string').join(' ')
}

function isWeightItem(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false
  const row = item as Record<string, unknown>
  if (typeof row.category === 'string' && WEIGHT_CATEGORY.has(row.category)) return true
  return weightLossPhrase(itemText(item))
}

function stripList(list: unknown): unknown {
  if (!Array.isArray(list)) return list
  return list.filter((item) => !isWeightItem(item))
}

/** Drop weight-loss items from a draft tool value. Other fields stay. */
export function stripWeightLoss(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const row = { ...(value as Record<string, unknown>) }
  if (row.draft && typeof row.draft === 'object') {
    const draft = { ...(row.draft as Record<string, unknown>) }
    draft.items = stripList(draft.items)
    row.draft = draft
  }
  if (Array.isArray(row.items)) row.items = stripList(row.items)
  if (row.brief && typeof row.brief === 'object') {
    const brief = { ...(row.brief as Record<string, unknown>) }
    if (Array.isArray(brief.candidates)) brief.candidates = stripList(brief.candidates)
    row.brief = brief
  }
  if (typeof row.reply_zh === 'string') {
    const kept = row.reply_zh.split('。').filter((sentence) => sentence && !weightLossPhrase(sentence)).join('。')
    const note = '未满 18 岁，这类项目已去掉'
    row.reply_zh = kept.includes(note) ? kept : `${kept}${kept && !kept.endsWith('。') ? '。' : ''}${note}。`
  }
  return row
}
