// The Codex's shipped data: the research library (built by scripts/build-codex.mjs; only reviewed cards) and
// the experiment catalogue. Who may use the Codex at all is decided here too: adults only, and it can be closed.

import { existsSync, readFileSync } from '../../sys/fs.ts'
import { dirname, join } from '../../sys/path.ts'
import { fileURLToPath, libFile } from '../../sys/url.ts'
import type { ExperimentSpec, LibraryPack, MetricKey, MetricSpec, StudyCard } from '../contracts/codex.ts'

export type CodexBlock = 'minor' | 'age_unknown' | 'opt_out' | 'config' | null

export function codexBlock(input: { age: number | null; minorFlag: boolean; optOut: boolean; configOn: boolean }): CodexBlock {
  if (!input.configOn) return 'config'
  if (input.minorFlag || (input.age != null && input.age < 18)) return 'minor'
  if (input.age == null) return 'age_unknown'
  if (input.optOut) return 'opt_out'
  return null
}

export function codexBlockZh(block: CodexBlock): string {
  switch (block) {
    case 'minor': return '长寿图鉴只对成年人开放。'
    case 'age_unknown': return '先在档案里填上年龄。长寿图鉴只对成年人开放。'
    case 'opt_out': return '长寿图鉴已关闭，随时可以重新打开。'
    case 'config': return '长寿图鉴没有打开。'
    default: return ''
  }
}

function packageRoot(): string {
  // The mod's own folder: libFile() is <mod>/lib/index.js, as the npm package's bundle sat in lib/.
  return dirname(dirname(libFile()))
}

const EMPTY_LIBRARY: LibraryPack = { version: 3, library: { revision: null, skills: 0 }, chapters: [], studies: [], species: [], pending: [] }

let library: LibraryPack | null = null
let catalog: { metrics: Record<MetricKey, MetricSpec>; experiments: ExperimentSpec[] } | null = null

export function loadLibrary(): LibraryPack {
  if (library) return library
  try {
    const raw = JSON.parse(readFileSync(join(packageRoot(), 'data', 'codex', 'v3', 'library.json'), 'utf8')) as LibraryPack
    library = raw && raw.version === 3 && Array.isArray(raw.studies) ? raw : EMPTY_LIBRARY
  } catch {
    library = EMPTY_LIBRARY
  }
  return library
}

/** Cards from outside the shipped library (the week's new research), set by the routes. */
let extraStudies: () => StudyCard[] = () => []

export function setExtraStudies(fn: () => StudyCard[]): void {
  extraStudies = fn
}

export function studyById(id: string): StudyCard | null {
  return loadLibrary().studies.find((card) => card.id === id || card.skill === id) ?? extraStudies().find((card) => card.id === id) ?? null
}

export function loadCatalog(): { metrics: Record<MetricKey, MetricSpec>; experiments: ExperimentSpec[] } {
  if (catalog) return catalog
  const raw = JSON.parse(readFileSync(join(packageRoot(), 'data', 'codex', 'v3', 'experiments.zh.json'), 'utf8')) as {
    metrics: Record<string, Omit<MetricSpec, 'key'>>
    experiments: ExperimentSpec[]
  }
  const metrics = Object.fromEntries(Object.entries(raw.metrics).map(([key, spec]) => [key, { ...spec, key }])) as Record<MetricKey, MetricSpec>
  catalog = { metrics, experiments: raw.experiments }
  return catalog
}

export function experimentById(id: string): ExperimentSpec | null {
  return loadCatalog().experiments.find((row) => row.id === id) ?? null
}

/** Tests swap the shipped files. */
export function resetCodexData(): void {
  library = null
  catalog = null
}
