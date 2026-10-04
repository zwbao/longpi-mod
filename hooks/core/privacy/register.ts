// Module entry. Hooks stay in this file so name redaction and consent gating run without editing shared listeners.

import type { IncomingMessage, ServerResponse } from '../../sys/http.ts'
import type { Context } from '../../sys/cordis.ts'
import { resolveRootDir } from '../paths.ts'
import { readRegistry } from '../people/store.ts'
import type { CoreDeps } from '../contracts/index.ts'
import type { ConsentRecord } from '../contracts/science.ts'
import { healthWorkspacePaths, insideWorkspace, type WorkspaceLike } from '../guard-scope.ts'
import { readProfile } from '../profile.ts'
import { MINOR_PREFERENCE_ZH, isGranted, minorView } from './consents.ts'
import { CONSENT_HOLD_ZH, heldStream, modelEgress, payloadText, personTextOf } from './egress.ts'
import { setFamilyNames, redactOutbound, redactText, stripWeightLoss, wordingRule } from './disclosure.ts'
import { withConsentOffer } from '../home-bp.ts'
import { bindPrivacy } from './index.ts'
import { exportZip, registerPrivacyRoutes, type PrivacyRuntime } from './routes.ts'

const GATE_TOOLS = new Set([
  'read_personal_situation', 'run_longevity_skill', 'draft_intervention_plan', 'read_intervention_plan',
  'review_interventions', 'model_intervention_goals', 'save_intervention_plan', 'log_intervention_checkin',
  'read_person_memory', 'remember_for_me', 'read_care_navigation', 'prepare_doctor_brief', 'log_care_visit',
  'save_self_measurement', 'record_medication_statement', 'save_personal_profile',
  'query_health_indicators', 'query_medications', 'query_genetic_data', 'resolve_reading',
  // deep analysis: no separate consent, but the same install-wide data-flow consent as every health tool
  'run_deep_analysis', 'import_analysis', 'read_deep_analysis',
])

const DRAFT_TOOLS = new Set(['draft_intervention_plan', 'read_intervention_plan', 'review_interventions'])
const WRAPPED = Symbol.for('longpi.privacy.wrapped')

interface TextBlock { type?: string; text?: string }

function gateText(dataDir: string): string {
  const pipl = isGranted(dataDir, 'pipl_sensitive')
  const flow = isGranted(dataDir, 'data_flow_deepseek')
  if (!pipl) return '你尚未单独同意处理健康信息，因此本次不读取你的指标，也不提供给模型。请打开 /api/longpi/privacy?view=page 完成单独同意。'
  if (!flow) return '已记录健康信息的单独同意。还需同意把健康对话发给 DeepSeek，才能读取这些数值。'
  return ''
}

function redactBlocks(content: unknown, name: string): TextBlock[] | null {
  if (!Array.isArray(content)) return null
  return content.map((part) => {
    if (!part || typeof part !== 'object') return part as TextBlock
    const row = part as TextBlock
    if (typeof row.text !== 'string') return row
    return { ...row, text: redactText(row.text, name) }
  })
}

function redactMessages(messages: unknown[], name: string): unknown[] {
  return messages.map((message) => {
    if (!message || typeof message !== 'object') return message
    const row = message as { content?: unknown }
    const content = redactBlocks(row.content, name)
    return content ? { ...row, content } : message
  })
}

function workspacesOf(ctx: Context): WorkspaceLike[] {
  try {
    const get = (ctx as unknown as { get?: (name: string) => unknown }).get
    const registry = get?.call(ctx, 'workspaceRegistry') as { list?: () => ReadonlyArray<{ path?: unknown; title?: unknown }> } | undefined
    if (typeof registry?.list !== 'function') return []
    return registry.list().map((row) => ({ path: String(row.path ?? ''), title: typeof row.title === 'string' ? row.title : '' }))
  } catch {
    return []
  }
}

/** Consent lives with the holder, for the whole install. */
let consentDirOf: () => string = () => ''
const consentDir = () => consentDirOf()

