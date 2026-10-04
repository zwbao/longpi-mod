import { process } from '../sys/process.ts'
// Pi, the coach: the longevity-coach skill installed beside LongPi (DSH discovers it in DSH_HOME/skills). LongPi
// speaks with Pi's voice either way; when the skill is there the model can open it for the full coaching method.

import { existsSync, readFileSync } from '../sys/fs.ts'
import { dirname, join } from '../sys/path.ts'
import { libFile } from '../sys/url.ts'

export const COACH_SKILL_NAME = 'longevity-coach'

let enabled: () => boolean = () => true

/** apply() binds this to the config's coach switch (installer --without-coach writes false). */
export function setCoachEnabled(get: () => boolean): void {
  enabled = get
}

export function coachEnabled(): boolean {
  return enabled()
}

/** In the mod the coach skill ships with it (skills/longevity-coach), so Claude Code lists it as a skill. */
export function coachSkillPath(): string {
  return process.env.LONGPI_COACH_SKILL || join(dirname(dirname(libFile())), 'skills', COACH_SKILL_NAME, 'SKILL.md')
}

/** The installed coach skill's version, or null when it is not installed. */
export function coachSkillVersion(): string | null {
  const path = coachSkillPath()
  if (!existsSync(path)) return null
  try {
    return /\n\s*version:\s*["']?(\d+\.\d+\.\d+)/.exec(readFileSync(path, 'utf8'))?.[1] ?? '0.0.0'
  } catch {
    return null
  }
}
