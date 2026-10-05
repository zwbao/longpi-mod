// Plain Chinese for the screens a person actually reads. Internal names stay in
// code and in the model's tool notes. They do not stay in these sentences.

export const SEASON_INTRO = '一个赛季 8 周，也可以设成到下次复查为止。一个赛季做 2–4 个两周的小实验：三选一，做，揭晓。'
export const CODEX_INTRO = '长寿图鉴有三部分：图书馆里的研究卡随时可读；两周的个人小实验，做完翻开看自己的结果；做到的事记成足迹卡。'
export const SCIENCE_INTRO = 'LongPi 的用户共同研究如何延缓衰老。你可以用自己的数据做个人小试验，也可以加入大家的研究。'
export const OUTBOX_ZH = '研究正式开始后才会发出，现在只保存在你的设备上。'
export const RECRUITING_ZH = '招募中'

export const JUDGEMENT = {
  beyond: '超出正常波动（比你平时的波动更大，建议咨询医生。不是急症。）',
  within: '在正常波动范围内（尚不能视为真实变化）',
  too_early: '太早（距上次检测时间过短，目前的变化多为正常波动）',
  not_comparable: '不可比（两次检测不在同一家机构，无法直接比较）',
  unjudged: '暂不能下结论（请查看缺少的环节）',
} as const

export type JudgementKey = keyof typeof JUDGEMENT

/** Short chip, then the one-sentence meaning the first time that word appears. */
export function judgementText(kind: JudgementKey, first: boolean): string {
  const full = JUDGEMENT[kind]
  if (first) return full
  const short = full.split('（')[0] ?? full
  return short
}

export function judgementKind(input: { gate?: string; judged?: string; reason?: string }): JudgementKey {
  const reason = input.reason ?? ''
  if (input.gate === 'too_early' || reason.startsWith('太早')) return 'too_early'
  if (input.gate === 'not_comparable' || reason.startsWith('不可比')) return 'not_comparable'
  if (input.judged === 'changed') return 'beyond'
  if (input.judged === 'within') return 'within'
  return 'unjudged'
}

export interface MovePoint { date: string; value: number }

export interface Movement {
  from: number
  to: number
  pct: number | null
  n: number
  start: string
  end: string
  lead: string
}

/** 「9 月 10 日」, with the year when it is not this year (docs/design-system.md). `today` fixes "this year" for tests. */
export function dateZh(iso: string | null | undefined, today?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return iso ?? ''
  const md = `${Number(m[2])} 月 ${Number(m[3])} 日`
  const year = today && /^\d{4}/.test(today) ? Number(today.slice(0, 4)) : new Date().getFullYear()
  return Number(m[1]) === year ? md : `${m[1]} 年 ${md}`
}

/** A typographic minus for a signed number shown to a person: -12.3 → −12.3. */
export function minusZh(text: string): string {
  return text.replace(/^-/, '−')
}

function trimNum(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2
  const text = value.toFixed(digits)
  return text.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
}

/** The card's first line: from → to, percent, how many results, and the date span. */
export function movementOf(points: readonly MovePoint[], unit: string): Movement | null {
  const rows = points.filter((point) => Number.isFinite(point.value) && point.date)
  if (rows.length === 0) return null
  const first = rows[0] as MovePoint
  const last = rows[rows.length - 1] as MovePoint
  const unitText = unit ? ` ${unit}` : ''
  if (rows.length === 1) {
    return {
      from: first.value, to: first.value, pct: null, n: 1, start: first.date, end: first.date,
      lead: `${trimNum(first.value)}${unitText} · 1 次 · ${dateZh(first.date)}`,
    }
  }
  const pct = first.value === 0 ? null : ((last.value - first.value) / Math.abs(first.value)) * 100
  const pctText = pct == null ? '' : ` · ${pct > 0 ? '+' : pct < 0 ? '−' : ''}${trimNum(Math.abs(pct))}%`
  return {
    from: first.value,
    to: last.value,
    pct,
    n: rows.length,
    start: first.date,
    end: last.date,
    lead: `${trimNum(first.value)} → ${trimNum(last.value)}${unitText}${pctText} · ${rows.length} 次 · ${dateZh(first.date)}–${dateZh(last.date)}`,
  }
}

