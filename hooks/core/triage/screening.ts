// Screening topics to raise with a doctor (M1, PLAN §B1 y27): by age and sex, and earlier for a close
// relative's cancer the person told LongPi about. A topic, never an order. On an empty or first record the
// strongest one leads the first screen (AA §2.4 rank 4).

import { existsSync, readFileSync } from '../../sys/fs.ts'
import { fileURLToPath, libUrl } from '../../sys/url.ts'
import type { TopFact } from '../contracts/factpack.ts'
import type { NextBestAction } from '../contracts/surfaces.ts'

interface Rule { id: string; sex: 'female' | 'male' | 'any'; age: [number, number]; family_rx?: string; priority: 'must_surface' | 'should_surface'; topic_zh: string; prompt_zh: string }

const BUILT_IN: Rule[] = [
  { id: 'breast-family', sex: 'female', age: [18, 80], family_rx: '乳腺癌|乳癌', priority: 'must_surface', topic_zh: '家里有人得过乳腺癌：宜比一般人更早开始乳腺筛查，并咨询医生是否需要遗传咨询', prompt_zh: '家里有人得过乳腺癌，我该怎么筛查？' },
  { id: 'cervix-age', sex: 'female', age: [25, 65], priority: 'should_surface', topic_zh: '按你的年龄，可以问医生宫颈筛查（HPV 或 TCT）', prompt_zh: '像我这个年龄该做哪些乳腺和宫颈筛查？' },
]

let cached: Rule[] | null = null
function rules(): Rule[] {
  if (cached) return cached
  for (const rel of ['../data/triage/screening.json', '../../data/triage/screening.json']) {
    try {
      const path = fileURLToPath(new URL(rel, libUrl()))
      if (!existsSync(path)) continue
      const raw = JSON.parse(readFileSync(path, 'utf8')) as { rules?: Rule[] }
      if (Array.isArray(raw.rules) && raw.rules.length > 0) return (cached = raw.rules)
    } catch {
      // next place
    }
  }
  return (cached = BUILT_IN)
}

export interface ScreeningInput {
  age: number | null
  sex: string
  /** Family history lines from memory (their words). */
  family: string[]
  /** No checkup in the record yet. */
  emptyRecord: boolean
}

/** The topics that apply, strongest first; each is a top fact and a non-mandatory action. */
export function screeningTopics(input: ScreeningInput): Array<{ fact: TopFact; action: NextBestAction }> {
  if (input.age == null && input.family.length === 0) return []
  const out: Array<{ fact: TopFact; action: NextBestAction }> = []
  for (const rule of rules()) {
    if (rule.sex !== 'any' && rule.sex !== input.sex) continue
    if (input.age != null && (input.age < rule.age[0] || input.age > rule.age[1])) continue
    if (input.age == null && !rule.family_rx) continue
    let quote = ''
    if (rule.family_rx) {
      const pattern = new RegExp(rule.family_rx)
      quote = input.family.find((line) => pattern.test(line)) ?? ''
      if (!quote) continue
    }
    const priority = rule.priority === 'must_surface' || input.emptyRecord ? 'must_surface' : 'should_surface'
    const id = `screening-${rule.id}`
    out.push({
      fact: { id, kind: 'screening', priority, text_zh: rule.topic_zh, refs: [], source_ids: [], rule: `screening.${rule.id}` },
      action: {
        id, kind: 'screening_topic', provider: 'M1', priority: priority === 'must_surface' ? 70 : 45, mandatory: false, reason_codes: [`screening.${rule.id}`], fact_ids: [id],
        target: { surface: 'chat', prompt_zh: rule.prompt_zh }, title_zh: '可以问医生的筛查', detail_zh: rule.topic_zh,
      },
    })
  }
  // One chip per prompt; the family rule first.
  const seen = new Set<string>()
  return out.filter((row) => !seen.has(row.action.target.prompt_zh ?? '') && seen.add(row.action.target.prompt_zh ?? ''))
}
