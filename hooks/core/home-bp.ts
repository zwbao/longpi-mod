// The health-data consent offered next to a self-measurement saved before consent: the numbers are stored on
// this computer either way, and the reply says where to agree.

export const INLINE_CONSENT_ZH = '单独同意：健康信息是敏感个人信息，处理它们需要你单独同意。请在健康页完成同意。不同意也可以，这次记录仍然先保存在这台电脑上。'

/** Attach the consent offer to a successful self-measurement result instead of hiding the save. */
export function withConsentOffer(payload: unknown, offer: string = INLINE_CONSENT_ZH): Array<{ type: 'text'; text: string }> {
  let text = ''
  if (typeof payload === 'string') text = payload
  else if (Array.isArray(payload)) text = payload.map((part) => (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string' ? (part as { text: string }).text : '')).join('\n')
  else text = JSON.stringify(payload ?? {})
  let parsed: Record<string, unknown> | null = null
  try {
    const row = JSON.parse(text) as unknown
    parsed = row && typeof row === 'object' && !Array.isArray(row) ? row as Record<string, unknown> : null
  } catch {
    parsed = null
  }
  if (parsed) {
    parsed.consent_pending = true
    parsed.consent_offer_zh = offer
    parsed.note = `${offer} 读回 saved 里的每一项，并说明已经记下。不要说没存下来。`
    return [{ type: 'text', text: JSON.stringify(parsed) }]
  }
  return [{ type: 'text', text: `${text}\n${offer}` }]
}
