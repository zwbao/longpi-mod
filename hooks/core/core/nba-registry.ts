// Next-best-action providers (AA §3.2). Modules register a CandidateProvider; only M1 and M2 may mark an action mandatory.

import type { ModuleId } from '../contracts/common.ts'
import type { FactPack } from '../contracts/factpack.ts'
import { MANDATORY_PROVIDERS, type CandidateProvider, type NextBestAction } from '../contracts/surfaces.ts'

const providers: Array<{ module: ModuleId; provider: CandidateProvider }> = []

export function registerCandidates(module: ModuleId, provider: CandidateProvider): () => void {
  const row = { module, provider }
  providers.push(row)
  return () => {
    const at = providers.indexOf(row)
    if (at >= 0) providers.splice(at, 1)
  }
}

/**
 * Every provider's candidates for this pack. A provider that throws adds nothing; a mandatory flag from a
 * provider not registered as M1 or M2 is cleared, and each candidate carries the module it came from.
 */
export function collectCandidates(pack: Omit<FactPack, 'candidates' | 'fp'>): NextBestAction[] {
  const out: NextBestAction[] = []
  for (const { module, provider } of providers) {
    let rows: NextBestAction[] = []
    try {
      rows = provider(pack) ?? []
    } catch {
      rows = []
    }
    for (const row of rows) {
      const mandatory = row.mandatory === true && MANDATORY_PROVIDERS.includes(module)
      out.push({ ...row, provider: module, mandatory })
    }
  }
  return out
}

export function candidateProviders(): number {
  return providers.length
}
