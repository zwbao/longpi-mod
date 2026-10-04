// Whether a model call may carry health data. Without the DeepSeek consent, record text
// does not leave this computer.

const HEALTH = /血红蛋白|血糖|铁蛋白|胸痛|心梗|胸闷|体检|表型年龄|血压|mmol|g\/L|用药|怀孕|中风|头晕|过敏|自杀|不想活|心口|喘/

export const CONSENT_HOLD_ZH = '如果正在发生急症，请立即拨打 120；如有伤害自己的想法，请拨打全国心理援助热线 12356。你尚未同意把健康对话发给 DeepSeek，因此本次不发送健康信息。请在开始页或档案中选择「我知道了，同意把健康对话发给 DeepSeek」。'

/** `blob` is the whole call (system prompt included). `personText` is only what the person typed. */
export function modelEgress(granted: boolean, blob: string, personText = blob): 'send' | 'hold' {
  if (granted) return 'send'
  if (!HEALTH.test(`${blob}\n${personText}`)) return 'send'
  return 'hold'
}

/** The person's own messages, not a plugin note. */
export function personTextOf(options: { messages?: unknown }): string {
  const messages = Array.isArray(options.messages) ? options.messages : []
  const lines: string[] = []
  for (const message of messages) {
    if (!message || typeof message !== 'object') continue
    const row = message as { role?: unknown; source?: { kind?: unknown }; content?: unknown }
    if (row.role !== 'user') continue
    if (row.source && row.source.kind !== 'user') continue
    const content = row.content
    if (typeof content === 'string') lines.push(content)
    else if (Array.isArray(content)) {
      for (const block of content) {
        if (block && typeof block === 'object' && typeof (block as { text?: unknown }).text === 'string') lines.push((block as { text: string }).text)
      }
    }
  }
  return lines.join('\n')
}

export function payloadText(options: { system?: unknown; messages?: unknown }): string {
  const parts: string[] = []
  if (typeof options.system === 'string') parts.push(options.system)
  const messages = Array.isArray(options.messages) ? options.messages : []
  for (const message of messages) {
    if (!message || typeof message !== 'object') continue
    const content = (message as { content?: unknown }).content
    if (typeof content === 'string') parts.push(content)
    else if (Array.isArray(content)) {
      for (const block of content) {
        if (block && typeof block === 'object' && typeof (block as { text?: unknown }).text === 'string') parts.push((block as { text: string }).text)
      }
    }
  }
  return parts.join('\n')
}

export async function* heldStream(text: string): AsyncGenerator<{ type: string; text?: string; block?: { type: string; text: string }; reason?: { kind: string } }> {
  yield { type: 'text-delta', text }
  yield { type: 'block-end', block: { type: 'text', text } }
  yield { type: 'finish', reason: { kind: 'stop' } }
}
