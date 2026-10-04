// The deep-analysis tab's text rules (client/analysis.ts), ported as they are: pipeline text in the house
// style, numbers by the spec rule, units, estimate ranges. One change: model-made estimates say 「AI 预测」
// (the owner's wording since 2026-10-04), so pipeline labels that say 「AI 估计」 are read the same way.

export interface Readout { id: string; label_zh: string; value: unknown; unit?: string; kind?: string; group?: string; low?: number; high?: number; horizon_years?: number }

/** Pipeline text, put into the house style: no doubled 岁, 「1/7」 without spaces, the minus sign, 「」 quotes. */
export function tidy(text: string): string {
  return text
    .replace(/岁\s*岁/g, '岁')
    .replace(/\.{3,}|。{3,}/g, '…')
    .replace(/(\d)\s*\/\s*(\d)/g, '$1/$2')
    .replace(/(^|[\s（(：:，,；;=≈<>])-(?=\d)/g, '$1−')
    .replace(/[“"]([^“”"]*)[”"]/g, '「$1」')
    .replace(/‘([^‘’]*)’/g, '「$1」')
    .replace(/AI 估计/g, 'AI 预测')
    // The record lives on this computer; a medication plan is set up by telling Claude.
    .replace(/请?在健康数据服务中建立/g, '请在对话里让 Claude 建立')
}

/** Anything shown comes from a file a pipeline wrote: shown as text, never as an object. */
export const t = (v: unknown): string => (typeof v === 'string' ? tidy(v) : typeof v === 'number' && Number.isFinite(v) ? num(v) : '')

/** Numbers by the spec rule: whole numbers as they are, below 10 two decimals, 10 and above one decimal. */
export function num(v: unknown): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return t(v) || '—'
  const a = Math.abs(v)
  const text = Number.isInteger(v) ? String(a) : String(Number(a.toFixed(a < 10 ? 2 : 1)))
  return v < 0 && Number(text) !== 0 ? `−${text}` : text
}

const isProb = (r: Readout) => r.unit === '概率'

/** A number with its unit: 岁 for years, % glued to the number, other units after a space. */
export function withUnit(r: Readout, v: unknown): string {
  if (isProb(r)) return typeof v === 'number' && Number.isFinite(v) ? `${num(Math.round(v * 10000) / 100)}%` : '—'
  const n = num(v)
  if (r.unit === 'a' || (r.kind === 'llm_estimate' && !r.unit)) return `${n} 岁`
  if (r.unit === '%') return `${n}%`
  return r.unit ? `${n} ${t(r.unit)}` : n
}

/** The value alone (the heading says what kind of estimate it is). */
export function valueText(r: Readout | null | undefined): string {
  return r ? withUnit(r, r.value) : '—'
}

/** An estimate's range, with its horizon when it is not the 10 years the heading states. */
export function rangeText(r: Readout): string {
  if (typeof r.low !== 'number' || typeof r.high !== 'number') return ''
  const lo = isProb(r) ? withUnit(r, r.low).replace(/%$/, '') : num(r.low)
  const hi = withUnit(r, r.high)
  return `${lo}–${hi}${r.horizon_years && r.horizon_years !== 10 ? `，${t(r.horizon_years)} 年` : ''}`
}

/** Full text for places without a heading. */
export function fmt(r: Readout | null | undefined): string {
  if (!r) return '—'
  if (r.kind !== 'llm_estimate') return valueText(r)
  const range = rangeText(r)
  return `${valueText(r)}（AI 预测${range ? `，${range}` : ''}${isProb(r) && r.horizon_years === 10 ? '，10 年' : ''}）`
}

/** Labels written by the pipeline repeat「（10 年，AI 估计）」; the heading says it once. */
export const cleanLabel = (label: string) => label.replace(/\s*[（(][^（）()]*(?:AI 估计|AI 预测|年)[^（）()]*[）)]\s*$/, '').trim() || label

/** A worded value keeps its short verdict on the line and its explanation below: [verdict, note]. */
export function measureParts(r: Readout): [string, string] {
  const text = valueText(r)
  if (typeof r.value === 'number') return [text, '']
  const m = /^([^（(]+?)\s*[（(](.+)[）)]$/.exec(text)
  return m ? [m[1] ?? text, m[2] ?? ''] : [text, '']
}

/** The report's boundary note minus what the page footer already says (reference only, not a diagnosis). */
export function pageBoundary(text: string): string {
  return text.split(/[；;]/).map((x) => x.trim().replace(/。$/, '')).filter((x) => x && !/不是诊断|不做诊断|健康管理参考/.test(x)).join('；')
}

/** 「9 月 30 日」, with the year when it is not this year. */
export function dateOf(iso: string, today: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return ''
  const md = `${Number(m[2])} 月 ${Number(m[3])} 日`
  return m[1] === today.slice(0, 4) ? md : `${m[1]} 年 ${md}`
}

/** First sentence of a conclusion, cut to about two lines at a clause break; the whole text then goes under the fold. */
const LEAD_MAX = 80
export function splitFirst(text: string): [string, string] {
  const m = /^[\s\S]*?[。！？!?](?=\s*\S)/.exec(text)
  const [first, rest] = m ? [m[0], text.slice(m[0].length).trim()] : [text, '']
  if (first.length <= LEAD_MAX) return [first, rest]
  const head = first.slice(0, LEAD_MAX)
  const cut = Math.max(head.lastIndexOf('；'), head.lastIndexOf('，'), head.lastIndexOf('：'))
  return [`${cut > 20 ? head.slice(0, cut) : head}…`, text]
}

export const VERDICT_ZH: Record<string, string> = { increase_beyond_noise: '升高，超出正常波动', decrease_beyond_noise: '降低，超出正常波动', within_noise: '在正常波动内' }
export const CONF_ZH: Record<string, string> = { low: '低', moderate: '中' }
