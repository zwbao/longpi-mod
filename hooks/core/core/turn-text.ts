// The person's latest message per session in LongPi's workspace (agents/orchestrator.ts keeps it at each step),
// so a tool can check that a quote it was given is really the person's words (remember_for_me, log_care_visit),
// and the memory distiller reads what was just said.

const last = new Map<string, { text: string; at: number }>()

export function rememberPersonText(session: string, text: string): void {
  last.set(session, { text, at: Date.now() })
  if (last.size > 500) last.delete(last.keys().next().value as string)
}

export function lastPersonText(session: string): string {
  return last.get(session)?.text ?? ''
}

function fold(text: string): string {
  return String(text ?? '').normalize('NFKC').replace(/[\s，。,.！!？?、；;：:“”"'‘’（）()]/g, '').toLowerCase()
}

/** Whether quote is a contiguous part of what the person said (spacing and punctuation ignored). */
export function quoteIn(quote: string, said: string): boolean {
  const q = fold(quote)
  return q.length >= 2 && fold(said).includes(q)
}
