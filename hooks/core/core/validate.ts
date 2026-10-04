// Deterministic post-filter over every model output (AA §2.9 row 7). The base rules (M0) always apply;
// modules add their own through deps.validators.register. A failing card is repaired once, then falls back.

import type { Id } from '../contracts/common.ts'
import type { FactPack } from '../contracts/factpack.ts'
import type { ValidatorRule } from '../contracts/agents.ts'
import type { SurfaceKind } from '../contracts/surfaces.ts'
import { hasDose } from '../dose.ts'
import { TIME_RESTRICTED, VERY_LOW_CARB } from '../plan-safety.ts'
import { TOOL_NAMES } from '../version.ts'

export type ValidatedKind = SurfaceKind | 'feedback' | 'brief' | 'plan' | 'advice'

const rules: ValidatorRule[] = []

export function registerValidator(rule: ValidatorRule): () => void {
  rules.push(rule)
  return () => {
    const at = rules.indexOf(rule)
    if (at >= 0) rules.splice(at, 1)
  }
}

const ALL: ValidatedKind[] = ['greeting', 'status', 'next_step', 'suggestion', 'weekly_narrative', 'nudge', 'care', 'season', 'feedback', 'brief', 'plan', 'advice']
const LIMITS: Partial<Record<ValidatedKind, number>> = { greeting: 30, status: 60, next_step: 40, suggestion: 24, nudge: 40, weekly_narrative: 200 }
const NEGATED = /(?:不|别|没有|无需|不要|避免|不做|不安排|暂停)[^，。；,;]{0,4}$/

function numbersIn(text: string): string[] {
  return text.replace(/\d{4}-\d{2}-\d{2}/g, ' ').match(/\d+(?:\.\d+)?/g) ?? []
}

function variants(value: number): string[] {
  return [String(value), String(Number(value.toFixed(0))), String(Number(value.toFixed(1))), String(Number(value.toFixed(2))), String(Math.abs(value)), String(Number(Math.abs(value).toFixed(1)))]
}

/** Every number a card may quote: the pack's numbers (and their roundings), dates, and the deterministic texts. */
export function allowedNumbers(pack: FactPack): Set<string> {
  const out = new Set<string>()
  for (const ref of pack.numbers) {
    for (const text of variants(ref.value)) out.add(text)
    for (const part of numbersIn(ref.text)) out.add(part)
    if (ref.date) for (const part of ref.date.split('-')) { out.add(part); out.add(String(Number(part))) }
  }
  const texts = [...pack.top_facts.map((row) => row.text_zh), ...pack.candidates.flatMap((row) => [row.title_zh, row.detail_zh, row.target.prompt_zh ?? '']), ...pack.feedback.map((row) => row.headline_zh)]
  for (const text of texts) for (const part of numbersIn(text)) out.add(part)
  for (const part of pack.today.split('-')) { out.add(part); out.add(String(Number(part))) }
  if (pack.person.age != null) out.add(String(pack.person.age))
  return out
}

function mentioned(text: string, phrase: string): boolean {
  let at = text.indexOf(phrase)
  while (at >= 0) {
    if (!NEGATED.test(text.slice(Math.max(0, at - 8), at))) return true
    at = text.indexOf(phrase, at + phrase.length)
  }
  return false
}

