import type { IntentSpec, SkillCard } from './catalog.ts'
import { detectIntents, type EvidenceLexicon, type IntentHit } from './intents.ts'
import { runnableFrom, type RecordIndicator, type Runnable } from './measurements.ts'

export interface MatchHit {
  name: string
  domain: string
  blurb: string
  score: number
  why: string[]
  has_script: boolean
  tier: string
  /** Tier C is evidence. The species is in the first line of the skill. It is not this person's number. */
  evidence?: boolean
  species?: string
  /** record is runnableFrom's answer for the record alone: ready, near (one or two tests short) or none. */
  runnable: { status: Runnable['status']; missing: string[]; record: Runnable['record'] }
}

export interface DomainRow {
  domain: string
  count: number
  names: string[]
}

export interface MatchOptions {
  intents?: readonly IntentSpec[]
  explicitIntents?: readonly string[]
  profile?: { age: number | null; sex: string }
  outputs?: Record<string, unknown>
  lexicon?: EvidenceLexicon
  /** Reads that failed (records.missing_reads) or a cut catalogue: such inputs are not read, never "missing". */
  reads?: { failed?: readonly string[]; catalog_truncated?: boolean; probed?: readonly string[] }
}

export interface MatchResult {
  matches: MatchHit[]
  near: MatchHit[]
  intents: IntentHit[]
  note: string
}

const WEAK = new Set([
  'age', 'aging', 'ageing', 'aged', 'biological', 'blood', 'human', 'cell', 'cells',
  'gene', 'genes', 'protein', 'risk', 'health', 'study', 'paper', 'user', 'when',
  '年龄', '血液', '指标', '检查', '个人', '这个', '一个', '什么', '怎么', '可以',
  '记录', '技能', '方法', '实足', '没有', '不是', '衰老', '抗衰', '延缓', '我的',
])

const ORGANISMS: Array<{ id: string; species: string[]; re: RegExp }> = [
  { id: 'mouse', species: ['mouse', 'rat'], re: /小鼠|大鼠|老鼠|mouse|mice|(?<![A-Za-z])rats?(?![A-Za-z])/i },
  { id: 'worm', species: ['c_elegans'], re: /线虫|elegans/i },
  { id: 'fly', species: ['drosophila'], re: /果蝇|drosophila/i },
  { id: 'mole', species: ['naked_mole_rat'], re: /裸鼹鼠|naked[ -]?mole/i },
  { id: 'planarian', species: ['planarian'], re: /涡虫|planarian/i },
  { id: 'butterfly', species: ['butterfly'], re: /蝴蝶|butterfl|helicon/i },
  { id: 'whale', species: ['bowhead_whale'], re: /弓头鲸|鲸|bowhead|whale/i },
  { id: 'fish', species: ['zebrafish', 'killifish'], re: /青鳉|鳉鱼|killifish|斑马鱼|zebrafish/i },
  { id: 'yeast', species: ['yeast'], re: /酵母|yeast/i },
  { id: 'cells', species: ['cell_line'], re: /细胞实验|细胞系|cell line/i },
]

const SIGNALS: Array<{ skill: string; needles: string[]; need: number; why: string }> = [
  {
    skill: 'accelerated-biological-aging-risk',
    needles: ['albumin', '白蛋白', 'creatinine', '肌酐', 'glucose', '血糖', 'crp', 'c-reactive', 'c反应', 'lymph', '淋巴', 'mcv', 'rdw', 'alp', '碱性磷酸酶', 'wbc', '白细胞'],
    need: 3,
    why: '检查名里出现了表型年龄会用到的指标',
  },
  { skill: 'leukocyte-telomere-length', needles: ['telomere', '端粒'], need: 1, why: '记录里有端粒' },
  { skill: 'digital-telomere-measurement-sequencing', needles: ['telomere', '端粒'], need: 1, why: '记录里有端粒' },
  { skill: 'sleep-chart-biological-ageing', needles: ['sleep duration', '睡眠'], need: 1, why: '记录里有睡眠' },
]

export function domainSummary(cards: readonly SkillCard[]): DomainRow[] {
  const map = new Map<string, string[]>()
  for (const card of cards) {
    const names = map.get(card.domain) ?? []
    names.push(card.name)
    map.set(card.domain, names)
  }
  return [...map.entries()].map(([domain, names]) => ({ domain, count: names.length, names }))
}

function englishTerms(query: string): string[] {
  const found = new Set<string>()
  for (const match of query.toLowerCase().matchAll(/[a-z0-9][a-z0-9-]{2,}/g)) {
    if (match[0]) found.add(match[0])
  }
  return [...found]
}

