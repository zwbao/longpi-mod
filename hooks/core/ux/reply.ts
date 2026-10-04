// The default shape of an answer a person reads: three short parts, no internals.

import { scrubVisible } from './plain.ts'

export interface ReplyParts {
  question: string
  seen: string
  unknown: string
  next: string
  /** When the question is about a change or a visit, offer the doctor brief inside 下一步. */
  offerBrief?: boolean
  /** First aid stays the first line. The three parts follow it. */
  emergency?: string
}

function clip(text: string, cap: number): string {
  const clean = scrubVisible(text.replace(/\s+/g, ' '))
  if (clean.length <= cap) return clean
  return `${clean.slice(0, cap - 1)}…`
}

/** One-line questions get one short sentence under each heading. */
export function shapeReply(input: ReplyParts): string {
  const question = input.question.trim()
  const short = question.length > 0 && question.length <= 24 && !question.includes('\n')
  const cap = short ? 42 : 120
  const next = input.offerBrief
    ? `${clip(input.next, cap)}我可以根据这些结果整理一份就诊简报（含数值、日期和建议向医生提出的问题），就诊时可直接出示给医生。`
    : clip(input.next, cap)
  const body = [
    `数据显示\n${clip(input.seen, cap)}`,
    `数据尚不能说明的\n${clip(input.unknown, cap)}`,
    `下一步\n${next}`,
  ].join('\n\n')
  const emergency = input.emergency ? scrubVisible(input.emergency) : ''
  return emergency ? `${emergency}\n\n${body}` : body
}

export function replyHasThreeParts(text: string): boolean {
  const seen = text.indexOf('数据显示')
  const unknown = text.indexOf('数据尚不能说明的')
  const next = text.indexOf('下一步')
  return seen >= 0 && unknown > seen && next > unknown
}
