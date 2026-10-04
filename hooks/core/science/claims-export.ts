// Export a community release as one longevity-skills evidence claim.
// The file is for the weekly pipeline to read. This module does not submit it.

import { mkdirSync, writeFileSync } from '../../sys/fs.ts'
import { join } from '../../sys/path.ts'

export interface EvidenceClaim {
  id: string
  entity: string
  entity_zh?: string
  entity_type: 'biomarker'
  claim_zh: string
  direction: 'marker'
  context_zh: string
  species: ['human']
  evidence: 'cohort'
  source: { skill: 'longpi-community'; locator: string; title: string }
}

const ID_OK = /^[a-z0-9][a-z0-9-]*:[A-Za-z0-9._+-]+$/

export function claimFromRelease(input: {
  study_id: string
  marker: string
  marker_zh: string
  estimate: number
  n: number
  epsilon: number
  unit: string
}): EvidenceClaim {
  const estimate = Number(input.estimate.toFixed(3))
  const claim_zh = `社区合计（模拟，未投稿）：${input.marker_zh}的发布估计是 ${estimate} ${input.unit}，n=${input.n}，ε=${input.epsilon}。噪声加在合计上，这不是个人诊断。`
  return {
    id: `longpi-community:${input.study_id}.${input.marker}`,
    entity: input.marker,
    entity_zh: input.marker_zh,
    entity_type: 'biomarker',
    claim_zh,
    direction: 'marker',
    context_zh: '模拟社区合计，供每周证据管道读取，不是已发表试验',
    species: ['human'],
    evidence: 'cohort',
    source: {
      skill: 'longpi-community',
      locator: `study:${input.study_id}`,
      title: 'LongPi simulated community aggregate',
    },
  }
}

export function claimProblems(row: EvidenceClaim): string[] {
  const problems: string[] = []
  if (!ID_OK.test(row.id)) problems.push('id')
  if (row.claim_zh.length < 4 || row.claim_zh.length > 300) problems.push('claim_zh length')
  if (/年轻|证明|治愈|患有|确诊/.test(row.claim_zh)) problems.push('claim wording')
  if (row.entity_type !== 'biomarker') problems.push('entity_type')
  if (row.evidence !== 'cohort') problems.push('evidence')
  if (row.species.length !== 1 || row.species[0] !== 'human') problems.push('species')
  if (row.source.skill !== 'longpi-community') problems.push('skill')
  if ('doi' in row.source) problems.push('doi')
  const allowed = new Set(['id', 'entity', 'entity_zh', 'entity_type', 'claim_zh', 'direction', 'context_zh', 'species', 'evidence', 'source'])
  for (const key of Object.keys(row)) if (!allowed.has(key)) problems.push(`extra ${key}`)
  return problems
}

export function claimsJsonl(rows: readonly EvidenceClaim[]): string {
  return rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length > 0 ? '\n' : '')
}

/** Write the jsonl on this computer. `submitted` is always false: nothing is sent. */
export function writeClaimsExport(dataDir: string, rows: readonly EvidenceClaim[]): { path: string; submitted: false; rows: number } {
  const dir = join(dataDir, 'science', 'export')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, 'claims.jsonl')
  writeFileSync(path, claimsJsonl(rows))
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify({
    format: 'longevity-skills/schema/claim.schema.json',
    submitted: false,
    note_zh: '只导出，不提交。每周管道可以读取这份 jsonl。',
  }, null, 2)}\n`)
  return { path, submitted: false, rows: rows.length }
}
