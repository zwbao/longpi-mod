// CpG beta rows. A probe id is an Illumina cg or ch id. Beta is 0–1.
// A percent column is converted. A bare number above 1 is not.

import type { MethylationRow } from '../contracts/library.ts'
import { finite, isoDate, sourceName, type Verdict } from './limits.ts'

/** Figure 4 sites of the epigenetic frailty score. Coverage only: every other valid probe is still stored. */
export const FRAILTY_PROBE_IDS = [
  'cg00921350', 'cg01234420', 'cg02867102', 'cg03725309', 'cg04955914', 'cg07312601',
  'cg07349348', 'cg08463758', 'cg10408430', 'cg11700584', 'cg12510708', 'cg13570972',
  'cg15058210', 'cg15380836', 'cg17860366', 'cg17971578', 'cg18791730', 'cg19267254',
  'cg21656937', 'cg23458887',
] as const

const PROBE = /^(?:cg|ch)\d{8}$/

export interface MethylDraft {
  probe_id: string
  beta: unknown
  unit?: string
  sample_date?: string
  source_file: string
}

export function probeId(value: string): string | null {
  const id = value.trim().toLowerCase()
  return PROBE.test(id) ? id : null
}

export function validateMethylation(draft: MethylDraft, fallbackDate = ''): Verdict<MethylationRow> {
  const id = probeId(draft.probe_id)
  if (!id) return { ok: false, field: 'probe_id', reason: 'probe_id' }
  const sample = isoDate(draft.sample_date) ?? isoDate(fallbackDate)
  if (!sample) return { ok: false, field: 'sample_date', reason: 'date' }
  const parsed = finite(draft.beta)
  if (parsed == null) return { ok: false, field: 'beta', reason: 'beta' }
  const unit = (draft.unit ?? '').trim().toLowerCase()
  let beta = parsed
  if (unit === '%' || unit === 'percent' || unit === '％' || unit === '百分比') {
    if (parsed < 0 || parsed > 100) return { ok: false, field: 'beta', reason: 'beta' }
    beta = parsed / 100
  } else if (unit === 'm' || unit === 'm-value' || unit === 'm值') {
    return { ok: false, field: 'beta', reason: 'beta' }
  } else if (unit && unit !== '1' && unit !== 'beta' && unit !== 'β') {
    return { ok: false, field: 'unit', reason: 'unit' }
  } else if (parsed < 0 || parsed > 1) {
    return { ok: false, field: 'beta', reason: 'beta' }
  }
  if (beta < 0 || beta > 1) return { ok: false, field: 'beta', reason: 'beta' }
  const source = sourceName(draft.source_file)
  if (!source) return { ok: false, field: 'source_file', reason: 'source' }
  return { ok: true, row: { sample_date: sample, probe_id: id, beta, source_file: source } }
}

export function methylationCoverage(rows: MethylationRow[]): string {
  const ids = new Set(rows.map((row) => row.probe_id))
  const hit = FRAILTY_PROBE_IDS.filter((id) => ids.has(id)).length
  const dates = [...new Set(rows.map((row) => row.sample_date))].slice(0, 4).join('、')
  return `共 ${ids.size} 个探针${dates ? `（${dates}）` : ''}。衰弱风险评分所需的 20 个位点中，覆盖 ${hit} 个。`
}
