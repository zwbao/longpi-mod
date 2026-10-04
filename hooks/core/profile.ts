import { process } from '../sys/process.ts'
import { randomBytes } from '../sys/crypto.ts'
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from '../sys/fs.ts'
import { dirname, join } from '../sys/path.ts'

export const SEXES = ['female', 'male', 'other', 'unknown'] as const
export type Sex = (typeof SEXES)[number]

/**
 * Yes/no facts a risk equation needs and a record does not hold (China-PAR).
 * The person states them; absent means not stated, never "no".
 */
export const RISK_FACTS = ['smoker', 'diabetes', 'bp_treated', 'north', 'urban', 'family_history'] as const
export type RiskFact = (typeof RISK_FACTS)[number]
export const RISK_FACT_ZH: Record<RiskFact, string> = {
  smoker: '现在吸烟',
  diabetes: '有糖尿病（空腹血糖 ≥7.0 mmol/L 或在用降糖药）',
  bp_treated: '两周内用过降压药',
  north: '住在北方（长江以北）',
  urban: '住在城市',
  family_history: '父母或兄弟姐妹有心梗或脑卒中',
}

/** Bump when the first-run notice changes, so the person reads the new one before it counts as accepted. */
export const CONSENT_VERSION = '2026-09-24'

/** What the person cares about most, in their order: used to order results and suggestions. */
export const FOCUS = ['bioage', 'cardio', 'glucose', 'weight', 'sleep', 'plan'] as const
export type Focus = (typeof FOCUS)[number]
export const FOCUS_ZH: Record<Focus, string> = {
  bioage: '身体年龄',
  cardio: '心血管',
  glucose: '血糖',
  weight: '体重',
  sleep: '睡眠',
  plan: '方案效果',
}

export interface Consent {
  version: string
  accepted_at: string
}

/** One separate act (PIPL sensitive information, DeepSeek data flow, or session-log upload). */
export interface PrivacyAct {
  version: string
  decision: 'granted' | 'declined' | 'withdrawn'
  at: string
}

/** Mirrors of privacy/consents.jsonl. The log is the source of truth; this is what a profile read shows. */
export interface ProfileConsents {
  pipl_sensitive: PrivacyAct | null
  data_flow_deepseek: PrivacyAct | null
  session_log_upload: PrivacyAct | null
}

export function emptyConsents(): ProfileConsents {
  return { pipl_sensitive: null, data_flow_deepseek: null, session_log_upload: null }
}

export interface Profile {
  displayName: string
  birthYear: number | null
  age: number | null
  sex: Sex
  risk: Partial<Record<RiskFact, boolean>>
  /** Facts they explicitly called 不确定. Missing means never asked, and is not stored as false. */
  riskUnknown?: RiskFact[]
  focus: Focus[]
  /** The first-run product notice. Not the PIPL sensitive-information act. */
  consent: Consent | null
  /** Separate acts. Absent on a file written before 0.5.x privacy means none of them is decided. */
  consents: ProfileConsents
  /** Set when the labs belong to someone else (a parent). Calculators use this age and sex. */
  subject?: { relationship_zh: string; age: number | null; sex: Sex } | null
}

export const EMPTY_PROFILE: Profile = {
  displayName: '',
  birthYear: null,
  age: null,
  sex: 'unknown',
  risk: {},
  focus: [],
  consent: null,
  consents: emptyConsents(),
}

function emptyProfile(): Profile {
  return { ...EMPTY_PROFILE, risk: {}, focus: [], consents: emptyConsents() }
}

type Failure = { ok: false; error: string }
type IntResult = { ok: true; value: number | null } | Failure

function optionalInt(value: unknown, min: number, max: number, label: string): IntResult {
  if (value == null || value === '') return { ok: true, value: null }
  const number = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() ? Number(value) : Number.NaN)
  if (!Number.isInteger(number) || number < min || number > max) {
    return { ok: false, error: `${label} must be an integer from ${min} to ${max}` }
  }
  return { ok: true, value: number }
}

