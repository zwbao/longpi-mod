// The week's new research in the Codex library: cards the literature scout (app/literature.ts) wrote from
// the past week's high-quality aging papers, kept in <holder's LongPi home>/literature/<ISO week>.json. They
// are read like any research card (已读, 遇见 a species) and sit in their own chapter, 「本周新研究」.

import { existsSync, readdirSync, readFileSync } from '../../sys/fs.ts'
import { join } from '../../sys/path.ts'
import type { ChapterInfo, StudyCard } from '../contracts/codex.ts'

export const NEW_CHAPTER = 'new'

export type LiteratureCard = StudyCard & { week: string; added: string; pmid: string; pubtypes: string[] }
export type LiteratureWeek = { week: string; at: string; candidates: number; cards: LiteratureCard[]; rejected?: Array<{ pmid: string; why: string }>; answered?: number }

export function literatureDir(root: string): string {
  return join(root, 'literature')
}

/** Every week's cards, newest week first. */
export function readLiterature(root: string): LiteratureCard[] {
  if (!root) return []
  const dir = literatureDir(root)
  if (!existsSync(dir)) return []
  const weeks: LiteratureWeek[] = []
  for (const name of readdirSync(dir)) {
    if (!/^\d{4}-W\d{2}\.json$/.test(name)) continue
    try {
      const raw = JSON.parse(readFileSync(join(dir, name), 'utf8')) as LiteratureWeek
      if (raw && Array.isArray(raw.cards)) weeks.push(raw)
    } catch {
      // a damaged week is skipped
    }
  }
  weeks.sort((a, b) => (a.week < b.week ? 1 : -1))
  return weeks.flatMap((week) => week.cards)
}

export function literatureChapter(cards: readonly LiteratureCard[]): ChapterInfo | null {
  if (cards.length === 0) return null
  return { id: NEW_CHAPTER, no: 0, title_zh: '本周新研究', motif: 'span', intro_zh: '每周从新发表的论文里挑出的高质量衰老研究。', size: cards.length }
}
