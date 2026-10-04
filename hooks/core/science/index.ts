// M8 seams (AA §3.6). scienceSummary() stays callable with no arguments. Nothing is written while the mode is off.

import type { FactPack } from '../contracts/factpack.ts'
import type { ScienceMode } from '../contracts/science.ts'
import { readCards, scienceCandidates } from './community.ts'
import { activeStudyIds } from './consent-flow.ts'
import { LIVE_REFUSED_ZH } from './verify.ts'

export interface ScienceState {
  configured: () => ScienceMode
  dataDir: () => string
}

const state: ScienceState = {
  configured: () => 'off',
  dataDir: () => '',
}

export function startScience(next: ScienceState): void {
  state.configured = next.configured
  state.dataDir = next.dataDir
}

export function configuredMode(): ScienceMode {
  try {
    const mode = state.configured()
    return mode === 'live' || mode === 'simulated' || mode === 'local' || mode === 'off' ? mode : 'local'
  } catch {
    return 'local'
  }
}

/**
 * Live still does not collect (D6): the fact pack says off.
 * 'local' is the on-device default. 'simulated' stays for tests.
 */
export function effectiveMode(): 'off' | 'local' | 'simulated' {
  const mode = configuredMode()
  if (mode === 'simulated') return 'simulated'
  if (mode === 'local') return 'local'
  return 'off'
}

export function scienceOpen(): boolean {
  return effectiveMode() !== 'off'
}

export function scienceSummary(): FactPack['science'] {
  const mode = effectiveMode()
  if (mode === 'off') return { mode: 'off', active_studies: 0 }
  const dir = state.dataDir()
  if (!dir) return { mode, active_studies: 0 }
  try {
    return { mode, active_studies: activeStudyIds(dir).length }
  } catch {
    return { mode, active_studies: 0 }
  }
}

export function liveRefused(): { refused: boolean; reason_zh: string } {
  return configuredMode() === 'live' ? { refused: true, reason_zh: LIVE_REFUSED_ZH } : { refused: false, reason_zh: '' }
}

export { scienceCandidates }

/** Cards M6 can show. They name a study, never a biomarker rarity. */
export function contributionCards(): Array<{ id: string; title_zh: string; body_zh: string }> {
  if (!scienceOpen()) return []
  const dir = state.dataDir()
  if (!dir) return []
  try {
    return readCards(dir).map(({ id, title_zh, body_zh }) => ({ id, title_zh, body_zh }))
  } catch {
    return []
  }
}
