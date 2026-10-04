// The shape GET analysis answers (core/analysis/routes.ts, service.ts), as client/analysis.ts reads it.
import type { Readout } from './format.ts'

export interface Stage { key: string; label_zh: string; done: boolean }
export interface Run { id: string; started_at: string; stages: Stage[]; done: number; report_ready: boolean; active: boolean; state_error: string | null; trigger: 'ai' | 'member'; reason_zh: string }
export interface Readiness {
  why_zh: string; auto_on: boolean; auto_allowed: boolean; last_analysis: string | null; newest_record: string | null; newest_file: string | null
  folder: string | null; new_data?: boolean; newest?: string | null
}
export interface BoardRow { id: string; title_zh: string; verdict_zh: string; confidence: string | null; summary_zh: string | null; next_step_zh: string | null; limitations_zh?: string | null }
export interface OrganRow { organ: string; label_zh: string; measured: Readout[]; indices: Readout[]; ai_age: Readout | null; ai_risks: Readout[]; overrides: Array<{ disease: string; message_zh: string }> }
export interface DoctorItem { title: string; detail: string; kind_zh: string }
export interface CompareRow { marker: string; prev: unknown; cur: unknown; unit: string; change_pct: number | null; verdict: string; caveat: string | null }
export type Compare =
  | { ok: true; prev_imported_at: string; prev_sample_date: string | null; alerts: string[]; rows: CompareRow[]; not_judged: number }
  | { ok: false; error_zh: string }
export interface Current {
  run_id: string; imported_at: string; plan_accepted_version: number | null
  member?: { age?: number; sex?: string; sample_date?: string }
  readouts: Readout[]; organs: OrganRow[]; board: BoardRow[]
  doctor_items?: DoctorItem[]; compare?: Compare | null
  retests: Array<{ what: string; after_weeks: number; due: string }>; boundary_zh: string
}
export interface ReadBack { ok: boolean; run_id: string | null; plan_key: string | null; title: string; items: Array<{ id: string; category: string; title: string; detail: string; markers: string[] }>; warnings: string[]; errors: string[] }
export interface Status { ok: boolean; runs: Run[]; current: Current | null; plan_read_back: ReadBack | null; blockers: { reply_zh: string; missing: string } | null; readiness: Readiness | null; cost_zh: string }
