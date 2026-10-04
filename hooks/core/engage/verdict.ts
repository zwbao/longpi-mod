// The reveal's verdict (docs/codex-design.md §3.2, decision 11–12). Three words only: 超出平时波动, 在平时波动内,
// 数据不够. Never 真实变化 or 有效, never that the experiment caused it. Wristband metrics are judged against the
// person's own day-to-day spread (two-sample t, posteriorDiff) plus a minimal meaningful difference; blood
// pressure, weight, glucose and labs against the reference change value of biological_variation.json.

import type { MetricResult, MetricSpec, Outcome } from '../contracts/codex.ts'
import { rcvBand, type Biovar, type BiovarMarker } from '../reference.ts'
import { posteriorDiff } from '../science/nof1-model.ts'

export const OUTCOME_ZH: Record<Outcome, string> = {
  outside: '超出平时波动',
  inside: '在平时波动内',
  insufficient: '数据不够',
}

/** Days with data needed: trial window (decision: ≥10 of 14), baseline, and the secondary metrics. */
export const MIN_TRIAL_DAYS = 10
export const MIN_BASELINE_DAYS = 7
const MIN_SECONDARY_DAYS = 4
const MIN_RCV_DAYS = 3

function fmt(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals)
  return fixed.replace(/^-/, '−')
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length
}

function sd(values: readonly number[]): number | null {
  if (values.length < 2) return null
  const m = mean(values) as number
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) * (v - m), 0) / (values.length - 1))
}

export function markerOf(biovar: Biovar | null, key: string | undefined): BiovarMarker | null {
  if (!biovar || !key) return null
  return biovar.markers.find((row) => row.key === key) ?? null
}

/** The public threshold, fixed when the experiment starts. */
export function thresholdZh(spec: MetricSpec, biovar: Biovar | null, opts: { randomized: boolean; lab?: boolean; leadIn?: boolean } = { randomized: false }): string {
  const what = opts.randomized ? `做的日子和不做的日子的${spec.label_zh}` : opts.leadIn ? `先量的 7 天和之后 14 天的${spec.label_zh}` : `开始前两周和这两周的${spec.label_zh}`
  if (spec.method === 'personal') {
    return `拿${what}比。平均至少差 ${fmt(spec.mid ?? 0, spec.decimals > 0 ? 1 : 0)} ${spec.unit_zh}，而且超出你自己平时每天的起伏，才算「超出平时波动」。`
  }
  const marker = markerOf(biovar, spec.marker)
  const band = marker ? rcvBand(marker, biovar?.z ?? 1.96) : null
  const pct = band ? `约 ±${Math.round(Math.max(band.up, -band.down) * 100)}%` : '这项指标的参考变化值'
  if (spec.method === 'lab') return `比较开始前最近一次和 8 周后复查的${spec.label_zh}。变化超过${pct}，才算「超出平时波动」。这个范围来自同一个人反复测量时的正常起伏。`
  return `比较${what}平均值。变化超过${pct}，才算「超出平时波动」。这个范围来自同一个人反复测量时的正常起伏。`
}

function direction(spec: MetricSpec, diff: number): MetricResult['direction'] {
  if (diff === 0) return 'flat'
  if (spec.better === 'none') return null
  return (diff < 0) === (spec.better === 'lower') ? 'better' : 'worse'
}

function sentence(role: 'primary' | 'also', spec: MetricSpec, before: number | null, after: number | null, outcome: Outcome, compare: 'before_after' | 'off_on'): string {
  const lead = role === 'primary' ? '主要结果' : '顺便看'
  if (outcome === 'insufficient' || before == null || after == null) return `${lead} · ${spec.label_zh}：${OUTCOME_ZH.insufficient}，没法判断。`
  const pair = compare === 'off_on'
    ? `不做的日子 ${fmt(before, spec.decimals)}，做的日子 ${fmt(after, spec.decimals)} ${spec.unit_zh}`
    : `${fmt(before, spec.decimals)} → ${fmt(after, spec.decimals)} ${spec.unit_zh}`
  return `${lead} · ${spec.label_zh}：${pair}，${outcome === 'outside' ? '超出你的平时波动' : '在你的平时波动内'}。`
}

export interface Judged extends MetricResult { how_zh: string }

/**
 * Judge one metric. first = baseline (or the 不做 days), second = the experiment window (or the 做 days).
 * min = days needed on each side; the primary outcome passes MIN_TRIAL_DAYS / MIN_BASELINE_DAYS.
 */
