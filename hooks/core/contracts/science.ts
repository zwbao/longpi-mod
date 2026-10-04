// AI for Science (AA §3.3). Owner M8 may amend once before its first merge. Nothing runs while scienceMode is 'off'.

import type { Id, IsoTime } from './common.ts'
import type { ConditionFlag, DrugClass } from './memory.ts'

export type ScienceMode = 'off' | 'local' | 'simulated' | 'live'
export interface StudyManifest {
  schema: 'longpi.study/1'; id: string; version: string
  title_zh: string; summary_zh: string
  kind: 'n_of_1' | 'observational' | 'community_season'
  sponsor: { name: string; contact: string }
  ethics: { committee: string | null; approval_id: string | null; registry: { name: 'ChiCTR' | 'none'; id: string | null } }
  eligibility: {
    age: [number, number]; sex?: Array<'female' | 'male'>; require?: ConditionFlag[]
    exclude_conditions?: ConditionFlag[]; exclude_drug_classes?: DrugClass[]; minors: false
  }
  data: {
    inputs: Array<{ key: string; source: 'record' | 'self' | 'wearable' | 'checkin' | 'chat_outcome'; loinc?: string; window_days: number }>
    /** Must include 'genetics'. */
    excluded: Array<'genetics' | 'free_text' | 'identifiers' | 'images'>
  }
  protocol?: {
    arms?: Array<{ id: string; label_zh: string }>; weeks: number; block_days?: number; crossover?: boolean
    outcome: { key: string; unit: string; better: 'lower' | 'higher' }
  }
  analysis: {
    local: Array<{ stat: 'count' | 'mean' | 'var' | 'mean_diff' | 'hist' | 'paired_t' | 'rcv_calibration'; key: string; params?: Record<string, number | string> }>
    release: {
      dp: { mechanism: 'gaussian' | 'laplace'; epsilon: number; delta: number; clip: [number, number] }
      aggregation: 'secure_sum'; min_cohort: number
    }
  }
  consent: {
    text_version: string; text_zh_sha256: string; withdraw: 'any_time'; after_withdraw: 'delete_unreleased'
    comprehension: Array<{ id: string; question_zh: string; options_zh: string[]; correct: number }>
  }
  give_back: { participant_zh: string; community: boolean }
  /** Simulated mode: must be http://127.0.0.1:* or localhost. */
  endpoints: { aggregator: string }
  /** Over the canonical JSON without `signature`. */
  signature: { alg: 'ed25519'; key_id: string; sig: string }
}
export interface ConsentRecord {
  id: Id
  scope: 'study' | 'pipl_sensitive' | 'data_flow_deepseek' | 'session_log_upload'
  study_id?: string; manifest_version?: string; manifest_sha256?: string
  decision: 'granted' | 'declined' | 'withdrawn'
  at: IsoTime; mode: ScienceMode; text_version: string
  explained_by: 'agent' | 'page'; session_id?: string
  comprehension?: { asked: number; correct: number; passed: boolean; attempts: number }
  withdrawal?: { at: IsoTime; deleted_unreleased: boolean }
  translog_seq: number
}
export interface LocalStatResult {
  id: Id; study_id: string; manifest_version: string; run_id: Id; at: IsoTime; mode: ScienceMode
  n_local: number
  stats: Array<{ stat: string; key: string; value: number[]; clipped: boolean }>
  dp: { mechanism: string; epsilon_spent: number; delta: number; noise_commitment: string }
  share: { round: string; masked_b64: string; commitment: string } | null
  released: boolean; translog_seq: number
  raw_values_left_device: false
}
export interface TransparencyLogEntry {
  seq: number; at: IsoTime
  kind: 'manifest_verified' | 'manifest_rejected' | 'consent' | 'withdraw' | 'run' | 'release' | 'result_received' | 'mode_changed'
  /** sha256 chain. */
  study_id?: string; digest: string; prev: string
  detail_zh: string
}
