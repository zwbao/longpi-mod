// Canonical number text (AA §3.6). Page, chat and model cards use this so a risk
// is never printed as 0.0871529403318675%.

import type { NumberRef } from '../contracts/common.ts'

function trimZeros(text: string): string {
  if (!text.includes('.')) return text
  return text.replace(/\.?0+$/, '')
}

/** Digits for a magnitude: percentages stay short; labs keep the decimals a report would print. */
function digitsFor(value: number, unit: string): number {
  const abs = Math.abs(value)
  if (unit === '%' || unit === '％') return abs >= 10 ? 0 : 1
  if (unit === '岁' || unit === '年') return Number.isInteger(value) ? 0 : 1
  if (abs >= 100) return abs >= 1000 || Number.isInteger(value) ? 0 : 1
  if (abs >= 10) return 1
  return 2
}

/**
 * The formatted form of one number, with its unit when it has one.
 * 6.58 mmol/L stays 6.58; 0.096373…% becomes 0.1%; 40.8 岁 stays 40.8 岁.
 */
export function formatNumber(ref: Pick<NumberRef, 'value' | 'unit'>): string {
  const value = ref.value
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  const unit = (ref.unit ?? '').trim()
  const text = trimZeros(value.toFixed(digitsFor(value, unit)))
  return unit ? `${text} ${unit}` : text
}

/** A relative change (0.12 → 12%, −0.004 → −0.4%) with no long tail. */
export function formatPercent(fraction: number): string {
  if (!Number.isFinite(fraction)) return ''
  return formatNumber({ value: fraction * 100, unit: '%' }).replace(' %', '%')
}

/** Round a percent-point figure (China-PAR risk, a mortality percent) to one decimal. */
export function roundPercentPoints(value: number | null | undefined, digits = 1): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
