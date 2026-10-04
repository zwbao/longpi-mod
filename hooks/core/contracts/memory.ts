// Per-person memory (AA §2.5, §3.3). Frozen at C0.

import type { Focus, Id, IsoDay, IsoTime, ModuleId, Provenance } from './common.ts'

export const MEMORY_VERSION = 1
export type MemoryKind = 'goal' | 'exclusion' | 'condition' | 'medication' | 'supplement' | 'family_history'
  | 'life_event' | 'care' | 'preference' | 'asked_topic' | 'note'
  | 'vision' | 'motivation' | 'win' | 'style' | 'commitment'
export type ConditionFlag = 'diabetes' | 'prediabetes' | 'ckd' | 'pregnancy' | 'pregnancy_planning' | 'breastfeeding'
  | 'cancer_followup' | 'cvd' | 'stent' | 'hypertension' | 'nafld' | 'anaemia' | 'thyroid' | 'minor' | 'caregiver_subject'
export type DrugClass = 'sglt2i' | 'insulin' | 'sulfonylurea' | 'metformin' | 'glp1ra' | 'statin' | 'anticoagulant'
  | 'antiplatelet' | 'antihypertensive' | 'thyroid_hormone' | 'iron' | 'steroid' | 'other'
/** Rule tables (not the model) decide safety relevance. */
export const SAFETY_DRUG_CLASSES: readonly DrugClass[] = ['sglt2i', 'insulin', 'sulfonylurea', 'anticoagulant', 'antiplatelet', 'glp1ra', 'steroid']
export const SAFETY_CONDITION_FLAGS: readonly ConditionFlag[] = ['diabetes', 'ckd', 'pregnancy', 'pregnancy_planning', 'breastfeeding', 'cancer_followup', 'cvd', 'stent', 'anaemia', 'minor']

