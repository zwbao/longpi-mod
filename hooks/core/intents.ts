// Detect what the person is asking for (intents.json in longevity-skills) and
// which named drugs, supplements or genes the question mentions (the evidence
// store in skills/longevity-evidence/data/claims.jsonl).

import { existsSync, readFileSync, statSync } from '../sys/fs.ts'
import { join } from '../sys/path.ts'
import type { IntentSpec } from './catalog.ts'

export interface IntentHit {
  id: string
  label_zh: string
  score: number
  hits: string[]
}

export interface EvidenceLexicon {
  interventions: string[]
  genes: string[]
}

const EMPTY: EvidenceLexicon = { interventions: [], genes: [] }
const INTERVENTION_TYPES = new Set(['drug', 'compound', 'supplement', 'intervention'])
const GENE_TYPES = new Set(['gene', 'protein', 'variant'])
const compiled = new Map<string, RegExp>()

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function triggerRegex(trigger: string, caseSensitive = false): RegExp {
  const key = `${caseSensitive ? 'c' : 'i'}:${trigger}`
  const hit = compiled.get(key)
  if (hit) return hit
  const flags = caseSensitive ? '' : 'i'
  let re: RegExp
  if (trigger.startsWith('re:')) {
    re = new RegExp(trigger.slice(3), flags)
  } else if (/^[\x20-\x7e]+$/.test(trigger)) {
    re = new RegExp(`(?<![A-Za-z0-9])${escape(trigger)}(?![A-Za-z0-9])`, flags)
  } else {
    re = new RegExp(escape(trigger), flags)
  }
  compiled.set(key, re)
  return re
}

function mentioned(question: string, names: readonly string[], caseSensitive = false): string[] {
  const found: string[] = []
  for (const name of names) {
    if (triggerRegex(name, caseSensitive).test(question) && !found.includes(name)) found.push(name)
  }
  return found
}

export function detectIntents(question: string, intents: readonly IntentSpec[], lexicon: EvidenceLexicon = EMPTY): IntentHit[] {
  const asked = question.trim()
  if (!asked) return []
  const hits: IntentHit[] = []
  for (const intent of intents) {
    const triggers = mentioned(asked, intent.triggers)
    const entities = mentioned(asked, intent.entities ?? [])
    let score = triggers.length + 2 * entities.length
    const found = [...triggers, ...entities]
    if (intent.id === 'intervention_evidence') {
      const named = mentioned(asked, lexicon.interventions).filter((name) => !found.includes(name))
      score += 2 * Math.min(named.length, 2)
      found.push(...named.slice(0, 3))
    }
    if (intent.id === 'gene_variant') {
      const named = mentioned(asked, lexicon.genes, true).filter((name) => !found.includes(name))
      score += Math.min(named.length, 2)
      found.push(...named.slice(0, 3))
    }
    if (score > 0) hits.push({ id: intent.id, label_zh: intent.label_zh, score, hits: found.slice(0, 5) })
  }
  const order = new Map(intents.map((intent, index) => [intent.id, index]))
  const priority = new Map(intents.map((intent) => [intent.id, intent.priority ?? 0]))
  return hits.sort((a, b) => b.score - a.score
    || (priority.get(b.id) ?? 0) - (priority.get(a.id) ?? 0)
    || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}

/** Drugs, supplements and genes the question names, for the evidence lookup. */
export function mentionedEntities(question: string, intents: readonly IntentSpec[], lexicon: EvidenceLexicon): string[] {
  const evidence = intents.find((intent) => intent.id === 'intervention_evidence')
  const names = [
    ...mentioned(question, evidence?.entities ?? []),
    ...mentioned(question, lexicon.interventions),
    ...mentioned(question, lexicon.genes, true),
  ]
  const unique: string[] = []
  for (const name of names.sort((a, b) => b.length - a.length)) {
    if (!unique.some((kept) => kept.toLowerCase().includes(name.toLowerCase()))) unique.push(name)
  }
  return unique.slice(0, 6)
}

const lexiconCache = new Map<string, { stamp: number; lexicon: EvidenceLexicon }>()

export function loadEvidenceLexicon(home: string): EvidenceLexicon {
  if (!home) return EMPTY
  const path = join(home, 'skills', 'longevity-evidence', 'data', 'claims.jsonl')
  if (!existsSync(path)) return EMPTY
  const stamp = statSync(path).mtimeMs
  const hit = lexiconCache.get(path)
  if (hit && hit.stamp === stamp) return hit.lexicon
  const interventions = new Set<string>()
  const genes = new Set<string>()
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue
    let row: { entity?: string; entity_zh?: string; entity_type?: string; aliases?: string[] }
    try {
      row = JSON.parse(line) as typeof row
    } catch {
      continue
    }
    const names = [row.entity ?? '', row.entity_zh ?? '', ...(row.aliases ?? [])]
    for (const name of names) {
      const trimmed = name.trim()
      if (!trimmed) continue
      const ascii = /^[\x20-\x7e]+$/.test(trimmed)
      if (ascii ? trimmed.length < 3 : trimmed.length < 2) continue
      if (INTERVENTION_TYPES.has(row.entity_type ?? '')) interventions.add(trimmed)
      else if (GENE_TYPES.has(row.entity_type ?? '') && ascii && /[A-Z]/.test(trimmed)) genes.add(trimmed)
    }
  }
  const lexicon = { interventions: [...interventions], genes: [...genes] }
  lexiconCache.set(path, { stamp, lexicon })
  return lexicon
}
