// Sufficient statistics computed on this machine. Raw series are not returned.

export interface Point { day: string; value: number }

export function count(xs: readonly number[]): number {
  return xs.length
}

export function mean(xs: readonly number[]): number | null {
  if (xs.length === 0) return null
  return xs.reduce((sum, value) => sum + value, 0) / xs.length
}

/** Sample variance (n − 1). Null when fewer than two points. */
export function variance(xs: readonly number[]): number | null {
  if (xs.length < 2) return null
  const center = mean(xs) as number
  return xs.reduce((sum, value) => sum + (value - center) ** 2, 0) / (xs.length - 1)
}

export function sampleSd(xs: readonly number[]): number | null {
  const v = variance(xs)
  return v == null ? null : Math.sqrt(v)
}

/** Within-person CV in percent. Needs at least three positive points. */
export function cvPercent(xs: readonly number[]): { n: number; mean: number; sd: number; cv_pct: number } | null {
  if (xs.length < 3) return null
  const center = mean(xs)
  const sd = sampleSd(xs)
  if (center == null || sd == null || !(Math.abs(center) > 1e-9)) return null
  return { n: xs.length, mean: center, sd, cv_pct: 100 * sd / Math.abs(center) }
}

export function meanDiff(left: readonly number[], right: readonly number[]): number | null {
  const a = mean(left)
  const b = mean(right)
  if (a == null || b == null) return null
  return b - a
}

/** Paired t on equal-length series, paired by order. Returns [t, df, mean of differences]. */
export function pairedT(left: readonly number[], right: readonly number[]): [number, number, number] | null {
  const n = Math.min(left.length, right.length)
  if (n < 2) return null
  const diffs = Array.from({ length: n }, (_, i) => (right[i] ?? 0) - (left[i] ?? 0))
  const center = mean(diffs) as number
  const sd = sampleSd(diffs)
  if (sd == null) return null
  if (sd === 0) return [center === 0 ? 0 : center > 0 ? Infinity : -Infinity, n - 1, center]
  const se = sd / Math.sqrt(n)
  return [center / se, n - 1, center]
}

export function histogram(xs: readonly number[], bins: number, clip: [number, number]): number[] {
  const width = (clip[1] - clip[0]) / bins
  const counts = Array.from({ length: bins }, () => 0)
  if (!(width > 0)) return counts
  for (const value of xs) {
    let index = Math.floor((value - clip[0]) / width)
    if (index < 0) index = 0
    if (index >= bins) index = bins - 1
    counts[index] = (counts[index] ?? 0) + 1
  }
  return counts
}

export interface StatValue { stat: string; key: string; value: number; n: number; detail_zh: string }

/**
 * One local statistic. `arms` maps arm id → values; mean_diff is mean(second) − mean(first)
 * in `armOrder`.
 */
export function computeStat(stat: string, key: string, values: readonly number[], opts: { arms?: Record<string, number[]>; armOrder?: string[]; reference_cvi?: number } = {}): StatValue | null {
  if (stat === 'count') return { stat, key, value: values.length, n: values.length, detail_zh: `${values.length} 个读数` }
  if (stat === 'mean') {
    const value = mean(values)
    if (value == null) return null
    return { stat, key, value, n: values.length, detail_zh: `平均 ${round(value)}` }
  }
  if (stat === 'var') {
    const value = variance(values)
    if (value == null) return null
    return { stat, key, value, n: values.length, detail_zh: `方差 ${round(value)}` }
  }
  if (stat === 'hist') {
    return { stat, key, value: values.length, n: values.length, detail_zh: '直方图只留在本机' }
  }
  if (stat === 'rcv_calibration') {
    const row = cvPercent(values)
    if (!row) return null
    const ref = opts.reference_cvi
    const ratio = ref && ref > 0 ? row.cv_pct / ref : null
    const detail = ratio == null
      ? `你这 ${row.n} 次的波动大约 ${round(row.cv_pct)}%`
      : `你这 ${row.n} 次的波动大约 ${round(row.cv_pct)}%，文献里的个体内波动是 ${round(ref ?? 0)}%`
    return { stat, key, value: row.cv_pct, n: row.n, detail_zh: detail }
  }
  const order = opts.armOrder ?? Object.keys(opts.arms ?? {})
  const left = opts.arms?.[order[0] ?? ''] ?? []
  const right = opts.arms?.[order[1] ?? ''] ?? []
  if (stat === 'mean_diff') {
    if (left.length < 2 || right.length < 2) return null
    const value = meanDiff(left, right)
    if (value == null) return null
    return { stat, key, value, n: left.length + right.length, detail_zh: `两组平均相差 ${round(value)}（第二组减第一组）` }
  }
  if (stat === 'paired_t') {
    const row = pairedT(left, right)
    if (!row || !Number.isFinite(row[0])) return null
    return { stat, key, value: row[0], n: left.length, detail_zh: `配对 t = ${round(row[0])}，${row[1]} 个自由度` }
  }
  return null
}

export function round(value: number): string {
  if (!Number.isFinite(value)) return ''
  const abs = Math.abs(value)
  const digits = abs >= 100 ? 1 : abs >= 10 ? 2 : 3
  return String(Number(value.toFixed(digits)))
}
