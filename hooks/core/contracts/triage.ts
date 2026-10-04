// Triage and care navigation (AA §3.3). Owner M1.

import type { Id, IsoDay, NumberRef } from './common.ts'

export interface TriageFinding {
  id: Id; rule: string; priority: 'emergency' | 'must_surface' | 'should_surface'
  kind: 'critical_value' | 'progressive_pattern' | 'below_range' | 'screening' | 'treatment_signal'
  title_zh: string; numbers: NumberRef[]; department_zh: string
  tests_to_request_zh: string[]; questions_zh: string[]
  status: 'open' | 'advised' | 'visited' | 'resolved' | 'dismissed'; opened: IsoDay; care_item_id?: Id
  /** The full sentence the chat and the brief use (deterministic). */
  text_zh: string
}
export interface DoctorBrief {
  id: Id; finding_ids: Id[]; created: IsoDay
  /** Deterministic. */
  trend: Array<{ label_zh: string; points: NumberRef[] }>
  meds_zh: string[]; conditions_zh: string[]
  questions_zh: string[]; tests_zh: string[]
  /** Items a deep analysis gave to a doctor (supplements, tests, referrals, the physician's items). */
  analysis_zh?: string[]
  /** Model prose around refs, validated; the template otherwise. */
  summary_zh: string
  /** dataDir/briefs/<id>.md, printable. */
  source: 'model' | 'template'; file?: string
}
