// @deepseek-ai/dsh-tools: defineTool is the identity; register.tsx turns each definition into a Claude
// Code tool (mcp__longpi__<name>) with a JSON schema built from its parameters.
import type { ToolDef } from './cordis.ts'

export function defineTool<T extends ToolDef>(def: T): T {
  return def
}
