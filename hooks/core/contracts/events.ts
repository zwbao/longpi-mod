// The HealthEvent bus (AA §2.6, §3.3). Frozen at C0. Payloads carry ids and keys, never copies of health values.

import type { Id, IsoDay, IsoTime, ModuleId } from './common.ts'
import type { MemoryKind, LifeEventItem } from './memory.ts'
import type { EvidenceGrade } from './feedback.ts'
import type { PackKind, FootprintKind, Outcome } from './codex.ts'
import type { ConsentRecord } from './science.ts'
import type { SurfaceSet } from './surfaces.ts'

export interface HealthEventPayloads {
  'report.arrived': { checkup_day: IsoDay; indicators: number; narrative_findings: number; source: 'upload' | 'record_poll' }
  'record.changed': { catalogue_fp: string; generation: number }
  'memory.changed': { rev: number; kinds: MemoryKind[]; safety_relevant: boolean; item_ids: Id[] }
  'triage.opened': { finding_id: Id; priority: 'emergency' | 'must_surface' | 'should_surface'; rule: string }
  'triage.resolved': { finding_id: Id; how: 'visited' | 'normalised' | 'dismissed_by_person' | 'superseded' }
  'care.advised': { finding_id: Id; department_zh: string }
  'care.booked': { department_zh: string; day: IsoDay }
  'care.visit_logged': { care_item_id: Id; finding_id?: Id; with_brief: boolean }
  'brief.generated': { brief_id: Id; finding_ids: Id[]; source: 'model' | 'template' }
  'plan.drafted': { draft_id: Id; items: number; source: 'rules' | 'co_designer'; hold: boolean }
  'plan.saved': { version: number; items: number }
  'plan.item_excluded': { item_id: string; exclusion_id: Id }
  'checkin.logged': { day: IsoDay; item_ids: string[]; done: boolean | null }
  'selfmeasure.logged': { key: string; day: IsoDay }
  'life_event.logged': { memory_id: Id; event: LifeEventItem['event']; from: IsoDay; to: IsoDay | null }
  'retest.due': { marker_key: string; day: IsoDay }
  'retest.arrived': { marker_keys: string[]; day: IsoDay }
  'verdict.changed': { item_id: string; marker_key: string; from: string; to: string }
  'feedback.issued': { feedback_id: Id; grade: EvidenceGrade; subject_key: string }
  'season.started': { season_id: Id }
  'season.ended': { season_id: Id; experiments_done: number }
  /** A pack exists because something real happened: a season began, an experiment ended, a retest arrived. */
  'codex.pack_granted': { pack_id: Id; kind: PackKind; source: string }
  'codex.experiment_started': { run_id: Id; experiment_id: string; randomized: boolean }
  /** The outcome word only (outside / inside / insufficient); never the values. */
  'codex.experiment_revealed': { run_id: Id; experiment_id: string; outcome: Outcome }
  'codex.footprint': { footprint_id: Id; kind: FootprintKind }
  'study.consented': { study_id: string; consent_id: Id }
  'study.withdrawn': { study_id: string; consent_id: Id }
  'study.run_completed': { study_id: string; run_id: Id; released: boolean }
  'study.n_of_1_completed': { study_id: string; season_id: Id }
  'consent.changed': { scope: ConsentRecord['scope']; decision: ConsentRecord['decision'] }
  'day.rolled': { day: IsoDay }
  /** save_personal_profile, POST /profile. */
  'profile.changed': { fields: string[] }
  'surface.generated': { inputs_fp: string; source: SurfaceSet['source']; latency_ms: number }
  'chat.turn_ended': { session_id: string; turn: number; health: boolean; prefilter_hit: boolean }
  'nudge.shown': { nudge_id: Id; where: 'overlay' | 'dock' | 'notification' | 'pane'; kind?: 'standup' | 'reveal' }
}
export type HealthEventType = keyof HealthEventPayloads
export interface HealthEventSource {
  module: ModuleId
  via: 'tool' | 'route' | 'timer' | 'hook' | 'record_poll' | 'migration'
  tool?: string
  session_id?: string
}
export type HealthEvent = { [K in HealthEventType]: {
  id: Id; type: K; at: IsoTime; day: IsoDay; source: HealthEventSource; payload: HealthEventPayloads[K]; causation_id?: Id
} }[HealthEventType]

export interface Bus {
  emit<T extends HealthEventType>(type: T, payload: HealthEventPayloads[T], source: HealthEventSource, causation_id?: Id): HealthEvent
  on(types: HealthEventType[] | '*', fn: (e: HealthEvent) => void | Promise<void>, label: string, opts?: { durable?: boolean }): () => void
  since(cursor: Id | null, types?: HealthEventType[]): HealthEvent[]
}

/** Only the owning module emits a given type (AA §3.4). */
export const EVENT_OWNERS: Readonly<Record<HealthEventType, ModuleId>> = {
  'report.arrived': 'M7', 'record.changed': 'M10', 'memory.changed': 'M0', 'triage.opened': 'M1', 'triage.resolved': 'M1',
  'care.advised': 'M1', 'care.booked': 'M6', 'care.visit_logged': 'M1', 'brief.generated': 'M1', 'plan.drafted': 'M3', 'plan.saved': 'M3',
  'plan.item_excluded': 'M3', 'checkin.logged': 'M3', 'selfmeasure.logged': 'M7', 'life_event.logged': 'M6',
  'retest.due': 'M9', 'retest.arrived': 'M9', 'verdict.changed': 'M9', 'feedback.issued': 'M4', 'season.started': 'M6',
  'season.ended': 'M6', 'codex.pack_granted': 'M6', 'codex.experiment_started': 'M6', 'codex.experiment_revealed': 'M6', 'codex.footprint': 'M6',
  'study.consented': 'M8', 'study.withdrawn': 'M8', 'study.run_completed': 'M8', 'study.n_of_1_completed': 'M8', 'consent.changed': 'M11', 'day.rolled': 'M0',
  'profile.changed': 'M0', 'surface.generated': 'M5', 'chat.turn_ended': 'M0', 'nudge.shown': 'M6',
}
