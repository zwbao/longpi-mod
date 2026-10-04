// Agent profiles, model calls and validators (AA §2.3, §3.3). Frozen at C0.

import type { Id, IsoTime, ModuleId, TokenUsage } from './common.ts'
import type { FactPack } from './factpack.ts'
import type { SurfaceKind } from './surfaces.ts'

export type AgentProfileId = 'coach' | 'triage' | 'report_reader' | 'plan_codesigner'
  | 'retest_reviewer' | 'research_coordinator' | 'memory_distiller'
export const AGENT_PROFILE_IDS: readonly AgentProfileId[] = ['coach', 'triage', 'report_reader', 'plan_codesigner', 'retest_reviewer', 'research_coordinator', 'memory_distiller']
export interface ObjectJsonSchema { type: 'object'; properties: Record<string, unknown>; required?: string[]; additionalProperties?: boolean }
export interface AgentRoute { provider?: string; model?: string; reasoningEffort: 'off' | 'low' | 'high' | 'max'; maxTokens: number }
export interface AgentProfile<I, O> {
  id: AgentProfileId
  owner: ModuleId
  modes: Array<'one_shot' | 'in_turn'>
  /** The system prompt, assembled from files under src/agents/prompts/ (sections owned by their modules). */
  prompt: string[]
  /** In-turn toolFilter.allow. */
  tools: string[]
  /** One-shot `emit` tool parameters = the sub-agent outputSchema. */
  output_schema: ObjectJsonSchema
  /** Overridden by config agents.<id>. */
  route: AgentRoute
  deadline_ms: number
  /** The slice sent (JSON); no raw record dumps and no display name (D10). */
  input(pack: FactPack, extra: I): unknown
  validate(out: unknown, pack: FactPack, extra: I): { ok: true; value: O } | { ok: false; errors: string[] }
  fallback(pack: FactPack, extra: I): O
}
export interface AgentRunRecord {
  profile: AgentProfileId; mode: 'one_shot' | 'in_turn'; at: IsoTime; inputs_fp: string
  source: 'model' | 'fallback'; attempts: number; latency_ms: number
  route: { provider: string; model: string; effort: string | null }
  usage: TokenUsage; errors?: string[]; budget_blocked?: boolean
}
export interface LlmCall {
  /** Never throws: returns the fallback with run.source='fallback'. */
  structured<I, O>(req: { profile: AgentProfile<I, O>; pack: FactPack; extra: I; signal?: AbortSignal }): Promise<{ value: O; run: AgentRunRecord }>
  /** The guard keeps this. */
  text(req: { system: string; user: string; route: AgentRoute; deadlineMs: number; signal?: AbortSignal }): Promise<string>
}
export interface Specialists {
  consult<O>(profile: AgentProfileId, task_zh: string, exec: { agent: unknown; signal: AbortSignal }): Promise<{ value: O; run: AgentRunRecord }>
}
export interface ValidatorRule {
  id: string; owner: ModuleId; applies: Array<SurfaceKind | 'feedback' | 'brief' | 'plan' | 'advice'>
  /** null = pass. */
  check(text: string, card: { fact_ids: Id[]; number_keys: string[] }, pack: FactPack): string | null
}
