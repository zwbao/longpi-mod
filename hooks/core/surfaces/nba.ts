// Rank next-best actions (AA §4.2): mandatory first, then priority; a mandatory action's blocks remove the
// kinds it blocks (a doctor first removes "draft a plan"); a topic asked in the last week drops 10.

import type { FactPack } from '../contracts/factpack.ts'
import type { NextBestAction } from '../contracts/surfaces.ts'

export function rankActions(candidates: readonly NextBestAction[], pack: Pick<FactPack, 'asked_recent' | 'today'>): NextBestAction[] {
  const live = candidates.filter((row) => !row.expires || row.expires >= pack.today)
  const blocked = new Set(live.filter((row) => row.mandatory).flatMap((row) => row.blocks ?? []))
  const kept = live.filter((row) => row.mandatory || !blocked.has(row.kind))
  const score = (row: NextBestAction) => row.priority - (pack.asked_recent.includes(row.kind) || pack.asked_recent.includes(row.id) ? 10 : 0)
  const seen = new Set<string>()
  return kept
    .sort((a, b) => Number(b.mandatory) - Number(a.mandatory) || score(b) - score(a) || a.id.localeCompare(b.id))
    .filter((row) => !seen.has(row.id) && seen.add(row.id))
}
