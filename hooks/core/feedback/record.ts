// feedback.jsonl: the headlines actually shown, so a later turn can reuse them.
// One line per distinct text, not one line per page refresh.

import { join } from '../../sys/path.ts'
import type { Bus } from '../contracts/events.ts'
import type { FeedbackMessage } from '../contracts/feedback.ts'
import { appendJsonl, readJsonl } from '../core/store.ts'

interface Row { at: string; text: string; ids: string[] }

export function rememberFeedback(dataDir: string, messages: readonly FeedbackMessage[], bus: Bus | null): void {
  if (!dataDir || messages.length === 0) return
  const text = messages.map((row) => row.headline_zh).join('\n')
  const path = join(dataDir, 'feedback.jsonl')
  let last = ''
  try {
    const rows = readJsonl<Row>(path, (raw) => (raw && typeof raw === 'object' && typeof (raw as Row).text === 'string' ? raw as Row : null))
    last = rows.at(-1)?.text ?? ''
  } catch {
    last = ''
  }
  if (last === text) return
  try {
    appendJsonl(path, { at: new Date().toISOString(), text, ids: messages.map((row) => row.id) })
  } catch {
    return
  }
  const lead = messages[0]
  if (!lead || !bus) return
  try {
    bus.emit('feedback.issued', { feedback_id: lead.id, grade: lead.grade, subject_key: lead.subject.key }, { module: 'M4', via: 'tool' })
  } catch {
    // the headlines are already saved
  }
}
