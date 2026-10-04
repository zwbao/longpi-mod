import { process } from '../sys/process.ts'
// Pi, the coach: the longevity-coach skill installed beside LongPi (DSH discovers it in DSH_HOME/skills). LongPi
// speaks with Pi's voice either way; when the skill is there the model can open it for the full coaching method.

import { existsSync, readFileSync } from '../sys/fs.ts'
import { homedir } from '../sys/os.ts'
import { join } from '../sys/path.ts'

export const COACH_SKILL_NAME = 'longevity-coach'

let enabled: () => boolean = () => true

/** apply() binds this to the config's coach switch (installer --without-coach writes false). */
export function setCoachEnabled(get: () => boolean): void {
  enabled = get
}

export function coachEnabled(): boolean {
  return enabled()
}

export function coachSkillPath(): string {
  return process.env.LONGPI_COACH_SKILL || join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'skills', COACH_SKILL_NAME, 'SKILL.md')
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
