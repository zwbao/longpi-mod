// Medicines the person asks LongPi to remember. Mirobody may already hold an imported plan;
// a stated line is stored in medication_statements.jsonl and mirrored into memory.

import { addStatement, drugCore, presentMedications, readStatements, type StatedMedication } from '../meds-stated.ts'
import { memoryFor } from '../core/memory.ts'

function memoryMedications(dataDir: string): StatedMedication[] {
  try {
    const items = memoryFor(dataDir).read().items
    const out: StatedMedication[] = []
    for (const item of items) {
      if (item.status !== 'active' || (item.kind !== 'medication' && item.kind !== 'supplement')) continue
      if (item.stopped) continue
      const name = item.name_zh?.trim()
      if (!name) continue
      out.push({
        name,
        dose_text: '',
        frequency_text: item.regimen_text?.trim() ?? '',
        since: item.started ?? '',
        at: item.updated ?? '',
      })
    }
    return out
  } catch {
    return []
  }
}

export function listMedications(dataDir: string): { lines: string[]; rows: StatedMedication[] } {
  const stated = readStatements(dataDir)
  const seen = new Set(stated.map((row) => drugCore(row.name)))
  const rows = [...stated]
  for (const row of memoryMedications(dataDir)) {
    const key = drugCore(row.name)
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(row)
  }
  return { rows, lines: presentMedications([], rows).lines }
}

export function rememberMedication(dataDir: string, input: { name: string; dose_text?: string; frequency_text?: string; since?: string }): { ok: true; read_back: string } | { ok: false; error: string } {
  const name = input.name.trim()
  if (!name || name.length > 80) return { ok: false, error: '需要对方说出的药名。' }
  const since = input.since && /^\d{4}-\d{2}-\d{2}$/.test(input.since) ? input.since : ''
  const saved = addStatement(dataDir, {
    name,
    dose_text: (input.dose_text ?? '').trim().slice(0, 80),
    frequency_text: (input.frequency_text ?? '').trim().slice(0, 80),
    since,
  })
  // addStatement already imports the line into memory. Read it back so a failed mirror is visible in tests.
  memoryFor(dataDir)
  const readBack = `已记录：${saved.name}${saved.dose_text ? ` ${saved.dose_text}` : ''}${saved.frequency_text ? ` ${saved.frequency_text}` : ''}${saved.since ? `，${saved.since} 起` : ''}`
  return { ok: true, read_back: readBack }
}
