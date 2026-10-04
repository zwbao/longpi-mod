// A few things written into a plan request's constraints are kept by rule: pregnancy or planning one,
// breastfeeding, and a close relative's breast cancer. They only add caution (plan safety) and a screening topic.
// A mention of 我妈 / 我爸 never changes whose record this is: each family member has a record of their own.

import type { NewMemoryItem } from '../contracts/memory.ts'
import { memoryFor } from './memory.ts'

const OTHER_PERSON = /老婆|妻子|太太|女朋友|老公|丈夫|男朋友|女儿|儿子|朋友|同事|她(?:在|正在|怀)|他(?:在|正在)/
const PLANNING_HIT = /备孕|准备怀孕|计划怀孕|准备要孩子|计划要孩子/g
const FEEDING_HIT = /哺乳|母乳喂养|母乳/g
const PREGNANT_HIT = /怀孕了|已怀孕|正在怀孕|我(?:现在|已经|正在|在)?怀孕|怀孕\s*\d+\s*(?:周|个月)|(?<!备)孕期|(?<![备])妊娠(?!糖尿病)/g

function aboutSelf(raw: string, index: number, length: number): boolean {
  const start = Math.max(raw.lastIndexOf('。', index), raw.lastIndexOf('\n', index), raw.lastIndexOf('；', index))
  const clause = raw.slice(start + 1, index + length)
  const left = raw.slice(Math.max(0, index - 8), index)
  return !OTHER_PERSON.test(clause) && !OTHER_PERSON.test(left)
}

function firstSelf(raw: string, pattern: RegExp): RegExpExecArray | null {
  const re = new RegExp(pattern.source, pattern.flags)
  for (const hit of raw.matchAll(re)) {
    if (aboutSelf(raw, hit.index ?? 0, hit[0].length)) return hit
  }
  return null
}

export function rememberFromWords(dataDir: string, text: string, session = ''): string[] {
  const raw = String(text ?? '')
  const ops: NewMemoryItem[] = []
  const at = new Date().toISOString()
  const provenance = (quote: string) => ({ kind: 'chat' as const, at, by: 'M0' as const, ...(session ? { session_id: session } : {}), quote_zh: quote.slice(0, 200) })
  const planning = firstSelf(raw, PLANNING_HIT)
  if (planning) ops.push({ kind: 'condition', name_zh: '备孕', flags: ['pregnancy_planning'], state: 'current', text_zh: '在备孕', confirmed: true, provenance: provenance(planning[0]) } as NewMemoryItem)
  const feeding = firstSelf(raw, FEEDING_HIT)
  if (feeding) ops.push({ kind: 'condition', name_zh: '哺乳', flags: ['breastfeeding'], state: 'current', text_zh: '在哺乳', confirmed: true, provenance: provenance(feeding[0]) } as NewMemoryItem)
  const pregnancy = firstSelf(raw, PREGNANT_HIT)
  if (pregnancy) ops.push({ kind: 'condition', name_zh: '怀孕', flags: ['pregnancy'], state: 'current', text_zh: '怀孕', confirmed: true, provenance: provenance(pregnancy[0]) } as NewMemoryItem)
  const family = raw.match(/(?:我妈妈?|我母亲|母亲|我姐姐?|我妹妹?|我外婆|我奶奶)[^。？?！!]{0,14}(?:乳腺癌|乳癌)[^。？?！!]{0,8}/)
  if (family) {
    ops.push({ kind: 'family_history', relative: /姐|妹/.test(family[0]) ? (/姐/.test(family[0]) ? 'sister' : 'sister') : /外婆|奶奶/.test(family[0]) ? 'grandparent' : 'mother', condition_zh: '乳腺癌', flags: [], text_zh: family[0].trim(), confirmed: true, provenance: provenance(family[0]) } as NewMemoryItem)
  }
  if (ops.length === 0) return []
  return memoryFor(dataDir).apply(ops.map((item) => ({ op: 'add' as const, item })), 'M0').applied
}
