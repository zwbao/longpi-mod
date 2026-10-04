import { process } from '../sys/process.ts'
import { existsSync, readFileSync } from '../sys/fs.ts'
import { homedir } from '../sys/os.ts'
import { basename, dirname, join, resolve } from '../sys/path.ts'
import { fileURLToPath, libFile } from '../sys/url.ts'

/** The mod's own folder (it holds data/ and skills/ as the npm package did). */
function packageRoot(): string {
  return dirname(dirname(libFile()))
}

/** Where LongPi looks for the method library, in order. The mod's session start loads the first that exists. */
export function skillsHomeCandidates(configured: string): string[] {
  return [
    configured,
    process.env.LONGEVITY_SKILLS_HOME ?? '',
    join(homedir(), '.longpi', 'longevity-skills'),
    join(homedir(), 'longpi', 'longevity-skills'),
    join(homedir(), 'longevity-skills'),
    join(homedir(), 'Projects', 'longevity-skills'),
  ].map((item) => item.trim()).filter(Boolean)
}

function firstExisting(candidates: string[], marker: (dir: string) => boolean): string {
  for (const candidate of candidates) {
    const trimmed = candidate.trim()
    if (!trimmed) continue
    const dir = resolve(trimmed)
    if (marker(dir)) return dir
  }
  return ''
}

export function resolveSkillsHome(configured: string): string {
  return firstExisting(skillsHomeCandidates(configured), (dir) => existsSync(join(dir, 'skills')) && existsSync(join(dir, 'catalog.json')))
}

/**
 * The dsh-plugin-mirobody release shipped in this package (`npm run vendor:mirobody`). Installed
 * with `dsh plugin add`, it sits inside the DSH profile, where the host's packages resolve for it.
 */
export function vendoredMirobodyPlugin(): string {
  return join(dirname(libFile()), '..', 'vendor', 'dsh-plugin-mirobody')
}

export function resolveMirobodyPlugin(_configured: string): string {
  // The record lives on this computer (local-record.ts); there is no Mirobody plugin to mount in a mod.
  return ''
}

/** The LongPi home: the account holder's own store, and the people registry (people.json, people/<id>/). */
export function resolveRootDir(configured: string): string {
  const trimmed = (configured ?? '').trim()
  if (trimmed) return resolve(trimmed)
  return join(homedir(), '.longpi')
}

const PERSON_ID = /^p[a-z0-9]{6,40}$/

/**
 * The store of the person being looked at now. The holder ("self") is the LongPi home itself, so an install from
 * before people existed keeps its data; a family member is people/<id>/ under it. Every module reads its files through
 * this, so profile, connection, records, plans, check-ins, memory and deep analyses all follow the person chosen.
 */
export function resolveDataDir(configured: string): string {
  const root = resolveRootDir(configured)
  try {
    const active = (JSON.parse(readFileSync(join(root, 'people.json'), 'utf8')) as { active?: unknown }).active
    if (typeof active === 'string' && PERSON_ID.test(active) && existsSync(join(root, 'people', active))) return join(root, 'people', active)
  } catch {
    /* no registry: the holder */
  }
  return root
}

export function clampMatches(value: number): number {
  if (!Number.isFinite(value)) return 8
  return Math.max(1, Math.min(20, Math.floor(value)))
}
