// On-device research is the default. Sending anything waits for a production-signed study.
// An explicit "off" is remembered. The old implicit default is not.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from '../../sys/fs.ts'
import { join } from '../../sys/path.ts'
import type { ScienceMode } from '../contracts/science.ts'
import { readProfile } from '../profile.ts'
import { SIM_KEY_ID } from './verify.ts'

export interface SciencePref { user_set: boolean; mode: ScienceMode; at: string }
export interface InviteState { declined_at?: string; joined?: boolean }

const DAY_MS = 24 * 60 * 60 * 1000
export const DECLINE_COOLDOWN_DAYS = 30
export const OUTBOX_WAITING_ZH = '研究正式开始后才会发出，现在只保存在你的设备上。'

function prefPath(dataDir: string): string {
  return join(dataDir, 'science', 'preference.json')
}

function invitePath(dataDir: string): string {
  return join(dataDir, 'science', 'invite.json')
}

export function readSciencePref(dataDir: string): SciencePref | null {
  try {
    if (!dataDir || !existsSync(prefPath(dataDir))) return null
    const row = JSON.parse(readFileSync(prefPath(dataDir), 'utf8')) as SciencePref
    if (!row || row.user_set !== true) return null
    if (row.mode !== 'off' && row.mode !== 'local' && row.mode !== 'simulated' && row.mode !== 'live') return null
    return row
  } catch {
    return null
  }
}

export function writeSciencePref(dataDir: string, mode: ScienceMode, at = new Date().toISOString()): SciencePref {
  const row: SciencePref = { user_set: true, mode, at }
  mkdirSync(join(dataDir, 'science'), { recursive: true })
  writeFileSync(prefPath(dataDir), JSON.stringify(row))
  return row
}

export function personAge(dataDir: string): number | null {
  try {
    const age = readProfile(dataDir).age
    return typeof age === 'number' && Number.isFinite(age) ? age : null
  } catch {
    return null
  }
}

export function isMinorProfile(dataDir: string): boolean {
  const age = personAge(dataDir)
  return age != null && age < 18
}

/**
 * Old installs stored scienceMode "off" because that was the schema default.
 * Without an explicit user-set marker, that row moves to the new default.
 * A person who turned it off keeps the marker and stays off. Minors stay off.
 */
export function resolveRunningMode(configMode: ScienceMode | undefined, userSetFlag: boolean, dataDir: string): ScienceMode {
  if (dataDir && isMinorProfile(dataDir)) return 'off'
  const pref = dataDir ? readSciencePref(dataDir) : null
  if (pref?.user_set) return pref.mode === 'live' ? 'live' : pref.mode
  if ((configMode == null || configMode === 'off') && !userSetFlag) return 'local'
  if (configMode === 'local' || configMode === 'simulated' || configMode === 'live' || configMode === 'off') return configMode
  return 'local'
}

export function readInvite(dataDir: string): InviteState {
  try {
    if (!existsSync(invitePath(dataDir))) return {}
    const row = JSON.parse(readFileSync(invitePath(dataDir), 'utf8')) as InviteState
    return row && typeof row === 'object' ? row : {}
  } catch {
    return {}
  }
}

export function writeInvite(dataDir: string, row: InviteState): InviteState {
  mkdirSync(join(dataDir, 'science'), { recursive: true })
  writeFileSync(invitePath(dataDir), JSON.stringify(row))
  return row
}

export function declineInvite(dataDir: string, at = new Date().toISOString()): InviteState {
  return writeInvite(dataDir, { ...readInvite(dataDir), declined_at: at })
}

/** True when the invitation may be shown. Declining hides it for 30 days. Joining hides it too. */
export function inviteVisible(input: { dataDir: string; mode: ScienceMode; today?: string }): boolean {
  if (input.mode === 'off') return false
  if (isMinorProfile(input.dataDir)) return false
  const age = personAge(input.dataDir)
  if (age == null) return false
  const state = readInvite(input.dataDir)
  if (state.joined) return false
  if (!state.declined_at) return true
  const today = input.today ? Date.parse(`${input.today.slice(0, 10)}T12:00:00Z`) : Date.now()
  const declined = Date.parse(state.declined_at)
  if (!Number.isFinite(declined) || !Number.isFinite(today)) return true
  return today - declined >= DECLINE_COOLDOWN_DAYS * DAY_MS
}

/** Nothing is handed to the network until a study is on a feed signed by the production key. */
export function mayTransmit(input: { published: boolean; keyId: string | null | undefined }): { ok: boolean; reason_zh: string } {
  if (!input.published) return { ok: false, reason_zh: OUTBOX_WAITING_ZH }
  if (!input.keyId || input.keyId === SIM_KEY_ID) return { ok: false, reason_zh: OUTBOX_WAITING_ZH }
  return { ok: true, reason_zh: '' }
}

export { OUTBOX_WAITING_ZH as WAITING_ZH }
