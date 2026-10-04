// Health conversations happen in their own workspace, 「健康对话」, so LongPi's persona and rules never reach the
// person's other (coding, writing) workspaces. It is added once, next to whatever workspaces DSH already has
// (they are never touched): a folder under the LongPi home, named apart from the sidebar's 健康 page. One an
// earlier version created as 「健康」 counts. A marker file records that it was done, so a workspace the person
// later deletes is never created again.

import { existsSync, mkdirSync, realpathSync, writeFileSync } from '../sys/fs.ts'
import { join } from '../sys/path.ts'

/** The part of DSH's workspaceRegistry service (@deepseek-ai/dsh-workspace) this uses. */
export interface WorkspaceRegistryLike {
  list(): ReadonlyArray<{ id: string; path: string; title?: string }>
  create(path: string, title?: string): Promise<{ id: string; path: string }>
}

export const WORKSPACE_MARKER = 'workspace-bootstrap.json'
export const WORKSPACE_DIR = 'workspace'
export const WORKSPACE_TITLE = '健康对话'

export type BootstrapResult =
  | { status: 'created'; path: string; workspace_id: string }
  | { status: 'disabled' | 'done_before' | 'not_empty' | 'no_registry' }
  | { status: 'error'; error: string }

/** Create the 健康对话 workspace once, unless one already exists. Never throws. */
export async function bootstrapWorkspace(
  registry: WorkspaceRegistryLike | null | undefined,
  options: { dataDir: string; enabled: boolean; now?: Date },
): Promise<BootstrapResult> {
  try {
    if (!options.enabled) return { status: 'disabled' }
    if (!registry || typeof registry.list !== 'function' || typeof registry.create !== 'function') return { status: 'no_registry' }
    const marker = join(options.dataDir, WORKSPACE_MARKER)
    if (existsSync(marker)) return { status: 'done_before' }
    if (registry.list().some((w) => ['健康对话', '健康'].includes(String(w.title ?? '').trim()))) return { status: 'not_empty' }
    const dir = join(options.dataDir, WORKSPACE_DIR)
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    // The registry keys workspaces by canonical path; give it one (a symlinked home resolves here).
    const path = realpathSync(dir)
    const workspace = await registry.create(path, WORKSPACE_TITLE)
    const row = { created_at: (options.now ?? new Date()).toISOString(), path, workspace_id: String(workspace.id) }
    writeFileSync(marker, `${JSON.stringify(row, null, 2)}\n`, { mode: 0o600 })
    return { status: 'created', path, workspace_id: row.workspace_id }
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300) }
  }
}
