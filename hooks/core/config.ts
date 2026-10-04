export interface Config {
  skillsHome: string
  mirobodyPluginHome: string
  pythonBin: string
  mirobodyHome: string
  /** The Mirobody on this computer that LongPi pairs itself with (no address shown to the person). */
  mirobodyUrl: string
  mcpUrl: string
  mcpToken: string
  member: string
  timeoutMs: number
  skillPython: string
  skillTimeoutMs: number
  dataDir: string
  maxSkillMatches: number
  skillRuntimes: Record<string, string>
  skillsVersion: string
  /** On a DSH with no workspace, register <dataDir>/workspace as 「健康对话」 once, so a session can open. */
  bootstrapWorkspace: boolean
  /** Pi, the longevity coach, speaks for LongPi (default). false: LongPi's own voice and the three-part status reply. */
  coach: boolean
  /** Accepted for older profiles; the safety guard it scoped was removed in 0.8.0. */
  guardScope: 'health' | 'all'
  /** Per agent profile (AA §2.3): enabled (false = always the deterministic fallback), route and deadline. */
  agents: Record<string, AgentConfig>
  /** Daily caps on LongPi's own model calls (D8); over a cap every profile falls back silently. */
  budget: { dailyInputTokens: number; dailyOutputTokens: number; maxSpawnsPerDay: number }
  surfaces: { enabled: boolean; softRegenMinutes: number; chapterTokens: number; sse: boolean }
  engage: { codex: boolean; nudgesInWorkflow: boolean }
  /** 'local' is on-device research. 'live' still needs a production feed before anything leaves (D6). */
  scienceMode: 'off' | 'local' | 'simulated' | 'live'
  /** True only after the person uses the settings switch. The old implicit default is not this. */
  scienceModeSet: boolean
}

export interface AgentConfig {
  enabled: boolean
  provider: string
  model: string
  reasoningEffort: 'off' | 'low' | 'high' | 'max'
  maxTokens: number
  deadlineMs: number
}

/** AA §3.4 defaults. A profile left out of a user's patch keeps these. */
export const AGENT_DEFAULTS: Readonly<Record<string, AgentConfig>> = {
  coach: { enabled: true, provider: '', model: '', reasoningEffort: 'off', maxTokens: 900, deadlineMs: 15000 },
  memory_distiller: { enabled: true, provider: '', model: '', reasoningEffort: 'off', maxTokens: 400, deadlineMs: 10000 },
  triage: { enabled: true, provider: '', model: 'deepseek-v4-pro', reasoningEffort: 'low', maxTokens: 1500, deadlineMs: 30000 },
  retest_reviewer: { enabled: true, provider: '', model: '', reasoningEffort: 'off', maxTokens: 600, deadlineMs: 15000 },
  plan_codesigner: { enabled: true, provider: '', model: '', reasoningEffort: 'low', maxTokens: 2000, deadlineMs: 60000 },
  report_reader: { enabled: true, provider: '', model: '', reasoningEffort: 'low', maxTokens: 2000, deadlineMs: 60000 },
  research_coordinator: { enabled: true, provider: '', model: '', reasoningEffort: 'high', maxTokens: 2000, deadlineMs: 60000 },
}

/** The settings for one profile: the user's patch over the defaults. */
export function agentConfig(config: Partial<Pick<Config, 'agents'>> | undefined, id: string): AgentConfig {
  const base = AGENT_DEFAULTS[id] ?? { enabled: true, provider: '', model: '', reasoningEffort: 'off', maxTokens: 800, deadlineMs: 15000 }
  const own = config?.agents?.[id]
  return own && typeof own === 'object' ? { ...base, ...own } : { ...base }
}

export const BUDGET_DEFAULTS = { dailyInputTokens: 200000, dailyOutputTokens: 20000, maxSpawnsPerDay: 3 } as const
export const SURFACES_DEFAULTS = { enabled: true, softRegenMinutes: 30, chapterTokens: 150000, sse: true } as const

/** The settings LongPi runs with in Claude Code. The record lives on this computer (mcpUrl local:). */
export const DEFAULT_CONFIG: Config = {
  skillsHome: '',
  mirobodyPluginHome: '',
  pythonBin: '',
  mirobodyHome: '',
  mirobodyUrl: '',
  mcpUrl: 'local:',
  mcpToken: '',
  member: '',
  timeoutMs: 30000,
  skillPython: '',
  skillTimeoutMs: 120000,
  dataDir: '',
  maxSkillMatches: 8,
  skillRuntimes: {},
  skillsVersion: '',
  bootstrapWorkspace: false,
  coach: true,
  guardScope: 'health',
  agents: { ...AGENT_DEFAULTS },
  budget: { ...BUDGET_DEFAULTS },
  surfaces: { ...SURFACES_DEFAULTS, sse: false },
  engage: { codex: true, nudgesInWorkflow: false },
  scienceMode: 'local',
  scienceModeSet: false,
}

/** The settings with the person's own over the defaults (one level deep for the grouped ones). */
export function configFrom(own: Partial<Config> = {}): Config {
  return {
    ...DEFAULT_CONFIG,
    ...own,
    agents: { ...DEFAULT_CONFIG.agents, ...(own.agents ?? {}) },
    budget: { ...DEFAULT_CONFIG.budget, ...(own.budget ?? {}) },
    surfaces: { ...DEFAULT_CONFIG.surfaces, ...(own.surfaces ?? {}) },
    engage: { ...DEFAULT_CONFIG.engage, ...(own.engage ?? {}) },
  }
}
