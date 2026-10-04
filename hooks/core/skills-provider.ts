// Every longevity-skills method, as a dsh skill provider.
// list is the compact index (blurb, tier, species, when to use).
// get reads SKILL.md when the model opens one method.
// Harness skills stay ahead of a name clash: their runtime rank is 250, and a lower rank wins.

import { readFileSync } from '../sys/fs.ts'
import { join } from '../sys/path.ts'
import type { Context } from '../sys/cordis.ts'
import { loadCatalog, parseFrontmatter, type SkillCard } from './catalog.ts'
import type { SkillIndexEntry } from './contracts/library.ts'
import { resolveSkillsHome } from './paths.ts'

/** Worse than the four LongPi harness skills, so a shared name cannot hide them. */
export const LIBRARY_SKILL_RANK = 800
export const LIBRARY_PROVIDER = 'longpi-library'

const SPECIES_ZH: Record<string, string> = {
  human: '人',
  mouse: '小鼠',
  rat: '大鼠',
  c_elegans: '线虫',
  drosophila: '果蝇',
  naked_mole_rat: '裸鼹鼠',
  planarian: '涡虫',
  butterfly: '蝴蝶',
  bowhead_whale: '弓头鲸',
  zebrafish: '斑马鱼',
  killifish: '青鳉',
  yeast: '酵母',
  cell_line: '细胞',
  multi_species: '多物种',
}

let homeGetter = (): string => resolveSkillsHome('')

/** apply() points this at the profile's skillsHome. Tests use LONGEVITY_SKILLS_HOME. */
export function setLibraryHome(get: () => string): void {
  homeGetter = get
}

export function libraryHome(): string {
  return homeGetter()
}

export function speciesZh(species: readonly string[]): string {
  if (species.length === 0) return ''
  return species.map((item) => SPECIES_ZH[item] ?? item).join('、')
}

/** One line the model can route on. Tier C starts with the species. */
export function whenToUseOf(card: SkillCard): string {
  if (card.tier === 'C') {
    const species = speciesZh(card.species) || '非人类'
    return `${species}证据，不当作这个人的数字`
  }
  if (card.tier === 'tool' || !card.script) return '查文献或外部工具'
  if (card.inputsStatus === 'none' || card.inputs.length === 0) return '读方法说明'
  const bits: string[] = []
  const hay = card.inputs.map((spec) => `${spec.key} ${spec.label_zh} ${spec.note_zh ?? ''}`).join('\n')
  if (card.inputs.some((spec) => (spec.loinc ?? []).length > 0)) bits.push('常规检验')
  if (card.inputs.some((spec) => (spec.device_codes ?? []).length > 0) || /睡眠|sleep/.test(hay)) bits.push('睡眠或可穿戴')
  if (/甲基化|cpg|probe|dnam/i.test(hay)) bits.push('甲基化')
  if (card.inputs.some((spec) => spec.from === 'profile' || spec.from === 'argument')) bits.push('档案')
  if (/ct|影像|agatston|钙化/i.test(`${card.name} ${card.blurb} ${hay}`)) bits.push('影像')
  if (bits.length === 0) bits.push('见输入清单')
  return bits.join('、')
}

/** Always-on catalog line. English descriptions stay out. */
export function catalogDescription(card: SkillCard): string {
  const blurb = (card.blurb || card.name).replace(/\s+/g, ' ').trim()
  if (card.tier === 'C') {
    const species = speciesZh(card.species) || '非人类'
    return `${species}证据。${blurb}`
  }
  const tier = card.tier ? `${card.tier} ` : ''
  return `${tier}${blurb}`.trim()
}

export function indexEntry(card: SkillCard, home: string): SkillIndexEntry {
  return {
    name: card.name,
    blurb: card.blurb || card.name,
    tier: card.tier || '',
    species: speciesZh(card.species),
    whenToUse: whenToUseOf(card),
    locator: home ? join(home, 'skills', card.name) : card.name,
  }
}

/** Every catalog card. Nothing is dropped for tier or species. */
export function listEntries(home = libraryHome()): SkillIndexEntry[] {
  const catalog = loadCatalog(home)
  return catalog.cards.map((card) => indexEntry(card, home || catalog.home))
}

function skillBody(raw: string, card: SkillCard): string {
  let body = raw
  try {
    body = parseFrontmatter(raw).body
  } catch {
    body = raw
  }
  if (card.tier !== 'C') return body
  const species = speciesZh(card.species) || '非人类'
  return `物种：${species}。这是证据，不是这个人的数字。\n\n${body}`
}

export function registerLibrarySkills(ctx: Context, skillsHome: () => string = libraryHome): void {
  ctx.inject(['skills'], (scoped) => {
    const skills = scoped.skills as typeof scoped.skills & { registerProvider?: Context['skills']['registerProvider'] }
    // Test hosts stub register only. The real dsh registry has registerProvider.
    if (typeof skills.registerProvider !== 'function') return undefined
    return skills.registerProvider(() => ({
      name: LIBRARY_PROVIDER,
      async list() {
        const home = skillsHome()
        const catalog = loadCatalog(home)
        return catalog.cards.flatMap((card) => {
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(card.name)) return []
          const description = catalogDescription(card)
          if (!description) return []
          const dir = join(home, 'skills', card.name)
          return [{
            name: card.name,
            description,
            whenToUse: whenToUseOf(card),
            invocation: { modelInvocable: true, userInvocable: true },
            source: 'runtime' as const,
            provider: LIBRARY_PROVIDER,
            rank: LIBRARY_SKILL_RANK,
            locator: dir,
            path: join(dir, 'SKILL.md'),
            resourceBase: { kind: 'directory' as const, path: dir },
            metadata: { tier: card.tier, species: card.species },
          }]
        })
      },
      async get(candidate: { name: string; locator?: unknown }) {
        const home = skillsHome()
        const name = candidate.name
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) return undefined
        const dir = join(home, 'skills', name)
        const file = join(dir, 'SKILL.md')
        let raw = ''
        try {
          raw = readFileSync(file, 'utf8')
        } catch {
          return undefined
        }
        const catalog = loadCatalog(home)
        const card = catalog.cards.find((item) => item.name === name)
        if (!card) return undefined
        return {
          name: card.name,
          description: catalogDescription(card),
          whenToUse: whenToUseOf(card),
          invocation: { modelInvocable: true, userInvocable: true },
          source: 'runtime' as const,
          provider: LIBRARY_PROVIDER,
          content: skillBody(raw, card),
          path: file,
          resourceBase: { kind: 'directory' as const, path: dir },
          metadata: { tier: card.tier, species: card.species },
        }
      },
    }))
  })
}
