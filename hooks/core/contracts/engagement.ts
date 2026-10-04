// Seasons (docs/codex-design.md 1.2 §3.2): 8 weeks, or until the next retest. A season holds 2–4 personal
// experiments; there are no quests, unlocks, streaks or draws.

import type { Id, IsoDay } from './common.ts'

export interface Season {
  id: Id
  mode: '8w' | 'retest'
  start: IsoDay
  /** Planned end; a season in retest mode also ends when a new checkup arrives. */
  end: IsoDay
  status: 'active' | 'closed'
  closed: IsoDay | null
}
