// The chat side of AA §2.2: LongPi's persona and orchestrator rules only for agents in LongPi's own workspace
// (健康对话, D5), LongPi's write tools hidden from every other agent, and at the first step of each turn there a
// snapshot of what the LongPi page shows now, so the chat and the page tell the same story. Sessions in other
// workspaces get nothing from LongPi, whatever they talk about; neither do sub-agents.

import { randomUUID } from '../../sys/crypto.ts'
import type { Context } from '../../sys/cordis.ts'
import type { PageState } from '../contracts/surfaces.ts'
import type { MountState } from '../mirobody.ts'
import { insideWorkspace } from '../guard-scope.ts'
import { rememberPersonText } from '../core/turn-text.ts'
import { sessionKey } from '../plan-hold.ts'
import { personaLines } from '../prompt.ts'
import { PROMPT_SECTIONS } from '../version.ts'

export const PLUGIN_SOURCE = 'dsh-plugin-longpi'
/** Write tools a non-health agent does not see (D5). Read tools stay global. */
export const WRITE_TOOLS = [
  'save_personal_profile', 'save_intervention_plan', 'log_intervention_checkin', 'save_self_measurement', 'record_medication_statement',
  'set_followup', 'send_followup_message', 'remember_for_me', 'log_care_visit', 'note_page_issue',
  'forward_report', 'record_condition', 'log_life_event', 'run_deep_analysis', 'import_analysis', 'import_member_file',
] as const

export const ORCHESTRATOR_RULES = [
  'Orchestrator rules (0.5.3):',
  '1. At the start of a health turn a message marked LongPi 健康页快照 says what the LongPi page shows now, the most important fact, and what the person told LongPi before. It comes from the plugin, not from the person; never quote it as their words.',
  '2. Not in an emergency turn (then only the emergency answer). Otherwise, if the snapshot has a line 最重要的事（必须先说）and the person asks anything about their health, open with that fact in ONE short sentence with its key numbers (a low value is 偏低) and who to see — not the whole paragraph again unless they ask about it — then answer what they asked, in full. Never contradict the page silently: if you think the page is wrong, say why and call note_page_issue.',
  '3. When the snapshot says 就医跟进, ask once in this session, in one short question: 约了吗？医生怎么说？ — not in every reply. When they answer, record it with log_care_visit in their words. When they want to prepare for the visit, offer the one-page brief (prepare_doctor_brief).',
  '4. When the person states a goal, something they do not want (不要…), a condition, a medicine they take or stopped, a sick or travel day, or whether they drink, call remember_for_me with their exact words as quote. read_person_memory shows what is already kept; do not ask again.',
  '5. Use the job skills for the job at hand. Never send the person\'s name anywhere; call them 你.',
  '6. Write only Chinese to the person. Do not narrate what you are about to do (no "I\'ll …", "Let me …" before a tool call): call the tool, then answer.',
  '7. Deep analysis: follow the snapshot line 深度分析. With automatic deep analysis switched on and the line saying it can start, start it yourself with run_deep_analysis (trigger "ai", reason_zh naming the new data) and say in one sentence why and that it runs in the background of this chat. With the switch off, at the key moment the line names, ask once whether to do one, saying how many tokens and how long it takes; start it with trigger "member" only on a yes. Then follow the longevity-analyst skill, import the result with import_analysis when it is done, and read the plan back for them to adopt.',
  '8. The snapshot line 当前查看 names whose record the page shows. When it is a family member, every record, plan, memory and analysis you read or write is theirs: speak about them (你爸爸 / 你妈妈), not about the person chatting, and never mix the two. When the person tells you something about themselves while a family member is shown, do not record it (remember_for_me, save_*): tell them to switch to 我 on the health page first.',
]

export function orchestratorPrompt(mount: MountState): string {
  return [...personaLines(mount), ...ORCHESTRATOR_RULES].join('\n')
}

interface AgentLike {
  ctx?: unknown
  session?: { id?: unknown; header?: { cwd?: unknown; origin?: unknown; delegationDepth?: unknown } }
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const inner of Object.values(value as Record<string, unknown>)) freeze(inner)
    Object.freeze(value)
  }
  return value
}

export function pluginMessage(text: string, form: 'snapshot' | 'instructions', name: string): never {
  return freeze({ id: randomUUID(), role: 'user', content: [{ type: 'text', text }], source: { kind: 'plugin', plugin: PLUGIN_SOURCE, form, sections: [{ name, text }] } }) as never
}

