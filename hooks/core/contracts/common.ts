// Shared primitive types (AA §3.3). Frozen at C0: change only through the integrator.

export type IsoDay = string            // 'YYYY-MM-DD', China civil day (interventions.ts CIVIL_TZ)
export type IsoTime = string           // RFC 3339 with offset
export type Id = string                // [a-z0-9][a-z0-9-]{5,63}
export type ModuleId = 'M0' | 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8' | 'M9' | 'M10' | 'M11' | 'M12' | 'M13'
export type Focus = 'bioage' | 'cardio' | 'glucose' | 'weight' | 'sleep' | 'plan'   // = profile.ts FOCUS

export interface Provenance {
  kind: 'chat' | 'page' | 'record' | 'import' | 'model_extracted' | 'rule' | 'migration'
  at: IsoTime
  session_id?: string
  turn?: number
  /** The person's own words, at most 200 characters. */
  quote_zh?: string
  by: ModuleId
}

/** Every number any generator may put in text. Formatting belongs to M9 (honesty/format.ts). */
export interface NumberRef {
  /** Stable: 'hgb@2026-09-21', 'phenoage.advance', 'ferritin.latest'. */
  key: string
  label_zh: string
  value: number
  unit: string
  date: IsoDay | null
  source: 'record' | 'self' | 'skill' | 'rcv' | 'memory' | 'derived'
  /** Canonical formatted form the validator accepts, e.g. '8.0 ng/mL'. */
  text: string
}

export interface TokenUsage { inputTokens: number; outputTokens: number; cacheReadTokens?: number; reasoningTokens?: number }
