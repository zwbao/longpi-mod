// The weekly literature scout. Once a week it asks PubMed for the past week's aging papers that are trials,
// meta-analyses, Mendelian randomization, large cohorts or lifespan studies, ranks them by design and journal,
// and has Claude write the best few as 长寿图鉴 research cards under the Codex copy rules
// (docs/codex-design.md §4, §6). The citation (authors, journal, year, DOI, PMID) always comes from PubMed,
// never from the model; a card is gold only when PubMed calls the paper a randomized controlled trial.

import type { Io } from '../sys/host.ts'
import { join } from '../sys/path.ts'
import type { LiteratureCard, LiteratureWeek } from '../core/engage/literature.ts'

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const TOPIC = '(aging[tiab] OR ageing[tiab] OR longevity[tiab] OR lifespan[tiab] OR healthspan[tiab] OR "biological age"[tiab] OR "epigenetic clock"[tiab] OR senolytic*[tiab] OR "cellular senescence"[tiab] OR frailty[tiab] OR centenarian*[tiab])'
const DESIGN = '(randomized controlled trial[pt] OR meta-analysis[pt] OR systematic review[pt] OR randomized[tiab] OR "mendelian randomization"[tiab] OR "prospective cohort"[tiab] OR "extends lifespan"[tiab] OR "extended lifespan"[tiab] OR "lifespan extension"[tiab])'

const STRONG_JOURNALS = [
  'n engl j med', 'lancet', 'jama', 'bmj', 'nature', 'science', 'cell', 'nat med', 'nature medicine', 'nat aging', 'nature aging',
  'cell metab', 'cell metabolism', 'lancet healthy longev', 'nat commun', 'nature communications', 'aging cell', 'geroscience',
  'elife', 'proc natl acad sci', 'j gerontol', 'age ageing', 'circulation', 'eur heart j', 'diabetes care', 'ann intern med',
  'plos med', 'nat metab', 'nature metabolism', 'sci transl med', 'cell rep', 'aging (albany ny)', 'nat genet',
]

const CHAPTERS = ['clock', 'organ', 'brain', 'immune', 'repair', 'tissue', 'gene', 'span'] as const
const SPECIES = ['mouse', 'c_elegans', 'drosophila', 'killifish', 'zebrafish', 'planarian', 'butterfly', 'naked_mole_rat', 'bowhead_whale'] as const

type Summary = { pmid: string; title: string; journal: string; journalShort: string; year: number | null; authors: string[]; doi: string; pubtypes: string[] }

export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function query(params: Record<string, string>): string {
  return Object.entries(params).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')
}

async function getJson(io: Io, url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await io.fetch(url, { method: 'GET', headers: { 'user-agent': 'LongPi-mod (longevity coach; contact via github.com/zwbao)' } })
    return res.ok ? (JSON.parse(res.text) as Record<string, unknown>) : null
  } catch {
    return null
  }
}

async function search(io: Io, days: number): Promise<string[]> {
  const url = `${EUTILS}/esearch.fcgi?${query({ db: 'pubmed', retmode: 'json', retmax: '80', datetype: 'edat', reldate: String(days), sort: 'relevance', term: `${TOPIC} AND ${DESIGN}` })}`
  const json = await getJson(io, url)
  const ids = (json?.esearchresult as { idlist?: unknown } | undefined)?.idlist
  return Array.isArray(ids) ? ids.map(String) : []
}

async function summaries(io: Io, ids: readonly string[]): Promise<Summary[]> {
  if (ids.length === 0) return []
  const json = await getJson(io, `${EUTILS}/esummary.fcgi?${query({ db: 'pubmed', retmode: 'json', id: ids.join(',') })}`)
  const result = (json?.result ?? {}) as Record<string, unknown>
  const out: Summary[] = []
  for (const id of ids) {
    const row = result[id] as Record<string, unknown> | undefined
    if (!row) continue
    const ids2 = Array.isArray(row.articleids) ? (row.articleids as Array<{ idtype?: string; value?: string }>) : []
    const year = Number(String(row.pubdate ?? '').slice(0, 4))
    out.push({
      pmid: id,
      title: String(row.title ?? '').replace(/<[^>]+>/g, ''),
      journal: String(row.fulljournalname ?? row.source ?? ''),
      journalShort: String(row.source ?? ''),
      year: Number.isFinite(year) && year > 1900 ? year : null,
      authors: (Array.isArray(row.authors) ? (row.authors as Array<{ name?: string }>) : []).map((a) => String(a.name ?? '')).filter(Boolean),
      doi: ids2.find((a) => a.idtype === 'doi')?.value ?? '',
      pubtypes: Array.isArray(row.pubtype) ? (row.pubtype as unknown[]).map(String) : [],
    })
  }
  return out
}