export function normalizeProfile(input: unknown): { ok: true; profile: Profile } | Failure {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'profile must be an object' }
  }
  const raw = input as Record<string, unknown>
  for (const key of Object.keys(raw)) {
    if (!['displayName', 'birthYear', 'age', 'sex', 'risk', 'riskUnknown', 'focus', 'consent', 'consents', 'subject'].includes(key)) {
      return { ok: false, error: `unknown field ${key}` }
    }
  }
  let displayName = ''
  if (raw.displayName != null && raw.displayName !== '') {
    if (typeof raw.displayName !== 'string') return { ok: false, error: 'displayName must be a string' }
    displayName = raw.displayName.trim()
    if (displayName.length > 40) return { ok: false, error: 'displayName is longer than 40 characters' }
    if (/[\u0000-\u001f]/.test(displayName)) return { ok: false, error: 'displayName has control characters' }
  }
  const birthYear = optionalInt(raw.birthYear, 1900, 2100, 'birthYear')
  if (!birthYear.ok) return birthYear
  const age = optionalInt(raw.age, 0, 130, 'age')
  if (!age.ok) return age
  let sex: Sex = 'unknown'
  if (raw.sex != null && raw.sex !== '') {
    if (typeof raw.sex !== 'string' || !SEXES.includes(raw.sex as Sex)) {
      return { ok: false, error: 'sex must be female, male, other, or unknown' }
    }
    sex = raw.sex as Sex
  }
  const risk: Profile['risk'] = {}
  if (raw.risk != null) {
    if (typeof raw.risk !== 'object' || Array.isArray(raw.risk)) return { ok: false, error: 'risk must be an object of yes/no facts' }
    for (const [key, value] of Object.entries(raw.risk as Record<string, unknown>)) {
      if (!(RISK_FACTS as readonly string[]).includes(key)) return { ok: false, error: `unknown risk fact ${key}` }
      if (value == null || value === '') continue
      if (typeof value !== 'boolean') return { ok: false, error: `${key} must be true, false, or empty` }
      risk[key as RiskFact] = value
    }
  }
  const riskUnknown = riskUnknownOf(raw.riskUnknown)
  if (!riskUnknown.ok) return riskUnknown
  const focus = focusOf(raw.focus)
  if (!focus.ok) return focus
  const consent = consentOf(raw.consent)
  if (!consent.ok) return consent
  const consents = consentsOf(raw.consents)
  if (!consents.ok) return consents
  // 0.8.0: whose record this is never comes from the profile any more (each family member has a record of their
  // own). A subject written by 0.7 from a sentence about 我妈 / 我爸 is accepted and dropped, so it is gone on read.
  const subject = subjectOf(raw.subject)
  if (!subject.ok) return subject
  return {
    ok: true,
    profile: {
      displayName, birthYear: birthYear.value, age: age.value, sex, risk, focus: focus.value, consent: consent.value, consents: consents.value,
      ...(riskUnknown.value.length > 0 ? { riskUnknown: riskUnknown.value } : {}),
    },
  }
}

function subjectOf(value: unknown): { ok: true; value: Profile['subject'] } | Failure {
  if (value == null) return { ok: true, value: null }
  if (typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'subject must be an object' }
  const raw = value as Record<string, unknown>
  const relationship = typeof raw.relationship_zh === 'string' ? raw.relationship_zh.trim() : ''
  if (!relationship || relationship.length > 20) return { ok: false, error: 'subject.relationship_zh is required' }
  const age = optionalInt(raw.age, 0, 130, 'subject.age')
  if (!age.ok) return age
  let sex: Sex = 'unknown'
  if (raw.sex != null && raw.sex !== '') {
    if (typeof raw.sex !== 'string' || !SEXES.includes(raw.sex as Sex)) return { ok: false, error: 'subject.sex must be female, male, other, or unknown' }
    sex = raw.sex as Sex
  }
  return { ok: true, value: { relationship_zh: relationship, age: age.value, sex } }
}

function riskUnknownOf(value: unknown): { ok: true; value: RiskFact[] } | Failure {
  if (value == null || value === '') return { ok: true, value: [] }
  if (!Array.isArray(value)) return { ok: false, error: 'riskUnknown must be a list of risk facts' }
  const out: RiskFact[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !(RISK_FACTS as readonly string[]).includes(item)) return { ok: false, error: `unknown risk fact ${String(item)}` }
    if (!out.includes(item as RiskFact)) out.push(item as RiskFact)
  }
  return { ok: true, value: out }
}

function focusOf(value: unknown): { ok: true; value: Focus[] } | Failure {
  if (value == null || value === '') return { ok: true, value: [] }
  if (!Array.isArray(value)) return { ok: false, error: `focus must be a list of ${FOCUS.join(', ')}` }
  const out: Focus[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !(FOCUS as readonly string[]).includes(item)) {
      return { ok: false, error: `unknown focus ${String(item)}; use ${FOCUS.join(', ')}` }
    }
    if (!out.includes(item as Focus)) out.push(item as Focus)
  }
  return { ok: true, value: out.slice(0, FOCUS.length) }
}

function consentOf(value: unknown): { ok: true; value: Consent | null } | Failure {
  if (value == null) return { ok: true, value: null }
  if (typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'consent must be null or {version, accepted_at}' }
  const { version, accepted_at: acceptedAt } = value as Record<string, unknown>
  if (typeof version !== 'string' || !version.trim()) return { ok: false, error: 'consent.version must be a non-empty string' }
  if (typeof acceptedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(acceptedAt) || Number.isNaN(Date.parse(acceptedAt))) {
    return { ok: false, error: 'consent.accepted_at must be an ISO date-time' }
  }
  return { ok: true, value: { version: version.trim(), accepted_at: acceptedAt } }
}

const PRIVACY_SCOPES = ['pipl_sensitive', 'data_flow_deepseek', 'session_log_upload'] as const
const PRIVACY_DECISIONS = ['granted', 'declined', 'withdrawn'] as const