function clip(text: string, max: number): string {
  const chars = [...text]
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join('')}…`
}

export interface SnapshotInput {
  page: PageState
  memory_zh: string
  care_due_zh: string
  /** Items the distiller noted from the chat, not yet confirmed. */
  noted_zh?: string
  /** The deep-analysis facts (M12): new data since the last analysis, a run going, what the AI may do. */
  analysis_zh?: string
  /** Whose record the page shows now (M13), when it is a family member rather than the person chatting. */
  person_zh?: string
}

/** The snapshot text (Chinese), at most about 1.5k tokens. */
export function snapshotText(input: SnapshotInput): string {
  const { page } = input
  const lines = ['【LongPi 健康页快照】以下是 LongPi 健康页此刻显示的内容，由插件提供，不是用户说的话。']
  if (input.person_zh) lines.push(input.person_zh)
  const top = page.top_facts[0]
  const urgent = (row: PageState['top_facts'][number] | undefined) => Boolean(row) && (row?.priority === 'must_surface' || row?.priority === 'emergency')
  // Only a doctor-first finding or a screening topic is said first; a medicine or condition that changes
  // what is safe is context for food, supplement, exercise and plan questions, not an opener for every reply.
  if (top && urgent(top) && (top.kind === 'triage' || top.kind === 'screening')) lines.push(`最重要的事（必须先说）：${top.text_zh}`)
  const safety = page.top_facts.filter((row) => urgent(row) && (row.kind === 'safety_med' || row.kind === 'safety_condition')).slice(0, 2)
  if (safety.length > 0) lines.push(`用药和身体状况（谈到饮食、补剂、运动、方案或这个药时必须考虑；不必每次开头都说）：${safety.map((row) => row.text_zh).join('；')}`)
  lines.push(`页面状态：${clip(page.status_zh, 120)}`)
  lines.push(`下一步：${page.next.title_zh}${page.next.detail_zh ? `——${clip(page.next.detail_zh, 260)}` : ''}${page.next.mandatory ? '（必须先做）' : ''}`)
  const others = page.top_facts.slice(1, 4).filter((row) => row.priority !== 'context' && !safety.includes(row) && row !== top).slice(0, 2)
  if (others.length > 0) lines.push(`也要留意：${others.map((row) => row.text_zh).join('；')}`)
  if (input.care_due_zh) lines.push(`就医跟进：${input.care_due_zh}`)
  if (input.analysis_zh) lines.push(input.analysis_zh)
  if (input.memory_zh) lines.push(`你之前记下：${clip(input.memory_zh.replace(/\n/g, '；'), 800)}`)
  if (input.noted_zh) lines.push(`刚从对话里记下（未确认）：${clip(input.noted_zh, 200)}。回答时顺带说一句「已记录：…（如有误，可以说「撤销」）」。`)
  if (page.suggestions_zh.length > 0) lines.push(`页面建议的问题：${page.suggestions_zh.slice(0, 3).join(' / ')}`)
  return lines.join('\n')
}

export interface OrchestratorOptions {
  mount: MountState
  healthWorkspaces: () => string[]
  /** The page state and what goes with it, built within the deadline; null when it is not ready. */
  snapshot: (deadlineMs: number) => Promise<SnapshotInput | null>
  log?: (message: string) => void
}

export interface Orchestrator {
  isHealth(agent: unknown): boolean
  /** Sessions that got the snapshot, with the fp they got (for tests). */
  injected: Map<string, string>
}

/** A sub-agent DSH spawned for a task (dsh-subagent writes origin "subagent" and a depth). A session the person
 * forked from another carries parentSession too, but it is theirs: it is not a sub-agent. */
export function isSubAgent(agent: unknown): boolean {
  const header = (agent as AgentLike | undefined)?.session?.header
  return header?.origin === 'subagent' || Number(header?.delegationDepth ?? 0) > 0
}

/** The person's latest message in a step's messages (not a plugin note, not a sub-agent's task text). */
export function latestPersonText(messages: readonly unknown[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const row = messages[index] as { role?: string; source?: { kind?: string }; content?: unknown }
    if (row?.role !== 'user' || (row.source && row.source.kind && row.source.kind !== 'user')) continue
    if (typeof row.content === 'string') return row.content
    if (Array.isArray(row.content)) return row.content.map((part) => (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string' ? (part as { text: string }).text : '')).join('')
  }
  return ''
}

/** The vendored Mirobody plugin's own rule notice (its guard). LongPi has no guard since 0.8.0, and drops this one too. */
export function isMirobodyNotice(message: unknown): boolean {
  const source = (message as { source?: { kind?: string; plugin?: string; form?: string } } | undefined)?.source
  return source?.kind === 'plugin' && source.plugin === 'dsh-plugin-mirobody' && source.form === 'notice'
}

function sessionId(agent: AgentLike | undefined): string {
  return typeof agent?.session?.id === 'string' ? agent.session.id : ''
}

export function registerOrchestrator(ctx: Context, options: OrchestratorOptions): Orchestrator {
  const healthAgents = new WeakSet<object>()
  const healthSessions = new Set<string>()
  const injected = new Map<string, string>()
  const inHealthWorkspace = (agent: AgentLike | undefined) => {
    const cwd = typeof agent?.session?.header?.cwd === 'string' ? agent.session.header.cwd : ''
    return Boolean(cwd) && options.healthWorkspaces().some((root) => insideWorkspace(cwd, root))
  }
  const isHealth = (agent: unknown) => {
    const row = agent as AgentLike | undefined
    if (isSubAgent(row)) return false
    if (row && typeof row === 'object' && healthAgents.has(row)) return true
    const id = sessionId(row)
    return (id && healthSessions.has(id)) || inHealthWorkspace(row)
  }

  ctx.on('agent/created', (payload) => {
    // A listener failure would veto the agent: everything here is best effort.
    try {
      const agent = (payload as unknown as { agent?: AgentLike })?.agent
      if (!agent || typeof agent !== 'object') return
      const scoped = agent.ctx as { systemPrompt?: { section?: (row: unknown) => unknown }; tools?: { restrict?: (filter: unknown) => unknown }; get?: (name: string) => unknown } | undefined
      if (inHealthWorkspace(agent) && !isSubAgent(agent)) {
        healthAgents.add(agent)
        const id = sessionId(agent)
        if (id) healthSessions.add(id)
        const prompt = scoped?.systemPrompt ?? (scoped?.get?.('systemPrompt') as typeof scoped extends { systemPrompt?: infer S } ? S : never)
        prompt?.section?.({ name: PROMPT_SECTIONS.orchestrator.name, order: PROMPT_SECTIONS.orchestrator.order, text: () => orchestratorPrompt(options.mount) })
        return
      }
      const tools = scoped?.tools ?? (scoped?.get?.('tools') as { restrict?: (filter: unknown) => unknown } | undefined)
      try {
        tools?.restrict?.({ deny: [...WRITE_TOOLS] })
      } catch {
        // one unknown name fails the whole filter: hide them one by one
        for (const name of WRITE_TOOLS) {
          try {
            tools?.restrict?.({ deny: [name] })
          } catch {
            // not registered in this process
          }
        }
      }
    } catch (error) {
      options.log?.(`orchestrator scope: ${error instanceof Error ? error.message : String(error)}`)
    }
  })

  // Outermost: the vendored Mirobody plugin appends its own rule notice (its guard, with a US-only crisis number) in
  // every workspace. LongPi removed its guard in 0.8.0 and drops that notice as well.
  ctx.on('agent/pre-step', async (_raw, next) => {
    const decision = await next()
    if (decision.kind !== 'enter') return decision
    const kept = decision.messages.filter((message: unknown) => !isMirobodyNotice(message as never))
    return kept.length === decision.messages.length ? decision : { ...decision, messages: kept }
  }, { prepend: true })

  ctx.on('agent/pre-step', async (raw, next) => {
    const decision = await next()
    try {
      const payload = raw as unknown as { agent?: AgentLike; messages: unknown[]; step?: number; signal?: AbortSignal }
      if (decision.kind !== 'enter' || payload.signal?.aborted) return decision
      const agent = payload.agent
      const id = sessionId(agent)
      // Only LongPi's own workspace, and only the person's sessions there (a fork included): a sub-agent gets its
      // task from its parent.
      if (!id || !isHealth(agent) || isSubAgent(agent)) return decision
      // What the person just said, for the tools that check a quote against their words (remember_for_me,
      // log_care_visit) and for the memory distiller after the turn.
      const said = latestPersonText(payload.messages)
      if (said.trim()) rememberPersonText(sessionKey(agent), said)
      if (payload.step !== 1) return decision
      const extra: never[] = []
      const snap = await options.snapshot(8_000).catch(() => null)
      if (snap && id && injected.get(id) !== snap.page.inputs_fp) {
        injected.set(id, snap.page.inputs_fp)
        if (injected.size > 500) injected.delete(injected.keys().next().value as string)
        extra.push(pluginMessage(snapshotText(snap), 'snapshot', 'longpi-page'))
      }
      if (extra.length === 0 || payload.signal?.aborted) return decision
      return { ...decision, messages: [...decision.messages, ...extra] }
    } catch {
      return decision
    }
  })

  return { isHealth, injected }
}