interface MemoryItemBase {
  id: Id
  kind: MemoryKind
  /** One line the person would recognise ("不要限时进食"). */
  text_zh: string
  status: 'active' | 'retracted' | 'superseded' | 'expired'
  /** Unconfirmed items may only add caution (principle 5). */
  confirmed: boolean
  /** Computed from the rule tables above, never from the model. */
  safety_relevant: boolean
  provenance: Provenance
  updated: IsoTime
  supersedes?: Id
  valid_from?: IsoDay
  valid_to?: IsoDay | null
}
export interface GoalItem extends MemoryItemBase { kind: 'goal'; focus?: Focus; target?: { marker_key?: string; value?: number; unit?: string; by?: IsoDay } }
export interface ExclusionItem extends MemoryItemBase {
  kind: 'exclusion'
  scope: 'plan_item' | 'topic' | 'reminder' | 'suggestion'
  /** plan_prefs excluded_ids / excluded_phrases land here. */
  match: { item_ids?: string[]; categories?: string[]; phrases_zh: string[] }
  reason_zh?: string
}
export interface ConditionItem extends MemoryItemBase {
  kind: 'condition'; name_zh: string; flags: ConditionFlag[]
  state: 'current' | 'past' | 'suspected' | 'ruled_out'; since?: IsoDay
  code?: { system: 'icd10' | 'local'; value: string }
}
export interface MedicationItem extends MemoryItemBase {
  kind: 'medication' | 'supplement'; name_zh: string; drug_class: DrugClass[]
  /** Verbatim as prescribed or stated; never generated. */
  regimen_text?: string
  source_rx: 'doctor' | 'self' | 'unknown'; started?: IsoDay; stopped?: IsoDay | null
  /** Link to the datain/meds (medication_statements.jsonl) row. */
  statement_id?: string
}
export interface FamilyHistoryItem extends MemoryItemBase {
  kind: 'family_history'; relative: 'mother' | 'father' | 'sister' | 'brother' | 'child' | 'grandparent' | 'other'
  condition_zh: string; age_at_dx?: number; flags: ConditionFlag[]
}
export interface LifeEventItem extends MemoryItemBase {
  kind: 'life_event'; event: 'sick' | 'travel' | 'injury' | 'surgery' | 'pregnancy' | 'bereavement' | 'shift_work' | 'other'
  from: IsoDay; to: IsoDay | null; freezes_streak: boolean
}
export interface CareItem extends MemoryItemBase {
  kind: 'care'; finding_id?: Id; department_zh?: string
  /** AA §3.3 called this `status`, which clashes with the item's own status; renamed at C0. */
  care_status: 'advised' | 'booked' | 'visited' | 'declined' | 'unknown'
  visit_date?: IsoDay; outcome_zh?: string; next_date?: IsoDay; brief_id?: Id
}
export type PreferenceKey = 'tone' | 'cadence' | 'detail' | 'nudge_in_workflow' | 'quiet_hours' | 'codex_enabled' | 'celebrate' | 'units'
export interface PreferenceItem extends MemoryItemBase { kind: 'preference'; key: PreferenceKey; value: string | number | boolean }
export interface AskedTopicItem extends MemoryItemBase { kind: 'asked_topic'; topic_key: string; last_asked: IsoDay; count: number }
export interface NoteItem extends MemoryItemBase { kind: 'note' }
// The coach's file (longevity-coach templates/member.md): why they care, the picture they want at 70 or 80, wins,
// how Pi speaks to them, and small commitments.
export interface VisionItem extends MemoryItemBase { kind: 'vision' }
export interface MotivationItem extends MemoryItemBase { kind: 'motivation' }
export interface WinItem extends MemoryItemBase { kind: 'win'; day: IsoDay }
export type CoachTone = 'upbeat' | 'gentle' | 'direct'
export interface StyleItem extends MemoryItemBase { kind: 'style'; tone?: CoachTone; address?: '你' | '您' }
export interface CommitmentItem extends MemoryItemBase {
  kind: 'commitment'
  /** 0–10, how sure they are; Pi shrinks the step while it is below 7. */
  confidence: number | null
  /** The plan item it carries out: its check-ins are the cumulative count. */
  plan_item?: Id
  started: IsoDay
  /** Set when it became a habit; still active, asked about now and then. */
  graduated?: IsoDay
  /** Times counted before LongPi (a member file brought from the standalone coach): counts never reset. */
  carried_count?: number
}
export type MemoryItem = GoalItem | ExclusionItem | ConditionItem | MedicationItem | FamilyHistoryItem | LifeEventItem | CareItem | PreferenceItem | AskedTopicItem | NoteItem
  | VisionItem | MotivationItem | WinItem | StyleItem | CommitmentItem
export interface PersonMemory { version: typeof MEMORY_VERSION; rev: number; updated: IsoTime; items: MemoryItem[]; migrated?: string[] }
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
export type NewMemoryItem = DistributiveOmit<MemoryItem, 'id' | 'updated' | 'status' | 'safety_relevant'>
export type MemoryOp =
  | { op: 'add'; item: NewMemoryItem }
  | { op: 'retract'; id: Id; provenance: Provenance }
  | { op: 'supersede'; id: Id; item: NewMemoryItem }
  | { op: 'confirm'; id: Id; provenance: Provenance }
  | { op: 'graduate'; id: Id; day: IsoDay; provenance: Provenance }
  | { op: 'touch_topic'; topic_key: string; day: IsoDay; provenance: Provenance }
export interface MemoryApplyResult { rev: number; applied: Id[]; rejected: Array<{ op: MemoryOp; reason: string }> }
export interface MemoryApi {
  read(): PersonMemory
  active<K extends MemoryKind>(kind: K): Array<Extract<MemoryItem, { kind: K }>>
  /** Atomic write + memory_log line + bus 'memory.changed'. */
  apply(ops: MemoryOp[], by: ModuleId): MemoryApplyResult
  digest(opts: { purpose: 'chat' | 'surface' | 'plan' | 'triage' | 'advice'; maxChars?: number }): string
  /** Includes unconfirmed items (caution only). */
  safetyFlags(): { drug_classes: DrugClass[]; conditions: ConditionFlag[] }
}