function cjkGrams(query: string): string[] {
  const found = new Set<string>()
  for (const match of query.matchAll(/[一-鿿]{2,}/g)) {
    const run = match[0] ?? ''
    const max = Math.min(run.length, 8)
    for (let size = 2; size <= max; size += 1) {
      for (let index = 0; index + size <= run.length; index += 1) {
        found.add(run.slice(index, index + size))
      }
    }
  }
  return [...found]
}

export function organismsAsked(question: string): Set<string> {
  return new Set(ORGANISMS.filter((item) => item.re.test(question)).map((item) => item.id))
}

export function organismOf(card: SkillCard): string | null {
  if (card.species.length > 0) {
    if (card.species.includes('human')) return null
    const found = ORGANISMS.find((item) => item.species.some((species) => card.species.includes(species)))
    return found?.id ?? 'other'
  }
  const hay = `${card.name} ${card.domain} ${card.blurb} ${card.description}`
  return ORGANISMS.find((item) => item.re.test(hay))?.id ?? null
}

const GENERIC_NAME_TOKENS = new Set(['age', 'aging', 'ageing', 'clock', 'clocks', 'biological', 'human', 'risk', 'score', 'aged', 'the'])

/** A short token the question names exactly (CT, MRI, NMN) that is also a word of the skill's directory name. */
function nameTokenBonus(card: SkillCard, asked: string): number {
  const tokens = new Set(card.name.split('-').filter((token) => token.length >= 2 && !GENERIC_NAME_TOKENS.has(token)))
  for (const match of asked.matchAll(/(?<![A-Za-z0-9])([A-Za-z][A-Za-z0-9]{1,11})(?![A-Za-z0-9])/g)) {
    if (tokens.has((match[1] ?? '').toLowerCase())) return 8
  }
  return 0
}

function lexical(card: SkillCard, asked: string): { score: number; specific: number; strong: boolean; why: string[] } {
  const why: string[] = []
  let score = 0
  let specific = 0
  let strong = false
  if (!asked) return { score, specific, strong, why }
  const hay = `${card.name}\n${card.description}\n${card.blurb}\n${card.lead}`.toLowerCase()
  const terms = englishTerms(asked)
  if (terms.some((term) => term === card.name || card.name.includes(term))) {
    score += 8
    specific += 1
    why.push('名字对上了问题')
  }
  for (const term of terms) {
    if (term === card.name || card.name.includes(term) || !hay.includes(term)) continue
    if (WEAK.has(term)) {
      score += 1
    } else {
      score += 3
      specific += 1
      why.push(`说明里有「${term}」`)
    }
  }
  for (const gram of cjkGrams(asked)) {
    if (!hay.includes(gram)) continue
    if (WEAK.has(gram)) {
      score += 1
      continue
    }
    score += gram.length >= 4 ? 4 : gram.length === 3 ? 3 : 2
    specific += 1
    if (gram.length >= 3) why.push(`说明里有「${gram}」`)
    if (gram.length >= 4) strong = true
  }
  return { score, specific, strong, why }
}

function signalWhy(skill: string, indicatorHay: string): string {
  if (!indicatorHay) return ''
  const rule = SIGNALS.find((item) => item.skill === skill)
  if (!rule) return ''
  const hits = rule.needles.filter((needle) => indicatorHay.includes(needle.toLowerCase()))
  return hits.length >= rule.need ? rule.why : ''
}

function asRows(indicators: readonly (string | RecordIndicator)[]): RecordIndicator[] {
  return indicators.map((item) => (typeof item === 'string' ? { name: item, value: '', unit: '' } : item))
}

