// Shared bits for module tools: the JSON output presenter and the session of the calling agent.

import { sessionKey } from '../plan-hold.ts'

function jsonText(value: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

export const jsonOut = {
  schema: { type: 'json' as const },
  render: (_args: unknown, value: unknown) => jsonText(value),
}

export function sessionOfExec(exec: unknown): string {
  return sessionKey((exec as { agent?: unknown } | undefined)?.agent)
}
