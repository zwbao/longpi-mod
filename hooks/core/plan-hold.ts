// A hypoglycaemia message must be answered before any plan draft. The guard
// sets this for a few minutes for the session the message came in; that
// session's draft_intervention_plan returns the first-aid line instead of
// building a plan, so the turn cannot sit on "正在起草方案". Other sessions (and
// other people's dsh processes) are not held. A caller that cannot name its
// session uses the key '' (the person's own, since one profile is one person).

const holds = new Map<string, number>()
const MAX_KEYS = 500

export function holdPlanDraft(session = '', ms = 10 * 60_000, now = Date.now()): void {
  holds.set(session, now + ms)
  if (holds.size > MAX_KEYS) {
    for (const [key, until] of holds) if (until <= now) holds.delete(key)
  }
}

export function releasePlanDraft(session = ''): void {
  holds.delete(session)
}

export function planDraftHeld(session = '', now = Date.now()): boolean {
  const until = holds.get(session) ?? 0
  if (until > now) return true
  if (until) holds.delete(session)
  return false
}

/** The session id of the agent a tool or hook runs for; '' when there is none. */
export function sessionKey(agent: unknown): string {
  try {
    const session = agent && typeof agent === 'object' ? (agent as { session?: { id?: unknown } }).session : undefined
    return typeof session?.id === 'string' ? session.id : ''
  } catch {
    return ''
  }
}
