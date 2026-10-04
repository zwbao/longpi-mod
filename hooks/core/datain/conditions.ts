// Conditions live on the LongPi side. This Mirobody deployment answers 405 on the conditions
// route (FINDINGS #38), so a diagnosis the person states is not sent there.

import { join } from '../../sys/path.ts'
import type { Provenance } from '../contracts/common.ts'
import type { ConditionFlag } from '../contracts/memory.ts'
import { memoryFor } from '../core/memory.ts'
import { appendJsonl, newId, readJsonl } from '../core/store.ts'

export interface ConditionRow {
  id: string
  name_zh: string
  state: 'current' | 'past' | 'suspected' | 'ruled_out'
  since: string
  text_zh: string
  at: string
  memory_id?: string
}

const STATES = new Set(['current', 'past', 'suspected', 'ruled_out'])

function pathOf(dataDir: string): string {
  return join(dataDir, 'datain', 'conditions.jsonl')
}

export function listConditions(dataDir: string): ConditionRow[] {
  return readJsonl(pathOf(dataDir), (raw) => {
    if (!raw || typeof raw !== 'object') return null
    const row = raw as Partial<ConditionRow>
    if (typeof row.name_zh !== 'string' || !row.name_zh.trim()) return null
    const state = STATES.has(String(row.state)) ? row.state as ConditionRow['state'] : 'current'
    return {
      id: typeof row.id === 'string' ? row.id : '',
      name_zh: row.name_zh.trim(),
      state,
      since: typeof row.since === 'string' ? row.since.slice(0, 10) : '',
      text_zh: typeof row.text_zh === 'string' ? row.text_zh : row.name_zh.trim(),
      at: typeof row.at === 'string' ? row.at : '',
      ...(typeof row.memory_id === 'string' ? { memory_id: row.memory_id } : {}),
    }
  })
}

export function rememberCondition(dataDir: string, input: {
  name_zh: string
  state?: ConditionRow['state']
  since?: string
  quote_zh?: string
  via: 'page' | 'chat'
}, now = new Date()): { ok: true; row: ConditionRow; read_back: string } | { ok: false; error: string } {
  const name = input.name_zh.trim()
  if (!name || name.length > 80) return { ok: false, error: '需要一个病情或诊断的名称。' }
  const state = input.state && STATES.has(input.state) ? input.state : 'current'
  const since = input.since && /^\d{4}-\d{2}-\d{2}$/.test(input.since) ? input.since : ''
  const text = state === 'past' ? `${name}（以前）` : state === 'suspected' ? `${name}（疑似）` : state === 'ruled_out' ? `${name}（已排除）` : name
  const at = now.toISOString()
  const provenance: Provenance = {
    kind: input.via === 'chat' ? 'chat' : 'page',
    at,
    by: 'M7',
    ...(input.quote_zh ? { quote_zh: input.quote_zh.slice(0, 200) } : {}),
  }
  const applied = memoryFor(dataDir).apply([{
    op: 'add',
    item: {
      kind: 'condition',
      name_zh: name,
      flags: [] as ConditionFlag[],
      state,
      ...(since ? { since } : {}),
      text_zh: text,
      confirmed: true,
      provenance,
    },
  }], 'M7')
  const row: ConditionRow = {
    id: newId('cond'),
    name_zh: name,
    state,
    since,
    text_zh: text,
    at,
    ...(applied.applied[0] ? { memory_id: applied.applied[0] } : {}),
  }
  appendJsonl(pathOf(dataDir), row)
  const readBack = `已记录：${text}${since ? `，${since} 起` : ''}。此信息仅保存在这台电脑上。`
  return { ok: true, row, read_back: readBack }
}