export interface TrendRow { label_zh: string; text_zh: string; ask_doctor?: boolean; verdict?: string }

/** Two to four changes beside body age. A falling red-cell marker leads when body age is high. */
export function pickKeyTrends(changes: readonly TrendRow[], bodyOlder = false): TrendRow[] {
  const rows = [...changes]
  rows.sort((a, b) => {
    const ah = bodyOlder && /血红蛋白|红细胞|红细胞平均|MCV|MCH/.test(a.label_zh) ? 2 : a.ask_doctor ? 1 : 0
    const bh = bodyOlder && /血红蛋白|红细胞|红细胞平均|MCV|MCH/.test(b.label_zh) ? 2 : b.ask_doctor ? 1 : 0
    return bh - ah
  })
  if (rows.length <= 4) return rows
  return rows.slice(0, 4)
}

export function insightSentence(input: { sleepHours?: number | null; steps?: number | null; labNote?: string | null; sleepWhen?: string; stepsWhen?: string }): string | null {
  const sleep = input.sleepHours
  const steps = input.steps
  if ((sleep == null || !Number.isFinite(sleep)) && (steps == null || !Number.isFinite(steps))) return null
  const bits: string[] = []
  if (sleep != null && Number.isFinite(sleep)) bits.push(`${input.sleepWhen ?? '昨晚'}睡眠 ${trimNum(sleep)} 小时`)
  if (steps != null && Number.isFinite(steps)) bits.push(`${input.stepsWhen ?? '今天'}步数 ${trimNum(steps)} 步`)
  const lab = input.labNote
    ? `结合化验结果：${input.labNote}`
    : '手环数据反映近一两天的情况，化验通常间隔数周检测一次，两者宜分开解读。'
  return `${bits.join('，')}。${lab}`
}

/** Questions in the person's own voice, about what changed and the next visit. */
export function suggestedQuestions(input: { changes?: readonly string[]; visit?: string | null }): string[] {
  const names = (input.changes ?? []).filter(Boolean).slice(0, 2)
  const change = names.length > 0 ? `${names.join('、')}与上次相比变化了多少？` : '与上次相比，哪些项目有变化？'
  const visit = input.visit ? `下次 ${dateZh(input.visit)}就诊时，我应该询问哪些问题？` : '下次就诊时，我应该询问哪些问题？'
  return [change, visit, '我现在应优先做哪一件？']
}

export interface AddonLike { item_zh: string; unlocks_zh: string; self_measurable?: boolean; self_key?: string }

/** One concrete next step. Never "还差 N 项检查". */
export function concreteNext(addons: readonly AddonLike[]): { title_zh: string; detail_zh: string } {
  const first = addons.find((row) => row.self_measurable) ?? addons[0]
  if (!first) return { title_zh: '暂时无法计算结果', detail_zh: '尚缺计算所需的信息。' }
  const waist = first.self_key === 'waist' || /腰围/.test(first.item_zh)
  const title = waist ? '量一次腰围' : first.self_measurable ? `量一次${first.item_zh}` : `下次体检加测${first.item_zh}`
  const rest = addons.filter((row) => row !== first).slice(0, 2).map((row) => row.item_zh)
  const unlock = first.unlocks_zh || '后面的结果'
  const detail = rest.length > 0
    ? `补充这一项后，即可计算${unlock}。之后还可补充：${rest.join('、')}。`
    : `补充这一项后，即可计算${unlock}。`
  return { title_zh: title, detail_zh: detail }
}

export type LifeArea = 'labs' | 'sleep' | 'training'

export function lifeAreaOf(label: string): LifeArea {
  if (/睡眠|入睡|深睡|清醒时间|心率变异|夜间最低血氧/.test(label)) return 'sleep'
  if (/步数|运动|活动量|活动消耗|锻炼|卡路里|训练负荷|步行|静息心率|最大摄氧量/.test(label)) return 'training'
  return 'labs'
}

