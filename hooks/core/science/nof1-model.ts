// Personal-trial uncertainty and stopping. The posterior is a two-sample t on this person's
// own readings. It is not a community release and it does not say the person got younger.

import { mean, sampleSd } from './stats.ts'

export interface NOf1Quest {
  id: 'qs-n-of-1'
  season_id: string
  kind: 'science_n_of_1'
  title_zh: string
  criteria: { event: 'study.n_of_1_completed'; count: 1 }
  /** 长寿图鉴 1.2: finishing it is recorded as a footprint; there are no draws and no packs for it. */
  reward: { footprint: true }
  origin: 'rule'
  rarity_from_labs: false
  codex: { money: 'none'; trading: 'none'; minors: 'off' }
}

/** A finished personal trial is a footprint in the Codex; nothing in it reads the glucose gap. */
export function nOf1SeasonQuest(seasonId: string): NOf1Quest {
  return {
    id: 'qs-n-of-1',
    season_id: seasonId,
    kind: 'science_n_of_1',
    title_zh: '按随机顺序完成这次个人小试验；间隔期照常生活，血糖仅记录在这台电脑上',
    criteria: { event: 'study.n_of_1_completed', count: 1 },
    reward: { footprint: true },
    origin: 'rule',
    rarity_from_labs: false,
    codex: { money: 'none', trading: 'none', minors: 'off' },
  }
}

export interface Posterior {
  mean: number
  sd: number
  df: number
  ci95: [number, number]
  /** Posterior probability that the second arm is lower than the first. */
  p_second_lower: number
  n_a: number
  n_b: number
}

export type StopDecision = 'continue' | 'stop_difference' | 'stop_futility' | 'stop_cap'

export interface Stopping {
  decision: StopDecision
  reason_zh: string
}

const T975: Record<number, number> = {
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262,
  10: 2.228, 11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131, 16: 2.120, 17: 2.110, 18: 2.101,
  19: 2.093, 20: 2.086, 21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.060, 26: 2.056, 27: 2.052,
  28: 2.048, 29: 2.045, 30: 2.042,
}

export function tCritical975(df: number): number {
  if (df <= 0) return Number.POSITIVE_INFINITY
  if (df > 30) return 1.96
  return T975[Math.round(df)] ?? 1.96
}

function lgamma(z: number): number {
  const coeff = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z)
  const shifted = z - 1
  let x = coeff[0] ?? 0
  for (let i = 1; i < coeff.length; i += 1) x += (coeff[i] ?? 0) / (shifted + i)
  const t = shifted + 7.5
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x)
}

function betacf(a: number, b: number, x: number): number {
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - qab * x / qap
  if (Math.abs(d) < 1e-30) d = 1e-30
  d = 1 / d
  let h = d
  for (let m = 1; m <= 200; m += 1) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1 + aa / c
    if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d
    h *= d * c
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1 + aa / c
    if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 3e-12) break
  }
  return h
}

function regularizedBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const ln = a * Math.log(x) + b * Math.log(1 - x) - (lgamma(a) + lgamma(b) - lgamma(a + b))
  const front = Math.exp(ln)
  if (x < (a + 1) / (a + b + 2)) return front * betacf(a, b, x) / a
  return 1 - front * betacf(b, a, 1 - x) / b
}

/** Student-t CDF. Used for the personal posterior tail. */
export function studentTCdf(t: number, df: number): number {
  if (!(df > 0)) return t < 0 ? 0 : 1
  const x = df / (df + t * t)
  const ib = regularizedBeta(x, df / 2, 0.5)
  return t >= 0 ? 1 - 0.5 * ib : 0.5 * ib
}

export function posteriorDiff(first: readonly number[], second: readonly number[]): Posterior | null {
  if (first.length < 2 || second.length < 2) return null
  const meanA = mean(first)
  const meanB = mean(second)
  const sdA = sampleSd(first)
  const sdB = sampleSd(second)
  if (meanA == null || meanB == null || sdA == null || sdB == null) return null
  const df = first.length + second.length - 2
  if (df < 1) return null
  const pooled = df === 0 ? 0 : ((first.length - 1) * sdA * sdA + (second.length - 1) * sdB * sdB) / df
  const se = Math.sqrt(Math.max(0, pooled) * (1 / first.length + 1 / second.length))
  const diff = meanB - meanA
  if (se === 0) {
    return { mean: diff, sd: 0, df, ci95: [diff, diff], p_second_lower: diff < 0 ? 1 : diff > 0 ? 0 : 0.5, n_a: first.length, n_b: second.length }
  }
  const crit = tCritical975(df)
  const z = (0 - diff) / se
  return {
    mean: diff,
    sd: se,
    df,
    ci95: [diff - crit * se, diff + crit * se],
    p_second_lower: studentTCdf(z, df),
    n_a: first.length,
    n_b: second.length,
  }
}

export function stoppingRule(posterior: Posterior | null, opts: { mcid: number; periods_done: number; max_periods: number; min_n?: number }): Stopping {
  const minN = opts.min_n ?? 4
  const cap = opts.periods_done >= opts.max_periods
  if (!posterior || posterior.n_a < 2 || posterior.n_b < 2) {
    return cap
      ? { decision: 'stop_cap', reason_zh: '计划阶段已全部完成，记录不足以计算区间。按计划停止。' }
      : { decision: 'continue', reason_zh: '各阶段有效记录不足，请按计划继续记录。' }
  }
  const [low, high] = posterior.ci95
  const separates = (low > 0 && posterior.mean >= opts.mcid) || (high < 0 && -posterior.mean >= opts.mcid)
  const inside = low >= -opts.mcid && high <= opts.mcid
  const enough = posterior.n_a >= minN && posterior.n_b >= minN
  if (enough && separates) {
    return { decision: 'stop_difference', reason_zh: `两组差别的 95% 区间已经离开 0，绝对值至少 ${opts.mcid}。这只是你自己的对照，不能当成治疗结论。` }
  }
  if (enough && inside) {
    return { decision: 'stop_futility', reason_zh: `95% 区间落在 ±${opts.mcid} 里面。以此最小差别衡量，继续记录一段也不太可能出现差别。` }
  }
  if (cap) return { decision: 'stop_cap', reason_zh: '计划阶段已全部完成。区间仍跨过 0，按计划停止，不追加段落。' }
  return { decision: 'continue', reason_zh: '区间仍跨过 0，请按计划继续记录。洗脱和每段开头的几天不进入比较。' }
}

export interface ScheduleBlock {
  arm: string
  label_zh: string
  from: string
  to: string
  role: 'treatment' | 'washout'
}

export interface TrialReading { day: string; value: number }

function daysBetween(from: string, day: string): number {
  const a = Date.parse(`${from}T12:00:00Z`)
  const b = Date.parse(`${day}T12:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

/** Drop washout days and the first `carryoverDays` of each treatment block. */
export function readingsForAnalysis(schedule: readonly ScheduleBlock[], readings: readonly TrialReading[], carryoverDays: number): { morning: number[]; after_dinner: number[]; excluded: number } {
  const morning: number[] = []
  const afterDinner: number[] = []
  let excluded = 0
  for (const reading of readings) {
    const block = schedule.find((row) => reading.day >= row.from && reading.day <= row.to)
    if (!block || block.role === 'washout' || (block.arm !== 'morning' && block.arm !== 'after_dinner')) {
      excluded += 1
      continue
    }
    if (daysBetween(block.from, reading.day) < carryoverDays) {
      excluded += 1
      continue
    }
    ;(block.arm === 'morning' ? morning : afterDinner).push(reading.value)
  }
  return { morning, after_dinner: afterDinner, excluded }
}
