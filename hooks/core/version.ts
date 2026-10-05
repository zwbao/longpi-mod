/** The LongPi core this mod carries (dsh-plugin-longpi 0.8.0, Codex 1.3), as ported to Claude Code. */
export const PRODUCT_VERSION = '0.8.0'
export const MOD_VERSION = '0.1.4'
export const PRODUCT_NAME = 'longpi'

export const TOOL_NAMES = [
  'read_personal_situation',
  'list_longevity_intents',
  'match_longevity_skills',
  'read_longevity_skill',
  'run_longevity_skill',
  'query_longevity_evidence',
  'list_longevity_domains',
  'save_personal_profile',
  'longpi_status',
  'save_intervention_plan',
  'draft_intervention_plan',
  'log_intervention_checkin',
  'save_self_measurement',
  'record_medication_statement',
  'read_intervention_plan',
  'review_interventions',
  'model_intervention_goals',
  'set_followup',
  'send_followup_message',
  // 0.5.3 (M0 memory, M1 care navigation)
  'read_person_memory',
  'remember_for_me',
  'note_page_issue',
  'read_care_navigation',
  'prepare_doctor_brief',
  'log_care_visit',
  // 0.7.0 (M12 deep analysis)
  'run_deep_analysis',
  'import_analysis',
  'read_deep_analysis',
  'import_member_file',
] as const

export type ToolName = (typeof TOOL_NAMES)[number]

export const HARNESS_SKILLS = [
  'longpi-dispatch',
  'longpi-board',
  'longpi-boundary',
  'longpi-interventions',
] as const

/**
 * Model-facing tool names reserved at C0 (AA §3.4), by owning module. A name moves into TOOL_NAMES
 * only when its tool is registered.
 */
export const RESERVED_TOOL_NAMES = {
  M0: ['read_person_memory', 'remember_for_me', 'note_page_issue', 'consult_longpi_specialist'],
  M1: ['read_care_navigation', 'prepare_doctor_brief', 'log_care_visit'],
  M4: ['read_progress_feedback'],
  M6: ['log_life_event', 'read_season'],
  M7: ['forward_report', 'record_condition', 'read_narrative_findings'],
  M8: ['list_studies', 'explain_study', 'design_n_of_1', 'log_n_of_1_outcome', 'record_study_consent', 'withdraw_from_study'],
} as const

/** HTTP routes reserved at C0 (AA §3.4), by owning module. */
export const RESERVED_ROUTES = {
  M0: ['GET /api/longpi/memory', 'POST /api/longpi/memory', 'GET /api/longpi/events', 'GET /api/longpi/usage'],
  M1: ['GET /api/longpi/triage', 'GET /api/longpi/brief', 'POST /api/longpi/brief', 'POST /api/longpi/care-visit'],
  M4: ['GET /api/longpi/feedback'],
  M5: ['GET /api/longpi/surfaces'],
  M6: ['GET /api/longpi/codex', 'POST /api/longpi/codex', 'GET /api/longpi/codex/library', 'GET /api/longpi/codex/slot', 'GET /api/longpi/schedule', 'POST /api/longpi/schedule'],
  M7: ['POST /api/longpi/upload', 'GET /api/longpi/findings', 'GET /api/longpi/meds', 'POST /api/longpi/meds', 'GET /api/longpi/conditions', 'POST /api/longpi/conditions', 'GET /api/longpi/stores'],
  M8: ['GET /api/longpi/science/studies', 'POST /api/longpi/science/consent', 'POST /api/longpi/science/withdraw', 'POST /api/longpi/science/run', 'GET /api/longpi/science/translog', 'GET /api/longpi/science/community', 'GET /api/longpi/science/registry', 'GET /api/longpi/science/transparency', 'POST /api/longpi/science/n-of-1', 'POST /api/longpi/science/export', 'GET /api/longpi/science/invite', 'POST /api/longpi/science/invite', 'POST /api/longpi/science/preference'],
  M11: ['GET /api/longpi/privacy', 'POST /api/longpi/privacy/consent', 'GET /api/longpi/privacy/export', 'POST /api/longpi/privacy/delete'],
} as const

/** Harness skills reserved for later modules (AA §3.4); HARNESS_SKILLS lists the ones registered. */
export const RESERVED_SKILLS = ['longpi-care', 'longpi-feedback', 'longpi-seasons', 'longpi-data-in', 'longpi-science'] as const

/** Always-on prompt sections (agent-scoped). Orders 22–29 need the integrator. */
export const PROMPT_SECTIONS = { orchestrator: { name: 'longpi:orchestrator', order: 20 }, safety: { name: 'longpi:safety', order: 21 } } as const