export function matchSkills(
  cards: readonly SkillCard[],
  query: string,
  indicators: readonly (string | RecordIndicator)[],
  limit: number,
  options: MatchOptions = {},
): MatchResult {
  const asked = query.trim()
  const rows = asRows(indicators)
  const indicatorHay = rows.map((row) => row.name).join('\n').toLowerCase()
  const profile = options.profile ?? { age: null, sex: 'unknown' }
  const specs = options.intents ?? []
  const explicit = (options.explicitIntents ?? []).filter((id) => specs.some((spec) => spec.id === id))
  const detected: IntentHit[] = explicit.length > 0
    ? explicit.map((id) => ({ id, label_zh: specs.find((spec) => spec.id === id)?.label_zh ?? id, score: 10, hits: ['模型指定'] }))
    : detectIntents(asked, specs, options.lexicon)
  const organisms = organismsAsked(asked)
  const organismIntent = detected.some((hit) => hit.id === 'model_organism')
  const hits: MatchHit[] = []
  const near: MatchHit[] = []
  for (const card of cards) {
    const organism = organismOf(card)
    // A named organism keeps the hint on that organism. The catalog still lists the others.
    if (organism && organisms.size > 0 && !organisms.has(organism) && organism !== 'other') continue
    const why: string[] = []
    let score = 0
    let specific = 0
    detected.forEach((hit, rank) => {
      const spec = specs.find((item) => item.id === hit.id)
      const position = spec ? spec.skills.indexOf(card.name) : -1
      const weight = 1 / (1 + rank)
      if (position >= 0) {
        score += (30 - 2 * position) * weight
        specific += 1
        why.push(`对上意图「${hit.label_zh}」`)
      } else if (card.intents.includes(hit.id)) {
        score += 10 * weight
        specific += 1
        why.push(`对上意图「${hit.label_zh}」`)
      }
    })
    const run = runnableFrom(card, rows, profile, options.outputs, options.reads)
    // A method that can run now ranks up in chat, whatever supplies its inputs; the labels, and the lists
    // without a question below, speak for the record alone.
    if (run.status === 'ready') score += 6
    else if (run.status === 'partial') score += 2
    if (run.record === 'ready') why.push('记录里的输入已经齐了')
    else if (run.status === 'partial') {
      const absent = run.missing.filter((label) => !run.unread.includes(label))
      if (absent.length > 0) why.push(`还缺 ${absent.join('、')}`)
      if (run.unread.length > 0) why.push(`${run.unread.join('、')}没有读到`)
    }
    const words = lexical(card, asked)
    score += Math.min(words.score, 12) * (detected.length > 0 && !words.strong ? 0.5 : 1)
    specific += words.specific
    why.push(...words.why)
    const token = nameTokenBonus(card, asked)
    if (token) {
      score += token
      specific += 1
      why.push('问题点了这个方法名里的词')
    }
    const signal = card.inputs.length === 0 ? signalWhy(card.name, indicatorHay) : ''
    if (signal) {
      score += 6
      specific += 1
      why.push(signal)
    }
    if (organism && organisms.has(organism)) {
      score += 6
      specific += 1
      why.push('问题点了这个模式生物')
    } else if (organism && !card.tier) {
      score -= 8
    }
    if (card.tier === 'C') why.push(`证据：${card.species.join('、') || '非人类'}，不当作这个人的数字`)
    if (card.tier === 'B' && detected[0] && !['intervention_evidence', 'gene_variant'].includes(detected[0].id)) score -= 2
    const hit: MatchHit = {
      name: card.name,
      domain: card.domain,
      blurb: card.blurb,
      score: Math.round(score * 10) / 10,
      why: [...new Set(why)].slice(0, 4),
      has_script: Boolean(card.script),
      tier: card.tier,
      ...(card.tier === 'C' ? { evidence: true, species: card.species.join('、') } : {}),
      runnable: { status: run.status, missing: run.missing, record: run.record },
    }
    if (!asked && run.record === 'near' && card.tier !== 'C') near.push(hit)
    if (asked) {
      if (specific === 0) continue
    } else if (run.record !== 'ready' && !signal) {
      continue
    }
    if (score <= 0) continue
    hits.push(hit)
  }
  hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  near.sort((a, b) => a.runnable.missing.length - b.runnable.missing.length || b.score - a.score || a.name.localeCompare(b.name))
  // When the question did not name an organism, human hints stay in score order and tier C is appended as evidence.
  // Naming an organism keeps score order, so that organism's method can lead.
  const namedOrganism = organisms.size > 0 || organismIntent
  const matches = namedOrganism
    ? hits.slice(0, limit)
    : [
      ...hits.filter((hit) => hit.tier !== 'C').slice(0, limit),
      ...hits.filter((hit) => hit.tier === 'C').slice(0, limit),
    ]
  let note = '这是提示，不是封闭名单。目录里的每个方法都可以读；没出现在这几条里的也可以绑定后运行。C 类是证据，物种在说明第一句，不当作这个人的数字。'
  if (matches.length === 0 && asked) {
    note = detected.some((hit) => hit.id === 'intervention_evidence')
      ? '没有技能直接对上。这是查证据的问题，用 query_longevity_evidence。'
      : '没有技能的说明对上这个问题。可以先看 list_longevity_intents，换一种说法。'
  }
  if (matches.length === 0 && !asked) note = '还没有问题，记录里也没有哪项方法的输入是齐的。先说出想了解什么，或接上检查。'
  return { matches, near: near.slice(0, 6), intents: detected, note }
}