async function abstracts(io: Io, ids: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (ids.length === 0) return out
  try {
    const res = await io.fetch(`${EUTILS}/efetch.fcgi?${query({ db: 'pubmed', rettype: 'abstract', retmode: 'xml', id: ids.join(',') })}`, { method: 'GET' })
    if (!res.ok) return out
    for (const article of res.text.split('<PubmedArticle>').slice(1)) {
      const pmid = /<PMID[^>]*>(\d+)<\/PMID>/.exec(article)?.[1]
      if (!pmid) continue
      const parts = [...article.matchAll(/<AbstractText([^>]*)>([\s\S]*?)<\/AbstractText>/g)].map((m) => {
        const label = /Label="([^"]+)"/.exec(m[1] ?? '')?.[1]
        return `${label ? `${label}: ` : ''}${(m[2] ?? '').replace(/<[^>]+>/g, '')}`
      })
      out.set(pmid, parts.join(' ').replace(/\s+/g, ' ').trim())
    }
  } catch {
    // abstracts are a help, not a requirement
  }
  return out
}

/** Design and journal first: a trial or a meta-analysis in a strong journal leads. */
export function rank(row: Summary): number {
  const types = row.pubtypes.join(' ').toLowerCase()
  const title = row.title.toLowerCase()
  let score = 0
  if (types.includes('randomized controlled trial')) score += 6
  if (types.includes('meta-analysis')) score += 5
  if (types.includes('systematic review')) score += 3
  if (/mendelian randomi[sz]ation/.test(title)) score += 3
  if (/lifespan|life span|longevity/.test(title)) score += 2
  if (/cohort|participants|adults|older/.test(title)) score += 1
  if (types.includes('review') && !types.includes('systematic')) score -= 3
  if (/protocol|study design|rationale/.test(title)) score -= 5
  const journal = `${row.journal} ${row.journalShort}`.toLowerCase()
  if (STRONG_JOURNALS.some((name) => journal === name || journal.startsWith(`${name} `) || journal.includes(` ${name}`) || row.journalShort.toLowerCase() === name)) score += 4
  return score
}

const SYSTEM = `你是长寿研究编辑，为「长寿图鉴」写研究卡。读者是普通中国成年人（比如一位 68 岁的退休教师）。
规则：
1. 客观转述：谁、做了什么、发现了什么。不在句尾加否定或免责。
2. 关键限定写进 line_zh：物种、研究类型（随机试验、队列、事后分析）、自报还是测量。关联研究写成「……的人更常见/偏大」，不写成因果。
3. 标题 title_zh 不超过 12 个汉字，可以有梗，但不误导，不只挑好听的一半。
4. about_zh 两三句白话：怎么做的、看到了什么、一个具体数字（只用摘要里写明的数字，并说明是什么尺度）。不出现没解释的英文缩写。
5. 阴性结果照写。
6. 不写「逆龄」「年轻了」「逆转」「保证」「治愈」，不推荐补剂、药物、剂量或任何产品。
7. tier 按主结论的证据：cell（细胞实验）、animal（动物实验）、human（人群研究、队列、孟德尔随机化，或随机试验的事后/次要分析）、trial（人体随机试验的主要结局）。tier_reason_zh 一句话说明为什么。
8. chapter 从 clock（身体的钟）、organ（器官与代谢）、brain（大脑与心理）、immune（免疫与炎症）、repair（细胞的维修）、tissue（组织与再生）、gene（生殖与基因）、span（寿命与节律）里选一个。
9. species 只能从 human, cell_line, mouse, c_elegans, drosophila, killifish, zebrafish, planarian, butterfly, naked_mole_rat, bowhead_whale 里选。
只回答一个 JSON 对象，不要代码块，不要别的文字。`

function promptOf(rows: ReadonlyArray<Summary & { abstract: string }>, max: number): string {
  const items = rows.map((row, i) => [
    `#${i + 1} PMID ${row.pmid}`,
    `题目：${row.title}`,
    `期刊：${row.journal}（${row.year ?? ''}）`,
    `文献类型：${row.pubtypes.join(', ')}`,
    `摘要：${row.abstract.slice(0, 1800) || '（无摘要）'}`,
  ].join('\n')).join('\n\n')
  return `下面是过去一周新发表的衰老和长寿相关论文。挑出最值得普通人知道的最多 ${max} 篇：优先人体随机试验、荟萃分析和大型队列，方法扎实、结论清楚、和健康长寿直接相关；动物或细胞研究只有在发现很重要时才选，最多 1 篇。方法弱、只是综述、只是方案、或者和健康长寿关系不大的不要。宁缺毋滥：没有够格的就少选。

${items}

回答格式：
{"cards":[{"pmid":"…","title_zh":"…","line_zh":"…","about_zh":"…","tier":"cell|animal|human|trial","tier_reason_zh":"…","chapter":"…","species":["human"]}]}`
}

function firstJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

function cells(text: string): number {
  let n = 0
  for (const ch of text) n += /[\u0000-ɏ\s]/.test(ch) ? 0.5 : 1
  return n
}

const BANNED = /逆龄|年轻了|逆转|保证|治愈|购买|剂量|补剂推荐/

function hashSeed(text: string): number {
  let h = 2166136261
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return h
}

export type ScoutResult = { ok: boolean; week: string; cards: number; candidates: number; reason: string }

/** One weekly run: search, rank, write, check, save. Never throws; says why when nothing came of it. */
export async function scoutLiterature(io: Io, root: string, now: Date, opts: { days?: number; max?: number } = {}): Promise<ScoutResult> {
  const week = isoWeek(now)
  const days = opts.days ?? 7
  const max = opts.max ?? 4
  const ids = await search(io, days)
  if (ids.length === 0) return { ok: false, week, cards: 0, candidates: 0, reason: '这周没有检索到符合条件的新论文，或者 PubMed 暂时连不上。' }
  const all = await summaries(io, ids)
  const ranked = all.filter((row) => row.title && rank(row) > 0).sort((a, b) => rank(b) - rank(a)).slice(0, 18)
  const texts = await abstracts(io, ranked.map((row) => row.pmid))
  const withText = ranked.map((row) => ({ ...row, abstract: texts.get(row.pmid) ?? '' })).filter((row) => row.abstract.length > 200)
  if (withText.length === 0) return { ok: false, week, cards: 0, candidates: all.length, reason: '这周的候选论文都没有摘要，跳过。' }
  const answer = await io.complete(promptOf(withText, max), { system: SYSTEM, maxTokens: 4000, model: 'sonnet' })
  if (!answer.ok) return { ok: false, week, cards: 0, candidates: all.length, reason: `没有写成研究卡（${answer.reason}）。` }
  const parsed = firstJson(answer.text)
  const rows = Array.isArray(parsed?.cards) ? (parsed?.cards as Array<Record<string, unknown>>) : []
  const byId = new Map(withText.map((row) => [row.pmid, row]))
  const cards: LiteratureCard[] = []
  rows.forEach((row, i) => {
    const source = byId.get(String(row.pmid ?? ''))
    if (!source) return
    const title = String(row.title_zh ?? '').trim()
    const line = String(row.line_zh ?? '').trim()
    const about = String(row.about_zh ?? '').trim()
    if (!title || !line || !about || cells(title) > 14 || cells(line) > 60 || BANNED.test(`${title}${line}${about}`)) return
    const isTrial = source.pubtypes.some((type) => /randomized controlled trial/i.test(type))
    let tier = String(row.tier ?? '') as LiteratureCard['tier']
    if (!['cell', 'animal', 'human', 'trial'].includes(tier)) return
    if (tier === 'trial' && !isTrial) tier = 'human'
    const chapter = CHAPTERS.includes(String(row.chapter) as (typeof CHAPTERS)[number]) ? String(row.chapter) : 'span'
    const species = (Array.isArray(row.species) ? row.species.map(String) : ['human']).filter((key) => key === 'human' || key === 'cell_line' || (SPECIES as readonly string[]).includes(key))
    cards.push({
      id: `lit-${source.pmid}`,
      skill: '',
      no: `${week.slice(2).replace('-W', 'W')}-${i + 1}`,
      chapter,
      tier,
      tier_reason_zh: String(row.tier_reason_zh ?? '').trim() || '按论文的研究类型定的颜色。',
      title_zh: title,
      line_zh: line,
      about_zh: about,
      species: species.length > 0 ? species : ['human'],
      meet: species.filter((key) => (SPECIES as readonly string[]).includes(key)),
      source: {
        first_author: (source.authors[0] ?? '').split(' ')[0] ?? '',
        et_al: source.authors.length > 1,
        journal: source.journalShort || source.journal,
        year: source.year,
        ...(source.doi ? { doi: source.doi } : {}),
        preprint: false,
        coi_zh: null,
      },
      research_assay: false,
      feature_zh: null,
      art: { motif: chapter, seed: hashSeed(source.pmid) },
      week,
      added: now.toISOString(),
      pmid: source.pmid,
      pubtypes: source.pubtypes,
    })
  })
  const record: LiteratureWeek = { week, at: now.toISOString(), candidates: all.length, cards }
  await io.write(join(root, 'literature', `${week}.json`), `${JSON.stringify(record, null, 1)}\n`)
  return { ok: cards.length > 0, week, cards: cards.length, candidates: all.length, reason: cards.length > 0 ? '' : '这周的论文都没有达到上架的标准。' }
}
