// The contracts every module shares (AA §3.3), and the deps each module's register() receives.

import type { Config } from '../config.ts'
import type { MountState } from '../mirobody.ts'
import type { Bus } from './events.ts'
import type { MemoryApi } from './memory.ts'
import type { FactPack } from './factpack.ts'
import type { AgentRunRecord, LlmCall, Specialists, ValidatorRule } from './agents.ts'
import type { CandidateProvider } from './surfaces.ts'
import type { ModuleId } from './common.ts'

export type * from './common.ts'
export type * from './memory.ts'
export type * from './events.ts'
export type * from './factpack.ts'
export type * from './surfaces.ts'
export type * from './plan.ts'
export type * from './feedback.ts'
export type * from './engagement.ts'
export type * from './codex.ts'
export type * from './science.ts'
export type * from './triage.ts'
export type * from './agents.ts'
export type * from './library.ts'

export type RouteHandler = (req: { method: string; url: string; query: URLSearchParams; headers: Record<string, unknown> }, body: unknown) => Promise<unknown>

export interface CoreDeps {
  config: () => Config
  bus: Bus
  memory: MemoryApi
  factpack: { build(opts?: { refresh?: boolean }): Promise<FactPack>; cached(): FactPack | null }
  llm: LlmCall
  specialists: Specialists
  budget: { remaining(): { input: number; output: number; spawns: number }; record(run: AgentRunRecord): void }
  http: { route(method: 'GET' | 'POST' | 'DELETE', path: `/api/longpi/${string}`, handler: RouteHandler): void }
  nba: { register(module: ModuleId, provider: CandidateProvider): () => void }
  validators: { register(rule: ValidatorRule): () => void }
  mount: MountState
  /** Everything a journey is built from, read now (config, dataDir, records, catalog, today). */
  context: () => Promise<import('../journey.ts').JourneyContext>
  /** The dataDir now (config may change on reload). */
  dataDir: () => string
  /** Drop the cached records and tracking so the next build reads again. */
  invalidate: () => void
}
