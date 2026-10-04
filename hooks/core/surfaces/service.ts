// Surfaces per person (AA §2.7): the set shown now, kept in dataDir/surfaces.json with a log line per new
// set (surfaces_log.jsonl, for the diversity metrics), and the page state the chat reads.

import { join } from '../../sys/path.ts'
import type { FactPack } from '../contracts/factpack.ts'
import type { PageState, SurfaceSet } from '../contracts/surfaces.ts'
import { appendJsonl, readJson, writeJsonAtomic } from '../core/store.ts'

const last = new Map<string, { set: SurfaceSet; page: PageState; pack: FactPack }>()
let lastDataDir = ''

/** A switch to another person (M13): no fallback to the previous person's page. */
export function forgetLastPage(): void {
  lastDataDir = ''
  last.clear()
}

export function pageStateOf(set: SurfaceSet, pack: FactPack): PageState {
  return {
    inputs_fp: set.inputs_fp,
    status_zh: set.status.text_zh,
    next: { kind: set.next.action.kind, title_zh: set.next.card.text_zh, detail_zh: set.next.card.detail_zh ?? set.next.action.detail_zh, mandatory: set.next.action.mandatory },
    top_facts: pack.top_facts.slice(0, 5).map((row) => ({ id: row.id, kind: row.kind, priority: row.priority, text_zh: row.text_zh })),
    feedback: pack.feedback.map((row) => ({ id: row.id, subject: row.subject, grade: row.grade, headline_zh: row.headline_zh, allowed_claims: row.allowed_claims })),
    suggestions_zh: set.suggestions.map((row) => row.prompt_zh ?? row.text_zh),
  }
}

/** Keep this set as the one shown; write surfaces.json and a log line when it differs from the last one. */
export function recordSurfaces(dataDir: string, set: SurfaceSet, pack: FactPack): PageState {
  const page = pageStateOf(set, pack)
  const before = last.get(dataDir) ?? null
  last.set(dataDir, { set, page, pack })
  lastDataDir = dataDir
  const changed = !before || before.set.inputs_fp !== set.inputs_fp || before.set.source !== set.source || before.page.next.title_zh !== page.next.title_zh
  if (changed) {
    try {
      writeJsonAtomic(join(dataDir, 'surfaces.json'), set)
      appendJsonl(join(dataDir, 'surfaces_log.jsonl'), {
        at: set.generated_at, day: set.day, fp: set.inputs_fp, source: set.source, stage: pack.stage,
        top_fact: pack.top_facts[0] ? { id: pack.top_facts[0].id, priority: pack.top_facts[0].priority } : null,
        status: set.status.text_zh, status_facts: set.status.fact_ids, next: { id: set.next.action.id, kind: set.next.action.kind, mandatory: set.next.action.mandatory, title: set.next.card.text_zh, facts: set.next.card.fact_ids },
        suggestions: set.suggestions.map((row) => row.prompt_zh ?? row.text_zh), validation: set.validation,
      })
    } catch {
      // the page still shows the set; only the file and the log miss it
    }
  }
  return page
}

/** Replace the set shown (a model set that passed the post-filter) without changing the pack. */
export function replaceSurfaces(dataDir: string, set: SurfaceSet): void {
  const current = last.get(dataDir)
  if (!current) return
  recordSurfaces(dataDir, set, current.pack)
}

/** What the page shows now: this person's, or the last one built in this process. Null before any build. */
export function readPageState(dataDir?: string): PageState | null {
  const row = last.get(dataDir ?? lastDataDir)
  return row ? row.page : null
}

export function currentSurfaces(dataDir?: string): { set: SurfaceSet; pack: FactPack } | null {
  const row = last.get(dataDir ?? lastDataDir)
  return row ? { set: row.set, pack: row.pack } : null
}

/** The set written last (after a restart, before the first build). */
export function storedSurfaces(dataDir: string): SurfaceSet | null {
  return readJson<SurfaceSet | null>(join(dataDir, 'surfaces.json'), (raw) => (raw && typeof raw === 'object' && (raw as SurfaceSet).version === 1 ? raw as SurfaceSet : null), () => null)
}
