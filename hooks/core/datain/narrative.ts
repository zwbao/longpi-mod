// Narrative findings from a checkup (ultrasound grades, 总检, 医师建议). Mirobody stores lab rows,
// not these sentences, so they live in dataDir/datain/findings.jsonl and the page reads them back.

import { createHash } from '../../sys/crypto.ts'
import { join } from '../../sys/path.ts'
import { appendJsonl, newId, readJsonl } from '../core/store.ts'

export type FindingKind = 'ti-rads' | 'bi-rads' | 'nodule' | 'ultrasound' | 'conclusion' | 'advice' | 'wrong_person' | 'genetics'

export interface NarrativeFinding {
  id: string
  date: string
  text_zh: string
  kind: string
  /** Imaging grade when the line is TI-RADS or BI-RADS; '' otherwise. */
  grade?: string
  /** Shown on the 档案 page. The chat tool leaves this off so a name never reaches the model (D10). */
  page_note_zh?: string
  upload_id?: string
}

const TI = /TI[-\s]?RADS\s*[:：]?\s*([0-5])\s*类?/i
const BI = /BI[-\s]?RADS\s*[:：]?\s*([0-6])\s*类?/i
const SIZE = /(\d+(?:\.\d+)?\s*[×xX*]\s*\d+(?:\.\d+)?(?:\s*[×xX*]\s*\d+(?:\.\d+)?)?\s*mm)/i
const DAY = /(20\d{2}-\d{2}-\d{2})/

function pathOf(dataDir: string): string {
  return join(dataDir, 'datain', 'findings.jsonl')
}

export function findingsFile(dataDir: string): string {
  return pathOf(dataDir)
}

function keep(raw: unknown): NarrativeFinding | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Partial<NarrativeFinding>
  if (typeof row.id !== 'string' || typeof row.text_zh !== 'string' || !row.text_zh.trim()) return null
  return {
    id: row.id,
    date: typeof row.date === 'string' ? row.date.slice(0, 10) : '',
    text_zh: row.text_zh.trim(),
    kind: typeof row.kind === 'string' ? row.kind : 'conclusion',
    ...(typeof row.grade === 'string' && row.grade ? { grade: row.grade } : {}),
    ...(typeof row.page_note_zh === 'string' && row.page_note_zh ? { page_note_zh: row.page_note_zh } : {}),
    ...(typeof row.upload_id === 'string' && row.upload_id ? { upload_id: row.upload_id } : {}),
  }
}

/**
 * Exam and conclusion lines Mirobody stored as indicator rows (a report uploaded in Mirobody, not through LongPi).
 * The same parser as a LongPi upload; duplicates of a line already stored are skipped.
 */
export function findingsFromIndicators(dataDir: string, indicators: readonly { name?: string; label?: string; value?: string | number; date?: string; last_date?: string }[]): NarrativeFinding[] {
  if (!dataDir || indicators.length === 0) return []
  const lines: string[] = []
  for (const row of indicators) {
    const value = row.value == null ? '' : String(row.value)
    const text = `${row.label ?? ''} ${row.name ?? ''} ${value}`.replace(/\s+/g, ' ').trim()
    if (!/TI[-\s]?RADS|BI[-\s]?RADS|总检|超声|医师建议|体检结论/.test(text)) continue
    const date = (row.date || row.last_date || '').slice(0, 10)
    lines.push(date && !text.includes(date) ? `${text} ${date}` : text)
  }
  if (lines.length === 0) return []
  return storeFindings(dataDir, parseNarrative(lines.join('\n')))
}

export function listFindings(dataDir: string): NarrativeFinding[] {
  if (!dataDir) return []
  return readJsonl(pathOf(dataDir), keep)
}

/** One line the page can show. Imaging grades keep the nodule; advice keeps the clinic's own sentence. */
export function parseNarrative(text: string, date = ''): NarrativeFinding[] {
  const day = date || DAY.exec(text)?.[1] || ''
  const lines = text.split(/\n+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter((line) => line.length >= 4 && line.length <= 400)
  const out: NarrativeFinding[] = []
  const seen = new Set<string>()
  const push = (kind: FindingKind, textZh: string, grade = '') => {
    const key = `${kind}|${textZh}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ id: newId('find'), date: day, text_zh: textZh, kind, ...(grade ? { grade } : {}) })
  }
  for (const line of lines) {
    const ti = TI.exec(line)
    const bi = BI.exec(line)
    if (ti || bi) {
      if (ti) {
        const size = SIZE.exec(line)?.[1]?.replace(/\s+/g, '') ?? ''
        const grade = ti[1] ?? ''
        const where = /甲状腺/.test(line) ? '甲状腺' : /结节/.test(line) ? '结节' : '超声'
        push('ti-rads', `${where}${size ? ` ${size}` : ''}，TI-RADS ${grade}。`.replace(/\s+/g, ' '), grade)
      }
      if (bi) {
        const grade = bi[1] ?? ''
        const where = /乳/.test(line) ? '乳腺' : '超声'
        push('bi-rads', `${where}，BI-RADS ${grade}。`, grade)
      }
      continue
    }
    if (/医师建议|总检|体检结论|超声提示|超声结论|建议[:：]/.test(line) && !/^\d/.test(line)) {
      const kind: FindingKind = /超声/.test(line) ? 'ultrasound' : /建议/.test(line) ? 'advice' : 'conclusion'
      push(kind, line.replace(/^[:：\s]+/, ''))
    }
  }
  // A grade split from its sentence ("TI-RADS" on one line, "3类" on the next) still counts.
  if (!out.some((row) => row.kind === 'ti-rads' || row.kind === 'bi-rads')) {
    const flat = lines.join(' ')
    const ti = TI.exec(flat)
    const bi = BI.exec(flat)
    if (ti) push('ti-rads', `超声 TI-RADS ${ti[1]}。`, ti[1])
    if (bi) push('bi-rads', `超声 BI-RADS ${bi[1]}。`, bi[1])
  }
  return out.slice(0, 12)
}

export function storeFindings(dataDir: string, rows: NarrativeFinding[], uploadId = ''): NarrativeFinding[] {
  const prior = listFindings(dataDir)
  const known = new Set(prior.map((row) => `${row.kind}|${row.text_zh}|${row.date}`))
  const saved: NarrativeFinding[] = []
  for (const row of rows) {
    const key = `${row.kind}|${row.text_zh}|${row.date}`
    if (known.has(key)) continue
    known.add(key)
    const item = { ...row, ...(uploadId ? { upload_id: uploadId } : {}) }
    appendJsonl(pathOf(dataDir), item)
    saved.push(item)
  }
  return saved
}

/** Stable short hash of the report text, so a second photo of the same page is a duplicate. */
export function textFingerprint(text: string): string {
  const norm = text.replace(/\s+/g, '').slice(0, 4000)
  if (norm.length < 40) return ''
  return createHash('sha256').update(norm).digest('hex').slice(0, 16)
}

/** The imaging finding the page should lead with, TI-RADS before BI-RADS, higher grade first. */
export function leadImaging(rows: readonly NarrativeFinding[]): NarrativeFinding | null {
  const ranked = rows.filter((row) => row.kind === 'ti-rads' || row.kind === 'bi-rads')
  ranked.sort((a, b) => {
    const ak = a.kind === 'ti-rads' ? 0 : 1
    const bk = b.kind === 'ti-rads' ? 0 : 1
    return ak - bk || Number(b.grade ?? 0) - Number(a.grade ?? 0)
  })
  return ranked[0] ?? null
}
