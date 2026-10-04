// Separate consent records (AA §3.5 privacy/consents.jsonl). The log is the source of truth.
// profile.json only mirrors the three product acts so a profile read shows the same decision.

import { join } from '../../sys/path.ts'
import type { ConsentRecord } from '../contracts/science.ts'
import type { ScienceMode } from '../contracts/science.ts'
import { appendJsonl, newId, readJsonl } from '../core/store.ts'
import { estimatedAge, readProfile, setPrivacyAct, setStatedAge, type PrivacyAct, type Profile } from '../profile.ts'

export const ADULT_AGE = 18
export const CHILD_AGE = 14
export const MINOR_PREFERENCE_ZH = '未满 18 岁，不开启长寿图鉴'

const PRODUCT_SCOPES = ['pipl_sensitive', 'data_flow_deepseek', 'session_log_upload'] as const
type ProductScope = (typeof PRODUCT_SCOPES)[number]

export interface StoredConsent extends ConsentRecord {
  guardian?: boolean
}

export interface MinorView {
  age: number | null
  known: boolean
  /** Under 18: Codex off, no weight-loss items. */
  minor: boolean
  /** Under 14: PIPL also needs a guardian's separate yes. */
  child: boolean
  ask_age: boolean
  /** Age known and adult. The engage.codex switch is applied by the caller. */
  codex: boolean
  weight_loss: boolean
}

function logPath(dataDir: string): string {
  return join(dataDir, 'privacy', 'consents.jsonl')
}

function scienceLogPath(dataDir: string): string {
  return join(dataDir, 'science', 'consents.jsonl')
}

function isScope(value: string): value is ConsentRecord['scope'] {
  return value === 'study' || (PRODUCT_SCOPES as readonly string[]).includes(value)
}

function parseRow(raw: unknown): StoredConsent | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const scope = typeof row.scope === 'string' && isScope(row.scope) ? row.scope : (typeof row.study_id === 'string' ? 'study' as const : null)
  if (!scope) return null
  if (row.decision !== 'granted' && row.decision !== 'declined' && row.decision !== 'withdrawn') return null
  if (typeof row.at !== 'string') return null
  const mode: ScienceMode = row.mode === 'simulated' || row.mode === 'live' || row.mode === 'local' ? row.mode : 'off'
  return {
    id: typeof row.id === 'string' ? row.id : 'consent-legacy',
    scope,
    ...(typeof row.study_id === 'string' ? { study_id: row.study_id } : {}),
    decision: row.decision,
    at: row.at,
    mode,
    text_version: typeof row.text_version === 'string' ? row.text_version : '',
    explained_by: row.explained_by === 'agent' ? 'agent' : 'page',
    ...(typeof row.session_id === 'string' ? { session_id: row.session_id } : {}),
    translog_seq: typeof row.translog_seq === 'number' ? row.translog_seq : 0,
    ...(row.guardian === true ? { guardian: true } : {}),
  }
}

function rowsOf(dataDir: string, scope: ConsentRecord['scope']): StoredConsent[] {
  const own = readJsonl(logPath(dataDir), parseRow).filter((row) => row.scope === scope)
  if (scope !== 'study') return own
  const extra = readJsonl(scienceLogPath(dataDir), parseRow).filter((row) => row.scope === 'study')
  return [...own, ...extra].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
}

/** The latest act for this scope, or null when the person has not been asked. */
export function latestConsent(dataDir: string, scope: ConsentRecord['scope']): StoredConsent | null {
  const rows = rowsOf(dataDir, scope)
  return rows[rows.length - 1] ?? null
}

/** True only when the latest act is an explicit grant. The C0 stub was false; no record stays false. */
export function isGranted(dataDir: string, scope: ConsentRecord['scope']): boolean {
  return latestConsent(dataDir, scope)?.decision === 'granted'
}

export function resolvedAge(profile: Profile, now = new Date()): number | null {
  if (typeof profile.age === 'number') return profile.age
  const year = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(now))
  return estimatedAge(profile.birthYear, year)
}

export function minorView(profile: Profile, now = new Date()): MinorView {
  const age = resolvedAge(profile, now)
  const known = age != null
  const minor = known && age < ADULT_AGE
  return {
    age,
    known,
    minor,
    child: known && age < CHILD_AGE,
    ask_age: !known,
    codex: known && !minor,
    weight_loss: !minor,
  }
}

export interface RecordInput {
  scope: ConsentRecord['scope']
  decision: ConsentRecord['decision']
  textVersion: string
  mode: ScienceMode
  guardian?: boolean
  sessionId?: string
  now?: Date
}

/** Append one act and mirror product scopes onto the profile. */
export function recordConsent(dataDir: string, input: RecordInput): StoredConsent {
  const at = (input.now ?? new Date()).toISOString()
  const row: StoredConsent = {
    id: newId('consent'),
    scope: input.scope,
    decision: input.decision,
    at,
    mode: input.mode,
    text_version: input.textVersion,
    explained_by: 'page',
    translog_seq: 0,
    ...(input.sessionId ? { session_id: input.sessionId } : {}),
    ...(input.guardian ? { guardian: true } : {}),
  }
  appendJsonl(logPath(dataDir), row)
  if ((PRODUCT_SCOPES as readonly string[]).includes(input.scope)) {
    const act: PrivacyAct = { version: input.textVersion, decision: input.decision, at }
    setPrivacyAct(dataDir, input.scope as ProductScope, act)
  }
  return row
}

export function rememberAge(dataDir: string, age: number): void {
  setStatedAge(dataDir, age)
}
