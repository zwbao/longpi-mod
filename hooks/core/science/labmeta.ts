// Lab and assay method captured when a checkup is uploaded.
// Same-lab, same-method repeats are what an RCV pair is allowed to use.
// The name stays on this computer. It is not a field in the masked share.

import { createHash } from '../../sys/crypto.ts'
import { join } from '../../sys/path.ts'
import { appendJsonl, readJsonl } from '../core/store.ts'

export interface LabMethodInput {
  lab_name?: unknown
  method?: unknown
  analyser?: unknown
}

export interface LabMethod {
  lab_id: string
  lab_name: string
  method: string
  analyser: string
  sha256: string
  at: string
}

export interface TaggedPoint {
  day: string
  value: number
  lab_id?: string
  method?: string
}

const MAX_LEN = 40

function clean(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_LEN)
}

export function parseLabMethod(input: LabMethodInput): { lab_name: string; method: string; analyser: string } | null {
  const lab_name = clean(input.lab_name)
  const method = clean(input.method)
  if (lab_name.length < 2 || method.length < 2) return null
  if (/[@\\]|\/Users\/|https?:/i.test(`${lab_name} ${method}`)) return null
  return { lab_name, method, analyser: clean(input.analyser) }
}

export function labIdOf(labName: string): string {
  const digest = createHash('sha256').update(labName.trim().toLowerCase(), 'utf8').digest('hex').slice(0, 12)
  return `lab-${digest}`
}

function pathOf(dataDir: string): string {
  return join(dataDir, 'datain', 'lab-methods.jsonl')
}

export function rememberLabMethod(dataDir: string, input: { sha256: string; lab_name: string; method: string; analyser?: string; at?: string }): LabMethod {
  const row: LabMethod = {
    lab_id: labIdOf(input.lab_name),
    lab_name: input.lab_name,
    method: input.method,
    analyser: input.analyser ?? '',
    sha256: input.sha256,
    at: input.at ?? new Date().toISOString(),
  }
  appendJsonl(pathOf(dataDir), row)
  return row
}

export function listLabMethods(dataDir: string): LabMethod[] {
  return readJsonl<LabMethod>(pathOf(dataDir), (raw) => {
    const row = raw as LabMethod
    return row && typeof row.lab_id === 'string' && typeof row.method === 'string' ? row : null
  })
}

function daysBetween(earlier: string, later: string): number {
  const a = Date.parse(`${earlier}T12:00:00Z`)
  const b = Date.parse(`${later}T12:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return -1
  return Math.round((b - a) / 86_400_000)
}

/**
 * The latest two positive results that share a lab id and assay method and sit 90–540 days apart.
 * A missing lab id does not enter the primary pair. Different labs do not.
 */
export function primarySameLabPair(points: readonly TaggedPoint[], window: { min_days?: number; max_days?: number } = {}): { earlier: TaggedPoint; later: TaggedPoint; days: number } | null {
  const minDays = window.min_days ?? 90
  const maxDays = window.max_days ?? 540
  const sorted = points.filter((row) => row.value > 0 && /^\d{4}-\d{2}-\d{2}$/.test(row.day)).slice().sort((a, b) => a.day.localeCompare(b.day))
  for (let laterIndex = sorted.length - 1; laterIndex >= 1; laterIndex -= 1) {
    const later = sorted[laterIndex]
    if (!later?.lab_id) continue
    for (let earlierIndex = laterIndex - 1; earlierIndex >= 0; earlierIndex -= 1) {
      const earlier = sorted[earlierIndex]
      if (!earlier?.lab_id || earlier.lab_id !== later.lab_id) continue
      if ((earlier.method || later.method) && earlier.method !== later.method) continue
      const days = daysBetween(earlier.day, later.day)
      if (days >= minDays && days <= maxDays) return { earlier, later, days }
    }
  }
  return null
}