function actOf(value: unknown, label: string): { ok: true; value: PrivacyAct | null } | Failure {
  if (value == null) return { ok: true, value: null }
  if (typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: `${label} must be null or {version, decision, at}` }
  const raw = value as Record<string, unknown>
  if (typeof raw.version !== 'string' || !raw.version.trim()) return { ok: false, error: `${label}.version must be a non-empty string` }
  if (typeof raw.decision !== 'string' || !(PRIVACY_DECISIONS as readonly string[]).includes(raw.decision)) {
    return { ok: false, error: `${label}.decision must be granted, declined, or withdrawn` }
  }
  if (typeof raw.at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(raw.at) || Number.isNaN(Date.parse(raw.at))) {
    return { ok: false, error: `${label}.at must be an ISO date-time` }
  }
  return { ok: true, value: { version: raw.version.trim(), decision: raw.decision as PrivacyAct['decision'], at: raw.at } }
}

/** A missing or unreadable block is "not decided", so an older profile file still loads. */
function consentsOf(value: unknown): { ok: true; value: ProfileConsents } | Failure {
  const empty = emptyConsents()
  if (value == null) return { ok: true, value: empty }
  if (typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'consents must be an object' }
  const raw = value as Record<string, unknown>
  for (const key of Object.keys(raw)) {
    if (!(PRIVACY_SCOPES as readonly string[]).includes(key)) return { ok: false, error: `unknown consent scope ${key}` }
  }
  for (const scope of PRIVACY_SCOPES) {
    const act = actOf(raw[scope], `consents.${scope}`)
    if (!act.ok) return act
    empty[scope] = act.value
  }
  return { ok: true, value: empty }
}

/**
 * Apply a partial update: fields that are absent keep their saved value; a risk fact set to null is cleared.
 * consent in the update is ignored: only the person accepts the notice, through setConsent.
 */
export function mergeProfile(current: Profile, update: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...current, risk: { ...current.risk }, focus: [...current.focus] }
  const unknown = new Set<RiskFact>(current.riskUnknown ?? [])
  for (const key of ['displayName', 'birthYear', 'age', 'sex', 'focus', 'subject'] as const) {
    if (key in update) merged[key] = update[key]
  }
  if (update.risk && typeof update.risk === 'object' && !Array.isArray(update.risk)) {
    const risk = merged.risk as Record<string, unknown>
    for (const [key, value] of Object.entries(update.risk as Record<string, unknown>)) {
      if (!(RISK_FACTS as readonly string[]).includes(key)) continue
      const fact = key as RiskFact
      if (value == null || value === '') {
        delete risk[key]
        unknown.add(fact)
      } else {
        risk[key] = value
        unknown.delete(fact)
      }
    }
  }
  if (unknown.size > 0) merged.riskUnknown = [...unknown]
  else delete merged.riskUnknown
  return merged
}

export function estimatedAge(birthYear: number | null, nowYear: number): number | null {
  if (birthYear == null) return null
  const age = nowYear - birthYear
  if (age < 0 || age > 130) return null
  return age
}

function profilePath(dataDir: string): string {
  return join(dataDir, 'profile.json')
}

export function readProfile(dataDir: string): Profile {
  const path = profilePath(dataDir)
  if (!existsSync(path)) return emptyProfile()
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    const normalized = normalizeProfile(parsed)
    return normalized.ok ? normalized.profile : emptyProfile()
  } catch {
    return emptyProfile()
  }
}

export const PROFILE_DAMAGED = 'profile.json is damaged and was not overwritten'

/** True when a profile file exists but cannot be read back as a profile. */
function profileDamaged(dataDir: string): boolean {
  const path = profilePath(dataDir)
  if (!existsSync(path)) return false
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    return !normalizeProfile(parsed).ok
  } catch {
    return true
  }
}

export function writeProfile(dataDir: string, profile: Profile): void {
  const path = profilePath(dataDir)
  // A torn or rejected file still holds the last good bytes. Replacing it with an empty merge loses them.
  if (profileDamaged(dataDir)) throw new Error(PROFILE_DAMAGED)
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const tmp = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  writeFileSync(tmp, `${JSON.stringify(profile, null, 2)}\n`, { mode: 0o600 })
  chmodSync(tmp, 0o600)
  renameSync(tmp, path)
}

/** Record that the person accepted (or withdrew from) the current first-run notice. Never called on the model's word. */
export function setConsent(dataDir: string, accept: boolean, now: Date = new Date()): Consent | null {
  const consent = accept ? { version: CONSENT_VERSION, accepted_at: now.toISOString() } : null
  writeProfile(dataDir, { ...readProfile(dataDir), consent })
  return consent
}

/** The privacy screen stated an age. Does not touch the first-run notice or the separate acts. */
export function setStatedAge(dataDir: string, age: number): void {
  writeProfile(dataDir, { ...readProfile(dataDir), age })
}

/** Mirror one separate act onto the profile. The append-only log remains the source of truth. */
export function setPrivacyAct(dataDir: string, scope: keyof ProfileConsents, act: PrivacyAct | null): void {
  const current = readProfile(dataDir)
  writeProfile(dataDir, { ...current, consents: { ...current.consents, [scope]: act } })
}
