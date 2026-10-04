// M5 candidates from the stage (AA §4.2 PR 1b): the journey's own next step becomes one candidate among the
// others, ranked by fact instead of by stage alone.

import type { ActionKind, CandidateProvider, NextBestAction } from '../contracts/surfaces.ts'

/** The journey's legacy action → the NBA kind. */
export const KIND_OF: Record<string, ActionKind> = {
  consent: 'answer_profile', profile: 'answer_profile', records: 'connect_records', addons: 'book_addon_test', plan: 'draft_plan',
  checkin: 'checkin', review: 'retest', open: 'read_result', doctor: 'see_doctor',
}

const PRIORITY: Partial<Record<ActionKind, number>> = {
  connect_records: 60, retest: 55, checkin: 40, book_addon_test: 35, answer_profile: 30, draft_plan: 25, read_result: 20,
}

/** The stage's next step leads the non-mandatory ones (+30), so nothing changes when no fact outranks it. */
export const journeyCandidates: CandidateProvider = (pack) => {
  const next = pack.stage_next
  if (!next) return []
  const kind = KIND_OF[next.action] ?? 'read_result'
  const row: NextBestAction = {
    id: `stage-${next.action}`, kind, provider: 'M5', priority: (PRIORITY[kind] ?? 20) + 30, mandatory: false, reason_codes: [`stage.${pack.stage}`], fact_ids: [],
    target: { surface: 'page', section: next.action }, title_zh: next.title_zh, detail_zh: next.detail_zh,
  }
  return [row]
}