export const BASE_RULES: ValidatorRule[] = [
  {
    id: 'numbers.provenance', owner: 'M0', applies: ALL,
    check: (text, _card, pack) => {
      const allowed = allowedNumbers(pack)
      const bad = numbersIn(text).filter((n) => !allowed.has(n) && !(Number.isInteger(Number(n)) && Number(n) <= 10))
      return bad.length > 0 ? `numbers not in the fact pack: ${[...new Set(bad)].join(', ')}` : null
    },
  },
  {
    id: 'claims.banned', owner: 'M0', applies: ALL,
    check: (text) => {
      if (/患有|确诊|治愈|根治/.test(text)) return 'a diagnosis or cure claim'
      if (hasDose(text)) return 'a dose'
      if (/(?:停药|停掉|停用|加量|减量|换药|换成|开始吃|开始服|别吃了|不用吃)/.test(text) && /药|片|胰岛素|双胍|他汀|列净|沙坦|地平|铁剂/.test(text)) return 'a medicine change'
      return null
    },
  },
  {
    id: 'claims.younger', owner: 'M0', applies: ALL,
    check: (text, card, pack) => {
      if (!/年轻了|变年轻|更年轻|年轻\s*\d|比实足年龄年轻|逆龄/.test(text)) return null
      const allowed = pack.feedback.some((row) => row.allowed_claims.includes('younger') && (card.fact_ids.includes(row.id) || card.number_keys.some((key) => row.numbers.some((ref) => ref.key === key))))
      return allowed ? null : 'a "younger" claim without graded evidence'
    },
  },
  {
    id: 'exclusions', owner: 'M0', applies: ['suggestion', 'next_step', 'status', 'nudge', 'weekly_narrative'],
    check: (text, _card, pack) => {
      for (const item of pack.exclusions) for (const phrase of item.match.phrases_zh) if (phrase && mentioned(text, phrase)) return `an excluded item: ${phrase}`
      return null
    },
  },
  {
    id: 'safety.sglt2i', owner: 'M0', applies: ALL,
    check: (text, _card, pack) => {
      if (!pack.safety.drug_classes.includes('sglt2i')) return null
      const hit = text.match(TIME_RESTRICTED) ?? text.match(VERY_LOW_CARB)
      return hit && mentioned(text, hit[0]) ? `${hit[0]} for someone on an SGLT2 inhibitor` : null
    },
  },
  {
    id: 'internals', owner: 'M0', applies: ALL,
    check: (text) => {
      const tool = TOOL_NAMES.find((name) => text.includes(name))
      if (tool) return `a tool name: ${tool}`
      if (/\b[a-z]+_[a-z_]+\b/.test(text)) return 'an internal identifier'
      if (/\b\d{4,5}-\d\b/.test(text)) return 'a LOINC code'
      if (/\b[a-z]+(?:-[a-z]+){2,}\b/.test(text)) return 'a skill id'
      if (/[A-Za-z]{3,}(?:[\s,]+[A-Za-z]{2,}){3,}/.test(text)) return 'English text'
      return null
    },
  },
  {
    id: 'length', owner: 'M0', applies: ALL,
    check: (text, _card, _pack) => null,
  },
]

export function validatorRules(): readonly ValidatorRule[] {
  return [...BASE_RULES, ...rules]
}

/** The failures of every rule that applies to this kind of output; empty when it passes. */
export function runValidators(kind: ValidatedKind, text: string, card: { fact_ids: Id[]; number_keys: string[] }, pack: FactPack): Array<{ rule: string; detail: string }> {
  const failed: Array<{ rule: string; detail: string }> = []
  const limit = LIMITS[kind]
  if (limit && [...text].length > limit) failed.push({ rule: 'length', detail: `${[...text].length} characters, at most ${limit}` })
  for (const rule of [...BASE_RULES, ...rules]) {
    if (rule.id === 'length' || !rule.applies.includes(kind)) continue
    let detail: string | null = null
    try {
      detail = rule.check(text, card, pack)
    } catch (error) {
      detail = `rule threw: ${error instanceof Error ? error.message : String(error)}`
    }
    if (detail) failed.push({ rule: rule.id, detail })
  }
  return failed
}

/** Only the module-registered rules (C0 behaviour, for the registry test). */
export function runRegistered(kind: ValidatedKind, text: string, card: { fact_ids: Id[]; number_keys: string[] }, pack: FactPack): Array<{ rule: string; detail: string }> {
  const failed: Array<{ rule: string; detail: string }> = []
  for (const rule of rules) {
    if (!rule.applies.includes(kind)) continue
    let detail: string | null = null
    try {
      detail = rule.check(text, card, pack)
    } catch (error) {
      detail = `rule threw: ${error instanceof Error ? error.message : String(error)}`
    }
    if (detail) failed.push({ rule: rule.id, detail })
  }
  return failed
}