export interface TimelineItem {
  date: string
  kind: 'lab' | 'wearable' | 'life'
  title_zh: string
  detail_zh: string
}

export function buildTimeline(input: {
  checkups?: readonly { date: string; note?: string }[]
  wearables?: readonly { date: string; label_zh: string; value_zh: string }[]
  life?: readonly { date: string; kind: 'sick' | 'travel' | 'visit' | 'plan'; note?: string }[]
}): TimelineItem[] {
  const items: TimelineItem[] = []
  for (const row of input.checkups ?? []) {
    items.push({ date: row.date, kind: 'lab', title_zh: '体检', detail_zh: row.note || '当天有化验记录' })
  }
  for (const row of input.wearables ?? []) {
    items.push({ date: row.date, kind: 'wearable', title_zh: row.label_zh, detail_zh: row.value_zh })
  }
  const lifeTitle = { sick: '今天生病', travel: '今天出行', visit: '看医生', plan: '计划有变动' }
  for (const row of input.life ?? []) {
    items.push({ date: row.date, kind: 'life', title_zh: lifeTitle[row.kind], detail_zh: row.note || lifeTitle[row.kind] })
  }
  return items.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
}

const SCRUB: Array<[RegExp, string]> = [
  [/Mirobody/gi, '健康数据服务'],
  [/longevity-skills/gi, ''],
  [/\bMCP\b/g, ''],
  [/\/mcp\/\S*/g, ''],
  [/\bDSH\b/g, ''],
  [/HARNESS/gi, ''],
  [/\bLOINC\b/g, ''],
  [/\bRCV\b/g, '正常波动'],
  [/\bCVI\b/g, '个体波动'],
  [/ChiCTR/g, ''],
  [/签署密钥/g, ''],
  [/参考变化值/g, '平时的波动'],
  [/加了噪声/g, ''],
  [/\blive\b/g, ''],
  [/record_status/g, ''],
  [/~\/\.dsh\/longpi/g, '这台电脑'],
  [/https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\S*/g, ''],
  [/\b(?:127\.0\.0\.1|localhost)\b/g, ''],
  [/(?:(?<=\s)|^):\d{2,5}\b/g, ''],
  [/\b[A-Z]\d{2}\.\d+\b/g, ''],
  [/\b(?:NaN|undefined|null)\b/g, ''],
  [/\b\d[\d,]*\s*tok(?:\/s)?\b/gi, ''],
  [/User says[:：][^\n]*/gi, ''],
  [/\bTHE PATTERN\b/g, '数据显示'],
  [/\bWHAT WE DON'T KNOW\b/g, '数据尚不能说明的'],
  [/[A-Za-z]+(?:[ \t]+[A-Za-z]+){2,}/g, ''],
]

// A dotted disease code anywhere (血脂异常 E78.5), or a bare three-character code standing as its own word at the end (高血压 I10).
// A vitamin name such as 维生素B12 or 维生素 B12 is a lab, not a diagnosis.
const ICD_DOTTED = /\b[A-Z]\d{2}\.\d{1,2}\b/
const ICD_TAIL = /(?:^|[\s（(])[A-Z]\d{2}(?=[）)]?\s*$)/
const NOT_DIAGNOSIS = /维生素|vitamin/i

/** A catalogue row that is a diagnosis (it carries a disease code) is not an indicator. */
export function isDiagnosisName(name: string): boolean {
  if (NOT_DIAGNOSIS.test(name)) return false
  return ICD_DOTTED.test(name) || ICD_TAIL.test(name.trim())
}

/**
 * A paper as a person reads it: first author and year (Coskun 等，2020 年的研究). The English title stays behind the link.
 * A Chinese title is kept as it is.
 */
export function sourceLabel(title: string): string {
  const text = title.trim()
  if (!text) return '收录的研究'
  if (/[\u4e00-\u9fff]/.test(text) && !/[A-Za-z]{4,}(?:\s+[A-Za-z]{2,}){2,}/.test(text)) return text
  const author = /^([A-Z][A-Za-z'’-]+)/.exec(text)?.[1] ?? ''
  const year = /\b(19\d{2}|20\d{2})\b/.exec(text)?.[1] ?? ''
  if (author && year) return `${author} 等，${year} 年的研究`
  if (year) return `${year} 年的研究`
  return author ? `${author} 等的研究` : '收录的研究'
}

/** Drop backend names from a sentence a person will read. */
export function scrubVisible(text: string): string {
  let out = text
  for (const [pattern, replacement] of SCRUB) out = out.replace(pattern, replacement)
  return out.replace(/[ \t]{2,}/g, ' ').replace(/ +\n/g, '\n').trim()
}

export interface ResearchRange { text_zh: string; source_zh: string }

/** A numeric bound written in a library quote. No bound is invented when the quote has none. */
export function researchRangeFromQuote(quote: string, source: string): ResearchRange | null {
  const match = quote.match(/(?:低于|小于|<|≤)\s*(\d+(?:\.\d+)?)\s*(mmol\/L|mg\/dL|g\/L|%)/)
  if (!match) return null
  return {
    text_zh: `长寿研究里用来对照的上限是 ${match[1]} ${match[2]}`,
    source_zh: source,
  }
}

/** Words a non-expert reader should not have to meet. A hit means the sentence still needs work. */
const OBSTACLES = [
  'Mirobody', 'MCP', 'DSH', 'HARNESS', 'LOINC', 'record_status', 'tok/s', '~/.dsh', '127.0.0.1',
  '参考变化值', '个体内变异', '工具调用', 'ChiCTR', '签署密钥', 'localhost',
]
const BARE = [/(?<!正常|平时)波动内(?!）)/, /(?<![还])未判断/, /(?<!（)太早(?!（)/, /(?<!（)不可比(?!（)/, /(?<!（)解锁(?!（)/]

export function readerObstacles(text: string): string[] {
  const hits: string[] = []
  for (const word of OBSTACLES) if (text.includes(word)) hits.push(word)
  for (const pattern of BARE) if (pattern.test(text)) hits.push(pattern.source)
  // A paper name may close the sentence. It may not open it.
  const paperAt = (name: string) => {
    const at = text.indexOf(name)
    if (at < 0) return
    const earlier = text.slice(0, at)
    if (!/身体年龄|10 年心血管风险|论文里叫/.test(earlier)) hits.push(name)
  }
  paperAt('表型年龄')
  paperAt('China-PAR')
  return hits
}

export const FACING_SAMPLES = [
  SEASON_INTRO,
  CODEX_INTRO,
  SCIENCE_INTRO,
  OUTBOX_ZH,
  JUDGEMENT.beyond,
  JUDGEMENT.within,
  JUDGEMENT.too_early,
  JUDGEMENT.not_comparable,
  JUDGEMENT.unjudged,
  '身体年龄是用九项常规血检和周岁算出来的数（模型估计，不是诊断，也不是你能活多久）。论文里叫表型年龄。',
  '10 年心血管风险：和你情况相近的人里，未来 10 年出现心梗或中风的比例（模型估计）。论文里叫 China-PAR。',
  '加入共同研究需要你单独确认一次。该选项未预先勾选，也不能以「开始使用」代替。',
  '暂不加入',
  '量一次腰围',
  '赛季 · 第 1 周 / 共 8 周',
  '有一张实验卡可以翻了。',
  '超出平时波动',
  '在平时波动内',
  '数据不够',
  '数据显示',
  '数据尚不能说明的',
  '下一步',
  '我可以根据这些结果整理一份就诊简报（含数值、日期和建议向医生提出的问题），就诊时可直接出示给医生。',
  '不满 18 岁不参加研究。',
  '累计的天数不会减少。生病或出行的日子记一下，提醒会放轻。',
  '保底：连续 10 次里至少有一次是银或更好。这不是指标变好了。',
]