export function judgeMetric(spec: MetricSpec, first: readonly number[], second: readonly number[], biovar: Biovar | null, opts: {
  role: 'primary' | 'also'
  compare?: 'before_after' | 'off_on'
  minFirst?: number
  minSecond?: number
  /** Who the baseline is in the sentences: 「你开始前两周」 or 「你先量的 7 天里」. */
  reference?: string
}): Judged {
  const compare = opts.compare ?? 'before_after'
  const minFirst = opts.minFirst ?? (spec.method === 'personal' ? MIN_SECONDARY_DAYS : MIN_RCV_DAYS)
  const minSecond = opts.minSecond ?? (spec.method === 'personal' ? MIN_SECONDARY_DAYS : MIN_RCV_DAYS)
  const before = mean(first)
  const after = mean(second)
  const base: Omit<Judged, 'outcome' | 'text_zh' | 'how_zh' | 'direction'> = { key: spec.key, label_zh: spec.label_zh, unit_zh: spec.unit_zh, before, after }
  const insufficient = (how: string): Judged => ({ ...base, outcome: 'insufficient', direction: null, text_zh: sentence(opts.role, spec, before, after, 'insufficient', compare), how_zh: how })
  if (first.length < minFirst || second.length < minSecond || before == null || after == null) {
    return insufficient(`有数据的日子不够：${compare === 'off_on' ? '不做的日子' : (opts.reference ?? '开始前两周').replace(/^你/, '')} ${first.length} 天、${compare === 'off_on' ? '做的日子' : '这两周'} ${second.length} 天。`)
  }
  const diff = after - before
  if (spec.method === 'personal') {
    const post = posteriorDiff(first, second)
    if (!post) return insufficient('有数据的日子不够，没法算出你自己的浮动范围。')
    const mid = spec.mid ?? 0
    const separated = post.ci95[0] > 0 || post.ci95[1] < 0
    const outcome: Outcome = separated && Math.abs(diff) >= mid ? 'outside' : 'inside'
    const spread = sd(first)
    const moved = `${diff < 0 ? '低了' : '高了'} ${fmt(Math.abs(diff), spec.decimals > 0 ? spec.decimals : 0)} ${spec.unit_zh}`
    const reference = compare === 'off_on' ? '不做的日子' : (opts.reference ?? '你开始前两周')
    const spreadZh = `${reference}，${spec.label_zh}每天上下浮动 ${fmt(spread ?? 0, spec.decimals > 0 ? 1 : 0)} ${spec.unit_zh}左右`
    const later = compare === 'off_on' ? '做的日子' : '这两周'
    const how = outcome === 'outside'
      ? `${spreadZh}；${later}的平均比之前${moved}，超出了这个起伏能解释的范围。`
      : Math.abs(diff) < mid
        ? `${later}的平均比之前${moved}，没到事先定好的 ${fmt(mid, spec.decimals > 0 ? 1 : 0)} ${spec.unit_zh}。`
        : `${spreadZh}；${later}的平均比之前${moved}，还在这个起伏能解释的范围内。`
    return { ...base, outcome, direction: direction(spec, diff), text_zh: sentence(opts.role, spec, before, after, outcome, compare), how_zh: how }
  }
  const marker = markerOf(biovar, spec.marker)
  if (!marker || before === 0) return insufficient('没有这项指标的参考变化值。')
  const band = rcvBand(marker, biovar?.z ?? 1.96)
  const pct = diff / before
  const outcome: Outcome = pct > band.up || pct < band.down ? 'outside' : 'inside'
  const width = Math.round(Math.max(band.up, -band.down) * 100)
  const how = `同一个人反复测${spec.label_zh}，单是测量误差和身体的日常起伏，前后就能差到约 ±${width}%。${compare === 'off_on' ? '做的日子' : '这两周'}的平均比之前${pct < 0 ? '低' : '高'} ${Math.abs(Math.round(pct * 1000) / 10)}%，${outcome === 'outside' ? '超过了' : '还在'}这个范围${outcome === 'outside' ? '' : '内'}。`
  return { ...base, outcome, direction: direction(spec, diff), text_zh: sentence(opts.role, spec, before, after, outcome, compare), how_zh: how }
}

/** The done days, affirmed when most days were done (decision 12: completed behaviour is always acknowledged). */
export function doneZh(done: number, window: number): string {
  const base = `${window} 天里做到了 ${done} 天`
  if (window > 0 && done / window >= 0.8) return `${base}，坚持得不错。`
  if (window > 0 && done / window >= 0.5) return `${base}，大多数日子都做到了。`
  return `${base}。`
}

/** Decision 12: said plainly when the primary outcome moved the good way beyond the usual variation. Never attributed. */
export function praiseZh(primary: MetricResult): string | null {
  if (primary.outcome !== 'outside' || primary.direction !== 'better') return null
  const way = primary.after != null && primary.before != null && primary.after < primary.before ? '低' : '高'
  return `你的${primary.label_zh}比平时${way}了，而且超出了平时的波动——这是实打实的进步。`
}