export function register(ctx: Context, deps: CoreDeps): void {
  consentDirOf = () => resolveRootDir(deps.config().dataDir)
  bindPrivacy({
    dataDir: () => deps.dataDir(),
    scienceMode: () => deps.config().scienceMode ?? 'local',
    codexEnabled: () => deps.config().engage?.codex !== false,
  })
  // The person chatting is the holder: their name becomes 你; family members' names become their labels.
  setFamilyNames(() => readRegistry(resolveRootDir(deps.config().dataDir)).people.map((p) => [p.name, p.label_zh] as [string, string]))
  const nameOf = (): string => {
    try {
      return readProfile(resolveRootDir(deps.config().dataDir)).displayName
    } catch {
      return ''
    }
  }
  const healthRoots = (): string[] => healthWorkspacePaths(deps.dataDir(), workspacesOf(ctx))
  const healthSessions = new Set<string>()
  const noteAgent = (agent: unknown): void => {
    const row = agent as { session?: { id?: unknown; header?: { cwd?: unknown } } } | null
    const id = typeof row?.session?.id === 'string' ? row.session.id : ''
    const cwd = typeof row?.session?.header?.cwd === 'string' ? row.session.header.cwd : ''
    if (!id || !cwd) return
    if (healthRoots().some((root) => insideWorkspace(cwd, root))) healthSessions.add(id)
  }
  const syncMinor = (): void => {
    try {
      if (!minorView(readProfile(deps.dataDir())).minor) return
      deps.memory.apply([{
        op: 'add',
        item: {
          kind: 'preference',
          key: 'codex_enabled',
          value: false,
          text_zh: MINOR_PREFERENCE_ZH,
          confirmed: true,
          provenance: { kind: 'rule', at: new Date().toISOString(), by: 'M11' },
        },
      }], 'M11')
    } catch {
      // a missing memory file must not block consent
    }
  }
  const runtime: PrivacyRuntime = {
    http: deps.http,
    dataDir: () => deps.dataDir(),
    consentDir,
    mode: () => deps.config().scienceMode ?? 'local',
    mcpUrl: () => deps.config().mcpUrl ?? '',
    emit: (scope, decision) => {
      deps.bus.emit('consent.changed', { scope, decision }, { module: 'M11', via: 'route' })
    },
    afterChange: () => {
      syncMinor()
      try {
        deps.invalidate()
      } catch {
        // the next read still sees the files
      }
    },
  }
  registerPrivacyRoutes(runtime)
  const raw = (deps.http as { rawRoute?: (path: `/api/longpi/${string}`, handler: (req: IncomingMessage, res: ServerResponse) => void) => void }).rawRoute
  if (typeof raw === 'function') {
    raw('/api/longpi/privacy/export', (req, res) => {
      if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
        res.statusCode = 405
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end('GET only')
        return
      }
      try {
        const { zip, filename } = exportZip(runtime)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/zip')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        res.setHeader('Cache-Control', 'no-store')
        res.end(zip)
      } catch (error) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'export failed' }))
      }
    })
  }
  try {
    deps.validators.register(wordingRule())
  } catch {
    // validators are optional in a host that has not built the registry
  }

  ctx.on('agent/created', (payload) => {
    try {
      noteAgent((payload as { agent?: unknown } | undefined)?.agent)
    } catch {
      // a failed note must not veto the agent
    }
  })

  const redactEntered = async (agent: unknown, next: () => Promise<{ kind: string; messages?: unknown[] }>) => {
    const decision = await next()
    try {
      noteAgent(agent)
      if (decision.kind !== 'enter' || !Array.isArray(decision.messages)) return decision
      return { ...decision, messages: redactMessages(decision.messages, nameOf()) }
    } catch {
      return decision
    }
  }
  ctx.on('agent/pre-step', (payload, next) => redactEntered(payload.agent, next) as ReturnType<typeof next>)
  queueMicrotask(() => {
    try {
      ctx.on('agent/pre-step', (payload, next) => redactEntered(payload.agent, next) as ReturnType<typeof next>)
      ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
        const built = await next()
        try {
          const name = nameOf()
          for (const section of built.sections) section.text = redactText(section.text, name)
          for (const row of built.contexts) row.text = redactText(row.text, name)
          for (const [key, value] of Object.entries(built.variables)) {
            if (typeof value === 'string') built.variables[key] = redactText(value, name)
          }
        } catch {
          // a prompt that cannot be walked is sent as assembled
        }
        return built
      })
    } catch {
      // the inner pre-step redaction is already registered
    }
  })

  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next()
    try {
      const name = nameOf()
      const tool = exec.name
      if (decision.kind === 'block') {
        const feedback = redactBlocks(decision.feedback, name)
        return feedback ? { ...decision, feedback: feedback as typeof decision.feedback } : decision
      }
      if (decision.kind !== 'accept') return decision
      const gate = GATE_TOOLS.has(tool) ? gateText(consentDir()) : ''
      // A number they just asked to record is stored, and the consent is offered in the same turn.
      if (gate && tool === 'save_self_measurement') {
        const carried = result && typeof result === 'object' && 'value' in result && result.value != null ? result.value : ('content' in decision ? decision.content : undefined)
        return { kind: 'accept', content: withConsentOffer(carried) }
      }
      if (gate) return { kind: 'accept', content: [{ type: 'text', text: gate }] }
      const minor = minorView(readProfile(deps.dataDir())).minor
      const carried = 'value' in decision ? decision.value : result.isError ? undefined : result.value
      if (minor && DRAFT_TOOLS.has(tool) && carried && typeof carried === 'object') {
        return { kind: 'accept', value: redactOutbound(stripWeightLoss(carried), name) as typeof carried }
      }
      const source = 'content' in decision && decision.content ? decision.content : result.content
      const content = redactBlocks(source, name)
      if (!content) return decision
      return { kind: 'accept', content: content as typeof source }
    } catch {
      return decision
    }
  })

  const inject = (ctx as unknown as { inject?: (names: string[], cb: (scoped: Record<string, unknown>) => void) => void }).inject
  if (typeof inject === 'function') {
    inject.call(ctx, ['llm'], (scoped) => {
      const llm = scoped.llm as { stream?: ((options: Record<string, unknown>) => unknown) & { [WRAPPED]?: boolean } } | undefined
      if (!llm || typeof llm.stream !== 'function' || llm.stream[WRAPPED]) return
      const original = llm.stream.bind(llm)
      const stream = (options: Record<string, unknown>) => {
        const name = nameOf()
        const next = { ...options }
        if (typeof next.system === 'string') next.system = redactText(next.system, name)
        if (Array.isArray(next.messages)) next.messages = redactMessages(next.messages, name)
        const granted = isGranted(consentDir(), 'data_flow_deepseek')
        const person = personTextOf(next)
        const decision = modelEgress(granted, payloadText(next), person)
        if (decision === 'hold') return heldStream(CONSENT_HOLD_ZH)
        return original(next)
      }
      stream[WRAPPED] = true
      llm.stream = stream
    })
    inject.call(ctx, ['deepseekLlmApiExtensions'], (scoped) => {
      const registry = scoped.deepseekLlmApiExtensions as { prepare?: ((request: { sessionId?: string }) => Promise<{ fields?: Record<string, unknown>; accept?: () => Promise<void> }>) & { [WRAPPED]?: boolean } } | undefined
      if (!registry || typeof registry.prepare !== 'function' || registry.prepare[WRAPPED]) return
      const original = registry.prepare.bind(registry)
      const sessionHealth = (sessionId: string | undefined): boolean => {
        if (!sessionId) return false
        if (healthSessions.has(sessionId)) return true
        try {
          const get = (ctx as unknown as { get?: (name: string) => unknown }).get
          const sessions = get?.call(ctx, 'sessions') as { get?: (id: string) => { header?: { cwd?: string } } } | undefined
          const cwd = sessions?.get?.(sessionId)?.header?.cwd ?? ''
          return Boolean(cwd) && healthRoots().some((root) => insideWorkspace(cwd, root))
        } catch {
          return false
        }
      }
      const prepare = async (request: { sessionId?: string }) => {
        const prepared = await original(request)
        const name = nameOf()
        const fields: Record<string, unknown> = {}
        const health = sessionHealth(request.sessionId)
        const upload = health ? isGranted(consentDir(), 'session_log_upload') : true
        for (const [key, value] of Object.entries(prepared?.fields ?? {})) {
          if (key === 'dsh_session_log' && !upload) continue
          fields[key] = redactOutbound(value, name)
        }
        const dropped = health && !upload && prepared?.fields && 'dsh_session_log' in prepared.fields
        return { fields, accept: dropped ? async () => {} : async () => { await prepared?.accept?.() } }
      }
      prepare[WRAPPED] = true
      registry.prepare = prepare
    })
  }
  syncMinor()
}
