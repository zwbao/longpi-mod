// M6 seams (AA §3.6): the fact pack's engagement line and the next-step candidates.

import type { FactPack } from '../contracts/factpack.ts'
import type { CandidateProvider, NextBestAction } from '../contracts/surfaces.ts'
import { boundRootDir, candidateSeeds, engagementSummary as summaryOf } from './engine.ts'

export function engagementSummary(): FactPack['engagement'] {
  return summaryOf()
}

export const engageCandidates: CandidateProvider = () => {
  if (!boundRootDir()) return []
  try {
    return candidateSeeds().map((seed): NextBestAction => ({
      id: seed.id,
      kind: seed.kind,
      provider: 'M6',
      priority: seed.priority,
      mandatory: false,
      reason_codes: ['engage'],
      fact_ids: [],
      target: { surface: 'page', tab: 'codex', prompt_zh: seed.prompt_zh },
      title_zh: seed.title_zh,
      detail_zh: seed.detail_zh,
    }))
  } catch {
    return []
  }
}
